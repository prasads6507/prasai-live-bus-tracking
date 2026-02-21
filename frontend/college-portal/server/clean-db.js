const { db, admin } = require('./config/firebase');

async function cleanDB() {
    console.log('Scanning DB for abandoned legacy trips...');
    if (!db) {
        console.error('Firebase DB not initialized. Check .env');
        process.exit(1);
    }

    const buses = await db.collection('buses').get();
    let deletedCount = 0;

    for (const bus of buses.docs) {
        const trips = await bus.ref.collection('trips').get();
        for (const trip of trips.docs) {
            // Check if this trip exists in the root collection
            const rootTrip = await db.collection('trips').doc(trip.id).get();
            if (!rootTrip.exists) {
                console.log(`Found orphaned legacy trip: ${trip.id} under bus ${bus.id}`);
                // Delete subcollections
                const history = await trip.ref.collection('history').get();
                for (const h of history.docs) await h.ref.delete();
                const tripPath = await trip.ref.collection('path').get();
                for (const p of tripPath.docs) await p.ref.delete();
                // Delete trip document
                await trip.ref.delete();
                deletedCount++;
                console.log(`Deleted orphaned legacy trip: ${trip.id}`);
            }
        }
    }
    console.log(`Cleanup complete. Deleted ${deletedCount} abandoned legacy trips.`);
}

cleanDB().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
