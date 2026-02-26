import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../data/providers.dart';
import '../../../data/models/user_profile.dart';

class DriverStudentsScreen extends ConsumerStatefulWidget {
  const DriverStudentsScreen({super.key});

  @override
  ConsumerState<DriverStudentsScreen> createState() => _DriverStudentsScreenState();
}

class _DriverStudentsScreenState extends ConsumerState<DriverStudentsScreen> {
  String _searchQuery = "";

  Future<void> _showCallDialog(BuildContext context, UserProfile student) async {
    final phone = student.phone ?? "Not provided";
    
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("Call Student", style: AppTypography.h2),
        content: Text(
          "Call ${student.name ?? 'the student'}?\n\nPhone: $phone",
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

  void _showDetailsSheet(BuildContext context, UserProfile student) {
    showModalBottomSheet(
      context: context,
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
              Text("Student Details", style: AppTypography.h2),
              const SizedBox(height: 24),
              _buildDetailRow(Icons.person_rounded, "Name", student.name ?? "Student"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.phone_rounded, "Phone", student.phone ?? "Not Available"),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.email_rounded, "Email", student.email),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.directions_bus_rounded, "Assigned Bus", student.assignedBusId ?? "Not Assigned"),
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

  @override
  Widget build(BuildContext context) {
    final collegeId = ref.watch(selectedCollegeIdProvider);
    final studentsAsync = ref.watch(studentsProvider(collegeId ?? ""));

    return AppScaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Text('Students', style: AppTypography.h1),
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
                    hintText: 'Search by name or email...',
                    prefixIcon: const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 12, 0),
                      child: Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 20),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onChanged: (value) => setState(() => _searchQuery = value.toLowerCase()),
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            Expanded(
              child: studentsAsync.when(
                data: (students) {
                  if (students.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.people_outline_rounded, size: 48, color: AppColors.textTertiary),
                          const SizedBox(height: 12),
                          Text("No students available", style: AppTypography.bodyMd),
                        ],
                      ),
                    );
                  }

                  final filteredStudents = students.where((s) {
                    final sName = (s.name ?? "").toLowerCase();
                    final sEmail = s.email.toLowerCase();
                    return sName.contains(_searchQuery) || sEmail.contains(_searchQuery);
                  }).toList();

                  if (filteredStudents.isEmpty) {
                    return Center(child: Text("No matching students", style: AppTypography.bodyMd));
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                    itemCount: filteredStudents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final student = filteredStudents[index];
                      final initials = student.name != null && student.name!.isNotEmpty
                          ? student.name![0].toUpperCase()
                          : 'S';

                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: AppColors.primarySoft,
                              child: Text(initials, style: AppTypography.h3.copyWith(color: AppColors.primary)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(student.name ?? "Student", style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                                  Text(student.email, style: AppTypography.caption),
                                ],
                              ),
                            ),
                            // Quick actions
                            GestureDetector(
                              onTap: () => _showDetailsSheet(context, student),
                              child: Container(
                                width: 34, height: 34,
                                decoration: BoxDecoration(
                                  color: AppColors.bgSurface,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.info_outline_rounded, color: AppColors.textSecondary, size: 16),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (student.phone != null)
                              GestureDetector(
                                onTap: () => _showCallDialog(context, student),
                                child: Container(
                                  width: 34, height: 34,
                                  decoration: BoxDecoration(
                                    color: AppColors.primarySoft,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.phone_rounded, color: AppColors.primary, size: 16),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                error: (err, stack) => _buildErrorState(context, ref, collegeId ?? ""),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref, String collegeId) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
            const SizedBox(height: 16),
            Text(
              "Permission Denied or Connection Error",
              style: AppTypography.h3.copyWith(color: AppColors.error),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              "Drivers may need additional permissions to view the students list. Please contact your administrator.",
              style: AppTypography.bodyMd.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => ref.refresh(studentsProvider(collegeId)),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text("Retry Connection"),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
