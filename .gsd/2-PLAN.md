# Phase 2 Plan: Implementation & Force Update

<task type="auto">
  <name>Fix Token Management in Background Service</name>
  <files>mobile/lib/features/driver/services/background_tracking_service.dart</files>
  <action>
    - Update `_notifyServer` to fetch a fresh Firebase ID Token using `FirebaseAuth.instance.currentUser?.getIdToken()`.
    - Ensure `Dio` options include the `Authorization` header with the Bearer token.
    - Restore robust error logging for `DioException`.
  </action>
  <verify>Check logs for "[NotifyServer] success" and ensure no 401 Unauthorized errors.</verify>
  <done>`_notifyServer` successfully sends requests with a valid ID Token.</done>
</task>

<task type="auto">
  <name>Restore Notification Logic for Skip and Trip End</name>
  <files>mobile/lib/features/driver/services/background_tracking_service.dart</files>
  <action>
    - In `_handleManualSkip`, ensure `_notifyServer` is called with type `SKIPPED`.
    - In `_handleStopCompletion` (auto-end block), ensure `_notifyServer` is called with type `TRIP_ENDED`.
    - Verify that `stopName` is correctly passed to `_notifyServer` for all event types.
  </action>
  <verify>Trigger manual skip and trip end; check Firestore `stopArrivals` and server logs for corresponding events.</verify>
  <done>All stop events trigger server notifications with correct data.</done>
</task>

<task type="auto">
  <name>Update Firestore Rules</name>
  <files>firestore.rules</files>
  <action>
    - Review `firestore.rules` to ensure `stopArrivals` allows writes from authenticated users (drivers).
    - Ensure `trips` and `buses` collections have appropriate write permissions for drivers.
  </action>
  <verify>`firebase deploy --only firestore:rules` (user command) or manual validation.</verify>
  <done>Firestore rules are correct and allow necessary mobile operations.</done>
</task>

<task type="manual">
  <name>Force Update Firebase and Verify</name>
  <files>N/A</files>
  <action>
    - User needs to run `firebase deploy` if they have sensitive config.
    - Verify end-to-end notification flow from mobile driver app to student app.
  </action>
  <verify>User manual verification.</verify>
  <done>System is synchronized and notifications are working as expected.</done>
</task>
