# QR Attendance System - Data Migration Script
# Migrates data from localStorage (JSON files) to SQL Server database

import json
import os
import sys
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from backend.main import Base, Student, Event, AttendanceRecord, User, APIKey, hash_password

def load_json_data(file_path):
    """Load JSON data from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {file_path}: {e}")
        return []

def parse_date(date_str):
    """Parse date string to date object"""
    try:
        # Handle different date formats
        if '/' in date_str:
            return datetime.strptime(date_str, '%m/%d/%Y').date()
        elif '-' in date_str:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            return datetime.strptime(date_str, '%m/%d/%Y').date()
    except:
        return date.today()

def parse_time(time_str):
    """Parse time string to datetime object"""
    try:
        if not time_str:
            return None
        # Handle different time formats
        if ':' in time_str:
            time_parts = time_str.split(':')
            if len(time_parts) >= 2:
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                second = int(time_parts[2]) if len(time_parts) > 2 else 0
                return datetime.combine(date.today(), datetime.min.time().replace(hour=hour, minute=minute, second=second))
    except:
        return None

def migrate_students(db_session, students_data):
    """Migrate students data"""
    print("Migrating students...")
    migrated_count = 0
    
    for student_data in students_data:
        try:
            # Check if student already exists
            existing_student = db_session.query(Student).filter(
                Student.StudentID == student_data.get('studentId', '')
            ).first()
            
            if not existing_student:
                new_student = Student(
                    StudentID=student_data.get('studentId', ''),
                    StudentName=student_data.get('studentName', ''),
                    Section=student_data.get('section', ''),
                    CreatedAt=datetime.utcnow(),
                    UpdatedAt=datetime.utcnow()
                )
                db_session.add(new_student)
                migrated_count += 1
            else:
                print(f"Student {student_data.get('studentId')} already exists, skipping...")
                
        except Exception as e:
            print(f"Error migrating student {student_data}: {e}")
    
    db_session.commit()
    print(f"Migrated {migrated_count} students")

def migrate_events_and_attendance(db_session, attendance_data):
    """Migrate events and attendance records"""
    print("Migrating events and attendance records...")
    
    # Get unique events
    events = set()
    for record in attendance_data:
        if record.get('event'):
            events.add(record['event'])
    
    # Create events
    event_map = {}
    for event_name in events:
        try:
            existing_event = db_session.query(Event).filter(
                Event.EventName == event_name
            ).first()
            
            if not existing_event:
                new_event = Event(
                    EventName=event_name,
                    EventDescription=f"Migrated event: {event_name}",
                    CreatedAt=datetime.utcnow(),
                    UpdatedAt=datetime.utcnow()
                )
                db_session.add(new_event)
                db_session.flush()  # Get the ID
                event_map[event_name] = new_event.EventID
            else:
                event_map[event_name] = existing_event.EventID
                
        except Exception as e:
            print(f"Error creating event {event_name}: {e}")
    
    db_session.commit()
    
    # Migrate attendance records
    migrated_count = 0
    for record_data in attendance_data:
        try:
            student_id = record_data.get('studentId', '')
            event_name = record_data.get('event', '')
            
            if not student_id or not event_name:
                continue
                
            # Check if student exists
            student = db_session.query(Student).filter(
                Student.StudentID == student_id
            ).first()
            
            if not student:
                print(f"Student {student_id} not found, skipping attendance record")
                continue
            
            event_id = event_map.get(event_name)
            if not event_id:
                print(f"Event {event_name} not found, skipping attendance record")
                continue
            
            attendance_date = parse_date(record_data.get('date', ''))
            time_in = parse_time(record_data.get('timeIn', ''))
            time_out = parse_time(record_data.get('timeOut', ''))
            
            # Check if record already exists
            existing_record = db_session.query(AttendanceRecord).filter(
                AttendanceRecord.StudentID == student_id,
                AttendanceRecord.EventID == event_id,
                AttendanceRecord.AttendanceDate == attendance_date
            ).first()
            
            if not existing_record:
                new_record = AttendanceRecord(
                    StudentID=student_id,
                    EventID=event_id,
                    AttendanceDate=attendance_date,
                    TimeIn=time_in,
                    TimeOut=time_out,
                    CheckInMs=record_data.get('checkInMs', int(datetime.utcnow().timestamp() * 1000)),
                    LastUpdateMs=record_data.get('lastUpdateMs', int(datetime.utcnow().timestamp() * 1000)),
                    CreatedAt=datetime.utcnow(),
                    UpdatedAt=datetime.utcnow()
                )
                db_session.add(new_record)
                migrated_count += 1
            else:
                print(f"Attendance record for {student_id} on {attendance_date} already exists, skipping...")
                
        except Exception as e:
            print(f"Error migrating attendance record {record_data}: {e}")
    
    db_session.commit()
    print(f"Migrated {migrated_count} attendance records")

def create_default_admin(db_session):
    """Create default admin user"""
    print("Creating default admin user...")
    
    try:
        existing_admin = db_session.query(User).filter(
            User.Username == 'admin'
        ).first()
        
        if not existing_admin:
            admin_user = User(
                Username='admin',
                PasswordHash=hash_password('admin123'),
                FullName='System Administrator',
                Role='admin',
                CreatedAt=datetime.utcnow(),
                UpdatedAt=datetime.utcnow()
            )
            db_session.add(admin_user)
            db_session.commit()
            print("Default admin user created: username=admin, password=admin123")
        else:
            print("Admin user already exists")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")

def main():
    """Main migration function"""
    print("QR Attendance System - Data Migration")
    print("=====================================")
    
    # Database configuration
    DATABASE_URL = os.getenv("DATABASE_URL", "mssql+pyodbc://username:password@server/database?driver=ODBC+Driver+17+for+SQL+Server")
    
    if "username:password" in DATABASE_URL:
        print("Please update DATABASE_URL in your environment variables or .env file")
        print("Example: DATABASE_URL=mssql+pyodbc://your_username:your_password@your_server/your_database?driver=ODBC+Driver+17+for+SQL+Server")
        return
    
    try:
        # Create database engine and session
        engine = create_engine(DATABASE_URL, echo=True)
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db_session = SessionLocal()
        
        print("Connected to database successfully")
        
        # Create default admin user
        create_default_admin(db_session)
        
        # Look for JSON data files in the current directory
        students_file = "students_data.json"
        attendance_file = "attendance_data.json"
        
        # Check if files exist
        if not os.path.exists(students_file) and not os.path.exists(attendance_file):
            print("\nNo JSON data files found. Creating sample data...")
            
            # Create sample students
            sample_students = [
                {"studentId": "2023001", "studentName": "Alice Smith", "section": "A"},
                {"studentId": "2023002", "studentName": "Bob Johnson", "section": "A"},
                {"studentId": "2023003", "studentName": "Charlie Lee", "section": "B"},
                {"studentId": "2023004", "studentName": "Diana King", "section": "B"},
                {"studentId": "2023005", "studentName": "Evan Wright", "section": "C"}
            ]
            
            # Create sample attendance records
            sample_attendance = [
                {
                    "studentId": "2023001",
                    "studentName": "Alice Smith",
                    "section": "A",
                    "event": "Sample Event",
                    "date": "12/15/2023",
                    "timeIn": "08:30:00",
                    "timeOut": "17:00:00",
                    "checkInMs": 1702621800000,
                    "lastUpdateMs": 1702648800000
                },
                {
                    "studentId": "2023002",
                    "studentName": "Bob Johnson",
                    "section": "A",
                    "event": "Sample Event",
                    "date": "12/15/2023",
                    "timeIn": "08:45:00",
                    "timeOut": "",
                    "checkInMs": 1702622700000,
                    "lastUpdateMs": 1702622700000
                }
            ]
            
            # Migrate sample data
            migrate_students(db_session, sample_students)
            migrate_events_and_attendance(db_session, sample_attendance)
            
        else:
            # Migrate from JSON files
            if os.path.exists(students_file):
                students_data = load_json_data(students_file)
                migrate_students(db_session, students_data)
            
            if os.path.exists(attendance_file):
                attendance_data = load_json_data(attendance_file)
                migrate_events_and_attendance(db_session, attendance_data)
        
        print("\nMigration completed successfully!")
        print("\nNext steps:")
        print("1. Update your .env file with the correct database credentials")
        print("2. Start the Python backend: python backend/main.py")
        print("3. Test the API endpoints")
        print("4. Update your frontend to use the API instead of localStorage")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        return 1
    
    finally:
        if 'db_session' in locals():
            db_session.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
