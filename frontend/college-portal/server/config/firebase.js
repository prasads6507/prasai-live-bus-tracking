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

    // Ultimate Foolproof PEM Reconstructor for Vercel
    // Extracts the base64 payload regardless of how mangled the user input is 
    // (escaped newlines, spaces, quotes, missing newlines) and rebuilds a valid PEM.
    let base64Payload = privateKeyRaw
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\\n/g, '') // remove literal \n
        .replace(/\r/g, '')  // remove carriage returns
        .replace(/\n/g, '')  // remove actual newlines
        .replace(/\"/g, '')  // remove quotes
        .replace(/\'/g, '')  // remove quotes
        .replace(/\s+/g, ''); // remove any other whitespaces/tabs

    // A valid PEM chunks the base64 payload into 64-character lines
    let formattedKey = '';
    for (let i = 0; i < base64Payload.length; i += 64) {
        formattedKey += base64Payload.substring(i, i + 64) + '\n';
    }

    const privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey.trim()}\n-----END PRIVATE KEY-----\n`;

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

