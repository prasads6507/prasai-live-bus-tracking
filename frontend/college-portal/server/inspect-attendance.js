const { db } = require('./config/firebase');

async function checkAttendance() {
    try {
        console.log('Fetching latest 5 attendance records...');
        const snapshot = await db.collection('attendance')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            console.log('No attendance records found.');
            return;
        }

        snapshot.forEach(doc => {
            console.log('---');
            console.log('ID:', doc.id);
            const data = doc.data();
            console.log('Data:', JSON.stringify({
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt
            }, null, 2));
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAttendance();
