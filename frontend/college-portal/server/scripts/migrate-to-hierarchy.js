const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin (Use environmental variables or service account file)
let db;
try {
    if (admin.apps.length === 0) {
        // Attempt to find service account
        const serviceAccountPath = path.join(__dirname, '../config/serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            admin.initializeApp();
        }
    }
    db = admin.firestore();
    console.log("Firebase Admin Initialized successfully.");
} catch (error) {
    console.error("Firebase Initialization Error:", error);
    process.exit(1);
}

const COLLECTIONS_TO_MIGRATE = [
    'users',
    'students',
    'buses',
    'routes',
    'stops',
    'trips',
    'attendance',
    'stopArrivals',
    'notifications',
    'user_notifications',
    'handoffs'
];

async function migrate() {
    console.log("Starting Migration to Hierarchical Multi-Tenancy...");

    for (const collectionName of COLLECTIONS_TO_MIGRATE) {
        console.log(`\n--- Migrating ${collectionName} ---`);
        const snapshot = await db.collection(collectionName).get();
        console.log(`Found ${snapshot.size} documents in legacy ${collectionName}`);

        let migratedCount = 0;
        let skippedCount = 0;
        const batchSize = 400;
        let batch = db.batch();
        let currentBatchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const collegeId = data.collegeId;

            if (!collegeId) {
                // If it's an OWNER user in 'users' collection, they stay in the root or moved to a system college?
                // For now, let's keep them in root users as per our code logic in authController.
                if (collectionName === 'users' && data.role === 'OWNER') {
                    console.log(`[SKIP] Global Owner: ${data.email}`);
                    skippedCount++;
                    continue;
                }

                console.warn(`[WARN] Skipping document ${doc.id} in ${collectionName}: Missing collegeId`);
                skippedCount++;
                continue;
            }

            // Define new path: colleges/{collegeId}/{collectionName}/{docId}
            const newDocRef = db.collection('colleges').doc(collegeId).collection(collectionName).doc(doc.id);

            batch.set(newDocRef, data);
            currentBatchCount++;
            migratedCount++;

            if (currentBatchCount >= batchSize) {
                await batch.commit();
                console.log(`Committed batch of ${currentBatchCount} for ${collectionName}`);
                batch = db.batch();
                currentBatchCount = 0;
            }
        }

        if (currentBatchCount > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${currentBatchCount} for ${collectionName}`);
        }

        console.log(`Finished ${collectionName}: ${migratedCount} migrated, ${skippedCount} skipped.`);
    }

    console.log("\nMigration completed successfully!");
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
