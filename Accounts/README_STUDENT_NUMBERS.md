# Student Numbers Management System

This page allows you to manage the database of valid student numbers that can be used for account validation in the main account management system.

## Overview

The Student Numbers Management system serves as a validation database for the account creation process. When students submit account requests from the Android app, the system checks if their student number exists in this database before approving the request.

## Features

### Student Number Management
- **Add Student Numbers**: Add individual student numbers with complete information
- **Edit Student Numbers**: Update existing student information
- **Delete Student Numbers**: Remove student numbers from the database
- **Search & Filter**: Find students by number, name, or section

### Bulk Operations
- **CSV Import**: Import multiple student numbers from CSV files
- **CSV Export**: Export all student numbers to CSV format
- **Section Filtering**: Filter students by their sections

### Data Fields
Each student record includes:
- **Student Number**: Unique identifier
- **Full Name**: Student's complete name
- **Course**: BSIS-AIS, BSAIS, BSIT, BSCS, or Other
- **Year-Section**: Academic year and section (e.g., 3-3, 1-2)
- **Email**: Student's email address (optional)
- **Phone**: Student's phone number (optional)
- **Added Date**: When the record was created

## File Structure

```
Accounts/
├── student-numbers.html      # Student numbers management page
├── student-numbers.js        # JavaScript functionality
├── index.html               # Main account management page
└── README_STUDENT_NUMBERS.md
```

## Usage Instructions

### Adding Student Numbers

1. **Single Addition**:
   - Click "Add Student Number" button
   - Fill in required fields (Student Number, Name, Course, Year-Section)
   - Optionally add email and phone
   - Click "Add Student Number"

2. **Bulk Import**:
   - Click "Import CSV" button
   - Select a CSV file with student data
   - Ensure CSV has columns: StudentNumber, Name, Course, YearSection, Email, Phone
   - Click "Import"

### Managing Student Numbers

- **Search**: Use the search box to find specific students
- **Filter**: Use the section dropdown to filter by sections
- **Edit**: Click "Edit" button to modify student information
- **Delete**: Click "Delete" button to remove student records

### CSV Format

Example CSV format for import:
```csv
StudentNumber,Name,Course,YearSection,Email,Phone
2024-0001,John Doe,BSIS-AIS,3-3,john.doe@email.com,1234567890
2024-0002,Jane Smith,BSAIS,2-1,jane.smith@email.com,0987654321
```

## Integration with Account Management

### Validation Process

1. Student submits account request from Android app
2. System checks if student number exists in this database
3. If found, account request can be approved
4. If not found, admin must add student number first

### Data Flow

```
Student Numbers Database → Account Validation → Account Creation
```

## Data Storage

Currently uses localStorage for development. When integrating with Firebase:

### Student Numbers Collection Structure
```javascript
{
    studentId: '2024-0001',
    studentName: 'John Doe',
    section: 'BSIS-AIS 3-3',
    course: 'BSIS-AIS',
    yearSection: '3-3',
    email: 'john.doe@email.com',
    phone: '1234567890',
    addedAt: '2024-01-15T10:30:00.000Z',
    addedBy: 'Admin'
}
```

## Firebase Integration (Future)

When ready to integrate with Firebase:

1. **Replace localStorage**: Use Firebase Firestore for data storage
2. **Real-time Updates**: Add real-time listeners for changes
3. **Admin Authentication**: Secure the management interface
4. **Data Validation**: Add server-side validation rules
5. **Backup & Sync**: Automatic data synchronization

## Security Considerations

- **Access Control**: Restrict access to admin users only
- **Data Validation**: Validate student numbers and ISO format
- **Audit Trail**: Track who added/modified records
- **Backup**: Regular data backups and export functionality

## Navigation

- **Account Management**: Main page for managing account requests
- **Student Numbers**: This page for managing the validation database

## Troubleshooting

### Common Issues

1. **Duplicate Student Numbers**: System prevents duplicate entries
2. **CSV Import Errors**: Check CSV format and column headers
3. **Search Not Working**: Ensure search terms match the data format
4. **Validation Failures**: Verify student numbers exist in this database

### Best Practices

1. **Regular Updates**: Keep student numbers database current
2. **Data Consistency**: Use consistent naming conventions
3. **Backup**: Export data regularly for backup purposes
4. **Validation**: Always verify student information before adding


