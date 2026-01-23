const express = require('express');
const router = express.Router();
const {
    getDriverBuses,
    updateBusLocation,
    startTrip,
    endTrip,
    saveTripHistory
} = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// Protect all routes
router.use(protect);
router.use(authorize('DRIVER'));
router.use(tenantIsolation);

// Bus operations
router.get('/buses', getDriverBuses);
router.post('/tracking/:busId', updateBusLocation);

// Trip management
router.post('/trip/start/:busId', startTrip);
router.post('/trip/end/:busId', endTrip);
router.post('/trip/history/:busId', saveTripHistory);

module.exports = router;

