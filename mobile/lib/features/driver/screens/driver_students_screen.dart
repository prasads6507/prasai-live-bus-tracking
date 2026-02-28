import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
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
  
  // Local state for batch attendance (optimistic UI)
  Set<String> _localAttendedIds = {};
  // Track students currently being submitted to show loading state
  Set<String> _pendingIds = {};
  bool _isLoadingPrefs = true;

  @override
  void initState() {
    super.initState();
    _loadLocalAttendance();
  }

  Future<void> _loadLocalAttendance({String? forcedDirection}) async {
    final activeTripId = ref.read(activeTripIdProvider).value;
    final assignedBus = ref.read(assignedBusProvider).value;
    final profile = ref.read(userProfileProvider).value;
    
    if (activeTripId == null) {
      if (mounted) setState(() => _isLoadingPrefs = false);
      return;
    }

    final driverBusId = assignedBus?.id ?? profile?.assignedBusId;

    // 1. Load from SharedPreferences (local cache/offline safety)
    final prefs = await SharedPreferences.getInstance();
    final localList = prefs.getStringList('shared_attendance_$activeTripId') ?? [];
    
    if (mounted) {
      setState(() {
        _localAttendedIds = localList.toSet();
      });
    }

    // 2. Load from Backend (source of truth for persistence across trip restarts)
    if (driverBusId != null) {
      try {
        final apiDS = await _buildApiDataSource();
        
        // If forcedDirection is null, try to get from tripProvider
        String? direction = forcedDirection;
        if (direction == null) {
          final tripData = ref.read(tripProvider(activeTripId)).value;
          direction = tripData?['direction'];
        }

        // If we still don't have direction, we might need to wait for tripProvider
        // But we'll fallback to 'pickup' for now, and the listener will re-trigger when tripData arrives.
        final effectiveDirection = direction ?? 'pickup';
        
        final remoteList = await apiDS.getTodayAttendance(driverBusId, effectiveDirection);
        
        if (mounted && remoteList.isNotEmpty) {
          setState(() {
            // Merge remote with local to ensure we don't lose anything
            _localAttendedIds.addAll(remoteList);
          });
          // Update local cache too
          await _saveLocalAttendance(activeTripId);
        }
      } catch (e) {
        debugPrint('[DriverStudentsScreen] Remote sync failed: $e');
      }
    }

    if (mounted) {
      setState(() => _isLoadingPrefs = false);
    }
  }

  Future<void> _saveLocalAttendance(String activeTripId) async {
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
    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  Future<ApiDataSource> _buildApiDataSource() async {
    final dio = Dio();
    // Try Firebase token first, fall back to stored JWT
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final token = await user.getIdToken();
        if (token != null) {
          dio.options.headers['Authorization'] = 'Bearer $token';
          return ApiDataSource(dio, FirebaseFirestore.instance);
        }
      }
    } catch (_) {}

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token != null) {
      dio.options.headers['Authorization'] = 'Bearer $token';
    }
    return ApiDataSource(dio, FirebaseFirestore.instance);
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
          return const AppScaffold(body: Center(child: Text('User profile not found')));
        }

        final collegeId = userProfile.collegeId;
        final activeTripId = ref.watch(activeTripIdProvider).value;
        
        // Listen for trip changes to trigger re-sync (crucial for trip restart persistence)
        ref.listen(activeTripIdProvider, (previous, next) {
          if (next.value != previous?.value && next.value != null) {
            _loadLocalAttendance();
          }
        });

        // Also listen for trip data (especially direction) to trigger re-sync if it arrived late
        if (activeTripId != null) {
          ref.listen(tripProvider(activeTripId), (previous, next) {
            final prevDirection = previous?.value?['direction'];
            final nextDirection = next.value?['direction'];
            if (nextDirection != null && nextDirection != prevDirection) {
              _loadLocalAttendance(forcedDirection: nextDirection);
            }
          });
        }

        return assignedBusAsync.when(
          data: (assignedBus) {
            final driverBusId = assignedBus?.id ?? userProfile.assignedBusId;
            final tripAsync = activeTripId != null
                ? ref.watch(tripProvider(activeTripId))
                : const AsyncValue<Map<String, dynamic>?>.data(null);

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
                      // Search
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
                          data: (assignedStudents) =>
                              _buildAttendanceSummary(assignedStudents, direction),
                          orElse: () => const SizedBox.shrink(),
                        ),

                      Expanded(
                        child: _isSearchMode
                            ? allStudentsAsync.when(
                                data: (allStudents) {
                                  final q = _searchQuery.toLowerCase();
                                  final displayList = allStudents.where((s) {
                                    final nameMatch =
                                        (s.name ?? '').toLowerCase().contains(q);
                                    final emailMatch =
                                        (s.email ?? '').toLowerCase().contains(q);
                                    return nameMatch || emailMatch;
                                  }).toList();
                                  return _buildStudentList(displayList, activeTripId,
                                      direction, busIdToNumber);
                                },
                                loading: () =>
                                    const Center(child: CircularProgressIndicator()),
                                error: (err, stack) =>
                                    Center(child: Text('Error: $err')),
                              )
                            : busStudentsAsync.when(
                                data: (assignedStudents) => _buildStudentList(
                                    assignedStudents, activeTripId, direction,
                                    busIdToNumber),
                                loading: () =>
                                    const Center(child: CircularProgressIndicator()),
                                error: (err, stack) =>
                                    Center(child: Text('Error: $err')),
                              ),
                      ),
                    ],
                  ),
                );
              },
              loading: () =>
                  const AppScaffold(body: Center(child: CircularProgressIndicator())),
              error: (err, stack) =>
                  AppScaffold(body: Center(child: Text('Error loading trip: $err'))),
            );
          },
          loading: () =>
              const AppScaffold(body: Center(child: CircularProgressIndicator())),
          error: (err, stack) =>
              AppScaffold(body: Center(child: Text('Error loading bus: $err'))),
        );
      },
      loading: () =>
          const AppScaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, stack) =>
          AppScaffold(body: Center(child: Text('Error loading profile: $err'))),
    );
  }

  Widget _buildStudentList(List<UserProfile> displayList, String? activeTripId,
      String direction, Map<String, String> busIdToNumber) {
    if (displayList.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              _isSearchMode
                  ? 'No students found matching "$_searchQuery"'
                  : 'No students assigned to your bus',
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
        final isPending = _pendingIds.contains(student.id);

        return StudentItem(
          student: student,
          isOnOtherBus: isOnOtherBus,
          busLabel: _getBusLabel(student.assignedBusId, busIdToNumber),
          isAttended: isAttended,
          isPending: isPending,
          activeTripId: activeTripId,
          direction: direction,
          onAttendanceChanged: (val) => _onAttendanceChanged(student, val, direction, activeTripId!),
          onCall: () => _showCallDialog(student),
          onTap: () => _showStudentDetails(student, busIdToNumber, activeTripId, direction, isAttended),
          isMyBus: student.assignedBusId == driverBusId && driverBusId != null,
        );
      },
    );
  }

  Widget _buildBusTag(String label, Color bg, Color border, Color textColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(color: textColor, fontSize: 10, fontWeight: FontWeight.bold),
      ),
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
          _buildSummaryItem(
              label, marked, direction == 'pickup' ? Colors.green : Colors.blue),
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
          style: TextStyle(
              fontSize: 20, fontWeight: FontWeight.bold, color: color),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
      ],
    );
  }

  /// Called when driver taps a student checkbox.
  /// Immediately writes to Firestore attendance DB AND sends FCM notification to the student.
  void _onAttendanceChanged(
      UserProfile student, bool checked, String direction, String activeTripId) async {
    // If unchecking, show confirmation dialog
    if (!checked) {
      final label = direction == 'pickup' ? 'not picked up' : 'not dropped off';
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirm Action'),
          content: Text('Do you want to mark ${student.name} as $label?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('No, keep it')),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Yes, mark as $label',
                  style: const TextStyle(color: Colors.red)),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    // Optimistic UI update
    setState(() {
      if (checked) {
        _localAttendedIds.add(student.id);
      } else {
        _localAttendedIds.remove(student.id);
      }
      _pendingIds.add(student.id);
    });

    // Persist locally (for trip end upload safety net)
    await _saveLocalAttendance(activeTripId);

    try {
      final apiDS = await _buildApiDataSource();

      // Use markPickup / markDropoff — these write to DB AND send FCM immediately.
      // Only call for "checked" state; unchecking is local-only (records remain in DB
      // to avoid confusion, driver can re-check if needed).
      if (checked) {
        if (direction == 'pickup') {
          await apiDS.markStudentPickup(
            tripId: activeTripId,
            studentId: student.id,
          );
        } else {
          await apiDS.markStudentDropoff(
            tripId: activeTripId,
            studentId: student.id,
          );
        }
      }
    } catch (e) {
      debugPrint('[DriverStudentsScreen] Attendance API failed: $e');
      // Show snack bar but keep optimistic state — historyUpload at trip end is the safety net
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ Saved locally. Will sync on trip end.'),
            backgroundColor: Colors.orange[700],
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _pendingIds.remove(student.id));
      }
    }
  }

  void _showStudentDetails(UserProfile student, Map<String, String> busIdToNumber,
      String? activeTripId, String direction, bool isAttended) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        // Use a local builder to ensure variables are captured correctly if needed, 
        // though Dart closures usually handle this fine.
        return Container(
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
                      style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 24,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(student.name ?? 'Unknown Student',
                            style: AppTypography.h3),
                        Text(student.email, style: AppTypography.bodyMd),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (activeTripId != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isAttended
                        ? (direction == 'pickup' ? Colors.green[50] : Colors.blue[50])
                        : Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isAttended ? Icons.check_circle : Icons.pending,
                        size: 16,
                        color: isAttended
                            ? (direction == 'pickup' ? Colors.green : Colors.blue)
                            : Colors.grey,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isAttended
                            ? (direction == 'pickup' ? 'Picked Up ✓' : 'Dropped Off ✓')
                            : 'Pending',
                        style: TextStyle(
                          color: isAttended
                              ? (direction == 'pickup' ? Colors.green : Colors.blue)
                              : Colors.grey,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              if (student.phone != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone, color: AppColors.primary),
                  title: Text(student.phone!),
                  onTap: () => _makePhoneCall(student.phone),
                ),
              _detailRow(Icons.bus_alert, 'Assigned Bus', _getBusLabel(student.assignedBusId, busIdToNumber)),
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
                          _onAttendanceChanged(student, !isAttended, direction, activeTripId);
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
        );
      },
    );
  }

  void _showCallDialog(UserProfile student) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Call ${student.name ?? 'Student'}?'),
        content: Text('Phone: ${student.phone ?? 'N/A'}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
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

class StudentItem extends StatelessWidget {
  final UserProfile student;
  final bool isOnOtherBus;
  final bool isMyBus;
  final String busLabel;
  final bool isAttended;
  final bool isPending;
  final String? activeTripId;
  final String direction;
  final ValueChanged<bool> onAttendanceChanged;
  final VoidCallback onCall;
  final VoidCallback onTap;

  const StudentItem({
    super.key,
    required this.student,
    required this.isOnOtherBus,
    required this.isMyBus,
    required this.busLabel,
    required this.isAttended,
    required this.isPending,
    this.activeTripId,
    required this.direction,
    required this.onAttendanceChanged,
    required this.onCall,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
              _BusTag(label: busLabel, color: Colors.orange)
            else if (isMyBus)
              const _BusTag(label: 'My Bus', color: Colors.green),
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
            ? (isPending
                ? const SizedBox(
                    width: 48, height: 48,
                    child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
                  )
                : SizedBox(
                    width: 48, height: 48,
                    child: Checkbox(
                      value: isAttended,
                      activeColor: direction == 'pickup' ? Colors.green : Colors.blue,
                      onChanged: (val) => onAttendanceChanged(val ?? false),
                    ),
                  ))
            : SizedBox(
                width: 48, height: 48,
                child: IconButton(
                  icon: const Icon(Icons.call, color: AppColors.primary),
                  onPressed: onCall,
                ),
              ),
        onTap: onTap,
      ),
    );
  }
}

class _BusTag extends StatelessWidget {
  final String label;
  final Color color;
  const _BusTag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}
