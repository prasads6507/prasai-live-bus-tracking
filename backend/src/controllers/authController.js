const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, admin } = require('../config/firebase');

// Helper to validate password since Mongoose method is gone
const matchPassword = async (enteredPassword, passwordHash) => {
    return await bcrypt.compare(enteredPassword, passwordHash);
};

const generateToken = (id, role, collegeId) => {
    return jwt.sign({ id, role, collegeId }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Firestore query: users collection, where email == email
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Security Check: College Status
        if (userData.role !== 'OWNER' && userData.collegeId !== 'OWNER_GLOBAL') {
            const collegeDoc = await db.collection('colleges').doc(userData.collegeId).get();
            if (collegeDoc.exists && collegeDoc.data().status === 'SUSPENDED') {
                return res.status(403).json({ message: 'Your organization account is suspended. Please contact the system administrator.' });
            }
        }

        if (userData && (await matchPassword(password, userData.passwordHash))) {
            res.json({
                _id: userData.userId,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                collegeId: userData.collegeId,
                token: generateToken(userData.userId, userData.role, userData.collegeId),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new owner
// @route   POST /api/auth/register-owner
// @access  Public (Should ideally be protected by a secret)
const registerOwner = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const userId = 'owner-' + Date.now();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = {
            userId,
            name,
            email,
            passwordHash,
            role: 'OWNER',
            collegeId: 'OWNER_GLOBAL',
            createdAt: new Date().toISOString(),
        };

        await usersRef.doc(userId).set(newUser);

        res.status(201).json({
            _id: userId,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            token: generateToken(userId, newUser.role, newUser.collegeId),
        });
    } catch (error) {
        console.error("Register Owner Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        // req.user is set by authMiddleware (needs validation of what ID is passed)
        // Ideally should query by custom userId field, as we used 'userId' in mongo

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('userId', '==', req.user.id).limit(1).get();

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            // Exclude passwordHash manually
            const { passwordHash, ...userWithoutPassword } = userData;
            res.json(userWithoutPassword);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Google login verify and token exchange
// @route   POST /api/auth/google-login
// @access  Public
const googleLogin = async (req, res) => {
    const { token } = req.body;

    try {
        // Verify Firebase ID Token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name, uid } = decodedToken;

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        let userData;
        let userId;

        if (snapshot.empty) {
            // First time Google login - create user as OWNER by default for this portal
            // In a real app, you might want to invite users or handle roles differently
            userId = 'owner-google-' + uid;
            userData = {
                userId,
                name: name || 'Google User',
                email,
                role: 'OWNER',
                collegeId: 'OWNER_GLOBAL',
                createdAt: new Date().toISOString(),
                authMethod: 'GOOGLE'
            };
            await usersRef.doc(userId).set(userData);
            console.log("New User Created via Google:", email);
        } else {
            userData = snapshot.docs[0].data();
            userId = userData.userId;

            // Security Check: College Status for existing users
            if (userData.role !== 'OWNER' && userData.collegeId !== 'OWNER_GLOBAL') {
                const collegeDoc = await db.collection('colleges').doc(userData.collegeId).get();
                if (collegeDoc.exists && collegeDoc.data().status === 'SUSPENDED') {
                    return res.status(403).json({ message: 'Your organization account is suspended. Please contact the system administrator.' });
                }
            }
        }

        res.json({
            _id: userId,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            collegeId: userData.collegeId,
            token: generateToken(userId, userData.role, userData.collegeId),
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(401).json({ message: 'Invalid Google token' });
    }
};

module.exports = { loginUser, getMe, registerOwner, googleLogin };
