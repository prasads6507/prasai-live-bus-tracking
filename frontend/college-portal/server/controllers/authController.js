const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, admin, auth, initializationError, getCollegeCollection } = require('../config/firebase');

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
    const normalizedEmail = String(email || '').toLowerCase().trim();

    try {
        console.log(`[Login] Attempt for ${normalizedEmail} (Org: ${orgSlug || 'Global'})`);

        let collegeId = null;
        let collegeData = null;

        // 1. Resolve College Context if orgSlug is provided
        if (orgSlug) {
            const collegesRef = db.collection('colleges');
            let collegeDoc = await collegesRef.doc(orgSlug).get();
            if (!collegeDoc.exists) {
                const slugSnap = await collegesRef.where('slug', '==', orgSlug).limit(1).get();
                if (!slugSnap.empty) collegeDoc = slugSnap.docs[0];
            }

            if (collegeDoc.exists) {
                collegeId = collegeDoc.id;
                collegeData = collegeDoc.data();
                if (collegeData.status === 'SUSPENDED') {
                    return res.status(403).json({ message: 'Your organization account is suspended.' });
                }
            } else {
                console.warn(`[Login] Organization ${orgSlug} not found`);
                return res.status(404).json({ message: 'Organization not found' });
            }
        }

        let userData = null;
        let loginType = null; // 'USER' or 'STUDENT'

        // 2. Search in Hierarchy if collegeId is known
        if (collegeId) {
            // Check Scoped Users (Admin, Driver)
            const scopedUserSnap = await getCollegeCollection(collegeId, 'users').where('email', '==', normalizedEmail).limit(1).get();
            if (!scopedUserSnap.empty) {
                userData = scopedUserSnap.docs[0].data();
                loginType = 'USER';
            } else {
                // Check Scoped Students
                const scopedStudentSnap = await getCollegeCollection(collegeId, 'students').where('email', '==', normalizedEmail).limit(1).get();
                if (!scopedStudentSnap.empty) {
                    userData = scopedStudentSnap.docs[0].data();
                    loginType = 'STUDENT';
                }
            }
        }

        // 3. Fallback: Search GLOBAL Users (Owners) and cross-tenant users if still not found
        if (!userData) {
            const globalUserSnap = await db.collectionGroup('users').where('email', '==', normalizedEmail).limit(1).get();
            if (!globalUserSnap.empty) {
                const docSnap = globalUserSnap.docs[0];
                userData = docSnap.data();

                // If it's a scoped user (has collegeId) but we found them via collectionGroup because no orgSlug was provided
                if (userData.collegeId) {
                    collegeId = userData.collegeId;
                }
                loginType = 'USER';
                // Security: Global users must be OWNERs (except for migration period)
                if (userData.role !== 'OWNER' && orgSlug) {
                    // If they are not owner but logged into a specific slug, they should have been found in the scoped search
                    // If we found them here, it means they are currently "mixed up" at the root.
                    // We allow this temporarily for migration, but enforce collegeId match.
                    if (userData.collegeId !== collegeId && userData.collegeId !== orgSlug) {
                        console.warn(`[Login] Organization Mismatch for legacy user ${userData.email}`);
                        return res.status(401).json({ message: 'Invalid Organization for this account.' });
                    }
                }
            }
        }

        if (!userData) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 4. Verify Credentials
        let isValid = false;
        let isFirstLogin = userData.isFirstLogin || false;

        if (loginType === 'STUDENT' && (isFirstLogin || !userData.passwordHash)) {
            // Student first login logic
            if (String(password).trim() === String(userData.registerNumber || '').trim()) {
                isValid = true;
                isFirstLogin = true;
            }
        } else {
            // Standard password check
            if (await matchPassword(password, userData.passwordHash)) {
                isValid = true;
            }
        }

        if (!isValid) {
            if (loginType === 'STUDENT' && (isFirstLogin || !userData.passwordHash)) {
                return res.status(401).json({ message: 'Invalid credentials. Use your Register Number as initial password.' });
            }
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 5. Success - Generate tokens and custom claims
        const finalCollegeId = userData.collegeId || collegeId;
        const firebaseCustomToken = await auth.createCustomToken(userData.userId || userData.studentId, {
            role: userData.role || 'STUDENT',
            collegeId: finalCollegeId
        });

        const response = {
            _id: userData.userId || userData.studentId,
            name: userData.name,
            email: userData.email,
            role: userData.role || 'STUDENT',
            collegeId: finalCollegeId,
            token: generateToken(userData.userId || userData.studentId, userData.role || 'STUDENT', finalCollegeId),
            firebaseCustomToken
        };

        if (loginType === 'STUDENT') {
            response.isFirstLogin = isFirstLogin;
            response.registerNumber = userData.registerNumber;
        }

        console.log(`[Login] Successful login for ${userData.email} (${response.role})`);
        return res.json(response);

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
    const normalizedEmail = (email || '').toLowerCase().trim();

    try {
        const userQuery = await db.collectionGroup('users').where('email', '==', normalizedEmail).limit(1).get();

        if (!userQuery.empty) { // Corrected logic: if userQuery is NOT empty, user exists
            return res.status(400).json({ message: 'User already exists' });
        }

        const userId = 'owner-' + Date.now();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = {
            userId,
            name,
            email: normalizedEmail,
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
        const userId = req.user.id;
        const collegeId = req.user.collegeId;

        let userData = null;

        // 1. Try Scoped Search if collegeId is available in token
        if (collegeId && collegeId !== 'OWNER_GLOBAL') {
            const scopedSnap = await getCollegeCollection(collegeId, 'users').doc(userId).get();
            if (scopedSnap.exists) {
                userData = scopedSnap.data();
            } else {
                // Try as student
                const studentSnap = await getCollegeCollection(collegeId, 'students').doc(userId).get();
                if (studentSnap.exists) {
                    userData = studentSnap.data();
                }
            }
        }

        // 2. Try Global Search (for Owners or missing context)
        if (!userData) {
            const globalSnap = await db.collection('users').doc(userId).get();
            if (globalSnap.exists) {
                userData = globalSnap.data();
            }
        }

        if (userData) {
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
        const normalizedEmail = (email || '').toLowerCase().trim();

        const usersRef = db.collection('users');
        const snapshot = await db.collectionGroup('users').where('email', '==', normalizedEmail).limit(1).get();

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
            userId = userData.userId || userData.studentId;

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

// In-memory cache for colleges list to reduce Firestore reads
let cachedColleges = {
    data: null,
    lastUpdate: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// @desc    Search colleges by name
// @route   GET /api/auth/colleges/search?q=query
// @access  Public
const searchColleges = async (req, res) => {
    try {
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

        // Efficiency optimization: Use in-memory cache if valid
        let collegesSource;
        const now = Date.now();

        if (cachedColleges.data && (now - cachedColleges.lastUpdate < CACHE_TTL)) {
            collegesSource = cachedColleges.data;
        } else {
            console.log("[Search] Cache expired or empty, fetching from Firestore...");
            // Fetch ACTIVE colleges
            const snapshot = await collegesRef.where('status', '==', 'ACTIVE').get();
            collegesSource = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    collegeId: data.collegeId,
                    collegeName: data.collegeName || data.name,
                    slug: data.slug,
                    status: data.status
                };
            });
            // Update cache
            cachedColleges.data = collegesSource;
            cachedColleges.lastUpdate = now;
        }

        const filteredColleges = collegesSource
            .filter(c => {
                const name = (c.collegeName || '').toLowerCase();
                const slug = (c.slug || '').toLowerCase();
                const q = query.toLowerCase();
                return name.includes(q) || slug.includes(q);
            })
            .slice(0, 15);

        // Standardized response shape: { colleges: [...] }
        return res.json({ colleges: filteredColleges });
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
        const collegeId = collegeDoc.id;
        if (collegeDoc.data().status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Organization is suspended.' });
        }

        // 2. Find student by email in Scoped Collection
        const normalizedEmail = String(email || '').toLowerCase().trim();
        const snapshot = await getCollegeCollection(collegeId, 'students')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid email or credentials' });
        }

        const studentDoc = snapshot.docs[0];
        const student = studentDoc.data();

        // 3. Check password
        if (student.isFirstLogin || !student.passwordHash) {
            // First login: password should match registerNumber (harden with String/trim)
            if (String(password).trim() !== String(student.registerNumber || '').trim()) {
                return res.status(401).json({ message: 'Invalid credentials. Use your Register Number as your initial password.' });
            }
            // Return token + flag for first login
            const firebaseCustomToken = await auth.createCustomToken(student.studentId, {
                role: 'STUDENT',
                collegeId: student.collegeId
            });
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
            const firebaseCustomToken = await auth.createCustomToken(student.studentId, {
                role: 'STUDENT',
                collegeId: student.collegeId
            });
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
    const studentId = req.user.id;
    const collegeId = req.user.collegeId;

    try {
        if (!collegeId) return res.status(400).json({ message: 'Missing college context' });

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const studentRef = getCollegeCollection(collegeId, 'students').doc(studentId);
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
