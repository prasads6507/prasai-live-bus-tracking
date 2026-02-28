const { db, admin, initializationError, messaging } = require('../config/firebase');

// Early check middleware-like guard for this controller
const checkInit = (res) => {
    if (initializationError || !db) {
        res.status(500).json({
            success: false,
            message: "Database Configuration Error",
            details: initializationError?.message || 'Firebase not initialized'
        });
        return false;
    }
    return true;
};

const { checkProximityAndNotify, sendTripEndedNotification, sendStudentAttendanceNotification } = require('./notificationController');
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


        const busesSnapshot = await db.collection('buses')
            .where('collegeId', '==', req.collegeId)
            .where('assignedDriverId', '==', req.user.id)
            .get();



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



            const busData = busDoc.data();
            const isActiveTrip = !!busData.activeTripId;
            const newStatus = isActiveTrip ? 'ON_ROUTE' : (busData.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'IDLE');

            const updateData = {
                lastUpdated: new Date().toISOString(),
                currentDriverId: req.user.id,
                status: newStatus,
                lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp()
            };

            // Speed normalization: if payload has speedMph use it directly,
            // otherwise treat incoming 'speed' as m/s and convert to mph.
            let speedMph = 0;
            if (req.body.speedMph !== undefined) {
                speedMph = Math.max(0, Math.round(req.body.speedMph));
            } else if (speed !== undefined) {
                speedMph = Math.max(0, Math.round(speed * 2.23694));
            }
            if (speed !== undefined || req.body.speedMph !== undefined) {
                updateData.speedMph = speedMph;        // Canonical
                updateData.currentSpeed = speedMph;    // Alias for some UIs
                updateData.speed = speedMph;           // Legacy
            }


            if (latitude !== undefined && longitude !== undefined) {
                const newPoint = {
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: speedMph,
                    speedMph: speedMph,
                    timestamp: new Date().toISOString()
                };

                // H-2 FIX: Include speed and timestamp in location object for consistency with background service
                updateData.location = {
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: speedMph,
                    speedMph: speedMph,
                    timestamp: new Date().toISOString()
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



    if (!busId) return res.status(400).json({ success: false, message: 'Bus ID required' });

    try {
        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const tripData = tripDoc.data();

        // 0. Idempotency Check: If already ended, return success
        if (tripData.status === 'COMPLETED' || tripData.status === 'CANCELLED' || tripData.isActive === false) {

            return res.status(200).json({ success: true, message: 'Trip already ended.' });
        }

        if (tripData.driverId !== req.user.id) {
            console.warn(`[UNAUTHORIZED END TRIP] Driver ${req.user.id} attempted to end trip ${tripId} owned by ${tripData.driverId}`);
            return res.status(403).json({ success: false, message: 'You are not authorized to end this trip because you did not start it.' });
        }

        const batch = db.batch();
        const busRef = db.collection('buses').doc(busId);

        // 1. Update Trip Status (Canonical: COMPLETED)
        const endTime = new Date();
        const startTimeStr = tripData.startTime;
        let durationMinutes = 0;
        if (startTimeStr) {
            const startTime = new Date(startTimeStr);
            durationMinutes = Math.round((endTime - startTime) / 60000);
        }

        batch.update(tripRef, {
            status: 'COMPLETED',
            endTime: endTime.toISOString(),
            endedAt: admin.firestore.FieldValue.serverTimestamp(),
            durationMinutes: durationMinutes,
            isActive: false
        });

        // 2. Update Bus Status (Canonical: IDLE)
        batch.update(busRef, {
            status: 'IDLE',
            activeTripId: null,      // Explicitly null for clarity
            currentTripId: null,     // Legacy field support
            currentRoadName: '',
            currentStreetName: '',
            currentSpeed: 0,
            speed: 0,
            speedMph: 0,
            liveTrackBuffer: [],
            trackingMode: admin.firestore.FieldValue.delete(),
            nextStopId: admin.firestore.FieldValue.delete(),
            completedStops: [],      // Reset completed stops
            lastUpdated: new Date().toISOString()
        });

        await batch.commit();


        // Notify students whose favorite bus this was (Awaited for Vercel reliability)
        await sendTripEndedNotification(tripId, busId, tripData.collegeId || req.collegeId)
            .catch(err => console.error('[endTrip] Trip ended notification failed:', err));

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
        const { tripId, routeId, direction, isMaintenance, originalBusId } = req.body;
        const tripDirection = direction || 'pickup'; // 'pickup' or 'dropoff'

        // 0. GUARDIAN: Ensure driver doesn't have another active trip already
        const activeTripsQuery = await db.collection('trips')
            .where('collegeId', '==', req.collegeId)
            .where('driverId', '==', req.user.id)
            .where('status', '==', 'ACTIVE')
            .get();

        if (!activeTripsQuery.empty) {
            return res.status(409).json({
                success: false,
                message: 'You already have an active trip. Please end it before starting a new one.',
                activeTripId: activeTripsQuery.docs[0].id
            });
        }

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
            isMaintenance: !!isMaintenance,
            originalBusId: originalBusId || null,
            maintenanceBusId: isMaintenance ? busId : null,
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



        // NOTE: Bus Started notification is sent by Flutter via /trip-started-notify endpoint.
        // Sending it here too would cause duplicate notifications. Do NOT re-add.
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

        // C-3 FIX: Use arrayUnion + increment instead of read-then-rewrite.
        // Old approach: read full path array + write [existing..., newPoint] = O(n²) data transfer.
        // New approach: constant-time write, no read required.
        const newPoint = {
            lat: latitude,
            lng: longitude,
            latitude,
            longitude,
            speed: Math.round(speed || 0),
            heading: heading || 0,
            timestamp: timestamp || new Date().toISOString(),
            recordedAt: new Date().toISOString()
        };

        await tripRef.update({
            path: admin.firestore.FieldValue.arrayUnion(newPoint),
            totalPoints: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });


        res.status(201).json({ success: true, message: 'History saved' });
    } catch (error) {
        console.error('Error saving trip history:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};



// @desc    Upload complete trip history at trip end (replaces per-second writes)
// @route   POST /api/driver/trips/:tripId/history-upload
// @access  Private (Driver)
const historyUpload = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { polyline, distanceMeters, durationSeconds, maxSpeedMph, avgSpeedMph, pointsCount, path, attendance } = req.body;



        if (!tripId) {
            return res.status(400).json({ success: false, message: 'tripId is required' });
        }

        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const tripData = tripDoc.data();

        // Verify driver owns this trip
        if (tripData.driverId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to upload history for this trip' });
        }

        // Single Firestore write with polyline + summary
        const updateData = {
            polyline: polyline || '',
            distanceMeters: distanceMeters || 0,
            durationSeconds: durationSeconds || 0,
            maxSpeedMph: maxSpeedMph || 0,
            avgSpeedMph: avgSpeedMph || 0,
            pointsCount: pointsCount || 0,
            historyUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Also store the path array if provided and not too large
        if (path && Array.isArray(path) && path.length <= 5000) {
            updateData.path = path;
            updateData.totalPoints = path.length;
        }

        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
        const busNumber = tripData.busNumber || tripData.busId;
        const direction = tripData.direction || 'pickup';
        const isPickup = direction === 'pickup';

        // ── A. Write "present" attendance records ──────────────────────────────
        const studentIds = [];
        if (attendance && Array.isArray(attendance) && attendance.length > 0) {
            const uniqueIds = [...new Set(attendance)];
            const studentDocs = await Promise.all(
                uniqueIds.map(id => db.collection('students').doc(id).get())
            );

            const batch = db.batch();
            const boardedTokens = [];
            const boardedNames = [];

            for (let i = 0; i < uniqueIds.length; i++) {
                const studentId = uniqueIds[i];
                studentIds.push(studentId);
                const studentDoc = studentDocs[i];
                const studentData = studentDoc.exists ? studentDoc.data() : {};
                const studentName = studentData.name || 'Unknown Student';

                if (studentData.fcmToken && typeof studentData.fcmToken === 'string' && studentData.fcmToken.length > 10) {
                    boardedTokens.push(studentData.fcmToken);
                    boardedNames.push(studentName);
                }

                const attendanceId = `${tripId}__${studentId}`;
                const attendanceRef = db.collection('attendance').doc(attendanceId);
                const attendanceData = {
                    tripId,
                    studentId,
                    busId: tripData.busId,
                    busNumber,
                    collegeId: req.collegeId,
                    driverId: req.user.id,
                    studentName,
                    direction,
                    status: isPickup ? 'picked_up' : 'dropped_off',
                    createdAt: serverTimestamp,
                    updatedAt: serverTimestamp
                };
                if (isPickup) {
                    attendanceData.pickedUpAt = serverTimestamp;
                    attendanceData.droppedOffAt = null;
                } else {
                    attendanceData.droppedOffAt = serverTimestamp;
                    attendanceData.pickedUpAt = null;
                }
                batch.set(attendanceRef, attendanceData, { merge: true });
            }

            if (isPickup) {
                updateData.pickedUpStudents = admin.firestore.FieldValue.arrayUnion(...studentIds);
            } else {
                updateData.droppedOffStudents = admin.firestore.FieldValue.arrayUnion(...studentIds);
            }

            await batch.commit();
            console.log(`[historyUpload] Written ${studentIds.length} present records (${direction})`);
        }

        // ── B. NOT_BOARDED: always run regardless of whether attendance was empty ──
        // FIX: moved out of the `if (attendance.length > 0)` block so it always fires.
        try {
            const allBusStudents = await db.collection('students')
                .where('collegeId', '==', req.collegeId)
                .where('assignedBusId', '==', tripData.busId)
                .get();

            const pendingTokens = [];
            const pendingStudentDocs = [];

            allBusStudents.forEach(doc => {
                if (!studentIds.includes(doc.id)) {
                    pendingStudentDocs.push(doc);
                    const sd = doc.data();
                    if (sd.fcmToken && typeof sd.fcmToken === 'string' && sd.fcmToken.length > 10) {
                        pendingTokens.push(sd.fcmToken);
                    }
                }
            });

            // FCM logic removed — consolidated into sendTripEndedNotification
            console.log(`[historyUpload] Processing records for ${pendingStudentDocs.length} absent students (Notification deferred to endTrip)`);

            // Write not_boarded / not_dropped records for absent students
            const nbBatch = db.batch();
            pendingStudentDocs.forEach(doc => {
                const studentId = doc.id;
                const studentData = doc.data();
                const attendanceId = `${tripId}__${studentId}`;
                const attendanceRef = db.collection('attendance').doc(attendanceId);
                nbBatch.set(attendanceRef, {
                    tripId,
                    studentId,
                    busId: tripData.busId,
                    busNumber,
                    collegeId: req.collegeId,
                    driverId: req.user.id,
                    studentName: studentData.name || 'Unknown Student',
                    direction,
                    status: isPickup ? 'not_boarded' : 'not_dropped',
                    createdAt: serverTimestamp,
                    updatedAt: serverTimestamp,
                    pickedUpAt: null,
                    droppedOffAt: null
                }, { merge: true });
            });
            if (pendingStudentDocs.length > 0) {
                await nbBatch.commit();
                console.log(`[historyUpload] Recorded ${pendingStudentDocs.length} absent students`);
            }
        } catch (pendingErr) {
            console.error('[historyUpload] Pending students processing error:', pendingErr.message);
        }

        await tripRef.update(updateData);


        res.status(200).json({ success: true, message: 'Trip history uploaded' });
    } catch (error) {
        console.error('Error uploading trip history:', error);
        res.status(500).json({ success: false, message: 'Failed to upload trip history', error: error.message });
    }
};

// @desc    Notify single student on attendance tick
// @route   POST /api/driver/trips/:tripId/attendance/notify
// @access  Private (Driver)
const notifyStudentAttendance = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { studentId, busId, direction, isChecked, busNumber } = req.body;

        if (!studentId || !busId) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        await sendStudentAttendanceNotification({
            studentId,
            busId,
            direction,
            isChecked,
            busNumber,
            tripId
        });

        res.status(200).json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('Error in notifyStudentAttendance:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
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

// @desc    Mark student as picked up
// @route   POST /api/driver/trips/:tripId/attendance/pickup
// @access  Private (Driver)
const markPickup = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { studentId } = req.body;

        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required' });

        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) return res.status(404).json({ success: false, message: 'Trip not found' });

        const tripData = tripDoc.data();
        if (tripData.driverId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized trip access' });
        }

        // Get student details for the record
        const studentDoc = await db.collection('students').doc(studentId).get();
        const studentName = studentDoc.exists ? studentDoc.data().name : 'Unknown Student';

        const attendanceId = `${tripId}__${studentId}`;
        const attendanceRef = db.collection('attendance').doc(attendanceId);

        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

        const attendanceData = {
            tripId,
            studentId,
            busId: tripData.busId,
            busNumber: tripData.busNumber || tripData.busId,
            collegeId: req.collegeId,
            driverId: req.user.id,
            studentName,
            direction: tripData.direction || 'pickup',
            pickedUpAt: serverTimestamp,
            status: 'picked_up',
            droppedOffAt: null,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp
        };

        await db.runTransaction(async (transaction) => {
            transaction.set(attendanceRef, attendanceData, { merge: true });
            transaction.update(tripRef, {
                pickedUpStudents: admin.firestore.FieldValue.arrayUnion(studentId),
                updatedAt: serverTimestamp
            });
        });

        res.status(200).json({ success: true, attendance: attendanceData });

        // Immediate notification (Awaited for Vercel reliability)
        await sendStudentAttendanceNotification({
            studentId,
            busId: tripData.busId,
            direction: 'pickup',
            isChecked: true,
            busNumber: tripData.busNumber,
            tripId
        }).catch(err => console.error('[markPickupNotify] error:', err));
    } catch (error) {
        console.error('Error marking pickup:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Mark student as dropped off
// @route   POST /api/driver/trips/:tripId/attendance/dropoff
// @access  Private (Driver)
const markDropoff = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { studentId } = req.body;

        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required' });

        const tripRef = db.collection('trips').doc(tripId);
        const tripDoc = await tripRef.get();

        if (!tripDoc.exists) return res.status(404).json({ success: false, message: 'Trip not found' });

        const tripData = tripDoc.data();
        if (tripData.driverId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized trip access' });
        }

        // FIX: Fetch student name (was missing in original markDropoff)
        const studentDoc = await db.collection('students').doc(studentId).get();
        const studentName = studentDoc.exists ? studentDoc.data().name : 'Unknown Student';

        const attendanceId = `${tripId}__${studentId}`;
        const attendanceRef = db.collection('attendance').doc(attendanceId);
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

        await db.runTransaction(async (transaction) => {
            transaction.set(attendanceRef, {
                droppedOffAt: serverTimestamp,
                status: 'dropped_off',
                direction: tripData.direction || 'dropoff',
                updatedAt: serverTimestamp,
                createdAt: serverTimestamp,
                tripId,
                studentId,
                studentName,                             // FIX: now included
                busId: tripData.busId,
                busNumber: tripData.busNumber || tripData.busId,
                collegeId: req.collegeId,
                driverId: req.user.id
            }, { merge: true });
            transaction.update(tripRef, {
                droppedOffStudents: admin.firestore.FieldValue.arrayUnion(studentId),
                updatedAt: serverTimestamp
            });
        });

        res.status(200).json({ success: true, message: 'Student dropped off' });

        // Immediate FCM notification to the student (Awaited for Vercel reliability)
        await sendStudentAttendanceNotification({
            studentId,
            busId: tripData.busId,
            direction: 'dropoff',
            isChecked: true,
            busNumber: tripData.busNumber,
            tripId
        }).catch(err => console.error('[markDropoffNotify] error:', err));
    } catch (error) {
        console.error('Error marking dropoff:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all attendance records for a trip
// @route   GET /api/driver/trips/:tripId/attendance
// @access  Private (Driver)
const getTripAttendance = async (req, res) => {
    try {
        const { tripId } = req.params;

        const attendanceSnapshot = await db.collection('attendance')
            .where('tripId', '==', tripId)
            .where('collegeId', '==', req.collegeId)
            .get();

        const attendance = attendanceSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json({ success: true, data: attendance });
    } catch (error) {
        console.error('Error fetching trip attendance:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get today's total attendance for a bus and direction
// @route   GET /api/driver/buses/:busId/attendance/today
// @access  Private (Driver)
const getTodayAttendance = async (req, res) => {
    try {
        const { busId } = req.params;
        const { direction } = req.query;

        if (!busId || !direction) {
            return res.status(400).json({ success: false, message: 'busId and direction are required' });
        }

        // Calculate start and end of today in local time (server is usually UTC, but we want college local)
        // For simplicity, we use the server's current date range.
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const endOfToday = new Date(now.setHours(23, 59, 59, 999)).toISOString();

        // Note: Firestore doesn't support inequality filters on different fields,
        // but since collegeId is equality and direction is equality, we can filter by date on createdAt.
        const attendanceSnapshot = await db.collection('attendance')
            .where('collegeId', '==', req.collegeId)
            .where('busId', '==', busId)
            .where('direction', '==', direction)
            .where('status', 'in', ['picked_up', 'dropped_off'])
            .where('createdAt', '>=', startOfToday)
            .where('createdAt', '<=', endOfToday)
            .get();

        const studentIds = attendanceSnapshot.docs.map(doc => doc.data().studentId);

        res.status(200).json({
            success: true,
            data: studentIds
        });
    } catch (error) {
        console.error('Error fetching today attendance:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get students assigned to a specific bus (for drivers)
// @route   GET /api/driver/buses/:busId/students
// @access  Private (Driver)
const getBusStudents = async (req, res) => {
    try {
        const { busId } = req.params;
        const collegeId = req.collegeId;

        // Verify the driver is assigned to this bus or has permission
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        const busData = busDoc.data();
        if (busData.collegeId !== collegeId) {
            return res.status(403).json({ success: false, message: 'Access denied: College mismatch' });
        }

        // Fetch students who have assignedBusId === busId
        const snapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('assignedBusId', '==', busId)
            .get();

        const students = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || data.phoneNumber || null,
                registerNumber: data.registerNumber || null,
                rollNumber: data.rollNumber || null,
                assignedBusId: data.assignedBusId || null,
            };
        });

        res.status(200).json({
            success: true,
            data: students
        });
    } catch (error) {
        console.error('Error fetching bus students for driver:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
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
    getBusStudents,
    getTodayAttendance,
    notifyStudentAttendance
};

