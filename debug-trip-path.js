require('dotenv').config({ path: 'server/.env' });
const { db } = require('./server/config/firebase');

async function debug() {
    const tripId = 'trip-bus-1769049866484-1771510818906';
    const busId = 'bus-1769049866484';

    console.log(`Checking data for Trip: ${tripId}`);

    // Check Root Collection Path
    const rootPath = await db.collection('trips').doc(tripId).collection('path').get();
    console.log(`Root Path ('path'): ${rootPath.size} points`);

    // Check Root Collection History
    const rootHistory = await db.collection('trips').doc(tripId).collection('history').get();
    console.log(`Root Path ('history'): ${rootHistory.size} points`);

    // Check Nested Collection History
    const nestedHistory = await db.collection('buses').doc(busId).collection('trips').doc(tripId).collection('history').get();
    console.log(`Nested Path ('history'): ${nestedHistory.size} points`);

    // Check Nested Collection Path
    const nestedPath = await db.collection('buses').doc(busId).collection('trips').doc(tripId).collection('path').get();
    console.log(`Nested Path ('path'): ${nestedPath.size} points`);
}

debug();
