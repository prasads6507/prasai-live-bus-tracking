module.exports = (req, res) => {
    res.json({
        ok: true,
        message: 'Diagnostic function loaded successfully',
        node: process.version,
        env: {
            FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
            FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
            FIREBASE_PRIVATE_KEY_START: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) : '',
            FIREBASE_PRIVATE_KEY_END: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(process.env.FIREBASE_PRIVATE_KEY.length - 20) : '',
            JWT_SECRET: !!process.env.JWT_SECRET
        }
    });
};
