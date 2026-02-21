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
import '../../map/widgets/mobile_maplibre.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../core/theme/colors.dart';

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
                          final favoriteBuses = buses.where((b) => profile?.favoriteBusIds.contains(b.id) ?? false).toList();
                          
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // 1. Mini Map showing all live buses
                              Container(
                                height: 220,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(color: AppColors.divider),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.1),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(24),
                                  child: MobileMapLibre(
                                    collegeId: collegeId ?? "",
                                    followBus: false, // Just a static overview
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),

                              // 2. Search Card
                              SearchBusCard(
                                onTap: () => context.push('/student/buses'),
                              ),
                              const SizedBox(height: 24),

                              // 3. Favorites / Warning Area
                              Text(
                                "My Favorites",
                                style: AppTypography.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 16),
                              
                              if (favoriteBuses.isEmpty)
                                Container(
                                  padding: const EdgeInsets.all(20),
                                  decoration: BoxDecoration(
                                    color: AppColors.warning.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: AppColors.warning.withOpacity(0.3)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.info_outline, color: AppColors.warning, size: 32),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Text(
                                          "You haven't favored any buses yet! Search and add a bus to your favorites to track its live route here.",
                                          style: AppTypography.textTheme.bodyMedium?.copyWith(
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else
                                ...favoriteBuses.map((bus) {
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 16.0),
                                    child: LiveTrackerCard(
                                      busNumber: bus.busNumber,
                                      currentStatus: bus.currentRoadName ?? bus.status,
                                      licensePlate: bus.plateNumber,
                                      isLive: bus.status == 'ON_ROUTE' || bus.status == 'ACTIVE',
                                      onTap: () {
                                        context.push('/student/track', extra: bus.id);
                                      },
                                    ),
                                  );
                                }).toList(),
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
