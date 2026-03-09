const { auth, db, getCollegeCollection } = require('./config/firebase');

async function checkUidConsistency(email) {
    console.log(`Checking consistency for: ${email}`);
    const normalizedEmail = email.toLowerCase().trim();

    try {
        // 1. Get Auth User
        const authUser = await auth.getUserByEmail(normalizedEmail);
        console.log(`[Auth] User found. UID: ${authUser.uid}`);

        // 2. Search in all collections (Users and Students)
        const rootUser = await db.collection('users').where('email', '==', normalizedEmail).get();
        rootUser.forEach(doc => console.log(`[Root Users] DocID: ${doc.id}`, doc.data().userId === doc.id ? 'Matches userId field' : 'MISMATCH with userId field'));

        const collegesSnap = await db.collection('colleges').get();
        for (const collegeDoc of collegesSnap.docs) {
            const cid = collegeDoc.id;
            const scopedUser = await getCollegeCollection(cid, 'users').where('email', '==', normalizedEmail).get();
            scopedUser.forEach(doc => {
                console.log(`[College ${cid} Users] DocID: ${doc.id}`);
                if (doc.id === authUser.uid) {
                    console.log('✅ DocID matches Auth UID');
                } else {
                    console.log(`❌ DocID MISMATCH! Auth: ${authUser.uid}, DocID: ${doc.id}`);
                }
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

const target = 'nikhil@gmail.com';
checkUidConsistency(target).catch(console.error);
