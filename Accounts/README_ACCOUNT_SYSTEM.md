# Student Account Management System

This web application manages student account creation requests from the Android app. It validates student numbers against attendance records and allows administrators to approve or reject account requests.

## System Workflow

1. **Android App**: Students submit account requests with their Student Number, Name, Email, and Password
2. **Web App**: Admin validates the student number against attendance records
3. **Approval Process**: Admin approves/rejects requests based on attendance validation
4. **Account Creation**: Approved requests create student accounts in the system

## Features

### Admin Interface
- **Pending Requests Table**: View all account requests with status
- **Approval/Rejection**: Approve or reject requests with one click
- **Student Records**: View all approved student accounts
- **Search & Filter**: Find students by various criteria
- **Real-time Updates**: Live count of pending requests

### Validation System
- **Attendance Check**: Validates student number against QR-Attendance records
- **Duplicate Prevention**: Prevents duplicate requests and accounts
- **Section Assignment**: Automatically assigns section from attendance records

## File Structure

```
Accounts/
├── index.html          # Main admin interface
├── script.js           # Core functionality
├── api.js              # API endpoints for Android integration
├── styles.css          # Styling (copied from QR-Attendance)
├── lib/                # Bootstrap and other dependencies
└── README_ACCOUNT_SYSTEM.md
```

## API Endpoints for Android App

### Submit Account Request
```javascript
// Android app calls this endpoint
AccountRequestAPI.submitRequest({
    studentId: '2024-0001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    password: 'password123'
});
```

### Check Request Status
```javascript
// Check if request was approved/rejected
AccountRequestAPI.checkStatus('2024-0001');
```

### Login with Approved Account
```javascript
// Login after account is approved
AccountRequestAPI.login({
    studentId: '2024-0001',
    password: 'password123'
});
```

## Data Storage

Currently uses localStorage for development. When integrating with Firebase:

### Pending Requests Collection
```javascript
{
    id: 'req_1234567890_abc123',
    studentId: '2024-0001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    password: 'hashed_password',
    status: 'pending', // 'pending', 'approved', 'rejected'
    requestTime: '2024-01-15T10:30:00.000Z',
    approvedAt: null,
    rejectedAt: null
}
```

### Student Accounts Collection
```javascript
{
    studentId: '2024-0001',
    studentName: 'John Doe',
    section: 'BSIS-AIS 3-3',
    email: 'john.doe@email.com',
    password: 'hashed_password',
    createdAt: '2024-01-15T10:35:00.000Z',
    approvedBy: 'Admin',
    approvedAt: '2024-01-15T10:35:00.000Z'
}
```

## Integration with QR-Attendance System

The system reads attendance records from localStorage to validate student numbers:

```javascript
// This data comes from the QR-Attendance system
attendanceRecords = [
    {
        studentId: '2024-0001',
        studentName: 'John Doe',
        section: 'BSIS-AIS 3-3',
        event: 'Orientation',
        date: '1/15/2024',
        timeIn: '9:00:00 AM',
        timeOut: '5:00:00 PM'
    }
];
```

## Testing

Use the "Test Android Request" button to simulate account requests from the Android app. This will create sample requests that you can approve or reject.

## Firebase Integration (Future)

When ready to integrate with Firebase:

1. Replace localStorage calls with Firebase Firestore
2. Set up Firebase Authentication for admin login
3. Add real-time listeners for pending requests
4. Implement proper password hashing
5. Add admin role management

## Security Notes

- Passwords should be hashed before storage
- Admin authentication should be implemented
- API endpoints should be secured
- Rate limiting should be added to prevent spam

## Usage Instructions

1. Open `index.html` in a web browser
2. Use "Test Android Request" to create sample requests
3. Review pending requests in the table
4. Click "Approve" to create student accounts
5. View approved accounts in the Student Records section


