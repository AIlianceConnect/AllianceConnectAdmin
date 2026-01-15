# Firebase Integration Guide for Accounts System

This guide explains how to integrate the Accounts system with Firebase, similar to the QR-Attendance system.

## Overview

The Accounts system now supports Firebase Firestore for data storage with real-time synchronization. The system automatically falls back to localStorage if Firebase is not available.

## Firebase Collections

The system uses the following Firestore collections:

### 1. Student Numbers Database
- **Collection**: `AccountsSystem_studentNumbers`
- **Purpose**: Stores valid student numbers for account validation
- **Fields**:
  - `studentId` (string): Student number
  - `studentName` (string): Student's full name
  - `section` (string): Academic section (optional)
  - `course` (string): Course name (optional)
  - `yearSection` (string): Year-section (optional)
  - `email` (string): Email address (optional)
  - `phone` (string): Phone number (optional)
  - `addedAt` (timestamp): When record was created
  - `addedBy` (string): Who added the record
  - `updatedAt` (timestamp): Last update time
  - `updatedBy` (string): Who last updated

### 2. Pending Requests
- **Collection**: `AccountsSystem_pendingRequests`
- **Purpose**: Stores account requests from Android app
- **Fields**:
  - `studentId` (string): Student number
  - `name` (string): Student's name from request
  - `email` (string): Email from request
  - `password` (string): Password from request
  - `status` (string): pending/approved/rejected
  - `requestTime` (timestamp): When request was made
  - `approvedAt` (timestamp): When approved (if applicable)
  - `rejectedAt` (timestamp): When rejected (if applicable)
  - `approvedBy` (string): Who approved
  - `rejectedBy` (string): Who rejected

### 3. Student Accounts
- **Collection**: `AccountsSystem_studentAccounts`
- **Purpose**: Stores approved student accounts
- **Fields**:
  - `studentId` (string): Student number
  - `studentName` (string): Student's name
  - `section` (string): Academic section
  - `email` (string): Email address
  - `password` (string): Password (should be hashed in production)
  - `createdAt` (timestamp): When account was created
  - `approvedBy` (string): Who approved the account
  - `approvedAt` (timestamp): When account was approved
  - `updatedAt` (timestamp): Last update time

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your existing project (`allianceapp-2791e`)
3. Go to **Firestore Database**
4. Create the collections if they don't exist

### 2. Security Rules

Copy the rules from `firebase-security-rules.txt` to your Firebase Console:

1. Go to **Firestore Database** > **Rules**
2. Replace the existing rules with the content from `firebase-security-rules.txt`
3. Click **Publish**

### 3. File Structure

The following files have been added/modified for Firebase integration:

```
Accounts/
├── firebase-config.js              # Firebase configuration
├── firebase-database-service.js    # Firebase service layer
├── firebase-security-rules.txt     # Security rules
├── FIREBASE_INTEGRATION_GUIDE.md   # This guide
├── index.html                      # Updated with Firebase scripts
├── student-numbers.html            # Updated with Firebase scripts
├── script.js                       # Updated to use Firebase
└── student-numbers.js              # Updated to use Firebase
```

## Features

### Real-time Synchronization
- **Live Updates**: Changes are synchronized across all connected devices
- **Automatic Refresh**: UI updates automatically when data changes
- **Multi-user Support**: Multiple admins can work simultaneously

### Fallback Support
- **localStorage Fallback**: System works even without Firebase
- **Error Handling**: Graceful degradation if Firebase is unavailable
- **Data Migration**: Easy migration from localStorage to Firebase

### Data Validation
- **Student Number Validation**: Checks against student numbers database
- **Duplicate Prevention**: Prevents duplicate accounts and requests
- **Data Integrity**: Maintains referential integrity between collections

## API Integration

### Android App Integration

The Android app can now submit requests directly to Firebase:

```javascript
// Submit account request
const result = await AccountRequestAPI.submitRequest({
    studentId: '2024-0001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    password: 'password123'
});
```

### Real-time Updates

The system listens for real-time changes:

```javascript
// Listen to pending requests
firebaseService.listenToPendingRequests((requests) => {
    // Update UI with new requests
    updatePendingRequestsTable();
});

// Listen to student accounts
firebaseService.listenToStudentAccounts((accounts) => {
    // Update UI with new accounts
    updateStudentTable();
});
```

## Migration from localStorage

### Automatic Migration
The system automatically detects if Firebase is available and uses it. If not, it falls back to localStorage.

### Manual Migration
To migrate existing localStorage data to Firebase:

1. Open the browser console
2. Run the migration script (if available)
3. Or manually add data through the web interface

## Production Considerations

### Security
1. **Enable Authentication**: Implement admin authentication
2. **Update Security Rules**: Use production security rules
3. **Password Hashing**: Hash passwords before storing
4. **API Keys**: Secure your Firebase configuration

### Performance
1. **Indexing**: Create appropriate Firestore indexes
2. **Pagination**: Implement pagination for large datasets
3. **Caching**: Consider implementing client-side caching
4. **Monitoring**: Set up Firebase monitoring and alerts

### Backup
1. **Regular Exports**: Export data regularly
2. **Firebase Backup**: Enable Firebase automatic backups
3. **Data Validation**: Regular data integrity checks

## Troubleshooting

### Common Issues

1. **Firebase Not Loading**
   - Check internet connection
   - Verify Firebase configuration
   - Check browser console for errors

2. **Permission Denied**
   - Check Firestore security rules
   - Verify Firebase project settings
   - Ensure proper authentication

3. **Data Not Syncing**
   - Check Firebase service initialization
   - Verify real-time listeners are set up
   - Check for JavaScript errors

### Debug Mode

Enable debug logging by opening browser console and looking for:
- `Firebase initialized successfully`
- `Accounts Firebase Service initialized successfully`
- `Data loaded from Firebase successfully`

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify Firebase project configuration
3. Ensure all required files are included
4. Check network connectivity

The system is designed to be robust and will work with or without Firebase, ensuring continuous operation regardless of the backend availability.


