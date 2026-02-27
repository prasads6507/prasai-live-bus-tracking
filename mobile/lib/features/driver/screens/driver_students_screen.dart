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
    final assignedBus = ref.watch(assignedBusProvider).value;
    final driverBusId = assignedBus?.id ?? userProfile?.assignedBusId;
    final collegeId = userProfile?.collegeId ?? '';
    final activeTripId = ref.watch(activeTripIdProvider).value;

    Map<String, String> attendanceMap = {};
    if (activeTripId != null) {
      final attendanceAsync = ref.watch(tripAttendanceProvider(activeTripId));
      attendanceAsync.whenData((data) {
        for (var record in data) {
          attendanceMap[record['studentId']] = record['status'] ?? '';
        }
      });
    }

    // Fetch students and buses
    final studentsAsync = ref.watch(studentsProvider(collegeId));
    final busStudentsAsync = driverBusId != null 
        ? ref.watch(busStudentsProvider(driverBusId)) 
        : const AsyncValue<List<UserProfile>>.data([]);
    
    final busesAsync = ref.watch(busesProvider(collegeId));

    // Create a map for quick bus number lookup
    final Map<String, String> busIdToNumber = {};
    busesAsync.whenData((buses) {
      for (var b in buses) {
        busIdToNumber[b.id] = b.busNumber;
      }
    });

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
              data: (assignedStudents) => _buildAttendanceSummary(assignedStudents, attendanceMap),
              orElse: () => const SizedBox.shrink(),
            ),

          Expanded(
            child: _isSearchMode 
              ? studentsAsync.when(
                  data: (allStudents) {
                    final q = _searchQuery.toLowerCase();
                    final displayList = allStudents.where((s) {
                      final nameMatch = (s.name ?? '').toLowerCase().contains(q);
                      final emailMatch = (s.email ?? '').toLowerCase().contains(q);
                      return nameMatch || emailMatch;
                    }).toList();
                    return _buildStudentList(displayList, activeTripId, attendanceMap, busIdToNumber);
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (err, stack) => Center(child: Text('Error: $err')),
                )
              : busStudentsAsync.when(
                  data: (assignedStudents) {
                    return _buildStudentList(assignedStudents, activeTripId, attendanceMap, busIdToNumber);
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (err, stack) => Center(child: Text('Error: $err')),
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentList(List<UserProfile> displayList, String? activeTripId, Map<String, String> attendanceMap, Map<String, String> busIdToNumber) {
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
            trailing: _buildAttendanceAction(student, activeTripId, attendanceMap[student.id]),
            onTap: () => _showStudentDetails(student, busIdToNumber, activeTripId, attendanceMap[student.id]),
          ),
        );
      },
    );
  }

  Widget _buildAttendanceSummary(List<UserProfile> students, Map<String, String> attendanceMap) {
    int pickedUp = 0;
    int droppedOff = 0;
    int pending = 0;

    for (var s in students) {
      final status = attendanceMap[s.id];
      if (status == 'picked_up') {
        pickedUp++;
      } else if (status == 'dropped_off') {
        droppedOff++;
      } else {
        pending++;
      }
    }

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
          _buildSummaryItem('Picked Up', pickedUp, Colors.blue),
          _buildSummaryItem('Dropped Off', droppedOff, Colors.green),
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

  Widget _buildAttendanceAction(UserProfile student, String? activeTripId, String? status) {
    if (activeTripId == null) {
      return IconButton(
        icon: const Icon(Icons.call, color: AppColors.primary),
        onPressed: () => _showCallDialog(student),
      );
    }

    if (status == null) {
      return ElevatedButton(
        onPressed: () => _markAttendance(student, activeTripId, 'pickup'),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          minimumSize: const Size(0, 32),
        ),
        child: const Text('Pick Up', style: TextStyle(fontSize: 12)),
      );
    }

    if (status == 'picked_up') {
      return ElevatedButton(
        onPressed: () => _confirmDropOff(student, activeTripId),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          minimumSize: const Size(0, 32),
        ),
        child: const Text('Drop Off', style: TextStyle(fontSize: 12)),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text('Done ✓', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold)),
    );
  }

  void _markAttendance(UserProfile student, String tripId, String type) async {
    try {
      final dio = ref.read(dioProvider);
      final endpoint = type == 'pickup' ? 'pickup' : 'dropoff';
      final response = await dio.post('/driver/trips/$tripId/attendance/$endpoint', data: {'studentId': student.id});
      
      if (response.data['success']) {
        // Refresh attendance provider
        ref.invalidate(tripAttendanceProvider(tripId));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${student.name} marked as ${type == 'pickup' ? 'picked up' : 'dropped off'}')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to mark attendance: $e')),
        );
      }
    }
  }

  void _confirmDropOff(UserProfile student, String tripId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Drop Off'),
        content: Text('Confirm drop off for ${student.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _markAttendance(student, tripId, 'dropoff');
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  void _showStudentDetails(UserProfile student, Map<String, String> busIdToNumber, String? activeTripId, String? status) {
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
              _detailRow(Icons.check_circle_outline, 'Status', status == 'picked_up' ? 'On Bus' : (status == 'dropped_off' ? 'Dropped Off' : 'Pending')),
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
                if (activeTripId != null && status != 'dropped_off') ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        if (status == null) {
                          _markAttendance(student, activeTripId, 'pickup');
                        } else {
                          _confirmDropOff(student, activeTripId);
                        }
                      },
                      icon: Icon(status == null ? Icons.login : Icons.logout),
                      label: Text(status == null ? 'Pick Up' : 'Drop Off'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: status == null ? Colors.green : Colors.blue,
                        foregroundColor: Colors.white,
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
