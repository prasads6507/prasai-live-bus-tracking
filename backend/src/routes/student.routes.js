const express = require('express');
const router = express.Router();
const { getMyBus, getLiveLocation } = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

router.use(protect);
router.use(authorize('STUDENT'));
router.use(tenantIsolation);

router.get('/my-bus', getMyBus);
router.get('/live-location', getLiveLocation);

module.exports = router;
