import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../data/providers.dart';
import '../../auth/controllers/auth_controller.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return AppScaffold(
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Admin Panel',
                      style: AppTypography.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    profileAsync.when(
                      data: (profile) => Text(
                        profile?.name ?? "Admin",
                        style: AppTypography.textTheme.titleLarge,
                      ),
                      loading: () => const Text("Loading...", style: TextStyle(fontSize: 20)),
                      error: (_, __) => const Text("Error", style: TextStyle(fontSize: 20)),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.logout, color: AppColors.error),
                  onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
                ),
              ],
            ),
            const SizedBox(height: 40),
            const Center(
              child: Column(
                children: [
                   Icon(Icons.admin_panel_settings, size: 100, color: AppColors.primary),
                   SizedBox(height: 16),
                   Text(
                     "Organization Dashboard",
                     style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                   ),
                   SizedBox(height: 8),
                   Text(
                     "Full management features coming soon in the web portal.",
                     textAlign: TextAlign.center,
                     style: TextStyle(color: AppColors.textSecondary),
                   ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
