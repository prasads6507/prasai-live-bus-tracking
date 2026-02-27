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
    checkProximity,
    markPickup,
    markDropoff,
    getTripAttendance,
    getBusStudents
} = require('../controllers/driverController');
const { sendStopEventNotification, sendTripEndedNotification } = require('../controllers/notificationController');
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

// Attendance
router.post('/trips/:tripId/attendance/pickup', markPickup);
router.post('/trips/:tripId/attendance/dropoff', markDropoff);
router.get('/trips/:tripId/attendance', getTripAttendance);
router.get('/buses/:busId/students', getBusStudents);

// POST /api/driver/trip-started-notify
router.post('/trip-started-notify', async (req, res) => {
    try {
        const { tripId, busId, collegeId, busNumber, isMaintenance, originalBusId } = req.body;

        if (!tripId || !busId || !collegeId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const { sendBusStartedNotification } = require('../controllers/notificationController');

        // Fire and forget
        sendBusStartedNotification(
            tripId,
            busId,
            collegeId,
            busNumber || busId,
            !!isMaintenance,
            originalBusId || null
        ).catch(err => console.error('[TripStartedRoute] Error:', err.message));

        res.status(202).json({ success: true, message: 'Trip started notification queued' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/driver/stop-event (Step 5E)
router.post('/stop-event', async (req, res) => {
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

// POST /api/driver/trip-ended-notify
router.post('/trip-ended-notify', async (req, res) => {
    try {
        const { tripId, busId, collegeId } = req.body;

        if (!tripId || !busId || !collegeId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Fire and forget
        sendTripEndedNotification(tripId, busId, collegeId)
            .catch(err => console.error('[TripEndedRoute] Error:', err.message));

        res.status(202).json({ success: true, message: 'Trip ended notification queued' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

