
const { admin, db, messaging } = require('../config/firebase');

/**
 * Send notification to all students assigned to a trip's route
 */
/**
 * Send notification to all students assigned to a trip's route
 */
const sendBusStartedNotification = async (tripId, busId, collegeId, busNumber, isMaintenance = false, originalBusId = null) => {
    try {
        console.log(`[BusStarted] Triggering for bus="${busId}" college="${collegeId}" trip="${tripId}" isMaintenance=${isMaintenance}`);

        // 1. Query by busId first to avoid composite index requirement
        const studentsRef = db.collection('students');
        const queryBusId = isMaintenance ? originalBusId : busId;

        if (!queryBusId) {
            console.error('[BusStarted] No busId provided for query');
            return;
        }

        // Execute parallel queries for assigned and favorite students
        const [assignedSnap, favoriteSnap] = await Promise.all([
            studentsRef.where('assignedBusId', '==', queryBusId).get(),
            studentsRef.where('favoriteBusIds', 'array-contains', queryBusId).get()
        ]);

        // Merge, de-duplicate by student ID, and filter by collegeId in memory
        const studentDocsMap = new Map();
        assignedSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });
        favoriteSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });

        console.log(`[BusStarted] Unified Query (assigned=${assignedSnap.size}, favorited=${favoriteSnap.size}) found ${studentDocsMap.size} unique students`);

        if (studentDocsMap.size === 0) {
            console.log(`[BusStarted] No students found for bus "${queryBusId}"`);
            return;
        }

        const tokens = [];
        const studentUpdates = [];

        studentDocsMap.forEach((doc, studentId) => {
            const data = doc.data();
            const token = data.fcmToken;
            if (token && typeof token === 'string' && token.length > 10) {
                tokens.push(token);
            }

            // 2. SILENT UPDATE: Update student's current active bus
            studentUpdates.push({
                ref: doc.ref,
                data: {
                    activeBusId: busId,
                    activeBusNumber: busNumber,
                    activeTripId: tripId,
                    lastBusUpdate: admin.firestore.FieldValue.serverTimestamp()
                }
            });
        });

        // Execute student updates in batches
        if (studentUpdates.length > 0) {
            console.log(`[BusStarted] Performing silent updates for ${studentUpdates.length} students...`);
            const updateBatch = db.batch();
            studentUpdates.forEach(update => updateBatch.update(update.ref, update.data));
            await updateBatch.commit();
        }

        if (tokens.length === 0) {
            console.log(`[BusStarted] No valid FCM tokens for bus ${queryBusId} favorites`);
            return;
        }

        // Send in batches of 500
        for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);
            const message = {
                notification: {
                    title: 'Bus Started 🚌',
                    body: isMaintenance
                        ? `Replacement Bus ${busNumber} for your route has started. Track it live!`
                        : `Bus ${busNumber || busId} has started its trip. Track it live!`
                },
                data: {
                    tripId: tripId || '',
                    busId: busId || '',
                    type: 'BUS_STARTED'
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'bus_events',
                        sound: 'default'
                    }
                },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                tokens: batch
            };
            try {
                const result = await messaging.sendEachForMulticast(message);
                console.log(`[BusStarted] Batch result: sent=${result.successCount} failed=${result.failureCount}`);
                // Fire and forget the cleanup to not block API response
                cleanupStaleTokens(result, batch, db, admin).catch(err => console.error('[FCM Cleanup Error]', err.message));
            } catch (fcmErr) {
                console.error('[BusStarted] FCM transmission error:', fcmErr.message);
            }
        }

        // Log to notifications collection for admin panel
        await db.collection('notifications').add({
            type: 'BUS_STARTED',
            busId, tripId, collegeId,
            message: isMaintenance
                ? `Maintenance Trip: Bus ${busNumber} replaced ${originalBusId} for trip ${tripId}`
                : `Bus ${busNumber} has started its trip`,
            isMaintenance: !!isMaintenance,
            originalBusId: originalBusId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });

    } catch (error) {
        console.error('[BusStarted] CRITICAL ERROR:', error);
    }
};

/**
 * Check proximity and notify students
 * Should be called periodically or on location update
 */
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Identify and delete invalid FCM tokens from Firestore to prevent memory leaks.
 * BUG FIX (Bug 5): Wrapped in try/catch so a missing Firestore index never
 * crashes the notification send pipeline. Also checks the users (drivers) collection.
 */
