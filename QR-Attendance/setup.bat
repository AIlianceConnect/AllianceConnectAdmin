@echo off
echo QR Attendance System - Setup Script
echo ===================================

echo.
echo This script will help you set up the QR Attendance System with SQL Server
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
echo 1. Open SQL Server Management Studio (SSMS) 21
echo 2. Connect to your SQL Server instance
echo 3. Run the database_setup.sql script to create the database schema
echo 4. Update the DATABASE_URL in backend/.env file with your connection details
echo.
echo Example DATABASE_URL formats:
echo - SQL Server Authentication: mssql+pyodbc://username:password@server/database?driver=ODBC+Driver+17+for+SQL+Server
echo - Windows Authentication: mssql+pyodbc://server/database?driver=ODBC+Driver+17+for+SQL+Server^&trusted_connection=yes
echo.

echo Step 3: Data Migration
echo ======================
echo.
echo To migrate your existing localStorage data:
echo 1. Open your QR Attendance System in a web browser
echo 2. Open Developer Tools (F12) and go to Console
echo 3. Copy and paste the contents of extract_data.js
echo 4. Download the generated JSON files
echo 5. Run: python migrate_data.py
echo.

echo Step 4: Starting the Backend Server
echo ====================================
echo.
echo To start the Python backend server:
echo 1. Make sure your database is set up and .env file is configured
echo 2. Run: python backend/main.py
echo 3. The API will be available at http://localhost:8000
echo 4. API documentation at http://localhost:8000/docs
echo.

echo Step 5: Android Integration
echo ===========================
echo.
echo For Android app integration:
echo 1. Use the REST API endpoints provided by the backend
echo 2. Implement authentication using the /auth/login endpoint
echo 3. Use Bearer token authentication for API calls
echo 4. All endpoints support JSON responses suitable for mobile apps
echo.

echo Setup completed! Check the README.md for detailed instructions.
echo.
pause
