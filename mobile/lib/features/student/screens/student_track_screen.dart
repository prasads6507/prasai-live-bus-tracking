import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../data/providers.dart';
import '../../../../data/models/bus.dart';
import '../../../../data/models/route.dart';
import '../../auth/controllers/auth_controller.dart';
import '../widgets/track_bottom_sheet.dart';
import '../../map/logic/bus_animation_controller.dart';
import 'package:geocoding/geocoding.dart' as geo;

class StudentTrackScreen extends ConsumerStatefulWidget {
  final String? busId; // If null, use a default or first available

  const StudentTrackScreen({super.key, this.busId});

  @override
  ConsumerState<StudentTrackScreen> createState() => _StudentTrackScreenState();
}

class _StudentTrackScreenState extends ConsumerState<StudentTrackScreen> {
  final MapController _mapController = MapController();
  late final BusAnimationController _animationController;
  StreamSubscription? _busSubscription;
  StreamSubscription<Position>? _positionStream;
  
  // Track if we are following the bus camera
  bool _isCameraLocked = true;
  
  // Real data state
  String _eta = "--";
  String _distance = "--";
  String _currentRoadName = "Locating...";
  double _busSpeed = 0.0;
  int _stopsRemaining = 0;
  bool _hasCenteredOnUser = false;
  Bus? _currentBus;
  BusRoute? _currentRoute;
  Position? _userPosition;
  Timer? _metricsTimer;

  @override
  void initState() {
    super.initState();
    _animationController = BusAnimationController();
    _animationController.addListener(_onAnimationUpdate);
    _subscribeToBusUpdates();
    _startMetricsUpdates();
    _startLocationStreaming();
  }

  @override
  void dispose() {
    _animationController.removeListener(_onAnimationUpdate);
    _animationController.dispose();
    _busSubscription?.cancel();
    _positionStream?.cancel();
    _mapController.dispose();
    _metricsTimer?.cancel();
    super.dispose();
  }
  
