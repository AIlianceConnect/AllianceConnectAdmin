# QR Attendance System - SQL Server Integration Guide

## Overview

This guide will help you integrate your existing QR Attendance System with SQL Server Management Studio (SSMS) 21 and create a Python backend that's compatible with Android applications.

## Prerequisites

- SQL Server (any version compatible with SSMS 21)
- SQL Server Management Studio 21
- Python 3.8 or higher
- Windows 10/11 (for ODBC drivers)

## Quick Start

1. **Run the setup script:**
   ```bash
   setup.bat
   ```

2. **Set up the database:**
   - Open SSMS 21
   - Connect to your SQL Server instance
   - Run `database_setup.sql` to create the database schema

3. **Configure the backend:**
   - Copy `backend/env.example` to `backend/.env`
   - Update the DATABASE_URL with your connection details

4. **Migrate your data:**
   - Extract data from localStorage using `extract_data.js`
   - Run `python migrate_data.py` to migrate to SQL Server

5. **Start the backend:**
   ```bash
   python backend/main.py
   ```

## Database Setup

### 1. Create Database Schema

Run the `database_setup.sql` script in SSMS 21. This will create:

- **Students table**: Stores student information
- **Events table**: Stores event information  
- **AttendanceRecords table**: Stores attendance data
- **Users table**: For authentication
- **APIKeys table**: For API authentication
- **Stored procedures**: For common operations
- **Views**: For easier data access

### 2. Database Connection

Update your `backend/.env` file with the correct database URL:

```env
# SQL Server Authentication
DATABASE_URL=mssql+pyodbc://username:password@server/database?driver=ODBC+Driver+17+for+SQL+Server

# Windows Authentication
DATABASE_URL=mssql+pyodbc://server/database?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes

# SQL Server with instance
DATABASE_URL=mssql+pyodbc://username:password@server\instance/database?driver=ODBC+Driver+17+for+SQL+Server
```

## Data Migration

### 1. Extract Data from localStorage

1. Open your QR Attendance System in a web browser
2. Open Developer Tools (F12) → Console
3. Copy and paste the contents of `extract_data.js`
4. Download the generated JSON files

### 2. Migrate to SQL Server

```bash
python migrate_data.py
```

This will:
- Create the database tables
- Migrate students data
- Migrate events and attendance records
- Create a default admin user

## Python Backend

### Features

- **FastAPI framework**: High-performance async API
- **SQL Server integration**: Using SQLAlchemy with pyodbc
- **Authentication**: API key-based authentication
- **CORS support**: For web frontend integration
- **Android compatibility**: RESTful API design

### API Endpoints

#### Authentication
- `POST /auth/login` - Login and get API key
- `POST /auth/register` - Register new user

#### Students
- `GET /students` - Get all students
- `POST /students` - Create new student
- `GET /students/{student_id}` - Get specific student
- `GET /students/section/{section}` - Get students by section

#### Events
- `GET /events` - Get all events
- `POST /events` - Create new event

#### Attendance
- `POST /attendance/mark` - Mark attendance
- `GET /attendance/event/{event_name}` - Get attendance by event
- `GET /attendance/student/{student_id}` - Get attendance by student

### Starting the Server

```bash
cd backend
python main.py
```

The API will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Android Integration

### Authentication

1. **Login to get API key:**
   ```json
   POST /auth/login
   {
     "username": "admin",
     "password": "admin123"
   }
   ```

2. **Use API key for requests:**
   ```http
   Authorization: Bearer your_api_key_here
   ```

### Example API Calls

#### Mark Attendance
```json
POST /attendance/mark
{
  "student_id": "2023001",
  "event_name": "Sample Event",
  "time_in": "2023-12-15T08:30:00Z"
}
```

#### Get Students by Section
```http
GET /students/section/A
Authorization: Bearer your_api_key_here
```

#### Get Attendance by Event
```http
GET /attendance/event/Sample%20Event
Authorization: Bearer your_api_key_here
```

## Frontend Integration

### Update JavaScript to use API

Replace localStorage calls with API calls:

```javascript
// Old localStorage approach
const students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];

// New API approach
const response = await fetch('/students', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});
const students = await response.json();
```

### CORS Configuration

The backend includes CORS middleware for web frontend integration. Update the allowed origins in `backend/main.py` for production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Security Considerations

1. **Change default passwords**: Update the default admin password
2. **API key management**: Implement proper API key rotation
3. **Database permissions**: Use least-privilege database users
4. **HTTPS**: Use HTTPS in production
5. **Input validation**: All inputs are validated using Pydantic

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Verify SQL Server is running
   - Check connection string format
   - Ensure ODBC Driver 17 is installed

2. **Import errors**:
   - Install required Python packages: `pip install -r requirements.txt`
   - Check Python version compatibility

3. **CORS errors**:
   - Update CORS origins in backend configuration
   - Ensure frontend is served from allowed origin

### Logs and Debugging

- Enable debug mode in `.env`: `API_DEBUG=True`
- Check SQLAlchemy logs for database queries
- Use FastAPI's automatic API documentation at `/docs`

## Production Deployment

1. **Environment variables**: Set production values in `.env`
2. **Database security**: Use dedicated database users with minimal permissions
3. **API security**: Implement rate limiting and proper authentication
4. **Monitoring**: Add logging and monitoring for production use
5. **Backup**: Implement regular database backups

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the API documentation at `/docs`
3. Check database logs in SSMS
4. Verify Python package versions

## Next Steps

1. Test the API endpoints using the documentation at `/docs`
2. Update your frontend to use the API instead of localStorage
3. Implement Android app using the REST API
4. Set up production environment with proper security
5. Implement monitoring and backup procedures
