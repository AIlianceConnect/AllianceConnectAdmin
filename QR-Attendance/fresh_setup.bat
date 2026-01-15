@echo off
echo QR Attendance System - Fresh PC Setup
echo ====================================
echo.
echo Starting fresh on a new PC - No migration needed!
echo.

echo Step 1: Installing Python dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Error installing Python dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Database Setup Instructions
echo ====================================
echo.
echo 1. Install SQL Server (Express or Developer Edition)
echo 2. Install SQL Server Management Studio (SSMS) 21
echo 3. Open SSMS and connect to your SQL Server instance
echo 4. Run the database_setup.sql script to create the database schema
echo 5. Update the DATABASE_URL in backend/.env file
echo.
echo Example DATABASE_URL formats:
echo - Local SQL Server: mssql+pyodbc://username:password@localhost/database?driver=ODBC+Driver+17+for+SQL+Server
echo - Windows Auth: mssql+pyodbc://localhost/database?driver=ODBC+Driver+17+for+SQL+Server^&trusted_connection=yes
echo.

echo Step 3: Configuration
echo =====================
echo.
echo 1. Copy backend/env.example to backend/.env
echo 2. Update DATABASE_URL with your connection details
echo 3. Change the default admin password for security
echo.

echo Step 4: Testing Your Setup
echo ===========================
echo.
echo 1. Test database connection: python test_api.py
echo 2. Start the backend: python backend/main.py
echo 3. Open API docs: http://localhost:8000/docs
echo 4. Test login with: username=admin, password=admin123
echo.

echo Step 5: Import Existing Data (Optional)
echo =======================================
echo.
echo If you want to import your existing localStorage data:
echo 1. Open your old QR system in browser
echo 2. Run extract_data.js in browser console
echo 3. Download the JSON files
echo 4. Run: python migrate_data.py
echo.

echo Step 6: Android Integration
echo ============================
echo.
echo Your fresh setup includes:
echo - REST API ready for Android apps
echo - Authentication system with API keys
echo - SQL Server database for data management
echo - Automatic backups and data integrity
echo.

echo Benefits of Fresh Start:
echo - Clean setup without legacy issues
echo - Latest software versions
echo - Better performance on new PC
echo - Easier troubleshooting
echo - Professional database management
echo.

echo Setup completed! Check FRESH_PC_SETUP.md for detailed instructions.
echo.
pause
