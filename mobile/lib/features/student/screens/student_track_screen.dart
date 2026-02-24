import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../data/datasources/api_ds.dart';
import 'package:dio/dio.dart';
import '../../../../data/providers.dart';
import '../../../../data/models/bus.dart';
import '../../../../data/models/route.dart';
import '../../../../data/models/location_point.dart';
import '../widgets/track_bottom_sheet.dart';
import '../widgets/drop_off_list.dart';
import '../../map/widgets/mobile_maplibre.dart';
import 'package:geocoding/geocoding.dart' as geo;
import '../../../../core/services/tracking_lifecycle_manager.dart';
import '../../../../core/services/notification_service.dart';

class StudentTrackScreen extends ConsumerStatefulWidget {
  final String? busId; 

  const StudentTrackScreen({super.key, this.busId});

  @override
  ConsumerState<StudentTrackScreen> createState() => _StudentTrackScreenState();
}

class _StudentTrackScreenState extends ConsumerState<StudentTrackScreen> {
  StreamSubscription? _busSubscription;
  StreamSubscription? _lifecycleSubscription;
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
  int _totalStops = 0;
  String _totalTime = "-- min";
  Bus? _currentBus;
  BusRoute? _currentRoute;
  Position? _userPosition;
  Timer? _metricsTimer;
  bool _isUserInBus = false;

  // No longer using relay for live tracking - using Firestore onSnapshot (5s updates)
  LocationPoint? _liveBusLocation;

