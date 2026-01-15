# QR Attendance System - Copy Folder Setup Guide
# What you need to install when copying the folder to another PC

## 🎯 Copying Folder vs Fresh Installation

### **What Gets Copied Successfully:**
- ✅ **All your code files** (HTML, CSS, JavaScript)
- ✅ **Database schema** (`database_setup.sql`)
- ✅ **Python backend code** (`backend/main.py`)
- ✅ **Configuration files** (`.env.example`, `requirements.txt`)
- ✅ **Documentation** (README files, setup guides)
- ✅ **Migration scripts** (`migrate_data.py`, `extract_data.js`)

### **What You Still Need to Install:**
- ❌ **SQL Server** (database engine)
- ❌ **SQL Server Management Studio (SSMS)**
- ❌ **Python** (runtime environment)
- ❌ **Python packages** (dependencies)
- ❌ **ODBC Driver 17** (database connectivity)

## 📋 Installation Checklist for New PC

### **Step 1: Install Prerequisites**
- [ ] **SQL Server** (Express or Developer Edition)
- [ ] **SQL Server Management Studio (SSMS) 21**
- [ ] **Python 3.8+** (from python.org)
- [ ] **ODBC Driver 17 for SQL Server**

### **Step 2: Install Python Dependencies**
```bash
# Navigate to your copied folder
cd "C:\path\to\your\copied\QR-Attendance"

# Install Python packages
cd backend
pip install -r requirements.txt
```

### **Step 3: Database Setup**
```bash
# Open SSMS and run the database schema
# File: database_setup.sql
```

### **Step 4: Configuration**
```bash
# Copy environment template
copy backend\env.example backend\.env

# Edit .env file with your database connection
# Update DATABASE_URL
```

## 🚀 Quick Setup After Copying

### **Option 1: Use Setup Script**
```bash
# Run the setup script
fresh_setup.bat
```

### **Option 2: Manual Setup**
```bash
# 1. Install prerequisites (SQL Server, Python, SSMS)
# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Setup database
# Open SSMS → Run database_setup.sql

# 4. Configure backend
copy backend\env.example backend\.env
# Edit .env with your database details

# 5. Test setup
python test_api.py
```

## 🔧 What Each Component Does

### **SQL Server (Required)**
- **Purpose**: Database engine
- **Why needed**: Stores all your data
- **Alternative**: None (core requirement)

### **SSMS (Required)**
- **Purpose**: Database management tool
- **Why needed**: To run `database_setup.sql`
- **Alternative**: Azure Data Studio (free)

### **Python (Required)**
- **Purpose**: Runs the backend API
- **Why needed**: Your backend is Python-based
- **Alternative**: None (core requirement)

### **Python Packages (Required)**
- **Purpose**: Backend dependencies
- **Why needed**: FastAPI, SQLAlchemy, etc.
- **Install**: `pip install -r requirements.txt`

### **ODBC Driver (Required)**
- **Purpose**: Database connectivity
- **Why needed**: Python to SQL Server connection
- **Alternative**: None (required for pyodbc)

## 📊 Comparison: Copy vs Fresh Install

| Component | Copy Folder | Fresh Install |
|-----------|-------------|---------------|
| **Code Files** | ✅ Copied | ❌ Need to download |
| **SQL Server** | ❌ Need to install | ❌ Need to install |
| **Python** | ❌ Need to install | ❌ Need to install |
| **Dependencies** | ❌ Need to install | ❌ Need to install |
| **Configuration** | ✅ Copied | ❌ Need to create |
| **Documentation** | ✅ Copied | ❌ Need to download |

## 🎯 Recommended Approach

### **Copy Folder + Quick Setup:**
1. **Copy entire folder** to new PC
2. **Install prerequisites** (SQL Server, Python, SSMS)
3. **Run setup script** (`fresh_setup.bat`)
4. **Test setup** (`python test_api.py`)

### **Benefits:**
- ✅ **All your code preserved**
- ✅ **Configuration files ready**
- ✅ **Documentation included**
- ✅ **Migration scripts available**
- ✅ **Faster than fresh download**

## 🔄 Data Migration After Copy

### **If you have existing data:**
1. **Extract from old PC** using `extract_data.js`
2. **Copy JSON files** to new PC
3. **Import using** `migrate_data.py`

### **If starting fresh:**
1. **Add sample data** using API
2. **Test at** http://localhost:8000/docs
3. **Import real data** when ready

## 🚀 Quick Start Commands

### **After copying folder:**
```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Setup database (in SSMS)
# Run: database_setup.sql

# 3. Configure backend
copy env.example .env
# Edit .env with your database details

# 4. Test setup
python test_api.py

# 5. Start backend
python main.py
```

## 🎉 Summary

**Copying the folder is a great start!** You get:
- ✅ **All your code**
- ✅ **Configuration templates**
- ✅ **Documentation**
- ✅ **Migration scripts**

**You still need to install:**
- ❌ **SQL Server** (database)
- ❌ **Python** (runtime)
- ❌ **Dependencies** (packages)
- ❌ **SSMS** (database tool)

**Total setup time:** About 30 minutes (vs 2+ hours for fresh download)

Copying the folder + quick setup is definitely the **fastest approach**! 🚀
