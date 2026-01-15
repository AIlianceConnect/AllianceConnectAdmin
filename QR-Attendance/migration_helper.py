# QR Attendance System - Database Migration Helper
# Easy PC migration with SQL Server

import pyodbc
import json
from datetime import datetime
import os

def backup_database_data(connection_string):
    """Backup all data to JSON files"""
    try:
        # Convert SQLAlchemy URL to pyodbc connection string
        if "mssql+pyodbc://" in connection_string:
            # Extract connection details
            parts = connection_string.replace("mssql+pyodbc://", "").split("/")
            auth_server = parts[0]
            database = parts[1].split("?")[0]
            
            if "@" in auth_server:
                auth, server = auth_server.split("@")
                username, password = auth.split(":")
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}"
            else:
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={auth_server};DATABASE={database};Trusted_Connection=yes"
        else:
            conn_str = connection_string
        
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        print("📊 Backing up database data...")
        
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
        
        # Backup users
        cursor.execute("SELECT * FROM Users")
        users = []
        for row in cursor.fetchall():
            users.append({
                'UserID': row[0],
                'Username': row[1],
                'PasswordHash': row[2],
                'FullName': row[3],
                'Role': row[4],
                'CreatedAt': row[5].isoformat() if row[5] else None,
                'UpdatedAt': row[6].isoformat() if row[6] else None,
                'IsActive': row[7]
            })
        
        # Save to files
        backup_data = {
            'backup_date': datetime.now().isoformat(),
            'students': students,
            'events': events,
            'attendance_records': attendance,
            'users': users
        }
        
        with open('database_backup.json', 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
        
        print("✅ Database backup completed!")
        print(f"   📁 File: database_backup.json")
        print(f"   👥 Students: {len(students)}")
        print(f"   📅 Events: {len(events)}") 
        print(f"   📊 Attendance Records: {len(attendance)}")
        print(f"   👤 Users: {len(users)}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False

def restore_database_data(connection_string):
    """Restore data from JSON files"""
    try:
        if not os.path.exists('database_backup.json'):
            print("❌ database_backup.json not found!")
            return False
        
        # Convert SQLAlchemy URL to pyodbc connection string
        if "mssql+pyodbc://" in connection_string:
            parts = connection_string.replace("mssql+pyodbc://", "").split("/")
            auth_server = parts[0]
            database = parts[1].split("?")[0]
            
            if "@" in auth_server:
                auth, server = auth_server.split("@")
                username, password = auth.split(":")
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}"
            else:
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={auth_server};DATABASE={database};Trusted_Connection=yes"
        else:
            conn_str = connection_string
        
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        print("📊 Restoring database data...")
        
        with open('database_backup.json', 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        print(f"📅 Backup date: {backup_data.get('backup_date', 'Unknown')}")
        
        # Clear existing data (optional - comment out if you want to keep existing data)
        print("🗑️  Clearing existing data...")
        cursor.execute("DELETE FROM AttendanceRecords")
        cursor.execute("DELETE FROM Students")
        cursor.execute("DELETE FROM Events")
        cursor.execute("DELETE FROM Users")
        
        # Restore users first (due to foreign key constraints)
        users = backup_data.get('users', [])
        for user in users:
            try:
                cursor.execute("""
                    INSERT INTO Users (Username, PasswordHash, FullName, Role, CreatedAt, UpdatedAt, IsActive)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, user['Username'], user['PasswordHash'], user['FullName'], 
                      user['Role'], user['CreatedAt'], user['UpdatedAt'], user['IsActive'])
            except Exception as e:
                print(f"⚠️  User {user['Username']} already exists, skipping...")
        
        # Restore students
        students = backup_data.get('students', [])
        for student in students:
            try:
                cursor.execute("""
                    INSERT INTO Students (StudentID, StudentName, Section, CreatedAt, UpdatedAt, IsActive)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, student['StudentID'], student['StudentName'], student['Section'],
                      student['CreatedAt'], student['UpdatedAt'], student['IsActive'])
            except Exception as e:
                print(f"⚠️  Student {student['StudentID']} already exists, skipping...")
        
        # Restore events
        events = backup_data.get('events', [])
        for event in events:
            try:
                cursor.execute("""
                    INSERT INTO Events (EventName, EventDescription, CreatedAt, UpdatedAt, IsActive)
                    VALUES (?, ?, ?, ?, ?)
                """, event['EventName'], event['EventDescription'],
                      event['CreatedAt'], event['UpdatedAt'], event['IsActive'])
            except Exception as e:
                print(f"⚠️  Event {event['EventName']} already exists, skipping...")
        
        # Get event ID mapping for attendance records
        cursor.execute("SELECT EventID, EventName FROM Events")
        event_mapping = {row[1]: row[0] for row in cursor.fetchall()}
        
        # Restore attendance records
        attendance = backup_data.get('attendance_records', [])
        for record in attendance:
            try:
                # Get current event ID
                cursor.execute("SELECT EventID FROM Events WHERE EventName = ?", record['EventName'])
                event_row = cursor.fetchone()
                if event_row:
                    event_id = event_row[0]
                else:
                    print(f"⚠️  Event {record['EventName']} not found, skipping attendance record...")
                    continue
                
                cursor.execute("""
                    INSERT INTO AttendanceRecords (StudentID, EventID, AttendanceDate, TimeIn, TimeOut, CheckInMs, LastUpdateMs, CreatedAt, UpdatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, record['StudentID'], event_id, record['AttendanceDate'],
                      record['TimeIn'], record['TimeOut'], record['CheckInMs'], 
                      record['LastUpdateMs'], record['CreatedAt'], record['UpdatedAt'])
            except Exception as e:
                print(f"⚠️  Attendance record for {record['StudentID']} already exists, skipping...")
        
        conn.commit()
        conn.close()
        
        print("✅ Database restore completed!")
        print(f"   👥 Students: {len(students)}")
        print(f"   📅 Events: {len(events)}")
        print(f"   📊 Attendance Records: {len(attendance)}")
        print(f"   👤 Users: {len(users)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        return False

def test_connection(connection_string):
    """Test database connection"""
    try:
        if "mssql+pyodbc://" in connection_string:
            parts = connection_string.replace("mssql+pyodbc://", "").split("/")
            auth_server = parts[0]
            database = parts[1].split("?")[0]
            
            if "@" in auth_server:
                auth, server = auth_server.split("@")
                username, password = auth.split(":")
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}"
            else:
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={auth_server};DATABASE={database};Trusted_Connection=yes"
        else:
            conn_str = connection_string
        
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM Students")
        count = cursor.fetchone()[0]
        conn.close()
        
        print(f"✅ Connection successful! Found {count} students in database.")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def main():
    """Main migration helper"""
    print("QR Attendance System - Database Migration Helper")
    print("=" * 55)
    print()
    
    # Get connection string from environment or user input
    connection_string = os.getenv("DATABASE_URL")
    
    if not connection_string:
        print("Please provide your database connection string:")
        print("Example: mssql+pyodbc://username:password@server/database?driver=ODBC+Driver+17+for+SQL+Server")
        connection_string = input("Connection string: ").strip()
    
    if not connection_string:
        print("❌ No connection string provided!")
        return
    
    print(f"🔗 Testing connection...")
    if not test_connection(connection_string):
        print("❌ Cannot connect to database. Please check your connection string.")
        return
    
    print()
    print("Choose an option:")
    print("1. Backup database to JSON file")
    print("2. Restore database from JSON file")
    print("3. Test connection only")
    
    choice = input("Enter your choice (1-3): ").strip()
    
    if choice == "1":
        print("\n📤 Starting backup...")
        if backup_database_data(connection_string):
            print("\n✅ Backup completed successfully!")
            print("📁 Copy 'database_backup.json' to your new PC")
        else:
            print("\n❌ Backup failed!")
    
    elif choice == "2":
        print("\n📥 Starting restore...")
        if restore_database_data(connection_string):
            print("\n✅ Restore completed successfully!")
        else:
            print("\n❌ Restore failed!")
    
    elif choice == "3":
        print("\n✅ Connection test completed!")
    
    else:
        print("❌ Invalid choice!")

if __name__ == "__main__":
    main()
