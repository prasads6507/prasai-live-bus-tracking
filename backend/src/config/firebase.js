const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with Service Account
// Found at: src/config/live-bus-tracking-2ec59-firebase-adminsdk-fbsvc-12aa6fcdd6.json
try {
    const serviceAccount = require('./live-bus-tracking-2ec59-firebase-adminsdk-fbsvc-12aa6fcdd6.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log(`Firebase Admin Initialized (Local Service Account) - Project: ${serviceAccount.project_id}`);
} catch (error) {
    console.error("Firebase Initialization Error:", error);
    // Fallback to default if file moved
    admin.initializeApp();
    console.log("Firebase Admin Initialized (Default Fallback)");
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
