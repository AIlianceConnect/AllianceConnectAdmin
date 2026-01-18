// Firebase Database Service for MerchandiseTracker
// This service replaces localStorage operations with Firebase Firestore operations
// while keeping Google Sheets integration for the main orders data

class MerchandiseFirebaseService {
    constructor() {
        this.db = window.firebaseDb;
        this.parentCollection = 'MerchandiseTracker';
        this.inProcessCollection = `${this.parentCollection}_inProcess`;
        this.orderHistoryCollection = `${this.parentCollection}_orderHistory`;
        this.deletedOrdersCollection = `${this.parentCollection}_deletedOrders`;
    }

    // ===== IN PROCESS ORDERS OPERATIONS =====
    
    async getInProcessOrders() {
        try {
            const querySnapshot = await this.db.collection(this.inProcessCollection).get();
            const orders = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Store Firestore document ID separately to avoid conflict with data's id field
                orders.push({ firebaseDocId: doc.id, ...data });
            });
            return orders;
        } catch (error) {
            console.error('Error getting in-process orders:', error);
            return [];
        }
    }

    async addToInProcess(orderData) {
        try {
            const docRef = await this.db.collection(this.inProcessCollection).add({
                ...orderData,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding order to in-process:', error);
            throw error;
        }
    }

    async removeFromInProcess(orderId) {
        try {
            await this.db.collection(this.inProcessCollection).doc(orderId).delete();
            return true;
        } catch (error) {
            console.error('Error removing order from in-process:', error);
            throw error;
        }
    }

    async updateInProcessOrder(orderId, orderData) {
        try {
            await this.db.collection(this.inProcessCollection).doc(orderId).update({
                ...orderData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating in-process order:', error);
            throw error;
        }
    }

    // ===== ORDER HISTORY OPERATIONS =====

    async getOrderHistory() {
        try {
            const querySnapshot = await this.db.collection(this.orderHistoryCollection).get();
            const orders = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Store Firestore document ID separately to avoid conflict with data's id field
                orders.push({ firebaseDocId: doc.id, ...data });
            });
            return orders;
        } catch (error) {
            console.error('Error getting order history:', error);
            return [];
        }
    }

    async addToOrderHistory(orderData) {
        try {
            const docRef = await this.db.collection(this.orderHistoryCollection).add({
                ...orderData,
                completedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding order to history:', error);
            throw error;
        }
    }

    async removeFromOrderHistory(orderId) {
        try {
            await this.db.collection(this.orderHistoryCollection).doc(orderId).delete();
            return true;
        } catch (error) {
            console.error('Error removing order from history:', error);
            throw error;
        }
    }

    async updateOrderHistory(orderId, orderData) {
        try {
            await this.db.collection(this.orderHistoryCollection).doc(orderId).update({
                ...orderData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating order history:', error);
            throw error;
        }
    }

    // ===== DELETED ORDERS OPERATIONS =====

    async getDeletedOrders() {
        try {
            const querySnapshot = await this.db.collection(this.deletedOrdersCollection).get();
            const orders = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Store Firestore document ID separately to avoid conflict with data's id field
                orders.push({ firebaseDocId: doc.id, ...data });
            });
            return orders;
        } catch (error) {
            console.error('Error getting deleted orders:', error);
            return [];
        }
    }

    async addToDeletedOrders(orderData) {
        try {
            const docRef = await this.db.collection(this.deletedOrdersCollection).add({
                ...orderData,
                deletedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding order to deleted:', error);
            throw error;
        }
    }

    async removeFromDeletedOrders(orderId) {
        try {
            await this.db.collection(this.deletedOrdersCollection).doc(orderId).delete();
            return true;
        } catch (error) {
            console.error('Error removing order from deleted:', error);
            throw error;
        }
    }

    async restoreFromDeleted(orderId) {
        try {
            // Get the order data first
            const orderDoc = await this.db.collection(this.deletedOrdersCollection).doc(orderId).get();
            if (orderDoc.exists) {
                const orderData = orderDoc.data();
                // Remove from deleted
                await this.removeFromDeletedOrders(orderId);
                // Add back to main orders (this will be handled by the main script)
                return orderData;
            }
            return null;
        } catch (error) {
            console.error('Error restoring order from deleted:', error);
            throw error;
        }
    }

    // ===== BULK OPERATIONS =====

    async migrateFromLocalStorage() {
        try {
            console.log('Starting migration from localStorage to Firebase...');
            
            // Get data from localStorage
            const inProcessOrders = JSON.parse(localStorage.getItem('inProcessOrders')) || [];
            const orderHistory = JSON.parse(localStorage.getItem('orderHistory')) || [];
            const deletedOrders = JSON.parse(localStorage.getItem('deletedOrders')) || [];

            let migratedCount = 0;

            // Migrate in-process orders
            for (const order of inProcessOrders) {
                await this.addToInProcess(order);
                migratedCount++;
            }

            // Migrate order history
            for (const order of orderHistory) {
                await this.addToOrderHistory(order);
                migratedCount++;
            }

            // Migrate deleted orders
            for (const order of deletedOrders) {
                await this.addToDeletedOrders(order);
                migratedCount++;
            }

            console.log(`Migration completed. ${migratedCount} orders migrated to Firebase.`);
            return migratedCount;
        } catch (error) {
            console.error('Error during migration:', error);
            throw error;
        }
    }

    async clearAllData() {
        try {
            // Clear all collections
            await this.clearCollection(this.inProcessCollection);
            await this.clearCollection(this.orderHistoryCollection);
            await this.clearCollection(this.deletedOrdersCollection);
            console.log('All Firebase data cleared.');
        } catch (error) {
            console.error('Error clearing data:', error);
            throw error;
        }
    }

    async clearCollection(collectionName) {
        try {
            const querySnapshot = await this.db.collection(collectionName).get();
            const batch = this.db.batch();
            
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
        } catch (error) {
            console.error(`Error clearing collection ${collectionName}:`, error);
            throw error;
        }
    }

    // ===== UTILITY METHODS =====

    async getOrderById(orderId, collection) {
        try {
            const doc = await this.db.collection(collection).doc(orderId).get();
            if (doc.exists) {
                const data = doc.data();
                // Store Firestore document ID separately to avoid conflict with data's id field
                return { firebaseDocId: doc.id, ...data };
            }
            return null;
        } catch (error) {
            console.error('Error getting order by ID:', error);
            return null;
        }
    }

    async findOrderByKey(key, collection) {
        try {
            const querySnapshot = await this.db.collection(collection)
                .where('studentNumber', '==', key.split('_')[0])
                .where('timestamp', '==', key.split('_')[1])
                .get();
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const data = doc.data();
                // Store Firestore document ID separately to avoid conflict with data's id field
                return { firebaseDocId: doc.id, ...data };
            }
            return null;
        } catch (error) {
            console.error('Error finding order by key:', error);
            return null;
        }
    }

    // ===== REAL-TIME LISTENERS =====

    onInProcessOrdersChange(callback) {
        return this.db.collection(this.inProcessCollection)
            .onSnapshot((querySnapshot) => {
                const orders = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Store Firestore document ID separately to avoid conflict with data's id field
                    orders.push({ firebaseDocId: doc.id, ...data });
                });
                callback(orders);
            });
    }

    onOrderHistoryChange(callback) {
        return this.db.collection(this.orderHistoryCollection)
            .onSnapshot((querySnapshot) => {
                const orders = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Store Firestore document ID separately to avoid conflict with data's id field
                    orders.push({ firebaseDocId: doc.id, ...data });
                });
                callback(orders);
            });
    }

    onDeletedOrdersChange(callback) {
        return this.db.collection(this.deletedOrdersCollection)
            .onSnapshot((querySnapshot) => {
                const orders = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Store Firestore document ID separately to avoid conflict with data's id field
                    orders.push({ firebaseDocId: doc.id, ...data });
                });
                callback(orders);
            });
    }
}

// Initialize the service when Firebase is ready
let merchandiseFirebaseService = null;

function initializeMerchandiseFirebaseService() {
    if (window.firebaseDb && !merchandiseFirebaseService) {
        merchandiseFirebaseService = new MerchandiseFirebaseService();
        window.merchandiseFirebaseService = merchandiseFirebaseService;
        console.log('MerchandiseFirebaseService initialized');
    }
}

// Wait for Firebase to be ready
const checkFirebaseReady = setInterval(() => {
    if (window.firebaseDb) {
        clearInterval(checkFirebaseReady);
        initializeMerchandiseFirebaseService();
    }
}, 100);

// Stop checking after 15 seconds
setTimeout(() => {
    clearInterval(checkFirebaseReady);
    if (!merchandiseFirebaseService) {
        console.error('MerchandiseFirebaseService failed to initialize');
    }
}, 15000);

