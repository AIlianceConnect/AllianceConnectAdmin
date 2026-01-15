// Firebase Database Service for Accounts System
// This service handles all Firebase Firestore operations for the Accounts system

class AccountsFirebaseService {
    constructor() {
        this.db = window.firebaseDb;
        this.parentCollection = 'AccountsSystem';
        this.studentNumbersCollection = `${this.parentCollection}_studentNumbers`;
        this.pendingRequestsCollection = `${this.parentCollection}_pendingRequests`;
        this.studentAccountsCollection = `${this.parentCollection}_studentAccounts`;
    }

    // ===== STUDENT NUMBERS DATABASE OPERATIONS =====
    
    async getStudentNumbers() {
        try {
            const querySnapshot = await this.db.collection(this.studentNumbersCollection).get();
            const studentNumbers = [];
            querySnapshot.forEach((doc) => {
                studentNumbers.push({ id: doc.id, ...doc.data() });
            });
            return studentNumbers;
        } catch (error) {
            console.error('Error getting student numbers:', error);
            return [];
        }
    }

    async addStudentNumber(studentData) {
        try {
            const docRef = await this.db.collection(this.studentNumbersCollection).add({
                studentId: studentData.studentId,
                studentName: studentData.studentName,
                section: studentData.section || '',
                course: studentData.course || '',
                yearSection: studentData.yearSection || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                addedAt: new Date(),
                addedBy: studentData.addedBy || 'Admin',
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding student number:', error);
            throw error;
        }
    }

    async updateStudentNumber(studentId, studentData) {
        try {
            const studentNumbers = await this.getStudentNumbers();
            const student = studentNumbers.find(s => s.studentId === studentId);
            if (!student) {
                throw new Error('Student number not found');
            }

            await this.db.collection(this.studentNumbersCollection).doc(student.id).update({
                studentId: studentData.studentId,
                studentName: studentData.studentName,
                section: studentData.section || '',
                course: studentData.course || '',
                yearSection: studentData.yearSection || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                updatedAt: new Date(),
                updatedBy: studentData.updatedBy || 'Admin'
            });
            return true;
        } catch (error) {
            console.error('Error updating student number:', error);
            throw error;
        }
    }

    async deleteStudentNumber(studentId) {
        try {
            const studentNumbers = await this.getStudentNumbers();
            const student = studentNumbers.find(s => s.studentId === studentId);
            if (!student) {
                throw new Error('Student number not found');
            }

            await this.db.collection(this.studentNumbersCollection).doc(student.id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting student number:', error);
            throw error;
        }
    }

    async findStudentNumber(studentId) {
        try {
            const studentNumbers = await this.getStudentNumbers();
            return studentNumbers.find(s => s.studentId === studentId);
        } catch (error) {
            console.error('Error finding student number:', error);
            return null;
        }
    }

    // ===== PENDING REQUESTS OPERATIONS =====
    
    async getPendingRequests() {
        try {
            const querySnapshot = await this.db.collection(this.pendingRequestsCollection).get();
            const requests = [];
            querySnapshot.forEach((doc) => {
                requests.push({ id: doc.id, ...doc.data() });
            });
            return requests;
        } catch (error) {
            console.error('Error getting pending requests:', error);
            return [];
        }
    }

    async addPendingRequest(requestData) {
        try {
            const docRef = await this.db.collection(this.pendingRequestsCollection).add({
                studentId: requestData.studentId,
                name: requestData.name,
                email: requestData.email,
                password: requestData.password,
                status: requestData.status || 'pending',
                requestTime: new Date(),
                approvedAt: null,
                rejectedAt: null,
                approvedBy: null,
                rejectedBy: null
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding pending request:', error);
            throw error;
        }
    }

    async updatePendingRequest(requestId, updateData) {
        try {
            await this.db.collection(this.pendingRequestsCollection).doc(requestId).update({
                ...updateData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating pending request:', error);
            throw error;
        }
    }

    async deletePendingRequest(requestId) {
        try {
            await this.db.collection(this.pendingRequestsCollection).doc(requestId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting pending request:', error);
            throw error;
        }
    }

    // ===== STUDENT ACCOUNTS OPERATIONS =====
    
    async getStudentAccounts() {
        try {
            const querySnapshot = await this.db.collection(this.studentAccountsCollection).get();
            const accounts = [];
            querySnapshot.forEach((doc) => {
                accounts.push({ id: doc.id, ...doc.data() });
            });
            return accounts;
        } catch (error) {
            console.error('Error getting student accounts:', error);
            return [];
        }
    }

    async addStudentAccount(accountData) {
        try {
            const docRef = await this.db.collection(this.studentAccountsCollection).add({
                studentId: accountData.studentId,
                studentName: accountData.studentName,
                section: accountData.section,
                email: accountData.email,
                password: accountData.password, // Note: In production, this should be hashed
                createdAt: new Date(),
                approvedBy: accountData.approvedBy || 'Admin',
                approvedAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding student account:', error);
            throw error;
        }
    }

    async updateStudentAccount(accountId, accountData) {
        try {
            await this.db.collection(this.studentAccountsCollection).doc(accountId).update({
                ...accountData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating student account:', error);
            throw error;
        }
    }

    async deleteStudentAccount(accountId) {
        try {
            await this.db.collection(this.studentAccountsCollection).doc(accountId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting student account:', error);
            throw error;
        }
    }

    async findStudentAccount(studentId) {
        try {
            const accounts = await this.getStudentAccounts();
            return accounts.find(a => a.studentId === studentId);
        } catch (error) {
            console.error('Error finding student account:', error);
            return null;
        }
    }

    // ===== REAL-TIME LISTENERS =====
    
    listenToStudentNumbers(callback) {
        return this.db.collection(this.studentNumbersCollection)
            .onSnapshot((querySnapshot) => {
                const studentNumbers = [];
                querySnapshot.forEach((doc) => {
                    studentNumbers.push({ id: doc.id, ...doc.data() });
                });
                callback(studentNumbers);
            }, (error) => {
                console.error('Error listening to student numbers:', error);
            });
    }

    listenToPendingRequests(callback) {
        return this.db.collection(this.pendingRequestsCollection)
            .onSnapshot((querySnapshot) => {
                const requests = [];
                querySnapshot.forEach((doc) => {
                    requests.push({ id: doc.id, ...doc.data() });
                });
                callback(requests);
            }, (error) => {
                console.error('Error listening to pending requests:', error);
            });
    }

    listenToStudentAccounts(callback) {
        return this.db.collection(this.studentAccountsCollection)
            .onSnapshot((querySnapshot) => {
                const accounts = [];
                querySnapshot.forEach((doc) => {
                    accounts.push({ id: doc.id, ...doc.data() });
                });
                callback(accounts);
            }, (error) => {
                console.error('Error listening to student accounts:', error);
            });
    }

    // ===== UTILITY METHODS =====
    
    async clearAllData() {
        try {
            // Clear all collections
            const collections = [
                this.studentNumbersCollection,
                this.pendingRequestsCollection,
                this.studentAccountsCollection
            ];

            for (const collection of collections) {
                const querySnapshot = await this.db.collection(collection).get();
                const batch = this.db.batch();
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }

    async getCollectionStats() {
        try {
            const [studentNumbers, pendingRequests, studentAccounts] = await Promise.all([
                this.getStudentNumbers(),
                this.getPendingRequests(),
                this.getStudentAccounts()
            ]);

            return {
                studentNumbers: studentNumbers.length,
                pendingRequests: pendingRequests.length,
                studentAccounts: studentAccounts.length,
                pendingCount: pendingRequests.filter(r => r.status === 'pending').length,
                approvedCount: pendingRequests.filter(r => r.status === 'approved').length,
                rejectedCount: pendingRequests.filter(r => r.status === 'rejected').length
            };
        } catch (error) {
            console.error('Error getting collection stats:', error);
            return null;
        }
    }
}

// Initialize and export the service
let accountsFirebaseService = null;

function initializeAccountsFirebaseService() {
    if (window.firebaseDb) {
        accountsFirebaseService = new AccountsFirebaseService();
        window.accountsFirebaseService = accountsFirebaseService;
        console.log('Accounts Firebase Service initialized successfully');
        return true;
    } else {
        console.error('Firebase not initialized. Cannot create Accounts Firebase Service.');
        return false;
    }
}

// Try to initialize when Firebase is ready
if (window.firebaseDb) {
    initializeAccountsFirebaseService();
} else {
    // Wait for Firebase to be ready
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb) {
            clearInterval(checkFirebase);
            initializeAccountsFirebaseService();
        }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!accountsFirebaseService) {
            console.error('Accounts Firebase Service failed to initialize after 10 seconds');
        }
    }, 10000);
}


