const { db } = require('../config/firebase');

// @desc    Get assigned bus info
// @route   GET /api/student/my-bus
// @access  Private (Student)
const getMyBus = async (req, res) => {
    try {
        // Query Assignment
        const assignSnap = await db.collection('assignments')
            .where('userId', '==', req.user.id)
            .limit(1)
            .get();

        if (assignSnap.empty) {
            return res.status(404).json({ message: 'No bus assigned' });
        }

        const assignment = assignSnap.docs[0].data();

        // Query Bus
        // Assumes busId is a field in Bus document, OR Bus document ID is busId.
        // Let's assume busId field for safety based on previous schema
        const busSnap = await db.collection('buses')
            .where('busId', '==', assignment.busId)
            .limit(1)
            .get();

        const bus = !busSnap.empty ? busSnap.docs[0].data() : null;

        res.json({ assignment, bus });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get live location of assigned bus
// @route   GET /api/student/live-location
// @access  Private (Student)
const getLiveLocation = async (req, res) => {
    const { busId } = req.query;
    try {
        if (!busId) {
            return res.status(400).json({ message: 'Bus ID is required' });
        }

        const doc = await db.collection('live_locations').doc(busId).get();

        if (!doc.exists) {
            return res.json({ message: 'No live data' });
        }

        res.json(doc.data());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMyBus, getLiveLocation };
