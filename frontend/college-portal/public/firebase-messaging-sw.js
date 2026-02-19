
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBQ2YPWW3u0eQGngAb3iLaTZIo6io_MwCw",
    authDomain: "live-bus-tracking-2ec59.firebaseapp.com",
    projectId: "live-bus-tracking-2ec59",
    storageBucket: "live-bus-tracking-2ec59.firebasestorage.app",
    messagingSenderId: "34427841688",
    appId: "1:34427841688:web:fee9c73258614a1ff434ed"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png' // Modify if you have a specific logo path
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
