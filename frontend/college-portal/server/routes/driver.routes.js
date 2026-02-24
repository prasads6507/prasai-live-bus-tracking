const express = require('express');
const router = express.Router();
const {
    getDriverBuses,
    searchDriverBuses,
    updateBusLocation,
    startTrip,
    endTrip,
    historyUpload,
    checkProximity
} = require('../controllers/driverController');
const { sendStopEventNotification } = require('../controllers/notificationController');
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

// POST /api/driver/stop-event (Step 5E)
router.post('/stop-event', authenticate, async (req, res) => {
    try {
        const { tripId, busId, collegeId, stopId, stopName, stopAddress, type, arrivalDocId } = req.body;

        if (!tripId || !busId || !collegeId || !stopId || !type) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!['ARRIVING', 'ARRIVED', 'SKIPPED'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid type' });
        }

        // Fire and forget — respond immediately, process in background
        sendStopEventNotification(tripId, busId, collegeId, stopId, stopName || '', stopAddress || '', type, arrivalDocId || null)
            .catch(err => console.error('[StopEvent Route] Async error:', err.message));

        res.status(202).json({ success: true, message: 'Stop event accepted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

