# Requirements: Attendance & Absence Fix

## Scoped Fixes
- [ ] **Attendance Isolation**: Guarantee that marking a student in pickup does not affect the drop-off list.
- [ ] **Absence Notifications**: Verify and fix the logic that sends "not boarded" alerts to students at trip end.
- [ ] **Firestore Rules**: Stabilize rules for `attendance` and `notifications` collections.
- [ ] **Session Management**: Explicitly clear all attendance-related cache at trip transition.
