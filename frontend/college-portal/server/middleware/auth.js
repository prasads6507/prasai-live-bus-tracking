const { auth, db } = require('../config/firebase');

/**
 * Middleware to protect routes and verify Firebase ID tokens.
 * Supports hierarchical multi-tenant structure by checking custom claims first.
 */
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

            // 2. Fetch User Profile
            // Tiered Lookup Strategy:
            // - Priority 1: Use 'role' and 'collegeId' claims for a direct, indexed hit.
            // - Priority 2: Check root 'users' for legacy/global OWNER accounts.
            // - Priority 3: Fallback to collectionGroup if claims are missing.

            let userData = null;
            const role = decodedToken.role;
            const collegeId = decodedToken.collegeId;

            // Direct Scoped Lookup (Performance optimized)
            if (collegeId && role) {
                const colName = role === 'STUDENT' ? 'students' : 'users';
                const docSnap = await db.collection('colleges').doc(collegeId).collection(colName).doc(uid).get();
                if (docSnap.exists) {
                    userData = docSnap.data();
                    if (role === 'STUDENT') userData.role = 'STUDENT';
                }
            }

            // Fallback Lookups
            if (!userData) {
                try {
                    // Tier 1: Check root 'users' (Global Owners) - Stable, no index needed
                    const rootDoc = await db.collection('users').doc(uid).get();
                    if (rootDoc.exists) {
                        userData = rootDoc.data();
                    } else {
                        // Tier 2: CollectionGroup (Risk of FAILED_PRECONDITION if index missing)
                        // Wrap in try-catch to prevent a missing index from crashing the middleware
                        try {
                            const userQuery = await db.collectionGroup('users').where('userId', '==', uid).limit(1).get();
                            if (!userQuery.empty) {
                                userData = userQuery.docs[0].data();
                            } else {
                                const studentQuery = await db.collectionGroup('students').where('studentId', '==', uid).limit(1).get();
                                if (!studentQuery.empty) {
                                    userData = studentQuery.docs[0].data();
                                    userData.role = 'STUDENT';
                                }
                            }
                        } catch (groupError) {
                            console.warn(`[AuthMiddleware] CollectionGroup lookup failed for UID ${uid}:`, groupError.message);
                        }
                    }
                } catch (error) {
                    console.error('[AuthMiddleware] Fallback lookup error:', error.message);
                }
            }

            if (!userData) {
                console.warn(`[AuthMiddleware] User profile not found for UID: ${uid}`);
                return res.status(401).json({
                    message: 'User profile not found. Please log in again.',
                    code: 'USER_NOT_FOUND'
                });
            }

            // 3. Attach Scoped User to Request
            req.user = {
                id: uid,
                _id: uid,
                email: userData.email,
                role: userData.role,
                collegeId: userData.collegeId || collegeId
            };

            next();
        } catch (error) {
            console.error('[AuthMiddleware] Verification Error:', error.message);

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

/**
 * Middleware to restrict access based on user roles.
 */
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
