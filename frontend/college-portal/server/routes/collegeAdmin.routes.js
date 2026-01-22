const express = require('express');
const router = express.Router();
const {
    createBus, getBuses,
    createRoute, getRoutes,
    createUser, getUsersByRole, updateUser, deleteUser,
    assignDriver, getAssignments
} = require('../controllers/collegeAdminController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// All routes protected + college admin/owner + tenant isolation
router.use(protect);
router.use(authorize('COLLEGE_ADMIN', 'OWNER'));
router.use(tenantIsolation); // Enforces req.collegeId

router.route('/buses')
    .post(createBus)
    .get(getBuses);

router.route('/routes')
    .post(createRoute)
    .get(getRoutes);

router.route('/users')
    .post(createUser);

router.route('/users/:role')
    .get(getUsersByRole);

router.route('/users/:userId')
    .put(updateUser)
    .delete(deleteUser);

router.route('/assignments')
    .post(assignDriver)
    .get(getAssignments);

module.exports = router;
