// Image Storage Service - Supports both Firebase Storage and Base64 (Firestore) storage
class ImageStorageService {
    constructor(storage, useBase64 = false) {
        this.storage = storage;
        this.useBase64 = useBase64; // If true, store as base64 in Firestore instead of Storage
    }

    /**
     * Compress and resize image to reduce file size
     * @param {File} file - The image file to compress
     * @param {number} maxWidth - Maximum width in pixels (default: 800)
     * @param {number} maxHeight - Maximum height in pixels (default: 800)
     * @param {number} quality - JPEG quality 0-1 (default: 0.7)
     * @returns {Promise<Blob>} - Compressed image blob
     */
    async compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert file to base64 string
     * @param {File|Blob} file - The file to convert
     * @returns {Promise<string>} - Base64 data URL
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Upload an image file - either to Firebase Storage or as base64 to Firestore
     * @param {File} file - The image file to upload
     * @returns {Promise<string>} - Returns the download URL (Storage) or base64 data URL (Firestore)
     */
    async uploadImage(file) {
        // If using base64 mode (for file:// protocol), store directly in Firestore
        if (this.useBase64 || window.location.protocol === 'file:') {
            try {
                // Compress image first to reduce size
                const compressedBlob = await this.compressImage(file, 800, 800, 0.7);
                
                // Check size (Firestore document limit is 1MB, we'll use 900KB as safety margin)
                const maxSize = 900 * 1024; // 900KB
                if (compressedBlob.size > maxSize) {
                    // Try more aggressive compression
                    const moreCompressed = await this.compressImage(file, 600, 600, 0.6);
                    if (moreCompressed.size > maxSize) {
                        throw new Error(`Image is too large even after compression (${Math.round(moreCompressed.size / 1024)}KB). Maximum size is 900KB. Please use a smaller image or start a local server to use Firebase Storage.`);
                    }
                    const base64 = await this.fileToBase64(moreCompressed);
                    return base64; // Return base64 data URL
                }
                
                const base64 = await this.fileToBase64(compressedBlob);
                return base64; // Return base64 data URL
            } catch (error) {
                console.error('Error converting image to base64:', error);
                throw error;
            }
        }

        // Otherwise, use Firebase Storage (requires HTTP/HTTPS)
        if (!this.storage) {
            throw new Error('Firebase Storage not initialized');
        }

        try {
            // Create a unique filename
            const timestamp = Date.now();
            const fileName = `announcements/${timestamp}_${file.name}`;
            const storageRef = this.storage.ref(fileName);

            // Upload file
            const snapshot = await storageRef.put(file);

            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image to Firebase Storage:', error);
            // If it's a CORS or network error, fall back to base64
            if (error.message.includes('CORS') || window.location.protocol === 'file:') {
                console.warn('Firebase Storage failed, falling back to base64 storage');
                try {
                    const compressedBlob = await this.compressImage(file, 800, 800, 0.7);
                    const maxSize = 900 * 1024;
                    if (compressedBlob.size > maxSize) {
                        const moreCompressed = await this.compressImage(file, 600, 600, 0.6);
                        if (moreCompressed.size > maxSize) {
                            throw new Error(`Image is too large even after compression. Maximum size is 900KB.`);
                        }
                        return await this.fileToBase64(moreCompressed);
                    }
                    return await this.fileToBase64(compressedBlob);
                } catch (base64Error) {
                    throw new Error(`Failed to upload image: ${base64Error.message}`);
                }
            }
            throw error;
        }
    }

    /**
     * Delete an image from Firebase Storage (base64 images stored in Firestore are deleted automatically with the document)
     * @param {string} imageUrl - The image URL to delete
     * @returns {Promise<void>}
     */
    async deleteImage(imageUrl) {
        // Base64 images are stored in Firestore and deleted automatically with the document
        if (this.isBase64Image(imageUrl)) {
            return Promise.resolve(); // No need to delete - it's in the Firestore document
        }

        if (!this.storage || !imageUrl) {
            return Promise.resolve();
        }

        try {
            // Extract the file path from the URL
            // Firebase Storage URLs have a specific pattern
            const urlParts = imageUrl.split('/o/');
            if (urlParts.length === 2) {
                const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
                const storageRef = this.storage.ref(filePath);
                await storageRef.delete();
            }
        } catch (error) {
            console.error('Error deleting image from Firebase Storage:', error);
            // Don't throw - image might not exist or already deleted
        }
    }

