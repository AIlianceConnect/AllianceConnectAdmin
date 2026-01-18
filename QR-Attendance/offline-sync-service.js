// Offline Sync Service
// Handles offline data storage and synchronization with Firebase

class OfflineSyncService {
    constructor() {
        // Initialize with navigator.onLine status
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pendingSyncKey = 'pendingSyncQueue';
        this.localStoragePrefix = 'offline_';
        this.TIMEOUT_MS = 5000; // 5 seconds timeout for online operations

        // Listen for online/offline events (these fire when browser detects connection change)
        window.addEventListener('online', () => {
            console.log('Browser online event fired');
            this.isOnline = true;
            this.triggerStatusUpdate();
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            console.log('Browser offline event fired');
            this.isOnline = false;
            this.triggerStatusUpdate();
            this.handleOffline();
        });

        // Periodically check online status (every 10 seconds) as backup
        setInterval(() => {
            const wasOnline = this.isOnline;
            this.isOnline = navigator.onLine;

            // Update UI if status changed
            if (wasOnline !== this.isOnline) {
                this.triggerStatusUpdate();
                if (this.isOnline) {
                    this.handleOnline();
                } else {
                    this.handleOffline();
                }
            }

            // Try to sync if online and there are pending operations
            if (this.isOnline && !this.syncInProgress) {
                const pendingQueue = this.getPendingSyncQueue();
                if (pendingQueue.length > 0) {
                    console.log(`Periodic sync check: Found ${pendingQueue.length} pending operations`);
                    this.syncPendingData();
                }
            }
        }, 10000);

        // Initial status update and sync check
        setTimeout(() => {
            this.triggerStatusUpdate();
            // Check for pending sync operations and try to sync if online
            const pendingQueue = this.getPendingSyncQueue();
            if (pendingQueue.length > 0) {
                console.log(`Found ${pendingQueue.length} pending sync operations on page load`);
            }
            // Try to sync if online
            if (this.isOnline) {
                this.syncPendingData();
            }
        }, 500);

        // Also check on page visibility change (when user comes back to the page)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                // Page became visible and we're online, try to sync
                const pendingQueue = this.getPendingSyncQueue();
                if (pendingQueue.length > 0) {
                    console.log(`Page visible, found ${pendingQueue.length} pending sync operations`);
                    this.syncPendingData();
                }
            }
        });

        // Also check when window regains focus (user switches back to tab)
        window.addEventListener('focus', () => {
            if (this.isOnline) {
                const pendingQueue = this.getPendingSyncQueue();
                if (pendingQueue.length > 0) {
                    console.log(`Window focused, found ${pendingQueue.length} pending sync operations`);
                    this.syncPendingData();
                }
            }
        });
    }

    async handleOnline() {
        console.log('Connection restored. Syncing pending data...');
        this.isOnline = true;
        this.triggerStatusUpdate();
        // Wait a bit for connection to stabilize
        setTimeout(() => {
            if (this.isOnline) {
                this.syncPendingData();
                this.reconcileLocalData();
            }
        }, 2000);
        this.showSyncStatus('Connection restored. Syncing data...', 'info');
    }

    handleOffline() {
        console.log('Connection lost. Saving to local storage...');
        this.isOnline = false;
        this.triggerStatusUpdate();
        this.showSyncStatus('Offline mode. Data will sync when connection is restored.', 'warning');
    }

    // Helper to race a promise against a timeout
    resultWithTimeout(promise, ms, operationName = 'Operation') {
        const timeout = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${operationName} timed out after ${ms}ms`));
            }, ms);
        });
        return Promise.race([promise, timeout]);
    }

    // Check if we're actually online (simple network check)
    async checkOnlineStatus() {
        // Simply trust navigator.onLine - it's accurate for network connectivity
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;

        // Update UI if status changed
        if (wasOnline !== this.isOnline) {
            this.triggerStatusUpdate();
        }

        return this.isOnline;
    }

    // Trigger status update in UI
    triggerStatusUpdate() {
        // Dispatch custom event for UI to listen to
        window.dispatchEvent(new CustomEvent('offlineStatusChanged', {
            detail: { isOnline: this.isOnline }
        }));

        // Also call update function if available
        if (typeof updateOfflineStatus === 'function') {
            updateOfflineStatus();
        }
    }

    // Get pending sync queue
    getPendingSyncQueue() {
        try {
            const queue = localStorage.getItem(this.pendingSyncKey);
            return queue ? JSON.parse(queue) : [];
        } catch (error) {
            console.error('Error reading pending sync queue:', error);
            return [];
        }
    }

    // Add operation to pending sync queue
    addToPendingQueue(operation) {
        try {
            const queue = this.getPendingSyncQueue();
            // Add unique ID and timestamp
            operation.syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            operation.timestamp = new Date().toISOString();
            operation.synced = false;
            queue.push(operation);
            localStorage.setItem(this.pendingSyncKey, JSON.stringify(queue));
            console.log('Added to sync queue:', operation.type, operation.syncId);
        } catch (error) {
            console.error('Error adding to sync queue:', error);
        }
    }

    // Remove operation from pending sync queue
    removeFromPendingQueue(syncId) {
        try {
            const queue = this.getPendingSyncQueue();
            const filtered = queue.filter(op => op.syncId !== syncId);
            localStorage.setItem(this.pendingSyncKey, JSON.stringify(filtered));
        } catch (error) {
            console.error('Error removing from sync queue:', error);
        }
    }

    // Save data to Local Storage (for offline access)
    saveToLocalStorage(collection, data, operation = 'add') {
        try {
            const key = `${this.localStoragePrefix}${collection}`;
            let items = [];

            // Get existing items
            const existing = localStorage.getItem(key);
            if (existing) {
                try {
                    items = JSON.parse(existing);
                } catch (e) {
                    console.warn('Error parsing Local Storage data, starting fresh:', e);
                    items = [];
                }
            }

            if (operation === 'add') {
                // Check for duplicates before adding
                const isDuplicate = items.some(item => {
                    if (data.id && item.id) return item.id === data.id;
                    if (data.studentId && item.studentId) {
                        // For attendance records, check studentId + date + event
                        if (data.date && data.event && item.date && item.event) {
                            return item.studentId === data.studentId &&
                                item.date === data.date &&
                                item.event === data.event;
                        }
                        // For students, check studentId
                        return item.studentId === data.studentId;
                    }
                    return false;
                });

                if (!isDuplicate) {
                    // New item: mark as unsynced by default unless specified
                    items.push({ ...data, _synced: data._synced !== undefined ? data._synced : false });
                } else {
                    // Update instead if duplicate found
                    const index = items.findIndex(item => {
                        if (data.id && item.id) return item.id === data.id;
                        if (data.studentId && item.studentId) {
                            if (data.date && data.event && item.date && item.event) {
                                return item.studentId === data.studentId &&
                                    item.date === data.date &&
                                    item.event === data.event;
                            }
                            return item.studentId === data.studentId;
                        }
                        return false;
                    });
                    if (index !== -1) {
                        // Preserve _synced status if not specified in data
                        const isSynced = data._synced !== undefined ? data._synced : items[index]._synced;
                        items[index] = { ...items[index], ...data, _synced: isSynced };
                    }
                }
            } else if (operation === 'update') {
                // Update existing item
                const index = items.findIndex(item => {
                    if (data.id && item.id) return item.id === data.id;
                    if (data.studentId && item.studentId) {
                        if (data.date && data.event && item.date && item.event) {
                            return item.studentId === data.studentId &&
                                item.date === data.date &&
                                item.event === data.event;
                        }
                        return item.studentId === data.studentId;
                    }
                    return false;
                });
                if (index !== -1) {
                    // Preserve _synced status if not specified in data
                    const isSynced = data._synced !== undefined ? data._synced : items[index]._synced;
                    items[index] = { ...items[index], ...data, _synced: isSynced };
                } else {
                    // If not found, add it
                    items.push({ ...data, _synced: data._synced !== undefined ? data._synced : false });
                }
            } else if (operation === 'delete') {
                // Remove item
                items = items.filter(item => {
                    if (data.id && item.id) return item.id !== data.id;
                    if (data.studentId && item.studentId) {
                        if (data.date && data.event && item.date && item.event) {
                            return !(item.studentId === data.studentId &&
                                item.date === data.date &&
                                item.event === data.event);
                        }
                        return item.studentId !== data.studentId;
                    }
                    return true;
                });
            }

            localStorage.setItem(key, JSON.stringify(items));

            // Also update legacy localStorage keys for backward compatibility
            if (collection === 'attendance') {
                localStorage.setItem('attendanceRecords', JSON.stringify(items));
            } else if (collection === 'students') {
                localStorage.setItem('barcodeStudents', JSON.stringify(items));
            }

            console.log(`Saved to Local Storage: ${collection}`, operation, `(${items.length} items)`);
        } catch (error) {
            console.error('Error saving to Local Storage:', error);
            // If storage is full, try to clean up old data
            try {
                const key = `${this.localStoragePrefix}${collection}`;
                localStorage.removeItem(key);
                localStorage.setItem(key, JSON.stringify([data]));
                console.warn('Local Storage was full, cleared and saved new data');
            } catch (e) {
                console.error('Failed to save to Local Storage even after cleanup:', e);
            }
        }
    }

    // Mark a local item as synced
    markAsSynced(collection, criteria) {
        try {
            const key = `${this.localStoragePrefix}${collection}`;
            const existing = localStorage.getItem(key);
            if (!existing) return;

            let items = JSON.parse(existing);
            let updated = false;

            items = items.map(item => {
                let match = false;
                if (criteria.id && item.id) match = item.id === criteria.id;
                else if (criteria.studentId) {
                    if (criteria.date && criteria.event) {
                        match = item.studentId === criteria.studentId &&
                            item.date === criteria.date &&
                            item.event === criteria.event;
                    } else {
                        match = item.studentId === criteria.studentId;
                    }
                }

                if (match) {
                    updated = true;
                    return { ...item, _synced: true };
                }
                return item;
            });

            if (updated) {
                localStorage.setItem(key, JSON.stringify(items));
                console.log(`Marked item as synced in ${collection}`);
            }
        } catch (error) {
            console.error('Error marking item as synced:', error);
        }
    }

    // Identify unsynced items and add them to the queue if not already there
    reconcileLocalData() {
        console.log('Running data consistency check...');
        const collections = ['attendance', 'students'];
        const pendingQueue = this.getPendingSyncQueue();
        let addedCount = 0;

        collections.forEach(collection => {
            const items = this.getFromLocalStorage(collection);
            const unsyncedItems = items.filter(item => item._synced === false);

            unsyncedItems.forEach(item => {
                // Check if already in pending queue to avoid duplicates
                const alreadyQueued = pendingQueue.some(op => {
                    // Simplistic check: comparing data objects could be tricky, 
                    // check unique IDs if possible
                    if (op.collection !== collection) return false;
                    if (item.id && op.data.id) return item.id === op.data.id;
                    if (item.studentId && op.data.studentId) {
                        if (item.date && item.event) {
                            return item.studentId === op.data.studentId &&
                                item.date === op.data.date &&
                                item.event === op.data.event;
                        }
                        return item.studentId === op.data.studentId;
                    }
                    return false;
                });

                if (!alreadyQueued) {
                    // Determine operation type based on collection
                    // This is a best-guess; for more complex apps track op type in local storage too
                    let type = 'unknown';
                    if (collection === 'attendance') type = 'addAttendanceRecord';
                    else if (collection === 'students') type = 'addStudent'; // Assume add for simplicity? 
                    // Update: if it's existing it effectively acts as upsert in our sync logic anyway

                    if (type !== 'unknown') {
                        this.addToPendingQueue({
                            type: type,
                            data: item,
                            collection: collection
                        });
                        addedCount++;
                    }
                }
            });
        });

        if (addedCount > 0) {
            console.log(`Consistency check: Re-queued ${addedCount} unsynced items.`);
            this.showSyncStatus(`Found ${addedCount} unsynced items, retrying...`, 'warning');
            this.syncPendingData();
        } else {
            console.log('Consistency check: All local data appears to be synced or queued.');
        }
    }

    // Get data from Local Storage
    getFromLocalStorage(collection) {
        try {
            const key = `${this.localStoragePrefix}${collection}`;
            let data = localStorage.getItem(key);

            // If no data in new format, try legacy keys for backward compatibility
            if (!data) {
                if (collection === 'attendance') {
                    data = localStorage.getItem('attendanceRecords');
                } else if (collection === 'students') {
                    data = localStorage.getItem('barcodeStudents');
                }
            }

            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading from Local Storage:', error);
            return [];
        }
    }

    // Merge Local Storage data with Firebase data (prevent duplicates)
    // Prioritizes Local Storage data (newer offline changes) over Firebase data
    mergeData(localData, firebaseData, uniqueKey) {
        // Start with Local Storage data (prioritize offline changes)
        const merged = [];
        const seenKeys = new Set();

        // Helper function to get unique key for an item
        const getKey = (item) => {
            if (uniqueKey === 'id') {
                // For students, use studentId as primary key (more reliable)
                if (item.studentId) return `student_${item.studentId}`;
                if (item.id) return `id_${item.id}`;
                return null;
            } else if (uniqueKey === 'studentId') {
                // Explicit studentId matching
                return item.studentId ? `student_${item.studentId}` : null;
            } else {
                // For attendance records
                return `${item.studentId}_${item.date}_${item.event}`;
            }
        };

        // Add Local Storage data first (prioritize offline changes)
        localData.forEach(item => {
            const key = getKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(item);
            }
        });

        // Add Firebase data that doesn't exist in Local Storage
        firebaseData.forEach(firebaseItem => {
            const key = getKey(firebaseItem);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(firebaseItem);
            }
        });

        return merged;
    }

    // Sync pending data to Firebase
    async syncPendingData() {
        if (this.syncInProgress) {
            console.log('Sync already in progress...');
            return;
        }

        // Check if online
        if (!this.isOnline) {
            console.log('Still offline, skipping sync');
            return;
        }

        this.syncInProgress = true;
        const queue = this.getPendingSyncQueue();

        if (queue.length === 0) {
            this.syncInProgress = false;
            return;
        }

        console.log(`Syncing ${queue.length} pending operations...`);

        const firebaseDB = window.firebaseDB;
        if (!firebaseDB || !window.firebaseDb) {
            console.error('Firebase DB not available');
            this.syncInProgress = false;
            return;
        }

        let syncedCount = 0;
        let failedCount = 0;

        for (const operation of queue) {
            if (operation.synced) {
                continue; // Skip already synced operations
            }

            try {
                // Wrap in timeout to prevent hanging
                await this.resultWithTimeout((async () => {
                    switch (operation.type) {
                        case 'addAttendanceRecord':
                            // Check if record already exists by querying Firebase directly
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for addAttendanceRecord');
                                    break;
                                }

                                let existing = null;
                                if (operation.data.studentId && operation.data.date && operation.data.event) {
                                    const querySnapshot = await window.firebaseDb.collection(firebaseDB.attendanceCollection)
                                        .where('studentId', '==', operation.data.studentId)
                                        .where('date', '==', operation.data.date)
                                        .where('event', '==', operation.data.event)
                                        .limit(1)
                                        .get();

                                    if (!querySnapshot.empty) {
                                        existing = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                                    }
                                }

                                if (!existing) {
                                    // Create new record with proper Firebase document structure
                                    const newRecord = {
                                        ...operation.data,
                                        createdAt: operation.data.createdAt || new Date(),
                                        updatedAt: operation.data.updatedAt || new Date(),
                                        checkInMs: operation.data.checkInMs || Date.now(),
                                        // Ensure all required fields are present
                                        date: operation.data.date || '',
                                        event: operation.data.event || '',
                                        section: operation.data.section || '',
                                        studentId: operation.data.studentId || '',
                                        studentName: operation.data.studentName || '',
                                        timeIn: operation.data.timeIn || '',
                                        timeOut: operation.data.timeOut || ''
                                    };
                                    // Remove id field if it's a local ID
                                    delete newRecord.id;
                                    await window.firebaseDb.collection(firebaseDB.attendanceCollection).add(newRecord);
                                    console.log(`Added attendance record to Firebase: ${operation.data.studentId} - ${operation.data.date}`);
                                } else {
                                    console.log(`Attendance record already exists in Firebase: ${operation.data.studentId} - ${operation.data.date}`);
                                }
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing addAttendanceRecord:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'updateAttendanceRecord':
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync');
                                    break;
                                }

                                // Query Firebase directly to find the document
                                let docRef = null;

                                // Try to find by studentId, date, and event (most reliable)
                                if (operation.data.studentId && operation.data.date && operation.data.event) {
                                    const querySnapshot = await window.firebaseDb.collection(firebaseDB.attendanceCollection)
                                        .where('studentId', '==', operation.data.studentId)
                                        .where('date', '==', operation.data.date)
                                        .where('event', '==', operation.data.event)
                                        .limit(1)
                                        .get();

                                    if (!querySnapshot.empty) {
                                        docRef = querySnapshot.docs[0].ref;
                                    }
                                }

                                // If still not found, try by just studentId and date
                                if (!docRef && operation.data.studentId && operation.data.date) {
                                    const querySnapshot = await window.firebaseDb.collection(firebaseDB.attendanceCollection)
                                        .where('studentId', '==', operation.data.studentId)
                                        .where('date', '==', operation.data.date)
                                        .limit(1)
                                        .get();

                                    if (!querySnapshot.empty) {
                                        docRef = querySnapshot.docs[0].ref;
                                    }
                                }

                                // If still not found, try by ID (in case it's a Firebase ID)
                                if (!docRef && operation.data.id) {
                                    try {
                                        const doc = await window.firebaseDb.collection(firebaseDB.attendanceCollection).doc(operation.data.id).get();
                                        if (doc.exists) {
                                            docRef = doc.ref;
                                        }
                                    } catch (error) {
                                        // ID doesn't exist, will create new document below
                                    }
                                }

                                if (docRef) {
                                    // Get existing document to preserve fields not in updateData
                                    const existingDoc = await docRef.get();
                                    const existingData = existingDoc.exists ? existingDoc.data() : {};

                                    // Update the existing document - ensure all fields match Firebase structure
                                    const updateFields = {
                                        ...existingData, // Preserve existing fields
                                        ...operation.data, // Apply updates
                                        updatedAt: new Date()
                                    };
                                    // Remove id field if it's a local ID
                                    delete updateFields.id;
                                    // Ensure all required fields are present
                                    if (!updateFields.checkInMs && operation.data.lastUpdateMs) {
                                        updateFields.checkInMs = operation.data.lastUpdateMs;
                                    }
                                    // Ensure studentName and timeIn are included
                                    if (!updateFields.studentName && operation.data.studentName) {
                                        updateFields.studentName = operation.data.studentName;
                                    }
                                    if (!updateFields.timeIn && operation.data.timeIn) {
                                        updateFields.timeIn = operation.data.timeIn;
                                    }
                                    await docRef.update(updateFields);
                                    console.log(`Updated attendance record in Firebase: ${operation.data.studentId} - ${operation.data.date}`, updateFields);
                                } else {
                                    // Document doesn't exist, create it - ensure all fields match Firebase structure
                                    const newRecord = {
                                        ...operation.data,
                                        createdAt: operation.data.createdAt || new Date(),
                                        updatedAt: new Date(),
                                        checkInMs: operation.data.checkInMs || operation.data.lastUpdateMs || Date.now(),
                                        // Ensure all required fields are present
                                        date: operation.data.date || '',
                                        event: operation.data.event || '',
                                        section: operation.data.section || '',
                                        studentId: operation.data.studentId || '',
                                        studentName: operation.data.studentName || '',
                                        timeIn: operation.data.timeIn || '',
                                        timeOut: operation.data.timeOut || ''
                                    };
                                    // Remove id field if it's a local ID
                                    delete newRecord.id;
                                    await window.firebaseDb.collection(firebaseDB.attendanceCollection).add(newRecord);
                                    console.log(`Created new attendance record in Firebase: ${operation.data.studentId} - ${operation.data.date}`, newRecord);
                                }

                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing updateAttendanceRecord:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'addStudent':
                            // Check if student already exists in Firebase directly
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for addStudent');
                                    break;
                                }

                                const querySnapshot = await window.firebaseDb.collection(firebaseDB.studentsCollection)
                                    .where('studentId', '==', operation.data.studentId)
                                    .limit(1)
                                    .get();

                                if (querySnapshot.empty) {
                                    // Create student record with proper structure
                                    const studentRecord = {
                                        studentId: operation.data.studentId || '',
                                        studentName: operation.data.studentName || '',
                                        section: operation.data.section || '',
                                        uniqueId: operation.data.studentId || operation.data.uniqueId || '',
                                        createdAt: operation.data.createdAt || new Date(),
                                        updatedAt: operation.data.updatedAt || new Date()
                                    };
                                    // Add directly to Firebase (don't call addStudent again to avoid re-queuing)
                                    await window.firebaseDb.collection(firebaseDB.studentsCollection).add(studentRecord);
                                    console.log(`Added student to Firebase: ${operation.data.studentId}`);
                                } else {
                                    console.log(`Student already exists in Firebase: ${operation.data.studentId}`);
                                }
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing addStudent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'updateStudent':
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for updateStudent');
                                    break;
                                }

                                // Find the student document in Firebase
                                const querySnapshot = await window.firebaseDb.collection(firebaseDB.studentsCollection)
                                    .where('studentId', '==', operation.data.studentId)
                                    .limit(1)
                                    .get();

                                if (!querySnapshot.empty) {
                                    // Update directly in Firebase (don't call updateStudent again to avoid re-queuing)
                                    const updateData = {
                                        studentName: operation.data.studentName || '',
                                        section: operation.data.section || '',
                                        updatedAt: new Date()
                                    };
                                    await querySnapshot.docs[0].ref.update(updateData);
                                    console.log(`Updated student in Firebase: ${operation.data.studentId}`);
                                } else {
                                    console.warn(`Student not found in Firebase for update: ${operation.data.studentId}`);
                                }
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing updateStudent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'deleteStudent':
                            // Delete from Firebase - query directly to find the document
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for deleteStudent');
                                    break;
                                }

                                // Query Firebase directly to find the student by studentId
                                const querySnapshot = await window.firebaseDb.collection(firebaseDB.studentsCollection)
                                    .where('studentId', '==', operation.data.studentId)
                                    .limit(1)
                                    .get();

                                if (!querySnapshot.empty) {
                                    // Delete the found document
                                    await querySnapshot.docs[0].ref.delete();
                                    console.log(`Deleted student from Firebase: ${operation.data.studentId}`);
                                } else {
                                    console.warn(`Student not found in Firebase: ${operation.data.studentId}`);
                                }
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing deleteStudent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'createEvent':
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for createEvent');
                                    break;
                                }
                                await firebaseDB.createEvent(operation.data);
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing createEvent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'setCurrentEvent':
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for setCurrentEvent');
                                    break;
                                }
                                await firebaseDB.setCurrentEvent(operation.data.eventName);
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing setCurrentEvent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'deleteEvent':
                            // Delete event and its attendance records
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for deleteEvent');
                                    break;
                                }

                                if (operation.data.eventName) {
                                    // Delete attendance records by event name first - query Firebase directly
                                    const querySnapshot = await window.firebaseDb.collection(firebaseDB.attendanceCollection)
                                        .where('event', '==', operation.data.eventName)
                                        .get();

                                    // Delete all found records
                                    const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
                                    await Promise.all(deletePromises);

                                    console.log(`Deleted ${querySnapshot.docs.length} attendance records for event: ${operation.data.eventName}`);

                                    // Then delete the event itself if we have eventId
                                    if (operation.data.eventId && operation.data.eventId !== 'undefined' && operation.data.eventId !== 'null' && operation.data.eventId !== '') {
                                        try {
                                            await window.firebaseDb.collection(firebaseDB.eventsCollection).doc(operation.data.eventId).delete();
                                            console.log(`Deleted event document: ${operation.data.eventId}`);
                                        } catch (error) {
                                            console.warn('Event document may not exist in Firebase:', error);
                                            // Continue - attendance records are already deleted
                                        }
                                    }
                                } else if (operation.data.eventId && operation.data.eventId !== 'undefined' && operation.data.eventId !== 'null' && operation.data.eventId !== '') {
                                    // Try to delete by eventId (will try to get eventName first)
                                    await firebaseDB.deleteEvent(operation.data.eventId);
                                }
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing deleteEvent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        case 'deleteAttendanceRecordsByEvent':
                            try {
                                if (!window.firebaseDb) {
                                    console.warn('Firebase not initialized, skipping sync for deleteAttendanceRecordsByEvent');
                                    break;
                                }

                                // Query Firebase directly to find all records with this event name
                                const querySnapshot = await window.firebaseDb.collection(firebaseDB.attendanceCollection)
                                    .where('event', '==', operation.data.eventName)
                                    .get();

                                // Delete all found records
                                const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
                                await Promise.all(deletePromises);

                                console.log(`Deleted ${querySnapshot.docs.length} attendance records for event: ${operation.data.eventName}`);
                                operation.synced = true;
                                syncedCount++;
                            } catch (error) {
                                console.error('Error syncing deleteAttendanceRecordsByEvent:', error);
                                // Don't mark as synced if it failed - will retry later
                            }
                            break;

                        default:
                            console.warn('Unknown operation type:', operation.type);
                    }
                })(), this.TIMEOUT_MS, operation.type);
            } catch (error) {
                console.error('Error syncing operation:', operation, error);
                failedCount++;
                // Don't mark as synced if it failed
            }
        }

        // Remove synced operations from queue
        const remainingQueue = queue.filter(op => !op.synced);
        localStorage.setItem(this.pendingSyncKey, JSON.stringify(remainingQueue));

        console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed, ${remainingQueue.length} remaining`);

        if (syncedCount > 0) {
            this.showSyncStatus(`Synced ${syncedCount} item(s) successfully`, 'success');
        }

        this.syncInProgress = false;

        // Trigger UI update if needed
        if (syncedCount > 0 && typeof updateAttendanceTable === 'function') {
            setTimeout(() => {
                if (typeof updateAttendanceTable === 'function') {
                    updateAttendanceTable();
                }
            }, 500);
        }
    }

    // Show sync status notification
    showSyncStatus(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast('Sync Status', message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Wrapper for Firebase operations with offline support
    async executeWithOfflineSupport(operationType, firebaseOperation, data, collectionName = null) {
        // Use current online status (updated by browser events)
        const isActuallyOnline = this.isOnline;

        // Determine operation action for Local Storage
        let lsOperation = 'add';
        if (operationType.includes('update') || operationType.includes('Update')) {
            lsOperation = 'update';
        } else if (operationType.includes('delete') || operationType.includes('Delete')) {
            lsOperation = 'delete';
        }

        // Always save to Local Storage first
        if (collectionName) {
            this.saveToLocalStorage(collectionName, data, lsOperation);
        }

        if (isActuallyOnline && window.firebaseDB) {
            try {
                // Try Firebase first with timeout
                // 5000ms timeout for online operations
                const result = await this.resultWithTimeout(firebaseOperation(), this.TIMEOUT_MS, operationType);
                console.log(`Successfully executed ${operationType} on Firebase`);

                // Mark as synced in local storage
                if (collectionName) {
                    this.markAsSynced(collectionName, data);
                }

                return result;
            } catch (error) {
                console.error('Firebase operation failed or timed out, saved to Local Storage:', error);
                // Add to pending queue for retry
                this.addToPendingQueue({
                    type: operationType,
                    data: data,
                    collection: collectionName
                });
                // Return Local Storage result
                return collectionName ? this.getFromLocalStorage(collectionName) : null;
            }
        } else {
            // Offline: save to Local Storage and queue for sync
            console.log('Offline: Saving to Local Storage and queueing for sync');
            this.addToPendingQueue({
                type: operationType,
                data: data,
                collection: collectionName
            });
            // Return Local Storage result
            return collectionName ? this.getFromLocalStorage(collectionName) : null;
        }
    }

    // Get pending sync count
    getPendingSyncCount() {
        const queue = this.getPendingSyncQueue();
        return queue.filter(op => !op.synced).length;
    }

    // Clear all pending sync data (use with caution)
    clearPendingSync() {
        localStorage.removeItem(this.pendingSyncKey);
        console.log('Pending sync queue cleared');
    }
}

// Create global instance
window.offlineSync = new OfflineSyncService();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineSyncService;
}
