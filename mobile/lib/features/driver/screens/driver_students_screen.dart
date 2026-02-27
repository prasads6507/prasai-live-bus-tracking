import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:mobile/core/theme/colors.dart';
import 'package:mobile/core/theme/typography.dart';
import 'package:mobile/core/widgets/app_scaffold.dart';
import 'package:mobile/data/providers.dart';
import 'package:mobile/data/models/user_profile.dart';
import 'package:mobile/data/datasources/api_ds.dart';

class DriverStudentsScreen extends ConsumerStatefulWidget {
  const DriverStudentsScreen({super.key});

  @override
  ConsumerState<DriverStudentsScreen> createState() => _DriverStudentsScreenState();
}

class _DriverStudentsScreenState extends ConsumerState<DriverStudentsScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchMode = false;
  String _searchQuery = '';
  
  // Local state for batch attendance
  Set<String> _localAttendedIds = {};
  bool _isLoadingPrefs = true;

  @override
  void initState() {
    super.initState();
    _loadLocalAttendance();
  }

  Future<void> _loadLocalAttendance() async {
    final activeTripId = ref.read(activeTripIdProvider).value;
    if (activeTripId == null) {
      if (mounted) setState(() => _isLoadingPrefs = false);
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList('shared_attendance_$activeTripId') ?? [];
    if (mounted) {
      setState(() {
        _localAttendedIds = list.toSet();
        _isLoadingPrefs = false;
      });
    }
  }

  Future<void> _saveLocalAttendance() async {
    final activeTripId = ref.read(activeTripIdProvider).value;
    if (activeTripId == null) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('shared_attendance_$activeTripId', _localAttendedIds.toList());
  }

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
    if (_isLoadingPrefs) {
      return const AppScaffold(body: Center(child: CircularProgressIndicator()));
    }

    final profileAsync = ref.watch(userProfileProvider);
    final assignedBusAsync = ref.watch(assignedBusProvider);

    return profileAsync.when(
      data: (userProfile) {
        if (userProfile == null) {
          return const AppScaffold(
            body: Center(child: Text('User profile not found')),
          );
        }

        final collegeId = userProfile.collegeId;
        final activeTripId = ref.watch(activeTripIdProvider).value;

        return assignedBusAsync.when(
          data: (assignedBus) {
            final driverBusId = assignedBus?.id ?? userProfile.assignedBusId;
            final tripAsync = activeTripId != null ? ref.watch(tripProvider(activeTripId)) : const AsyncValue<Map<String, dynamic>?>.data(null);

            // Fetch students for THIS bus
            final busStudentsAsync = driverBusId != null 
                ? ref.watch(busStudentsProvider(driverBusId)) 
                : const AsyncValue<List<UserProfile>>.data([]);
            
            final allStudentsAsync = ref.watch(studentsProvider(collegeId));
            final busesAsync = ref.watch(busesProvider(collegeId));

            final Map<String, String> busIdToNumber = {};
            busesAsync.whenData((buses) {
              for (var b in buses) {
                busIdToNumber[b.id] = b.busNumber;
              }
            });

            return tripAsync.when(
              data: (tripData) {
                final direction = tripData?['direction'] ?? 'pickup';

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

                      if (!_isSearchMode && activeTripId != null)
                        busStudentsAsync.maybeWhen(
                          data: (assignedStudents) => _buildAttendanceSummary(assignedStudents, direction),
                          orElse: () => const SizedBox.shrink(),
                        ),

                      Expanded(
                        child: _isSearchMode 
                          ? allStudentsAsync.when(
                              data: (allStudents) {
                                final q = _searchQuery.toLowerCase();
                                final displayList = allStudents.where((s) {
                                  final nameMatch = (s.name ?? '').toLowerCase().contains(q);
                                  final emailMatch = (s.email ?? '').toLowerCase().contains(q);
                                  return nameMatch || emailMatch;
                                }).toList();
                                return _buildStudentList(displayList, activeTripId, direction, busIdToNumber);
                              },
                              loading: () => const Center(child: CircularProgressIndicator()),
                              error: (err, stack) => Center(child: Text('Error: $err')),
                            )
                          : busStudentsAsync.when(
                              data: (assignedStudents) {
                                return _buildStudentList(assignedStudents, activeTripId, direction, busIdToNumber);
                              },
                              loading: () => const Center(child: CircularProgressIndicator()),
                              error: (err, stack) => Center(child: Text('Error: $err')),
                            ),
                      ),
                    ],
                  ),
                );
              },
              loading: () => const AppScaffold(body: Center(child: CircularProgressIndicator())),
              error: (err, stack) => AppScaffold(body: Center(child: Text('Error loading trip: $err'))),
            );
          },
          loading: () => const AppScaffold(body: Center(child: CircularProgressIndicator())),
          error: (err, stack) => AppScaffold(body: Center(child: Text('Error loading bus: $err'))),
        );
      },
      loading: () => const AppScaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, stack) => AppScaffold(body: Center(child: Text('Error loading profile: $err'))),
    );
  }

  Widget _buildStudentList(List<UserProfile> displayList, String? activeTripId, String direction, Map<String, String> busIdToNumber) {
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
        final assignedBus = ref.watch(assignedBusProvider).value;
        final driverBusId = assignedBus?.id;
        final isOnOtherBus = student.assignedBusId != null && student.assignedBusId != driverBusId;
        final isAttended = _localAttendedIds.contains(student.id);

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
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name ?? 'Unknown Student',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                if (isOnOtherBus)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.orange[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.orange[200]!),
                    ),
                    child: Text(
                      _getBusLabel(student.assignedBusId, busIdToNumber),
                      style: const TextStyle(color: Colors.orange, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  )
                else if (student.assignedBusId == driverBusId && driverBusId != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
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
            trailing: activeTripId != null 
                ? Checkbox(
                    value: isAttended,
                    activeColor: direction == 'pickup' ? Colors.green : Colors.blue,
                    onChanged: (val) => _onAttendanceChanged(student, val ?? false, direction),
                  )
                : IconButton(
                    icon: const Icon(Icons.call, color: AppColors.primary),
                    onPressed: () => _showCallDialog(student),
                  ),
            onTap: () => _showStudentDetails(student, busIdToNumber, activeTripId, direction, isAttended),
          ),
        );
      },
    );
  }

  Widget _buildAttendanceSummary(List<UserProfile> students, String direction) {
    final total = students.length;
    final marked = students.where((s) => _localAttendedIds.contains(s.id)).length;
    final pending = total - marked;
    final label = direction == 'pickup' ? 'Picked Up' : 'Dropped Off';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildSummaryItem('Total', total, Colors.black87),
          _buildSummaryItem(label, marked, direction == 'pickup' ? Colors.green : Colors.blue),
          _buildSummaryItem('Pending', pending, Colors.orange),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(String label, int count, Color color) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
      ],
    );
  }

  void _onAttendanceChanged(UserProfile student, bool checked, String direction) async {
    if (!checked) {
      // Show confirmation alert for unchecking
      final label = direction == 'pickup' ? 'not picked up' : 'not dropped off';
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirm Action'),
          content: Text('Do you want to mark ${student.name} as $label?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No, keep it')),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Yes, mark as $label', style: const TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );

      if (confirmed != true) return;
    }

    setState(() {
      if (checked) {
        _localAttendedIds.add(student.id);
      } else {
        _localAttendedIds.remove(student.id);
      }
    });
    _saveLocalAttendance();

    try {
      final bus = ref.read(assignedBusProvider).value;
      final activeTripId = bus?.activeTripId;
      if (activeTripId != null && bus != null) {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token');
        final dio = Dio();
        if (token != null) {
          dio.options.headers['Authorization'] = 'Bearer $token';
        }
        final apiDS = ApiDataSource(dio, FirebaseFirestore.instance);
        
        // Fire asynchronously, no await blocking the UI
        apiDS.notifyStudentAttendance(
          tripId: activeTripId,
          studentId: student.id,
          busId: bus.id,
          direction: direction,
          isChecked: checked,
          busNumber: bus.busNumber,
        );
      }
    } catch (e) {
      debugPrint('[DriverStudentsScreen] Failed to trigger student notification: $e');
    }
  }

  void _showStudentDetails(UserProfile student, Map<String, String> busIdToNumber, String? activeTripId, String direction, bool isAttended) {
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
            _detailRow(Icons.bus_alert, 'Assigned Bus', _getBusLabel(student.assignedBusId, busIdToNumber, isFull: true)),
            if (activeTripId != null)
              _detailRow(Icons.check_circle_outline, 'Status', isAttended ? (direction == 'pickup' ? 'Picked Up' : 'Dropped Off') : 'Pending'),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _makePhoneCall(student.phone);
                    },
                    icon: const Icon(Icons.call),
                    label: const Text('Call'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                if (activeTripId != null) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _onAttendanceChanged(student, !isAttended, direction);
                      },
                      icon: Icon(isAttended ? Icons.remove_circle_outline : Icons.check_circle_outline),
                      label: Text(isAttended ? 'Remove Marking' : (direction == 'pickup' ? 'Pick Up' : 'Drop Off')),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isAttended ? Colors.red[50] : (direction == 'pickup' ? Colors.green : Colors.blue),
                        foregroundColor: isAttended ? Colors.red : Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
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
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              _makePhoneCall(student.phone);
            },
            icon: const Icon(Icons.call),
            label: const Text('Call'),
          ),
        ],
      ),
    );
  }

  String _getBusLabel(String? busId, Map<String, String> busMap, {bool isFull = false}) {
    if (busId == null) return 'No Bus';
    final number = busMap[busId];
    if (number != null) return isFull ? 'Bus $number' : 'Bus $number';
    return isFull ? 'Assigned' : 'Assigned';
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
