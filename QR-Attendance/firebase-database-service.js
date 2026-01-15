// Firebase Database Service Layer
// This service replaces all localStorage operations with Firebase Firestore operations

class FirebaseDatabaseService {
    constructor() {
        this.db = window.firebaseDb;
        this.services = window.firebaseServices;
        this.parentCollection = 'AttendanceSystem';
        this.studentsCollection = `${this.parentCollection}_students`;
        this.attendanceCollection = `${this.parentCollection}_attendance`;
        this.eventsCollection = `${this.parentCollection}_events`;
        this.settingsCollection = `${this.parentCollection}_settings`;
    }

    // ===== STUDENT DATABASE OPERATIONS =====
    
    async getStudents() {
        try {
            // Always get Local Storage data first (for offline support)
            let students = [];
            if (window.offlineSync) {
                students = window.offlineSync.getFromLocalStorage('students');
            }
            
            // Try Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const querySnapshot = await window.firebaseDb.collection(this.studentsCollection).get();
                    const firebaseStudents = [];
                    querySnapshot.forEach((doc) => {
                        firebaseStudents.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Save Firebase students to Local Storage if they don't exist there
                    if (window.offlineSync) {
                        const localStudentIds = new Set(students.map(s => s.studentId));
                        firebaseStudents.forEach(fbStudent => {
                            if (!localStudentIds.has(fbStudent.studentId)) {
                                // Save to Local Storage
                                window.offlineSync.saveToLocalStorage('students', fbStudent, 'add');
                            }
                        });
                    }
                    
                    // Merge Firebase data with Local Storage data (use studentId for deduplication)
                    students = window.offlineSync.mergeData(students, firebaseStudents, 'studentId');
                } catch (error) {
                    console.error('Error getting students from Firebase:', error);
                    // Continue with Local Storage data
                }
            }
            
            return students;
        } catch (error) {
            console.error('Error getting students:', error);
            // Fallback to Local Storage
            if (window.offlineSync) {
                return window.offlineSync.getFromLocalStorage('students');
            }
            // Final fallback to legacy localStorage
            try {
                const legacy = localStorage.getItem('barcodeStudents');
                return legacy ? JSON.parse(legacy) : [];
            } catch (e) {
                return [];
            }
        }
    }

