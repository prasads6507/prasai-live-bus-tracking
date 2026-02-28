# Phase 2 Context: Bulk Delete Attendance

## User Requirements
- Admin needs to be able to delete multiple attendance records at once from the Bus Attendance page.
- This helps in cleaning up accidental or incorrect attendance markings.

## UI/UX Decisions
- **Page**: `BusAttendance.tsx` (Detail View).
- **Selection**: Add a checkbox column to the attendance table.
- **Actions**: A "Delete Selected" button should appear when one or more rows are selected.
- **Confirmation**: Show a confirmation dialog before deleting.
- **Visuals**: Use the existing theme (blue/slate/emerald/rose) and Lucide icons (Trash2).

## API Design
- **Endpoint**: `DELETE /admin/attendance`
- **Body**: `{ attendanceIds: string[] }`
- **Response**: `{ success: true, count: number }`
- **Tenant Isolation**: Must verify that all `attendanceIds` belong to the same `collegeId` of the requesting admin.

## Edge Cases
- No items selected: Button hidden.
- Network failure: Show error toast and keep selection.
- Partial success: Should be atomic (delete all or none) to avoid confusion, or reporting which ones failed. Firestore `WriteBatch` or individual deletes in a loop (depending on scale). Given Firestore, a batch is preferred for atomicity.
