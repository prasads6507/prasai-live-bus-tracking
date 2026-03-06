const { db, initializationError } = require('./config/firebase');

async function checkColleges() {
    if (initializationError) {
        console.error('Initialization Error:', initializationError.message);
        return;
    }
    try {
        const snapshot = await db.collection('colleges').get();
        console.log('Total colleges:', snapshot.size);
        snapshot.docs.forEach(doc => {
            console.log(`- ${doc.id}: ${JSON.stringify(doc.data())}`);
        });
    } catch (error) {
        console.error('Error fetching colleges:', error.message);
    }
}

checkColleges();
