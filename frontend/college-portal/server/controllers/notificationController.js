
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
                    notification: {
                        channelId: 'bus_events',
                        priority: 'high',
                        sound: 'default'
                    }
                },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                tokens: batch
            };
            try {
                const result = await messaging.sendEachForMulticast(message);
                console.log(`[BusStarted] Batch result: sent=${result.successCount} failed=${result.failureCount}`);
                await cleanupStaleTokens(result, batch, db, admin);
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

        console.log(`[FCM] Removing ${failedTokens.length} stale tokens`);
        const batch = db.batch();

        // Search both collections for stale tokens
        for (const staleToken of failedTokens) {
            try {
                // Check students collection
                const staleStudentSnap = await db.collection('students')
                    .where('fcmToken', '==', staleToken)
                    .limit(5)
                    .get();
                staleStudentSnap.forEach(doc => {
                    batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() });
                });

                // Check users collection (drivers)
                const staleUserSnap = await db.collection('users')
                    .where('fcmToken', '==', staleToken)
                    .limit(5)
                    .get();
                staleUserSnap.forEach(doc => {
                    batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() });
                });
            } catch (indexErr) {
                // Missing index — log and skip. Token will be cleaned up next time.
                console.warn(`[FCM] Stale token cleanup skipped (index missing?): ${indexErr.message}`);
            }
        }

        await batch.commit();
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

const sendStopEventNotification = async (tripId, busId, collegeId, stopId, stopName, stopAddress, type, arrivalDocId) => {
    try {
        if (!messaging) {
            console.warn('[FCM] messaging not initialized');
            return;
        }

        console.log(`[StopEvent] type=${type} stop="${stopName}" trip=${tripId} bus=${busId} college=${collegeId}`);

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

        // Query by assigned OR favorite — same unified pattern
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
                        android: { notification: { channelId: 'bus_events', priority: 'high', sound: 'default' } },
                        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                        tokens: batch,
                    };
                    const result = await messaging.sendEachForMulticast(msg);
                    console.log(`[StopEvent] Batch result: sent=${result.successCount} failed=${result.failureCount}`);
                    await cleanupStaleTokens(result, batch, db, admin);
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
            console.log(`[TripEnded] No students found for bus ${busId}`);
            return;
        }

        const tokens = [];
        const studentUpdates = [];

        studentDocsMap.forEach((doc, studentId) => {
            const data = doc.data();
            const token = data.fcmToken;
            if (token && typeof token === 'string' && token.length > 10) tokens.push(token);

            // SILENT UPDATE: Clear student's active bus info when the trip ends
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

        // Execute student updates in batches
        if (studentUpdates.length > 0) {
            console.log(`[TripEnded] Clearing active bus info for ${studentUpdates.length} students...`);
            const updateBatch = db.batch();
            studentUpdates.forEach(update => updateBatch.update(update.ref, update.data));
            await updateBatch.commit();
        }

        if (tokens.length === 0) {
            console.log(`[TripEnded] No valid FCM tokens for bus ${busId}`);
            return;
        }

        const title = 'Trip Completed 🏁';
        const body = `Bus ${busNumber} has completed its trip for today.`;

        for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);
            try {
                const msg = {
                    notification: { title, body },
                    data: { tripId: tripId || '', busId: busId || '', type: 'TRIP_ENDED' },
                    android: { notification: { channelId: 'bus_events', priority: 'high', sound: 'default' } },
                    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                    tokens: batch,
                };
                const result = await messaging.sendEachForMulticast(msg);
                console.log(`[TripEnded] FCM batch sent=${result.successCount} failed=${result.failureCount}`);
                await cleanupStaleTokens(result, batch, db, admin);
            } catch (fcmErr) {
                console.error('[TripEnded] FCM batch error:', fcmErr.message);
            }
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
    sendTripEndedNotification
};
