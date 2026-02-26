const express = require('express');
const router = express.Router();
const {
    createCollege,
    getColleges,
    updateCollegeStatus,
    createCollegeAdmin,
    updateCollegeAdmin,
    deleteCollege,
    deleteCollegeAdmin,
    getCollegeAdmins,
    getAnalytics,
    getDashboardStats,
    testDb
} = require('../controllers/ownerController');
const {
    getUsageOverview,
    getUsageCost
} = require('../controllers/firebaseUsageController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and restricted to OWNER
router.use(protect);
router.use(authorize('OWNER'));

router.route('/colleges')
    .post(createCollege)
    .get(getColleges);

router.route('/colleges/:id/status').put(updateCollegeStatus);
router.route('/colleges/:id').delete(deleteCollege);
router.route('/college-admins').post(createCollegeAdmin).get(getCollegeAdmins);
router.route('/college-admins/:id').put(updateCollegeAdmin).delete(deleteCollegeAdmin);
router.route('/analytics').get(getAnalytics);
router.route('/dashboard-stats').get(getDashboardStats);
router.route('/firebase-usage/overview').get(getUsageOverview);
router.route('/firebase-usage/cost').get(getUsageCost);
router.route('/test-db').get(testDb);

module.exports = router;
