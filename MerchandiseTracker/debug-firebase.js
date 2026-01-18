// Debug helper for Firebase integration
// Add this script to help debug the Firebase data issue

window.debugFirebase = {
    // Check current state of all arrays
    checkArrays: function() {
        console.log('=== Current Array States ===');
        console.log('orders:', orders.length, orders);
        console.log('inProcessOrders:', inProcessOrders.length, inProcessOrders);
        console.log('orderHistory:', orderHistory.length, orderHistory);
        console.log('deletedOrders:', deletedOrders.length, deletedOrders);
    },
    
    // Check Firebase data directly
    checkFirebase: async function() {
        if (!window.merchandiseFirebaseService) {
            console.log('Firebase service not available');
            return;
        }
        
        console.log('=== Firebase Data ===');
        try {
            const inProcess = await window.merchandiseFirebaseService.getInProcessOrders();
            const history = await window.merchandiseFirebaseService.getOrderHistory();
            const deleted = await window.merchandiseFirebaseService.getDeletedOrders();
            
            console.log('Firebase inProcess:', inProcess.length, inProcess);
            console.log('Firebase history:', history.length, history);
            console.log('Firebase deleted:', deleted.length, deleted);
        } catch (error) {
            console.error('Error checking Firebase:', error);
        }
    },
    
    // Force reload from Firebase
    reloadFromFirebase: async function() {
        if (!window.merchandiseFirebaseService) {
            console.log('Firebase service not available');
            return;
        }
        
        console.log('Reloading from Firebase...');
        try {
            inProcessOrders = await window.merchandiseFirebaseService.getInProcessOrders();
            orderHistory = await window.merchandiseFirebaseService.getOrderHistory();
            deletedOrders = await window.merchandiseFirebaseService.getDeletedOrders();
            
            console.log('Reloaded:', {
                inProcess: inProcessOrders.length,
                history: orderHistory.length,
                deleted: deletedOrders.length
            });
            
            updateOrdersList();
            updateInProcessSummary();
        } catch (error) {
            console.error('Error reloading from Firebase:', error);
        }
    },
    
    // Clear all Firebase data
    clearFirebase: async function() {
        if (!window.merchandiseFirebaseService) {
            console.log('Firebase service not available');
            return;
        }
        
        if (!confirm('This will clear all Firebase data. Continue?')) {
            return;
        }
        
        try {
            await window.merchandiseFirebaseService.clearAllData();
            console.log('Firebase data cleared');
            
            // Reload arrays
            inProcessOrders = [];
            orderHistory = [];
            deletedOrders = [];
            
            updateOrdersList();
            updateInProcessSummary();
        } catch (error) {
            console.error('Error clearing Firebase:', error);
        }
    },
    
    // Check UI elements
    checkUI: function() {
        console.log('=== UI Elements ===');
        console.log('ordersList:', document.getElementById('ordersList'));
        console.log('inProcessList:', document.getElementById('inProcessList'));
        console.log('orderHistoryList:', document.getElementById('orderHistoryList'));
        console.log('deletedOrdersList:', document.getElementById('deletedOrdersList'));
    }
};

console.log('Debug helper loaded. Use window.debugFirebase to debug Firebase issues.');
console.log('Available commands:');
console.log('- debugFirebase.checkArrays() - Check current array states');
console.log('- debugFirebase.checkFirebase() - Check Firebase data directly');
console.log('- debugFirebase.reloadFromFirebase() - Force reload from Firebase');
console.log('- debugFirebase.clearFirebase() - Clear all Firebase data');
console.log('- debugFirebase.checkUI() - Check UI elements');

