# Phase 1 Plan: Stabilization & UI Persistence

This plan addresses the two critical UX issues reported by the user:
1. **Instant Student Boarding Notifications**: Ensuring parents get notified immediately without Vercel suspension issues.
2. **Driver Dashboard Persistence**: Ensuring the location and road name don't reset when navigating between screens.

<task type="auto">
  <name>Await Attendance Notifications in Backend</name>
  <files>frontend/college-portal/server/controllers/driverController.js</files>
  <action>
    Modify `markPickup` and `markDropoff` functions.
    Crucial: Prefix the call to `sendStudentAttendanceNotification` with `await`.
    Reason: Vercel serverless functions can suspend execution immediately after the response is sent. By not awaiting the FCM dispatch, the notification might be queued but never sent if the container sleeps.
  </action>
  <verify>Check Vercel logs to ensure the function execution time includes the FCM dispatch delay.</verify>
  <done>Attendance notifications are reliably sent before the HTTP response is finalized.</done>
</task>

<task type="auto">
  <name>Implement Background State Replay</name>
  <files>mobile/lib/features/driver/services/background_tracking_service.dart</files>
  <action>
    In the `onStart` function of the background isolate:
    1. Create a variable `lastUpdateData` to cache the last emitted 'update' payload.
    2. Add a listener: `service.on('request_update').listen((_) { if (lastUpdateData != null) service.invoke('update', lastUpdateData); });`.
    3. Update `lastUpdateData` inside the `positionStream.listen` block every time `service.invoke('update', ...)` is called.
  </action>
  <verify>Verify that calling `service.invoke('request_update')` trigger an immediate 'update' event with cached data.</verify>
  <done>Background service can replay its current state to new UI listeners.</done>
</task>

<task type="auto">
  <name>Restore Driver Dashboard on UI Resume</name>
  <files>mobile/lib/features/driver/screens/driver_home.dart</files>
  <action>
    In `_listenToBackgroundService()`:
    1. After setting up the `service.on('update')` listener, add: `service.invoke('request_update');`.
    2. This forces the background isolate (which is already running) to immediately send its last known speed/road/status.
  </action>
  <verify>Navigate away from the Trip Dashboard to the Students screen and back. The location should stay visible/populated immediately.</verify>
  <done>Driver dashboard UI restores its state instantly upon resumption.</done>
</task>
