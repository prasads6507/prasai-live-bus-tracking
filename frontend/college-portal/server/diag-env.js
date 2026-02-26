require('dotenv').config();
const key = process.env.FIREBASE_PRIVATE_KEY;
console.log('Key length:', key ? key.length : 0);
if (key) {
    console.log('Starts with quote:', key.startsWith('"'));
    console.log('Ends with quote:', key.endsWith('"'));
    console.log('First 50 chars:', key.substring(0, 50));
    console.log('Last 50 chars:', key.substring(key.length - 50));

    const processed = key.replace(/\\n/g, '\n').trim();
    console.log('Processed length:', processed.length);
    console.log('Processed Last 50:', processed.substring(processed.length - 50));

    // Check for BEGIN/END tags
    console.log('Has BEGIN:', processed.includes('-----BEGIN PRIVATE KEY-----'));
    console.log('Has END:', processed.includes('-----END PRIVATE KEY-----'));
}
