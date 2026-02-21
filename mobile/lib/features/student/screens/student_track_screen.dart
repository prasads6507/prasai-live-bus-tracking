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
                 
                 // Immediately after finding user, switch to tracking bus automatically
                 Future.delayed(const Duration(seconds: 2), () {
                   if (mounted) _focusBusLocation();
                 });
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

    // 1. Distance and ETA to student
    double distanceToUserKm = 0.0;
    String distanceDisplay = "-- km";
    String etaDisplay = "-- min";
    
    if (_userPosition != null) {
      distanceToUserKm = const Distance().as(LengthUnit.Meter, 
        LatLng(_userPosition!.latitude, _userPosition!.longitude), 
        LatLng(busLoc.latitude, busLoc.longitude)
      ) / 1000.0;
      
      final speedMph = (_currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.location!.speed! * 2.23694) : 20.0; 
      final timeHours = (distanceToUserKm * 0.621371) / speedMph; 
      final timeMinutes = (timeHours * 60).round();
      etaDisplay = "$timeMinutes min";
    }

    // 2. Routing Metrics (Distance to final stop)
    int remaining = 0;
    String totalTimeDisplay = "-- min";
    
    if (_currentRoute != null && _currentRoute!.stops.isNotEmpty) {
      final stopList = _currentRoute!.stops;
      final finalStop = stopList.last;
      
      double distanceToFinalKm = const Distance().as(
        LengthUnit.Meter,
        LatLng(busLoc.latitude, busLoc.longitude),
        LatLng(finalStop.latitude, finalStop.longitude)
      ) / 1000.0;
      distanceDisplay = "${distanceToFinalKm.toStringAsFixed(1)} km";
      
      final speedMph = (_currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.location!.speed! * 2.23694) : 20.0;
      final totalTimeHours = (distanceToFinalKm * 0.621371) / speedMph;
      totalTimeDisplay = "${(totalTimeHours * 60).round()} min";

      // Calculate completed using backend data OR local 100m radius tracking
      final completed = _currentBus!.completedStops.length;
      remaining = (stopList.length - completed).clamp(0, stopList.length);
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
    
    final busLoc = _currentBus!.location;
    final completedStops = _currentBus!.completedStops.toList(); // Immutable copy to check backend
    final stopList = _currentRoute!.stops;
    
    // We determine the current stop by checking distances. 100m radius = 0.1km
    String? currentStopId;
    
    if (busLoc != null) {
      for (var stop in stopList) {
        double dist = const Distance().as(
           LengthUnit.Meter,
           LatLng(busLoc.latitude, busLoc.longitude),
           LatLng(stop.latitude, stop.longitude)
        );
        if (dist <= 100.0) {
           currentStopId = stop.id;
           // If we're at a stop, it shouldn't be marked completed *until we leave*
           // so we remove it from local completed view if it was there falsely.
           completedStops.remove(stop.id);
           break;
        }
      }
    }
    
    final nextStopIndex = stopList.indexWhere((s) => s.id == currentStopId);
    final upcomingIndex = nextStopIndex != -1 ? nextStopIndex : stopList.indexWhere((s) => !completedStops.contains(s.id));

    return List.generate(stopList.length, (index) {
      final stop = stopList[index];
      
      // A stop is completed if the backend says so AND it's not the current stop we are hovering in.
      final isCompleted = completedStops.contains(stop.id);
      final isCurrent = stop.id == currentStopId;
      // If none is current, the first uncompleted is "next". If one is current, it's green.
      final isNext = (isCurrent || index == upcomingIndex);
      
      return DropOffItem(
        time: isCurrent ? "Arrived" : (isCompleted ? "Done" : "TBD"), 
        location: stop.stopName,
        isCompleted: isCompleted,
        isCurrent: isCurrent,
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

          // Top overlay: Back, Speed/Road, Track Live
          Positioned(
            top: 24,
            left: 16,
            right: 16,
            child: SafeArea(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildCircleButton(
                    icon: Icons.arrow_back,
                    onTap: () => context.pop(),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.background.withOpacity(0.95),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.divider.withOpacity(0.5), width: 1.0),
                        boxShadow: [
                          BoxShadow(color: Colors.black12, blurRadius: 10, spreadRadius: 1)
                        ]
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.location_on, color: AppColors.primary, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  "BUS LOCATION",
                                  style: AppTypography.textTheme.labelSmall?.copyWith(
                                    color: AppColors.textTertiary,
                                    letterSpacing: 1.2,
                                    fontSize: 9,
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
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.divider),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  "${_busSpeed.toStringAsFixed(0)}",
                                  style: AppTypography.textTheme.titleSmall?.copyWith(
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
                  ),
                  const SizedBox(width: 8),
                  _buildCircleButton(
                    icon: Icons.my_location, // Using location icon for tracking re-sync
                    color: AppColors.primary,
                    iconColor: Colors.white,
                    onTap: _focusBusLocation,
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
    Color? iconColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (color ?? AppColors.surface).withOpacity(0.95),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, spreadRadius: 1),
          ],
        ),
        child: Icon(icon, color: iconColor ?? AppColors.textPrimary, size: 20),
      ),
    );
  }
}
