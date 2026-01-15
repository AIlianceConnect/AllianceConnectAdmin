# QR Attendance System - PC Migration Guide
# How to move your system to a new PC

## Overview

With SQL Server as your database, migrating to a new PC is much easier than with localStorage. Here are your options:

## Option 1: Keep Database on Original PC (Recommended for Development)

### Setup Database Server
1. **On your original PC:**
   - Install SQL Server (if not already installed)
   - Configure SQL Server to accept remote connections
   - Set up firewall rules to allow database connections
   - Note down the PC's IP address

2. **On your new PC:**
   - Install Python and the backend dependencies
   - Update `backend/.env` with the original PC's IP:
   ```env
   DATABASE_URL=mssql+pyodbc://username:password@192.168.1.100/database?driver=ODBC+Driver+17+for+SQL+Server
   ```
   - Run the backend on the new PC

### Benefits:
- ✅ No data migration needed
- ✅ Multiple PCs can access the same data
- ✅ Centralized data management
- ✅ Easy to backup

## Option 2: Move Database to New PC

### Method A: SQL Server Backup & Restore

1. **On original PC - Create backup:**
   ```sql
   -- In SSMS, run this command
   BACKUP DATABASE QR_Attendance_System 
   TO DISK = 'C:\Backup\QR_Attendance_System.bak'
   WITH FORMAT, INIT, NAME = 'QR_Attendance_System Full Backup';
   ```

2. **Copy backup file to new PC**

3. **On new PC - Restore database:**
   ```sql
   -- In SSMS, run this command
   RESTORE DATABASE QR_Attendance_System 
   FROM DISK = 'C:\Backup\QR_Attendance_System.bak'
   WITH REPLACE;
   ```

4. **Update connection string:**
   ```env
   DATABASE_URL=mssql+pyodbc://username:password@localhost/database?driver=ODBC+Driver+17+for+SQL+Server
   ```

### Method B: Export/Import Data

1. **Export data from original PC:**
   ```sql
   -- Export students
   SELECT * FROM Students;
   
   -- Export events  
   SELECT * FROM Events;
   
   -- Export attendance records
   SELECT * FROM AttendanceRecords;
   ```

2. **Import data on new PC:**
   - Run `database_setup.sql` to create schema
   - Import the exported data

## Option 3: Cloud Database (Best for Production)

### Azure SQL Database
1. **Create Azure SQL Database**
2. **Update connection string:**
   ```env
   DATABASE_URL=mssql+pyodbc://username:password@your-server.database.windows.net/database?driver=ODBC+Driver+17+for+SQL+Server
   ```
3. **Migrate data using Azure Data Studio or SSMS**

### Benefits:
- ✅ Access from anywhere
- ✅ Automatic backups
- ✅ Scalable
- ✅ No PC dependency

## Quick Migration Script

I'll create a script to help you migrate easily:

