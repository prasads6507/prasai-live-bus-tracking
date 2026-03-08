const { db, getCollegeCollection } = require('./config/firebase');

async function testApi() {
    const filterId = undefined; // Initial load simulation
    const enriched = [];

    // 1. Hierarchy Group
    const collegesSnap = await db.collection('colleges').get();
    console.log(`Colleges count: ${collegesSnap.size}`);

    for (const collegeDoc of collegesSnap.docs) {
        const collegeId = collegeDoc.id;
        const collegeData = collegeDoc.data();
        const adminsSnap = await getCollegeCollection(collegeId, 'users')
            .where('role', 'in', ['COLLEGE_ADMIN', 'SUPER_ADMIN'])
            .get();

        console.log(`College ${collegeId}: ${adminsSnap.size} admins in hierarchy`);
        adminsSnap.docs.forEach(doc => {
            enriched.push({
                ...doc.data(),
                collegeId,
                collegeName: collegeData.collegeName || collegeId,
                collegeStatus: collegeData.status || 'ACTIVE'
            });
        });
    }

    // 2. Root Group
    const rootAdminsQuery = db.collection('users').where('role', 'in', ['COLLEGE_ADMIN', 'SUPER_ADMIN']);
    const rootAdminsSnap = await rootAdminsQuery.get();
    console.log(`Root admins count: ${rootAdminsSnap.size}`);

    const collegeInfoMap = {};
    for (const doc of rootAdminsSnap.docs) {
        const data = doc.data();
        const cid = data.collegeId;

        const isDuplicate = enriched.some(a => a.userId === data.userId || a.email === data.email);
        if (isDuplicate) {
            console.log(`Skipping duplicate: ${data.email}`);
            continue;
        }

        if (cid && cid !== 'OWNER_GLOBAL') {
            if (!collegeInfoMap[cid]) {
                const cDoc = await db.collection('colleges').doc(cid).get();
                collegeInfoMap[cid] = cDoc.exists ? cDoc.data() : { collegeName: cid, status: 'ACTIVE' };
            }

            enriched.push({
                ...data,
                collegeId: cid,
                collegeName: collegeInfoMap[cid].collegeName || cid,
                collegeStatus: collegeInfoMap[cid].status || 'ACTIVE'
            });
        }
    }

    console.log(`Final Enriched Admins: ${enriched.length}`);
    enriched.forEach(a => console.log(`- ${a.email} (${a.collegeId})`));
}

testApi().catch(console.error);
