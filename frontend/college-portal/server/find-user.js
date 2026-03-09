const { db, getCollegeCollection } = require('./config/firebase');

async function findUser(email) {
    console.log(`Searching for: ${email}`);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check root users
    const rootUser = await db.collection('users').where('email', '==', normalizedEmail).get();
    rootUser.forEach(doc => console.log(`[Root Users] Found doc ID: ${doc.id}`, doc.data()));

    // 2. Check root students
    const rootStudent = await db.collection('students').where('email', '==', normalizedEmail).get();
    rootStudent.forEach(doc => console.log(`[Root Students] Found doc ID: ${doc.id}`, doc.data()));

    // 3. Check all colleges
    const collegesSnap = await db.collection('colleges').get();
    for (const collegeDoc of collegesSnap.docs) {
        const collegeId = collegeDoc.id;

        const scopedUser = await getCollegeCollection(collegeId, 'users').where('email', '==', normalizedEmail).get();
        scopedUser.forEach(doc => console.log(`[College ${collegeId} Users] Found doc ID: ${doc.id}`, doc.data()));

        const scopedStudent = await getCollegeCollection(collegeId, 'students').where('email', '==', normalizedEmail).get();
        scopedStudent.forEach(doc => console.log(`[College ${collegeId} Students] Found doc ID: ${doc.id}`, doc.data()));
    }
}

const target = 'nikhil@gmail.com';
findUser(target).catch(console.error);
