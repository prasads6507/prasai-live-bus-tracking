const express = require('express');
const router = express.Router();
const { getRelayToken } = require('../controllers/relayTokenController');
const { protect } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// All relay routes require authentication + tenant isolation
router.use(protect);
router.use(tenantIsolation);

// Mint relay token
router.post('/token', getRelayToken);

module.exports = router;
