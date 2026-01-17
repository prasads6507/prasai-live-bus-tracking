const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../src/config/firebase');
const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const seedData = async () => {
    try {
        console.log('Firebase Seeding Started');

        // Clear existing data from relevant collections
        const collections = ['colleges', 'users', 'buses', 'routes', 'stops', 'assignments'];
        for (const coll of collections) {
            const snapshot = await db.collection(coll).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`Cleared collection: ${coll}`);
        }

        // 1. Create Owner
        const ownerId = 'owner-global';
        const ownerPwd = await hashPassword('owner123');
        const ownerData = {
            userId: ownerId,
            role: 'OWNER',
            email: 'owner@bustrack.com',
            name: 'Super Owner',
            passwordHash: ownerPwd,
            collegeId: 'OWNER_GLOBAL',
            createdAt: new Date().toISOString()
        };
        await db.collection('users').doc(ownerId).set(ownerData);
        console.log('Owner Created');

        // 2. Create Colleges
        const collegeData = [
            {
                collegeId: 'college-abc',
                collegeName: 'ABC Institute',
                status: 'ACTIVE',
                plan: 'PREMIUM',
                createdAt: new Date().toISOString()
            },
            {
                collegeId: 'college-xyz',
                collegeName: 'XYZ University',
                status: 'ACTIVE',
                plan: 'STANDARD',
                createdAt: new Date().toISOString()
            }
        ];

        for (const college of collegeData) {
            await db.collection('colleges').doc(college.collegeId).set(college);
            const cid = college.collegeId;

            // Admin
            const adminId = `admin-${cid}`;
            const adminPwd = await hashPassword('admin123');
            await db.collection('users').doc(adminId).set({
                userId: adminId,
                collegeId: cid,
                name: `Admin ${college.collegeName}`,
                email: `admin@${cid}.com`,
                passwordHash: adminPwd,
                role: 'COLLEGE_ADMIN',
                createdAt: new Date().toISOString()
            });

            // Bus
            const busId = `bus-${cid}-01`;
            await db.collection('buses').doc(busId).set({
                busId: busId,
                collegeId: cid,
                busNumber: 'BUS-01',
                plateNumber: `${cid.toUpperCase()}-01`,
                capacity: 40,
                createdAt: new Date().toISOString()
            });

            // Route
            const routeId = `route-${cid}-A`;
            await db.collection('routes').doc(routeId).set({
                routeId: routeId,
                collegeId: cid,
                routeName: 'Route A',
                startPoint: 'City Center',
                endPoint: 'College Campus',
                createdAt: new Date().toISOString()
            });

            // Stops
            const stops = [
                {
                    stopId: `stop-${cid}-1`,
                    collegeId: cid,
                    routeId: routeId,
                    stopName: 'City Center',
                    latitude: 12.9716,
                    longitude: 77.5946,
                    order: 1
                },
                {
                    stopId: `stop-${cid}-2`,
                    collegeId: cid,
                    routeId: routeId,
                    stopName: 'Midpoint Junction',
                    latitude: 12.9800,
                    longitude: 77.6000,
                    order: 2
                }
            ];
            for (const stop of stops) {
                await db.collection('stops').doc(stop.stopId).set(stop);
            }

            // Driver
            const driverId = `driver-${cid}`;
            const driverPwd = await hashPassword('driver123');
            await db.collection('users').doc(driverId).set({
                userId: driverId,
                collegeId: cid,
                name: `Driver ${cid}`,
                email: `driver@${cid}.com`,
                passwordHash: driverPwd,
                role: 'DRIVER',
                createdAt: new Date().toISOString()
            });

            // Assignment for Driver
            await db.collection('assignments').add({
                collegeId: cid,
                userId: driverId,
                busId: busId,
                routeId: routeId,
                role: 'DRIVER',
                createdAt: new Date().toISOString()
            });

            // Student (1 sample)
            const studentId = `student-${cid}-1`;
            const studentPwd = await hashPassword('student123');
            await db.collection('users').doc(studentId).set({
                userId: studentId,
                collegeId: cid,
                name: `Student 1 of ${cid}`,
                email: `student1@${cid}.com`,
                passwordHash: studentPwd,
                role: 'STUDENT',
                createdAt: new Date().toISOString()
            });

            await db.collection('assignments').add({
                collegeId: cid,
                userId: studentId,
                busId: busId,
                routeId: routeId,
                role: 'STUDENT',
                createdAt: new Date().toISOString()
            });
        }

        console.log('Firebase Seeding Completed Successfully');
        process.exit(0);
    } catch (error) {
        console.error('Seeding Error:', error);
        process.exit(1);
    }
};

seedData();
