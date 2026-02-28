# Context: Attendance Persistence for Drivers

## Problem
Drivers sometimes end a trip by mistake. When they start a new trip, the `tripId` changes. Since attendance records in Firestore are currently keyed by `tripId__studentId`, all "ticks" (marked students) from the previous (mistakenly ended) trip are lost in the UI of the new trip.

## Requirements
1.  **Persistence**: If a driver restarts a trip on the same day, previously marked students should remain marked.
2.  **Daily Reset**: Attendance must reset every day (fresh start).
3.  **Direction Awareness**: Persistence should respect the trip direction (pickup vs. dropoff).

## Technical Decisions

### Backend Changes
-   **New Endpoint**: `GET /api/driver/buses/:busId/attendance/today?direction=...`
    -   Queries the `attendance` collection for records matching `busId`, `direction`, `collegeId`, and today's date.
    -   Returns a list of `studentId`s that are already marked.
-   **Controller Logic**:
    -   Use `startOfDay` and `endOfDay` for the date filter.
    -   Ensure only 'picked_up' or 'dropped_off' statuses are considered for persistence (ignore 'not_boarded' if we want to allow re-marking).

### Mobile Changes
-   **Data Sync**: When `DriverStudentsScreen` loads with an active trip, it should fetch "today's attendance" for the current bus and direction.
-   **State Initialization**: Merge the fetched IDs into the `_localAttendedIds` set.
-   **Optimistic UI**: Continue using `SharedPreferences` as a secondary safety net, but prioritize the DB as the source of truth for persistence across devices or app restarts.

## Edge Cases
-   **Day Change**: Drivers starting a trip after midnight will naturally get 0 results because the date query will be for the new day.
-   **Multiple Trips**: If a driver completes a legitimate morning trip and then starts an afternoon trip (different direction), the direction filter ensures they don't see morning pick-up ticks in the afternoon drop-off list.
