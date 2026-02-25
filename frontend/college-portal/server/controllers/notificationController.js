
const { admin, db, messaging } = require('../config/firebase');

/**
 * Send notification to all students assigned to a trip's route
 */
const sendBusStartedNotification = async (tripId, busId, collegeId, busNumber) => {
    try {
        console.log(`[Notification] Sending 'Bus Started' for bus ${busId} (${busNumber})`);

        const studentsSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('favoriteBusIds', 'array-contains', busId)
            .get();

        if (studentsSnapshot.empty) {
            console.log(`[Notification] No students have favorited bus ${busId}`);
            return;
        }

        const tokens = [];
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.length > 10) {
                tokens.push(data.fcmToken);
            }
        });

        if (tokens.length === 0) {
            console.log(`[Notification] No valid FCM tokens for bus ${busId} favorites`);
            return;
        }

        // Send in batches of 500
        for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);
            const message = {
                notification: {
                    title: 'Bus Started 🚌',
                    body: `Bus ${busNumber || busId} has started its trip. Track it live!`
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
                console.log(`[BusStarted] FCM sent=${result.successCount} failed=${result.failureCount}`);
                await cleanupStaleTokens(result, batch, db, admin);
            } catch (fcmErr) {
                console.error('[BusStarted] FCM error:', fcmErr.message);
            }
        }

        // Log to notifications collection
        await db.collection('notifications').add({
            type: 'BUS_STARTED',
            busId, tripId, collegeId,
            message: `Bus ${busNumber} has started its trip`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });

    } catch (error) {
        console.error('[Notification] Error sending bus started notification:', error);
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
 */
const cleanupStaleTokens = async (result, tokensBatch, db, admin) => {
    if (result.failureCount > 0) {
        const failedTokens = [];
        result.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const errCode = resp.error?.code;
                if (errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered') {
                    failedTokens.push(tokensBatch[idx]);
                }
            }
        });

        if (failedTokens.length > 0) {
            console.log(`[FCM] Removing ${failedTokens.length} stale tokens`);
            const batch = db.batch();
            const studentsRef = db.collection('students');

            for (const staleToken of failedTokens) {
                const staleSnap = await studentsRef.where('fcmToken', '==', staleToken).get();
                staleSnap.forEach(doc => {
                    batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() });
                });
            }
            await batch.commit();
        }
    }
};

/**
 * Check proximity and notify students
 * Should be called periodically or on location update
 */
const checkProximityAndNotify = async (busId, location, collegeId, routeId) => {
    if (!location || !location.latitude || !location.longitude) return;

    try {
        // 1. Get students for this route who have a known last location
        const studentsSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('assignedRouteId', '==', routeId)
            .get();

        if (studentsSnapshot.empty) return;

        const tokensToSend = [];
        const NEARBY_THRESHOLD_KM = 2.0; // 2km radius

        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            if (student.fcmToken && student.lastLocation) {
                const dist = getDistanceFromLatLonInKm(
                    location.latitude,
                    location.longitude,
                    student.lastLocation.latitude,
                    student.lastLocation.longitude
                );

                // Check if nearby (and maybe check if we already notified them for this trip? 
                // For simplicity, we just send. Client or another logic could handle duplicate suppression, 
                // or we use a subcollection 'notifications' to track.)
                if (dist <= NEARBY_THRESHOLD_KM) {
                    tokensToSend.push(student.fcmToken);
                    console.log(`[Proximity] Student ${student.name} is ${dist.toFixed(2)}km away.`);
                }
            }
        });

        if (tokensToSend.length > 0) {
            const message = {
                notification: {
                    title: 'Bus Arriving Soon',
                    body: 'Your bus is within 2km of your location.'
                },
                data: {
                    busId: busId,
                    type: 'BUS_PROXIMITY'
                },
                tokens: tokensToSend
            };

            const response = await messaging.sendMulticast(message);
            console.log(`[Proximity] Sent ${response.successCount} notifications.`);

            // Save to Firestore for Admin Alerts (Phase 4.4)
            await db.collection('notifications').add({
                type: 'BUS_PROXIMITY',
                busId,
                collegeId,
                routeId,
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

        // Find students assigned to this route AND this specific stop
        const studentsSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('assignedRouteId', '==', routeId)
            .where('assignedStopId', '==', stopId)
            .get();

        if (studentsSnapshot.empty) {
            console.log(`[Notification] No students assigned to stop ${stopId}`);
            return;
        }

        const tokens = [];
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.fcmToken) {
                tokens.push(data.fcmToken);
            }
        });

        if (tokens.length === 0) {
            console.log(`[Notification] No FCM tokens for students at stop ${stopId}`);
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

        const response = await messaging.sendMulticast(message);
        console.log(`[Notification] Stop arrival: Sent ${response.successCount}, Failed: ${response.failureCount}`);

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

        console.log(`[StopEvent] type=${type} stop="${stopName}" trip=${tripId}`);

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

        // FIXED: Query by favoriteBusIds, not assignedRouteId
        const studentsSnap = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('favoriteBusIds', 'array-contains', busId)
            .get();

        const tokens = [];
        studentsSnap.forEach(doc => {
            const token = doc.data().fcmToken;
            if (token && typeof token === 'string' && token.length > 10) tokens.push(token);
        });

        console.log(`[StopEvent] Found ${tokens.length} tokens for bus ${busId} favorites`);

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
                    console.log(`[StopEvent] FCM batch sent=${result.successCount} failed=${result.failureCount}`);
                    await cleanupStaleTokens(result, batch, db, admin);
                } catch (fcmErr) {
                    console.error('[StopEvent] FCM batch error:', fcmErr.message);
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

        // Query by favorite — same pattern as above
        const studentsSnap = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('favoriteBusIds', 'array-contains', busId)
            .get();

        if (studentsSnap.empty) {
            console.log(`[TripEnded] No students favorited bus ${busId}`);
            return;
        }

        const tokens = [];
        studentsSnap.forEach(doc => {
            const token = doc.data().fcmToken;
            if (token && typeof token === 'string' && token.length > 10) tokens.push(token);
        });

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
