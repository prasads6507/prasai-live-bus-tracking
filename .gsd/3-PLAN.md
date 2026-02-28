# Plan: Attendance Persistence for Drivers

<task>
    <id>backend_persistence_endpoint</id>
    <description>Implement backend endpoint to fetch today's attendance for a bus</description>
    <files>
        <file>frontend/college-portal/server/controllers/driverController.js</file>
        <file>frontend/college-portal/server/routes/driver.routes.js</file>
    </files>
    <steps>
        <step>Add `getTodayAttendance` function in `driverController.js`</step>
        <step>Add `GET /buses/:busId/attendance/today` route in `driver.routes.js`</step>
    </steps>
</task>

<task>
    <id>mobile_api_update</id>
    <description>Add today's attendance fetch methodology to Mobile API DataSource</description>
    <files>
        <file>mobile/lib/data/datasources/api_ds.dart</file>
    </files>
    <steps>
        <step>Implement `getTodayAttendance` method in `ApiDataSource`</step>
    </steps>
</task>

<task>
    <id>mobile_ui_persistence</id>
    <description>Sync attendance state in DriverStudentsScreen on load</description>
    <files>
        <file>mobile/lib/features/driver/screens/driver_students_screen.dart</file>
    </files>
    <steps>
        <step>Update `_loadLocalAttendance` to also fetch from API if trip is active</step>
        <step>Merge API results into `_localAttendedIds`</step>
    </steps>
</task>
