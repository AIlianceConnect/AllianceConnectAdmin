// Firebase Database Service for Duty Tracker
// This service handles all Firebase Firestore operations for the Duty Tracker system

class DutyFirebaseService {
    constructor() {
        this.db = window.firebaseDb;
        this.parentCollection = 'DutyTrackerSystem';
        this.logsCollection = `${this.parentCollection}_logs`;
        this.taskingsCollection = `${this.parentCollection}_taskings`;
        this.officersCollection = `${this.parentCollection}_officers`; // Optional: if tracking officers separately or syncing
    }

    // ===== LOGS OPERATIONS =====

    async getLogs(dateFilter = null) {
        try {
            let query = this.db.collection(this.logsCollection);

            // Apply filtering if needed (e.g., specific date)
            // Note: complex filtering might require composite indexes in Firestore

            const querySnapshot = await query.orderBy('timeIn', 'desc').get();
            const logs = [];
            querySnapshot.forEach((doc) => {
                logs.push({ id: doc.id, ...doc.data() });
            });
            return logs;
        } catch (error) {
            console.error('Error getting duty logs:', error);
            return [];
        }
    }

    async addLog(logData) {
        try {
            const docRef = await this.db.collection(this.logsCollection).add({
                ...logData,
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding duty log:', error);
            throw error;
        }
    }

    async updateLog(logId, updateData) {
        try {
            await this.db.collection(this.logsCollection).doc(logId).update({
                ...updateData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating duty log:', error);
            throw error;
        }
    }

    // ===== TASKINGS OPERATIONS =====

    async getTaskings() {
        try {
            const querySnapshot = await this.db.collection(this.taskingsCollection).get();
            const taskings = [];
            querySnapshot.forEach((doc) => {
                taskings.push({ id: doc.id, ...doc.data() });
            });
            return taskings;
        } catch (error) {
            console.error('Error getting taskings:', error);
            return [];
        }
    }

    async addTasking(taskData) {
        try {
            const docRef = await this.db.collection(this.taskingsCollection).add({
                ...taskData,
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding tasking:', error);
            throw error;
        }
    }

    async updateTasking(taskId, updateData) {
        try {
            await this.db.collection(this.taskingsCollection).doc(taskId).update({
                ...updateData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating tasking:', error);
            throw error;
        }
    }

    async deleteTasking(taskId) {
        try {
            await this.db.collection(this.taskingsCollection).doc(taskId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting tasking:', error);
            throw error;
        }
    }

    // ===== REAL-TIME LISTENERS =====

    listenToLogs(callback) {
        return this.db.collection(this.logsCollection)
            .orderBy('timeIn', 'desc')
            .limit(100) // Limit to recent logs for performance
            .onSnapshot((querySnapshot) => {
                const logs = [];
                querySnapshot.forEach((doc) => {
                    logs.push({ id: doc.id, ...doc.data() });
                });
                callback(logs);
            }, (error) => {
                console.error('Error listening to logs:', error);
            });
    }

    listenToTaskings(callback) {
        return this.db.collection(this.taskingsCollection)
            .onSnapshot((querySnapshot) => {
                const taskings = [];
                querySnapshot.forEach((doc) => {
                    taskings.push({ id: doc.id, ...doc.data() });
                });
                callback(taskings);
            }, (error) => {
                console.error('Error listening to taskings:', error);
            });
    }

    // ===== OFFICERS OPERATIONS =====

    async findOfficerByBarcode(barcode) {
        try {
            // First try to find by officerId field
            let querySnapshot = await this.db.collection('RentalSystem_officers')
                .where('officerId', '==', barcode)
                .limit(1)
                .get();

            if (querySnapshot.empty) {
                // Should also try to check if the document ID itself is the barcode, 
                // or if there's a different field like 'uniqueId' or 'studentId'
                // Based on screenshot, officerId seems to be the one.
                // Let's also try 'id' field just in case
                querySnapshot = await this.db.collection('RentalSystem_officers')
                    .where('id', '==', barcode)
                    .limit(1)
                    .get();

                if (querySnapshot.empty) {
                    return null;
                }
            }

            const doc = querySnapshot.docs[0];
            const data = doc.data();

            // Map to DutyTracker expected format
            return {
                studentId: data.officerId || data.id,
                studentName: data.officerName || data.name,
                section: data.department || data.section || ''
            };
        } catch (error) {
            console.error('Error finding officer by barcode:', error);
            return null;
        }
    }

    async getOfficers() {
        try {
            const querySnapshot = await this.db.collection('RentalSystem_officers').get();
            const officers = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                officers.push({
                    uniqueId: doc.id, // Firestore document ID
                    studentId: data.officerId || data.id,
                    studentName: data.officerName || data.name,
                    section: data.department || data.section || '',
                    ...data
                });
            });
            return officers;
        } catch (error) {
            console.error('Error getting officers:', error);
            throw error;
        }
    }

    async addOfficer(officerData) {
        try {
            // Use custom ID if possible to match existing pattern or let Firestore generate one
            // Based on screenshot, IDs look like "12324MN-000033"
            // We'll trust the input ID is the document ID if provided, otherwise let Firestore generate

            const dataToSave = {
                officerId: officerData.studentId,
                officerName: officerData.studentName,
                department: officerData.section, // Mapping 'section' to 'department' based on screenshot
                id: officerData.studentId,
                uniqueId: officerData.studentId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Use studentId as document ID to ensure uniqueness and easy lookup
            await this.db.collection('RentalSystem_officers').doc(officerData.studentId).set(dataToSave);
            return officerData.studentId;
        } catch (error) {
            console.error('Error adding officer:', error);
            throw error;
        }
    }

    async updateOfficer(officerId, updateData) {
        try {
            const dataToUpdate = {
                updatedAt: new Date()
            };
            if (updateData.studentName) dataToUpdate.officerName = updateData.studentName;
            if (updateData.section) dataToUpdate.department = updateData.section;

            await this.db.collection('RentalSystem_officers').doc(officerId).update(dataToUpdate);
            return true;
        } catch (error) {
            console.error('Error updating officer:', error);
            throw error;
        }
    }

    async deleteOfficer(officerId) {
        try {
            await this.db.collection('RentalSystem_officers').doc(officerId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting officer:', error);
            throw error;
        }
    }

    // --- Duty Log Methods ---

    async addDutyLog(logData) {
        try {
            // Create a new document in 'DutyTracker_logs'
            // We let Firestore generate the ID, or we could use a composite key (officerId_timestamp)
            // Let's use Firestore auto-ID for simplicity, but we'll return it to store locally
            const docRef = await this.db.collection('DutyTracker_logs').add({
                ...logData, // Should include officerId, name, section, timeIn, action
                createdAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding duty log:', error);
            // Don't throw, just return null so local storage continues
            return null;
        }
    }

    async updateDutyLog(docId, updateData) {
        try {
            await this.db.collection('DutyTracker_logs').doc(docId).update({
                ...updateData, // Should include timeOut, durationSec, action
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating duty log:', error);
            return false;
        }
    }

    async getDutyLogsSince(lastSyncTimestamp) {
        try {
            const date = new Date(lastSyncTimestamp || 0);
            const querySnapshot = await this.db.collection('DutyTracker_logs')
                .where('updatedAt', '>', date)
                .get();

            const logs = [];
            querySnapshot.forEach(doc => {
                logs.push({
                    firebaseId: doc.id,
                    ...doc.data()
                });
            });
            return logs;
        } catch (error) {
            console.error('Error getting logs since:', error);
            return [];
        }
    }

}

// Initialize and export the service
let dutyFirebaseService = null;

function initializeDutyFirebaseService() {
    if (window.firebaseDb) {
        dutyFirebaseService = new DutyFirebaseService();
        window.dutyFirebaseService = dutyFirebaseService;
        console.log('Duty Firebase Service initialized successfully');
        return true;
    } else {
        console.error('Firebase not initialized. Cannot create Duty Firebase Service.');
        return false;
    }
}

// Try to initialize when Firebase is ready
if (window.firebaseDb) {
    initializeDutyFirebaseService();
} else {
    // Wait for Firebase to be ready
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb) {
            clearInterval(checkFirebase);
            initializeDutyFirebaseService();
        }
    }, 100);

    // Stop checking after 10 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!dutyFirebaseService) {
            console.error('Duty Firebase Service failed to initialize after 10 seconds');
        }
    }, 10000);
}
