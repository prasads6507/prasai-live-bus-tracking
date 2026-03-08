const { db, getCollegeCollection } = require('./config/firebase');

async function inspect() {
    const collegeId = 'berlin-high-school';
    const driverEmail = 'nikhil@gmail.com';
    const studentEmail = 'karthik@gmail.com';

    console.log(`--- Inspecting ${collegeId} ---`);

    const driverSnap = await getCollegeCollection(collegeId, 'users').where('email', '==', driverEmail).get();
    if (!driverSnap.empty) {
        console.log('Driver Document:');
        console.log(JSON.stringify(driverSnap.docs[0].data(), null, 2));
    } else {
        console.log('Driver not found');
    }

    const studentSnap = await getCollegeCollection(collegeId, 'students').where('email', '==', studentEmail).get();
    if (!studentSnap.empty) {
        console.log('\nStudent Document:');
        console.log(JSON.stringify(studentSnap.docs[0].data(), null, 2));
    } else {
        console.log('Student not found');
    }
}

inspect().catch(console.error);