const cleanupStaleTokens = async (result, tokensBatch, db, admin) => {
    if (result.failureCount === 0) return;

    try {
        const failedTokens = [];
        result.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const errCode = resp.error?.code;
                console.log(`[FCM] Token ${idx} failed with code: ${errCode}`);
                if (errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered') {
                    failedTokens.push(tokensBatch[idx]);
                }
            }
        });

        if (failedTokens.length === 0) return;

        console.log(`[FCM] Removing ${failedTokens.length} stale tokens in parallel...`);
        const batch = db.batch();

        const cleanupPromises = failedTokens.map(async (staleToken) => {
            try {
                const staleStudentSnap = await db.collection('students')
                    .where('fcmToken', '==', staleToken)
                    .limit(5)
                    .get();
                staleStudentSnap.forEach(doc => {
                    batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() });
                });

                const staleUserSnap = await db.collection('users')
                    .where('fcmToken', '==', staleToken)
                    .limit(5)
                    .get();
                staleUserSnap.forEach(doc => {
                    batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() });
                });
            } catch (indexErr) {
                console.warn(`[FCM Cleanup Worker] Skipped token ${staleToken}:`, indexErr.message);
            }
        });

        await Promise.all(cleanupPromises);
        await batch.commit();
        console.log(`[FCM] Stale tokens removed successfully.`);
    } catch (err) {
        // Never let cleanup crash the notification pipeline
        console.error('[FCM] cleanupStaleTokens error (non-fatal):', err.message);
    }
};

/**
 * Check proximity and notify students
 * Should be called periodically or on location update
 */
const checkProximityAndNotify = async (busId, location, collegeId, routeId) => {
    if (!location || !location.latitude || !location.longitude) return;

    try {
        // 1. Query by busId first to avoid composite index requirement
        const studentsRef = db.collection('students');
        const [assignedSnap, favoriteSnap] = await Promise.all([
            studentsRef.where('assignedBusId', '==', busId).get(),
            studentsRef.where('favoriteBusIds', 'array-contains', busId).get()
        ]);

        const studentDocsMap = new Map();
        assignedSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });
        favoriteSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });

        if (studentDocsMap.size === 0) return;

        const tokensToSend = [];
        const NEARBY_THRESHOLD_KM = 2.0; // 2km radius

        studentDocsMap.forEach((doc, studentId) => {
            const student = doc.data();
            if (student.fcmToken && student.lastLocation) {
                const dist = getDistanceFromLatLonInKm(
                    location.latitude,
                    location.longitude,
                    student.lastLocation.latitude,
                    student.lastLocation.longitude
                );

                if (dist <= NEARBY_THRESHOLD_KM) {
                    tokensToSend.push(student.fcmToken);
                }
            }
        });

        if (tokensToSend.length > 0) {
            const message = {
                notification: {
                    title: 'Bus Arriving Soon',
                    body: 'Your favorite bus is within 2km of your location.'
                },
                data: {
                    busId: busId,
                    type: 'BUS_PROXIMITY'
                },
                android: {
                    notification: {
                        channelId: 'bus_events',
                        priority: 'high',
                        sound: 'default'
                    }
                },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                tokens: tokensToSend
            };

            try {
                const response = await messaging.sendEachForMulticast(message);
                console.log(`[Proximity] Sent ${response.successCount} notifications.`);
                await cleanupStaleTokens(response, tokensToSend, db, admin);
            } catch (fcmErr) {
                console.error('[Proximity] FCM error:', fcmErr.message);
            }

            await db.collection('notifications').add({
                type: 'BUS_PROXIMITY',
                busId,
                collegeId,
                message: `Bus is within 2km of ${tokensToSend.length} students.`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }

    } catch (error) {
        console.error('[Notification] Proximity check error:', error);
    }
};

/**
 * Send notification to students assigned to a specific stop when bus arrives
 */
const sendStopArrivalNotification = async (tripId, busId, collegeId, routeId, stopId, stopName) => {
    try {
        console.log(`[Notification] Bus arrived at stop "${stopName}" (${stopId}) on route ${routeId}`);

        // Query by busId first to avoid composite index requirement
        const studentsRef = db.collection('students');
        const [assignedSnap, favoriteSnap] = await Promise.all([
            studentsRef.where('assignedBusId', '==', busId).get(),
            studentsRef.where('favoriteBusIds', 'array-contains', busId).get()
        ]);

        const studentDocsMap = new Map();
        assignedSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });
        favoriteSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });

        if (studentDocsMap.size === 0) {
            console.log(`[Notification] No students found for bus ${busId}`);
            return;
        }

        const tokens = [];
        studentDocsMap.forEach((doc) => {
            const data = doc.data();
            if (data.fcmToken) {
                tokens.push(data.fcmToken);
            }
        });

        if (tokens.length === 0) {
            console.log(`[Notification] No FCM tokens for students assigned/favorited bus ${busId}`);
            return;
        }

        const message = {
            notification: {
                title: 'Bus Arriving!',
                body: `Your bus is arriving at ${stopName}. Please be ready.`
            },
            data: {
                tripId: tripId || '',
                busId: busId || '',
                stopId: stopId || '',
                type: 'STOP_ARRIVAL'
            },
            tokens: tokens
        };

        try {
            const response = await messaging.sendEachForMulticast(message);
            console.log(`[Notification] Stop arrival: Sent ${response.successCount}, Failed: ${response.failureCount}`);
            await cleanupStaleTokens(response, tokens, db, admin);
        } catch (fcmErr) {
            console.error('[Notification] Stop arrival FCM error:', fcmErr.message);
        }

    } catch (error) {
        console.error('[Notification] Error sending stop arrival notification:', error);
    }
};

const sendStopEventNotification = async (tripId, busId, collegeId, stopId, stopName, stopAddress, type, arrivalDocId, targetStudentIds = null) => {
    try {
        if (!messaging) {
            console.warn('[FCM] messaging not initialized');
            return;
        }

        console.log(`[StopEvent] type=${type} stop="${stopName}" trip=${tripId} bus=${busId} college=${collegeId} targeted=${!!targetStudentIds}`);

        // Prevent duplicate sends
        if (arrivalDocId) {
            const doc = await db.collection('stopArrivals').doc(arrivalDocId).get();
            if (doc.exists && doc.data().fcmSent === true) {
                console.log(`[StopEvent] FCM already sent for: ${arrivalDocId}`);
                return;
            }
        }

        // Build notification text
        let title, body;
        const displayLocation = stopName || stopAddress || 'your stop';
        if (type === 'ARRIVING') {
            title = 'Bus Arriving Soon 🚍';
            body = `${displayLocation}, Arriving Soon`;
        } else if (type === 'ARRIVED') {
            title = 'Bus Arrived ✅';
            body = `Bus has arrived at ${displayLocation}`;
        } else if (type === 'SKIPPED') {
            title = 'Stop Skipped ⏭';
            body = `Bus skipped ${displayLocation} — heading to next stop`;
        } else {
            return;
        }

        // Identify target students
        const studentDocsMap = new Map();

        if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
            console.log(`[StopEvent] Targeted query for ${targetStudentIds.length} specific students`);
            // Fetch students by ID directly
            const studentPromises = targetStudentIds.map(id => db.collection('students').doc(id).get());
            const studentDocs = await Promise.all(studentPromises);
            studentDocs.forEach(doc => {
                if (doc.exists && doc.data().collegeId === collegeId) {
                    studentDocsMap.set(doc.id, doc);
                }
            });
        } else {
            // Standard broadcast logic (Assigned students + Favorited students)
            const studentsRef = db.collection('students');
            const [assignedSnap, favoriteSnap] = await Promise.all([
                studentsRef.where('assignedBusId', '==', busId).get(),
                studentsRef.where('favoriteBusIds', 'array-contains', busId).get()
            ]);

            assignedSnap.forEach(doc => {
                if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
            });
            favoriteSnap.forEach(doc => {
                if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
            });
        }

        console.log(`[StopEvent] Unified Query found ${studentDocsMap.size} unique students`);

        const tokens = [];
        studentDocsMap.forEach((doc, studentId) => {
            const data = doc.data();
            const token = data.fcmToken;
            if (token && typeof token === 'string' && token.length > 10) {
                tokens.push(token);
                console.log(` - Found student ${doc.id}`);
            }
        });

        console.log(`[StopEvent] Found ${tokens.length} valid tokens for bus ${busId}`);

        if (tokens.length > 0) {
            // Send in batches of 500 (FCM multicast limit)
            for (let i = 0; i < tokens.length; i += 500) {
                const batch = tokens.slice(i, i + 500);
                try {
                    const msg = {
                        notification: { title, body },
                        data: { tripId: tripId || '', busId: busId || '', stopId: stopId || '', type },
                        android: { priority: 'high', notification: { channelId: 'bus_events', sound: 'default' } },
                        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                        tokens: batch,
                    };
                    const result = await messaging.sendEachForMulticast(msg);
                    console.log(`[StopEvent] Batch result: sent=${result.successCount} failed=${result.failureCount}`);
                    // Fire and forget cleanup
                    cleanupStaleTokens(result, batch, db, admin).catch(err => console.error('[FCM Cleanup]', err.message));
                } catch (fcmErr) {
                    console.error('[StopEvent] FCM transmission error:', fcmErr.message);
                }
            }
        }

        // Write to notifications collection for admin Live Alerts panel
        await db.collection('notifications').add({
            type, busId, tripId, collegeId, stopId, stopName,
            message: body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });

        // Mark as processed to prevent re-sending
        if (arrivalDocId) {
            await db.collection('stopArrivals').doc(arrivalDocId).update({
                fcmSent: true,
                notifiedAt: new Date().toISOString(),
            });
        }

    } catch (err) {
        console.error('[StopEvent] Error:', err.message);
    }
};

/**
 * NEW: Notify specific student when driver marks attendance tick
 */
const sendStudentAttendanceNotification = async ({ studentId, busId, direction, isChecked, busNumber, tripId }) => {
    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (!studentDoc.exists) return;

        const student = studentDoc.data();
        if (!student.fcmToken) return;

        const title = direction === 'pickup' ? "Safe Boarding ✅" : "Drop-off Complete ✅";
        const body = direction === 'pickup'
            ? `${student.name || 'Your child'} has boarded Bus ${busNumber} safely.`
            : `${student.name || 'Your child'} has been dropped off from Bus ${busNumber} safely.`;

        const payload = {
            notification: { title, body },
            data: { type: 'ATTENDANCE', tripId: tripId || '', studentId, action: 'FLUTTER_NOTIFICATION_CLICK' },
            android: { priority: 'high', notification: { channelId: 'bus_events', sound: 'default' } },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } }
        };

        const result = await messaging.send({
            token: student.fcmToken,
            ...payload
        });

        console.log(`[AttendanceNotify] Sent to ${student.name}`);
        return result;
    } catch (error) {
        console.error('[AttendanceNotify] Error:', error.message);
    }
};

/**
 * NEW: Notify all students who favorited this bus that the trip has ended.
 * Called from endTrip controller and auto-end in background service.
 */
