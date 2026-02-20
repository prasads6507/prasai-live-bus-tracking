import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../data/models/bus.dart';
import '../../../data/models/bus.dart';
import '../../../data/models/route.dart';
import '../../../data/models/trip.dart';
import '../../../data/providers.dart';
import '../widgets/student_home_header.dart';
import '../widgets/live_tracker_card.dart';
import '../widgets/search_bus_card.dart';
import '../widgets/drop_off_list.dart';
import '../widgets/bus_search_result_tile.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/status_chip.dart';

class StudentHomeScreen extends ConsumerStatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  ConsumerState<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends ConsumerState<StudentHomeScreen> {
  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final busesAsync = ref.watch(busesProvider(collegeId ?? ""));
    
    return AppScaffold(
      body: Column(
        children: [
          // Header
          profileAsync.when(
            data: (profile) => StudentHomeHeader(
              studentName: profile?.name ?? "Student",
              collegeName: collegeId?.toUpperCase() ?? "",
            ),
            loading: () => const StudentHomeHeader(studentName: "Loading...", collegeName: "..."),
            error: (_, __) => const StudentHomeHeader(studentName: "Student", collegeName: "Error"),
          ),
          
          // Main Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.refresh(busesProvider(collegeId ?? ""));
                ref.refresh(userProfileProvider);
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  child: Column(
                    children: [
                      // Live Tracker
                      busesAsync.when(
                        data: (buses) {
                          if (buses.isEmpty) {
                            return const Center(child: Text("No buses available"));
                          }
                          
                          final profile = profileAsync.value;
                          Bus? myBus;
                          
                          if (profile?.assignedBusId != null) {
                             myBus = buses.firstWhere(
                               (b) => b.id == profile!.assignedBusId, 
                               orElse: () => buses.first
                             );
                          } else {
                             myBus = buses.first;
                          }
                          
                          // Filter Favorites
                          final favoriteBuses = buses.where((b) => profile?.favoriteBusIds.contains(b.id) ?? false).toList();
                          
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              LiveTrackerCard(
                                busNumber: myBus.busNumber,
                                currentStatus: myBus.status,
                                licensePlate: myBus.plateNumber,
                                isLive: myBus.status == 'ON_ROUTE' || myBus.status == 'ACTIVE',
                                onTap: () {
                                  context.push('/student/track', extra: myBus?.id);
                                },
                              ),
                              const SizedBox(height: 24),

                              // Restore Search Card
                              SearchBusCard(
                                onTap: () => context.push('/student/search'),
                              ),
                              const SizedBox(height: 24),

                              // Favorites Section
                              if (favoriteBuses.isNotEmpty) ...[
                                Text(
                                  "My Favorites",
                                  style: AppTypography.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                ...favoriteBuses.map((bus) {
                                  return LiveTrackerCard(
                                    busNumber: bus.busNumber,
                                    currentStatus: bus.status,
                                    licensePlate: bus.plateNumber,
                                    isLive: bus.status == 'ON_ROUTE' || bus.status == 'ACTIVE',
                                    onTap: () {
                                      context.push('/student/track', extra: bus.id);
                                    },
                                  );
                                }).toList(),
                                const SizedBox(height: 24),
                              ],
                              
                              // Drop Off List with Real Data
                              if (myBus != null && myBus.activeTripId != null)
                                _RealBody(
                                  busId: myBus.id, 
                                  tripId: myBus.activeTripId!,
                                  collegeId: collegeId ?? "",
                                )
                              else 
                                const SizedBox.shrink(), // Removed label
                            ],
                          );
                        },
                        loading: () => const Center(child: CircularProgressIndicator()),
                        error: (err, _) => Center(child: Text("Error: $err")),
                      ),
                      
                      const SizedBox(height: 100), // Bottom padding
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RealBody extends ConsumerStatefulWidget {
  final String busId;
  final String tripId;
  final String collegeId;

  const _RealBody({required this.busId, required this.tripId, required this.collegeId});

  @override
  ConsumerState<_RealBody> createState() => _RealBodyState();
}

class _RealBodyState extends ConsumerState<_RealBody> {
  BusRoute? _route;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchRoute();
  }
  
  @override
  void didUpdateWidget(covariant _RealBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tripId != widget.tripId) {
      _fetchRoute();
    }
  }

  Future<void> _fetchRoute() async {
    try {
      // 1. Get Trip to get Route ID
      // We assume the trip object isn't fully available in the bus list, 
      // or we just fetch it to be safe/live. 
      // Actually, we can't easily get the trip doc without streaming it.
      // But let's assume we can get the routeId from somewhere.
      
      // Wait, Bus model doesn't have routeId. Trip has it.
      // So let's listen to the trip or fetch it once.
      // For simplicity in this "fix", let's listen to the trip.
      
    } catch (e) {
      print("Error fetching route info: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(activeTripProvider(ActiveTripParams(widget.collegeId, widget.busId)));
    
    return tripAsync.when(
      data: (trip) {
        if (trip == null) return const SizedBox.shrink(); // Removed "Trip ended" label
        
        // Now fetch route
        // We can't use ref.watch easily for a Future provider unless we define it.
        // Let's use a FutureBuilder for the route.
        return FutureBuilder<BusRoute?>(
          future: ref.read(firestoreDataSourceProvider).getRoute(trip.routeId),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (!snapshot.hasData || snapshot.data == null) {
              return const SizedBox.shrink(); // Removed "Route info not found" label
            }

            final route = snapshot.data!;
            // Convert to UI model
            // We need 'stopName', 'time', 'isCompleted'
            // We don't have 'completedStops' in Trip model yet? 
            // Trip has 'status'. Bus might have 'completedStops' list?
            // Checking student_dashboard.tsx: trackedBus.completedStops
            
            // For now, assume none completed or simpler logic
            final items = route.stops.map((s) => DropOffItem(
              time: "Pending", // We need ETA logic for real time
              location: s.stopName,
              isCompleted: false, // TODO: Check completedStops
              isNext: false,
            )).toList();

            return DropOffList(items: items);
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => const SizedBox.shrink(), // Keep it clean on error
    );
  }
}

// Helper for provider family
final activeTripProvider = StreamProvider.family<Trip?, ActiveTripParams>((ref, params) {
  return ref.read(firestoreDataSourceProvider).getActiveTrip(params.collegeId, params.busId);
});

class ActiveTripParams {
  final String collegeId;
  final String busId;
  ActiveTripParams(this.collegeId, this.busId);

  @override
  bool operator ==(Object other) => other is ActiveTripParams && other.collegeId == collegeId && other.busId == busId;
  
  @override
  int get hashCode => Object.hash(collegeId, busId);
}
