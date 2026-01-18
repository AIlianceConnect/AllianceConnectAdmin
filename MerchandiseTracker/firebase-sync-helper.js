// Firebase Sync Helper
// This file provides helper functions to sync order movements with Firebase

class FirebaseSyncHelper {
    constructor(firebaseService) {
        this.service = firebaseService;
    }

    // Sync when order is moved to in-process
    async syncMoveToInProcess(order) {
        try {
            await this.service.addToInProcess(order);
            console.log('Order synced to Firebase in-process:', order);
        } catch (error) {
            console.error('Error syncing to in-process:', error);
        }
    }

    // Sync when order is moved to history
    async syncMoveToHistory(order) {
        try {
            // Query Firebase directly to find all documents by studentNumber and timestamp
            const querySnapshot = await this.service.db.collection(this.service.inProcessCollection)
                .where('studentNumber', '==', order.studentNumber)
                .where('timestamp', '==', order.timestamp)
                .get();
            
            // Remove all matching documents from in-process (handle multiple items)
            let removeCount = 0;
            const removePromises = [];
            
            querySnapshot.forEach((doc) => {
                const docRef = this.service.db.collection(this.service.inProcessCollection).doc(doc.id);
                
                // Remove document - handle errors gracefully
                const removePromise = docRef.delete()
                    .then(() => {
                        console.log('Order document removed from Firebase in-process:', doc.id);
                        removeCount++;
                    })
                    .catch((error) => {
                        // Check for various error conditions
                        const errorMessage = error.message || '';
                        const errorCode = error.code || '';
                        
                        // Ignore errors for documents that don't exist (might have been deleted)
                        if (errorCode === 'not-found' || 
                            errorCode === 'NOT_FOUND' ||
                            errorCode === 5 || // gRPC NOT_FOUND
                            errorMessage.includes('not found') ||
                            errorMessage.includes('Document not found')) {
                            console.log(`Document ${doc.id} no longer exists in Firebase (may have been deleted)`);
                        } else {
                            console.error(`Error removing document ${doc.id}:`, error);
                        }
                    });
                
                removePromises.push(removePromise);
            });
            
            await Promise.all(removePromises);
            
            if (removeCount > 0) {
                console.log(`Removed ${removeCount} document(s) from Firebase in-process collection`);
            } else if (!querySnapshot.empty) {
                console.log('No documents were removed (they may have been deleted)');
            }
            
            // Add to history
            await this.service.addToOrderHistory(order);
            console.log('Order synced to Firebase history:', order);
        } catch (error) {
            console.error('Error syncing to history:', error);
        }
    }

