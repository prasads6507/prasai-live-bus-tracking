import 'dart:async';
import 'package:flutter/material.dart';
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
import '../../../../data/models/location_point.dart';
import '../widgets/track_bottom_sheet.dart';
import '../../map/widgets/mobile_maplibre.dart';
import 'package:geocoding/geocoding.dart' as geo;

class StudentTrackScreen extends ConsumerStatefulWidget {
  final String? busId; 

  const StudentTrackScreen({super.key, this.busId});

  @override
  ConsumerState<StudentTrackScreen> createState() => _StudentTrackScreenState();
}

class _StudentTrackScreenState extends ConsumerState<StudentTrackScreen> {
  StreamSubscription? _busSubscription;
  StreamSubscription<Position>? _positionStream;
  
  bool _isCameraLocked = true;
  
  // Real data state
  String _eta = "--";
  String _distance = "--";
  String _currentRoadName = "Locating...";
  double _busSpeed = 0.0;
  int _stopsRemaining = 0;
  Bus? _currentBus;
  BusRoute? _currentRoute;
  Position? _userPosition;
  Timer? _metricsTimer;

  @override
  void initState() {
    super.initState();
    _subscribeToBusUpdates();
    _startMetricsUpdates();
    _startLocationStreaming();
  }

  @override
  void dispose() {
    _busSubscription?.cancel();
    _positionStream?.cancel();
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
      // Quiet fail
    }
  }

  void _subscribeToBusUpdates() {
    final collegeId = ref.read(selectedCollegeIdProvider);
    if (collegeId == null) return;

    final busId = widget.busId ?? 'BUS_001';

    _busSubscription = ref.read(firestoreDataSourceProvider)
        .getBus(collegeId, busId)
        .listen((bus) {
          if (mounted) {
            setState(() {
              _currentBus = bus;
              _busSpeed = bus.currentSpeed ?? (bus.location?.speed ?? 0.0) * 2.23694; 
            });
            
            if (bus.currentRoadName != null && bus.currentRoadName!.isNotEmpty) {
               if (mounted) setState(() => _currentRoadName = bus.currentRoadName!);
            } else if (bus.location != null) {
              _updateRoadName(bus.location!.latitude, bus.location!.longitude);
            }
          }
          
          if (bus.activeTripId != null && (_currentRoute == null || _currentRoute!.id != bus.assignedRouteId)) {
            _fetchRouteForTrip(collegeId, bus.id);
          }
        });
  }
  
  Future<void> _fetchRouteForTrip(String collegeId, String busId) async {
     final tripStream = ref.read(firestoreDataSourceProvider).getActiveTrip(collegeId, busId);
     tripStream.first.then((trip) async {
       if (trip != null) {
         final route = await ref.read(firestoreDataSourceProvider).getRoute(trip.routeId);
         if (mounted) {
           setState(() => _currentRoute = route);
           _updateMetrics();
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
    
    final distance = const Distance().as(LengthUnit.Kilometer, 
      LatLng(_userPosition!.latitude, _userPosition!.longitude), 
      LatLng(busLoc.latitude, busLoc.longitude)
    );
    
    final speedMph = (_currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.location!.speed! * 2.23694) : 20.0; 
    
    final timeHours = (distance * 0.621371) / speedMph; 
    final timeMinutes = (timeHours * 60).round();
    
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
    final collegeId = ref.watch(selectedCollegeIdProvider);

    return AppScaffold(
      body: Stack(
        children: [
          if (collegeId != null)
            MobileMapLibre(
              collegeId: collegeId,
              selectedBusId: widget.busId ?? 'BUS_001',
              followBus: _isCameraLocked,
            ),

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

          // Speed & Road Overlay
          Positioned(
            bottom: 240,
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
}
