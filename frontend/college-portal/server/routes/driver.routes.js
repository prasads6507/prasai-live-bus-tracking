const express = require('express');
const router = express.Router();
const {
    getDriverBuses,
    searchDriverBuses,
    updateBusLocation,
    startTrip,
    endTrip,
    saveTripHistory,
    historyUpload,
    checkProximity
} = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// Protect all routes
router.use(protect);
router.use(authorize('DRIVER'));
router.use(tenantIsolation);

// Bus operations
router.get('/buses', getDriverBuses);
router.get('/buses/search', searchDriverBuses);
router.post('/tracking/:busId', updateBusLocation);

// Trip management
router.post('/trip/start/:busId', startTrip);
router.post('/trip/end/:busId', endTrip);
router.post('/trip/history/:busId', saveTripHistory);
router.post('/trips/:tripId/end', endTrip);
router.post('/trips/:tripId/history-upload', historyUpload);
router.post('/notifications/proximity', checkProximity);

module.exports = router;

