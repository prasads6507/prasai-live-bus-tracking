import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart' as geo;
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/driver_location_service.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../data/providers.dart';
import '../../../data/models/bus.dart';
import '../../../data/models/location_point.dart';
import '../../../data/models/route.dart';
import '../widgets/driver_header.dart';
import '../widgets/assigned_bus_card.dart';
import '../widgets/trip_control_panel.dart';
import '../widgets/telemetry_card.dart';
import '../../../core/services/relay_service.dart';
import '../../../data/datasources/api_ds.dart';
import 'package:dio/dio.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  String? _selectedBusId;
  String? _selectedRouteId;
  String? _selectedDirection;
  String _searchQuery = "";
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final collegeId = ref.watch(selectedCollegeIdProvider);

    return AppScaffold(
      body: profileAsync.when(
        data: (profile) {
          if (profile == null || collegeId == null) {
            return const Center(child: Text("Profile not found"));
          }

          Widget content;
          if (_selectedBusId == null) {
            content = _buildBusSelection(collegeId, profile.id);
          } else if (_selectedRouteId == null) {
            content = _buildRouteSelection(collegeId);
          } else if (_selectedDirection == null) {
            content = _buildDirectionSelection();
          } else {
            content = _DriverContent(
              collegeId: collegeId,
              busId: _selectedBusId!,
              routeId: _selectedRouteId!,
              driverId: profile.id,
              direction: _selectedDirection!,
              onBack: () => setState(() {
                _selectedBusId = null;
                _selectedRouteId = null;
                _selectedDirection = null;
              }),
              onChangeRoute: () => setState(() {
                _selectedRouteId = null;
                _selectedDirection = null;
              }),
            );
          }

          return Column(
            children: [
              DriverHeader(
                driverName: profile.name ?? "Driver",
                isOnline: true,
                onLogout: () {
                  ref.read(authRepositoryProvider).signOut();
                  context.go('/login');
                },
              ),
              Expanded(child: content),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text("Error: $err")),
      ),
    );
  }

  Widget _buildBusSelection(String collegeId, String driverId) {
    // Show ALL buses in the college
    final busesStream = ref.watch(firestoreDataSourceProvider).getBuses(collegeId);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Select Your Bus",
                style: AppTypography.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Your assigned bus is at the top. You can also search for others.",
                style: AppTypography.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(height: 20),
              // Search Bar
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.divider.withOpacity(0.5)),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: const InputDecoration(
                    hintText: "Search by number or plate...",
                    prefixIcon: Icon(Icons.search, color: AppColors.textTertiary),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: StreamBuilder<List<Bus>>(
            stream: busesStream,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              
              var buses = snapshot.data ?? [];
              final queryText = _searchQuery.trim().toLowerCase();

              // 1. Sort: Assigned bus first, then by bus number
              buses.sort((a, b) {
                final aAssigned = a.driverId == driverId;
                final bAssigned = b.driverId == driverId;
                if (aAssigned && !bAssigned) return -1;
                if (!aAssigned && bAssigned) return 1;
                return a.busNumber.compareTo(b.busNumber);
              });

              // 2. Filter locally
              if (queryText.isNotEmpty) {
                buses = buses.where((bus) => 
                  bus.busNumber.toLowerCase().contains(queryText) || 
                  bus.plateNumber.toLowerCase().contains(queryText)
                ).toList();
              }

              if (buses.isEmpty) {
                return _buildEmptyState(isSearching: queryText.isNotEmpty);
              }

              return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    itemCount: buses.length,
                    itemBuilder: (context, index) {
                      final bus = buses[index];
                      final isMaintenance = bus.status == 'MAINTENANCE';

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: InkWell(
                          onTap: isMaintenance ? null : () {
                            setState(() {
                              _selectedBusId = bus.id;
                              if (bus.activeTripId != null || bus.status == 'ON_ROUTE') {
                                _selectedRouteId = bus.assignedRouteId ?? 'unknown';
                                _selectedDirection = 'active';
                              } else {
                                _selectedRouteId = bus.assignedRouteId;
                              }
                            });
                          },
                          borderRadius: BorderRadius.circular(24),
                          child: Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: isMaintenance ? AppColors.surface.withOpacity(0.5) : AppColors.surface,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: isMaintenance 
                                  ? AppColors.error.withOpacity(0.3) 
                                  : AppColors.divider.withOpacity(0.5)
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 56,
                                  height: 56,
                                  decoration: BoxDecoration(
                                    color: isMaintenance 
                                      ? AppColors.error.withOpacity(0.1) 
                                      : AppColors.primary.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Icon(
                                    isMaintenance ? Icons.build_circle_outlined : Icons.directions_bus, 
                                    color: isMaintenance ? AppColors.error : AppColors.primary, 
                                    size: 28
                                  ),
                                ),
                                const SizedBox(width: 20),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            bus.busNumber,
                                            style: AppTypography.textTheme.titleLarge?.copyWith(
                                              fontWeight: FontWeight.bold,
                                              color: isMaintenance ? AppColors.textSecondary : AppColors.textPrimary,
                                            ),
                                          ),
                                          if (isMaintenance) ...[
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: AppColors.error.withOpacity(0.1),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                "MAINTENANCE",
                                                style: AppTypography.textTheme.labelSmall?.copyWith(
                                                  color: AppColors.error,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        bus.plateNumber,
                                        style: AppTypography.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                                if (!isMaintenance)
                                  const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        );
      }

  Widget _buildRouteSelection(String collegeId) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() => _selectedBusId = null),
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 8),
              Text(
                "Select Route",
                style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(
            "Choose a route to start your trip",
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: FutureBuilder<List<BusRoute>>(
            future: ref.read(firestoreDataSourceProvider).getCollegeRoutes(collegeId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text("Error: ${snapshot.error}"));
              }
              
              final routes = snapshot.data ?? [];
              if (routes.isEmpty) {
                return const Center(child: Text("No routes found for this college."));
              }

              return ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: routes.length,
                itemBuilder: (context, index) {
                  final route = routes[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: InkWell(
                      onTap: () => setState(() => _selectedRouteId = route.id),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.divider.withOpacity(0.5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.map, color: AppColors.primary),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                route.routeName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDirectionSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          child: Row(
            children: [
              IconButton(
                onPressed: () => setState(() => _selectedRouteId = null),
                icon: const Icon(Icons.arrow_back),
              ),
              const SizedBox(width: 8),
              Text(
                "Select Direction",
                style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Text(
            "Choose pickup or drop-off for this trip",
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                InkWell(
                  onTap: () => setState(() => _selectedDirection = 'pickup'),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2196F3), Color(0xFF1976D2)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.upload_rounded, color: Colors.white, size: 48),
                        SizedBox(width: 20),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Pickup (AM)", style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                            SizedBox(height: 4),
                            Text("Stops in normal order", style: TextStyle(color: Colors.white70, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                InkWell(
                  onTap: () => setState(() => _selectedDirection = 'dropoff'),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFF9800), Color(0xFFE65100)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(color: Colors.orange.withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.download_rounded, color: Colors.white, size: 48),
                        SizedBox(width: 20),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Drop-off (PM)", style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                            SizedBox(height: 4),
                            Text("Stops in reverse order", style: TextStyle(color: Colors.white70, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState({bool isSearching = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSearching ? Icons.search_off : Icons.bus_alert_rounded, 
              size: 64, 
              color: AppColors.textTertiary.withOpacity(0.5)
            ),
            const SizedBox(height: 16),
            Text(
              isSearching ? "No buses found" : "No buses assigned to you.",
              style: const TextStyle(color: AppColors.textTertiary, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              isSearching 
                ? "Try searching for a different bus number."
                : "Please contact your administrator to assign a bus to your profile.",
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textTertiary.withOpacity(0.7)),
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverContent extends ConsumerStatefulWidget {
  final String collegeId;
  final String busId;
  final String routeId;
  final String driverId;
  final String direction;
  final VoidCallback onBack;
  final VoidCallback onChangeRoute;

  const _DriverContent({
    required this.collegeId,
    required this.busId,
    required this.routeId,
    required this.driverId,
    required this.direction,
    required this.onBack,
    required this.onChangeRoute,
  });

  @override
  ConsumerState<_DriverContent> createState() => _DriverContentState();
}

class _DriverContentState extends ConsumerState<_DriverContent> {
  StreamSubscription<Map<String, dynamic>?>? _locationUpdateSubscription;
  Timer? _pathHistoryTimer;
  bool _isLoading = false;
  double _currentSpeed = 0.0;
  String _statusText = "READY";
  String _currentRoad = "Identifying...";
  List<LocationPoint> _liveTrackBuffer = [];
  BusRoute? _currentRoute; 
  LocationPoint? _lastRecordedPoint;
  String _lastUpdate = "--:--:--";
  RelayService? _relay;
  
  @override
  void initState() {
    super.initState();
    _fetchRoute();
  }

  Future<void> _fetchRoute() async {
    final route = await ref.read(firestoreDataSourceProvider).getRoute(widget.routeId);
    if (mounted) {
      setState(() => _currentRoute = route);
    }
  }
  
  @override
  void dispose() {
    _relay?.dispose();
    _locationUpdateSubscription?.cancel();
    _pathHistoryTimer?.cancel();
    super.dispose();
  }

  Future<void> _updateRoadName(double lat, double lng) async {
    try {
      List<geo.Placemark> placemarks = await geo.placemarkFromCoordinates(lat, lng);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        final road = p.street ?? p.name ?? "Unknown Road";
        if (mounted && _currentRoad != road) {
          setState(() => _currentRoad = road);
          try {
             ref.read(firestoreDataSourceProvider).updateBusRoadName(widget.busId, road);
          } catch(e) {}
        }
      }
    } catch (e) {
      // Quiet fail
    }
  }

  Future<void> _startTracking() async {
    // Ensure permission before starting background service
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(
           const SnackBar(content: Text("Location permission is required to track trips")),
         );
      }
      return;
    }

    try {
      if (await Permission.ignoreBatteryOptimizations.isDenied) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    } catch (_) {}

    // 4. Initialize Relay
    try {
      final tokenData = await ApiDataSource(Dio(), FirebaseFirestore.instance).getRelayToken(widget.busId, 'driver');
      final wsUrl = tokenData['wsUrl'];
      
      _relay?.dispose();
      _relay = RelayService();
      _relay!.connect(wsUrl);
      debugPrint("Connected to Relay: $wsUrl");
    } catch (e) {
      debugPrint("Failed to connect to relay: $e");
    }

    // Initialize DriverLocationService with background_location_tracker
    await DriverLocationService.startTracking(
      widget.collegeId, 
      widget.busId, 
      (locationDto) {
        if (mounted) {
          final point = LocationPoint(
             latitude: locationDto.lat,
             longitude: locationDto.lon,
             timestamp: DateTime.now(),
             speed: locationDto.speed,
             heading: locationDto.course,
          );
          setState(() {
            double rawSpeed = point.speed ?? 0.0;
            if (rawSpeed < 0 || !rawSpeed.isFinite) rawSpeed = 0.0;
            _currentSpeed = rawSpeed * 2.23694; // mph
            _lastUpdate = TimeOfDay.now().format(context);
            _lastRecordedPoint = point;
          });
          _updateRoadName(point.latitude, point.longitude);
          
          // Stream to Relay (Cloudflare)
          if (_relay != null && _relay!.isConnected) {
            _relay!.sendLocation(
              tripId: 'active', // The relay uses busId from the token path, tripId is advisory
              lat: point.latitude,
              lng: point.longitude,
              speedMps: point.speed ?? 0.0,
              heading: point.heading ?? 0.0,
            );
          }
        }
      }
    );
  }

  void _stopTracking() {
    _relay?.disconnect();
    _relay = null;

    DriverLocationService.stopTracking();
    
    _locationUpdateSubscription?.cancel();
    _locationUpdateSubscription = null;
    if (mounted) {
      setState(() {
        _currentSpeed = 0.0;
        _currentRoad = "Ready";
        _lastRecordedPoint = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final busStream = ref.watch(firestoreDataSourceProvider).getBus(widget.collegeId, widget.busId);
    
    return StreamBuilder<Bus>(
      stream: busStream,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        final bus = snapshot.data!;
        final isTripActive = bus.status == 'ON_ROUTE' || 
                             bus.activeTripId != null;

        final routeName = _currentRoute?.routeName ?? "Loading Route...";

        // Auto-resume logic
        if (isTripActive && _locationUpdateSubscription == null && !_isLoading) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _startTracking());
        }

        // Auto-stop logic if ended externally
        if (!isTripActive && _locationUpdateSubscription != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_locationUpdateSubscription != null) {
               debugPrint("Ending trip externally initiated (Admin/System)");
               _stopTracking();
               if (mounted) {
                 ScaffoldMessenger.of(context).showSnackBar(
                   const SnackBar(
                     content: Text("Trip ended by administrator."),
                     backgroundColor: Colors.orange,
                   ),
                 );
                 widget.onBack();
               }
            }
          });
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            children: [
              Row(
                children: [
                   IconButton(
                    onPressed: widget.onBack,
                    icon: Icon(Icons.arrow_back, color: AppColors.textPrimary),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "Trip Dashboard",
                    style: AppTypography.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              DriverStatusCard(
                speed: _currentSpeed.roundToDouble(),
                isTracking: isTripActive,
                statusText: isTripActive ? "ON TRIP" : "READY",
                currentRoad: _currentRoad,
                lastUpdateTime: _lastUpdate,
              ),
              const SizedBox(height: 24),
              AssignedBusCard(
                busNumber: bus.busNumber,
                licensePlate: bus.plateNumber,
                routeName: routeName,
              ),
              if (!isTripActive) ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: widget.onChangeRoute,
                  icon: const Icon(Icons.edit, size: 16),
                  label: const Text("Change Route"),
                ),
              ],
              const SizedBox(height: 32),
              if (isTripActive && bus.currentDriverId != null && bus.currentDriverId != widget.driverId)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock, color: AppColors.error),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "Trip started by another driver. You cannot end this trip.",
                          style: AppTypography.textTheme.bodyMedium?.copyWith(
                            color: AppColors.error,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                TripControlPanel(
                isTripActive: isTripActive,
                isLoading: _isLoading,
                onStartTrip: () async {
                  setState(() => _isLoading = true);
                  try {
                    final profile = ref.read(userProfileProvider).asData?.value;
                    await ref.read(firestoreDataSourceProvider).startTrip(
                      collegeId: widget.collegeId,
                      busId: widget.busId,
                      driverId: widget.driverId,
                      routeId: widget.routeId,
                      busNumber: bus.busNumber,
                      driverName: profile?.name,
                      direction: widget.direction,
                    );
                    _startTracking();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Trip started successfully!")),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("Error starting trip: $e")),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
                onEndTrip: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text("End Trip?"),
                      content: const Text("Are you sure you want to end this trip and stop tracking?"),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("CANCEL")),
                        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("END TRIP")),
                      ],
                    ),
                  );

                  if (confirmed != true) return;

                  setState(() => _isLoading = true);
                  try {
                    final String? activeTripId = bus.activeTripId;
                    // Always call endTrip to ensure the bus is reset in Firestore
                    await ref.read(firestoreDataSourceProvider).endTrip(activeTripId, widget.busId);
                    _stopTracking();

                    if (activeTripId != null && activeTripId.isNotEmpty) {
                      await DriverLocationService.uploadBufferedHistory(activeTripId);
                    }

                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Trip ended successfully!")),
                      );
                      widget.onBack();
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("Error ending trip: $e")),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
              ),
              const SizedBox(height: 40),
              Text(
                "Keep this screen open while driving to ensure location updates are sent.",
                textAlign: TextAlign.center,
                style: AppTypography.textTheme.labelSmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

