const { parsePrivateKey } = require('./config/firebase');
require('dotenv').config();

function test() {
    console.log('--- Firebase Env Diagnostic ---');
    console.log('PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'MISSING');
    console.log('CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL || 'MISSING');

    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    console.log('PRIVATE_KEY exists:', !!rawKey);

    if (rawKey) {
        console.log('PRIVATE_KEY length:', rawKey.length);
        console.log('PRIVATE_KEY starts with BEGIN tag:', rawKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'));

        const parsed = parsePrivateKey(rawKey);
        if (parsed) {
            console.log('✅ PRIVATE_KEY parsed successfully');
            console.log('Parsed key length:', parsed.length);
            console.log('Contains real newlines:', parsed.includes('\n'));
        } else {
            console.error('❌ PRIVATE_KEY parsing FAILED');
            // Check for common issues
            if (rawKey.includes('\\n')) {
                console.log('Note: Contains literal \\n (expected for .env)');
            } else if (rawKey.includes('\n')) {
                console.log('Note: Contains real newlines');
            }
        }
    }
}

test();