    async addStudent(studentData) {
        const studentRecord = {
            studentId: studentData.studentId,
            studentName: studentData.studentName,
            section: studentData.section,
            uniqueId: studentData.studentId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'addStudent',
                async () => {
                    const docRef = await window.firebaseDb.collection(this.studentsCollection).add(studentRecord);
                    return docRef.id;
                },
                { ...studentData, ...studentRecord },
                'students'
            );
        } else {
            // Fallback without offline sync
            try {
                const docRef = await window.firebaseDb.collection(this.studentsCollection).add(studentRecord);
                return docRef.id;
            } catch (error) {
                console.error('Error adding student:', error);
                throw error;
            }
        }
    }

    async updateStudent(studentId, studentData) {
        const updateData = {
            ...studentData,
            updatedAt: new Date()
        };

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'updateStudent',
                async () => {
                    const students = await this.getStudents();
                    const student = students.find(s => s.studentId === studentId);
                    if (student) {
                        await window.firebaseDb.collection(this.studentsCollection).doc(student.id).update(updateData);
                        return true;
                    }
                    return false;
                },
                { studentId, ...updateData },
                'students'
            );
        } else {
            // Fallback without offline sync
            try {
                const students = await this.getStudents();
                const student = students.find(s => s.studentId === studentId);
                if (student) {
                    await window.firebaseDb.collection(this.studentsCollection).doc(student.id).update(updateData);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error updating student:', error);
                throw error;
            }
        }
    }

    async deleteStudent(studentId) {
        // Find the student first
        const students = await this.getStudents();
        const student = students.find(s => s.studentId === studentId);
        
        if (!student) {
            return false;
        }

        const deleteData = { studentId: studentId };

        // Use executeWithOfflineSupport to handle Local Storage deletion and Firebase sync
        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'deleteStudent',
                async () => {
                    // Query Firebase directly to find the student document
                    if (!window.firebaseDb) {
                        throw new Error('Firebase not initialized');
                    }
                    const querySnapshot = await window.firebaseDb.collection(this.studentsCollection)
                        .where('studentId', '==', studentId)
                        .limit(1)
                        .get();
                    
                    if (!querySnapshot.empty) {
                        await querySnapshot.docs[0].ref.delete();
                        console.log(`Deleted student from Firebase: ${studentId}`);
                    } else {
                        console.warn(`Student not found in Firebase: ${studentId}`);
                    }
                    return true;
                },
                deleteData,
                'students'
            );
        } else {
            // Fallback without offline sync
            try {
                // Delete from Local Storage manually
                const localStudents = JSON.parse(localStorage.getItem('barcodeStudents') || '[]');
                const filtered = localStudents.filter(s => s.studentId !== studentId);
                localStorage.setItem('barcodeStudents', JSON.stringify(filtered));
                
                // Delete from Firebase if available
                if (student.id && window.firebaseDb) {
                    await window.firebaseDb.collection(this.studentsCollection).doc(student.id).delete();
                }
                return true;
            } catch (error) {
                console.error('Error deleting student:', error);
                throw error;
            }
        }
    }

    async findStudentByBarcode(barcodeValue) {
        try {
            const students = await this.getStudents();
            return students.find(s => this.encodeStudentData(s.studentId) === barcodeValue);
        } catch (error) {
            console.error('Error finding student by barcode:', error);
            return null;
        }
    }

    // ===== ATTENDANCE RECORDS OPERATIONS =====

    async getAttendanceRecords() {
        try {
            // Always get Local Storage data first (for offline support)
            let records = [];
            if (window.offlineSync) {
                records = window.offlineSync.getFromLocalStorage('attendance');
            }
            
            // Try Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection).get();
                    const firebaseRecords = [];
                    querySnapshot.forEach((doc) => {
                        firebaseRecords.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Save Firebase records to Local Storage if they don't exist there
                    if (window.offlineSync) {
                        const localRecordKeys = new Set(records.map(r => 
                            `${r.studentId}_${r.date}_${r.event}`
                        ));
                        firebaseRecords.forEach(fbRecord => {
                            const key = `${fbRecord.studentId}_${fbRecord.date}_${fbRecord.event}`;
                            if (!localRecordKeys.has(key)) {
                                // Save to Local Storage
                                window.offlineSync.saveToLocalStorage('attendance', fbRecord, 'add');
                            }
                        });
                    }
                    
                    // Merge Firebase data with Local Storage data
                    records = window.offlineSync.mergeData(records, firebaseRecords, 'studentId');
                } catch (error) {
                    console.error('Error getting attendance records from Firebase:', error);
                    // Continue with Local Storage data
                }
            }
            
            return records;
        } catch (error) {
            console.error('Error getting attendance records:', error);
            // Fallback to Local Storage
            if (window.offlineSync) {
                return window.offlineSync.getFromLocalStorage('attendance');
            }
            // Final fallback to legacy localStorage
            try {
                const legacy = localStorage.getItem('attendanceRecords');
                return legacy ? JSON.parse(legacy) : [];
            } catch (e) {
                return [];
            }
        }
    }

    async addAttendanceRecord(recordData) {
        // Ensure all required fields match Firebase document structure
        const record = {
            ...recordData,
            createdAt: recordData.createdAt || new Date(),
            updatedAt: recordData.updatedAt || new Date(),
            checkInMs: recordData.checkInMs || Date.now(),
            // Ensure date, event, section, studentId, studentName, timeIn, timeOut are present
            date: recordData.date || '',
            event: recordData.event || '',
            section: recordData.section || '',
            studentId: recordData.studentId || '',
            studentName: recordData.studentName || '',
            timeIn: recordData.timeIn || '',
            timeOut: recordData.timeOut || ''
        };

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'addAttendanceRecord',
                async () => {
                    const docRef = await window.firebaseDb.collection(this.attendanceCollection).add(record);
                    return docRef.id;
                },
                record,
                'attendance'
            );
        } else {
            // Fallback without offline sync
            try {
                const docRef = await window.firebaseDb.collection(this.attendanceCollection).add(record);
                return docRef.id;
            } catch (error) {
                console.error('Error adding attendance record:', error);
                throw error;
            }
        }
    }

    async updateAttendanceRecord(recordId, updateData) {
        // Ensure updateData includes all necessary fields for Local Storage and sync
        // Match Firebase document structure
        const updateRecord = {
            ...updateData,
            id: recordId,
            updatedAt: new Date(),
            // Ensure all required fields are present
            studentId: updateData.studentId || '',
            studentName: updateData.studentName || '',
            section: updateData.section || '',
            event: updateData.event || '',
            date: updateData.date || '',
            timeIn: updateData.timeIn || '',
            timeOut: updateData.timeOut || '',
            checkInMs: updateData.checkInMs || updateData.lastUpdateMs || Date.now()
        };

        // Save to Local Storage first (works offline)
        if (window.offlineSync && updateData.studentId) {
            const localRecords = window.offlineSync.getFromLocalStorage('attendance');
            const recordIndex = localRecords.findIndex(r => {
                if (recordId && r.id === recordId) return true;
                if (updateData.studentId && r.studentId === updateData.studentId) {
                    if (updateData.date && updateData.event && r.date === updateData.date && r.event === updateData.event) {
                        return true;
                    }
                    if (updateData.date && r.date === updateData.date) {
                        return true;
                    }
                }
                return false;
            });
            
            if (recordIndex !== -1) {
                // Update existing record in Local Storage - preserve all existing fields and merge with updateData
                const existingRecord = localRecords[recordIndex];
                localRecords[recordIndex] = { 
                    ...existingRecord, // Preserve all existing fields (studentName, checkInMs, createdAt, etc.)
                    ...updateData, // Apply updates
                    updatedAt: new Date(),
                    // Ensure required fields are present and preserve existing values
                    studentName: updateData.studentName || existingRecord.studentName || '',
                    checkInMs: updateData.checkInMs || existingRecord.checkInMs || Date.now(),
                    createdAt: existingRecord.createdAt || new Date(),
                    timeIn: updateData.timeIn !== undefined ? updateData.timeIn : (existingRecord.timeIn || ''),
                    timeOut: updateData.timeOut !== undefined ? updateData.timeOut : (existingRecord.timeOut || ''),
                    date: updateData.date || existingRecord.date || '',
                    event: updateData.event || existingRecord.event || '',
                    section: updateData.section || existingRecord.section || '',
                    studentId: updateData.studentId || existingRecord.studentId || ''
                };
                localStorage.setItem(window.offlineSync.localStoragePrefix + 'attendance', JSON.stringify(localRecords));
                localStorage.setItem('attendanceRecords', JSON.stringify(localRecords));
                console.log('Updated Local Storage record:', localRecords[recordIndex]);
            } else {
                // Record not found, add it as new
                const newRecord = {
                    ...updateData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    checkInMs: updateData.checkInMs || Date.now()
                };
                localRecords.push(newRecord);
                localStorage.setItem(window.offlineSync.localStoragePrefix + 'attendance', JSON.stringify(localRecords));
                localStorage.setItem('attendanceRecords', JSON.stringify(localRecords));
                console.log('Added new record to Local Storage:', newRecord);
            }
        }

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'updateAttendanceRecord',
                async () => {
                    // First, try to find the document in Firebase using the recordId
                    // If recordId doesn't exist, try to find by studentId, date, and event
                    let docRef = null;
                    
                    // Only try to get by ID if recordId is provided
                    if (recordId) {
                    // Only try to get by ID if recordId is provided
                    if (recordId) {
                        try {
                            // Try to get the document directly
                            const doc = await window.firebaseDb.collection(this.attendanceCollection).doc(recordId).get();
                            if (doc.exists) {
                                docRef = doc.ref;
                            }
                        } catch (error) {
                            // Document doesn't exist with this ID, try to find by query
                            console.log('Document not found with ID, searching by fields...');
                        }
                    }
                    }
                    
                    // If not found by ID, try to find by studentId, date, and event
                    if (!docRef && updateData.studentId && updateData.date && updateData.event) {
                        const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection)
                            .where('studentId', '==', updateData.studentId)
                            .where('date', '==', updateData.date)
                            .where('event', '==', updateData.event)
                            .limit(1)
                            .get();
                        
                        if (!querySnapshot.empty) {
                            docRef = querySnapshot.docs[0].ref;
                        }
                    }
                    
                    // If still not found, try to find by just studentId and date (in case event is missing)
                    if (!docRef && updateData.studentId && updateData.date) {
                        const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection)
                            .where('studentId', '==', updateData.studentId)
                            .where('date', '==', updateData.date)
                            .limit(1)
                            .get();
                        
                        if (!querySnapshot.empty) {
                            docRef = querySnapshot.docs[0].ref;
                        }
                    }
                    
                    if (docRef) {
                        // Update the document
                        await docRef.update({
                            ...updateData,
                            updatedAt: new Date()
                        });
                        return true;
                    } else {
                        // Document doesn't exist, create it instead
                        const newRecord = {
                            ...updateData,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        await window.firebaseDb.collection(this.attendanceCollection).add(newRecord);
                        return true;
                    }
                },
                updateRecord,
                'attendance'
            );
        } else {
            // Fallback without offline sync
            try {
                // Try to find the document first
                let docRef = null;
                
                // Only try to get by ID if recordId is provided
                if (recordId) {
                    try {
                        const doc = await window.firebaseDb.collection(this.attendanceCollection).doc(recordId).get();
                        if (doc.exists) {
                            docRef = doc.ref;
                        }
                    } catch (error) {
                        // Document doesn't exist with this ID, will try to find by query below
                    }
                }
                
                // If not found by ID, try to find by query
                if (!docRef && updateData.studentId && updateData.date && updateData.event) {
                    const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection)
                        .where('studentId', '==', updateData.studentId)
                        .where('date', '==', updateData.date)
                        .where('event', '==', updateData.event)
                        .limit(1)
                        .get();
                    
                    if (!querySnapshot.empty) {
                        docRef = querySnapshot.docs[0].ref;
                    }
                }
                
                // If still not found, try by just studentId and date
                if (!docRef && updateData.studentId && updateData.date) {
                    const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection)
                        .where('studentId', '==', updateData.studentId)
                        .where('date', '==', updateData.date)
                        .limit(1)
                        .get();
                    
                    if (!querySnapshot.empty) {
                        docRef = querySnapshot.docs[0].ref;
                    }
                }
                
                if (docRef) {
                    await docRef.update({
                        ...updateData,
                        updatedAt: new Date()
                    });
                } else {
                    // Create if doesn't exist
                    const newRecord = {
                        ...updateData,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    await window.firebaseDb.collection(this.attendanceCollection).add(newRecord);
                }
                return true;
            } catch (error) {
                console.error('Error updating attendance record:', error);
                throw error;
            }
        }
    }

    async findAttendanceRecord(studentId, section, event, date) {
        try {
            const records = await this.getAttendanceRecords();
            return records.find(r => 
                r.studentId === studentId && 
                r.section === section && 
                r.event === event && 
                r.date === date
            );
        } catch (error) {
            console.error('Error finding attendance record:', error);
            return null;
        }
    }

    async getAttendanceRecordsByEvent(eventName) {
        try {
            // Validate eventName
            if (!eventName || eventName === undefined || eventName === null) {
                console.warn('getAttendanceRecordsByEvent called with invalid eventName:', eventName);
                return [];
            }
            
            // Always get Local Storage data first (for offline support)
            let records = [];
            if (window.offlineSync) {
                records = window.offlineSync.getFromLocalStorage('attendance')
                    .filter(r => r.event === eventName);
            }
            
            // Try Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const querySnapshot = await window.firebaseDb.collection(this.attendanceCollection)
                        .where('event', '==', eventName)
                        .get();
                    const firebaseRecords = [];
                    querySnapshot.forEach((doc) => {
                        firebaseRecords.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Save Firebase records to Local Storage if they don't exist there
                    if (window.offlineSync) {
                        const localRecordKeys = new Set(records.map(r => 
                            `${r.studentId}_${r.date}_${r.event}`
                        ));
                        firebaseRecords.forEach(fbRecord => {
                            const key = `${fbRecord.studentId}_${fbRecord.date}_${fbRecord.event}`;
                            if (!localRecordKeys.has(key)) {
                                // Save to Local Storage
                                window.offlineSync.saveToLocalStorage('attendance', fbRecord, 'add');
                            }
                        });
                    }
                    
                    // Merge Firebase data with Local Storage data
                    records = window.offlineSync.mergeData(records, firebaseRecords, 'studentId');
                } catch (error) {
                    console.error('Error getting attendance records by event from Firebase:', error);
                    // Continue with Local Storage data
                }
            }
            
            return records;
        } catch (error) {
            console.error('Error getting attendance records by event:', error);
            // Fallback to Local Storage
            if (window.offlineSync) {
                return window.offlineSync.getFromLocalStorage('attendance')
                    .filter(r => r.event === eventName);
            }
            // Final fallback to legacy localStorage
            try {
                const legacy = localStorage.getItem('attendanceRecords');
                const allRecords = legacy ? JSON.parse(legacy) : [];
                return allRecords.filter(r => r.event === eventName);
            } catch (e) {
                return [];
            }
        }
    }

    async deleteAttendanceRecordsByEvent(eventName) {
        try {
            // Delete from Local Storage first (works offline)
            if (window.offlineSync) {
                const localRecords = window.offlineSync.getFromLocalStorage('attendance');
                const filtered = localRecords.filter(r => r.event !== eventName);
                localStorage.setItem(window.offlineSync.localStoragePrefix + 'attendance', JSON.stringify(filtered));
                localStorage.setItem('attendanceRecords', JSON.stringify(filtered));
            }

            // Delete from Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const records = await this.getAttendanceRecordsByEvent(eventName);
                    const deletePromises = records
                        .filter(record => record.id) // Only delete if has Firebase ID
                        .map(record => 
                            window.firebaseDb.collection(this.attendanceCollection).doc(record.id).delete()
                        );
                    await Promise.all(deletePromises);
                } catch (error) {
                    console.error('Error deleting from Firebase:', error);
                    // Queue for sync if Firebase fails
                    if (window.offlineSync) {
                        window.offlineSync.addToPendingQueue({
                            type: 'deleteAttendanceRecordsByEvent',
                            data: { eventName }
                        });
                    }
                }
            } else {
                // Offline: queue for sync
                if (window.offlineSync) {
                    window.offlineSync.addToPendingQueue({
                        type: 'deleteAttendanceRecordsByEvent',
                        data: { eventName }
                    });
                }
            }

            return true;
        } catch (error) {
            console.error('Error deleting attendance records by event:', error);
            throw error;
        }
    }

    // ===== EVENT OPERATIONS =====

    async createEvent(eventData) {
        const eventRecord = {
            ...eventData,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'createEvent',
                async () => {
                    const docRef = await window.firebaseDb.collection(this.eventsCollection).add(eventRecord);
                    return docRef.id;
                },
                eventRecord,
                'events'
            );
        } else {
            // Fallback without offline sync
            try {
                const docRef = await window.firebaseDb.collection(this.eventsCollection).add(eventRecord);
                return docRef.id;
            } catch (error) {
                console.error('Error creating event:', error);
                throw error;
            }
        }
    }

    async getEventsWithAttendanceCounts() {
        try {
            const events = await this.getEvents();
            const eventsWithCounts = [];
            
            for (const event of events) {
                const attendanceCount = await this.getAttendanceRecordsByEvent(event.name);
                eventsWithCounts.push({
                    ...event,
                    attendanceCount: attendanceCount.length,
                    firstDate: attendanceCount.length > 0 ? 
                        attendanceCount.reduce((min, record) => 
                            !min || new Date(record.date) < new Date(min.date) ? record : min
                        ).date : null,
                    lastDate: attendanceCount.length > 0 ? 
                        attendanceCount.reduce((max, record) => 
                            !max || new Date(record.date) > new Date(max.date) ? record : max
                        ).date : null
                });
            }
            
            return eventsWithCounts;
        } catch (error) {
            console.error('Error getting events with attendance counts:', error);
            return [];
        }
    }

    async getEvents() {
        try {
            // Always get Local Storage data first (for offline support)
            let events = [];
            if (window.offlineSync) {
                events = window.offlineSync.getFromLocalStorage('events');
            }
            
            // Try Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const querySnapshot = await window.firebaseDb.collection(this.eventsCollection).get();
                    const firebaseEvents = [];
                    querySnapshot.forEach((doc) => {
                        firebaseEvents.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Save Firebase events to Local Storage if they don't exist there
                    const localEvents = window.offlineSync.getFromLocalStorage('events');
                    const localEventIds = new Set(localEvents.map(e => e.id));
                    firebaseEvents.forEach(fbEvent => {
                        if (fbEvent.id && !localEventIds.has(fbEvent.id)) {
                            // Save to Local Storage
                            window.offlineSync.saveToLocalStorage('events', fbEvent, 'add');
                        }
                    });
                    
                    // Merge Firebase data with Local Storage data
                    events = window.offlineSync.mergeData(events, firebaseEvents, 'id');
                } catch (error) {
                    console.error('Error getting events from Firebase:', error);
                    // Continue with Local Storage data
                }
            }
            
            return events;
        } catch (error) {
            console.error('Error getting events:', error);
            // Fallback to Local Storage
            if (window.offlineSync) {
                return window.offlineSync.getFromLocalStorage('events');
            }
            return [];
        }
    }

    async getEvent(eventId) {
        try {
            const doc = await window.firebaseDb.collection(this.eventsCollection).doc(eventId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting event:', error);
            return null;
        }
    }

    async updateEvent(eventId, eventData) {
        try {
            await window.firebaseDb.collection(this.eventsCollection).doc(eventId).update({
                ...eventData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    }

    async deleteEvent(eventId, eventNameParam = null) {
        try {
            // First, get the event to retrieve the event name
            // Try Local Storage first (works offline), then Firebase
            let event = null;
            let eventName = eventNameParam; // Use provided eventName first
            
            // Try Local Storage first
            if (window.offlineSync) {
                const localEvents = window.offlineSync.getFromLocalStorage('events');
                event = localEvents.find(e => e.id === eventId);
                if (event) {
                    eventName = event.name;
                }
            }
            
            // If not found in Local Storage and online, try Firebase
            if (!event && window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    event = await this.getEvent(eventId);
                    if (event) {
                        eventName = event.name;
                    }
                } catch (error) {
                    console.error('Error getting event from Firebase:', error);
                }
            }
            
            // If still no event found, try to get eventName from attendance records
            if (!eventName && window.offlineSync) {
                const localRecords = window.offlineSync.getFromLocalStorage('attendance');
                // Try to find event name from records (for events created from attendance records)
                const recordWithEvent = localRecords.find(r => r.event);
                if (recordWithEvent && recordWithEvent.event) {
                    // Try to match by checking if any record has this event
                    const matchingRecord = localRecords.find(r => {
                        // If eventId matches something in the record, use that event name
                        return r.event;
                    });
                    if (matchingRecord) {
                        eventName = matchingRecord.event;
                    }
                }
            }
            
            // Delete from Local Storage first (works offline)
            // This will work even if eventName is null (will be handled by calling code)
            if (window.offlineSync && eventName) {
                // Delete attendance records from Local Storage
                const localRecords = window.offlineSync.getFromLocalStorage('attendance');
                const filteredRecords = localRecords.filter(r => r.event !== eventName);
                localStorage.setItem(window.offlineSync.localStoragePrefix + 'attendance', JSON.stringify(filteredRecords));
                localStorage.setItem('attendanceRecords', JSON.stringify(filteredRecords));
                
                // Delete event from Local Storage
                const localEvents = window.offlineSync.getFromLocalStorage('events');
                const filteredEvents = localEvents.filter(e => e.id !== eventId && e.name !== eventName);
                localStorage.setItem(window.offlineSync.localStoragePrefix + 'events', JSON.stringify(filteredEvents));
            }
            
            // If we don't have eventName, we can't proceed with Firebase deletion
            if (!eventName) {
                console.warn(`Event with ID ${eventId} not found. Cannot delete from Firebase without eventName.`);
                // Still queue for sync in case eventName becomes available later
                if (window.offlineSync) {
                    window.offlineSync.addToPendingQueue({
                        type: 'deleteEvent',
                        data: { eventId, eventName: null }
                    });
                }
                // Return true because Local Storage deletion was handled by calling code
                return true;
            }

            // Delete from Firebase if online and we have eventName
            if (eventName) {
                if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                    try {
                        // Delete all attendance records for this event by event name
                        const attendanceRecords = await this.getAttendanceRecordsByEvent(eventName);
                        const deletePromises = attendanceRecords
                            .filter(record => record.id) // Only delete if has Firebase ID
                            .map(record => 
                                window.firebaseDb.collection(this.attendanceCollection).doc(record.id).delete()
                            );
                        await Promise.all(deletePromises);

                        // Then delete the event itself
                        if (eventId) {
                            await window.firebaseDb.collection(this.eventsCollection).doc(eventId).delete();
                        }
                    } catch (error) {
                        console.error('Error deleting from Firebase:', error);
                        // Queue for sync if Firebase fails
                        if (window.offlineSync) {
                            window.offlineSync.addToPendingQueue({
                                type: 'deleteEvent',
                                data: { eventId, eventName }
                            });
                        }
                    }
                } else {
                    // Offline: queue for sync
                    if (window.offlineSync) {
                        window.offlineSync.addToPendingQueue({
                            type: 'deleteEvent',
                            data: { eventId, eventName }
                        });
                    }
                }
            } else if (window.offlineSync) {
                // No eventName found but we have eventId - queue for sync
                window.offlineSync.addToPendingQueue({
                    type: 'deleteEvent',
                    data: { eventId, eventName: null }
                });
            }

            return true;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    }

    async getCurrentEvent() {
        try {
            // Always check localStorage first (for offline support)
            const localEvent = localStorage.getItem('currentEvent');
            
            // Try Firebase if online
            if (window.offlineSync && window.offlineSync.isOnline && window.firebaseDb) {
                try {
                    const doc = await window.firebaseDb.collection(this.settingsCollection).doc('currentEvent').get();
                    if (doc.exists) {
                        const firebaseEvent = doc.data().eventName;
                        // Update localStorage with Firebase value
                        if (firebaseEvent) {
                            localStorage.setItem('currentEvent', firebaseEvent);
                            return firebaseEvent;
                        }
                    }
                } catch (error) {
                    console.error('Error getting current event from Firebase:', error);
                    // Continue with localStorage value
                }
            }
            
            return localEvent;
        } catch (error) {
            console.error('Error getting current event:', error);
            // Fallback to localStorage
            return localStorage.getItem('currentEvent');
        }
    }

    async setCurrentEvent(eventName) {
        const eventData = {
            eventName: eventName,
            updatedAt: new Date()
        };

        // Always update localStorage immediately
        localStorage.setItem('currentEvent', eventName);

        if (window.offlineSync) {
            return await window.offlineSync.executeWithOfflineSupport(
                'setCurrentEvent',
                async () => {
                    await window.firebaseDb.collection(this.settingsCollection).doc('currentEvent').set(eventData);
                    return true;
                },
                eventData,
                'settings'
            );
        } else {
            // Fallback without offline sync
            try {
                await window.firebaseDb.collection(this.settingsCollection).doc('currentEvent').set(eventData);
                return true;
            } catch (error) {
                console.error('Error setting current event:', error);
                return false;
            }
        }
    }

    // ===== REAL-TIME LISTENERS =====

    async listenToAttendanceRecords(callback) {
        try {
            return window.firebaseDb.collection(this.attendanceCollection).onSnapshot(
                (querySnapshot) => {
                    const records = [];
                    const changes = querySnapshot.docChanges();
                    
                    // Process changes to detect deletions first
                    changes.forEach((change) => {
                        if (change.type === 'removed') {
                            // Document was deleted - notify callback with deletion info
                            callback({ 
                                type: 'removed', 
                                id: change.doc.id, 
                                data: change.doc.data() 
                            });
                        }
                    });
                    
                    // Get all current records
                    querySnapshot.forEach((doc) => {
                        records.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Callback with all current records (for additions/updates)
                    callback(records);
                }
            );
        } catch (error) {
            console.error('Error setting up attendance records listener:', error);
            return null;
        }
    }

    async listenToStudents(callback) {
        try {
            return window.firebaseDb.collection(this.studentsCollection).onSnapshot(
                (querySnapshot) => {
                    const students = [];
                    querySnapshot.forEach((doc) => {
                        students.push({ id: doc.id, ...doc.data() });
                    });
                    callback(students);
                }
            );
        } catch (error) {
            console.error('Error setting up students listener:', error);
            return null;
        }
    }

    async listenToEvents(callback) {
        try {
            return window.firebaseDb.collection(this.eventsCollection).onSnapshot(
                (querySnapshot) => {
                    const events = [];
                    const changes = querySnapshot.docChanges();
                    
                    // Process changes to detect deletions first
                    changes.forEach((change) => {
                        if (change.type === 'removed') {
                            // Document was deleted - notify callback with deletion info
                            callback({ 
                                type: 'removed', 
                                id: change.doc.id, 
                                data: change.doc.data() 
                            });
                        }
                    });
                    
                    // Get all current events
                    querySnapshot.forEach((doc) => {
                        events.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Callback with all current events (for additions/updates)
                    callback(events);
                }
            );
        } catch (error) {
            console.error('Error setting up events listener:', error);
            return null;
        }
    }

    // ===== UTILITY FUNCTIONS =====

    encodeStudentData(studentId) {
        // Use the existing encoder function from encoder.js
        if (typeof window.encodeStudentData === 'function') {
            return window.encodeStudentData(studentId);
        }
        return studentId; // Fallback if encoder is not available
    }

    // ===== MIGRATION HELPERS =====

    async migrateFromLocalStorage() {
        try {
            console.log('Starting migration from localStorage to Firebase...');
            
            // Migrate students
            const localStudents = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
            console.log(`Found ${localStudents.length} students to migrate`);
            
            for (const student of localStudents) {
                try {
                    await this.addStudent(student);
                } catch (error) {
                    console.warn(`Failed to migrate student ${student.studentId}:`, error);
                }
            }

            // Migrate attendance records
            const localRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
            console.log(`Found ${localRecords.length} attendance records to migrate`);
            
            for (const record of localRecords) {
                try {
                    await this.addAttendanceRecord(record);
                } catch (error) {
                    console.warn(`Failed to migrate attendance record for ${record.studentId}:`, error);
                }
            }

            console.log('Migration completed successfully!');
            return true;
        } catch (error) {
            console.error('Error during migration:', error);
            throw error;
        }
    }

    async clearAllData() {
        try {
            // Get all students and attendance records before clearing
            const students = await this.getStudents();
            const records = await this.getAttendanceRecords();
            
            // Clear Local Storage first (works offline)
            if (window.offlineSync) {
                localStorage.removeItem(window.offlineSync.localStoragePrefix + 'students');
                localStorage.removeItem(window.offlineSync.localStoragePrefix + 'attendance');
                localStorage.removeItem('barcodeStudents');
                localStorage.removeItem('attendanceRecords');
            }

            // Queue individual deletions for sync (works offline)
            if (window.offlineSync) {
                // Queue each student deletion
                for (const student of students) {
                    if (student.studentId) {
                        window.offlineSync.addToPendingQueue({
                            type: 'deleteStudent',
                            data: { studentId: student.studentId }
                        });
                    }
                }
                
                // Queue each attendance record deletion
                for (const record of records) {
                    if (record.studentId && record.date && record.event) {
                        window.offlineSync.addToPendingQueue({
                            type: 'deleteAttendanceRecord',
                            data: {
                                studentId: record.studentId,
                                date: record.date,
                                event: record.event
                            }
                        });
                    }
                }
            }

            // Clear Firebase if online
            if (window.firebaseDb && window.offlineSync && window.offlineSync.isOnline) {
                try {
                    // Clear students
                    const studentDeletePromises = students
                        .filter(student => student.id) // Only delete if has Firebase ID
                        .map(student => 
                            window.firebaseDb.collection(this.studentsCollection).doc(student.id).delete()
                        );
                    await Promise.all(studentDeletePromises);

                    // Clear attendance records
                    const recordDeletePromises = records
                        .filter(record => record.id) // Only delete if has Firebase ID
                        .map(record => 
                            window.firebaseDb.collection(this.attendanceCollection).doc(record.id).delete()
                        );
                    await Promise.all(recordDeletePromises);
                } catch (error) {
                    console.error('Error clearing Firebase data:', error);
                    // Continue even if Firebase fails - Local Storage is already cleared
                }
            }

            console.log('All data cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }
}

// Create global instance
window.firebaseDB = new FirebaseDatabaseService();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseDatabaseService;
}
