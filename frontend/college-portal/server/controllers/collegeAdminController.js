const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// --- BUSES ---

// @desc    Create a bus
// @route   POST /api/admin/buses
// @access  Private (College Admin)
const createBus = async (req, res) => {
    const { busNumber, plateNumber, capacity } = req.body;

    try {
        const busId = 'bus-' + Date.now();
        const newBus = {
            busId,
            collegeId: req.collegeId,
            busNumber,
            plateNumber,
            capacity: capacity || 0,
            status: 'ACTIVE',
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
    const { busNumber, plateNumber, capacity, status } = req.body;

    try {
        const busRef = db.collection('buses').doc(busId);
        const busDoc = await busRef.get();

        if (!busDoc.exists) {
            return res.status(404).json({ message: 'Bus not found' });
        }

        const updateData = {};
        if (busNumber !== undefined) updateData.busNumber = busNumber;
        if (plateNumber !== undefined) updateData.plateNumber = plateNumber;
        if (capacity !== undefined) updateData.capacity = capacity;
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
            startPoint,
            endPoint,
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
                    latitude: stop.latitude,
                    longitude: stop.longitude,
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
        const routes = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- USERS (Drivers & Students) ---

const createUser = async (req, res) => {
    const { name, email, password, phone, role } = req.body;

    if (!['DRIVER', 'STUDENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role for college admin creation' });
    }

    try {
        // Check if user exists
        const existingUser = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!existingUser.empty) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const userId = role.toLowerCase() + '-' + Date.now();
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

        await db.collection('users').doc(userId).set(newUser);

        // Return without password
        const { passwordHash: _, ...userResponse } = newUser;
        res.status(201).json({ _id: userId, ...userResponse });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUsersByRole = async (req, res) => {
    const { role } = req.params;
    const filterRole = role.toUpperCase();

    try {
        const snapshot = await db.collection('users')
            .where('collegeId', '==', req.collegeId)
            .where('role', '==', filterRole)
            .get();

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
        const assignmentId = 'assign-' + Date.now();
        const assignment = {
            assignmentId,
            collegeId: req.collegeId,
            userId,
            busId,
            routeId,
            role: 'DRIVER',
            createdAt: new Date().toISOString()
        };

        await db.collection('assignments').doc(assignmentId).set(assignment);
        res.status(201).json({ _id: assignmentId, ...assignment });
    } catch (error) {
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

module.exports = {
    createBus,
    getBuses,
    updateBus,
    deleteBus,
    createRoute,
    getRoutes,
    createUser,
    getUsersByRole,
    updateUser,
    deleteUser,
    assignDriver,
    getAssignments
};
