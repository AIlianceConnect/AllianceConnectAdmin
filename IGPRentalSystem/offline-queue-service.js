// Offline Queue Service
// Handles queuing of Firebase operations when offline or experiencing slow connections
// Implements 5-second timeout for all Firebase operations

class OfflineQueueService {
    constructor() {
        this.queueKey = 'firebaseOfflineQueue';
        this.lastSyncKey = 'lastFirebaseSync';
        this.isProcessing = false;
        this.retryInterval = 10000; // 10 seconds between retry attempts
        this.timeout = 5000; // 5 second timeout for initial Firebase operations
        this.queueTimeout = 15000; // 15 second timeout for queue retries (slow WiFi needs more time)

        // Start automatic queue processing
        this.startAutoProcessing();

        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('Connection restored, processing queue...');
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost, operations will be queued');
        });
    }

    /**
     * Check if browser is online
     */
    isOnline() {
        return navigator.onLine;
    }

    /**
     * Get the current queue from localStorage
     */
    getQueue() {
        try {
            const queue = localStorage.getItem(this.queueKey);
            return queue ? JSON.parse(queue) : [];
        } catch (error) {
            console.error('Error reading queue:', error);
            return [];
        }
    }

    /**
     * Save queue to localStorage
     */
    saveQueue(queue) {
        try {
            localStorage.setItem(this.queueKey, JSON.stringify(queue));
        } catch (error) {
            console.error('Error saving queue:', error);
        }
    }

    /**
     * Get count of pending operations
     */
    getPendingCount() {
        return this.getQueue().length;
    }

    /**
     * Get last successful sync timestamp
     */
    getLastSync() {
        const timestamp = localStorage.getItem(this.lastSyncKey);
        return timestamp ? new Date(parseInt(timestamp)) : null;
    }

    /**
     * Update last sync timestamp
     */
    updateLastSync() {
        localStorage.setItem(this.lastSyncKey, Date.now().toString());
    }

    /**
     * Wrap a Firebase promise with a timeout
     * @param {Promise} promise - The Firebase promise to wrap
     * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
     * @returns {Promise} - Resolves if successful, rejects if timeout or error
     */
    withTimeout(promise, timeoutMs = this.timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Firebase operation timed out after ' + timeoutMs + 'ms'));
                }, timeoutMs);
            })
        ]);
    }

    /**
     * Add an operation to the queue
     * @param {string} operation - Operation type (e.g., 'addStudent', 'updateInventory')
     * @param {object} data - Data for the operation
     * @param {string} collection - Firebase collection name
     */
    queueOperation(operation, data, collection) {
        const queue = this.getQueue();
        const queueItem = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            operation,
            data,
            collection,
            timestamp: Date.now(),
            retryCount: 0
        };

        queue.push(queueItem);
        this.saveQueue(queue);

        console.log(`Queued operation: ${operation} for ${collection}`, queueItem);

        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('offlineQueueUpdated', {
            detail: { pendingCount: queue.length }
        }));

        return queueItem.id;
    }

    /**
     * Remove an operation from the queue
     */
    removeFromQueue(itemId) {
        const queue = this.getQueue();
        const filtered = queue.filter(item => item.id !== itemId);
        this.saveQueue(filtered);

        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('offlineQueueUpdated', {
            detail: { pendingCount: filtered.length }
        }));
    }

    /**
     * Start automatic queue processing
     */
    startAutoProcessing() {
        // Process queue every 10 seconds if online
        setInterval(() => {
            if (this.isOnline() && this.getPendingCount() > 0 && !this.isProcessing) {
                this.processQueue();
            }
        }, this.retryInterval);

        // Also try to process on page load
        if (this.isOnline() && this.getPendingCount() > 0) {
            setTimeout(() => this.processQueue(), 2000);
        }
    }

    /**
     * Process all queued operations
     * @returns {Promise<{success: number, failed: number}>}
     */
    async processQueue() {
        if (this.isProcessing) {
            console.log('Queue processing already in progress');
            return { success: 0, failed: 0 };
        }

        if (!this.isOnline()) {
            console.log('Cannot process queue while offline');
            return { success: 0, failed: 0 };
        }

        this.isProcessing = true;
        const queue = this.getQueue();

        if (queue.length === 0) {
            this.isProcessing = false;
            return { success: 0, failed: 0 };
        }

        console.log(`Processing ${queue.length} queued operations...`);

        let successCount = 0;
        let failedCount = 0;
        const remainingQueue = [];

        for (const item of queue) {
            try {
                // Get Firebase service instance
                if (!window.rentalFirebaseService || !window.firebaseDb) {
                    console.warn('Firebase not available, keeping item in queue:', item.id);
                    remainingQueue.push(item);
                    continue;
                }

                // Execute the queued operation based on type
                const result = await this.executeQueuedOperation(item);

                if (result.success) {
                    successCount++;
                    console.log(`Successfully processed queued operation: ${item.operation}`, item.id);
                } else {
                    // Increment retry count
                    item.retryCount = (item.retryCount || 0) + 1;

                    // Determine if this is a network/timeout error or an actual Firebase error
                    const isNetworkError = result.error && (
                        result.error.includes('timeout') ||
                        result.error.includes('timed out') ||
                        result.error.includes('network') ||
                        result.error.includes('offline') ||
                        result.error.includes('unavailable') ||
                        result.error.includes('UNAVAILABLE')
                    );

                    if (isNetworkError) {
                        // Network/timeout errors: NEVER permanently remove, keep retrying
                        remainingQueue.push(item);
                        console.warn(`Network/timeout issue, will keep retrying indefinitely (attempt ${item.retryCount}):`, item.id, result.error);
                    } else if (item.retryCount < 5) {
                        // Actual Firebase errors: retry up to 5 times
                        remainingQueue.push(item);
                        console.warn(`Operation failed, will retry (${item.retryCount}/5):`, item.id, result.error);
                    } else {
                        // Actual error after 5 retries: remove from queue
                        failedCount++;
                        console.error(`Operation failed after 5 retries (actual error, not network), removing from queue:`, item.id, result.error);
                    }
                }
            } catch (error) {
                console.error(`Error processing queued operation:`, item.id, error);

                // Increment retry count
                item.retryCount = (item.retryCount || 0) + 1;

                // Check if it's a network-related error
                const errorMessage = error.message || error.toString();
                const isNetworkError = errorMessage && (
                    errorMessage.includes('timeout') ||
                    errorMessage.includes('timed out') ||
                    errorMessage.includes('network') ||
                    errorMessage.includes('offline') ||
                    errorMessage.includes('unavailable')
                );

                if (isNetworkError) {
                    // Network errors: keep retrying forever
                    remainingQueue.push(item);
                    console.warn(`Network error in queue processing, will keep retrying (attempt ${item.retryCount}):`, item.id);
                } else if (item.retryCount < 5) {
                    // Other errors: retry up to 5 times
                    remainingQueue.push(item);
                } else {
                    failedCount++;
                    console.error(`Non-network error after 5 retries, removing from queue:`, item.id);
                }
            }
        }

        // Update queue with remaining items
        this.saveQueue(remainingQueue);

        if (successCount > 0) {
            this.updateLastSync();
        }

        console.log(`Queue processing complete: ${successCount} succeeded, ${failedCount} failed permanently, ${remainingQueue.length} remaining`);

        this.isProcessing = false;

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('offlineQueueProcessed', {
            detail: { success: successCount, failed: failedCount, remaining: remainingQueue.length }
        }));

        return { success: successCount, failed: failedCount };
    }

    /**
     * Execute a single queued operation
     * @param {object} item - Queue item
     * @returns {Promise<{success: boolean, error: string}>} - Result with success flag and error message
     */
    async executeQueuedOperation(item) {
        const { operation, data, collection } = item;
        const service = window.rentalFirebaseService;

        try {
            // Use LONGER timeout for queue retries (slow WiFi needs more time)
            const timeoutMs = this.queueTimeout; // 15 seconds for retries

            // Map operation to service method
            switch (operation) {
                // Student operations
                case 'addStudent':
                    await this.withTimeout(service.addStudent(data), timeoutMs);
                    return { success: true };
                case 'updateStudent':
                    await this.withTimeout(service.updateStudent(data.id || data.studentId, data), timeoutMs);
                    return { success: true };
                case 'deleteStudent':
                    await this.withTimeout(service.deleteStudent(data.id || data.studentId), timeoutMs);
                    return { success: true };

                // Officer operations
                case 'addOfficer':
                    await this.withTimeout(service.addOfficer(data), timeoutMs);
                    return { success: true };
                case 'updateOfficer':
                    await this.withTimeout(service.updateOfficer(data.id || data.officerId, data), timeoutMs);
                    return { success: true };
                case 'deleteOfficer':
                    await this.withTimeout(service.deleteOfficer(data.id || data.officerId), timeoutMs);
                    return { success: true };

                // Inventory operations
                case 'addInventoryItem':
                    await this.withTimeout(service.addInventoryItem(data), timeoutMs);
                    return { success: true };
                case 'updateInventoryItem':
                    await this.withTimeout(service.updateInventoryItem(data.id, data), timeoutMs);
                    return { success: true };
                case 'deleteInventoryItem':
                    await this.withTimeout(service.deleteInventoryItem(data.id), timeoutMs);
                    return { success: true };

                // Rental record operations
                case 'addRentalRecord':
                    await this.withTimeout(service.addRentalRecord(data), timeoutMs);
                    return { success: true };
                case 'updateRentalRecord':
                    await this.withTimeout(service.updateRentalRecord(data.id, data), timeoutMs);
                    return { success: true };
                case 'deleteRentalRecord':
                    await this.withTimeout(service.deleteRentalRecord(data.id), timeoutMs);
                    return { success: true };

                default:
                    console.error('Unknown operation type:', operation);
                    return { success: false, error: 'Unknown operation type' };
            }
        } catch (error) {
            const errorMessage = error.message || error.toString();
            console.error(`Failed to execute ${operation}:`, errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Clear all queued operations (use with caution)
     */
    clearQueue() {
        this.saveQueue([]);
        console.log('Queue cleared');
        window.dispatchEvent(new CustomEvent('offlineQueueUpdated', {
            detail: { pendingCount: 0 }
        }));
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.offlineQueueService = new OfflineQueueService();
}
