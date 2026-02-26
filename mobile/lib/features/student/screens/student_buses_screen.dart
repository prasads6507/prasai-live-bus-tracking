import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../core/widgets/pulsing_dot.dart';
import '../../../data/providers.dart';
import '../../../data/models/bus.dart';

class StudentBusesScreen extends ConsumerStatefulWidget {
  const StudentBusesScreen({super.key});

  @override
  ConsumerState<StudentBusesScreen> createState() => _StudentBusesScreenState();
}

class _StudentBusesScreenState extends ConsumerState<StudentBusesScreen> {
  String _searchQuery = "";
  String _filter = "All";

  Future<void> _showCallDialog(BuildContext context, Bus bus) async {
    final phone = bus.driverPhone ?? "Not provided";
    
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("Call Driver", style: AppTypography.h2),
        content: Text(
          "Call ${bus.driverName ?? 'the driver'}?\n\nPhone: $phone",
          style: AppTypography.bodyMd,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text("Cancel", style: TextStyle(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text("Call", style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );

    if (result == true && phone != "Not provided") {
      final uri = Uri.parse("tel:$phone");
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      }
    }
  }

  void _showDetailsSheet(BuildContext context, Bus bus) {
    final isTripActive = bus.status == 'ON_ROUTE' || bus.status == 'ACTIVE';
    final locationText = isTripActive 
        ? (bus.currentRoadName ?? "Street/Road name unavailable")
        : "Driver location not found";

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.borderMid,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text("Driver Details", style: AppTypography.h2),
              const SizedBox(height: 24),
              _buildDetailRow(Icons.person_rounded, "Driver Name", bus.driverName ?? "Unassigned"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.phone_rounded, "Phone", bus.driverPhone ?? "Not Available"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.email_rounded, "Email", bus.driverEmail ?? "Not Available"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.location_on_rounded, "Current Location", locationText),
              const SizedBox(height: 32),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primary, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTypography.caption),
              Text(value, style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }

  bool _matchesFilter(Bus bus) {
    switch (_filter) {
      case 'Live':
        return bus.status == 'ON_ROUTE';
      case 'Active':
        return bus.status == 'ACTIVE';
      case 'Offline':
        return bus.status == 'OFFLINE' || bus.status == 'IDLE';
      default:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final profileAsync = ref.watch(userProfileProvider);
    
    if (collegeId == null || collegeId.isEmpty) {
      return AppScaffold(
        body: Center(child: Text("No college selected", style: AppTypography.bodyMd)),
      );
    }
    
    final busesAsync = ref.watch(busesProvider(collegeId));

    return AppScaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Text('All Buses', style: AppTypography.h1),
            ),
            const SizedBox(height: 16),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.bgCard,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: TextField(
                  style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Bus no, plate, driver...',
                    prefixIcon: const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 12, 0),
                      child: Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 20),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onChanged: (value) => setState(() => _searchQuery = value.toLowerCase()),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: ['All', 'Live', 'Active', 'Offline'].map((label) {
                  final isSelected = _filter == label;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _filter = label),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : AppColors.bgCard,
                          borderRadius: BorderRadius.circular(100),
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.borderSubtle,
                          ),
                          boxShadow: isSelected ? [AppShadows.primaryGlow] : [],
                        ),
                        child: Text(
                          label,
                          style: AppTypography.label.copyWith(
                            color: isSelected ? AppColors.textInverse : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),
            
            Expanded(
              child: busesAsync.when(
                data: (buses) {
                  if (buses.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.directions_bus_outlined, size: 48, color: AppColors.textTertiary),
                          const SizedBox(height: 12),
                          Text("No buses available", style: AppTypography.bodyMd),
                        ],
                      ),
                    );
                  }

                  final filteredBuses = buses.where((b) {
                    final matchesSearch = b.busNumber.toLowerCase().contains(_searchQuery) || 
                           (b.driverName ?? "").toLowerCase().contains(_searchQuery) ||
                           b.plateNumber.toLowerCase().contains(_searchQuery);
                    return matchesSearch && _matchesFilter(b);
                  }).toList();

                  if (filteredBuses.isEmpty) {
                    return Center(child: Text("No matching buses found", style: AppTypography.bodyMd));
                  }

                  final profile = profileAsync.value;

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                    itemCount: filteredBuses.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final bus = filteredBuses[index];
                      final isFavorite = profile?.favoriteBusIds.contains(bus.id) ?? false;
                      final isLive = bus.status == 'ON_ROUTE';

                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isLive ? AppColors.live.withOpacity(0.3) : AppColors.borderSubtle,
                          ),
                          boxShadow: isLive ? [AppShadows.liveGlow] : [],
                        ),
                        child: Column(
                          children: [
                            // Header
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 44, height: 44,
                                      decoration: BoxDecoration(
                                        color: isLive ? AppColors.live.withOpacity(0.15) : AppColors.primarySoft,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.directions_bus_rounded,
                                        color: isLive ? AppColors.live : AppColors.primary,
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text("Bus ${bus.busNumber}", style: AppTypography.h3),
                                        Text(
                                          bus.plateNumber,
                                          style: AppTypography.mono.copyWith(fontSize: 12, color: AppColors.textSecondary),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    StatusChip(statusString: bus.status),
                                    const SizedBox(width: 8),
                                    // Heart favorite
                                    GestureDetector(
                                      onTap: () async {
                                        if (profile != null) {
                                          final currentFavorites = profile.favoriteBusIds;
                                          final isCurrentlyFav = currentFavorites.contains(bus.id);
                                          
                                          if (!isCurrentlyFav && currentFavorites.isNotEmpty) {
                                            final confirmed = await showDialog<bool>(
                                              context: context,
                                              builder: (ctx) => AlertDialog(
                                                backgroundColor: AppColors.bgSurface,
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                                title: Text("Switch Favorite?", style: AppTypography.h2),
                                                content: Text(
                                                  "You can only favorite one bus. Replace with Bus ${bus.busNumber}?",
                                                  style: AppTypography.bodyMd,
                                                ),
                                                actions: [
                                                  TextButton(
                                                    onPressed: () => Navigator.of(ctx).pop(false),
                                                    child: Text("Cancel", style: TextStyle(color: AppColors.textSecondary)),
                                                  ),
                                                  TextButton(
                                                    onPressed: () => Navigator.of(ctx).pop(true),
                                                    child: Text("Switch", style: TextStyle(color: AppColors.primary)),
                                                  ),
                                                ],
                                              ),
                                            );
                                            if (confirmed != true) return;
                                          }
                                          
                                          await ref.read(firestoreDataSourceProvider).toggleFavoriteBus(
                                            profile.id, bus.id, !isCurrentlyFav,
                                          );
                                        }
                                      },
                                      child: AnimatedSwitcher(
                                        duration: const Duration(milliseconds: 300),
                                        transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
                                        child: Icon(
                                          isFavorite ? Icons.favorite_rounded : Icons.favorite_outline_rounded,
                                          key: ValueKey(isFavorite),
                                          color: isFavorite ? AppColors.error : AppColors.textTertiary,
                                          size: 24,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // Driver Row
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: AppColors.bgSurface,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: AppColors.primarySoft,
                                    child: const Icon(Icons.person_rounded, size: 14, color: AppColors.primary),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      bus.driverName ?? "Unassigned",
                                      style: AppTypography.bodyMd.copyWith(color: AppColors.textPrimary),
                                    ),
                                  ),
                                  if (bus.driverPhone != null)
                                    GestureDetector(
                                      onTap: () => _showCallDialog(context, bus),
                                      child: Container(
                                        width: 32, height: 32,
                                        decoration: BoxDecoration(
                                          color: AppColors.primarySoft,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.phone_rounded, color: AppColors.primary, size: 14),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            // Action Buttons
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _showDetailsSheet(context, bus),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppColors.textPrimary,
                                      side: const BorderSide(color: AppColors.borderMid),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                    child: Text("Details", style: AppTypography.label.copyWith(color: AppColors.textPrimary)),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () => context.push('/student/track', extra: bus.id),
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                    child: Text("Track Live", style: AppTypography.label.copyWith(color: AppColors.textInverse)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                error: (err, stack) => Center(child: Text("Error: $err", style: AppTypography.bodyMd)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
