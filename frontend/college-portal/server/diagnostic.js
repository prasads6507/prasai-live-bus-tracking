const { db, getCollegeCollection } = require('./config/firebase');

async function diagnostic() {
    console.log('--- GLOBAL ROOT USERS ---');
    const rootUsers = await db.collection('users').get();
    rootUsers.forEach(doc => {
        const d = doc.data();
        console.log(`- ID: ${doc.id} | Email: ${d.email} [${d.role}] (College: ${d.collegeId})`);
    });

    console.log('\n--- GLOBAL ROOT STUDENTS ---');
    const rootStudents = await db.collection('students').get();
    rootStudents.forEach(doc => {
        const d = doc.data();
        console.log(`- ID: ${doc.id} | Email: ${d.email} (College: ${d.collegeId})`);
    });

    console.log('\n--- HIERARCHICAL USERS/STUDENTS BY COLLEGE ---');
    const colleges = await db.collection('colleges').get();
    for (const college of colleges.docs) {
        const cid = college.id;
        const hUsers = await getCollegeCollection(cid, 'users').get();
        const hStudents = await getCollegeCollection(cid, 'students').get();
        console.log(`College: ${cid}`);
        console.log('  Users:');
        hUsers.forEach(doc => {
            const d = doc.data();
            console.log(`    - ID: ${doc.id} | Email: ${d.email} [${d.role}]`);
        });
        console.log('  Students:');
        hStudents.forEach(doc => {
            const d = doc.data();
            console.log(`    - ID: ${doc.id} | Email: ${d.email}`);
        });
    }
}

diagnostic().catch(console.error);
