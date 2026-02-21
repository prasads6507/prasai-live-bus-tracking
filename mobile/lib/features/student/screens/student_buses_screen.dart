import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../data/providers.dart';
import '../../../../data/models/bus.dart';

class StudentBusesScreen extends ConsumerStatefulWidget {
  const StudentBusesScreen({super.key});

  @override
  ConsumerState<StudentBusesScreen> createState() => _StudentBusesScreenState();
}

class _StudentBusesScreenState extends ConsumerState<StudentBusesScreen> {
  String _searchQuery = "";

  Future<void> _showCallDialog(BuildContext context, Bus bus) async {
    final phone = bus.driverPhone ?? "Not provided";
    
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Call Driver"),
        content: Text("Do you want to go to the phone app to make a call to ${bus.driverName ?? 'the driver'}?\n\nPhone: $phone"),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("No"),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("Yes"),
          ),
        ],
      ),
    );

    if (result == true) {
      if (phone != "Not provided") {
        final uri = Uri.parse("tel:$phone");
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Cannot launch phone app.")));
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("No valid phone number for this driver.")));
        }
      }
    }
  }

  void _showDetailsSheet(BuildContext context, Bus bus) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final isTripActive = bus.status == 'ON_ROUTE' || bus.status == 'ACTIVE';
        final locationText = isTripActive 
            ? (bus.currentRoadName ?? "Street/Road name unavailable")
            : "Driver location not Found";

        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.divider,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text("Driver Details", style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 24),
              _buildDetailRow(Icons.person, "Driver Name", bus.driverName ?? "Driver ${bus.driverId ?? 'Unassigned'}"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.phone, "Phone", bus.driverPhone ?? "Not Available"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.email, "Email", bus.driverEmail ?? "Not Available"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.location_on, "Current Location", locationText),
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
        Icon(icon, color: AppColors.primary, size: 24),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              Text(value, style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final profileAsync = ref.watch(userProfileProvider);
    final busesAsync = ref.watch(busesProvider(collegeId ?? ""));

    return AppScaffold(
      appBar: AppBar(
        title: const Text('All Buses'),
        centerTitle: false,
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by bus or driver name...',
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: AppColors.divider),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: AppColors.divider),
                ),
              ),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value.toLowerCase();
                });
              },
            ),
          ),
          
          Expanded(
            child: busesAsync.when(
              data: (buses) {
                if (buses.isEmpty) {
                  return const Center(child: Text("No buses available."));
                }

                // Filter buses based on search query
                final filteredBuses = buses.where((b) {
                  final busNum = b.busNumber.toLowerCase();
                  final dName = (b.driverName ?? "").toLowerCase();
                  return busNum.contains(_searchQuery) || dName.contains(_searchQuery);
                }).toList();

                if (filteredBuses.isEmpty) {
                  return const Center(child: Text("No matching buses found."));
                }

                final profile = profileAsync.value;

                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: filteredBuses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 16),
                  itemBuilder: (context, index) {
                    final bus = filteredBuses[index];
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
                                  GestureDetector(
                                    onTap: () => _showCallDialog(context, bus),
                                    child: Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: const BoxDecoration(
                                        color: AppColors.white,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.phone, color: AppColors.primary, size: 16),
                                    ),
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
                                    onPressed: () => _showDetailsSheet(context, bus),
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
          ),
        ],
      ),
    );
  }
}
