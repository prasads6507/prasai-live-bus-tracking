# Roadmap: Bannu Bus Application

## Phase 1: Stabilization & Bug Extraction (Completed)
- **Goal**: Resolve all high-priority UX gaps and notification latencies.
- **Tasks**:
  - [x] Fix 20s notification delay.
  - [x] Fix Android 16 background service crashes.
  - [x] **Fix Driver Dashboard metrics reset**.
  - [x] **Implement Instant Boarding Notifications for parents**.
  - [x] Optimize Student Tracking screen stops list.

## Phase 1.1: Notification Refinement (Completed)
- **Goal**: Consolidate alerts and ensure instant boarding notifications.
- **Tasks**:
  - [x] Consolidate trip-end alerts in `sendTripEndedNotification`.
  - [x] Remove redundant alerts from `historyUpload`.
  - [x] Ensure backend reliability on Vercel (Await FCM).

## Phase 1.2: Manual Skip Stop (Completed)
- **Goal**: Transition from automatic to manual driver-controlled stop skipping.
- **Tasks**:
  - [x] Disable automatic skip logic in background service.
  - [x] Implement manual 'skip_stop' isolate event.
  - [x] Add "Next Stop" UI card with manual Skip button.
  - [x] Implement confirmation dialog for skipping.

## Phase 2: Analytics & Reporting
- **Goal**: Provide admins with actionable data from the tracks and attendance.
- **Tasks**:
  - [ ] Implement Backend Trip Report generation.
  - [ ] Create Frontend Dashboard visualizations.
  - [ ] Export student attendance logs to Excel.
  - [x] Implement Bulk Delete for Attendance Records in Admin Portal.
  - [x] Implement Attendance Persistence for Drivers (Trip Restart Logic).

## Phase 3: UI Polishing & Optimization
- **Goal**: Full transition to the "Deep Midnight Glassmorphism" theme.
- **Tasks**:
  - [ ] Update remaining mobile widgets to the new theme.
  - [ ] Optimize map rendering for low-end devices.
