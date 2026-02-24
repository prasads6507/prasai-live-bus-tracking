const { db, admin, auth, initializationError } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const polyline = require('@mapbox/polyline');

// --- BUSES ---

// @desc    Create a bus
// @route   POST /api/admin/buses
// @access  Private (College Admin)
const createBus = async (req, res) => {
    const { busNumber, plateNumber, assignedDriverId, assignedRouteId } = req.body;

    try {
        const busId = 'bus-' + Date.now();
        const newBus = {
            busId,
            collegeId: req.collegeId,
            busNumber,
            plateNumber,
            assignedDriverId: assignedDriverId || null,
            assignedRouteId: assignedRouteId || null,
            status: 'IDLE',
            createdAt: new Date().toISOString()
        };

        await db.collection('buses').doc(busId).set(newBus);
        res.status(201).json({ _id: busId, ...newBus });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBuses = async (req, res) => {
    try {
        const snapshot = await db.collection('buses')
            .where('collegeId', '==', req.collegeId)
            .get();
        const buses = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json(buses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateBus = async (req, res) => {
    const { busId } = req.params;
    const { busNumber, plateNumber, assignedDriverId, assignedRouteId, status } = req.body;

    try {
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        const updateData = {};
        if (busNumber !== undefined) updateData.busNumber = busNumber;
        if (plateNumber !== undefined) updateData.plateNumber = plateNumber;
        if (assignedDriverId !== undefined) updateData.assignedDriverId = assignedDriverId || null;
        if (assignedRouteId !== undefined) updateData.assignedRouteId = assignedRouteId || null;
        if (status !== undefined) updateData.status = status;
        updateData.updatedAt = new Date().toISOString();

        await busRef.update(updateData);
        const updated = await busRef.get();
        res.json({ _id: updated.id, ...updated.data() });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteBus = async (req, res) => {
    const { busId } = req.params;

    try {
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        await busRef.delete();
        res.json({ message: 'Bus deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ROUTES & STOPS ---

// @desc    Create a route with stops
// @route   POST /api/admin/routes
// @access  Private (College Admin)
const createRoute = async (req, res) => {
    const { routeName, startPoint, endPoint, stops } = req.body;

    try {
        const routeId = 'route-' + Date.now();
        const newRoute = {
            routeId,
            collegeId: req.collegeId,
            routeName,
            startPoint: startPoint || '',
            endPoint: endPoint || '',
            createdAt: new Date().toISOString()
        };

        const batch = db.batch();
        batch.set(db.collection('routes').doc(routeId), newRoute);

        if (stops && stops.length > 0) {
            stops.forEach((stop, index) => {
                const stopId = 'stop-' + Date.now() + '-' + index;
                const stopData = {
                    stopId,
                    collegeId: req.collegeId,
                    routeId,
                    stopName: stop.stopName,
                    address: stop.address || '',
                    latitude: stop.latitude || 0,
                    longitude: stop.longitude || 0,
                    radiusM: stop.radiusM || 100,
                    pickupPlannedTime: stop.pickupPlannedTime || '',
                    dropoffPlannedTime: stop.dropoffPlannedTime || '',
                    enabled: stop.enabled !== false,
                    order: index + 1
                };
                batch.set(db.collection('stops').doc(stopId), stopData);
            });
        }

        await batch.commit();
        res.status(201).json({ _id: routeId, ...newRoute });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getRoutes = async (req, res) => {
    try {
        const snapshot = await db.collection('routes')
            .where('collegeId', '==', req.collegeId)
            .get();

        // Get routes with stop counts
        const routes = await Promise.all(snapshot.docs.map(async (doc) => {
            const routeData = { _id: doc.id, ...doc.data() };

            // Get stops for this route
            const stopsSnapshot = await db.collection('stops')
                .where('routeId', '==', doc.id)
                .get();

            // Map stops and sort by order
            const stops = stopsSnapshot.docs
                .map(stopDoc => ({ ...stopDoc.data() }))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            routeData.stops = stops;
            routeData.stopsCount = stops.length; // Keep stopsCount for compatibility if needed
            return routeData;
        }));

        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateRoute = async (req, res) => {
    const { routeId } = req.params;
    const { routeName, startPoint, endPoint, stops } = req.body;

    try {
        const routeRef = db.collection('routes').doc(routeId);
        const routeDoc = await routeRef.get();

        if (!routeDoc.exists) {
            return res.status(404).json({ message: 'Route not found' });
        }

        const batch = db.batch();

        // Update route
        const updateData = {};
        if (routeName !== undefined) updateData.routeName = routeName;
        if (startPoint !== undefined) updateData.startPoint = startPoint;
        if (endPoint !== undefined) updateData.endPoint = endPoint;
        updateData.updatedAt = new Date().toISOString();

        batch.update(routeRef, updateData);

        // If stops are provided, delete old stops and create new ones
        if (stops !== undefined) {
            // Delete old stops
            const oldStops = await db.collection('stops')
                .where('routeId', '==', routeId)
                .get();

            oldStops.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Create new stops
            if (stops && stops.length > 0) {
                stops.forEach((stop, index) => {
                    const stopId = 'stop-' + Date.now() + '-' + index;
                    const stopData = {
                        stopId,
                        collegeId: req.collegeId,
                        routeId,
                        stopName: stop.stopName,
                        address: stop.address || '',
                        latitude: stop.latitude || 0,
                        longitude: stop.longitude || 0,
                        radiusM: stop.radiusM || 100,
                        pickupPlannedTime: stop.pickupPlannedTime || '',
                        dropoffPlannedTime: stop.dropoffPlannedTime || '',
                        enabled: stop.enabled !== false,
                        order: index + 1
                    };
                    batch.set(db.collection('stops').doc(stopId), stopData);
                });
            }
        }

        await batch.commit();
        const updated = await routeRef.get();
        res.json({ _id: updated.id, ...updated.data() });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteRoute = async (req, res) => {
    const { routeId } = req.params;

    try {
        const routeRef = db.collection('routes').doc(routeId);
        const routeDoc = await routeRef.get();

        if (!routeDoc.exists) {
            return res.status(404).json({ message: 'Route not found' });
        }

        const batch = db.batch();

        // Delete all stops for this route
        const stopsSnapshot = await db.collection('stops')
            .where('routeId', '==', routeId)
            .get();

        stopsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the route
        batch.delete(routeRef);

        await batch.commit();
        res.json({ message: 'Route and associated stops deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- USERS (Drivers & Students) ---

const createBulkUsers = async (req, res) => {
    const { users, role } = req.body;

    if (!['DRIVER', 'STUDENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role for bulk creation' });
    }

    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: 'No users provided' });
    }

    try {
        const batch = db.batch();
        const results = {
            success: [],
            errors: [],
            createdCount: 0
        };

        const existingEmails = new Set(); // To track duplicates within the batch if needed, but easier to check DB

        for (const user of users) {
            // Basic validation
            if (!user.email || !user.phone || !user.name) {
                results.errors.push({ user, error: 'Missing required fields (name, email, phone)' });
                continue;
            }

            try {
                // 1. Create in Firebase Auth first (for login compatibility)
                const authUser = await admin.auth().createUser({
                    email: user.email,
                    password: user.phone.toString(),
                    displayName: user.name
                }).catch(async (err) => {
                    if (err.code === 'auth/email-already-exists') {
                        return await admin.auth().getUserByEmail(user.email);
                    }
                    throw err;
                });

                const userId = authUser.uid;
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(user.phone.toString(), salt);

                const newUser = {
                    userId,
                    collegeId: req.collegeId,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    passwordHash,
                    role,
                    status: 'ACTIVE',
                    createdAt: new Date().toISOString()
                };

                batch.set(db.collection('users').doc(userId), newUser);
                results.success.push({ name: user.name, email: user.email });
                results.createdCount++;
            } catch (err) {
                results.errors.push({ user, error: err.message });
            }
        }

        if (results.createdCount > 0) {
            await batch.commit();
        }

        res.json({
            message: `Processed ${users.length} users. Created: ${results.createdCount}, Failed: ${results.errors.length}`,
            results
        });

    } catch (error) {
        console.error('Bulk user creation error:', error);
        res.status(500).json({ message: 'Server error during bulk upload' });
    }
};

const createUser = async (req, res) => {
    const { name, email, password, phone, role } = req.body;

    if (!['DRIVER', 'STUDENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role for college admin creation' });
    }

    try {
        // 1. Create in Firebase Auth (ensures login works on mobile)
        const authUser = await admin.auth().createUser({
            email,
            password,
            displayName: name
        }).catch(async (err) => {
            if (err.code === 'auth/email-already-exists') {
                return await admin.auth().getUserByEmail(email);
            }
            throw err;
        });

        const userId = authUser.uid;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = {
            userId,
            collegeId: req.collegeId,
            name,
            email,
            phone,
            passwordHash,
            role,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        // Save to Firestore with the SAME UID as Auth
        await db.collection('users').doc(userId).set(newUser);

        console.log(`[Admin] Created/Synced ${role}: ${email} with UID: ${userId}`);

        // Return without password
        const { passwordHash: _, ...userResponse } = newUser;
        res.status(201).json({ _id: userId, ...userResponse });
    } catch (error) {
        console.error(`[Admin] Error creating ${role}:`, error);
        res.status(500).json({ message: error.message });
    }
};

const getUsersByRole = async (req, res) => {
    const { role } = req.params;
    const filterRole = role.toUpperCase();

    try {
        console.log(`[DEBUG] getUsersByRole: collegeId=${req.collegeId}, role=${filterRole}`);

        const snapshot = await db.collection('users')
            .where('collegeId', '==', req.collegeId)
            .where('role', '==', filterRole)
            .get();

        console.log(`[DEBUG] Found ${snapshot.size} users`);

        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            const { passwordHash, ...userData } = data;
            return { _id: doc.id, ...userData };
        });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { name, email, phone, status } = req.body;

    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (status !== undefined) updateData.status = status;

        await userRef.update(updateData);
        const updated = await userRef.get();
        const { passwordHash, ...userData } = updated.data();

        res.json({ _id: updated.id, ...userData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        await userRef.delete();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ASSIGNMENTS ---

const assignDriver = async (req, res) => {
    const { busId, userId, routeId } = req.body;

    try {
        const batch = db.batch();
        const assignmentId = 'assign-' + Date.now();

        // 1. Create Assignment Doc
        const assignment = {
            assignmentId,
            collegeId: req.collegeId,
            userId,
            busId,
            routeId,
            role: 'DRIVER',
            createdAt: new Date().toISOString()
        };
        batch.set(db.collection('assignments').doc(assignmentId), assignment);

        // 2. Update Bus Document (cross-link)
        batch.update(db.collection('buses').doc(busId), {
            assignedDriverId: userId,
            assignedRouteId: routeId || null,
            status: 'IDLE'
        });

        // 3. Update User/Driver Document (cross-link)
        batch.update(db.collection('users').doc(userId), {
            busId: busId,
            routeId: routeId || null
        });

        await batch.commit();
        console.log(`[Admin] Assigned driver ${userId} to bus ${busId}`);
        res.status(201).json({ _id: assignmentId, ...assignment });
    } catch (error) {
        console.error('[Admin] Assignment Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const getAssignments = async (req, res) => {
    try {
        const snapshot = await db.collection('assignments')
            .where('collegeId', '==', req.collegeId)
            .get();
        const assignments = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- TRIP HISTORY ---

// @desc    Get trip history for all buses in college
// @route   GET /api/admin/trips
// @access  Private (College Admin)
const getTripHistory = async (req, res) => {
    try {
        console.log('--- GET TRIP HISTORY ---');
        console.log('User Role:', req.user ? req.user.role : 'N/A');
        console.log('CollegeId:', req.collegeId);

        let trips = [];

        // 1. First, get trips from ROOT collection (new format)
        const rootTripsSnapshot = await db.collection('trips')
            .where('collegeId', '==', req.collegeId)
            .limit(100)
            .get();

        console.log('Found trips in root collection:', rootTripsSnapshot.size);

        rootTripsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            trips.push({
                _id: doc.id,
                busId: data.busId,
                busNumber: data.busNumber || 'Unknown',
                driverName: data.driverName || 'Unknown Driver',
                startTime: data.startTime,
                endTime: data.endTime,
                status: data.status,
                durationMinutes: data.durationMinutes || null,
                distanceMeters: data.distanceMeters || null,
                maxSpeedMph: data.maxSpeedMph || null,
                avgSpeedMph: data.avgSpeedMph || null,
                pointsCount: data.pointsCount || null,
                source: 'root' // Track source for debugging
            });
        });

        // 2. Also get trips from subcollections (old format)
        const busesSnapshot = await db.collection('buses')
            .where('collegeId', '==', req.collegeId)
            .get();

        console.log('Found buses:', busesSnapshot.size);

        for (const busDoc of busesSnapshot.docs) {
            const busData = busDoc.data();
            const subTripsSnapshot = await busDoc.ref.collection('trips')
                .limit(50)
                .get();

            subTripsSnapshot.docs.forEach(tripDoc => {
                const tripData = tripDoc.data();
                // Avoid duplicates - check if this tripId is already in trips array
                if (!trips.find(t => t._id === tripDoc.id)) {
                    trips.push({
                        _id: tripDoc.id,
                        busId: busDoc.id,
                        busNumber: busData.busNumber || busData.number || 'Unknown',
                        driverName: tripData.driverName || 'Unknown Driver',
                        startTime: tripData.startTime,
                        endTime: tripData.endTime,
                        status: tripData.status,
                        durationMinutes: tripData.durationMinutes || null,
                        distanceMeters: tripData.distanceMeters || null,
                        maxSpeedMph: tripData.maxSpeedMph || null,
                        avgSpeedMph: tripData.avgSpeedMph || null,
                        pointsCount: tripData.pointsCount || null,
                        source: 'subcollection' // Track source for debugging
                    });
                }
            });
        }

        console.log('Total trips found:', trips.length);

        // Sort in memory (most recent first)
        trips.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

        res.status(200).json({
            success: true,
            count: trips.length,
            data: trips
        });
    } catch (error) {
        console.error('Error fetching trip history:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update a trip record
// @route   PUT /api/admin/trips/:tripId
// @access  Private (College Admin)
const updateTrip = async (req, res) => {
    try {
        const { tripId } = req.params;
        const { startTime, endTime, driverName } = req.body;

        // Try ROOT collection first
        let tripRef = db.collection('trips').doc(tripId);
        let tripDoc = await tripRef.get();

        // If not found in root, search subcollections
        if (!tripDoc.exists) {
            const busesSnapshot = await db.collection('buses')
                .where('collegeId', '==', req.collegeId)
                .get();

            for (const busDoc of busesSnapshot.docs) {
                const subTripRef = busDoc.ref.collection('trips').doc(tripId);
                const subTripDoc = await subTripRef.get();
                if (subTripDoc.exists) {
                    tripRef = subTripRef;
                    tripDoc = subTripDoc;
                    break;
                }
            }
        }

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        // Verify trip belongs to this college
        if (tripDoc.data().collegeId && tripDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const updateData = {};
        if (startTime) updateData.startTime = startTime;
        if (endTime) updateData.endTime = endTime;
        if (driverName) updateData.driverName = driverName;

        // Recalculate duration if both times are present
        if (updateData.startTime || updateData.endTime) {
            const tripData = tripDoc.data();
            const start = new Date(updateData.startTime || tripData.startTime);
            const end = updateData.endTime ? new Date(updateData.endTime) : (tripData.endTime ? new Date(tripData.endTime) : null);
            if (end) {
                updateData.durationMinutes = Math.round((end - start) / 60000);
            }
        }

        await tripRef.update(updateData);

        res.status(200).json({ success: true, message: 'Trip updated' });
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a trip record
// @route   DELETE /api/admin/trips/:tripId
// @access  Private (College Admin)
const deleteTrip = async (req, res) => {
    try {
        const { tripId } = req.params;

        // Try ROOT collection first
        let tripRef = db.collection('trips').doc(tripId);
        let tripDoc = await tripRef.get();

        // If not found in root, search subcollections
        if (!tripDoc.exists) {
            const busesSnapshot = await db.collection('buses')
                .where('collegeId', '==', req.collegeId)
                .get();

            for (const busDoc of busesSnapshot.docs) {
                const subTripRef = busDoc.ref.collection('trips').doc(tripId);
                const subTripDoc = await subTripRef.get();
                if (subTripDoc.exists) {
                    tripRef = subTripRef;
                    tripDoc = subTripDoc;
                    break;
                }
            }
        }

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        // Verify trip belongs to this college
        if (tripDoc.data().collegeId && tripDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await tripRef.delete();

        res.status(200).json({ success: true, message: 'Trip deleted' });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Admin force-end a trip (when driver forgets)
// @route   POST /api/admin/trips/:tripId/end
// @access  Private (College Admin)
const adminEndTrip = async (req, res) => {
    try {
        const { tripId } = req.params;

        console.log('--- ADMIN END TRIP ---', tripId);

        // Try ROOT collection first
        let tripRef = db.collection('trips').doc(tripId);
        let tripDoc = await tripRef.get();
        let busId = null;

        // If not found in root, search subcollections
        if (!tripDoc.exists) {
            const busesSnapshot = await db.collection('buses')
                .where('collegeId', '==', req.collegeId)
                .get();

            for (const busDoc of busesSnapshot.docs) {
                const subTripRef = busDoc.ref.collection('trips').doc(tripId);
                const subTripDoc = await subTripRef.get();
                if (subTripDoc.exists) {
                    tripRef = subTripRef;
                    tripDoc = subTripDoc;
                    busId = busDoc.id;
                    break;
                }
            }
        }

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const tripData = tripDoc.data();
        busId = busId || tripData.busId;

        // Verify trip belongs to this college
        if (tripData.collegeId && tripData.collegeId !== req.collegeId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const endTime = new Date();
        const durationMinutes = Math.round((endTime - startTime) / 60000);

        // Update trip to COMPLETED (Canonical Fields)
        await tripRef.update({
            status: 'COMPLETED',
            endTime: endTime.toISOString(),
            endedAt: admin.firestore.FieldValue.serverTimestamp(),
            durationMinutes,
            isActive: false,
            endedBy: 'ADMIN' // Track that admin ended this trip
        });

        // Also update the bus status if we have busId (Standardized Reset)
        if (busId) {
            const busRef = db.collection('buses').doc(busId);
            const busDoc = await busRef.get();
            if (busDoc.exists && (busDoc.data().currentTripId === tripId || busDoc.data().activeTripId === tripId)) {
                await busRef.update({
                    status: 'IDLE',
                    currentTripId: null,
                    activeTripId: null,
                    liveTrail: [],
                    liveTrackBuffer: [],
                    currentRoadName: '',
                    currentStreetName: '',
                    currentSpeed: 0,
                    speed: 0,
                    speedMph: 0,
                    lastUpdated: new Date().toISOString()
                });
            }
        }


        console.log('Admin ended trip successfully:', tripId);
        res.status(200).json({ success: true, message: 'Trip ended by admin', tripId });
    } catch (error) {
        console.error('Error admin ending trip:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Bulk delete trip records
// @route   DELETE /api/admin/trips
// @access  Private (College Admin)
const bulkDeleteTrips = async (req, res) => {
    try {
        const { tripIds } = req.body;
        if (!Array.isArray(tripIds) || tripIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No trip IDs provided' });
        }

        console.log('--- BULK DELETE TRIPS ---', tripIds.length);

        const results = {
            success: [],
            failed: []
        };

        const deleteSubcollection = async (docRef, subName) => {
            const snapshot = await docRef.collection(subName).get();
            if (snapshot.empty) return;

            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        };

        for (const tripId of tripIds) {
            try {
                let deletedCount = 0;

                // 1. Try ROOT collection
                let tripRef = db.collection('trips').doc(tripId);
                let tripDoc = await tripRef.get();

                if (tripDoc.exists) {
                    if (!tripDoc.data().collegeId || tripDoc.data().collegeId === req.collegeId) {
                        await deleteSubcollection(tripRef, 'history');
                        await deleteSubcollection(tripRef, 'path');
                        await tripRef.delete();
                        deletedCount++;
                    }
                }

                // 2. Search all buses subcollections (legacy support)
                const busesSnapshot = await db.collection('buses')
                    .where('collegeId', '==', req.collegeId)
                    .get();

                for (const busDoc of busesSnapshot.docs) {
                    const subTripRef = busDoc.ref.collection('trips').doc(tripId);
                    const subTripDoc = await subTripRef.get();
                    if (subTripDoc.exists) {
                        await deleteSubcollection(subTripRef, 'history');
                        await deleteSubcollection(subTripRef, 'path');
                        await subTripRef.delete();
                        deletedCount++;
                    }
                }

                if (deletedCount > 0) {
                    results.success.push(tripId);
                    console.log(`Deleted trip: ${tripId} from ${deletedCount} locations`);
                } else {
                    results.failed.push({ id: tripId, reason: 'Trip not found or unauthorized' });
                }
            } catch (err) {
                console.error(`Failed to delete trip ${tripId}:`, err);
                results.failed.push({ id: tripId, reason: err.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed ${tripIds.length} trips. Deleted: ${results.success.length}, Failed: ${results.failed.length}`,
            data: results
        });
    } catch (error) {
        console.error('Error in bulk delete trips:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get trip path for visualization
// @route   GET /api/admin/trips/:tripId/path
// @access  Private (College Admin)
const getTripPath = async (req, res) => {
    try {
        const { tripId } = req.params;
        console.log('--- GET TRIP PATH ---', tripId);

        // Try ROOT collection first
        let tripRef = db.collection('trips').doc(tripId);
        let tripDoc = await tripRef.get();

        // If not found in root, search subcollections (legacy support)
        if (!tripDoc.exists) {
            const busesSnapshot = await db.collection('buses')
                .where('collegeId', '==', req.collegeId)
                .get();

            for (const busDoc of busesSnapshot.docs) {
                const subTripRef = busDoc.ref.collection('trips').doc(tripId);
                const subTripDoc = await subTripRef.get();
                if (subTripDoc.exists) {
                    tripRef = subTripRef;
                    tripDoc = subTripDoc;
                    break;
                }
            }
        }

        if (!tripDoc.exists) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const tripData = tripDoc.data();
        let path = [];
        let decodedPath = null;
        let polylineStr = tripData.polyline || null;
        let source = 'none';
        let rawCounts = { pathArrayCount: 0, subcollectionCount: 0 };

        // 1. Try path array in doc
        if (tripData.path && Array.isArray(tripData.path) && tripData.path.length > 0) {
            source = 'path-array';
            rawCounts.pathArrayCount = tripData.path.length;
            path = tripData.path.map(data => ({
                lat: data.lat ?? data.latitude ?? 0,
                lng: data.lng ?? data.longitude ?? 0,
                speed: data.speed || 0,
                timestamp: data.recordedAt ?
                    (data.recordedAt.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt) :
                    data.timestamp
            })).filter(point => point.lat !== 0 && point.lng !== 0);
        }

        // 2. Always try to decode polyline if it exists
        if (polylineStr) {
            console.log(`Decoding polyline for trip ${tripId}...`);
            try {
                // Returns [[lat, lng], ...]
                const decoded = polyline.decode(polylineStr);
                decodedPath = decoded.map(coord => ({ lat: coord[0], lng: coord[1] }));
                if (source === 'none') source = 'polyline';
            } catch (err) {
                console.error("Polyline decode failed:", err);
            }
        }

        // 3. Fallback to subcollections if no path/polyline found
        if (path.length === 0 && !decodedPath) {
            console.log(`Fetching path points from collection for trip ${tripId}...`);
            let pathSnapshot = await tripRef.collection('path').get();

            // If path is empty, try 'history' subcollection
            if (pathSnapshot.empty) {
                pathSnapshot = await tripRef.collection('history').get();
            }

            if (!pathSnapshot.empty) {
                source = pathSnapshot.docs[0].ref.parent.id === 'path' ? 'subcollection-path' : 'subcollection-history';
                rawCounts.subcollectionCount = pathSnapshot.size;
                path = pathSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            lat: data.lat ?? data.latitude ?? 0,
                            lng: data.lng ?? data.longitude ?? 0,
                            speed: data.speed || 0,
                            timestamp: data.recordedAt ?
                                (data.recordedAt.toDate ? data.recordedAt.toDate().toISOString() : data.recordedAt) :
                                data.timestamp
                        };
                    })
                    .filter(point => point.lat !== 0 && point.lng !== 0);
            }
        }

        // Sort in memory
        if (path.length > 0) {
            path.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        }

        console.log(`Returning data for trip ${tripId}: source=${source}, pathCount=${path.length}, hasPolyline=${!!polylineStr}`);

        res.json({
            success: true,
            data: path,
            polyline: polylineStr,
            decodedPath,
            source,
            rawCounts,
            metrics: {
                distanceMeters: tripData.distanceMeters || 0,
                durationSeconds: tripData.durationSeconds || 0,
                maxSpeedMph: tripData.maxSpeedMph || 0,
                avgSpeedMph: tripData.avgSpeedMph || 0,
                totalPoints: tripData.totalPoints || tripData.pointsCount || 0
            }
        });
    } catch (error) {
        console.error('Error fetching trip path:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// --- COLLEGE ADMINS MANAGEMENT (SUPER_ADMIN/OWNER only) ---

// @desc    Get all admins for this college
// @route   GET /api/admin/college-admins
// @access  Private (Super Admin / Owner)
const getCollegeAdmins = async (req, res) => {
    try {
        // Only SUPER_ADMIN and OWNER can access this
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
            return res.status(403).json({ message: 'Access denied. Super Admin or Owner privileges required.' });
        }

        const snapshot = await db.collection('users')
            .where('collegeId', '==', req.collegeId)
            .where('role', 'in', ['COLLEGE_ADMIN', 'SUPER_ADMIN'])
            .get();

        const admins = snapshot.docs.map(doc => ({
            userId: doc.id,
            ...doc.data(),
            passwordHash: undefined // Don't expose password
        }));

        res.json(admins);
    } catch (error) {
        console.error('Error fetching college admins:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new admin for this college
// @route   POST /api/admin/college-admins
// @access  Private (Super Admin / Owner)
const createCollegeAdmin = async (req, res) => {
    try {
        // Only SUPER_ADMIN and OWNER can create admins
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
            return res.status(403).json({ message: 'Access denied. Super Admin or Owner privileges required.' });
        }

        const { name, email, phone, password, collegeId } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        // Check if email already exists
        const existingUser = await db.collection('users').where('email', '==', email).get();
        if (!existingUser.empty) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const userId = 'user-' + Date.now();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newAdmin = {
            userId,
            name,
            email,
            phone: phone || '',
            passwordHash,
            role: 'COLLEGE_ADMIN',
            collegeId: collegeId || req.collegeId,
            createdAt: new Date().toISOString(),
            createdBy: req.user?.id || req.user?._id || req.user?.userId || 'system'
        };

        await db.collection('users').doc(userId).set(newAdmin);

        res.status(201).json({
            userId,
            name,
            email,
            phone: phone || '',
            role: 'COLLEGE_ADMIN',
            collegeId: collegeId || req.collegeId
        });
    } catch (error) {
        console.error('Error creating college admin:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a college admin
// @route   PUT /api/admin/college-admins/:userId
// @access  Private (Super Admin / Owner)
const updateCollegeAdmin = async (req, res) => {
    try {
        // Only SUPER_ADMIN and OWNER can update admins
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
            return res.status(403).json({ message: 'Access denied. Super Admin or Owner privileges required.' });
        }

        const { userId } = req.params;
        const { name, email, phone, password, role } = req.body;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Ensure the admin belongs to the same college
        if (userDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ message: 'Cannot modify admin from another college' });
        }

        const updateData = { updatedAt: new Date().toISOString() };
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (role && (role === 'COLLEGE_ADMIN' || role === 'SUPER_ADMIN')) {
            updateData.role = role;
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt);
        }

        await userRef.update(updateData);
        const updated = await userRef.get();

        res.json({
            userId: updated.id,
            ...updated.data(),
            passwordHash: undefined
        });
    } catch (error) {
        console.error('Error updating college admin:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a college admin
// @route   DELETE /api/admin/college-admins/:userId
// @access  Private (Super Admin / Owner)
const deleteCollegeAdmin = async (req, res) => {
    try {
        // Only SUPER_ADMIN and OWNER can delete admins
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'OWNER') {
            return res.status(403).json({ message: 'Access denied. Super Admin or Owner privileges required.' });
        }

        const { userId } = req.params;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Ensure the admin belongs to the same college
        if (userDoc.data().collegeId !== req.collegeId) {
            return res.status(403).json({ message: 'Cannot delete admin from another college' });
        }

        // Prevent deleting yourself
        if (userId === req.user.userId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        await userRef.delete();
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting college admin:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk assign students to bus/route/stop
// @route   POST /api/admin/students/assign-stop
// @access  Private (College Admin)
const assignStudentsToStop = async (req, res) => {
    try {
        const { assignments } = req.body;
        // assignments = [{ studentId, busId, routeId, stopId }]
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ message: 'assignments array is required' });
        }

        const batch = db.batch();
        for (const a of assignments) {
            if (!a.studentId) continue;
            const studentRef = db.collection('students').doc(a.studentId);
            batch.update(studentRef, {
                assignedBusId: a.busId || null,
                assignedRouteId: a.routeId || null,
                assignedStopId: a.stopId || null,
                updatedAt: new Date().toISOString()
            });
        }

        await batch.commit();
        res.json({ success: true, message: `${assignments.length} student(s) assigned` });
    } catch (error) {
        console.error('Error assigning students to stop:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get students with their route/stop assignments
// @route   GET /api/admin/students/assignments
// @access  Private (College Admin)
const getStudentAssignments = async (req, res) => {
    try {
        const snapshot = await db.collection('students')
            .where('collegeId', '==', req.collegeId)
            .get();

        const students = snapshot.docs.map(doc => ({
            _id: doc.id,
            name: doc.data().name || '',
            studentId: doc.data().studentId || '',
            assignedBusId: doc.data().assignedBusId || null,
            assignedRouteId: doc.data().assignedRouteId || null,
            assignedStopId: doc.data().assignedStopId || null,
        }));

        res.json({ success: true, data: students });
    } catch (error) {
        console.error('Error fetching student assignments:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBus,
    getBuses,
    updateBus,
    deleteBus,
    createRoute,
    getRoutes,
    updateRoute,
    deleteRoute,
    createUser,
    getUsersByRole,
    updateUser,
    deleteUser,
    assignDriver,
    getAssignments,
    getTripHistory,
    updateTrip,
    deleteTrip,
    adminEndTrip,
    getTripPath,
    createBulkUsers,
    getCollegeAdmins,
    createCollegeAdmin,
    updateCollegeAdmin,
    deleteCollegeAdmin,
    bulkDeleteTrips,
    assignStudentsToStop,
    getStudentAssignments
};
