const { db } = require('./config/firebase');

async function inspectColleges() {
    console.log('--- Inspecting Colleges ---');
    const collegesSnap = await db.collection('colleges').get();
    collegesSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Name: ${d.collegeName} | Slug: ${d.slug} | Status: ${d.status}`);
    });
}

inspectColleges().catch(console.error);
