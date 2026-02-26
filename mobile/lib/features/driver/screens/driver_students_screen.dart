import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:mobile/core/theme/colors.dart';
import 'package:mobile/core/theme/typography.dart';
import 'package:mobile/core/widgets/app_scaffold.dart';
import 'package:mobile/data/providers.dart';
import 'package:mobile/data/models/user_profile.dart';

class DriverStudentsScreen extends ConsumerStatefulWidget {
  const DriverStudentsScreen({super.key});

  @override
  ConsumerState<DriverStudentsScreen> createState() => _DriverStudentsScreenState();
}

class _DriverStudentsScreenState extends ConsumerState<DriverStudentsScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchMode = false;
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _makePhoneCall(String? phoneNumber) async {
    if (phoneNumber == null || phoneNumber.isEmpty) return;
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: phoneNumber,
    );
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userProfile = ref.watch(userProfileProvider).value;
    final driverBusId = userProfile?.assignedBusId;
    final collegeId = userProfile?.collegeId ?? '';

    // Fetch all students in the college
    final studentsAsync = ref.watch(studentsProvider(collegeId));

    return AppScaffold(
      appBar: AppBar(
        title: Text('Students', style: AppTypography.h2),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Search Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search all students...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() {
                            _searchController.clear();
                            _searchQuery = '';
                            _isSearchMode = false;
                          });
                        },
                      )
                    : null,
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val.trim();
                  _isSearchMode = _searchQuery.isNotEmpty;
                });
              },
            ),
          ),

          Expanded(
            child: studentsAsync.when(
              data: (allStudents) {
                // Determine which students to show
                List<UserProfile> displayList;

                if (_isSearchMode) {
                  // Search all students by name, email, or roll number
                  final q = _searchQuery.toLowerCase();
                  displayList = allStudents.where((s) {
                    final nameMatch = (s.name ?? '').toLowerCase().contains(q);
                    final emailMatch = (s.email ?? '').toLowerCase().contains(q);
                    // Using email or name as fallback if rollNumber isn't there
                    return nameMatch || emailMatch;
                  }).toList();
                } else {
                  // Default Mode: Only show students assigned to THIS driver's bus
                  displayList = allStudents.where((s) => s.assignedBusId == driverBusId).toList();
                }

                if (displayList.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.people_outline, size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          _isSearchMode ? 'No students found matching "$_searchQuery"' : 'No students assigned to your bus',
                          style: TextStyle(color: Colors.grey[600]),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: displayList.length,
                  itemBuilder: (context, index) {
                    final student = displayList[index];
                    final isOnOtherBus = student.assignedBusId != null && student.assignedBusId != driverBusId;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(12),
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withOpacity(0.1),
                          child: Text(
                            (student.name ?? 'S')[0].toUpperCase(),
                            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(
                                student.name ?? 'Unknown Student',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                            if (isOnOtherBus)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.orange[50],
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.orange[200]!),
                                ),
                                child: const Text(
                                  'Bus Assigned',
                                  style: TextStyle(color: Colors.orange, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              )
                            else if (student.assignedBusId == driverBusId)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, py: 2),
                                decoration: BoxDecoration(
                                  color: Colors.green[50],
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.green[200]!),
                                ),
                                child: const Text(
                                  'My Bus',
                                  style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                          ],
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(student.email),
                            if (student.phone != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  student.phone!,
                                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                                ),
                              ),
                          ],
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.call, color: AppColors.primary),
                          onPressed: () {
                             _showCallDialog(student);
                          },
                        ),
                         onTap: () => _showStudentDetails(student),
                      ),
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
    );
  }

  void _showCallDialog(UserProfile student) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Call Student'),
        content: Text('Do you want to call ${student.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _makePhoneCall(student.phone);
            },
            child: const Text('Call'),
          ),
        ],
      ),
    );
  }

    void _showStudentDetails(UserProfile student) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppColors.primary.withOpacity(0.1),
                  child: Text(
                    (student.name ?? 'S')[0].toUpperCase(),
                    style: const TextStyle(color: AppColors.primary, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(student.name ?? 'Unknown Student', style: AppTypography.h3),
                      Text(student.email, style: AppTypography.bodyMd),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _detailRow(Icons.email, 'Email', student.email),
            _detailRow(Icons.phone, 'Phone', student.phone ?? 'Not provided'),
            _detailRow(Icons.bus_alert, 'Assigned Bus ID', student.assignedBusId ?? 'Not Assigned'),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  _makePhoneCall(student.phone);
                },
                icon: const Icon(Icons.call),
                label: const Text('Call Student Directly'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[400]),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
        ],
      ),
    );
  }
}
