const admin = require('firebase-admin');
const path = require('path');

let initializationError = null;
let db = null;
let auth = null;

// Load environment variables
try {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch (e) { }

// Singleton pattern
if (!admin.apps.length) {
    try {
        let projectId = process.env.FIREBASE_PROJECT_ID;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!projectId || !privateKey || !clientEmail) {
            throw new Error(`Missing vars: ProjectId=${!!projectId}, Email=${!!clientEmail}, Key=${!!privateKey}`);
        }

        // Clean keys (remove quotes if user added them)
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }

        // Handle newlines
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                privateKey: formattedPrivateKey,
                clientEmail
            })
        });

        console.log(`Firebase Admin Initialized: ${projectId}`);
    } catch (error) {
        console.error("Firebase Init Failed:", error.message);
        initializationError = error;
    }
}

// Only initialize services if no error
if (!initializationError && admin.apps.length) {
    try {
        db = admin.firestore();
        auth = admin.auth();
    } catch (e) {
        initializationError = e;
    }
}

module.exports = { admin, db, auth, messaging: admin.messaging(), initializationError };

