# Phase 2 Plan: Bulk Delete Attendance

<task type="auto">
  <name>Backend: Implement Bulk Delete Attendance Endpoint</name>
  <files>
    frontend/college-portal/server/routes/collegeAdmin.routes.js,
    frontend/college-portal/server/controllers/collegeAdminController.js
  </files>
  <action>
    1. Update `collegeAdmin.routes.js` to include `router.delete('/attendance', collegeAdminController.bulkDeleteAttendance)`.
    2. Update `collegeAdminController.js` to implement `bulkDeleteAttendance`:
       - Extract `attendanceIds` from `req.body`.
       - Validate requested IDs belong to the admin's `collegeId`.
       - Use Firestore `WriteBatch` to delete records.
       - Return success response.
  </action>
  <verify>
    Create a temporary test script to call the endpoint with mock IDs and verify Firestore deletion.
  </verify>
  <done>
    Endpoint added and verified to delete records in Firestore while respecting tenant isolation.
  </done>
</task>

<task type="auto">
  <name>Frontend: Update API Service</name>
  <files>
    frontend/college-portal/src/services/api.ts
  </files>
  <action>
    Add `bulkDeleteAttendance` function to `api.ts`:
    ```typescript
    export const bulkDeleteAttendance = async (attendanceIds: string[]) => {
        const response = await api.delete('/admin/attendance', { data: { attendanceIds } });
        return response.data;
    };
    ```
  </action>
  <verify>
    Check if the function is exported and correctly formatted.
  </verify>
  <done>
    `bulkDeleteAttendance` available in API service.
  </done>
</task>

<task type="auto">
  <name>Frontend: Implement Selection UI in BusAttendance</name>
  <files>
    frontend/college-portal/src/pages/BusAttendance.tsx
  </files>
  <action>
    1. Add `selectedIds` state (Set or Array).
    2. Add Checkbox column to the table in Detail View.
    3. Implement "Select All" functionality in the header.
    4. Ensure checkboxes match the existing UI theme.
  </action>
  <verify>
    Manually check if checkboxes allow multi-selection and "Select All" works.
  </verify>
  <done>
    User can select multiple attendance records in the UI.
  </done>
</task>

<task type="auto">
  <name>Frontend: Implement Bulk Delete Action</name>
  <files>
    frontend/college-portal/src/pages/BusAttendance.tsx
  </files>
  <action>
    1. Add "Delete Selected" button to the header (visible when `selectedIds.length > 0`).
    2. Implement `handleBulkDelete`:
       - Show confirmation dialog.
       - Call `bulkDeleteAttendance` API.
       - Refresh data on success.
       - Clear selection.
       - Show toast notification (if toast system exists).
  </action>
  <verify>
    Perform a bulk delete and verify records are removed from the list after refresh.
  </verify>
  <done>
    Selected attendance records are deleted and UI updates accordingly.
  </done>
</task>
