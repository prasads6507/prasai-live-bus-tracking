const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user info to request
            req.user = decoded;

            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);

            // Provide specific error message for token expiry
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Session expired. Please log in again.',
                    code: 'TOKEN_EXPIRED'
                });
            }

            return res.status(401).json({
                message: 'Not authorized, token failed',
                code: 'TOKEN_INVALID'
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