    // Sync when order is deleted
    async syncMoveToDeleted(order) {
        try {
            // Try to remove from in-process
            const inProcessOrders = await this.service.getInProcessOrders();
            const matchingInProcessOrders = inProcessOrders.filter(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            for (const inProcessOrder of matchingInProcessOrders) {
                if (inProcessOrder.firebaseDocId) {
                    await this.service.removeFromInProcess(inProcessOrder.firebaseDocId);
                }
            }
            
            // Try to remove from history
            const historyOrders = await this.service.getOrderHistory();
            const matchingHistoryOrders = historyOrders.filter(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            for (const historyOrder of matchingHistoryOrders) {
                if (historyOrder.firebaseDocId) {
                    await this.service.removeFromOrderHistory(historyOrder.firebaseDocId);
                }
            }
            
            // Add to deleted
            await this.service.addToDeletedOrders(order);
            console.log('Order synced to Firebase deleted:', order);
        } catch (error) {
            console.error('Error syncing to deleted:', error);
        }
    }

    // Sync when order is reverted from in-process to main orders
    async syncRevertFromInProcess(order) {
        try {
            // Remove all matching documents from in-process (handle multiple items)
            const inProcessOrders = await this.service.getInProcessOrders();
            const matchingInProcessOrders = inProcessOrders.filter(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            for (const inProcessOrder of matchingInProcessOrders) {
                if (inProcessOrder.firebaseDocId) {
                    await this.service.removeFromInProcess(inProcessOrder.firebaseDocId);
                    console.log('Order document removed from Firebase in-process:', inProcessOrder.firebaseDocId);
                }
            }
            
            if (matchingInProcessOrders.length > 0) {
                console.log(`Removed ${matchingInProcessOrders.length} document(s) from Firebase in-process collection`);
            } else {
                console.log('Order not found in Firebase in-process collection (may have been already removed)');
            }
        } catch (error) {
            console.error('Error reverting from in-process:', error);
        }
    }

    // Sync when order is reverted from history to in-process
    async syncRevertFromHistoryToInProcess(order) {
        try {
            // Query Firebase directly to find all documents by studentNumber and timestamp
            const querySnapshot = await this.service.db.collection(this.service.orderHistoryCollection)
                .where('studentNumber', '==', order.studentNumber)
                .where('timestamp', '==', order.timestamp)
                .get();
            
            // Remove all matching documents from order history (handle multiple items)
            let removeCount = 0;
            const removePromises = [];
            
            querySnapshot.forEach((doc) => {
                const docRef = this.service.db.collection(this.service.orderHistoryCollection).doc(doc.id);
                
                // Remove document - handle errors gracefully
                const removePromise = docRef.delete()
                    .then(() => {
                        console.log('Order document removed from Firebase order history:', doc.id);
                        removeCount++;
                    })
                    .catch((error) => {
                        // Check for various error conditions
                        const errorMessage = error.message || '';
                        const errorCode = error.code || '';
                        
                        // Ignore errors for documents that don't exist (might have been deleted)
                        if (errorCode === 'not-found' || 
                            errorCode === 'NOT_FOUND' ||
                            errorCode === 5 || // gRPC NOT_FOUND
                            errorMessage.includes('not found') ||
                            errorMessage.includes('Document not found')) {
                            console.log(`Document ${doc.id} no longer exists in Firebase (may have been deleted)`);
                        } else {
                            console.error(`Error removing document ${doc.id}:`, error);
                        }
                    });
                
                removePromises.push(removePromise);
            });
            
            await Promise.all(removePromises);
            
            if (removeCount > 0) {
                console.log(`Removed ${removeCount} document(s) from Firebase order history collection`);
            } else if (!querySnapshot.empty) {
                console.log('No documents were removed from order history (they may have been deleted)');
            }
            
            // Add to in-process
            await this.service.addToInProcess(order);
            console.log('Order reverted from history to in-process:', order);
        } catch (error) {
            console.error('Error reverting from history:', error);
        }
    }

    // Sync when order is restored from deleted
    async syncRestoreFromDeleted(order) {
        try {
            // Remove from deleted orders (remove all matching documents)
            const deletedOrders = await this.service.getDeletedOrders();
            const matchingDeletedOrders = deletedOrders.filter(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            for (const deletedOrder of matchingDeletedOrders) {
                if (deletedOrder.firebaseDocId) {
                    await this.service.removeFromDeletedOrders(deletedOrder.firebaseDocId);
                }
            }
            
            // Also remove from in-process if it exists there (remove all matching documents)
            const inProcessOrders = await this.service.getInProcessOrders();
            const matchingInProcessOrders = inProcessOrders.filter(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            for (const inProcessOrder of matchingInProcessOrders) {
                if (inProcessOrder.firebaseDocId) {
                    await this.service.removeFromInProcess(inProcessOrder.firebaseDocId);
                    console.log('Order document removed from Firebase in-process during revert:', inProcessOrder.firebaseDocId);
                }
            }
            
            if (matchingInProcessOrders.length > 0) {
                console.log(`Removed ${matchingInProcessOrders.length} document(s) from Firebase in-process collection`);
            }
            
            console.log('Order restored from Firebase deleted:', order);
        } catch (error) {
            console.error('Error restoring from deleted:', error);
        }
    }

    // Update order in Firebase (for payment status changes, etc.)
    async syncUpdateOrder(order, location) {
        try {
            let orders, updateFn;
            
            if (location === 'inProcess') {
                orders = await this.service.getInProcessOrders();
                updateFn = (id, data) => this.service.updateInProcessOrder(id, data);
            } else if (location === 'history') {
                orders = await this.service.getOrderHistory();
                updateFn = (id, data) => this.service.updateOrderHistory(id, data);
            } else {
                return; // Main orders are not in Firebase
            }
            
            const existingOrder = orders.find(o => 
                o.studentNumber === order.studentNumber && o.timestamp === order.timestamp
            );
            
            if (existingOrder && existingOrder.firebaseDocId) {
                await updateFn(existingOrder.firebaseDocId, order);
                console.log(`Order updated in Firebase ${location}:`, order);
            }
        } catch (error) {
            console.error(`Error updating order in ${location}:`, error);
        }
    }

    // Sync when order is marked as notified
    async syncMarkAsNotified(order) {
        try {
            // Query Firebase directly to find documents by studentNumber and timestamp
            const querySnapshot = await this.service.db.collection(this.service.inProcessCollection)
                .where('studentNumber', '==', order.studentNumber)
                .where('timestamp', '==', order.timestamp)
                .get();
            
            if (querySnapshot.empty) {
                console.log('Order not found in Firebase in-process collection for notification update');
                return;
            }
            
            // Update all matching documents
            let updateCount = 0;
            const updatePromises = [];
            
            querySnapshot.forEach((doc) => {
                const docRef = this.service.db.collection(this.service.inProcessCollection).doc(doc.id);
                
                // Update document - handle errors gracefully
                const updatePromise = docRef.update({
                    notified: true,
                    updatedAt: new Date()
                })
                .then(() => {
                    console.log('Order marked as notified in Firebase in-process:', doc.id);
                    updateCount++;
                })
                .catch((error) => {
                    // Check for various error conditions
                    const errorMessage = error.message || '';
                    const errorCode = error.code || '';
                    
                    // Ignore errors for documents that don't exist (might have been deleted between query and update)
                    if (errorCode === 'not-found' || 
                        errorCode === 'NOT_FOUND' ||
                        errorCode === 5 || // gRPC NOT_FOUND
                        errorMessage.includes('No document to update') ||
                        errorMessage.includes('not found') ||
                        errorMessage.includes('Document not found')) {
                        console.log(`Document ${doc.id} no longer exists in Firebase (may have been deleted)`);
                    } else {
                        console.error(`Error updating document ${doc.id}:`, error);
                    }
                });
                
                updatePromises.push(updatePromise);
            });
            
            await Promise.all(updatePromises);
            
            if (updateCount > 0) {
                console.log(`Updated ${updateCount} document(s) with notified status in Firebase in-process collection`);
            } else {
                console.log('No documents were updated (they may have been deleted)');
            }
        } catch (error) {
            console.error('Error syncing notified status:', error);
        }
    }
}

// Initialize sync helper when Firebase service is ready
let firebaseSyncHelper = null;

function initializeFirebaseSyncHelper() {
    if (window.merchandiseFirebaseService && !firebaseSyncHelper) {
        firebaseSyncHelper = new FirebaseSyncHelper(window.merchandiseFirebaseService);
        window.firebaseSyncHelper = firebaseSyncHelper;
        console.log('Firebase Sync Helper initialized');
    }
}

// Wait for Firebase service to be ready
const checkServiceReady = setInterval(() => {
    if (window.merchandiseFirebaseService) {
        clearInterval(checkServiceReady);
        initializeFirebaseSyncHelper();
    }
}, 100);

setTimeout(() => {
    clearInterval(checkServiceReady);
    if (!firebaseSyncHelper) {
        console.error('Firebase Sync Helper failed to initialize');
    }
}, 15000);

