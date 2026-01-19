const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with Service Account from Environment Variable
// SECURITY: Never commit service account credentials to version control
try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required');
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log(`Firebase Admin Initialized - Project: ${serviceAccount.project_id}`);
} catch (error) {
    console.error("Firebase Initialization Error:", error.message);
    process.exit(1); // Exit if Firebase can't initialize - critical failure
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
