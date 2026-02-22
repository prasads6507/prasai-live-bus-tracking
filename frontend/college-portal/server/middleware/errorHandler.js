const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url}:`, err.message);

    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;

    // Handle Firebase Quota Exceeded
    if (err.message && (err.message.includes('Quota exceeded') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        statusCode = 429;
        message = 'Firebase Quota Exceeded: The free tier limit for Firestore has been reached for today. The portal will be available again after the daily reset (PST midnight) or upon upgrading the Firebase plan.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        errorType: err.code || 'UNKNOWN_ERROR',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;
