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

        console.log(`--- UPDATE BUS LOCATION: ${busId} ---`);
        console.log('Payload:', { latitude, longitude, speed, heading, status });
        console.log('CollegeId:', req.collegeId);

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            console.log('Bus not found');
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        if (busDoc.data().collegeId !== req.collegeId) {
            console.log('Unauthorized college access:', busDoc.data().collegeId, 'vs', req.collegeId);
            return res.status(403).json({ success: false, message: 'Unauthorized college access' });
        }

        // Update location and status
        const updateData = {
            lastUpdated: new Date().toISOString(),
            currentDriverId: req.user.uid
        };

        if (status) updateData.status = status;
        if (speed !== undefined) updateData.speed = speed;

        // Only update location object if coordinates are actually provided
        if (latitude !== undefined && longitude !== undefined) {
            updateData.location = {
                latitude,
                longitude,
                heading: heading || 0
            };
        } else {
            console.log('No coordinates provided, skipping location update');
        }

        console.log('Updating Firestore with:', updateData);
        await busRef.update(updateData);

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
