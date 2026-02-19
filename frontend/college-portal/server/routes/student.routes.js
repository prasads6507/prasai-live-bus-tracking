const express = require('express');
const router = express.Router();
const { getMyBus, getLiveLocation, getStudentBuses } = require('../controllers/studentController');
const { getTripHistory, getTripPath, getRoutes } = require('../controllers/collegeAdminController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

router.use(protect);
router.use(authorize('STUDENT'));
router.use(tenantIsolation);

router.get('/my-bus', getMyBus);
router.get('/live-location', getLiveLocation);
router.get('/buses', getStudentBuses);

// Trip History for students
router.get('/trips', getTripHistory);
router.get('/trips/:tripId/path', getTripPath);
router.get('/routes', getRoutes);

module.exports = router;
