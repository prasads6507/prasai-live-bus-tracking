const { admin, db } = require('./config/firebase');

const COLLECTIONS_TO_CLEAN = [
    'buses',
    'routes',
    'trips',
    'students',
    'user_notifications',
    'stopArrivals',
    'attendance',
    'notifications',
    'handoffs',
    'stops'
];

async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next process tick, to avoid
    // spreading the stack.
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

async function cleanUsers() {
    console.log('Cleaning root users (preserving OWNERS)...');
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    let deletedCount = 0;
    let skippedCount = 0;
    const batch = db.batch();
    let batchOpCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.role === 'OWNER') {
            skippedCount++;
            continue;
        }

        batch.delete(doc.ref);
        deletedCount++;
        batchOpCount++;

        if (batchOpCount >= 400) {
            await batch.commit();
            batchOpCount = 0;
        }
    }

    if (batchOpCount > 0) {
        await batch.commit();
    }

    console.log(`Finished Users Cleanup: ${deletedCount} deleted, ${skippedCount} skipped (OWNERs).`);
}

async function runCleanup() {
    console.log('Starting Firestore Root Cleanup...');

    try {
        for (const col of COLLECTIONS_TO_CLEAN) {
            console.log(`Cleaning collection: ${col}...`);
            await deleteCollection(col);
            console.log(`Finished collection: ${col}`);
        }

        await cleanUsers();

        console.log('\nCleanup Completed Successfully!');
    } catch (error) {
        console.error('Cleanup Failed:', error);
        process.exit(1);
    }
}

runCleanup();
