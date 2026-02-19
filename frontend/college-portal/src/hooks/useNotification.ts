import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Firebase messaging hook for handling push notifications

const useNotification = (userId: string | null) => {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    useEffect(() => {
        const requestPermission = async () => {
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);

                if (permission === 'granted' && userId) {
                    // Get token
                    // const currentToken = await getToken(messaging, { vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' });
                    // If we don't have vapid key, we might get an error.
                    // Let's try to get it without or prompt user.
                    // For now, I'll log a warning if it fails.

                    try {
                        const currentToken = await getToken(messaging);
                        if (currentToken) {
                            console.log('FCM Token:', currentToken);
                            setToken(currentToken);
                            // Save to Firestore
                            const userRef = doc(db, 'students', userId);
                            await updateDoc(userRef, {
                                fcmToken: currentToken
                            });
                        } else {
                            console.log('No registration token available. Request permission to generate one.');
                        }
                    } catch (err) {
                        console.log('An error occurred while retrieving token. Do you have a VAPID key?', err);
                        // Fallback or retry logic
                    }
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        };

        if (userId) {
            requestPermission();
        }

        // Foreground message listener
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Message received. ', payload);
            // Customize notification here or show toast
            new Notification(payload.notification?.title || 'New Message', {
                body: payload.notification?.body,
            });
        });

        return () => {
            unsubscribe();
        }
    }, [userId]);

    return { token, notificationPermission };
};

export default useNotification;
