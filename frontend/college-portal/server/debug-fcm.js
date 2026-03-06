require('dotenv').config();
const { admin, db, messaging } = require('./config/firebase');

async function testNotification() {
    console.log('--- FCM DEBUG START ---');
    const busId = 'bus-1769049866484';
    const collegeId = 'sist';

    try {
        console.log(`Querying students for college: ${collegeId}, bus favorite: ${busId}`);
        const studentsSnap = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('favoriteBusIds', 'array-contains', busId)
            .get();

        if (studentsSnap.empty) {
            console.log('No students found matching this favorite bus and college.');
            return;
        }

        console.log(`Found ${studentsSnap.size} student(s).`);
        studentsSnap.forEach(doc => {
            const data = doc.data();
            console.log(`Student: ${data.name}, Token Present: ${!!data.fcmToken}`);
            if (data.fcmToken) {
                console.log(`Token: ${data.fcmToken}`);
            }
        });

        // Test send to the first student found if they have a token
        const firstStudent = studentsSnap.docs[0].data();
        if (firstStudent.fcmToken) {
            console.log('\nAttempting to send test notification...');
            const message = {
                notification: {
                    title: 'FCM Test 🚀',
                    body: 'This is a test notification from the debug script.'
                },
                token: firstStudent.fcmToken
            };

            const response = await messaging.send(message);
            console.log('Successfully sent message:', response);
        } else {
            console.log('First student has no FCM token.');
        }

    } catch (err) {
        console.error('Debug script failed:', err);
    } finally {
        process.exit(0);
    }
}

testNotification();
