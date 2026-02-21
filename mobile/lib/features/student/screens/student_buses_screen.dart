import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../data/providers.dart';
import '../../../../data/models/bus.dart';

class StudentBusesScreen extends ConsumerWidget {
  const StudentBusesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final profileAsync = ref.watch(userProfileProvider);
    final busesAsync = ref.watch(busesProvider(collegeId ?? ""));

    return AppScaffold(
      appBar: AppBar(
        title: const Text('All Buses'),
        centerTitle: false,
      ),
      body: busesAsync.when(
        data: (buses) {
          if (buses.isEmpty) {
            return const Center(child: Text("No buses available."));
          }
          final profile = profileAsync.value;

          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: buses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              final bus = buses[index];
              final isFavorite = profile?.favoriteBusIds.contains(bus.id) ?? false;

              return Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.divider),
                  boxShadow: [
                     BoxShadow(
                       color: Colors.black.withOpacity(0.05), 
                       blurRadius: 10, 
                       offset: const Offset(0, 4),
                     ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.directions_bus, color: AppColors.primary, size: 28),
                              ),
                              const SizedBox(width: 16),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Bus ${bus.busNumber}",
                                    style: AppTypography.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    "Plate: ${bus.plateNumber}",
                                    style: AppTypography.textTheme.labelMedium?.copyWith(
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          IconButton(
                            icon: Icon(
                              isFavorite ? Icons.favorite : Icons.favorite_outline,
                              color: isFavorite ? AppColors.error : AppColors.textTertiary,
                              size: 28,
                            ),
                            onPressed: () {
                              if (profile != null) {
                                ref.read(firestoreDataSourceProvider).toggleFavoriteBus(profile.id, bus.id, !isFavorite);
                              }
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      
                      // Driver Details
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.person, color: AppColors.textSecondary, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Driver",
                                    style: AppTypography.textTheme.labelSmall?.copyWith(color: AppColors.textTertiary),
                                  ),
                                  Text(
                                    bus.driverName ?? "Driver ${bus.driverId ?? 'Unassigned'}",
                                    style: AppTypography.textTheme.bodyMedium?.copyWith(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Driver contact / call icon
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: AppColors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.phone, color: AppColors.primary, size: 16),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Actions
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {
                                // "View Details" could go to search for now as a fallback details screen
                                context.push('/student/search');
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.primary),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                padding: const EdgeInsets.symmetric(vertical: 16),
                              ),
                              child: const Text("View Details", style: TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                context.push('/student/track', extra: bus.id);
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                elevation: 4,
                                shadowColor: AppColors.primary.withOpacity(0.4),
                              ),
                              child: const Text("Track Live", style: TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text("Error: $err")),
      ),
    );
  }
}
