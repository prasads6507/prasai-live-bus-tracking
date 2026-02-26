import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../data/models/bus.dart';
import '../../../data/models/route.dart';
import '../../../data/models/trip.dart';
import '../../../data/models/location_point.dart';
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
  LocationPoint? _studentLocation;

  @override
  void initState() {
    super.initState();
    _getStudentLocation();
  }

  Future<void> _getStudentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        if (mounted) {
          setState(() {
            _studentLocation = LocationPoint(
              latitude: pos.latitude,
              longitude: pos.longitude,
              timestamp: DateTime.now(),
            );
          });
        }
      }
    } catch (e) {
      debugPrint('Error getting student location: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider);
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final selectedCollege = ref.watch(selectedCollegeProvider);
    final collegeName = selectedCollege?['collegeName'] ?? collegeId?.toUpperCase() ?? "";
    
    // Guard: don't query with empty collegeId
    if (collegeId == null || collegeId.isEmpty) {
      return AppScaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.school_outlined, size: 64, color: AppColors.textTertiary),
              const SizedBox(height: 16),
              Text("No college selected", style: AppTypography.textTheme.titleMedium),
            ],
          ),
        ),
      );
    }
    
    final busesAsync = ref.watch(busesProvider(collegeId));
    
    return AppScaffold(
      body: Column(
        children: [
          // Header
          profileAsync.when(
            data: (profile) => StudentHomeHeader(
              studentName: profile?.name ?? "Student",
              collegeName: collegeName,
            ),
            loading: () => StudentHomeHeader(studentName: "Loading...", collegeName: collegeName),
            error: (_, __) => StudentHomeHeader(studentName: "Student", collegeName: collegeName),
          ),
          
          // Main Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(busesProvider(collegeId));
                ref.invalidate(userProfileProvider);
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
                              // 1. Mini Map showing student's live location
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
                                    collegeId: collegeId,
                                    followBus: false,
                                    focusedLocation: _studentLocation,
                                    showStudentLocation: true,
                                    studentLocation: _studentLocation,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),

                              // 2. Search Card → navigates to buses screen
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