    /**
     * Check if image URL is a base64 data URL
     * @param {string} url - The image URL
     * @returns {boolean}
     */
    isBase64Image(url) {
        return url && url.startsWith('data:image/');
    }

    /**
     * Check if image URL is from Firebase Storage
     * @param {string} url - The image URL
     * @returns {boolean}
     */
    isStoredImage(url) {
        return url && (url.startsWith('https://') && url.includes('firebasestorage'));
    }
}

// Announcements Management using Firebase Firestore (SDK v8 - works with file://)

class AnnouncementManager {
    constructor(db, storage) {
        this.db = db;
        this.collectionName = 'Announcements';
        this.announcements = [];
        // Use base64 storage if running from file:// protocol (no local server needed)
        const useBase64 = window.location.protocol === 'file:';
        this.imageStorage = new ImageStorageService(storage, useBase64);
        this.currentImageFile = null;
        this.editingId = null;
        this.existingImageUrl = null;
        this.imageRemoved = false;
        this.searchQuery = '';
        this.priorityFilter = '';
        this.unsubscribe = null;
        
        if (useBase64) {
            console.log('Using base64 image storage (file:// protocol detected - no local server needed!)');
        }
        
        this.init();
    }

    async init() {
        await this.loadAnnouncements();
        this.setupEventListeners();
        this.setupRealtimeListener();
    }

    async loadAnnouncements() {
        if (!this.db) {
            console.error('Firebase Firestore not initialized');
            this.renderAnnouncements();
            return;
        }

        try {
            const querySnapshot = await this.db.collection(this.collectionName)
                .orderBy('timestamp', 'desc')
                .get();
            
            this.announcements = querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamp to ISO string
                if (data.timestamp && data.timestamp.toDate) {
                    const timestampDate = data.timestamp.toDate();
                    data.timestamp = timestampDate.getTime();
                    data.date = data.date || timestampDate.toISOString();
                }
                return {
                    id: doc.id,
                    ...data
                };
            });

