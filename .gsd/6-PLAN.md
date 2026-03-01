# Phase 6: Sync & UI Reliability

<task type="auto">
  <name>Fix Skip Stop UI Update</name>
  <files>mobile/lib/features/driver/services/background_tracking_service.dart</files>
  <action>
    - Update `_handleManualSkip` to use `service.invoke('update', ...)` for immediate isolate communication.
    - Include full telemetry in the update payload to prevent UI flickering.
  </action>
  <verify>Skip a stop and check if the 'NEXT STOP' name updates instantly without refresh.</verify>
  <done>Next stop UI updates instantly after a manual skip.</done>
</task>

<task type="auto">
  <name>Fix Attendance Cross-Session Carry-over</name>
  <files>frontend/college-portal/server/controllers/driverController.js, mobile/lib/features/driver/screens/driver_students_screen.dart</files>
  <action>
    - Backend: Remove `updatedAt` from the date-checking logic in `getTodayAttendance` to prevent old retried records from appearing as today's.
    - Mobile: Explicitly clear local set state in `DriverStudentsScreen` before re-sync to prevent merging old data.
  </action>
  <verify>Mark a student in pickup, end trip, start dropoff, and check if the student list is fresh.</verify>
  <done>Attendance remains strictly isolated by session direction.</done>
</task>
