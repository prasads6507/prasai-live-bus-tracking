const admin = require('firebase-admin');
const path = require('path');

// Load environment variables - try multiple paths for Vercel compatibility
try {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {
    // dotenv may not exist in production, that's okay
}

// Singleton pattern - only initialize if not already initialized
if (!admin.apps.length) {
    try {
        // Check for required environment variables
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!projectId || !privateKey || !clientEmail) {
            console.error('Missing required Firebase environment variables:');
            console.error(`  FIREBASE_PROJECT_ID: ${projectId ? 'SET' : 'MISSING'}`);
            console.error(`  FIREBASE_PRIVATE_KEY: ${privateKey ? 'SET (length: ' + privateKey.length + ')' : 'MISSING'}`);
            console.error(`  FIREBASE_CLIENT_EMAIL: ${clientEmail ? 'SET' : 'MISSING'}`);
            throw new Error('Missing required Firebase environment variables');
        }

        // Replace escaped newlines with actual newlines (Vercel stores them escaped)
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                privateKey: formattedPrivateKey,
                clientEmail: clientEmail
            })
        });

        console.log(`Firebase Admin Initialized - Project: ${projectId}`);
    } catch (error) {
        console.error("Firebase Initialization Error:", error.message);
        // Don't exit - let the request handler return a proper error
        throw error;
    }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };

