// Prevent duplicate script execution
if (typeof window.firebaseConfigLoaded === 'undefined') {
    window.firebaseConfigLoaded = true;

    // Firebase Configuration
    // Your actual Firebase project configuration
    const firebaseConfig = {
        apiKey: "AIzaSyBQVVgVkUtG_8rGdVLSnbNcA64wXgDAZH8",
        authDomain: "allianceapp-2791e.firebaseapp.com",
        projectId: "allianceapp-2791e",
        storageBucket: "allianceapp-2791e.firebasestorage.app",
        messagingSenderId: "853647869",
        appId: "1:853647869:web:c6bf95a9bdfc5b21e58724",
        measurementId: "G-5C9BEL5SR9"
    };

    // Initialize Firebase immediately when this script loads
    let firebaseApp = null;
    let firebaseDb = null;

    function initializeFirebase() {
        try {
            // Check if Firebase is already initialized
            if (window.firebaseApp && window.firebaseDb) {
                console.log('Firebase already initialized');
                return true;
            }
            
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded. Make sure Firebase CDN scripts are included.');
                return false;
            }
            
            // Initialize Firebase
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseDb = firebase.firestore();
            
            // Export to window
            window.firebaseApp = firebaseApp;
            window.firebaseDb = firebaseDb;
            
            console.log('Firebase initialized successfully');
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
}
