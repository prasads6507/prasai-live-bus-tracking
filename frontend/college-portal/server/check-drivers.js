require('dotenv').config();
const { db } = require('./config/firebase');

async function checkDrivers() {
    console.log('--- DRIVER CHECK START ---');
    try {
        const driversSnap = await db.collection('users').where('role', '==', 'DRIVER').limit(5).get();
        if (driversSnap.empty) {
            console.log('No drivers found.');
        } else {
            driversSnap.forEach(doc => {
                const data = doc.data();
                console.log(`Driver: ${data.name}, Email: ${data.email}, collegeId: "${data.collegeId}"`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkDrivers();
