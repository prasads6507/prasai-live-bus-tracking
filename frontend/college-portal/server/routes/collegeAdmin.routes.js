const express = require('express');
const router = express.Router();
const {
    createBus, getBuses, updateBus, deleteBus,
    createRoute, getRoutes, updateRoute, deleteRoute,
    createUser, getUsersByRole, updateUser, deleteUser, createBulkUsers,
    assignDriver, getAssignments, getTripHistory, updateTrip, deleteTrip, bulkDeleteTrips, adminEndTrip, getTripPath,
    getCollegeAdmins, createCollegeAdmin, updateCollegeAdmin, deleteCollegeAdmin
} = require('../controllers/collegeAdminController');
const {
    uploadRoutesFile,
    downloadTemplate,
    createBulkRoutesJson
} = require('../controllers/bulkRouteController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// All routes protected + college admin/owner + tenant isolation
router.use(protect);
router.use(authorize('COLLEGE_ADMIN', 'OWNER', 'SUPER_ADMIN'));
router.use(tenantIsolation); // Enforces req.collegeId

router.route('/buses')
    .post(createBus)
    .get(getBuses);

router.route('/buses/:busId')
    .put(updateBus)
    .delete(deleteBus);

router.route('/routes')
    .post(createRoute)
    .get(getRoutes);

router.post('/routes/bulk-json', createBulkRoutesJson);

router.route('/routes/:routeId')
    .put(updateRoute)
    .delete(deleteRoute);

router.route('/users')
    .post(createUser);

router.post('/users/bulk', createBulkUsers);

router.route('/users/:role')
    .get(getUsersByRole);

router.route('/users/:userId')
    .put(updateUser)
    .delete(deleteUser);

router.route('/assignments')
    .post(assignDriver)
    .get(getAssignments);// Trip History
router.get('/trips', getTripHistory);
router.delete('/trips', bulkDeleteTrips);
router.put('/trips/:tripId', updateTrip);
router.delete('/trips/:tripId', deleteTrip);
router.post('/trips/:tripId/end', adminEndTrip);
router.get('/trips/:tripId/path', getTripPath);

// Student Routes
const {
    createStudent,
    getStudents,
    updateStudent,
    deleteStudent,
    createBulkStudents,
    resetStudentPassword
} = require('../controllers/studentController');

router.route('/students')
    .post(createStudent)
    .get(getStudents);
router.post('/students/bulk-json', createBulkStudents);
router.route('/students/:id')
    .put(updateStudent)
    .delete(deleteStudent);

router.put('/students/:id/reset-password', resetStudentPassword);

// College Admin Management (Super Admin / Owner only)
router.route('/college-admins')
    .get(getCollegeAdmins)
    .post(createCollegeAdmin);

router.route('/college-admins/:userId')
    .put(updateCollegeAdmin)
    .delete(deleteCollegeAdmin);

module.exports = router;
