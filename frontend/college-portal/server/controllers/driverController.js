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
            .where('assignedDriverId', '==', req.user.id)
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

// @desc    Update bus location and status (real-time, every 5 seconds)
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
            currentDriverId: req.user.id // Fixed: token has .id, not .uid
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

        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating bus location:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Start a new trip
// @route   POST /api/driver/trip/start/:busId
// @access  Private (Driver)
const startTrip = async (req, res) => {
    try {
        const { busId } = req.params;
        const { tripId } = req.body;

        console.log(`--- START TRIP: ${tripId} for Bus ${busId} ---`);

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        const busData = busDoc.data();
        if (busData.collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized college access' });
        }

        // Fetch driver details to get name
        const userDoc = await db.collection('users').doc(req.user.id).get();
        const driverName = userDoc.exists ? userDoc.data().name : 'Unknown Driver';

        // Create trip document in ROOT trips collection (easier to browse in Firebase Console)
        const tripRef = db.collection('trips').doc(tripId);
        await tripRef.set({
            tripId,
            busId,
            busNumber: busData.busNumber || busData.number || 'Unknown',
            driverId: req.user.id,
            driverName: driverName,
            collegeId: req.collegeId,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'ACTIVE',
            totalPoints: 0
        });

        // Update bus with current trip info and driver name
        await busRef.update({
            currentTripId: tripId,
            status: 'ON_ROUTE',
            driverName: driverName,
            currentDriverId: req.user.id
        });

        console.log('Trip started successfully:', tripId);
        res.status(201).json({ success: true, message: 'Trip started', tripId });
    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    End current trip
// @route   POST /api/driver/trip/end/:busId
// @access  Private (Driver)
const endTrip = async (req, res) => {
    try {
        const { busId } = req.params;
        const { tripId } = req.body;

        console.log(`--- END TRIP: ${tripId} for Bus ${busId} ---`);

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        if (busDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized college access' });
        }

        // Update trip document in ROOT trips collection
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (tripDoc.exists) {
            const tripData = tripDoc.data();
            const startTime = new Date(tripData.startTime);
            const endTime = new Date();
            const durationMinutes = Math.round((endTime - startTime) / 60000);

            await tripRef.update({
                endTime: endTime.toISOString(),
                status: 'COMPLETED',
                durationMinutes
            });
        }

        // Update bus status
        await busRef.update({
            currentTripId: null,
            status: 'ACTIVE'
        });

        console.log('Trip ended successfully:', tripId);
        res.status(200).json({ success: true, message: 'Trip ended', tripId });
    } catch (error) {
        console.error('Error ending trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Save trip history point (every 1 minute)
// @route   POST /api/driver/trip/history/:busId
// @access  Private (Driver)
const saveTripHistory = async (req, res) => {
    try {
        const { busId } = req.params;
        const { tripId, latitude, longitude, speed, heading, timestamp } = req.body;

        console.log(`--- SAVE TRIP HISTORY: ${tripId} ---`);
        console.log('Location:', { latitude, longitude, speed, heading });

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        if (busDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized college access' });
        }

        // Save to trip history subcollection
        const tripRef = busRef.collection('trips').doc(tripId);
        const historyRef = tripRef.collection('history');

        await historyRef.add({
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            timestamp: timestamp || new Date().toISOString(),
            recordedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Increment total points counter
        await tripRef.update({
            totalPoints: admin.firestore.FieldValue.increment(1)
        });

        console.log('History point saved');
        res.status(201).json({ success: true, message: 'History saved' });
    } catch (error) {
        console.error('Error saving trip history:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getDriverBuses,
    updateBusLocation,
    startTrip,
    endTrip,
    saveTripHistory
};

