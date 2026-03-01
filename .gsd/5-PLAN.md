# Phase 5: Attendance Isolation Plan

<task type="auto">
  <name>Implement Attendance Reset in Driver Home</name>
  <files>mobile/lib/features/driver/screens/driver_home.dart</files>
  <action>
    In the `_startTracking(...)` method of `driver_home.dart`, after saving the following keys to SharedPreferences:
    - `track_college_id`
    - `track_bus_id`
    - `track_trip_id`
    - `track_direction`
    - `api_base_url`

    Insert the following code to clear the attendance cache for the current session:
    ```dart
    final attendanceKey = 'shared_attendance_${tripId}_${widget.direction}';
    await prefs.remove(attendanceKey);
    await prefs.remove('shared_attendance_$tripId');
    ```
  </action>
  <verify>Check that the code is correctly inserted in the tracking initialization flow.</verify>
  <done>The attendance list for the current trip and direction is cleared when tracking starts.</done>
</task>
