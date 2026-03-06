const errorHandler = (err, req, res, next) => {
    // Log with full detail in production for easier Vercel debugging
    console.error(`[ERROR] ${req.method} ${req.originalUrl || req.url}:`, {
        message: err.message,
        code: err.code,
        status: err.status || res.statusCode,
        stack: err.stack
    });

    let statusCode = err.status || (res.statusCode === 200 ? 500 : res.statusCode);
    let message = err.message || "Internal Server Error";

    // Handle Firebase Quota Exceeded
    if (message && (message.includes('Quota exceeded') || message.includes('RESOURCE_EXHAUSTED'))) {
        statusCode = 429;
        message = 'Firebase Quota Exceeded: The free tier limit for Firestore has been reached for today. The portal will be available again after the daily reset (PST midnight) or upon upgrading the Firebase plan.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        errorType: err.code || 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;
