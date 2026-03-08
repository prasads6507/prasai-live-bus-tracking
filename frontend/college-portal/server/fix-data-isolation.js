const { db } = require('./config/firebase');

async function auditIsolation() {
    const collections = ['buses', 'routes', 'stops', 'students', 'trips', 'attendance', 'users'];
    const report = {};

    console.log('--- Starting Firebase Isolation Audit ---');

    for (const collectionName of collections) {
        console.log(`Auditing collection: ${collectionName}...`);
        const snapshot = await db.collection(collectionName).get();

        report[collectionName] = {
            total: snapshot.size,
            missingCollegeId: 0,
            inconsistent: 0,
            docs: []
        };

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.collegeId) {
                report[collectionName].missingCollegeId++;
                report[collectionName].docs.push({ id: doc.id, issue: 'Missing collegeId' });
            }
        });

        console.log(`  - Total: ${report[collectionName].total}`);
        console.log(`  - Missing collegeId: ${report[collectionName].missingCollegeId}`);
    }

    console.log('--- Audit Complete ---');
    return report;
}

// Run audit
(async () => {
    try {
        const results = await auditIsolation();
        console.log('--- AUDIT RESULTS ---');
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Audit failed:', err);
        process.exit(1);
    }
})();
