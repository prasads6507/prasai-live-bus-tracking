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

/**
 * Bulletproof private key parser.
 * Handles ALL formats:
 *   - Vercel: stores the key with real newlines (no escaping needed)
 *   - .env files: stores the key with literal \n that need replacing
 *   - Quoted keys: wrapped in " or '
 *   - Garbage text after the closing -----END PRIVATE KEY----- marker
 */
function parsePrivateKey(raw) {
    if (!raw) return null;

    let key = raw.trim();

    // Strip surrounding quotes if present
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
    }

    // Convert literal \n (from .env files) to real newlines
    key = key.replace(/\\n/g, '\n');

    // Extract only the valid PEM block and discard any garbage before/after
    const beginTag = '-----BEGIN PRIVATE KEY-----';
    const endTag = '-----END PRIVATE KEY-----';
    const startIdx = key.indexOf(beginTag);
    const endIdx = key.indexOf(endTag);

    if (startIdx === -1 || endIdx === -1) {
        console.error('[Firebase] Private key is missing BEGIN/END tags');
        return null;
    }

    // Trim to just the valid PEM content
    key = key.substring(startIdx, endIdx + endTag.length).trim() + '\n';

    return key;
}

try {
    let serviceAccount = null;

    // 1. Try local JSON files first (for local development)
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

    // 2. Fallback to environment variables (for Vercel and production)
    if (!serviceAccount) {
        const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';

        if (projectId && clientEmail && privateKeyRaw) {
            const privateKey = parsePrivateKey(privateKeyRaw);
            if (privateKey) {
                serviceAccount = { projectId, clientEmail, privateKey };
                console.log('[Firebase] Using environment variable credentials');
            } else {
                throw new Error('FIREBASE_PRIVATE_KEY is present but could not be parsed as a valid PEM key');
            }
        }
    }

    if (!serviceAccount) {
        throw new Error('Missing Firebase Admin configuration: no JSON file and no valid environment variables found');
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
