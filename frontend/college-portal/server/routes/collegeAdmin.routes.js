const express = require('express');
const router = express.Router();
const {
    createBus, getBuses, updateBus, deleteBus,
    createRoute, getRoutes, updateRoute, deleteRoute,
    createUser, getUsersByRole, updateUser, deleteUser, createBulkUsers,
    assignDriver, getAssignments, getTripHistory, updateTrip, deleteTrip, adminEndTrip
} = require('../controllers/collegeAdminController');
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
    .get(getAssignments);

// Trip History
router.get('/trips', getTripHistory);
router.route('/trips/:tripId')
    .put(updateTrip)
    .delete(deleteTrip);
router.post('/trips/:tripId/end', adminEndTrip);

module.exports = router;
