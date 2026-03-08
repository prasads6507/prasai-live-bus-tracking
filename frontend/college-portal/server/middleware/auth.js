const { auth, db } = require('../config/firebase');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // 1. Verify Firebase ID Token
            const decodedToken = await auth.verifyIdToken(token);
            const uid = decodedToken.uid;

            // 2. Fetch User Profile from Firestore to get role and collegeId
            // Search order: 1. Root users, 2. Scoped users, 3. Scoped students
            let userDoc = await db.collection('users').doc(uid).get();
            let userData = userDoc.exists ? userDoc.data() : null;

            if (!userData) {
                // Search across all 'users' sub-collections 
                const userQuery = await db.collectionGroup('users').where('userId', '==', uid).limit(1).get();
                if (!userQuery.empty) {
                    userData = userQuery.docs[0].data();
                } else {
                    // Search across all 'students' sub-collections
                    const studentQuery = await db.collectionGroup('students').where('studentId', '==', uid).limit(1).get();
                    if (!studentQuery.empty) {
                        userData = studentQuery.docs[0].data();
                        userData.role = 'STUDENT';
                    }
                }
            }

            if (!userData) {
                console.error(`[AuthMiddleware] User profile not found for UID: ${uid}`);
                return res.status(401).json({
                    message: 'User profile not found. Please log in again.',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Attach user info to request
            req.user = {
                id: uid,
                _id: uid,
                email: userData.email,
                role: userData.role,
                collegeId: userData.collegeId
            };

            next();
        } catch (error) {
            console.error('Firebase token verification failed:', error.message);

            if (error.code === 'auth/id-token-expired') {
                return res.status(401).json({
                    message: 'Session expired. Please log in again.',
                    code: 'TOKEN_EXPIRED'
                });
            }

            return res.status(401).json({
                message: 'Not authorized, token failed',
                code: 'TOKEN_INVALID',
                error: error.message
            });
        }
    } else {
        return res.status(401).json({
            message: 'Not authorized, no token',
            code: 'NO_TOKEN'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
