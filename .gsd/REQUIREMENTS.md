# Requirements: Notification System Fix

## Scoped Fixes
- [x] **Fix Token Management**: Revert to `getIdToken()` in `_notifyServer`.
- [x] **Restore Notification Logic**: Ensure `SKIPPED`, `ARRIVED`, and `TRIP_ENDED` events are correctly triggered.
- [x] **Update Firebase Rules**: Review and tighten `firestore.rules` for notifications and trips.
- [x] **Force Update Firebase**: Deploy updated rules and verify backend functions/API.
- [x] **Manual Skip UX**: Ensure the manually triggered skip stop correctly updates Firestore and sends notifications.

## Build Requirements
- [ ] **Release APK**: Generate a signed (or release-intent) APK for distribution.
- [ ] **Code Persistence**: Push all stable changes to the remote repository.

## Out of Scope (For Now)
- [ ] Parent-to-Driver direct chat.
- [ ] Payment integration for bus fees.
