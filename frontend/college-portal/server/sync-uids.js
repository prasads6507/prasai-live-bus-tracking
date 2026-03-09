const { auth, db, getCollegeCollection } = require('./config/firebase');

async function syncUserUids() {
    console.log('Starting UID Synchronization...');
    const collegesSnap = await db.collection('colleges').get();
    const collegeIds = collegesSnap.docs.map(doc => doc.id);
    collegeIds.push(null); // Null for root search

    for (const collegeId of collegeIds) {
        let usersSnap;
        if (collegeId) {
            console.log(`Checking college: ${collegeId}`);
            usersSnap = await getCollegeCollection(collegeId, 'users').get();
        } else {
            console.log('Checking root users...');
            usersSnap = await db.collection('users').get();
        }

        for (const doc of usersSnap.docs) {
            const data = doc.data();
            const email = data.email;
            if (!email) continue;

            try {
                const authUser = await auth.getUserByEmail(email);
                const realUid = authUser.uid;
                const currentDocId = doc.id;

                if (realUid !== currentDocId) {
                    console.log(`[MISMATCH] Phone UID: ${realUid} vs Document ID: ${currentDocId} for ${email}`);

                    // Fix: Copy document to the correct ID and delete the old one
                    const targetRef = collegeId
                        ? getCollegeCollection(collegeId, 'users').doc(realUid)
                        : db.collection('users').doc(realUid);

                    const batch = db.batch();
                    batch.set(targetRef, { ...data, userId: realUid });
                    batch.delete(doc.ref);

                    await batch.commit();
                    console.log(`[FIXED] Moved record for ${email} to correct UID: ${realUid}`);
                }
            } catch (e) {
                if (e.code === 'auth/user-not-found') {
                    console.warn(`[SKIP] No Auth record for ${email}`);
                } else {
                    console.error(`[ERROR] Failed to process ${email}:`, e.message);
                }
            }
        }

        // Also check students if hierarchical
        if (collegeId) {
            const studentsSnap = await getCollegeCollection(collegeId, 'students').get();
            for (const doc of studentsSnap.docs) {
                const data = doc.data();
                const email = data.email;
                if (!email) continue;
                try {
                    const authUser = await auth.getUserByEmail(email);
                    if (authUser.uid !== doc.id) {
                        console.log(`[STUDENT MISMATCH] ${email}: ${authUser.uid} vs ${doc.id}`);
                        const targetRef = getCollegeCollection(collegeId, 'students').doc(authUser.uid);
                        const batch = db.batch();
                        batch.set(targetRef, { ...data, studentId: authUser.uid });
                        batch.delete(doc.ref);
                        await batch.commit();
                        console.log(`[FIXED] Student ${email} UID`);
                    }
                } catch (e) { }
            }
        }
    }
}

syncUserUids().catch(console.error);
