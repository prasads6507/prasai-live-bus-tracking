const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with Service Account from Individual Environment Variables
// This approach is more reliable for deployment platforms like Vercel
// where JSON strings with newlines can be problematic.

try {
    // Check for required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
        throw new Error('Missing required Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)');
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
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
