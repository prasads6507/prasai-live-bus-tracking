import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/colors.dart';
import '../../../../core/theme/typography.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/status_chip.dart';
import '../../../../data/providers.dart';
import '../widgets/bus_search_result_tile.dart';

class StudentSearchScreen extends ConsumerStatefulWidget {
  const StudentSearchScreen({super.key});

  @override
  ConsumerState<StudentSearchScreen> createState() => _StudentSearchScreenState();
}

class _StudentSearchScreenState extends ConsumerState<StudentSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = "";

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final busesAsync = ref.watch(busesProvider(collegeId ?? ""));

    return AppScaffold(
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Search Bar
            TextField(
              controller: _searchController,
              style: AppTypography.textTheme.bodyMedium,
              decoration: InputDecoration(
                hintText: 'Search by bus no, plate...',
                hintStyle: AppTypography.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              ),
            ),
            const SizedBox(height: 24),
            
            // Recent / Results
            Expanded(
              child: busesAsync.when(
                data: (buses) {
                  final filtered = buses.where((bus) {
                    final query = _searchQuery;
                    return bus.busNumber.toLowerCase().contains(query) ||
                           bus.plateNumber.toLowerCase().contains(query);
                  }).toList();

                  if (filtered.isEmpty) {
                    return Center(
                      child: Text(
                        _searchQuery.isEmpty ? "No buses available" : "No buses found",
                        style: AppTypography.textTheme.bodyMedium,
                      ),
                    );
                  }

                  return ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final bus = filtered[index];
                      // Map backend status to UI status
                      BusStatus status = BusStatus.offline;
                      if (bus.status == 'ON_ROUTE') status = BusStatus.live;
                      if (bus.status == 'ACTIVE') status = BusStatus.active;
                      
                      final profile = ref.watch(userProfileProvider).value;
                      final isFav = profile?.favoriteBusIds.contains(bus.id) ?? false;

                      return BusSearchResultTile(
                        busNumber: bus.busNumber,
                        routeName: bus.assignedRouteId != null ? 'Route ${bus.busNumber}' : "No Route", 
                        plateNumber: bus.plateNumber,
                        status: status,
                        busId: bus.id,
                        initialIsFavorite: isFav,
                        onTap: () => context.push('/student/track', extra: bus.id),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, stack) => Center(child: Text('Error: $err')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
