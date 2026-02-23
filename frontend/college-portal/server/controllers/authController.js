const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, admin, auth } = require('../config/firebase');

// Helper to validate password since Mongoose method is gone
const matchPassword = async (enteredPassword, passwordHash) => {
    return await bcrypt.compare(enteredPassword, passwordHash);
};

const generateToken = (id, role, collegeId) => {
    return jwt.sign({ id, role, collegeId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
// @desc    Auth user & get token (Unified for Admin, Owner, Driver, Student)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password, orgSlug } = req.body;

    try {
        // -------------------------
        // 1. Try Users Collection (Owner, Admin, Driver)
        // -------------------------
        const usersRef = db.collection('users');
        const userSnapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            console.log(`[Login] Found user in users collection: ${userData.email} (Role: ${userData.role})`);

            // Security Check: College Status
            if (userData.role !== 'OWNER' && userData.collegeId !== 'OWNER_GLOBAL') {
                const collegeDoc = await db.collection('colleges').doc(userData.collegeId).get();
                if (collegeDoc.exists && collegeDoc.data().status === 'SUSPENDED') {
                    console.warn(`[Login] Blocking login for ${userData.email}: College ${userData.collegeId} is SUSPENDED`);
                    return res.status(403).json({ message: 'Your organization account is suspended.' });
                }

                // If orgSlug is provided (Mobile App), verify it matches the user's collegeId/slug
                if (orgSlug && userData.role === 'DRIVER') {
                    const collegeData = collegeDoc.exists ? collegeDoc.data() : null;
                    const matches = userData.collegeId === orgSlug || (collegeData && collegeData.slug === orgSlug);
                    if (!matches) {
                        console.warn(`[Login] Org Mismatch for driver ${userData.email}: Expected ${orgSlug}, got ${userData.collegeId}`);
                        return res.status(401).json({ message: 'Invalid Organization for this driver account.' });
                    }
                }
            }

            if (await matchPassword(password, userData.passwordHash)) {
                console.log(`[Login] Password verified for ${userData.email}`);
                // Generate Firebase Custom Token for Mobile/Direct Auth
                const firebaseCustomToken = await auth.createCustomToken(userData.userId, {
                    role: userData.role,
                    collegeId: userData.collegeId
                });

                return res.json({
                    _id: userData.userId,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role,
                    collegeId: userData.collegeId,
                    token: generateToken(userData.userId, userData.role, userData.collegeId),
                    firebaseCustomToken
                });
            } else {
                console.warn(`[Login] Invalid password for ${userData.email}`);
                return res.status(401).json({ message: 'Invalid email or password' });
            }
        }

        // -------------------------
        // 2. Try Students Collection
        // -------------------------
        // We need collegeId to scope student search if possible, or search globally if unique email
        let studentsQuery = db.collection('students').where('email', '==', email);

        // Optimization: prevent cross-college login if orgSlug is known
        if (orgSlug) {
            const collegesRef = db.collection('colleges');
            // Try to resolve orgSlug to collegeId
            let collegeId = null;
            let collegeDoc = await collegesRef.doc(orgSlug).get();
            if (collegeDoc.exists) collegeId = collegeDoc.data().collegeId;
            else {
                const slugSnap = await collegesRef.where('slug', '==', orgSlug).limit(1).get();
                if (!slugSnap.empty) collegeId = slugSnap.docs[0].data().collegeId;
            }

            if (collegeId) {
                studentsQuery = studentsQuery.where('collegeId', '==', collegeId);
            }
        }

        const studentSnapshot = await studentsQuery.limit(1).get();

        if (!studentSnapshot.empty) {
            const studentDoc = studentSnapshot.docs[0];
            const student = studentDoc.data();

            // Check College Status for student
            const collegeDoc = await db.collection('colleges').doc(student.collegeId).get();
            if (collegeDoc.exists && collegeDoc.data().status === 'SUSPENDED') {
                return res.status(403).json({ message: 'Your organization account is suspended.' });
            }

            let isValid = false;
            let isFirstLogin = student.isFirstLogin || false;

            if (isFirstLogin || !student.passwordHash) {
                // First login: password should match registerNumber
                if (password === student.registerNumber) {
                    isValid = true;
                }
            } else {
                // Subsequent login
                if (await matchPassword(password, student.passwordHash)) {
                    isValid = true;
                    isFirstLogin = false; // Confirm it's not first login flow effectively
                }
            }

            if (isValid) {
                const firebaseCustomToken = await auth.createCustomToken(student.studentId, {
                    role: 'STUDENT',
                    collegeId: student.collegeId
                });
                return res.json({
                    _id: student.studentId,
                    name: student.name,
                    email: student.email,
                    registerNumber: student.registerNumber,
                    collegeId: student.collegeId,
                    role: 'STUDENT',
                    isFirstLogin, // Frontend needs this to trigger password change modal
                    token: generateToken(student.studentId, 'STUDENT', student.collegeId),
                    firebaseCustomToken
                });
            }
            else {
                if (isFirstLogin || !student.passwordHash) {
                    return res.status(401).json({ message: 'Invalid credentials. Use your Register Number as initial password.' });
                }
            }
        }

        return res.status(401).json({ message: 'Invalid email or password' });

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

// @desc    Get public college details by slug
// @route   GET /api/auth/college/:slug
// @access  Public
const getCollegeBySlug = async (req, res) => {
    try {
        const slug = req.params.slug;
        const collegesRef = db.collection('colleges');
        // Assuming slug matches doc ID or we query by 'slug' field

        // Strategy 1: If doc ID IS the slug (which we did in ownerController)
        let doc = await collegesRef.doc(slug).get();

        // Strategy 2: If doc ID is distinct, query by slug field
        if (!doc.exists) {
            const snapshot = await collegesRef.where('slug', '==', slug).limit(1).get();
            if (!snapshot.empty) {
                doc = snapshot.docs[0];
            }
        }

        if (doc.exists) {
            const data = doc.data();
            // Return only public info
            res.json({
                collegeId: data.collegeId, // keeping consistent with schema
                collegeName: data.collegeName,
                slug: data.slug,
                logo: data.logo || null, // placeholder if we add logos later
                status: data.status
            });
        } else {
            res.status(404).json({ message: 'Organization not found' });
        }
    } catch (error) {
        console.error("Get College By Slug Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Diagnostic: Check Firebase Backend Health
// @route   GET /api/auth/health/firebase
// @access  Public
const getFirebaseHealth = async (req, res) => {
    const { initializationError, db } = require('../config/firebase');
    if (initializationError) {
        return res.status(500).json({
            ok: false,
            message: 'Firebase Initialization Failed',
            error: initializationError.message
        });
    }

    if (!db) {
        return res.status(500).json({
            ok: false,
            message: 'Firebase not initialized (db is null)'
        });
    }

    return res.json({
        ok: true,
        message: 'Firebase Admin initialized and DB available'
    });
};

// @desc    Search colleges by name
// @route   GET /api/auth/colleges/search?q=query
// @access  Public
const searchColleges = async (req, res) => {
    try {
        const { initializationError, db } = require('../config/firebase');
        const query = (req.query.q || '').trim();

        if (!query) {
            return res.json({ colleges: [] });
        }

        if (initializationError || !db) {
            console.error("[Search] Firebase unavailable:", initializationError?.message || 'DB is null');
            return res.status(500).json({
                success: false,
                message: 'Database Configuration Error',
                details: initializationError?.message || 'Firebase DB connection failed'
            });
        }

        const collegesRef = db.collection('colleges');

        // Fetch ACTIVE colleges and filter in-memory for case-insensitive robust matching
        const snapshot = await collegesRef.where('status', '==', 'ACTIVE').get();

        const colleges = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    collegeId: data.collegeId,
                    collegeName: data.collegeName || data.name,
                    slug: data.slug,
                    status: data.status
                };
            })
            .filter(c => {
                const name = (c.collegeName || '').toLowerCase();
                const slug = (c.slug || '').toLowerCase();
                const q = query.toLowerCase();
                return name.includes(q) || slug.includes(q);
            })
            .slice(0, 15);

        // Standardized response shape: { colleges: [...] }
        return res.json({ colleges });
    } catch (error) {
        console.error("[searchColleges error]", error);
        return res.status(500).json({
            success: false,
            message: "Search failed: " + error.message
        });
    }
};

// @desc    Student Login (first login: registerNumber as password)
// @route   POST /api/auth/student/login
// @access  Public
const studentLogin = async (req, res) => {
    const { email, password, orgSlug } = req.body;

    try {
        // 1. Find college by slug
        const collegesRef = db.collection('colleges');
        let collegeDoc = await collegesRef.doc(orgSlug).get();
        if (!collegeDoc.exists) {
            const snapshot = await collegesRef.where('slug', '==', orgSlug).limit(1).get();
            if (!snapshot.empty) collegeDoc = snapshot.docs[0];
        }
        if (!collegeDoc || !collegeDoc.exists) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        const collegeId = collegeDoc.data().collegeId;
        if (collegeDoc.data().status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Organization is suspended.' });
        }

        // 2. Find student by email and collegeId
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef
            .where('collegeId', '==', collegeId)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid email or credentials' });
        }

        const studentDoc = snapshot.docs[0];
        const student = studentDoc.data();

        // 3. Check password
        if (student.isFirstLogin || !student.passwordHash) {
            // First login: password should match registerNumber
            if (password !== student.registerNumber) {
                return res.status(401).json({ message: 'Invalid credentials. Use your Register Number as your initial password.' });
            }
            // Return token + flag for first login
            const firebaseCustomToken = await auth.createCustomToken(student.studentId);
            return res.json({
                _id: student.studentId,
                name: student.name,
                email: student.email,
                collegeId: student.collegeId,
                role: 'STUDENT',
                isFirstLogin: true,
                token: generateToken(student.studentId, 'STUDENT', student.collegeId),
                firebaseCustomToken
            });
        } else {
            // Subsequent login: compare hashed password
            if (!(await matchPassword(password, student.passwordHash))) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            const firebaseCustomToken = await auth.createCustomToken(student.studentId);
            return res.json({
                _id: student.studentId,
                name: student.name,
                email: student.email,
                collegeId: student.collegeId,
                role: 'STUDENT',
                isFirstLogin: false,
                token: generateToken(student.studentId, 'STUDENT', student.collegeId),
                firebaseCustomToken
            });
        }
    } catch (error) {
        console.error('Student Login Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Student set new password (after first login)
// @route   POST /api/auth/student/set-password
// @access  Private (requires token from first login)
const studentSetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const studentId = req.user.id; // From protect middleware

    try {
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const studentRef = db.collection('students').doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await studentRef.update({
            passwordHash,
            isFirstLogin: false
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Set Password Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { loginUser, getMe, registerOwner, googleLogin, getCollegeBySlug, searchColleges, studentLogin, studentSetPassword, getFirebaseHealth };
