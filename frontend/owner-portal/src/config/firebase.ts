// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQ2YPWW3u0eQGngAb3iLaTZIo6io_MwCw",
    authDomain: "live-bus-tracking-2ec59.firebaseapp.com",
    projectId: "live-bus-tracking-2ec59",
    storageBucket: "live-bus-tracking-2ec59.firebasestorage.app",
    messagingSenderId: "34427841688",
    appId: "1:34427841688:web:fee9c73258614a1ff434ed",
    measurementId: "G-CFZPGEMB7P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, analytics, auth, googleProvider };
