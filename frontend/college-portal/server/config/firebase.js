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

    if (admin.apps.length > 0) {
        console.log('[Firebase] Already initialized, reusing existing app');
    } else {
        console.log('[Firebase] Cold start: Initializing app...');

        // 1. Check environment variables first (Preferred for Vercel/Production)
        const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
        const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';

        if (projectId && clientEmail && privateKeyRaw) {
            console.log(`[Firebase] Attempting to initialize with Env Vars. Project: ${projectId}, Email: ${clientEmail}`);
            const privateKey = parsePrivateKey(privateKeyRaw);
            if (privateKey) {
                serviceAccount = {
                    projectId,
                    clientEmail,
                    privateKey
                };
                console.log('[Firebase] Env Var credentials parsed successfully');
            } else {
                console.warn('[Firebase] Env Var credentials found but Private Key parsing failed (check tags or escaping)');
            }
        }

        // 2. Fallback to local JSON files (for local development)
        if (!serviceAccount) {
            console.log('[Firebase] No valid Env Vars, checking local files...');
            for (const file of serviceAccountFiles) {
                const fullPath = path.join(__dirname, '..', file);
                if (fs.existsSync(fullPath)) {
                    try {
                        serviceAccount = require(fullPath);
                        console.log(`[Firebase] Using JSON file: ${file}`);
                        break;
                    } catch (e) {
                        console.error(`[Firebase] Error loading ${file}:`, e.message);
                    }
                }
            }
        }

        if (!serviceAccount) {
            const missing = [];
            if (!projectId) missing.push('FIREBASE_PROJECT_ID');
            if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
            if (!privateKeyRaw) missing.push('FIREBASE_PRIVATE_KEY');

            throw new Error(`Firebase Configuration Incomplete. Missing: ${missing.join(', ') || 'No valid source found'}`);
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        const activeProject = serviceAccount.project_id || serviceAccount.projectId;
        console.log(`[Firebase] Admin SDK Initialized for: ${activeProject}`);
    }

    db = admin.firestore();
    auth = admin.auth();
} catch (error) {
    initializationError = error;
    console.error('[Firebase Critical Error]', {
        message: error.message,
        stack: error.stack
    });
}

/**
 * Helper to get a college-scoped collection reference
 * Structure: /colleges/{collegeId}/{collectionName}
 */
const getCollegeCollection = (collegeId, collectionName) => {
    if (!db) {
        console.error(`[Firebase] Attempted to access collection ${collectionName} but DB is not initialized.`);
        throw new Error('Database not initialized');
    }
    if (!collegeId) {
        console.error(`[Firebase] Attempted to access collection ${collectionName} without a collegeId.`);
        throw new Error('College ID required for this operation');
    }
    return db.collection('colleges').doc(collegeId).collection(collectionName);
};

module.exports = {
    admin,
    db,
    auth,
    getCollegeCollection,
    initializationError,
    parsePrivateKey,
    messaging: admin.apps.length ? admin.messaging() : null
};