            this.renderAnnouncements();
        } catch (error) {
            console.error('Error loading announcements from Firestore:', error);
            // If timestamp field doesn't exist, try loading without orderBy
            try {
                const querySnapshot = await this.db.collection(this.collectionName).get();
                this.announcements = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    if (data.timestamp && data.timestamp.toDate) {
                        const timestampDate = data.timestamp.toDate();
                        data.timestamp = timestampDate.getTime();
                        data.date = data.date || timestampDate.toISOString();
                    }
                    return {
                        id: doc.id,
                        ...data
                    };
                });
                this.announcements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                this.renderAnnouncements();
            } catch (fallbackError) {
                console.error('Error loading announcements (fallback):', fallbackError);
                this.renderAnnouncements();
            }
        }
    }

    setupRealtimeListener() {
        if (!this.db) return;

        try {
            // Set up real-time listener using Firebase SDK v8 syntax
            this.unsubscribe = this.db.collection(this.collectionName)
                .orderBy('timestamp', 'desc')
                .onSnapshot((querySnapshot) => {
                    this.announcements = querySnapshot.docs.map(doc => {
                        const data = doc.data();
                        // Convert Firestore Timestamp to ISO string
                        if (data.timestamp && data.timestamp.toDate) {
                            const timestampDate = data.timestamp.toDate();
                            data.timestamp = timestampDate.getTime();
                            data.date = data.date || timestampDate.toISOString();
                        }
                        return {
                            id: doc.id,
                            ...data
                        };
                    });
                    this.renderAnnouncements();
                }, (error) => {
                    console.error('Error in real-time listener:', error);
                    // Try without orderBy if timestamp field doesn't exist
                    if (error.code === 'failed-precondition') {
                        this.unsubscribe = this.db.collection(this.collectionName)
                            .onSnapshot((querySnapshot) => {
                                this.announcements = querySnapshot.docs.map(doc => {
                                    const data = doc.data();
                                    if (data.timestamp && data.timestamp.toDate) {
                                        const timestampDate = data.timestamp.toDate();
                                        data.timestamp = timestampDate.getTime();
                                        data.date = data.date || timestampDate.toISOString();
                                    }
                                    return {
                                        id: doc.id,
                                        ...data
                                    };
                                });
                                this.announcements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                                this.renderAnnouncements();
                            });
                    }
                });
        } catch (error) {
            console.error('Error setting up real-time listener:', error);
        }
    }

    async addAnnouncement(title, content, priority, imageFile = null, announcementId = null, eventDate = null, eventTime = null, location = null) {
        let imageUrl = this.existingImageUrl; // Keep existing image if no new one uploaded
        
        // If editing and image was explicitly removed
        if (announcementId && this.imageRemoved && !imageFile) {
            // Delete old image if it existed
            const oldAnnouncement = this.announcements.find(ann => ann.id === announcementId);
            if (oldAnnouncement && oldAnnouncement.imageUrl) {
                await this.imageStorage.deleteImage(oldAnnouncement.imageUrl);
            }
            imageUrl = null;
        }
        
        // Upload new image if provided
        if (imageFile) {
            try {
                imageUrl = await this.imageStorage.uploadImage(imageFile);
                // Delete old image if it was replaced
                if (this.existingImageUrl && this.existingImageUrl !== imageUrl && announcementId) {
                    await this.imageStorage.deleteImage(this.existingImageUrl);
                }
                // Reset removal flag since we have a new image
                this.imageRemoved = false;
            } catch (error) {
                console.error('Error uploading image:', error);
                
                // Show error message
                let errorMessage = 'Error uploading image. ';
                if (error.message.includes('too large')) {
                    errorMessage += error.message;
                    errorMessage += ' Please use a smaller image or start a local server to use Firebase Storage (supports larger files).';
                } else {
                    errorMessage += 'Please try again or use a smaller image.';
                }
                this.showNotification(errorMessage, 'info');
                imageUrl = null;
            }
        }

        if (announcementId) {
            // Update existing announcement in Firestore
            if (!this.db) {
                throw new Error('Firebase Firestore not initialized');
            }

            const updateData = {
                title: title.trim(),
                content: content.trim(),
                priority: priority || 'normal',
                imageUrl: imageUrl,
                eventDate: eventDate || null,
                eventTime: eventTime || null,
                location: location ? location.trim() : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection(this.collectionName).doc(announcementId).update(updateData);
            
            // Find and return updated announcement
            const updatedAnnouncement = this.announcements.find(ann => ann.id === announcementId);
            return updatedAnnouncement ? { ...updatedAnnouncement, ...updateData } : null;
        } else {
            // Create new announcement in Firestore
            if (!this.db) {
                throw new Error('Firebase Firestore not initialized');
            }

            const announcementData = {
                title: title.trim(),
                content: content.trim(),
                priority: priority || 'normal',
                imageUrl: imageUrl,
                eventDate: eventDate || null,
                eventTime: eventTime || null,
                location: location ? location.trim() : null,
                date: new Date().toISOString(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collectionName).add(announcementData);
            return { id: docRef.id, ...announcementData };
        }
    }

    editAnnouncement(id) {
        const announcement = this.announcements.find(ann => ann.id === id);
        if (!announcement) return;

        this.editingId = id;
        this.existingImageUrl = announcement.imageUrl || null;
        this.imageRemoved = false; // Reset removal flag

        // Populate form
        document.getElementById('announcementTitle').value = announcement.title;
        document.getElementById('announcementContent').value = announcement.content;
        document.getElementById('announcementPriority').value = announcement.priority;
        document.getElementById('announcementDate').value = announcement.eventDate || '';
        document.getElementById('announcementTime').value = announcement.eventTime || '';
        document.getElementById('announcementLocation').value = announcement.location || '';
        document.getElementById('editingAnnouncementId').value = id;

        // Update modal title
        document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';

        // Show existing image if present
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const existingImageNote = document.getElementById('existingImageNote');
        
        if (announcement.imageUrl) {
            previewImg.src = announcement.imageUrl;
            imagePreview.style.display = 'block';
            existingImageNote.style.display = 'inline';
        } else {
            imagePreview.style.display = 'none';
            existingImageNote.style.display = 'none';
        }

        // Reset image file
        this.currentImageFile = null;
        const imageInput = document.getElementById('announcementImage');
        if (imageInput) imageInput.value = '';

        // Update submit button text
        const submitBtn = document.getElementById('submit-announcement');
        if (submitBtn) submitBtn.textContent = 'Update Announcement';

        // Open modal
        const modal = document.getElementById('announcementModal');
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    resetForm() {
        this.editingId = null;
        this.existingImageUrl = null;
        this.currentImageFile = null;
        this.imageRemoved = false;

        // Reset form fields
        document.getElementById('announcementTitle').value = '';
        document.getElementById('announcementContent').value = '';
        document.getElementById('announcementPriority').value = 'normal';
        document.getElementById('announcementDate').value = '';
        document.getElementById('announcementTime').value = '';
        document.getElementById('announcementLocation').value = '';
        document.getElementById('editingAnnouncementId').value = '';
        
        // Reset image preview
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const existingImageNote = document.getElementById('existingImageNote');
        const imageInput = document.getElementById('announcementImage');
        
        if (imagePreview) imagePreview.style.display = 'none';
        if (previewImg) previewImg.src = '';
        if (existingImageNote) existingImageNote.style.display = 'none';
        if (imageInput) imageInput.value = '';

        // Reset modal title and button
        document.getElementById('announcementModalTitle').textContent = 'Create New Announcement';
        const submitBtn = document.getElementById('submit-announcement');
        if (submitBtn) submitBtn.textContent = 'Post Announcement';
    }

    async deleteAnnouncement(id) {
        if (confirm('Are you sure you want to delete this announcement?')) {
            if (!this.db) {
                console.error('Firebase Firestore not initialized');
                return;
            }

            const announcement = this.announcements.find(ann => ann.id === id);
            
            try {
                // Delete from Firestore
                await this.db.collection(this.collectionName).doc(id).delete();

                // Delete associated image if exists
                if (announcement && announcement.imageUrl) {
                    try {
                        await this.imageStorage.deleteImage(announcement.imageUrl);
                    } catch (error) {
                        console.error('Error deleting image:', error);
                    }
                }
            } catch (error) {
                console.error('Error deleting announcement:', error);
                this.showNotification('Error deleting announcement. Please try again.', 'info');
            }
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown date';
        
        let date;
        // Handle Firestore Timestamp or regular date string
        if (typeof dateString === 'object' && dateString.toDate) {
            date = dateString.toDate();
        } else if (typeof dateString === 'number') {
            date = new Date(dateString);
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }

        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) {
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    isToday(dateString) {
        if (!dateString) return false;
        
        let date;
        // Handle Firestore Timestamp or regular date string
        if (typeof dateString === 'object' && dateString.toDate) {
            date = dateString.toDate();
        } else if (typeof dateString === 'number') {
            date = new Date(dateString);
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return false;

        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    isUpcoming(eventDate) {
        if (!eventDate) return false;
        const event = new Date(eventDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return event > today;
    }

    isPast(dateString) {
        if (!dateString) return true; // If no date, consider it past
        
        let date;
        // Handle Firestore Timestamp or regular date string
        if (typeof dateString === 'object' && dateString.toDate) {
            date = dateString.toDate();
        } else if (typeof dateString === 'number') {
            date = new Date(dateString);
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return date < today;
    }

    filterAnnouncements(announcements) {
        let filtered = [...announcements];

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(ann => 
                ann.title.toLowerCase().includes(query) ||
                ann.content.toLowerCase().includes(query) ||
                (ann.location && ann.location.toLowerCase().includes(query))
            );
        }

        // Apply priority filter
        if (this.priorityFilter) {
            filtered = filtered.filter(ann => ann.priority === this.priorityFilter);
        }

        return filtered;
    }

    renderAnnouncements() {
        const allContainer = document.getElementById('announcements-all');
        const todayContainer = document.getElementById('announcements-today');
        const upcomingContainer = document.getElementById('announcements-upcoming');
        const pastContainer = document.getElementById('announcements-past');
        
        if (!allContainer || !todayContainer || !upcomingContainer || !pastContainer) return;

        if (this.announcements.length === 0) {
            const emptyMessage = `
                <div class="empty-announcements">
                    <i class="fas fa-bullhorn"></i>
                    <p style="margin: 0; font-size: 16px;">No announcements yet</p>
                    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.7;">Click "New Announcement" to create one</p>
                </div>
            `;
            allContainer.innerHTML = emptyMessage;
            todayContainer.innerHTML = '';
            upcomingContainer.innerHTML = '';
            pastContainer.innerHTML = '';
            document.getElementById('allCount').textContent = '0';
            document.getElementById('todayCount').textContent = '0';
            document.getElementById('upcomingCount').textContent = '0';
            document.getElementById('pastCount').textContent = '0';
            return;
        }

        // Filter announcements
        const filtered = this.filterAnnouncements(this.announcements);

        // Sort announcements: urgent first, then by date (newest first)
        const sortAnnouncements = (arr) => {
            return [...arr].sort((a, b) => {
                const priorityOrder = { urgent: 3, high: 2, normal: 1 };
                if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                // For upcoming events, sort by event date
                if (a.eventDate && b.eventDate) {
                    return new Date(a.eventDate) - new Date(b.eventDate);
                }
                // Handle timestamp (can be number, Firestore Timestamp, or date string)
                const aTime = typeof a.timestamp === 'number' ? a.timestamp : 
                             (a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 
                             (a.date ? new Date(a.date).getTime() : 0));
                const bTime = typeof b.timestamp === 'number' ? b.timestamp : 
                             (b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 
                             (b.date ? new Date(b.date).getTime() : 0));
                return bTime - aTime;
            });
        };

        // Separate into categories
        const all = sortAnnouncements(filtered);
        const today = sortAnnouncements(filtered.filter(ann => this.isToday(ann.date)));
        const upcoming = sortAnnouncements(filtered.filter(ann => ann.eventDate && this.isUpcoming(ann.eventDate)));
        const past = sortAnnouncements(filtered.filter(ann => this.isPast(ann.date) && !(ann.eventDate && this.isUpcoming(ann.eventDate))));

        // Update counts
        document.getElementById('allCount').textContent = all.length;
        document.getElementById('todayCount').textContent = today.length;
        document.getElementById('upcomingCount').textContent = upcoming.length;
        document.getElementById('pastCount').textContent = past.length;

        // Render announcements in respective containers
        this.renderAnnouncementList(all, allContainer, 'all');
        this.renderAnnouncementList(today, todayContainer, 'today');
        this.renderAnnouncementList(upcoming, upcomingContainer, 'upcoming');
        this.renderAnnouncementList(past, pastContainer, 'past');
    }

    renderAnnouncementList(announcements, container, section) {
        // Clear container
        container.innerHTML = '';

        if (announcements.length === 0) {
            let emptyMessage = '';
            switch(section) {
                case 'all':
                    emptyMessage = '<div class="empty-announcements"><i class="fas fa-list"></i><p style="margin: 8px 0 0; font-size: 14px; opacity: 0.7;">No announcements found</p></div>';
                    break;
                case 'today':
                    emptyMessage = '<div class="empty-announcements"><i class="fas fa-calendar-day"></i><p style="margin: 8px 0 0; font-size: 14px; opacity: 0.7;">No announcements for today</p></div>';
                    break;
                case 'upcoming':
                    emptyMessage = '<div class="empty-announcements"><i class="fas fa-calendar-alt"></i><p style="margin: 8px 0 0; font-size: 14px; opacity: 0.7;">No upcoming events</p></div>';
                    break;
                case 'past':
                    emptyMessage = '<div class="empty-announcements"><i class="fas fa-history"></i><p style="margin: 8px 0 0; font-size: 14px; opacity: 0.7;">No past announcements</p></div>';
                    break;
            }
            container.innerHTML = emptyMessage;
            return;
        }
        
        // Create and append announcement cards
        announcements.forEach(announcement => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'announcement-card';
            
            const imageHtml = announcement.imageUrl 
                ? `
                    <div class="announcement-image-wrapper">
                        <img src="${this.escapeHtml(announcement.imageUrl)}" alt="${this.escapeHtml(announcement.title)}" class="announcement-image">
                        <div class="image-overlay">
                            <i class="fas fa-expand"></i> Click to view full image
                        </div>
                    </div>
                `
                : '';
            
            // Build event details HTML
            const eventDetails = [];
            if (announcement.eventDate) {
                const formattedDate = this.formatEventDate(announcement.eventDate);
                eventDetails.push(`<div class="announcement-detail-item"><i class="fas fa-calendar-alt"></i><span><strong>Date:</strong> ${this.escapeHtml(formattedDate)}</span></div>`);
            }
            if (announcement.eventTime) {
                const formattedTime = this.formatEventTime(announcement.eventTime);
                eventDetails.push(`<div class="announcement-detail-item"><i class="fas fa-clock"></i><span><strong>Time:</strong> ${this.escapeHtml(formattedTime)}</span></div>`);
            }
            if (announcement.location) {
                eventDetails.push(`<div class="announcement-detail-item"><i class="fas fa-map-marker-alt"></i><span><strong>Location:</strong> ${this.escapeHtml(announcement.location)}</span></div>`);
            }
            const eventDetailsHtml = eventDetails.length > 0 
                ? `<div class="announcement-details">${eventDetails.join('')}</div>` 
                : '';

            cardDiv.innerHTML = `
                <div class="announcement-header">
                    <h3 class="announcement-title">${this.escapeHtml(announcement.title)}</h3>
                    <span class="announcement-priority ${announcement.priority}">${announcement.priority}</span>
                </div>
                <div class="announcement-body">
                    ${imageHtml}
                    <div class="announcement-content-wrapper">
                        <div class="announcement-content">${this.escapeHtml(announcement.content)}</div>
                        ${eventDetailsHtml}
                    </div>
                </div>
                <div class="announcement-footer">
                    <div class="announcement-date">
                        <i class="fas fa-clock"></i>
                        <span>${this.formatDate(announcement.date)}</span>
                    </div>
                    <div class="announcement-actions">
                        <button class="btn-edit" data-announcement-id="${announcement.id}" title="Edit announcement">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" data-announcement-id="${announcement.id}" title="Delete announcement">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            const editBtn = cardDiv.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editAnnouncement(announcement.id));
            }

            const deleteBtn = cardDiv.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteAnnouncement(announcement.id));
            }
            
            const imageWrapper = cardDiv.querySelector('.announcement-image-wrapper');
            if (imageWrapper && announcement.imageUrl) {
                imageWrapper.addEventListener('click', () => this.viewImage(announcement.imageUrl));
            }
            
            container.appendChild(cardDiv);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatEventDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });
    }

    formatEventTime(timeString) {
        if (!timeString) return '';
        // Convert 24-hour time to 12-hour format
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    setupEventListeners() {
        const submitBtn = document.getElementById('submit-announcement');
        const modal = document.getElementById('announcementModal');
        const form = document.getElementById('announcement-form');
        const imageInput = document.getElementById('announcementImage');
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const removeImageBtn = document.getElementById('removeImage');

        // Show/hide file protocol info message and update size info
        const fileProtocolWarning = document.getElementById('fileProtocolWarning');
        const imageSizeInfo = document.getElementById('imageSizeInfo');
        
        if (fileProtocolWarning) {
            // Check on page load - show info when using file:// protocol
            if (window.location.protocol === 'file:') {
                fileProtocolWarning.style.display = 'block';
                if (imageSizeInfo) {
                    imageSizeInfo.textContent = 'Supported formats: JPG, PNG, GIF. Images will be compressed to max 900KB for Firestore storage.';
                }
            } else {
                fileProtocolWarning.style.display = 'none';
                if (imageSizeInfo) {
                    imageSizeInfo.textContent = 'Supported formats: JPG, PNG, GIF. Max size: 5MB (stored in Firebase Storage)';
                }
            }
            
            // Also check when modal is shown
            if (modal) {
                modal.addEventListener('shown.bs.modal', () => {
                    if (window.location.protocol === 'file:') {
                        fileProtocolWarning.style.display = 'block';
                        if (imageSizeInfo) {
                            imageSizeInfo.textContent = 'Supported formats: JPG, PNG, GIF. Images will be compressed to max 900KB for Firestore storage.';
                        }
                    } else {
                        fileProtocolWarning.style.display = 'none';
                        if (imageSizeInfo) {
                            imageSizeInfo.textContent = 'Supported formats: JPG, PNG, GIF. Max size: 5MB (stored in Firebase Storage)';
                        }
                    }
                });
            }
        }

        // Handle image file selection
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Note: Images will be stored as base64 in Firestore when using file:// protocol
                    // No warning needed - it will work automatically

                    // Validate file size (5MB max)
                    if (file.size > 5 * 1024 * 1024) {
                        this.showNotification('Image size must be less than 5MB', 'info');
                        imageInput.value = '';
                        return;
                    }

                    // Validate file type
                    if (!file.type.startsWith('image/')) {
                        this.showNotification('Please select a valid image file', 'info');
                        imageInput.value = '';
                        return;
                    }

                    this.currentImageFile = file;
                    
                    // Show preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewImg.src = e.target.result;
                        imagePreview.style.display = 'block';
                        
                        // If editing and there was an existing image, show note that it will be replaced
                        const existingImageNote = document.getElementById('existingImageNote');
                        const editingId = document.getElementById('editingAnnouncementId').value;
                        if (editingId && this.existingImageUrl && existingImageNote) {
                            existingImageNote.style.display = 'inline';
                        } else if (existingImageNote) {
                            existingImageNote.style.display = 'none';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Handle image removal
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                this.currentImageFile = null;
                this.imageRemoved = true; // Mark that image was removed
                if (imageInput) imageInput.value = '';
                if (imagePreview) imagePreview.style.display = 'none';
                if (previewImg) previewImg.src = '';
                const existingImageNote = document.getElementById('existingImageNote');
                if (existingImageNote) existingImageNote.style.display = 'none';
            });
        }

        if (submitBtn) {
            // Ensure button is enabled and clickable
            submitBtn.disabled = false;
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.style.cursor = 'pointer';

            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Submit button clicked'); // Debug log

                const title = document.getElementById('announcementTitle')?.value;
                const content = document.getElementById('announcementContent')?.value;
                const priority = document.getElementById('announcementPriority')?.value;
                const eventDate = document.getElementById('announcementDate')?.value;
                const eventTime = document.getElementById('announcementTime')?.value;
                const location = document.getElementById('announcementLocation')?.value;

                // Validation
                if (!title || !title.trim()) {
                    this.showNotification('Please enter a title', 'info');
                    return;
                }

                if (!content || !content.trim()) {
                    this.showNotification('Please enter content', 'info');
                    return;
                }

                // Check if Firebase is initialized
                if (!this.db) {
                    this.showNotification('Database not ready. Please wait a moment and try again.', 'info');
                    console.error('Firebase Firestore not initialized');
                    return;
                }

                // Disable button during upload
                submitBtn.disabled = true;
                const originalButtonText = submitBtn.textContent;
                submitBtn.textContent = this.editingId ? 'Updating...' : 'Posting...';

                try {
                    const editingId = document.getElementById('editingAnnouncementId')?.value;
                    await this.addAnnouncement(
                        title, 
                        content, 
                        priority, 
                        this.currentImageFile, 
                        editingId || null,
                        eventDate || null,
                        eventTime || null,
                        location || null
                    );
                    
                    // Reset form
                    this.resetForm();
                    if (form) form.reset();
                    
                    // Close modal
                    if (modal) {
                        const bsModal = bootstrap.Modal.getInstance(modal);
                        if (bsModal) {
                            bsModal.hide();
                        }
                    }

                    // Show success notification
                    const message = editingId ? 'Announcement updated successfully!' : 'Announcement posted successfully!';
                    this.showNotification(message, 'success');
                } catch (error) {
                    console.error('Error saving announcement:', error);
                    let errorMessage = 'Error saving announcement. Please try again.';
                    if (error.message) {
                        errorMessage += ' ' + error.message;
                    }
                    this.showNotification(errorMessage, 'info');
                } finally {
                    // Re-enable button
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalButtonText;
                }
            });
        } else {
            console.error('Submit button not found');
        }

        // Clear form when modal is closed
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                this.resetForm();
                form.reset();
            });
        }

        // Reset form when "New Announcement" button is clicked
        const newAnnouncementBtn = document.querySelector('[data-bs-target="#announcementModal"]');
        if (newAnnouncementBtn) {
            newAnnouncementBtn.addEventListener('click', () => {
                this.resetForm();
            });
        }

        // Setup search and filter event listeners
        this.setupFilters();
    }

    setupFilters() {
        const searchInput = document.getElementById('searchInput');
        const priorityFilter = document.getElementById('priorityFilter');
        const clearFiltersBtn = document.getElementById('clearFilters');

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderAnnouncements();
            });
        }

        // Priority filter
        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                this.priorityFilter = e.target.value;
                this.renderAnnouncements();
            });
        }

        // Clear filters
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.priorityFilter = '';
                if (searchInput) searchInput.value = '';
                if (priorityFilter) priorityFilter.value = '';
                this.renderAnnouncements();
            });
        }
    }

    viewImage(imageUrl) {
        // Create a modal to view full-size image
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Full size';
        img.style.cssText = 'max-width: 100%; max-height: 80vh; object-fit: contain;';
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content bg-dark">
                    <div class="modal-header border-0">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0 text-center">
                    </div>
                </div>
            </div>
        `;
        
        const modalBody = modal.querySelector('.modal-body');
        modalBody.appendChild(img);
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Create a simple notification element
        const alertType = type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'info');
        const notification = document.createElement('div');
        notification.className = `alert alert-${alertType} alert-dismissible fade show`;
        notification.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px; max-width: 500px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after specified duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 150);
            }
        }, duration);
    }
}

// Initialize announcement manager when DOM is ready
let announcementManager;

// Wait for Firebase to initialize (Firebase SDK v8 works with file:// protocol)
function initializeApp() {
    const checkFirebase = setInterval(() => {
        if (window.firebaseDb && window.firebaseStorage) {
            clearInterval(checkFirebase);
            announcementManager = new AnnouncementManager(window.firebaseDb, window.firebaseStorage);
        }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkFirebase);
        if (!window.firebaseDb) {
            console.error('Firebase initialization timeout');
            // Fallback: show error message to user
            const containers = ['announcements-all', 'announcements-today', 'announcements-upcoming', 'announcements-past'];
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i> 
                            Error connecting to Firebase. Please check your internet connection and refresh the page.
                        </div>
                    `;
                }
            });
        }
    }, 10000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

