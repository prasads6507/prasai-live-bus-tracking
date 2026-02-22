
const { db, messaging } = require('../config/firebase');

/**
 * Send notification to all students assigned to a trip's route
 */
const sendBusStartedNotification = async (tripId, busId, collegeId, routeId) => {
    try {
        console.log(`[Notification] Sending 'Bus Started' for trip ${tripId}`);

        // 1. Get students subscribed to this route (or all students in college if logic differs, but usually route-based)
        // For simplicity in this app, we might notifying all students who have this bus as 'assigned'? 
        // Or students who have favorited?
        // Let's assume we notify students whose 'routeId' matches.

        const studentsSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('routeId', '==', routeId)
            .get();

        if (studentsSnapshot.empty) {
            console.log(`[Notification] No students found for route ${routeId}`);
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
            console.log(`[Notification] No FCM tokens found for route ${routeId}`);
            return;
        }

        // 2. Send Multicast Message
        const message = {
            notification: {
                title: 'Bus Started',
                body: 'Your bus has started its trip and is on the way.'
            },
            data: {
                tripId: tripId,
                busId: busId,
                type: 'BUS_STARTED'
            },
            tokens: tokens
        };

        const response = await messaging.sendMulticast(message);
        console.log(`[Notification] Sent ${response.successCount} messages. Failed: ${response.failureCount}`);

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
 * Check proximity and notify students
 * Should be called periodically or on location update
 */
const checkProximityAndNotify = async (busId, location, collegeId, routeId) => {
    if (!location || !location.latitude || !location.longitude) return;

    try {
        // 1. Get students for this route who have a known last location
        const studentsSnapshot = await db.collection('students')
            .where('collegeId', '==', collegeId)
            .where('routeId', '==', routeId)
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

module.exports = {
    sendBusStartedNotification,
    checkProximityAndNotify,
    sendStopArrivalNotification
};
