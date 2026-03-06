const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { db } = require('./config/firebase');

const debugData = async () => {
    try {
        console.log('--- DEBUGGING DRIVER AND BUS DATA ---\n');

        // 1. Fetch all Drivers
        console.log('Fetching Drivers...');
        const driversSnapshot = await db.collection('users').where('role', '==', 'DRIVER').get();
        if (driversSnapshot.empty) {
            console.log('No drivers found.');
        } else {
            driversSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`Driver: ${data.name} (${data.email})`);
                console.log(`  ID: ${data.userId}`);
                console.log(`  CollegeId: ${data.collegeId}\n`);
            });
        }

        // 2. Fetch all Buses
        console.log('Fetching Buses...');
        const busesSnapshot = await db.collection('buses').get();
        if (busesSnapshot.empty) {
            console.log('No buses found.');
        } else {
            busesSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`Bus: ${data.busNumber} (${data.model})`);
                console.log(`  ID: ${doc.id}`);
                console.log(`  CollegeId: ${data.collegeId}`);
                console.log(`  Status: ${data.status}\n`);
            });
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

debugData();
