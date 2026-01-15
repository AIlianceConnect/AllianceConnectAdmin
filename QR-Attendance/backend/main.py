# QR Attendance System - Python Backend
# Compatible with SQL Server and Android integration

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Date, Boolean, BigInteger, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import List, Optional
import hashlib
import secrets
import os
from contextlib import asynccontextmanager

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "mssql+pyodbc://username:password@server/database?driver=ODBC+Driver+17+for+SQL+Server")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Security
security = HTTPBearer()

# Database Models
class Student(Base):
    __tablename__ = "Students"
    
    StudentID = Column(String(50), primary_key=True)
    StudentName = Column(String(255), nullable=False)
    Section = Column(String(100), nullable=False)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow)
    IsActive = Column(Boolean, default=True)

class Event(Base):
    __tablename__ = "Events"
    
    EventID = Column(Integer, primary_key=True, autoincrement=True)
    EventName = Column(String(255), nullable=False, unique=True)
    EventDescription = Column(String(500))
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow)
    IsActive = Column(Boolean, default=True)

class AttendanceRecord(Base):
    __tablename__ = "AttendanceRecords"
    
    RecordID = Column(Integer, primary_key=True, autoincrement=True)
    StudentID = Column(String(50), ForeignKey("Students.StudentID"), nullable=False)
    EventID = Column(Integer, ForeignKey("Events.EventID"), nullable=False)
    AttendanceDate = Column(Date, nullable=False)
    TimeIn = Column(DateTime)
    TimeOut = Column(DateTime)
    CheckInMs = Column(BigInteger)
    LastUpdateMs = Column(BigInteger)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    student = relationship("Student", backref="attendance_records")
    event = relationship("Event", backref="attendance_records")

class User(Base):
    __tablename__ = "Users"
    
    UserID = Column(Integer, primary_key=True, autoincrement=True)
    Username = Column(String(50), nullable=False, unique=True)
    PasswordHash = Column(String(255), nullable=False)
    FullName = Column(String(255))
    Role = Column(String(50), default="admin")
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow)
    IsActive = Column(Boolean, default=True)

class APIKey(Base):
    __tablename__ = "APIKeys"
    
    KeyID = Column(Integer, primary_key=True, autoincrement=True)
    UserID = Column(Integer, ForeignKey("Users.UserID"), nullable=False)
    APIKey = Column(String(255), nullable=False, unique=True)
    KeyName = Column(String(100))
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    ExpiresAt = Column(DateTime)
    IsActive = Column(Boolean, default=True)
    
    user = relationship("User", backref="api_keys")

# Pydantic Models
class StudentCreate(BaseModel):
    student_id: str = Field(..., alias="StudentID")
    student_name: str = Field(..., alias="StudentName")
    section: str = Field(..., alias="Section")

class StudentResponse(BaseModel):
    StudentID: str
    StudentName: str
    Section: str
    CreatedAt: datetime
    UpdatedAt: datetime
    IsActive: bool
    
    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    event_name: str = Field(..., alias="EventName")
    event_description: Optional[str] = Field(None, alias="EventDescription")

class EventResponse(BaseModel):
    EventID: int
    EventName: str
    EventDescription: Optional[str]
    CreatedAt: datetime
    UpdatedAt: datetime
    IsActive: bool
    
    class Config:
        from_attributes = True

class AttendanceMark(BaseModel):
    student_id: str
    event_name: str
    attendance_date: Optional[date] = None
    time_in: Optional[datetime] = None
    time_out: Optional[datetime] = None

class AttendanceResponse(BaseModel):
    RecordID: int
    StudentID: str
    StudentName: str
    Section: str
    EventName: str
    AttendanceDate: date
    TimeIn: Optional[datetime]
    TimeOut: Optional[datetime]
    DurationMinutes: Optional[int]
    CreatedAt: datetime
    UpdatedAt: datetime
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "admin"

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_info: dict

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Authentication functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_api_key() -> str:
    return secrets.token_urlsafe(32)

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.Username == username, User.IsActive == True).first()
    if not user or not verify_password(password, user.PasswordHash):
        return False
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    api_key = credentials.credentials
    api_key_obj = db.query(APIKey).filter(APIKey.APIKey == api_key, APIKey.IsActive == True).first()
    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return api_key_obj.user

# FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    pass

app = FastAPI(
    title="QR Attendance System API",
    description="Backend API for QR Attendance System with SQL Server integration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication endpoints
@app.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create or get existing API key
    api_key_obj = db.query(APIKey).filter(APIKey.UserID == user.UserID, APIKey.IsActive == True).first()
    if not api_key_obj:
        api_key_obj = APIKey(
            UserID=user.UserID,
            APIKey=create_api_key(),
            KeyName=f"Login_{datetime.utcnow().isoformat()}"
        )
        db.add(api_key_obj)
        db.commit()
    
    return LoginResponse(
        access_token=api_key_obj.APIKey,
        token_type="bearer",
        user_info={
            "user_id": user.UserID,
            "username": user.Username,
            "full_name": user.FullName,
            "role": user.Role
        }
    )

@app.post("/auth/register")
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.Username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        Username=user_data.username,
        PasswordHash=hashed_password,
        FullName=user_data.full_name,
        Role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User created successfully", "user_id": new_user.UserID}

# Student endpoints
@app.get("/students", response_model=List[StudentResponse])
async def get_students(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    students = db.query(Student).filter(Student.IsActive == True).all()
    return students

@app.post("/students", response_model=StudentResponse)
async def create_student(student_data: StudentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if student already exists
    existing_student = db.query(Student).filter(Student.StudentID == student_data.student_id).first()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID already exists"
        )
    
    new_student = Student(
        StudentID=student_data.student_id,
        StudentName=student_data.student_name,
        Section=student_data.section
    )
    
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    
    return new_student

@app.get("/students/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter(Student.StudentID == student_id, Student.IsActive == True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.get("/students/section/{section}", response_model=List[StudentResponse])
async def get_students_by_section(section: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    students = db.query(Student).filter(Student.Section == section, Student.IsActive == True).all()
    return students

# Event endpoints
@app.get("/events", response_model=List[EventResponse])
async def get_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = db.query(Event).filter(Event.IsActive == True).all()
    return events

@app.post("/events", response_model=EventResponse)
async def create_event(event_data: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if event already exists
    existing_event = db.query(Event).filter(Event.EventName == event_data.event_name).first()
    if existing_event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event name already exists"
        )
    
    new_event = Event(
        EventName=event_data.event_name,
        EventDescription=event_data.event_description
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    return new_event

# Attendance endpoints
@app.post("/attendance/mark", response_model=AttendanceResponse)
async def mark_attendance(attendance_data: AttendanceMark, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Set default values
    attendance_date = attendance_data.attendance_date or date.today()
    time_in = attendance_data.time_in or datetime.utcnow()
    
    # Get or create event
    event = db.query(Event).filter(Event.EventName == attendance_data.event_name, Event.IsActive == True).first()
    if not event:
        event = Event(EventName=attendance_data.event_name)
        db.add(event)
        db.commit()
        db.refresh(event)
    
    # Check if student exists
    student = db.query(Student).filter(Student.StudentID == attendance_data.student_id, Student.IsActive == True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if record exists
    existing_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.StudentID == attendance_data.student_id,
        AttendanceRecord.EventID == event.EventID,
        AttendanceRecord.AttendanceDate == attendance_date
    ).first()
    
    if existing_record:
        # Update existing record
        if attendance_data.time_out:
            existing_record.TimeOut = attendance_data.time_out
        else:
            existing_record.TimeIn = time_in
        
        existing_record.LastUpdateMs = int(datetime.utcnow().timestamp() * 1000)
        existing_record.UpdatedAt = datetime.utcnow()
        
        db.commit()
        db.refresh(existing_record)
        
        # Return formatted response
        return AttendanceResponse(
            RecordID=existing_record.RecordID,
            StudentID=student.StudentID,
            StudentName=student.StudentName,
            Section=student.Section,
            EventName=event.EventName,
            AttendanceDate=existing_record.AttendanceDate,
            TimeIn=existing_record.TimeIn,
            TimeOut=existing_record.TimeOut,
            DurationMinutes=int((existing_record.TimeOut - existing_record.TimeIn).total_seconds() / 60) if existing_record.TimeOut and existing_record.TimeIn else None,
            CreatedAt=existing_record.CreatedAt,
            UpdatedAt=existing_record.UpdatedAt
        )
    else:
        # Create new record
        new_record = AttendanceRecord(
            StudentID=attendance_data.student_id,
            EventID=event.EventID,
            AttendanceDate=attendance_date,
            TimeIn=time_in,
            TimeOut=attendance_data.time_out,
            CheckInMs=int(datetime.utcnow().timestamp() * 1000),
            LastUpdateMs=int(datetime.utcnow().timestamp() * 1000)
        )
        
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        
        # Return formatted response
        return AttendanceResponse(
            RecordID=new_record.RecordID,
            StudentID=student.StudentID,
            StudentName=student.StudentName,
            Section=student.Section,
            EventName=event.EventName,
            AttendanceDate=new_record.AttendanceDate,
            TimeIn=new_record.TimeIn,
            TimeOut=new_record.TimeOut,
            DurationMinutes=int((new_record.TimeOut - new_record.TimeIn).total_seconds() / 60) if new_record.TimeOut and new_record.TimeIn else None,
            CreatedAt=new_record.CreatedAt,
            UpdatedAt=new_record.UpdatedAt
        )

@app.get("/attendance/event/{event_name}", response_model=List[AttendanceResponse])
async def get_attendance_by_event(event_name: str, attendance_date: Optional[date] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(AttendanceRecord).join(Student).join(Event).filter(
        Event.EventName == event_name,
        Student.IsActive == True,
        Event.IsActive == True
    )
    
    if attendance_date:
        query = query.filter(AttendanceRecord.AttendanceDate == attendance_date)
    
    records = query.all()
    
    # Format response
    result = []
    for record in records:
        result.append(AttendanceResponse(
            RecordID=record.RecordID,
            StudentID=record.student.StudentID,
            StudentName=record.student.StudentName,
            Section=record.student.Section,
            EventName=record.event.EventName,
            AttendanceDate=record.AttendanceDate,
            TimeIn=record.TimeIn,
            TimeOut=record.TimeOut,
            DurationMinutes=int((record.TimeOut - record.TimeIn).total_seconds() / 60) if record.TimeOut and record.TimeIn else None,
            CreatedAt=record.CreatedAt,
            UpdatedAt=record.UpdatedAt
        ))
    
    # Sort by active records first, then by last update
    result.sort(key=lambda x: (x.TimeOut is None, x.UpdatedAt), reverse=True)
    
    return result

@app.get("/attendance/student/{student_id}", response_model=List[AttendanceResponse])
async def get_attendance_by_student(student_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(AttendanceRecord).join(Student).join(Event).filter(
        Student.StudentID == student_id,
        Student.IsActive == True,
        Event.IsActive == True
    ).all()
    
    # Format response
    result = []
    for record in records:
        result.append(AttendanceResponse(
            RecordID=record.RecordID,
            StudentID=record.student.StudentID,
            StudentName=record.student.StudentName,
            Section=record.student.Section,
            EventName=record.event.EventName,
            AttendanceDate=record.AttendanceDate,
            TimeIn=record.TimeIn,
            TimeOut=record.TimeOut,
            DurationMinutes=int((record.TimeOut - record.TimeIn).total_seconds() / 60) if record.TimeOut and record.TimeIn else None,
            CreatedAt=record.CreatedAt,
            UpdatedAt=record.UpdatedAt
        ))
    
    return result

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
