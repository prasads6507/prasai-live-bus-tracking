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
              const Icon(Icons.account_balance_rounded, size: 64, color: AppColors.textTertiary),
              const SizedBox(height: 16),
              Text("No Institution Selected", style: AppTypography.h2),
              const SizedBox(height: 8),
              Text(
                "Go back and select your college to continue.",
                style: AppTypography.bodyMd,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => context.go('/college-selection'),
                child: const Text("Select Institution"),
              ),
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
              color: AppColors.primary,
              backgroundColor: AppColors.bgCard,
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
                            return _EmptyBusesState();
                          }
                          
                          final profile = profileAsync.value;
                          final favoriteBuses = buses.where((b) => profile?.favoriteBusIds.contains(b.id) ?? false).toList();
                          
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // 1. Mini Map
                              Container(
                                height: 220,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: AppColors.borderSubtle),
                                  boxShadow: [AppShadows.cardShadow],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(20),
                                  child: Stack(
                                    children: [
                                      MobileMapLibre(
                                        collegeId: collegeId,
                                        followBus: false,
                                        focusedLocation: _studentLocation,
                                        showStudentLocation: true,
                                        studentLocation: _studentLocation,
                                      ),
                                      // Gradient overlay
                                      Positioned(
                                        bottom: 0, left: 0, right: 0,
                                        child: Container(
                                          height: 60,
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              begin: Alignment.bottomCenter,
                                              end: Alignment.topCenter,
                                              colors: [
                                                AppColors.bgDeep.withOpacity(0.7),
                                                Colors.transparent,
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      // "Your location" label
                                      Positioned(
                                        bottom: 12, left: 12,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: AppColors.bgCard.withOpacity(0.9),
                                            borderRadius: BorderRadius.circular(20),
                                            border: Border.all(color: AppColors.borderSubtle),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.my_location, size: 12, color: AppColors.primary),
                                              const SizedBox(width: 4),
                                              Text("Your location", style: AppTypography.caption),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),

                              // 2. Search Card
                              SearchBusCard(
                                onTap: () => context.push('/student/buses'),
                              ),
                              const SizedBox(height: 24),

                              // 3. Favorites
                              Text(
                                "MY FAVORITES",
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.textTertiary,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(height: 12),
                              
                              if (favoriteBuses.isEmpty)
                                _NoFavoritesState(onFind: () => context.go('/student/buses'))
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
                                }),
                            ],
                          );
                        },
                        loading: () => const Padding(
                          padding: EdgeInsets.all(40),
                          child: Center(
                            child: CircularProgressIndicator(color: AppColors.primary),
                          ),
                        ),
                        error: (err, _) => _ErrorState(message: "$err"),
                      ),
                      
                      const SizedBox(height: 100), // Bottom padding for nav bar
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

class _EmptyBusesState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          Icon(Icons.directions_bus_outlined, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text("No Buses Found", style: AppTypography.h3),
          const SizedBox(height: 8),
          Text(
            "No buses are registered yet for your college.",
            style: AppTypography.bodyMd,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _NoFavoritesState extends StatelessWidget {
  final VoidCallback onFind;
  const _NoFavoritesState({required this.onFind});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.directions_bus_outlined, size: 40, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text("Add Your Bus", style: AppTypography.h3),
          const SizedBox(height: 8),
          Text(
            "Search for your college bus and tap ♥ to add it to favorites for quick live tracking here.",
            style: AppTypography.bodyMd,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onFind,
            icon: const Icon(Icons.search_rounded, size: 18),
            label: const Text("Find My Bus"),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  const _ErrorState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text("Something went wrong", style: AppTypography.h3),
          const SizedBox(height: 8),
          Text(message, style: AppTypography.bodyMd, textAlign: TextAlign.center),
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
