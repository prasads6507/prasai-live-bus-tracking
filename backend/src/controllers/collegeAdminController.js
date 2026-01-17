const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// --- BUSES ---

// @desc    Create a bus
// @route   POST /api/admin/buses
// @access  Private (College Admin)
const createBus = async (req, res) => {
    const { busNumber, plateNumber, capacity } = req.body;

    try {
        const bus = await Bus.create({
            busId: 'bus-' + Date.now(),
            collegeId: req.collegeId, // Enforced by tenantMiddleware
            busNumber,
            plateNumber,
            capacity
        });
        res.status(201).json(bus);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBuses = async (req, res) => {
    try {
        const buses = await Bus.find({ collegeId: req.collegeId });
        res.json(buses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ROUTES & STOPS ---

// @desc    Create a route with stops
// @route   POST /api/admin/routes
// @access  Private (College Admin)
const createRoute = async (req, res) => {
    const { routeName, startPoint, endPoint, stops } = req.body; // stops is array of logic objects

    try {
        const routeId = 'route-' + Date.now();
        const route = await Route.create({
            routeId,
            collegeId: req.collegeId,
            routeName,
            startPoint,
            endPoint
        });

        if (stops && stops.length > 0) {
            const stopDocs = stops.map((stop, index) => ({
                stopId: 'stop-' + Date.now() + '-' + index,
                collegeId: req.collegeId,
                routeId: routeId,
                stopName: stop.stopName,
                latitude: stop.latitude,
                longitude: stop.longitude,
                order: index + 1
            }));
            await Stop.insertMany(stopDocs);
        }

        res.status(201).json(route);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getRoutes = async (req, res) => {
    try {
        const routes = await Route.find({ collegeId: req.collegeId });
        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- USERS (Drivers & Students) ---

const createUser = async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    // Ensure only DRIVER or STUDENT are created here
    if (!['DRIVER', 'STUDENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role for college admin creation' });
    }

    try {
        const user = await User.create({
            userId: role.toLowerCase() + '-' + Date.now(),
            collegeId: req.collegeId,
            name,
            email,
            phone,
            passwordHash: password,
            role
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUsersByRole = async (req, res) => {
    const { role } = req.params; // 'driver' or 'student'
    const filterRole = role.toUpperCase();

    try {
        const users = await User.find({
            collegeId: req.collegeId,
            role: filterRole
        }).select('-passwordHash');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- ASSIGNMENTS ---

const assignDriver = async (req, res) => {
    const { busId, userId, routeId } = req.body;

    try {
        const assignment = await Assignment.create({
            collegeId: req.collegeId,
            userId,
            busId,
            routeId,
            role: 'DRIVER'
        });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find({ collegeId: req.collegeId });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBus,
    getBuses,
    createRoute,
    getRoutes,
    createUser,
    getUsersByRole,
    assignDriver,
    getAssignments
};