const sendTripEndedNotification = async (tripId, busId, collegeId) => {
    try {
        if (!messaging) {
            console.warn('[FCM] messaging not initialized for trip ended');
            return;
        }

        console.log(`[TripEnded] Sending 'Trip Ended' for bus ${busId}, trip ${tripId}`);

        // Get bus number for the notification body
        let busNumber = busId;
        try {
            const busDoc = await db.collection('buses').doc(busId).get();
            if (busDoc.exists) {
                const d = busDoc.data();
                busNumber = d.busNumber || d.number || busId;
            }
        } catch (_) { }

        // Query by assigned OR favorite (no collegeId to avoid composite index)
        const studentsRef = db.collection('students');
        const [assignedSnap, favoriteSnap, tripDoc] = await Promise.all([
            studentsRef.where('assignedBusId', '==', busId).get(),
            studentsRef.where('favoriteBusIds', 'array-contains', busId).get(),
            db.collection('trips').doc(tripId).get()
        ]);

        const tripData = tripDoc.exists ? tripDoc.data() : {};
        const attendedStudents = [
            ...(tripData.pickedUpStudents || []),
            ...(tripData.droppedOffStudents || [])
        ];

        const studentDocsMap = new Map();
        assignedSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });
        favoriteSnap.forEach(doc => {
            if (doc.data().collegeId === collegeId) studentDocsMap.set(doc.id, doc);
        });

        if (studentDocsMap.size === 0) {
            console.log(`[TripEnded] No students found for bus ${busId}`);
            return;
        }

        const dateKey = new Date().toISOString().split('T')[0];
        const absenteeTitle = '⚠️ Attendance Alert';
        const absenteeBody = tripData.direction === 'pickup'
            ? `Not Boarded the Bus Today — Bus ${busNumber}`
            : `Not Dropped Off Today — Bus ${busNumber}`;

        const tokensAbsentee = [];
        const studentUpdates = [];
        const attendanceUpdates = [];

        // Identify absent students and check if already notified
        const absenteeChecks = [];
        studentDocsMap.forEach((doc, studentId) => {
            const data = doc.data();
            const isAssigned = data.assignedBusId === busId;
            const isAbsent = !attendedStudents.includes(studentId);

            if (isAssigned && isAbsent) {
                const attendanceId = `${dateKey}__${busId}__${tripData.direction || 'pickup'}__${studentId}`;
                absenteeChecks.push((async () => {
                    try {
                        const attDoc = await db.collection('attendance').doc(attendanceId).get();
                        if (attDoc.exists && attDoc.data().absentNotifiedAt) {
                            return; // Already notified
                        }
                        const token = data.fcmToken;
                        if (token && typeof token === 'string' && token.length > 10) {
                            tokensAbsentee.push(token);
                            attendanceUpdates.push({
                                ref: db.collection('attendance').doc(attendanceId),
                                data: { absentNotifiedAt: admin.firestore.FieldValue.serverTimestamp() }
                            });
                        }
                    } catch (e) {
                        console.error(`[AbsenteeCheck] Error for ${studentId}:`, e.message);
                    }
                })());
            }

            // SILENT UPDATE: Clear student's active bus info for ALL (assigned & favored)
            studentUpdates.push({
                ref: doc.ref,
                data: {
                    activeBusId: admin.firestore.FieldValue.delete(),
                    activeBusNumber: admin.firestore.FieldValue.delete(),
                    activeTripId: admin.firestore.FieldValue.delete(),
                    lastBusUpdate: admin.firestore.FieldValue.serverTimestamp()
                }
            });
        });

        await Promise.all(absenteeChecks);

        // Execute student and attendance updates in batches
        const finalBatch = db.batch();
        studentUpdates.forEach(u => finalBatch.update(u.ref, u.data));
        attendanceUpdates.forEach(u => finalBatch.set(u.ref, u.data, { merge: true }));

        if (studentUpdates.length > 0 || attendanceUpdates.length > 0) {
            console.log(`[TripEnded] committing ${studentUpdates.length} student updates and ${attendanceUpdates.length} attendance updates...`);
            await finalBatch.commit();
        }

        const sendBatch = async (tokens, t, b) => {
            if (tokens.length === 0) return;
            for (let i = 0; i < tokens.length; i += 500) {
                const batch = tokens.slice(i, i + 500);
                try {
                    const msg = {
                        notification: { title: t, body: b },
                        data: { tripId: tripId || '', busId: busId || '', type: 'TRIP_ENDED' },
                        android: { priority: 'high', notification: { channelId: 'bus_events', sound: 'default' } },
                        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                        tokens: batch,
                    };
                    const result = await messaging.sendEachForMulticast(msg);
                    console.log(`[TripEnded] FCM batch (${t}) sent=${result.successCount} failed=${result.failureCount}`);
                    cleanupStaleTokens(result, batch, db, admin).catch(err => console.error('[FCM Cleanup]', err.message));
                } catch (fcmErr) {
                    console.error('[TripEnded] FCM batch error:', fcmErr.message);
                }
            }
        };

        if (tokensAbsentee.length > 0) {
            await sendBatch(tokensAbsentee, absenteeTitle, absenteeBody);
        }

        // Log to notifications collection
        await db.collection('notifications').add({
            type: 'TRIP_ENDED',
            busId, tripId, collegeId,
            message: body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });

    } catch (error) {
        console.error('[TripEnded] Error:', error.message);
    }
};

module.exports = {
    sendBusStartedNotification,
    checkProximityAndNotify,
    sendStopArrivalNotification,
    sendStopEventNotification,
    sendTripEndedNotification,
    sendStudentAttendanceNotification
};
