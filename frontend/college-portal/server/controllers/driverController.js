const { db, admin } = require('../config/firebase');

// @desc    Get available buses for the driver's college
// @route   GET /api/driver/buses
// @access  Private (Driver)
const getDriverBuses = async (req, res) => {
    try {
        console.log('--- GET DRIVER BUSES ---');
        console.log('User:', req.user.email, 'Role:', req.user.role, 'Token CollegeId:', req.user.collegeId);
        console.log('Req CollegeId:', req.collegeId);

        const busesSnapshot = await db.collection('buses')
            .where('collegeId', '==', req.collegeId)
            .get();

        console.log(`Found ${busesSnapshot.size} buses for college ${req.collegeId}`);


        const buses = busesSnapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));

        res.status(200).json({
            success: true,
            count: buses.length,
            data: buses
        });
    } catch (error) {
        console.error('Error fetching driver buses:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update bus location and status
// @route   POST /api/driver/tracking/:busId
// @access  Private (Driver)
const updateBusLocation = async (req, res) => {
    try {
        const { busId } = req.params;
        const { latitude, longitude, speed, heading, status } = req.body;

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists || busDoc.data().collegeId !== req.collegeId) {
            return res.status(404).json({ success: false, message: 'Bus not found or unauthorized' });
        }

        // Update location and status
        await busRef.update({
            location: {
                latitude,
                longitude,
                heading: heading || 0
            },
            speed: speed || 0,
            status: status || 'ON_ROUTE',
            lastUpdated: new Date().toISOString(),
            currentDriverId: req.user.uid // Track who updated it
        });

        // Add to location history (optional, for playback later)
        // await db.collection('buses').doc(busId).collection('history').add({ ... });

        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating bus location:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getDriverBuses,
    updateBusLocation
};