```python
# migration_helper.py
import pyodbc
import json
from datetime import datetime

def backup_database_data(connection_string):
    """Backup all data to JSON files"""
    try:
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        # Backup students
        cursor.execute("SELECT * FROM Students")
        students = []
        for row in cursor.fetchall():
            students.append({
                'StudentID': row[0],
                'StudentName': row[1], 
                'Section': row[2],
                'CreatedAt': row[3].isoformat() if row[3] else None,
                'UpdatedAt': row[4].isoformat() if row[4] else None,
                'IsActive': row[5]
            })
        
        # Backup events
        cursor.execute("SELECT * FROM Events")
        events = []
        for row in cursor.fetchall():
            events.append({
                'EventID': row[0],
                'EventName': row[1],
                'EventDescription': row[2],
                'CreatedAt': row[3].isoformat() if row[3] else None,
                'UpdatedAt': row[4].isoformat() if row[4] else None,
                'IsActive': row[5]
            })
        
        # Backup attendance records
        cursor.execute("SELECT * FROM AttendanceRecords")
        attendance = []
        for row in cursor.fetchall():
            attendance.append({
                'RecordID': row[0],
                'StudentID': row[1],
                'EventID': row[2],
                'AttendanceDate': row[3].isoformat() if row[3] else None,
                'TimeIn': row[4].isoformat() if row[4] else None,
                'TimeOut': row[5].isoformat() if row[5] else None,
                'CheckInMs': row[6],
                'LastUpdateMs': row[7],
                'CreatedAt': row[8].isoformat() if row[8] else None,
                'UpdatedAt': row[9].isoformat() if row[9] else None
            })
        
        # Save to files
        with open('students_backup.json', 'w') as f:
            json.dump(students, f, indent=2)
        
        with open('events_backup.json', 'w') as f:
            json.dump(events, f, indent=2)
            
        with open('attendance_backup.json', 'w') as f:
            json.dump(attendance, f, indent=2)
        
        print("✅ Database backup completed!")
        print(f"   - {len(students)} students")
        print(f"   - {len(events)} events") 
        print(f"   - {len(attendance)} attendance records")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")

def restore_database_data(connection_string):
    """Restore data from JSON files"""
    try:
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        
        # Restore students
        with open('students_backup.json', 'r') as f:
            students = json.load(f)
        
        for student in students:
            cursor.execute("""
                INSERT INTO Students (StudentID, StudentName, Section, CreatedAt, UpdatedAt, IsActive)
                VALUES (?, ?, ?, ?, ?, ?)
            """, student['StudentID'], student['StudentName'], student['Section'],
                  student['CreatedAt'], student['UpdatedAt'], student['IsActive'])
        
        # Restore events
        with open('events_backup.json', 'r') as f:
            events = json.load(f)
        
        for event in events:
            cursor.execute("""
                INSERT INTO Events (EventName, EventDescription, CreatedAt, UpdatedAt, IsActive)
                VALUES (?, ?, ?, ?, ?)
            """, event['EventName'], event['EventDescription'],
                  event['CreatedAt'], event['UpdatedAt'], event['IsActive'])
        
        # Restore attendance records
        with open('attendance_backup.json', 'r') as f:
            attendance = json.load(f)
        
        for record in attendance:
            cursor.execute("""
                INSERT INTO AttendanceRecords (StudentID, EventID, AttendanceDate, TimeIn, TimeOut, CheckInMs, LastUpdateMs, CreatedAt, UpdatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, record['StudentID'], record['EventID'], record['AttendanceDate'],
                  record['TimeIn'], record['TimeOut'], record['CheckInMs'], 
                  record['LastUpdateMs'], record['CreatedAt'], record['UpdatedAt'])
        
        conn.commit()
        conn.close()
        
        print("✅ Database restore completed!")
        
    except Exception as e:
        print(f"❌ Restore failed: {e}")

if __name__ == "__main__":
    print("QR Attendance System - Database Migration Helper")
    print("=" * 50)
    
    # Example usage
    old_connection = "mssql+pyodbc://username:password@old-pc/database?driver=ODBC+Driver+17+for+SQL+Server"
    new_connection = "mssql+pyodbc://username:password@new-pc/database?driver=ODBC+Driver+17+for+SQL+Server"
    
    print("1. Backup from old PC:")
    backup_database_data(old_connection)
    
    print("\n2. Restore to new PC:")
    restore_database_data(new_connection)
```

## Step-by-Step Migration Process

### For Option 1 (Keep DB on Original PC):

1. **On Original PC:**
   ```bash
   # Enable SQL Server remote connections
   # Open SQL Server Configuration Manager
   # Enable TCP/IP protocol
   # Set port 1433
   # Restart SQL Server service
   ```

2. **On New PC:**
   ```bash
   # Install Python and dependencies
   pip install -r backend/requirements.txt
   
   # Update .env file
   DATABASE_URL=mssql+pyodbc://username:password@192.168.1.100/database?driver=ODBC+Driver+17+for+SQL+Server
   
   # Test connection
   python test_api.py
   ```

### For Option 2 (Move Database):

1. **Backup on Original PC:**
   ```sql
   BACKUP DATABASE QR_Attendance_System TO DISK = 'C:\Backup\QR_Attendance_System.bak'
   ```

2. **Copy backup file to new PC**

3. **Restore on New PC:**
   ```sql
   RESTORE DATABASE QR_Attendance_System FROM DISK = 'C:\Backup\QR_Attendance_System.bak'
   ```

4. **Update connection string:**
   ```env
   DATABASE_URL=mssql+pyodbc://username:password@localhost/database?driver=ODBC+Driver+17+for+SQL+Server
   ```

## Benefits of SQL Server vs localStorage

| Feature | localStorage | SQL Server |
|---------|-------------|------------|
| **PC Migration** | ❌ Difficult | ✅ Easy |
| **Data Backup** | ❌ Manual | ✅ Automatic |
| **Multi-PC Access** | ❌ No | ✅ Yes |
| **Data Integrity** | ❌ Limited | ✅ ACID |
| **Scalability** | ❌ Limited | ✅ High |
| **Android Integration** | ❌ Complex | ✅ REST API |

## Recommendations

1. **For Development:** Use Option 1 (keep DB on original PC)
2. **For Production:** Use Option 3 (cloud database)
3. **For Single PC:** Use Option 2 (move database)

The SQL Server setup makes PC migration much easier than localStorage, and you'll have better data management, backup options, and Android integration capabilities!
