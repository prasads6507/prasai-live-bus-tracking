const admin = require('firebase-admin');

let db = null;
let auth = null;
let initializationError = null;

// Helper to provide clear missing var reports for diagnostics
const getMissingReport = () => {
    return {
        projectId: !!process.env.FIREBASE_PROJECT_ID,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY
    };
};

try {
    const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    let privateKeyRaw = (process.env.FIREBASE_PRIVATE_KEY || '').trim();

    if (!projectId || !clientEmail || !privateKeyRaw) {
        const report = getMissingReport();
        throw new Error(`Missing configuration: ${Object.keys(report).filter(k => !report[k]).join(', ')}`);
    }

    // Robust stripping: remove leading/trailing double or single quotes that might be copy-pasted
    if ((privateKeyRaw.startsWith('"') && privateKeyRaw.endsWith('"')) ||
        (privateKeyRaw.startsWith("'") && privateKeyRaw.endsWith("'"))) {
        console.log("[Firebase] Stripping wrapper quotes from PRIVATE_KEY");
        privateKeyRaw = privateKeyRaw.slice(1, -1);
    }

    // Convert mangled newlines (common in Vercel/CI envs)
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey
            })
        });
        console.log(`[Firebase] Successfully initialized for project: ${projectId}`);
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

