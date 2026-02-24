const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, 'live-bus-tracking-2ec59-firebase-adminsdk-fbsvc-c51ffbf7e4.json');
try {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
    });
    console.log('[Migration] Firebase Admin initialized.');
} catch (e) {
    console.error('[Migration] Failed to initialize Firebase:', e.message);
    process.exit(1);
}

const db = admin.firestore();

async function migrate() {
    console.log('\n--- Starting Data Migration: Trip & Bus Statuses ---\n');

    let busCount = 0;
    let tripCount = 0;

    // 1. Migrate Buses
    console.log('Migrating Buses...');
    const busesSnapshot = await db.collection('buses').get();
    const busBatch = db.batch();
    let busBatchCount = 0;

    for (const doc of busesSnapshot.docs) {
        const data = doc.data();
        const oldStatus = data.status;
        let newStatus = oldStatus;

        // Normalize Bus Status
        if (!data.activeTripId || data.activeTripId === null) {
            newStatus = 'IDLE';
        } else if (['MOVE', 'ACTIVE', 'ON_ROUTE'].includes(oldStatus)) {
            newStatus = 'ON_ROUTE';
        } else if (oldStatus === 'IDLE' && data.activeTripId) {
            // Bus has an active trip but status is IDLE? Correct to ON_ROUTE
            newStatus = 'ON_ROUTE';
        }

        if (newStatus !== oldStatus || data.activeTripId === undefined) {
            busBatch.update(doc.ref, {
                status: newStatus,
                activeTripId: data.activeTripId || null,
                currentTripId: data.currentTripId || data.activeTripId || null, // Legacy sync
                speed: data.speed || 0,
                speedMph: data.speedMph || data.speed || 0
            });
            busCount++;
            busBatchCount++;
        }

        if (busBatchCount >= 400) {
            await busBatch.commit();
            busBatchCount = 0;
        }
    }
    if (busBatchCount > 0) await busBatch.commit();
    console.log(`Updated ${busCount} bus documents.`);

    // 2. Migrate Trips
    console.log('\nMigrating Trips...');
    const tripsSnapshot = await db.collection('trips').get();
    let tripBatch = db.batch();
    let tripBatchCount = 0;

    for (const doc of tripsSnapshot.docs) {
        const data = doc.data();
        const oldStatus = (data.status || '').toUpperCase();
        let newStatus = oldStatus;
        let isActive = data.isActive;

        // Normalize Trip Status
        if (['ACTIVE', 'START', 'STARTED'].includes(oldStatus)) {
            newStatus = 'ACTIVE';
            isActive = true;
        } else if (['COMPLETED', 'DONE', 'ENDED', 'FINISH'].includes(oldStatus)) {
            newStatus = 'COMPLETED';
            isActive = false;
        } else if (['CANCELLED', 'CANCEL'].includes(oldStatus)) {
            newStatus = 'CANCELLED';
            isActive = false;
        } else if (!oldStatus) {
            // Default based on isActive if status is missing
            newStatus = data.isActive ? 'ACTIVE' : 'COMPLETED';
            isActive = data.isActive === undefined ? false : data.isActive;
        }

        const needsUpdate = newStatus !== data.status || isActive !== data.isActive;

        if (needsUpdate) {
            tripBatch.update(doc.ref, {
                status: newStatus,
                isActive: isActive
            });
            tripCount++;
            tripBatchCount++;
        }

        if (tripBatchCount >= 400) {
            await tripBatch.commit();
            tripBatch = db.batch();
            tripBatchCount = 0;
        }
    }
    if (tripBatchCount > 0) await tripBatch.commit();
    console.log(`Updated ${tripCount} trip documents.`);

    console.log('\n--- Migration Complete ---\n');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
