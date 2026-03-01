# Phase 4 Plan: Skip & Attendance Reliability

<task type="auto">
  <name>Fix immediate Skip UI after Start Trip</name>
  <files>mobile/lib/features/driver/screens/driver_home.dart</files>
  <action>
    Update `_startTracking()` update listener to assign `_nextStopId` and `_nextStopName` from the data received from the background service.
    - Ensure `data['nextStopId']` and `data['nextStopName']` are assigned to local state.
    - Call `setState(() {})`.
  </action>
  <verify>Start a trip and verify that the "Next Stop" card with the Skip button appearing immediately without screen transition.</verify>
  <done>Skip button and Next Stop name are visible instantly after Start Trip button is pressed.</done>
</task>

<task type="auto">
  <name>Add nextStopId to background payload</name>
  <files>mobile/lib/features/driver/services/background_tracking_service.dart</files>
  <action>
    In the background service, ensure the `update` event payload includes the `nextStopId`.
    - Locate where `lastUpdateData` is built.
    - Add `"nextStopId": nextStopId` to the map.
  </action>
  <verify>Inspect background service logs or UI updates to ensure `nextStopId` is being transmitted.</verify>
  <done>Background service reliably sends both name and ID of the next stop.</done>
</task>

<task type="auto">
  <name>Implement Reliable Skip using DB Truth</name>
  <files>mobile/lib/features/driver/screens/driver_home.dart</files>
  <action>
    Refactor `_handleSkipStop()` to:
    1. Read `trips/{tripId}` from Firestore.
    2. Get `stopProgress.currentIndex`.
    3. Compute `currentStopId = stops[currentIndex]`.
    4. Use this `currentStopId` as the skip target instead of the potentially stale UI state.
    5. Force a refresh by invoking `request_update` after skipping.
  </action>
  <verify>Skip multiple stops in sequence and ensure the UI stays in sync with the database.</verify>
  <done>Skip functionality works reliably even if the UI state was temporarily stale.</done>
</task>

<task type="auto">
  <name>Separate Pickup and Drop-off Attendance</name>
  <files>mobile/lib/features/driver/screens/driver_students_screen.dart</files>
  <action>
    1. Clear local attendance state (`_lockedIds`, `_localAttendedIds`, `_pendingIds`) when trip or direction changes.
    2. Make the local cache key direction-aware: `shared_attendance_${activeTripId}_$direction`.
    3. Ensure `getTodayAttendance(busId, direction)` is called correctly with the direction parameter.
  </action>
  <verify>Mark attendance in a pickup trip, end it, start a drop-off trip, and verify the attendance screen is fresh.</verify>
  <done>Attendance records for pickup and drop-off are strictly isolated.</done>
</task>

<task type="auto">
  <name>Implement Instant Student Attendance Notifications</name>
  <files>mobile/lib/features/driver/screens/driver_students_screen.dart</files>
  <action>
    Immediately trigger a push notification when a student is marked as "Boarded" or "Dropped Off".
    - Use the existing notification service (likely `NotificationService` or similar) to send the update right after the checkmark is pressed.
  </action>
  <verify>Tap the checkmark for a student and verify the parent/student app receives the notification immediately.</verify>
  <done>Actionable attendance events notify parents in real-time without delay.</done>
</task>

<task type="auto">
  <name>Build Release APK and Push to Git</name>
  <files>N/A</files>
  <action>
    1. Run `flutter clean` and `flutter pub get`.
    2. Run `flutter build apk --release`.
    3. Create branch `fix/skip-and-attendance`.
    4. Commit all changes.
    5. Push to origin.
  </action>
  <verify>Successful build output at `build/app/outputs/flutter-apk/app-release.apk` and branch pushed to Git.</verify>
  <done>Release APK is generated and code is safely stored in the repository.</done>
</task>
