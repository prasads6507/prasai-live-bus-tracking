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
import '../widgets/drop_off_list.dart';
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
  
  bool _followBus = false;
  bool _hasInitialCentered = false;
  LocationPoint? _mapFocusLocation;
  
  // Real data state
  String _eta = "--";
  String _distance = "--";
  String _currentRoadName = "Locating...";
  double _busSpeed = 0.0;
  int _stopsRemaining = 0;
  String _totalTime = "-- min";
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
             setState(() {
               _userPosition = pos;
               if (!_hasInitialCentered) {
                 _focusUserLocation();
                 _hasInitialCentered = true;
               }
             });
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
    // Initial fetch
    _updateMetrics();
    _metricsTimer = Timer.periodic(const Duration(seconds: 5), (_) => _updateMetrics());
  }

  void _focusUserLocation() {
    if (_userPosition != null) {
      if (mounted) {
        setState(() {
          _followBus = false;
          _mapFocusLocation = LocationPoint(
            latitude: _userPosition!.latitude,
            longitude: _userPosition!.longitude,
            timestamp: DateTime.now(),
          );
        });
      }
    }
  }

  void _focusBusLocation() {
    if (_currentBus?.location != null) {
      if (mounted) {
        setState(() {
          _followBus = true;
          _mapFocusLocation = LocationPoint(
            latitude: _currentBus!.location!.latitude,
            longitude: _currentBus!.location!.longitude,
            timestamp: DateTime.now(),
          );
        });
      }
    }
  }

  void _updateMetrics() {
    if (_currentBus == null) return;
    
    final busLoc = _currentBus!.location;
    if (busLoc == null) return;

    // 1. Distance and ETA
    double distanceKm = 0.0;
    String distanceDisplay = "-- km";
    String etaDisplay = "-- min";
    
    if (_userPosition != null) {
      distanceKm = const Distance().as(LengthUnit.Meter, 
        LatLng(_userPosition!.latitude, _userPosition!.longitude), 
        LatLng(busLoc.latitude, busLoc.longitude)
      ) / 1000.0;
      distanceDisplay = "${distanceKm.toStringAsFixed(1)} km";
      
      final speedMph = (_currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.location!.speed! * 2.23694) : 20.0; 
      final timeHours = (distanceKm * 0.621371) / speedMph; 
      final timeMinutes = (timeHours * 60).round();
      etaDisplay = "$timeMinutes min";
    }

    // 2. Routing Metrics
    int remaining = 0;
    String totalTimeDisplay = "-- min";
    
    if (_currentRoute != null) {
      final totalStops = _currentRoute!.stops.length;
      final completed = _currentBus!.completedStops.length;
      remaining = (totalStops - completed).clamp(0, totalStops);
      
      final estimatedTotalMins = totalStops * 3;
      totalTimeDisplay = "$estimatedTotalMins min";
    }

    if (mounted) {
      setState(() {
        _distance = distanceDisplay;
        _eta = etaDisplay;
        _stopsRemaining = remaining;
        _totalTime = totalTimeDisplay;
      });
    }
  }

  List<DropOffItem> _buildDropOffItems() {
    if (_currentRoute == null || _currentBus == null) return [];
    
    final completedStops = _currentBus!.completedStops;
    final stopList = _currentRoute!.stops;
    
    final nextStopIndex = stopList.indexWhere((s) => !completedStops.contains(s.id));
    
    return List.generate(stopList.length, (index) {
      final stop = stopList[index];
      final isCompleted = completedStops.contains(stop.id);
      final isNext = index == nextStopIndex;
      
      return DropOffItem(
        time: "TBD", 
        location: stop.stopName,
        isCompleted: isCompleted,
        isNext: isNext,
      );
    });
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
              followBus: _followBus,
              focusedLocation: _mapFocusLocation,
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
                icon: Icons.my_location,
                color: AppColors.surface,
                onTap: _focusUserLocation,
              ),
            ),
          ),

          // Track Live Button (Above Overlay)
          Positioned(
            bottom: 310,
            right: 16,
            child: SafeArea(
              child: ElevatedButton.icon(
                onPressed: _focusBusLocation,
                icon: const Icon(Icons.directions_bus, size: 20),
                label: const Text("Track Live"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 8,
                  shadowColor: AppColors.primary.withOpacity(0.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
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

          DraggableScrollableSheet(
            initialChildSize: 0.35,
            minChildSize: 0.20,
            maxChildSize: 0.85,
            builder: (context, scrollController) {
              return Container(
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                  boxShadow: [
                    BoxShadow(color: Colors.black26, blurRadius: 10, spreadRadius: 0, offset: Offset(0, -5))
                  ],
                ),
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Column(
                    children: [
                      const SizedBox(height: 12),
                      Container(
                        width: 40, 
                        height: 4, 
                        decoration: BoxDecoration(
                          color: AppColors.textTertiary.withOpacity(0.3), 
                          borderRadius: BorderRadius.circular(2)
                        )
                      ),
                      TrackBottomSheet(
                        eta: _eta,
                        distance: _distance,
                        stopsRemaining: _stopsRemaining,
                        totalTime: _totalTime,
                      ),
                      if (_currentRoute != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          child: DropOffList(items: _buildDropOffItems()),
                        ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              );
            },
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
