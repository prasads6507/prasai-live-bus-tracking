# Phase 4 Context: Skip & Attendance Reliability

## Problem Breakdown

### 1. Skip UI Delay
The driver trip dashboard doesn't immediately show the "Next Stop" and "Skip" button after clicking "Start Trip". The user has to leave the screen and return to see the update. This is likely because the UI state (`_nextStopId`, `_nextStopName`) is only populated upon screen entry or specific background updates that weren't being correctly listened to or emitted during the initialization phase.

### 2. Skip Reliability & Stale State
The skip functionality sometimes fails because it relies on the UI's `_nextStopId`, which can be stale or missing in the background payload.
- **Fix**: The background payload must include `nextStopId`.
- **Optimization**: The skip handler should fetch the latest trip state from Firestore to identify the *actual* current stop to skip, rather than relying on the UI's state.

### 3. Attendance Data Collision
Pickup and Drop-off attendance are sharing state (locks and local caches).
- **Issue**: A student marked in the morning might appear locked or already marked in the evening.
- **Fix**:
    - Clear local state (`_lockedIds`, etc.) when the trip/direction changes.
    - Use a direction-aware cache key (`shared_attendance_${tripId}_${direction}`).
    - Pass the direction parameter to the backend via `getTodayAttendance`.

### 4. Delayed Parent Notifications
Attendance notifications for parents should be instant.
- **Fix**: Trigger the notification immediately upon marking a student as attended in the `driver_students_screen.dart`.

## Technical Constraints
- Must use `FlutterBackgroundService` for tracking state.
- Must maintain battery efficiency.
- Must respect the existing Riverpod/GoRouter architecture.

## Decisions
- **Source of Truth**: Firestore will be the final authority for the "Current Stop" during the skip flow to mitigate race conditions or stale UI.
- **Cache Strategy**: Directional partitioning of the local attendance cache.
- **FCM**: Immediate fire-and-forget push notifications for individual student attendance.
