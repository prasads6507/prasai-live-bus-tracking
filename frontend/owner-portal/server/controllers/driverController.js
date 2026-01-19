const { db } = require('../config/firebase');

// @desc    Start a trip
// @route   POST /api/driver/trip/start
// @access  Private (Driver)
const startTrip = async (req, res) => {
    const { busId, routeId } = req.body;

    try {
        // Check if active trip exists
        const tripsRef = db.collection('trips');
        const snapshot = await tripsRef
            .where('driverUserId', '==', req.user.id)
            .where('status', '==', 'RUNNING')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return res.status(400).json({ message: 'You already have an active trip' });
        }

        const newTrip = {
            collegeId: req.collegeId || 'unknown', // Middleware should set this
            busId,
            driverUserId: req.user.id,
            routeId,
            status: 'RUNNING',
            startTime: new Date().toISOString()
        };

        const docRef = await tripsRef.add(newTrip);

        res.status(201).json({ _id: docRef.id, ...newTrip });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    End a trip
// @route   POST /api/driver/trip/end
// @access  Private (Driver)
const endTrip = async (req, res) => {
    const { tripId } = req.body;

    try {
        const tripRef = db.collection('trips').doc(tripId);
        const doc = await tripRef.get();

        if (doc.exists && doc.data().driverUserId === req.user.id) {
            await tripRef.update({
                status: 'ENDED',
                endTime: new Date().toISOString()
            });
            const updated = await tripRef.get();
            res.json({ _id: updated.id, ...updated.data() });
        } else {
            res.status(404).json({ message: 'Trip not found or unauthorized' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send SOS
// @route   POST /api/driver/trip/sos
// @access  Private (Driver)
const sendSOS = async (req, res) => {
    const { busId, location, message } = req.body;

    try {
        const alert = {
            collegeId: req.collegeId || 'unknown',
            type: 'SOS',
            busId,
            message,
            location,
            timestamp: new Date().toISOString()
        };

        // Write directly to 'alerts' collection
        // Frontend must "listen" to this collection for updates
        const docRef = await db.collection('alerts').add(alert);

        res.status(201).json({ _id: docRef.id, ...alert });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update live location
// @route   POST /api/driver/location
// @access  Private (Driver)
const updateLocation = async (req, res) => {
    const { busId, latitude, longitude, speed, heading } = req.body;

    try {
        const locationData = {
            busId,
            collegeId: req.collegeId || 'unknown',
            driverUserId: req.user.id,
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            lastUpdatedAt: new Date().toISOString()
        };

        // We use busId as doc ID for latest location lookup
        await db.collection('live_locations').doc(busId).set(locationData);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { startTrip, endTrip, sendSOS, updateLocation };
