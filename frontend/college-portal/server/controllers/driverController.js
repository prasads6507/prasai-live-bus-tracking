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

        const busRef = db.collection('buses').doc(busId);

        await db.runTransaction(async (transaction) => {
            const busDoc = await transaction.get(busRef);
            if (!busDoc.exists) {
                console.warn(`[GPS MISMATCH] Tracking endpoint busId: ${busId} not found in Firestore.`);
                throw new Error('Bus not found');
            }

            // SMOKING GUN LOG FOR PROBLEM 2!
            console.log(`[GPS CHECK] Endpoint busId: ${busId} | Firestore doc.id: ${busDoc.id} | Match: ${busId === busDoc.id}`);

            const busData = busDoc.data();
            const isActiveTrip = !!busData.activeTripId;
            const newStatus = isActiveTrip ? 'ON_ROUTE' : (busData.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'ACTIVE');

            const updateData = {
                lastUpdated: new Date().toISOString(),
                currentDriverId: req.user.id,
                status: newStatus,
                lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp()
            };

            if (speed !== undefined) updateData.speed = Math.round(speed);

            if (latitude !== undefined && longitude !== undefined) {
                const newPoint = {
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: Math.round(speed || 0),
                    timestamp: new Date().toISOString()
                };

                updateData.location = {
                    latitude,
                    longitude,
                    heading: heading || 0
                };

                // Maintain strictly a 5-point buffer
                const currentBuffer = busData.liveTrackBuffer || [];
                const updatedBuffer = [...currentBuffer, newPoint].slice(-5);
                updateData.liveTrackBuffer = updatedBuffer;
            }

            transaction.update(busRef, updateData);
        });

        res.status(200).json({ success: true, message: 'Location updated via transaction' });
    } catch (error) {
        console.error('Error updating bus location:', error);
        res.status(error.message === 'Bus not found' ? 404 : 500).json({
            success: false,
            message: error.message || 'Server Error'
        });
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
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        if (tripDoc.data().driverId !== req.user.id) {
            console.warn(`[UNAUTHORIZED END TRIP] Driver ${req.user.id} attempted to end trip ${tripId} owned by ${tripDoc.data().driverId}`);
            return res.status(403).json({ success: false, message: 'You are not authorized to end this trip because you did not start it.' });
        }

        const batch = db.batch();
        const busRef = db.collection('buses').doc(busId);

        // 1. Update Trip Status
        batch.update(tripRef, {
            status: 'ended',
            endTime: new Date().toISOString(),
            isActive: false
        });

        // 2. Update Bus Status (Canonical State)
        batch.update(busRef, {
            status: 'ACTIVE',
            activeTripId: null,
            currentTripId: null,
            currentRoadName: '',
            currentSpeed: 0,
            speed: 0,
            liveTrail: [],
            liveTrackBuffer: [],
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
        const { tripId, routeId, direction } = req.body;
        const tripDirection = direction || 'pickup'; // 'pickup' or 'dropoff'

        console.log(`--- START TRIP: ${tripId} for Bus ${busId} (Route: ${routeId || 'Default'}, Direction: ${tripDirection}) ---`);

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

        // Load route stops (ordered)
        const effectiveRouteId = routeId || busData.assignedRouteId || null;
        let stopsSnapshot = [];

        if (effectiveRouteId) {
            const stopsQuery = await db.collection('stops')
                .where('routeId', '==', effectiveRouteId)
                .get();

            let stops = stopsQuery.docs
                .map(doc => ({ stopId: doc.id, ...doc.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            // Reverse for dropoff
            if (tripDirection === 'dropoff') {
                stops = stops.reverse();
            }

            // Build stopsSnapshot with planned times
            stopsSnapshot = stops.map((stop, idx) => ({
                stopId: stop.stopId,
                order: idx + 1,
                name: stop.stopName || '',
                address: stop.address || '',
                lat: stop.latitude || 0,
                lng: stop.longitude || 0,
                radiusM: stop.radiusM || 100,
                plannedTime: tripDirection === 'dropoff'
                    ? (stop.dropoffPlannedTime || '')
                    : (stop.pickupPlannedTime || ''),
                enabled: stop.enabled !== false
            }));
        }

        // Build initial stopProgress and eta
        const firstStop = stopsSnapshot.length > 0 ? stopsSnapshot[0] : null;
        const stopProgress = {
            currentIndex: 0,
            arrivedStopIds: [],
            arrivals: {}
        };
        const eta = {
            nextStopId: firstStop ? firstStop.stopId : null,
            nextStopEta: null,
            perStopEta: {},
            delayMinutes: 0
        };

        // Use a Batch for Atomic Operations
        const batch = db.batch();
        const tripRef = db.collection('trips').doc(tripId);

        // 1. Create Trip Doc with stopsSnapshot + stopProgress + eta
        batch.set(tripRef, {
            tripId,
            busId,
            routeId: effectiveRouteId,
            direction: tripDirection,
            busNumber: busData.busNumber || busData.number || 'Unknown',
            driverId: req.user.id,
            driverName: driverName,
            collegeId: req.collegeId,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'ACTIVE',
            totalPoints: 0,
            stopsSnapshot,
            stopProgress,
            eta,
            path: []
        });

        // 2. Update Bus Doc (Canonical Source of Truth)
        batch.update(busRef, {
            activeTripId: tripId,
            currentTripId: tripId,
            routeId: effectiveRouteId,
            status: 'ON_ROUTE',
            driverName: driverName,
            currentDriverId: req.user.id,
            currentRoadName: 'Ready to start...',
            lastUpdated: new Date().toISOString()
        });

        await batch.commit();

        console.log('Trip started atomically:', tripId, `with ${stopsSnapshot.length} stops (${tripDirection})`);

        // Send 'Bus Started' Notification (Phase 4.2)
        sendBusStartedNotification(tripId, busId, req.collegeId, effectiveRouteId)
            .catch(err => console.error('Failed to send bus start notification:', err));

        res.status(201).json({ success: true, message: 'Trip started', tripId, stopsCount: stopsSnapshot.length, direction: tripDirection });
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

        const tripRef = db.collection('trips').doc(tripId);

        // Transaction to append to path array (keeps correct order and fits single-doc requirement)
        await db.runTransaction(async (transaction) => {
            const tDoc = await transaction.get(tripRef);

            const newPoint = {
                lat: latitude,
                lng: longitude,
                latitude, // Keep for backward visibility
                longitude, // Keep for backward visibility
                speed: Math.round(speed || 0),
                heading: heading || 0,
                timestamp: timestamp || new Date().toISOString(),
                recordedAt: new Date().toISOString()
            };

            if (!tDoc.exists) {
                // Initialize trip doc if it doesn't exist (safety)
                transaction.set(tripRef, {
                    tripId,
                    busId,
                    collegeId: req.collegeId,
                    path: [newPoint],
                    totalPoints: 1,
                    status: 'ACTIVE',
                    startTime: new Date().toISOString(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const data = tDoc.data();
                const existingPath = data.path || [];

                // Firestore limit check (1MB) - roughly ~5000-8000 points. 
                // A typical trip of 500 points is very safe (~50KB).
                transaction.update(tripRef, {
                    path: [...existingPath, newPoint],
                    totalPoints: (existingPath.length + 1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        console.log('History point appended to path array in root trip doc');
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

