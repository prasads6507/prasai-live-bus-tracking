const tenantIsolation = (req, res, next) => {
    // Ensure user is authenticated via protect middleware first
    if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }

    // If user is OWNER, they can specify collegeId or access all
    if (req.user.role === 'OWNER') {
        // If collegeId is provided in request, we allow it (for managing specific college)
        // Otherwise, we don't enforce a specific college context
        return next();
    }

    // For all other roles, STRICTLY enforce collegeId from their token
    // We override any input collegeId with the one from the token
    req.collegeId = req.user.collegeId;

    // Also enforce it in body and query to prevent accidents
    if (req.body) req.body.collegeId = req.user.collegeId;
    if (req.query) req.query.collegeId = req.user.collegeId;
    if (req.params && req.params.collegeId) {
        if (req.params.collegeId !== req.user.collegeId) {
            return res.status(403).json({ message: 'Access to this college data is forbidden' });
        }
    }

    next();
};

module.exports = tenantIsolation;
