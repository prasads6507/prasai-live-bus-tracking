const express = require('express');
const router = express.Router();
const { startTrip, endTrip, sendSOS, updateLocation } = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

router.use(protect);
router.use(authorize('DRIVER'));
router.use(tenantIsolation);

router.post('/trip/start', startTrip);
router.post('/trip/end', endTrip);
router.post('/sos', sendSOS);
router.post('/location', updateLocation);

module.exports = router;
