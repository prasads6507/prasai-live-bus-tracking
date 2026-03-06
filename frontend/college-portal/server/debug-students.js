const { db } = require('./config/firebase');

async function debugData() {
    console.log('--- DEBUGGING STUDENT DATA ---');
    try {
        const studentsSnapshot = await db.collection('students').get();
        if (!studentsSnapshot.empty) {
            studentsSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`Student: ${data.name} (${data.email})`);
                console.log(`  Register No: ${data.registerNumber}`);
                console.log(`  Phone: ${data.phone}`);
                console.log(`  CollegeId: ${data.collegeId}`);
                console.log(`  isFirstLogin: ${data.isFirstLogin}\n`);
            });
        }

        console.log('--- DEBUGGING ADMIN DATA ---');
        const adminsSnapshot = await db.collection('users').where('role', 'in', ['COLLEGE_ADMIN', 'OWNER', 'SUPER_ADMIN', 'DRIVER']).get();
        if (!adminsSnapshot.empty) {
            adminsSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`User: ${data.name} (${data.email})`);
                console.log(`  Role: ${data.role}`);
                console.log(`  Phone: ${data.phone}`);
                console.log(`  CollegeId: ${data.collegeId}\n`);
            });
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

debugData();
