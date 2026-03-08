const { db } = require('./config/firebase');

async function inspectCollegesFull() {
    const collegesSnap = await db.collection('colleges').get();
    collegesSnap.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
        console.log('---');
    });
}

inspectCollegesFull().catch(console.error);
