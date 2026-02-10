// Firebase Configuration for DutyTracker
// Shared configuration with Accounts System
const firebaseConfig = {
    apiKey: "AIzaSyBQVVgVkUtG_8rGdVLSnbNcA64wXgDAZH8",
    authDomain: "allianceapp-2791e.firebaseapp.com",
    projectId: "allianceapp-2791e",
    storageBucket: "allianceapp-2791e.firebasestorage.app",
    messagingSenderId: "853647741869",
    appId: "1:853647741869:web:c6bf95a9bdfc5b21e58724",
    measurementId: "G-5C9BEL5SR9"
};

// Initialize Firebase immediately when this script loads
let firebaseApp = null;
let firebaseDb = null;

function initializeFirebase() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded. Make sure Firebase CDN scripts are included.');
            return false;
        }

        // Initialize Firebase
        // Check if already initialized to avoid "Firebase App named '[DEFAULT]' already exists" error
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.app();
        }

        firebaseDb = firebase.firestore();

        // Export to window
        window.firebaseApp = firebaseApp;
        window.firebaseDb = firebaseDb;

        console.log('Firebase initialized successfully for DutyTracker');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Try to initialize immediately
if (typeof firebase !== 'undefined') {
    initializeFirebase();
} else {
    // If Firebase isn't loaded yet, wait for it
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(checkFirebase);
            initializeFirebase();
        }
    }, 100);

    // Stop checking after 10 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!firebaseApp) {
            console.error('Firebase failed to load after 10 seconds');
        }
    }, 10000);
}
