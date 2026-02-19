const { db, admin } = require('../config/firebase');
const { sendBusStartedNotification, checkProximityAndNotify } = require('./notificationController');

// @desc    Get available buses for the driver's college
// @route   GET /api/driver/buses
// @access  Private (Driver)
// Helper to populate route names
const populateBusRoutes = async (buses) => {
    try {
        const routeIds = [...new Set(buses.filter(b => b.assignedRouteId).map(b => b.assignedRouteId))];
        if (routeIds.length === 0) return buses;

        const routesSnapshot = await db.collection('routes').where(admin.firestore.FieldPath.documentId(), 'in', routeIds).get();
        const routesMap = {};
        routesSnapshot.docs.forEach(doc => {
            routesMap[doc.id] = doc.data().routeName || doc.data().route_name || doc.data().name || 'Unknown Route';
        });

        return buses.map(bus => ({
            ...bus,
            routeName: bus.assignedRouteId ? (routesMap[bus.assignedRouteId] || 'No Route Details') : 'No Route Assigned'
        }));
    } catch (error) {
        console.error("Error populating routes:", error);
        return buses; // Return raw data on failure
    }
};

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

        let buses = busesSnapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));

        // Populate Route Names
        buses = await populateBusRoutes(buses);

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

// @desc    Search ALL buses in college (Global Search)
// @route   GET /api/driver/buses/search
// @access  Private (Driver)
const searchDriverBuses = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query required' });

        console.log(`--- SEARCH DRIVER BUSES: ${q} ---`);

        // Note: Firestore doesn't support native partial text search strings easily.
        // We will fetch all buses for the college (usually manageable size) and filter in memory,
        // OR use a specific "busNumber" match if possible.
        // For better experience, we'll fetch all and filter since bus fleets are usually < 100.

        const busesSnapshot = await db.collection('buses')
            .where('collegeId', '==', req.collegeId)
            .get();

        let buses = busesSnapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));

        // Filter by bus number (case insensitive partial match)
        const query = q.toLowerCase();
        buses = buses.filter(bus =>
            (bus.busNumber && bus.busNumber.toLowerCase().includes(query)) ||
            (bus.number && bus.number.toString().toLowerCase().includes(query))
        );

        // Populate Route Names
        buses = await populateBusRoutes(buses);

        res.status(200).json({
            success: true,
            count: buses.length,
            data: buses
        });

    } catch (error) {
        console.error('Error searching buses:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update bus location and status (real-time, every 5 seconds)
// @route   POST /api/driver/tracking/:busId
// @access  Private (Driver)
const updateBusLocation = async (req, res) => {
    try {
        const { busId } = req.params;
        const { latitude, longitude, speed, heading } = req.body;
        // NOTE: We IGNORE client-provided 'status' to prevent ghost-live issues.

        // Verify bus exists and belongs to college
        const busRef = db.collection('buses').doc(busId);

        // We need to fetch the bus to check activeTripId
        const busDoc = await busRef.get();
        if (!busDoc.exists) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }
        const busData = busDoc.data();

        // Determine True Status based on activeTripId
        // If activeTripId exists, it's ON_ROUTE. Otherwise IDLE (or MAINTENANCE if set previously, but here we assume tracking = active)
        // Actually, if tracking is sending updates, we might want to allow MAINTENCE updates?
        // But for "Live" status, we strictly check activeTripId.
        const isActiveTrip = !!busData.activeTripId;
        const newStatus = isActiveTrip ? 'ON_ROUTE' : 'IDLE';

        const updateData = {
            lastUpdated: new Date().toISOString(),
            currentDriverId: req.user.id,
            status: newStatus, // Enforce server-side status
            lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp() // Critical for freshness check
        };

        if (speed !== undefined) updateData.speed = speed;

        // Only update location object if coordinates are actually provided
        if (latitude !== undefined && longitude !== undefined) {
            const newPoint = {
                latitude,
                longitude,
                heading: heading || 0,
                speed: speed || 0,
                timestamp: new Date().toISOString()
            };

            updateData.location = {
                latitude,
                longitude,
                heading: heading || 0
            };

            // Phase 13: Live Tracking Buffer (5 points)
            updateData.liveTrackBuffer = admin.firestore.FieldValue.arrayUnion(newPoint);
        }

        // Apply Update
        await busRef.update(updateData);

        // Maintain Buffer Size (Keep last 5)
        if (latitude !== undefined) {
            // We already fetched busDoc, but arrayUnion happens on server. 
            // Valid to check length on next read or just let it grow slightly?
            // To be safe and strict:
            const currentBuffer = busData.liveTrackBuffer || [];
            if (currentBuffer.length > 5) {
                const newBuffer = currentBuffer.slice(-5);
                await busRef.update({ liveTrackBuffer: newBuffer });
            }
        }

        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating bus location:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    End a trip (Atomic Update)
// @route   POST /api/driver/trips/:tripId/end
// @access  Private (Driver)
const endTrip = async (req, res) => {
    const { tripId } = req.params;
    const { busId } = req.body;

    console.log(`--- END TRIP: ${tripId} (Bus: ${busId}) ---`);

    if (!busId) return res.status(400).json({ success: false, message: 'Bus ID required' });

    try {
        const batch = db.batch();

        const tripRef = db.collection('trips').doc(tripId);
        const busRef = db.collection('buses').doc(busId);

        // 1. Update Trip Status
        batch.update(tripRef, {
            status: 'ended',
            endTime: new Date().toISOString(),
            isActive: false
        });

        // 2. Update Bus Status (Canonical State)
        batch.update(busRef, {
            status: 'IDLE',
            activeTripId: null,
            currentRouteId: null,
            liveTrail: [], // Clear legacy trail
            liveTrackBuffer: [], // Clear new buffer
            lastUpdated: new Date().toISOString()
        });

        await batch.commit();
        console.log('Trip ended atomically.');

        res.status(200).json({ success: true, message: 'Trip ended successfully' });
    } catch (error) {
        console.error('Error ending trip:', error);
        res.status(500).json({ success: false, message: 'Failed to end trip', error: error.message });
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

        // Use a Batch for Atomic Operations
        const batch = db.batch();
        const tripRef = db.collection('trips').doc(tripId);

        // 1. Create Trip Doc
        batch.set(tripRef, {
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

        // 2. Update Bus Doc (Canonical Source of Truth)
        batch.update(busRef, {
            activeTripId: tripId, // Canonically set active trip
            currentTripId: tripId, // Keep for legacy compatibility if needed
            status: 'ON_ROUTE',
            driverName: driverName,
            currentDriverId: req.user.id,
            lastUpdated: new Date().toISOString()
        });

        await batch.commit();

        console.log('Trip started atomically:', tripId);

        // Send 'Bus Started' Notification (Phase 4.2)
        // Fire and forget - don't await/block response
        sendBusStartedNotification(tripId, busId, req.collegeId, busData.assignedRouteId)
            .catch(err => console.error('Failed to send bus start notification:', err));

        res.status(201).json({ success: true, message: 'Trip started', tripId });
    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    End current trip
// @route   POST /api/driver/trip/end/:busId
// @access  Private (Driver)


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

        // Save to trip history in ROOT trips collection
        const tripRef = db.collection('trips').doc(tripId);
        const historyRef = tripRef.collection('history');

        // Check if trip exists in root (optional but good for consistency)
        // We trust tripId is valid from client state, but could verify ownership here if needed.
        // For performance, we skip a read unless strictly necessary, 
        // but we should ensure we are not writing to a dead trip. 
        // Actually, let's just write. Firestore handles loose collections fine.

        await historyRef.add({
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            timestamp: timestamp || new Date().toISOString(),
            recordedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Increment total points counter on the root trip doc
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

// @desc    Trigger proximity check (Phase 4.3)
// @route   POST /api/driver/notifications/proximity
// @access  Private (Driver)
const checkProximity = async (req, res) => {
    try {
        const { busId, location, tripId, routeId } = req.body;
        // console.log('Checking proximity for bus:', busId); 

        // Fire and forget
        checkProximityAndNotify(busId, location, req.collegeId, routeId)
            .catch(console.error);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error checking proximity:', error);
        res.status(500).json({ success: false });
    }
};

module.exports = {
    getDriverBuses,
    searchDriverBuses,
    updateBusLocation,
    startTrip,
    endTrip,
    saveTripHistory,
    checkProximity
};

