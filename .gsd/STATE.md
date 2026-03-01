# Project State: Bannu Bus Application

## Position
## Position
- **Current Phase**: Phase 5 (Attendance Isolation)
- **Status**: Completed Phase 5 to resolve attendance carry-over issues by clearing the SharedPreferences cache at the start of each trip session. Phase 1-4 are stable.

## Decisions
- **FCM Strategy**: Use `sendEachForMulticast` with decoupled token cleanup for maximum speed.
- **Tracking**: `FlutterBackgroundService` is the primary driver for persistence.

## Current Blockers
- None. Ready for next phase of development.
