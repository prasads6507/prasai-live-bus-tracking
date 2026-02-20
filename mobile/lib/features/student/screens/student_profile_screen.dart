import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../../data/providers.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class StudentProfileScreen extends ConsumerWidget {
  const StudentProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return AppScaffold(
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              const SizedBox(height: 40),
              // Header
              Center(
                child: profileAsync.when(
                  data: (profile) => Column(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.primary, width: 2),
                          boxShadow: [
                            BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 20, spreadRadius: 5),
                          ]
                        ),
                        child: const Icon(Icons.person, size: 50, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 16),
                       Text(
                        profile?.name ?? "Student",
                        style: AppTypography.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        profile?.role.toUpperCase() ?? "STUDENT",
                        style: AppTypography.textTheme.labelMedium?.copyWith(
                          color: AppColors.primary, 
                          letterSpacing: 2.0
                        ),
                      ),
                    ],
                  ),
                  loading: () => const CircularProgressIndicator(),
                  error: (e, _) => const Text("Error loading profile"),
                ),
              ),
              
              const SizedBox(height: 40),
              
              // Options
              _buildProfileOption(
                icon: Icons.directions_bus,
                title: "My Bus",
                subtitle: "View assigned transport",
                onTap: () {}, // TODO
              ),
              _buildProfileOption(
                icon: Icons.notifications_outlined,
                title: "Notifications",
                subtitle: "Manage alerts",
                onTap: () {}, 
              ),
               _buildProfileOption(
                icon: Icons.help_outline,
                title: "Help & Support",
                subtitle: "Contact queries",
                onTap: () {}, 
              ),
              
              const SizedBox(height: 20),
              
              _buildProfileOption(
                icon: Icons.logout,
                title: "Logout",
                subtitle: "Sign out of account",
                isDestructive: true,
                onTap: () {
                   ref.read(authControllerProvider.notifier).signOut();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated.withOpacity(0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider.withOpacity(0.5)),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isDestructive ? AppColors.error.withOpacity(0.1) : AppColors.primary.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon, 
            color: isDestructive ? AppColors.error : AppColors.primary
          ),
        ),
        title: Text(title, style: AppTypography.textTheme.titleMedium),
        subtitle: Text(subtitle, style: AppTypography.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
      ),
    );
  }
}
