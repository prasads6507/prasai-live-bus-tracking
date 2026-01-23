const express = require('express');
const router = express.Router();
const { getDriverBuses, updateBusLocation } = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// Protect all routes
router.use(protect);
router.use(authorize('DRIVER'));
router.use(tenantIsolation);

router.get('/buses', getDriverBuses);
router.post('/tracking/:busId', updateBusLocation);

module.exports = router;
