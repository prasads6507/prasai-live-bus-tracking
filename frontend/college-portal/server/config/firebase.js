const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let auth = null;
let initializationError = null;

const serviceAccountFiles = [
    'live-bus-tracking-2ec59-firebase-adminsdk-fbsvc-c51ffbf7e4.json',
    'live-bus-tracking-2ec59-firebase-adminsdk-fbsvc-1dfd9cf3ef.json'
];

try {
    let serviceAccount = null;

    // 1. Try local JSON files first (More reliable than corrupted .env)
    for (const file of serviceAccountFiles) {
        const fullPath = path.join(__dirname, '..', file);
        if (fs.existsSync(fullPath)) {
            try {
                serviceAccount = require(fullPath);
                console.log(`[Firebase] Using service account file: ${file}`);
                break;
            } catch (e) {
                console.error(`[Firebase] Failed to load ${file}:`, e.message);
            }
        }
    }

    // 2. Fallback to .env if no JSON file worked
    if (!serviceAccount) {
        const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
        const privateKeyRaw = (process.env.FIREBASE_PRIVATE_KEY || '').trim();

        if (projectId && clientEmail && privateKeyRaw) {
            const privateKey = privateKeyRaw.replace(/\\n/g, '\n').replace(/"/g, '');
            serviceAccount = { projectId, clientEmail, privateKey };
        }
    }

    if (!serviceAccount) {
        throw new Error('Missing Firebase Admin configuration (JSON and .env failed)');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log(`[Firebase] Successfully initialized for project: ${serviceAccount.project_id || serviceAccount.projectId}`);
    }

    db = admin.firestore();
    auth = admin.auth();
} catch (error) {
    initializationError = error;
    console.error('[Firebase Init Error]', error.message);
}

module.exports = {
    admin,
    db,
    auth,
    initializationError,
    messaging: admin.apps.length ? admin.messaging() : null
};
