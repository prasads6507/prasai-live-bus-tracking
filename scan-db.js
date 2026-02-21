const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin (adjust path to your service account key or use default)
// Assuming we are running this in the server directory
const serviceAccountPath = path.join(__dirname, 'frontend', 'college-portal', 'server', 'config', 'firebaseServiceAccount.json');
let db;

try {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        admin.initializeApp(); // relies on GOOGLE_APPLICATION_CREDENTIALS
    }
    db = admin.firestore();
} catch (e) {
    console.error('Failed to init firebase:', e);
    process.exit(1);
}

async function scan() {
    console.log('Scanning DB...');
    const buses = await db.collection('buses').get();
    let subTripsTotal = 0;

    for (const bus of buses.docs) {
        const trips = await bus.ref.collection('trips').get();
        if (!trips.empty) {
            console.log(`Bus ${bus.id} has ${trips.size} trips in subcollection.`);
            subTripsTotal += trips.size;
        }
    }

    console.log(`Total trips in bus subcollections: ${subTripsTotal}`);

    const rootTrips = await db.collection('trips').get();
    console.log(`Total trips in ROOT collection: ${rootTrips.size}`);
}

scan().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
