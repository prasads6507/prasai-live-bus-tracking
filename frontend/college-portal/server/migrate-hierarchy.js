const { db, admin } = require('./config/firebase');

async function migrateCollection(collectionName, defaultCollegeId = 'Bannu') {
    console.log(`\n--- Migrating ${collectionName} ---`);
    const snapshot = await db.collection(collectionName).get();
    console.log(`Found ${snapshot.size} documents in global '${collectionName}'.`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const collegeId = data.collegeId || defaultCollegeId;
        const docId = doc.id;

        try {
            console.log(`  Migrating ${docId} to colleges/${collegeId}/${collectionName}/${docId}`);

            // 1. Create in new location
            await db.collection('colleges')
                .doc(collegeId)
                .collection(collectionName)
                .doc(docId)
                .set({
                    ...data,
                    collegeId // ensure it exists
                });

            // 2. We keep the old one for now to avoid breaking things mid-migration, 
            // but in a production script we might delete it or mark it as migrated.
            // await doc.ref.delete(); 

            migratedCount++;
        } catch (error) {
            console.error(`  Error migrating ${docId}:`, error.message);
            errorCount++;
        }
    }

    console.log(`Finished ${collectionName}: ${migratedCount} migrated, ${errorCount} errors.`);
}

async function migrateUsers() {
    console.log('\n--- Migrating Users (Admin/Driver) ---');
    const snapshot = await db.collection('users').get();
    console.log(`Found ${snapshot.size} users.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const role = data.role;
        const collegeId = data.collegeId || 'Bannu';

        if (role === 'OWNER') {
            console.log(`  Skipping OWNER ${doc.id} (stays global)`);
            skippedCount++;
            continue;
        }

        try {
            console.log(`  Migrating ${role} ${doc.id} to colleges/${collegeId}/users/${doc.id}`);
            await db.collection('colleges')
                .doc(collegeId)
                .collection('users')
                .doc(doc.id)
                .set(data);
            migratedCount++;
        } catch (error) {
            console.error(`  Error migrating user ${doc.id}:`, error.message);
        }
    }
    console.log(`Finished Users: ${migratedCount} migrated, ${skippedCount} skipped (OWNERs).`);
}

async function runMigration() {
    try {
        console.log('Starting Firestore Hierarchy Migration...');

        await migrateCollection('buses');
        await migrateCollection('routes');
        await migrateCollection('trips');
        await migrateCollection('students');
        await migrateCollection('user_notifications');
        await migrateCollection('stopArrivals');
        await migrateCollection('attendance');
        await migrateCollection('notifications');
        await migrateCollection('handoffs');
        await migrateCollection('stops');
        await migrateUsers();

        console.log('\nMigration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
}

runMigration();
