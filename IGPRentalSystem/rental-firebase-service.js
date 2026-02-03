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

                // Save to localStorage for offline access
                try {
                    localStorage.setItem('barcodeStudents', JSON.stringify(students));
                } catch (storageError) {
                    console.warn('Failed to save students to localStorage:', storageError);
                }

                return students;
            } catch (error) {
                console.error('Error getting students from Firebase, trying localStorage:', error);
                // Fallback to localStorage if Firebase fails
                try {
                    const cached = localStorage.getItem('barcodeStudents');
                    return cached ? JSON.parse(cached) : [];
                } catch (storageError) {
                    console.error('Failed to load students from localStorage:', storageError);
                    return [];
                }
            }
        }

        async addStudent(student) {
            const studentId = student.id || student.studentId;
            const studentData = {
                ...student,
                id: studentId,
                studentId: studentId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 1. Save to localStorage FIRST (immediate, never fails)
            try {
                const students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
                const existingIndex = students.findIndex(s => (s.id || s.studentId) === studentId);
                if (existingIndex >= 0) {
                    students[existingIndex] = studentData;
                } else {
                    students.push(studentData);
                }
                localStorage.setItem('barcodeStudents', JSON.stringify(students));
            } catch (localError) {
                console.error('Error saving student to localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                const docRef = window.firebaseDb.collection(this.studentsCollection).doc(studentId);
                await window.offlineQueueService.withTimeout(
                    docRef.set(studentData)
                );
                console.log('Student synced to Firebase:', studentId);
                return docRef.id;
            } catch (error) {
                console.warn('Firebase sync failed for student, queuing:', studentId, error);
                // Queue for later sync
                window.offlineQueueService.queueOperation('addStudent', studentData, this.studentsCollection);
                return studentId; // Return ID even if Firebase fails
            }
        }

        async updateStudent(studentId, studentData) {
            const updatedData = {
                ...studentData,
                id: studentId,
                studentId: studentId,
                updatedAt: new Date()
            };

            // 1. Update localStorage FIRST
            try {
                const students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
                const index = students.findIndex(s => (s.id || s.studentId) === studentId);
                if (index >= 0) {
                    students[index] = { ...students[index], ...updatedData };
                    localStorage.setItem('barcodeStudents', JSON.stringify(students));
                }
            } catch (localError) {
                console.error('Error updating student in localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.studentsCollection).doc(studentId).update(updatedData)
                );
                console.log('Student update synced to Firebase:', studentId);
            } catch (error) {
                console.warn('Firebase sync failed for student update, queuing:', studentId, error);
                window.offlineQueueService.queueOperation('updateStudent', updatedData, this.studentsCollection);
            }
        }

        async deleteStudent(studentId) {
            // 1. Delete from localStorage FIRST
            try {
                const students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
                const filtered = students.filter(s => (s.id || s.studentId) !== studentId);
                localStorage.setItem('barcodeStudents', JSON.stringify(filtered));
            } catch (localError) {
                console.error('Error deleting student from localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.studentsCollection).doc(studentId).delete()
                );
                console.log('Student deletion synced to Firebase:', studentId);
            } catch (error) {
                console.warn('Firebase sync failed for student deletion, queuing:', studentId, error);
                window.offlineQueueService.queueOperation('deleteStudent', { id: studentId }, this.studentsCollection);
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

                // Save to localStorage for offline access
                try {
                    localStorage.setItem('barcodeOfficers', JSON.stringify(officers));
                } catch (storageError) {
                    console.warn('Failed to save officers to localStorage:', storageError);
                }

                return officers;
            } catch (error) {
                console.error('Error getting officers from Firebase, trying localStorage:', error);
                // Fallback to localStorage if Firebase fails
                try {
                    const cached = localStorage.getItem('barcodeOfficers');
                    return cached ? JSON.parse(cached) : [];
                } catch (storageError) {
                    console.error('Failed to load officers from localStorage:', storageError);
                    return [];
                }
            }
        }

        async addOfficer(officer) {
            const officerId = officer.id || officer.officerId;
            const officerData = {
                ...officer,
                id: officerId,
                officerId: officerId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 1. Save to localStorage FIRST
            try {
                const officers = JSON.parse(localStorage.getItem('barcodeOfficers')) || [];
                const existingIndex = officers.findIndex(o => (o.id || o.officerId) === officerId);
                if (existingIndex >= 0) {
                    officers[existingIndex] = officerData;
                } else {
                    officers.push(officerData);
                }
                localStorage.setItem('barcodeOfficers', JSON.stringify(officers));
            } catch (localError) {
                console.error('Error saving officer to localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                const docRef = window.firebaseDb.collection(this.officersCollection).doc(officerId);
                await window.offlineQueueService.withTimeout(
                    docRef.set(officerData)
                );
                console.log('Officer synced to Firebase:', officerId);
                return docRef.id;
            } catch (error) {
                console.warn('Firebase sync failed for officer, queuing:', officerId, error);
                window.offlineQueueService.queueOperation('addOfficer', officerData, this.officersCollection);
                return officerId;
            }
        }

        async updateOfficer(officerId, officerData) {
            const updatedData = {
                ...officerData,
                id: officerId,
                officerId: officerId,
                updatedAt: new Date()
            };

            // 1. Update localStorage FIRST
            try {
                const officers = JSON.parse(localStorage.getItem('barcodeOfficers')) || [];
                const index = officers.findIndex(o => (o.id || o.officerId) === officerId);
                if (index >= 0) {
                    officers[index] = { ...officers[index], ...updatedData };
                    localStorage.setItem('barcodeOfficers', JSON.stringify(officers));
                }
            } catch (localError) {
                console.error('Error updating officer in localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.officersCollection).doc(officerId).update(updatedData)
                );
                console.log('Officer update synced to Firebase:', officerId);
            } catch (error) {
                console.warn('Firebase sync failed for officer update, queuing:', officerId, error);
                window.offlineQueueService.queueOperation('updateOfficer', updatedData, this.officersCollection);
            }
        }

        async deleteOfficer(officerId) {
            // 1. Delete from localStorage FIRST
            try {
                const officers = JSON.parse(localStorage.getItem('barcodeOfficers')) || [];
                const filtered = officers.filter(o => (o.id || o.officerId) !== officerId);
                localStorage.setItem('barcodeOfficers', JSON.stringify(filtered));
            } catch (localError) {
                console.error('Error deleting officer from localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.officersCollection).doc(officerId).delete()
                );
                console.log('Officer deletion synced to Firebase:', officerId);
            } catch (error) {
                console.warn('Firebase sync failed for officer deletion, queuing:', officerId, error);
                window.offlineQueueService.queueOperation('deleteOfficer', { id: officerId }, this.officersCollection);
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

                // Save to localStorage for offline access
                try {
                    localStorage.setItem('inventoryItems', JSON.stringify(items));
                } catch (storageError) {
                    console.warn('Failed to save inventory to localStorage:', storageError);
                }

                return items;
            } catch (error) {
                console.error('Error getting inventory from Firebase, trying localStorage:', error);
                // Fallback to localStorage if Firebase fails
                try {
                    const cached = localStorage.getItem('inventoryItems');
                    return cached ? JSON.parse(cached) : [];
                } catch (storageError) {
                    console.error('Failed to load inventory from localStorage:', storageError);
                    return [];
                }
            }
        }

        async addInventoryItem(item) {
            const itemId = item.id;
            const itemData = {
                ...item,
                id: itemId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 1. Save to localStorage FIRST
            try {
                const items = JSON.parse(localStorage.getItem('inventoryItems')) || [];
                const existingIndex = items.findIndex(i => i.id === itemId);
                if (existingIndex >= 0) {
                    items[existingIndex] = itemData;
                } else {
                    items.push(itemData);
                }
                localStorage.setItem('inventoryItems', JSON.stringify(items));
            } catch (localError) {
                console.error('Error saving inventory item to localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                const docRef = window.firebaseDb.collection(this.inventoryCollection).doc(itemId);
                await window.offlineQueueService.withTimeout(
                    docRef.set(itemData)
                );
                console.log('Inventory item synced to Firebase:', itemId);
                return docRef.id;
            } catch (error) {
                console.warn('Firebase sync failed for inventory item, queuing:', itemId, error);
                window.offlineQueueService.queueOperation('addInventoryItem', itemData, this.inventoryCollection);
                return itemId;
            }
        }

        async updateInventoryItem(itemId, itemData) {
            const updatedData = {
                ...itemData,
                id: itemId,
                updatedAt: new Date()
            };

            // 1. Update localStorage FIRST
            try {
                const items = JSON.parse(localStorage.getItem('inventoryItems')) || [];
                const index = items.findIndex(i => i.id === itemId);
                if (index >= 0) {
                    items[index] = { ...items[index], ...updatedData };
                    localStorage.setItem('inventoryItems', JSON.stringify(items));
                }
            } catch (localError) {
                console.error('Error updating inventory item in localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.inventoryCollection).doc(itemId).update(updatedData)
                );
                console.log('Inventory item update synced to Firebase:', itemId);
            } catch (error) {
                console.warn('Firebase sync failed for inventory item update, queuing:', itemId, error);
                window.offlineQueueService.queueOperation('updateInventoryItem', updatedData, this.inventoryCollection);
            }
        }

        async deleteInventoryItem(itemId) {
            // 1. Delete from localStorage FIRST
            try {
                const items = JSON.parse(localStorage.getItem('inventoryItems')) || [];
                const filtered = items.filter(i => i.id !== itemId);
                localStorage.setItem('inventoryItems', JSON.stringify(filtered));
            } catch (localError) {
                console.error('Error deleting inventory item from localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.inventoryCollection).doc(itemId).delete()
                );
                console.log('Inventory item deletion synced to Firebase:', itemId);
            } catch (error) {
                console.warn('Firebase sync failed for inventory item deletion, queuing:', itemId, error);
                window.offlineQueueService.queueOperation('deleteInventoryItem', { id: itemId }, this.inventoryCollection);
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

                // Save to localStorage for offline access
                try {
                    localStorage.setItem('rentalRecords', JSON.stringify(records));
                } catch (storageError) {
                    console.warn('Failed to save rental records to localStorage:', storageError);
                }

                return records;
            } catch (error) {
                console.error('Error getting rental records from Firebase, trying localStorage:', error);
                // Fallback to localStorage if Firebase fails
                try {
                    const cached = localStorage.getItem('rentalRecords');
                    return cached ? JSON.parse(cached) : [];
                } catch (storageError) {
                    console.error('Failed to load rental records from localStorage:', storageError);
                    return [];
                }
            }
        }

        async addRentalRecord(record) {
            const recordData = {
                ...record,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 1. Save to localStorage FIRST
            try {
                const records = JSON.parse(localStorage.getItem('rentalRecords')) || [];
                // Generate temp ID if no id exists
                if (!recordData.id) {
                    recordData.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }
                records.push(recordData);
                localStorage.setItem('rentalRecords', JSON.stringify(records));
            } catch (localError) {
                console.error('Error saving rental record to localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                const docRef = await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.rentalRecordsCollection).add(recordData)
                );

                // Update the record with the Firebase document ID (both locally and in Firebase)
                const firebaseId = docRef.id;

                // Update the id field inside the Firebase document to match the document ID
                try {
                    await window.firebaseDb.collection(this.rentalRecordsCollection).doc(firebaseId).update({ id: firebaseId });
                } catch (updateIdError) {
                    console.warn('Failed to update id field in Firebase document:', updateIdError);
                }

                // Update the record in localStorage with Firebase ID
                try {
                    const records = JSON.parse(localStorage.getItem('rentalRecords')) || [];
                    const index = records.findIndex(r => r.id === recordData.id);
                    if (index >= 0) {
                        records[index].id = firebaseId;
                        localStorage.setItem('rentalRecords', JSON.stringify(records));
                    }
                } catch (e) { }

                console.log('Rental record synced to Firebase:', firebaseId);
                return firebaseId;
            } catch (error) {
                console.warn('Firebase sync failed for rental record, queuing:', error);
                window.offlineQueueService.queueOperation('addRentalRecord', recordData, this.rentalRecordsCollection);
                return recordData.id;
            }
        }

        async updateRentalRecord(recordId, recordData) {
            const updatedData = {
                ...recordData,
                id: recordId,
                updatedAt: new Date()
            };

            // 1. Update localStorage FIRST
            try {
                const records = JSON.parse(localStorage.getItem('rentalRecords')) || [];
                const index = records.findIndex(r => r.id === recordId);
                if (index >= 0) {
                    records[index] = { ...records[index], ...updatedData };
                    localStorage.setItem('rentalRecords', JSON.stringify(records));
                }
            } catch (localError) {
                console.error('Error updating rental record in localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.rentalRecordsCollection).doc(recordId).update(updatedData)
                );
                console.log('Rental record update synced to Firebase:', recordId);
            } catch (error) {
                console.warn('Firebase sync failed for rental record update, queuing:', recordId, error);
                window.offlineQueueService.queueOperation('updateRentalRecord', updatedData, this.rentalRecordsCollection);
            }
        }

        async deleteRentalRecord(recordId) {
            // 1. Delete from localStorage FIRST
            try {
                const records = JSON.parse(localStorage.getItem('rentalRecords')) || [];
                const filtered = records.filter(r => r.id !== recordId);
                localStorage.setItem('rentalRecords', JSON.stringify(filtered));
            } catch (localError) {
                console.error('Error deleting rental record from localStorage:', localError);
            }

            // 2. Attempt Firebase sync with timeout
            try {
                await window.offlineQueueService.withTimeout(
                    window.firebaseDb.collection(this.rentalRecordsCollection).doc(recordId).delete()
                );
                console.log('Rental record deletion synced to Firebase:', recordId);
            } catch (error) {
                console.warn('Firebase sync failed for rental record deletion, queuing:', recordId, error);
                window.offlineQueueService.queueOperation('deleteRentalRecord', { id: recordId }, this.rentalRecordsCollection);
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

        async clearRentalRecords() {
            try {
                const querySnapshot = await window.firebaseDb.collection(this.rentalRecordsCollection).get();
                const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
                await Promise.all(deletePromises);
                localStorage.removeItem('rentalRecords');
                console.log('Rental records cleared from Firebase and localStorage');
            } catch (error) {
                console.error('Error clearing rental records:', error);
                throw error;
            }
        }

        async batchImportRentalRecords(records) {
            try {
                const chunks = [];
                for (let i = 0; i < records.length; i += 500) {
                    chunks.push(records.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = window.firebaseDb.batch();
                    chunk.forEach(record => {
                        const docRef = window.firebaseDb.collection(this.rentalRecordsCollection).doc();
                        batch.set(docRef, {
                            ...record,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    });
                    await batch.commit();
                }

                // Refresh local data from Firebase
                await this.getRentalRecords();
                console.log('Batch import successful');
            } catch (error) {
                console.error('Error in batch import:', error);
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
