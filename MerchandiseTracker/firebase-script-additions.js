// Firebase Script Additions
// Add these functions to script.js or include this file after script.js

// Override the original functions to include Firebase sync

// Store original functions
const _originalMarkAsInProcess = window.markAsInProcess;
const _originalMarkAsComplete = window.markAsComplete;
const _originalRevertToOrders = window.revertToOrders;
const _originalRevertHistoryOrderToInProcess = window.revertHistoryOrderToInProcess;
const _originalDeleteOrderFromOrders = window.deleteOrderFromOrders;
const _originalPerformDeleteFromOrders = window.performDeleteFromOrders;
const _originalRevertDeletedOrder = window.revertDeletedOrder;
const _originalChangePaymentStatus = window.changePaymentStatus;
const _originalMarkOrderAsNotified = window.markOrderAsNotified;

// Override markAsInProcess to sync with Firebase
window.markAsInProcess = async function(studentNumber, timestamp) {
    const order = orders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function
        if (_originalMarkAsInProcess) {
            _originalMarkAsInProcess(studentNumber, timestamp);
        } else {
            // Fallback implementation
            inProcessOrders.push(order);
            orders = orders.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
        }
        
        // Sync with Firebase
        if (window.firebaseSyncHelper) {
            await window.firebaseSyncHelper.syncMoveToInProcess(order);
        }
    }
};

// Override markAsComplete to sync with Firebase
window.markAsComplete = async function(studentNumber, timestamp) {
    // Find the order before it gets moved to history
    const order = inProcessOrders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function to perform the claim (moves to history, sets claim date, etc.)
        if (_originalMarkAsComplete) {
            _originalMarkAsComplete(studentNumber, timestamp);
        } else {
            // Fallback implementation
            const now = new Date();
            order.claimDate = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
            const orderForHistory = {...order};
            orderHistory.push(orderForHistory);
            inProcessOrders = inProcessOrders.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
            showNotification('Order marked as claimed and moved to history', 'success');
        }
        
        // Sync with Firebase - use the order from history since it was just moved there
        if (window.firebaseSyncHelper) {
            // Find the order in history (it was just moved there)
            const historyOrder = orderHistory.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
            if (historyOrder) {
                await window.firebaseSyncHelper.syncMoveToHistory(historyOrder);
            } else {
                // Fallback to using the order object we had before (it should have claimDate set)
                await window.firebaseSyncHelper.syncMoveToHistory(order);
            }
        }
    }
};

// Override revertToOrders to sync with Firebase
window.revertToOrders = async function(studentNumber, timestamp) {
    const order = inProcessOrders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function
        if (_originalRevertToOrders) {
            _originalRevertToOrders(studentNumber, timestamp);
        } else {
            // Fallback implementation
            orders.push(order);
            inProcessOrders = inProcessOrders.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
            showNotification('Order reverted to main list.', 'success');
        }
        
        // Sync with Firebase
        if (window.firebaseSyncHelper) {
            await window.firebaseSyncHelper.syncRevertFromInProcess(order);
        }
    }
};

// Override revertHistoryOrderToInProcess to sync with Firebase
window.revertHistoryOrderToInProcess = async function(studentNumber, timestamp) {
    const order = orderHistory.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function
        if (_originalRevertHistoryOrderToInProcess) {
            _originalRevertHistoryOrderToInProcess(studentNumber, timestamp);
        } else {
            // Fallback implementation
            delete order.claimDate;
            inProcessOrders.push(order);
            orderHistory = orderHistory.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
            showNotification('Order reverted to in-process.', 'success');
        }
        
        // Sync with Firebase
        if (window.firebaseSyncHelper) {
            await window.firebaseSyncHelper.syncRevertFromHistoryToInProcess(order);
        }
    }
};

// Override performDeleteFromOrders to sync with Firebase
window.performDeleteFromOrders = async function(studentNumber, timestamp) {
    const order = orders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function to perform the deletion
        if (_originalPerformDeleteFromOrders) {
            _originalPerformDeleteFromOrders(studentNumber, timestamp);
        } else {
            // Fallback implementation
            deletedOrders.push(order);
            orders = orders.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
            showNotification('Order moved to Deleted.', 'info');
        }
        
        // Sync with Firebase
        if (window.firebaseSyncHelper) {
            await window.firebaseSyncHelper.syncMoveToDeleted(order);
        }
    }
};

// Override revertDeletedOrder to sync with Firebase
window.revertDeletedOrder = async function(studentNumber, timestamp) {
    const order = deletedOrders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    if (order) {
        // Call original function
        if (_originalRevertDeletedOrder) {
            _originalRevertDeletedOrder(studentNumber, timestamp);
        } else {
            // Fallback implementation
            orders.push(order);
            deletedOrders = deletedOrders.filter(o => !(o.studentNumber === studentNumber && o.timestamp === timestamp));
            saveOrders();
            updateOrdersList();
            showNotification('Order restored.', 'success');
        }
        
        // Sync with Firebase
        if (window.firebaseSyncHelper) {
            await window.firebaseSyncHelper.syncRestoreFromDeleted(order);
        }
    }
};

// Override changePaymentStatus to sync with Firebase
const _originalChangePaymentStatusFn = window.changePaymentStatus;
window.changePaymentStatus = async function(studentNumber, timestamp, newStatus) {
    // Call original function
    if (_originalChangePaymentStatusFn) {
        _originalChangePaymentStatusFn(studentNumber, timestamp, newStatus);
    }
    
    // Sync with Firebase
    if (window.firebaseSyncHelper) {
        const inProcessOrder = inProcessOrders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
        const order = orders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
        
        if (inProcessOrder) {
            await window.firebaseSyncHelper.syncUpdateOrder(inProcessOrder, 'inProcess');
        } else if (order) {
            // Main orders are not in Firebase, no sync needed
        }
    }
};

// Override markOrderAsNotified to sync with Firebase
window.markOrderAsNotified = async function(studentNumber, timestamp) {
    // Call original function
    if (_originalMarkOrderAsNotified) {
        _originalMarkOrderAsNotified(studentNumber, timestamp);
    }
    
    // Find the order to get the updated notified status
    const findOrder = arr => arr.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
    const order = findOrder(orders) || findOrder(inProcessOrders) || findOrder(orderHistory) || findOrder(deletedOrders);
    
    // Sync with Firebase if order is in in-process collection
    if (order && window.firebaseSyncHelper) {
        // Check if order is in in-process (most likely scenario for notifications)
        const inProcessOrder = inProcessOrders.find(o => o.studentNumber === studentNumber && o.timestamp === timestamp);
        if (inProcessOrder) {
            await window.firebaseSyncHelper.syncMarkAsNotified(order);
        }
    }
};

console.log('Firebase script additions loaded successfully');

