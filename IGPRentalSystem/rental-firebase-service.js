// Prevent duplicate class declaration
if (typeof RentalSystemFirebaseService === 'undefined') {
    window.RentalSystemFirebaseService = class RentalSystemFirebaseService {
        constructor() {
            // Define collection names with RentalSystem prefix
            this.parentCollection = 'RentalSystem';
            this.studentsCollection = 'RentalSystem_students';
            this.officersCollection = 'RentalSystem_officers';
            this.inventoryCollection = 'RentalSystem_inventory';
            this.rentalRecordsCollection = 'RentalSystem_rentalRecords';
        }

    // ==================== STUDENTS ====================
    async getStudents() {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.studentsCollection).get();
            const students = [];
            querySnapshot.forEach((doc) => {
                students.push({ id: doc.id, ...doc.data() });
            });
            return students;
        } catch (error) {
            console.error('Error getting students:', error);
            return [];
        }
    }

    async addStudent(student) {
        try {
            // Use the student's id as the document ID to ensure uniqueness
            const docRef = window.firebaseDb.collection(this.studentsCollection).doc(student.id || student.studentId);
            await docRef.set({
                ...student,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding student:', error);
            throw error;
        }
    }

    async updateStudent(studentId, studentData) {
        try {
            await window.firebaseDb.collection(this.studentsCollection).doc(studentId).update({
                ...studentData,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Error updating student:', error);
            throw error;
        }
    }

    async deleteStudent(studentId) {
        try {
            await window.firebaseDb.collection(this.studentsCollection).doc(studentId).delete();
        } catch (error) {
            console.error('Error deleting student:', error);
            throw error;
        }
    }

    async findStudentByBarcode(barcode) {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.studentsCollection)
                .where('barcode', '==', barcode)
                .limit(1)
                .get();
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding student by barcode:', error);
            return null;
        }
    }
    
    async findStudentById(studentId) {
        try {
            const doc = await window.firebaseDb.collection(this.studentsCollection).doc(studentId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding student by ID:', error);
            return null;
        }
    }

    // ==================== OFFICERS ====================
    async getOfficers() {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.officersCollection).get();
            const officers = [];
            querySnapshot.forEach((doc) => {
                officers.push({ id: doc.id, ...doc.data() });
            });
            return officers;
        } catch (error) {
            console.error('Error getting officers:', error);
            return [];
        }
    }

    async addOfficer(officer) {
        try {
            // Use the officer's id as the document ID to ensure uniqueness
            const docRef = window.firebaseDb.collection(this.officersCollection).doc(officer.id || officer.officerId);
            await docRef.set({
                ...officer,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding officer:', error);
            throw error;
        }
    }

    async updateOfficer(officerId, officerData) {
        try {
            await window.firebaseDb.collection(this.officersCollection).doc(officerId).update({
                ...officerData,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Error updating officer:', error);
            throw error;
        }
    }

    async deleteOfficer(officerId) {
        try {
            await window.firebaseDb.collection(this.officersCollection).doc(officerId).delete();
        } catch (error) {
            console.error('Error deleting officer:', error);
            throw error;
        }
    }

    async findOfficerByBarcode(barcode) {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.officersCollection)
                .where('barcode', '==', barcode)
                .limit(1)
                .get();
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding officer by barcode:', error);
            return null;
        }
    }
    
    async findOfficerById(officerId) {
        try {
            const doc = await window.firebaseDb.collection(this.officersCollection).doc(officerId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding officer by ID:', error);
            return null;
        }
    }

    // ==================== INVENTORY ====================
    async getInventoryItems() {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.inventoryCollection).get();
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            return items;
        } catch (error) {
            console.error('Error getting inventory items:', error);
            return [];
        }
    }

    async addInventoryItem(item) {
        try {
            // Use the item's id as the document ID to ensure uniqueness
            const docRef = window.firebaseDb.collection(this.inventoryCollection).doc(item.id);
            await docRef.set({
                ...item,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding inventory item:', error);
            throw error;
        }
    }

    async updateInventoryItem(itemId, itemData) {
        try {
            await window.firebaseDb.collection(this.inventoryCollection).doc(itemId).update({
                ...itemData,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    }

    async deleteInventoryItem(itemId) {
        try {
            await window.firebaseDb.collection(this.inventoryCollection).doc(itemId).delete();
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }

    async findInventoryItemByBarcode(barcode) {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.inventoryCollection)
                .where('barcode', '==', barcode)
                .limit(1)
                .get();
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding inventory item by barcode:', error);
            return null;
        }
    }
    
    async findInventoryItemById(itemId) {
        try {
            const doc = await window.firebaseDb.collection(this.inventoryCollection).doc(itemId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error finding inventory item by ID:', error);
            return null;
        }
    }

    // ==================== RENTAL RECORDS ====================
    async getRentalRecords() {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.rentalRecordsCollection)
                .orderBy('rentalDate', 'desc')
                .get();
            const records = [];
            querySnapshot.forEach((doc) => {
                records.push({ id: doc.id, ...doc.data() });
            });
            return records;
        } catch (error) {
            console.error('Error getting rental records:', error);
            return [];
        }
    }

    async addRentalRecord(record) {
        try {
            const docRef = await window.firebaseDb.collection(this.rentalRecordsCollection).add({
                ...record,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding rental record:', error);
            throw error;
        }
    }

    async updateRentalRecord(recordId, recordData) {
        try {
            await window.firebaseDb.collection(this.rentalRecordsCollection).doc(recordId).update({
                ...recordData,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Error updating rental record:', error);
            throw error;
        }
    }

    async deleteRentalRecord(recordId) {
        try {
            await window.firebaseDb.collection(this.rentalRecordsCollection).doc(recordId).delete();
        } catch (error) {
            console.error('Error deleting rental record:', error);
            throw error;
        }
    }

    async getRentalRecordsByStudent(studentId) {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.rentalRecordsCollection)
                .where('studentId', '==', studentId)
                .orderBy('rentalDate', 'desc')
                .get();
            const records = [];
            querySnapshot.forEach((doc) => {
                records.push({ id: doc.id, ...doc.data() });
            });
            return records;
        } catch (error) {
            console.error('Error getting rental records by student:', error);
            return [];
        }
    }

    async getRentalRecordsByItem(itemId) {
        try {
            const querySnapshot = await window.firebaseDb.collection(this.rentalRecordsCollection)
                .where('itemId', '==', itemId)
                .orderBy('rentalDate', 'desc')
                .get();
            const records = [];
            querySnapshot.forEach((doc) => {
                records.push({ id: doc.id, ...doc.data() });
            });
            return records;
        } catch (error) {
            console.error('Error getting rental records by item:', error);
            return [];
        }
    }

    // ==================== UTILITY METHODS ====================
    async clearAllData() {
        try {
            // Delete all documents from all collections
            const collections = [
                this.studentsCollection,
                this.officersCollection,
                this.inventoryCollection,
                this.rentalRecordsCollection
            ];

            for (const collectionName of collections) {
                const querySnapshot = await window.firebaseDb.collection(collectionName).get();
                const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(deletePromises);
            }
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }

    // ==================== REAL-TIME LISTENERS ====================
    listenToStudents(callback) {
        try {
            return window.firebaseDb.collection(this.studentsCollection).onSnapshot((querySnapshot) => {
                const students = [];
                querySnapshot.forEach((doc) => {
                    students.push({ id: doc.id, ...doc.data() });
                });
                callback(students);
            });
        } catch (error) {
            console.error('Error setting up students listener:', error);
        }
    }

    listenToOfficers(callback) {
        try {
            return window.firebaseDb.collection(this.officersCollection).onSnapshot((querySnapshot) => {
                const officers = [];
                querySnapshot.forEach((doc) => {
                    officers.push({ id: doc.id, ...doc.data() });
                });
                callback(officers);
            });
        } catch (error) {
            console.error('Error setting up officers listener:', error);
        }
    }

    listenToInventoryItems(callback) {
        try {
            return window.firebaseDb.collection(this.inventoryCollection).onSnapshot((querySnapshot) => {
                const items = [];
                querySnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                callback(items);
            });
        } catch (error) {
            console.error('Error setting up inventory items listener:', error);
        }
    }

    listenToRentalRecords(callback) {
        try {
            return window.firebaseDb.collection(this.rentalRecordsCollection)
                .orderBy('rentalDate', 'desc')
                .onSnapshot((querySnapshot) => {
                    const records = [];
                    querySnapshot.forEach((doc) => {
                        records.push({ id: doc.id, ...doc.data() });
                    });
                    callback(records);
                });
        } catch (error) {
            console.error('Error setting up rental records listener:', error);
        }
    }
    }
}