  // Trip stop progress data (from Firestore trip doc)
  StreamSubscription? _tripSubscription;
  List<Map<String, dynamic>> _tripStopsSnapshot = [];
  Map<String, dynamic> _tripStopProgress = {};
  Map<String, dynamic> _tripEta = {};
  String? _tripDirection;
  StreamSubscription? _notifSubscription;

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
    _tripSubscription?.cancel();
    _metricsTimer?.cancel();
    _lifecycleSubscription?.cancel();
    _notifSubscription?.cancel();
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
             accuracy: LocationAccuracy.best, // 5m precision for "You are in bus" detection
             distanceFilter: 2, // 2m precision for road movement
           ),
         ).listen((pos) {
           if (mounted) {
             setState(() {
               _userPosition = pos;
               if (!_hasInitialCentered) {
                 _focusUserLocation();
                 _hasInitialCentered = true;
                 
                 // After finding user, smoothly animate to bus tracking
                 Future.delayed(const Duration(seconds: 2), () {
                   if (mounted) _focusBusLocation();
                 });
               }
             });
             _updateMetrics();
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
              _busSpeed = (bus.speedMph ?? bus.currentSpeed ?? (bus.location?.speed ?? 0.0) * 2.23694).toDouble();
              
              if (bus.location != null) {
                _liveBusLocation = LocationPoint(
                  latitude: bus.location!.latitude,
                  longitude: bus.location!.longitude,
                  heading: (bus.location!.heading ?? bus.currentHeading ?? 0.0).toDouble(),
                  speed: _busSpeed,
                  timestamp: DateTime.now(),
                );
                if (_followBus) _mapFocusLocation = _liveBusLocation;
              }
              
              if (bus.currentRoadName != null && bus.currentRoadName!.isNotEmpty) {
                 _currentRoadName = bus.currentRoadName!;
              } else if (bus.location != null) {
                _updateRoadName(bus.location!.latitude, bus.location!.longitude);
              }
            });
          }
          
          if (bus.activeTripId != null && (_currentRoute == null || _currentRoute!.id != bus.assignedRouteId)) {
            _fetchRouteForTrip(collegeId, bus.id);
          }

          // Subscribe to trip document for stopsSnapshot + stopProgress + eta
          if (bus.activeTripId != null) {
            _subscribeTripProgress(bus.activeTripId!);
            _setupLifecycleListener(collegeId, bus.id);
            _setupNotificationListener(bus.activeTripId!);
          } else {
            // Trip ended - Kill all GPS/Tracking
            _liveBusLocation = null;
            TrackingLifecycleManager.stopTrackingAndClearContext();
            _positionStream?.cancel();
            _positionStream = null;
          }
        });
  }

  void _setupNotificationListener(String tripId) {
    _notifSubscription?.cancel();
    _notifSubscription = FirebaseFirestore.instance
        .collection('stopArrivals')
        .where('tripId', isEqualTo: tripId)
        .where('timestamp', isGreaterThan: DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String())
        .snapshots()
        .listen((snapshot) {
          for (var change in snapshot.docChanges) {
            if (change.type == DocumentChangeType.added) {
              final data = change.doc.data() as Map<String, dynamic>;
              final stopName = data['stopName'] ?? 'Stop';
              final type = data['type'] ?? 'ARRIVED';

              if (type == 'ARRIVED' || type == 'ARRIVING') {
                NotificationService.showArrivalNotification(stopName);
              } else if (type == 'SKIPPED') {
                NotificationService.showSkipNotification(stopName);
              }
            }
          }
        });
  }



  void _subscribeTripProgress(String tripId) {
    _tripSubscription?.cancel();
    _tripSubscription = FirebaseFirestore.instance
        .collection('trips')
        .doc(tripId)
        .snapshots()
        .listen((snapshot) {
          if (!snapshot.exists || !mounted) return;
          final data = snapshot.data()!;
          setState(() {
            _tripStopsSnapshot = List<Map<String, dynamic>>.from(data['stopsSnapshot'] ?? []);
            _tripStopProgress = Map<String, dynamic>.from(data['stopProgress'] ?? {});
            _tripEta = Map<String, dynamic>.from(data['eta'] ?? {});
            _tripDirection = data['direction'] as String?;
            _totalStops = _tripStopsSnapshot.length;
            final currentIdx = (_tripStopProgress['currentIndex'] as num?)?.toInt() ?? 0;
            _stopsRemaining = _totalStops - currentIdx;
          });
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
    String etaDisplay = "-- min";
    bool userInBus = false;
    
    if (_userPosition != null) {
      final distanceToUserM = Geolocator.distanceBetween(
        _userPosition!.latitude, _userPosition!.longitude, 
        busLoc.latitude, busLoc.longitude
      );
      
      // Check if student is in the bus or very close (100m default precision to account for dual-device GPS drift)
      // Note: We use 100m as a safe "inside bus" threshold regardless of stop radius
      if (distanceToUserM <= 100.0) {
        userInBus = true;
        etaDisplay = "You're in the bus!";
      } else {
        final distanceToUserKm = distanceToUserM / 1000.0;
        // Fix: Speed is already in mph from backend natively
        final speedMph = (_currentBus?.speedMph ?? _currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.speedMph ?? _currentBus!.location!.speed!) : 20.0; 
        final timeHours = (distanceToUserKm * 0.621371) / speedMph; 
        final timeMinutes = (timeHours * 60).round();
        
        final pointTime = _currentBus?.location?.timestamp ?? DateTime.now();
        final ageSec = DateTime.now().difference(pointTime).inSeconds;
        final isStale = ageSec > 120;
        final status = isStale ? 'OFFLINE' : (_currentBus?.currentStatus ?? "MOVING");

        if (status == 'ARRIVING') {
           etaDisplay = "Arriving at next stop";
        } else if (status == 'ARRIVED') {
           etaDisplay = "At stop";
        } else if (status == 'OFFLINE') {
           etaDisplay = "Status: Offline";
        } else {
           etaDisplay = "ETA $timeMinutes min";
        }
      }
    }

    // 2. Routing Metrics (Distance to final stop)
    int remaining = 0;
    int total = 0;
    String totalTimeDisplay = "-- min";
    String distanceDisplay = "-- km";
    
    if (_currentRoute != null && _currentRoute!.stops.isNotEmpty) {
      final stopList = _currentRoute!.stops;
      total = stopList.length;
      final finalStop = stopList.last;
      
      double distanceToFinalKm = Geolocator.distanceBetween(
        busLoc.latitude, busLoc.longitude,
        finalStop.latitude, finalStop.longitude
      ) / 1000.0;
      distanceDisplay = "${(distanceToFinalKm * 0.621371).toStringAsFixed(1)} mi";
      
      // Fix: Speed is already in mph from backend natively
      final speedMph = (_currentBus?.speedMph ?? _currentBus?.location?.speed ?? 0) > 2 ? (_currentBus!.speedMph ?? _currentBus!.location!.speed!) : 20.0;
      final totalTimeHours = (distanceToFinalKm * 0.621371) / speedMph;
      totalTimeDisplay = "${(totalTimeHours * 60).round()} min";

      final int completed = (_tripStopProgress['arrivedStopIds']?.length ?? _currentBus!.completedStops.length).toInt();
      remaining = (stopList.length - completed).clamp(0, stopList.length).toInt();
    }

    if (mounted) {
      setState(() {
        _distance = distanceDisplay;
        _eta = etaDisplay;
        _stopsRemaining = remaining;
        _totalStops = total;
        _totalTime = totalTimeDisplay;
        _isUserInBus = userInBus;
      });
    }
  }

  List<DropOffItem> _buildDropOffItems() {
    if (_tripStopsSnapshot.isEmpty || _currentBus?.location == null) return [];

    final arrivedIds = List<String>.from(_tripStopProgress['arrivedStopIds'] ?? []);
    final skippedIds = List<String>.from(_tripStopProgress['skippedStopIds'] ?? []);
    final currentIndex = (_tripStopProgress['currentIndex'] as num?)?.toInt() ?? 0;
    final busLat = _currentBus!.location!.latitude;
    final busLng = _currentBus!.location!.longitude;

    return List.generate(_tripStopsSnapshot.length, (index) {
      final stop = _tripStopsSnapshot[index];
      final stopId = stop['stopId'] as String? ?? '';
      final stopLat = (stop['lat'] as num?)?.toDouble() ?? 0.0;
      final stopLng = (stop['lng'] as num?)?.toDouble() ?? 0.0;
      final radiusM = (stop['radiusM'] as num?)?.toDouble() ?? 100.0;
      
      final distM = Geolocator.distanceBetween(busLat, busLng, stopLat, stopLng);
      final isArrivedInDoc = arrivedIds.contains(stopId);
      final isSkippedInDoc = skippedIds.contains(stopId);

      String status;
      if (isSkippedInDoc) {
        status = "SKIPPED";
      } else if (isArrivedInDoc) {
        // Once bus crosses outside after arrived -> DEPARTED
        status = (distM <= radiusM) ? "ARRIVED" : "DEPARTED";
      } else {
        if (index < currentIndex) {
          status = "DEPARTED"; // Failsafe
        } else if (index > currentIndex) {
          status = "NEXT";
        } else {
          // Current targeted stop
          if (distM <= radiusM) {
            status = "ARRIVED";
          } else if (distM <= 804.672) { // 0.5 mile
            status = "ARRIVING";
          } else {
            status = "NEXT";
          }
        }
      }

      // Debug log (dev-only)
      debugPrint("[StatusCheck] Stop: ${stop['name']}, Dist: ${distM.toStringAsFixed(1)}m, Status: $status");

      return DropOffItem(
        time: status,
        location: stop['name'] as String? ?? stop['stopName'] as String? ?? '',
        isCompleted: status == "DEPARTED",
        isCurrent: status == "ARRIVED" || status == "ARRIVING",
        isNext: status == "NEXT",
        distanceM: (status == "ARRIVING" || status == "NEXT" && index == currentIndex) ? distM : null,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final collegeId = ref.watch(selectedCollegeIdProvider);

    return AppScaffold(
      body: _currentBus == null || _currentBus?.activeTripId == null || _currentBus!.activeTripId!.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.directions_bus_filled, size: 72, color: AppColors.textTertiary.withOpacity(0.4)),
                  const SizedBox(height: 16),
                  Text(
                    "Bus not started yet",
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "Check back later when the driver starts the trip.",
                    style: AppTypography.textTheme.bodyMedium?.copyWith(color: AppColors.textTertiary),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => context.pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    child: const Text("Go Back", style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            )
          : Stack(
        children: [
          if (collegeId != null)
            MobileMapLibre(
              collegeId: collegeId,
              selectedBusId: widget.busId ?? 'BUS_001',
              followBus: _followBus,
              focusedLocation: _mapFocusLocation,
              showStudentLocation: true,
              studentLocation: _userPosition != null
                  ? LocationPoint(
                      latitude: _userPosition!.latitude,
                      longitude: _userPosition!.longitude,
                      timestamp: DateTime.now(),
                    )
                  : null,
              liveBusLocation: _liveBusLocation,
              stopCircles: _tripStopsSnapshot.isNotEmpty
                  ? _tripStopsSnapshot.map((s) => {
                      'lat': (s['lat'] as num?)?.toDouble() ?? 0.0,
                      'lng': (s['lng'] as num?)?.toDouble() ?? 0.0,
                      'radiusM': s['radiusM'] ?? 100,
                      'name': s['name'] ?? '',
                      'id': s['stopId'] ?? s['id'] ?? s['_id'],
                    }).toList()
                  : null,
              nextStopId: _currentBus?.nextStopId,
              arrivedStopIds: _tripStopProgress['arrivedStopIds'] != null 
                  ? List<String>.from(_tripStopProgress['arrivedStopIds']) 
                  : _currentBus?.completedStops.map((e) => e.toString()).toList(),
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
                                Builder(builder: (context) {
                                  final pointTime = _currentBus?.location?.timestamp ?? DateTime.now();
                                  final isStale = DateTime.now().difference(pointTime).inSeconds > 120;
                                  final displayStatus = isStale ? 'OFFLINE' : (_currentBus?.currentStatus ?? 'MOVING');
                                  
                                  return Text(
                                    "$displayStatus • $_currentRoadName",
                                    style: AppTypography.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.bold,
                                      color: isStale ? AppColors.textSecondary : AppColors.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  );
                                }),
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
                  // Track bus button (re-sync)
                  _buildCircleButton(
                    icon: Icons.directions_bus,
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
                        isUserInBus: _isUserInBus,
                        driverName: _currentBus?.driverName,
                        driverPhone: _currentBus?.driverPhone,
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
