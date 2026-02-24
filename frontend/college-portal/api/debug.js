// Minimal diagnostic: does the serverless function even load?
module.exports = (req, res) => {
    res.json({
        ok: true,
        message: 'Diagnostic function loaded successfully',
        node: process.version,
        env: {
            FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
            FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
            JWT_SECRET: !!process.env.JWT_SECRET
        }
    });
};
