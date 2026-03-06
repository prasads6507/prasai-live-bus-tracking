# Roadmap: Attendance & Absence Fix

## Phase 1: Context Gathering (Completed)
- [x] Analyze `driver_students_screen` caching logic.
- [x] Analyze `TrackingLifecycleManager` session resets.
- [x] Review `firestore.rules`.

## Phase 2: Implementation (Active)
- [ ] Implement robust `shared_attendance_*` cache clearing.
- [ ] Update `firestore.rules` for attendance and notifications.
- [ ] Verify absence notification payload in `ApiDataSource`.

## Phase 3: Deployment & Verification
- [ ] Redeploy Firestore rules.
- [ ] Perform end-to-end verification of attendance isolation.
- [ ] Verify "Bus not boarded" notifications.
