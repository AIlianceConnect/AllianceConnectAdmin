# QR Attendance System - Fresh PC Setup Guide
# Starting from scratch on a new PC (No migration needed!)

## 🎯 Fresh Start Setup (Recommended)

Starting fresh on a new PC is actually the **easiest approach**! No migration needed, clean setup, and you can import your existing data later if needed.

## 📋 Quick Setup Checklist

### **Step 1: Install Prerequisites**
- [ ] **SQL Server** (SQL Server Express is free)
- [ ] **SQL Server Management Studio (SSMS) 21**
- [ ] **Python 3.8+**
- [ ] **ODBC Driver 17 for SQL Server**

### **Step 2: Database Setup**
- [ ] Open SSMS 21
- [ ] Run `database_setup.sql` to create schema
- [ ] Default admin user created: `admin` / `admin123`

### **Step 3: Backend Setup**
- [ ] Install Python dependencies: `pip install -r backend/requirements.txt`
- [ ] Copy `backend/env.example` to `backend/.env`
- [ ] Update DATABASE_URL in `.env` file
- [ ] Test: `python test_api.py`

### **Step 4: Start Using**
- [ ] Run: `python backend/main.py`
- [ ] API available at: http://localhost:8000
- [ ] Documentation at: http://localhost:8000/docs

## 🚀 Step-by-Step Instructions

### **1. Install SQL Server**

**Option A: SQL Server Express (Free)**
```bash
# Download from Microsoft website
# Install with default settings
# Enable TCP/IP protocol
```

**Option B: SQL Server Developer Edition (Free)**
```bash
# Download from Microsoft website
# Full-featured version for development
```

### **2. Install SSMS 21**
```bash
# Download from Microsoft website
# Install with default settings
```

### **3. Create Database**
1. Open SSMS 21
2. Connect to your SQL Server instance
3. Run `database_setup.sql` script
4. This creates all tables, stored procedures, and default admin user

### **4. Install Python Backend**
```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Configure database connection
copy env.example .env
# Edit .env file with your database details
```

### **5. Test Setup**
```bash
# Test the API
python test_api.py

# Start the backend
python backend/main.py
```

## 📊 Import Existing Data (Optional)

If you want to import your existing localStorage data later:

### **Method 1: Extract from Browser**
1. Open your old QR system in browser
2. Run `extract_data.js` in browser console
3. Download the JSON files
4. Use `migrate_data.py` to import

### **Method 2: Manual Import**
1. Use the API endpoints to add students/events
2. Use the web interface at `/docs` to test

### **Method 3: Excel Import**
1. Export your existing data to Excel
2. Use the API to bulk import

## 🔧 Configuration Files

### **Database Connection (.env)**
```env
# For local SQL Server
DATABASE_URL=mssql+pyodbc://username:password@localhost/database?driver=ODBC+Driver+17+for+SQL+Server

# For Windows Authentication
DATABASE_URL=mssql+pyodbc://localhost/database?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes

# For remote SQL Server
DATABASE_URL=mssql+pyodbc://username:password@192.168.1.100/database?driver=ODBC+Driver+17+for+SQL+Server
```

### **API Configuration**
```env
API_HOST=0.0.0.0
API_PORT=8000
API_DEBUG=True
SECRET_KEY=your-secret-key-here
```

## 🎯 Benefits of Fresh Start

### **Advantages:**
- ✅ **Clean setup** - No legacy issues
- ✅ **Latest versions** - All software up-to-date
- ✅ **No migration complexity** - Start fresh
- ✅ **Better performance** - Optimized for new PC
- ✅ **Easier troubleshooting** - Clean environment

### **What You Get:**
- ✅ **SQL Server database** - Professional data management
- ✅ **Python REST API** - Ready for Android integration
- ✅ **Authentication system** - Secure API access
- ✅ **Automatic backups** - Database-level backups
- ✅ **Scalable architecture** - Can handle growth

## 📱 Android Integration Ready

Your fresh setup includes everything needed for Android:

### **API Endpoints:**
```http
POST /auth/login          # Get API key
GET  /students           # Get all students
POST /students           # Add new student
POST /attendance/mark    # Mark attendance
GET  /attendance/event/{event_name}  # Get event attendance
```

### **Authentication:**
```json
POST /auth/login
{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "access_token": "your_api_key_here",
  "token_type": "bearer",
  "user_info": {...}
}
```

## 🧪 Testing Your Setup

### **1. Test Database Connection**
```bash
python -c "
from backend.main import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM Students'))
    print(f'Database connected! Students: {result.fetchone()[0]}')
"
```

### **2. Test API Endpoints**
```bash
python test_api.py
```

### **3. Test Web Interface**
- Open http://localhost:8000/docs
- Try the "Try it out" buttons
- Test login and student creation

## 🔄 Data Import Options

### **Option 1: Browser Extraction**
```javascript
// Run in browser console on old system
// Copy contents of extract_data.js
// Download JSON files
// Import using migrate_data.py
```

### **Option 2: API Import**
```python
# Use the API to import data
import requests

# Login
response = requests.post('http://localhost:8000/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})
api_key = response.json()['access_token']

# Add students
headers = {'Authorization': f'Bearer {api_key}'}
for student in your_students:
    requests.post('http://localhost:8000/students', json=student, headers=headers)
```

### **Option 3: Direct Database Import**
```sql
-- Use SSMS to import data directly
INSERT INTO Students (StudentID, StudentName, Section) VALUES
('2023001', 'John Doe', 'A'),
('2023002', 'Jane Smith', 'A');
```

## 🎉 You're Ready!

With a fresh setup, you get:

1. **Clean SQL Server database** - Professional data management
2. **Python REST API** - Ready for Android integration  
3. **Authentication system** - Secure API access
4. **Automatic backups** - Database-level backups
5. **Scalable architecture** - Can handle growth

## 🚀 Next Steps

1. **Test your setup** using `test_api.py`
2. **Add some sample data** using the API
3. **Start developing your Android app** using the REST API
4. **Import existing data** when ready (optional)

Starting fresh is actually the **best approach** - you get a clean, modern setup without any migration complexity! 🎯