  Future<void> _startLocationStreaming() async {
    try {
       LocationPermission permission = await Geolocator.checkPermission();
       if (permission == LocationPermission.denied) {
         permission = await Geolocator.requestPermission();
       }
       
       if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
         _positionStream = Geolocator.getPositionStream(
           locationSettings: const LocationSettings(
             accuracy: LocationAccuracy.high,
             distanceFilter: 5,
           ),
         ).listen((pos) {
           if (mounted) {
             setState(() => _userPosition = pos);
             
             // Auto-locate user once at startup
             if (!_hasCenteredOnUser) {
               _hasCenteredOnUser = true;
               _mapController.move(LatLng(pos.latitude, pos.longitude), 16.0);
               setState(() => _isCameraLocked = false); // Let user take control after initial jump
             }
           }
         });
       }
    } catch (e) {
      debugPrint("Error starting location stream: $e");
    }
  }

  Future<void> _updateRoadName(double lat, double lng) async {
    try {
      List<geo.Placemark> placemarks = await geo.placemarkFromCoordinates(lat, lng);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        final road = p.street ?? p.name ?? "Unknown Road";
        if (mounted && _currentRoadName != road) {
          setState(() => _currentRoadName = road);
        }
      }
    } catch (e) {
      // Quiet fail for geocoding
    }
  }

  void _onAnimationUpdate() {
    final point = _animationController.currentPoint;
    if (point != null && _isCameraLocked) {
      _mapController.move(
        LatLng(point.latitude, point.longitude), 
        _mapController.camera.zoom
      );
    }
  }

  void _subscribeToBusUpdates() {
    final collegeId = ref.read(selectedCollegeIdProvider);
    if (collegeId == null) return;

    // Use a default busId for demo if none provided
    final busId = widget.busId ?? 'BUS_001';

    _busSubscription = ref.read(firestoreDataSourceProvider)
        .getBus(collegeId, busId)
        .listen((bus) {
          if (mounted) {
            setState(() {
              _currentBus = bus;
              // Use the speed from Firestore (Mph)
              _busSpeed = bus.currentSpeed ?? (bus.location?.speed ?? 0.0) * 2.23694; 
            });
            
            // Prefer road name from Firestore if available
            if (bus.currentRoadName != null && bus.currentRoadName!.isNotEmpty) {
               if (mounted) setState(() => _currentRoadName = bus.currentRoadName!);
            } else if (bus.location != null) {
              _updateRoadName(bus.location!.latitude, bus.location!.longitude);
            }
          }
          
          if (bus.liveTrackBuffer.isNotEmpty) {
             _animationController.addPoints(bus.liveTrackBuffer);
          } else if (bus.location != null) {
             _animationController.addPoints([bus.location!]);
          }
          
          // Fetch Route if we have a trip and haven't fetched route yet
          if (bus.activeTripId != null && (_currentRoute == null || _currentRoute!.id != bus.assignedRouteId)) {
            _fetchRouteForTrip(collegeId, bus.id);
          }
        });
  }
  
  Future<void> _fetchRouteForTrip(String collegeId, String busId) async {
     // We need to fetch Trip first to get Route ID
     // Using a one-time fetch for simplicity or stream it
     // This is a bit disjointed, ideally backend sends routeId on Bus or we have a combined stream
     
     // Creating a temporary subscription to get trip info
     final tripStream = ref.read(firestoreDataSourceProvider).getActiveTrip(collegeId, busId);
     tripStream.first.then((trip) async {
       if (trip != null) {
         final route = await ref.read(firestoreDataSourceProvider).getRoute(trip.routeId);
         if (mounted) {
           setState(() => _currentRoute = route);
           _updateMetrics(); // Force update once we have route
         }
       }
     });
  }

  void _startMetricsUpdates() {
    _metricsTimer = Timer.periodic(const Duration(seconds: 5), (_) => _updateMetrics());
  }

  void _updateMetrics() {
    if (_currentBus == null || _currentRoute == null || _userPosition == null) return;
    
    final busLoc = _currentBus!.location;
    if (busLoc == null) return;
    
    // 1. Calculate Distance (Straight line for now)
    final distance = const Distance().as(LengthUnit.Kilometer, 
      LatLng(_userPosition!.latitude, _userPosition!.longitude), 
      LatLng(busLoc.latitude, busLoc.longitude)
    );
    
    // 2. Estimate ETA (Assume 20mph avg speed in city)
    // Time = Distance / Speed
    final speedMph = (_currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.location!.speed! * 2.23694) : 20.0; 
    // If speed is 0 or low, assume 20mph default
    
    // Distance/Speed results in hours, convert to minutes
    final timeHours = (distance * 0.621371) / speedMph; // Convert distance km to miles
    final timeMinutes = (timeHours * 60).round();
    
    // 3. Stops Remaining
    final totalStops = _currentRoute!.stops.length;
    final completed = _currentBus!.completedStops.length;
    final remaining = (totalStops - completed).clamp(0, totalStops);

    if (mounted) {
      setState(() {
        _distance = "${distance.toStringAsFixed(1)} km";
        _eta = "$timeMinutes min";
        _stopsRemaining = remaining;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Initial fallback position
    final defaultPos = const LatLng(40.916765, -74.171811); // Dummy fallback

    return AppScaffold(
      body: Stack(
        children: [
          ListenableBuilder(
            listenable: _animationController,
            builder: (context, child) {
              final point = _animationController.currentPoint;
              final currentPos = point != null ? LatLng(point.latitude, point.longitude) : defaultPos;
              final rotation = point?.heading ?? 0.0;

              return FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: currentPos,
                  initialZoom: 16.0,
                  onPositionChanged: (pos, hasGesture) {
                    if (hasGesture && _isCameraLocked) {
                      setState(() => _isCameraLocked = false);
                    }
                  },
                ),
                children: [
                   TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.bannu.mobile.mobile',
                  ),
                  
                  // User Location Marker
                  if (_userPosition != null)
                     MarkerLayer(
                       markers: [
                         Marker(
                           point: LatLng(_userPosition!.latitude, _userPosition!.longitude),
                           width: 40,
                           height: 40,
                           child: Stack(
                             alignment: Alignment.center,
                             children: [
                               Container(
                                 width: 20,
                                 height: 20,
                                 decoration: BoxDecoration(
                                   color: Colors.blue.withOpacity(0.3),
                                   shape: BoxShape.circle,
                                 ),
                               ),
                               Container(
                                 width: 12,
                                 height: 12,
                                 decoration: BoxDecoration(
                                   color: Colors.blue,
                                   shape: BoxShape.circle,
                                   border: Border.all(color: Colors.white, width: 2),
                                   boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)]
                                 ),
                               ),
                             ],
                           ),
                         )
                       ]
                     ),

                  if (point != null)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: currentPos,
                          width: 80, 
                          height: 80,
                          child: Transform.rotate(
                            angle: (rotation * (3.14159 / 180)),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                // Ping animation using a large container
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withOpacity(0.1),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                // The Pin Image
                                Image.asset(
                                  'assets/bus_pin.png',
                                  width: 60,
                                  height: 60,
                                ),
                                // Directional arrow on top
                                Positioned(
                                  top: 0,
                                  right: 0,
                                  child: Transform.rotate(
                                    angle: 0, // Heading already applied to parent
                                    child: Container(
                                      padding: const EdgeInsets.all(2),
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                        boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                                      ),
                                      child: Icon(Icons.navigation, color: AppColors.primary, size: 14),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              );
            },
          ),

          // controls - keeping top fixed
          Positioned(
            top: 24,
            left: 16,
            child: SafeArea(
              child: _buildCircleButton(
                icon: Icons.arrow_back,
                onTap: () => context.pop(),
              ),
            ),
          ),
          
          Positioned(
            top: 24,
            right: 16,
            child: SafeArea(
              child: _buildCircleButton(
                icon: _isCameraLocked ? Icons.gps_fixed : Icons.gps_not_fixed,
                color: _isCameraLocked ? AppColors.primary : AppColors.surface,
                onTap: () => setState(() => _isCameraLocked = !_isCameraLocked),
              ),
            ),
          ),

          // Speed & Road Overlay - Moved to Bottom (above Bottom Sheet)
          Positioned(
            bottom: 240, // Above TrackBottomSheet (~200px)
            left: 16,
            right: 16,
            child: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.background.withOpacity(0.95),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.divider.withOpacity(0.5), width: 1.0),
                      boxShadow: [
                        BoxShadow(color: Colors.black45, blurRadius: 15, spreadRadius: 2)
                      ]
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.location_on, color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                "CURRENT LOCATION",
                                style: AppTypography.textTheme.labelSmall?.copyWith(
                                  color: AppColors.textTertiary,
                                  letterSpacing: 1.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _currentRoadName,
                                style: AppTypography.textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.divider),
                          ),
                          child: Column(
                            children: [
                              Text(
                                "${_busSpeed.toStringAsFixed(0)}",
                                style: AppTypography.textTheme.titleMedium?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                "mph",
                                style: AppTypography.textTheme.labelSmall?.copyWith(
                                  color: AppColors.textSecondary,
                                  fontSize: 8,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Sheet
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: TrackBottomSheet(
              eta: _eta,
              distance: _distance,
              stopsRemaining: _stopsRemaining,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCircleButton({
    required IconData icon,
    required VoidCallback onTap,
    Color? color,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (color ?? AppColors.surface).withOpacity(0.9),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 8, spreadRadius: 1),
          ],
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
} // End Class
