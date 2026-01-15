-- QR Attendance System Database Setup for SQL Server
-- Compatible with SSMS 21 and Android integration

-- Create database (uncomment if creating new database)
-- CREATE DATABASE QR_Attendance_System;
-- USE QR_Attendance_System;

-- Create Students table
CREATE TABLE Students (
    StudentID NVARCHAR(50) PRIMARY KEY,
    StudentName NVARCHAR(255) NOT NULL,
    Section NVARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Create Events table
CREATE TABLE Events (
    EventID INT IDENTITY(1,1) PRIMARY KEY,
    EventName NVARCHAR(255) NOT NULL UNIQUE,
    EventDescription NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Create Attendance Records table
CREATE TABLE AttendanceRecords (
    RecordID INT IDENTITY(1,1) PRIMARY KEY,
    StudentID NVARCHAR(50) NOT NULL,
    EventID INT NOT NULL,
    AttendanceDate DATE NOT NULL,
    TimeIn DATETIME2,
    TimeOut DATETIME2,
    CheckInMs BIGINT, -- For sorting purposes
    LastUpdateMs BIGINT, -- For sorting purposes
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (StudentID) REFERENCES Students(StudentID),
    FOREIGN KEY (EventID) REFERENCES Events(EventID),
    UNIQUE(StudentID, EventID, AttendanceDate) -- One record per student per event per day
);

-- Create indexes for better performance
CREATE INDEX IX_AttendanceRecords_StudentID ON AttendanceRecords(StudentID);
CREATE INDEX IX_AttendanceRecords_EventID ON AttendanceRecords(EventID);
CREATE INDEX IX_AttendanceRecords_Date ON AttendanceRecords(AttendanceDate);
CREATE INDEX IX_AttendanceRecords_StudentEventDate ON AttendanceRecords(StudentID, EventID, AttendanceDate);

-- Create Users table for authentication (for Android app)
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(255),
    Role NVARCHAR(50) DEFAULT 'admin', -- admin, teacher, student
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Create API Keys table for Android app authentication
CREATE TABLE APIKeys (
    KeyID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    APIKey NVARCHAR(255) NOT NULL UNIQUE,
    KeyName NVARCHAR(100),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    ExpiresAt DATETIME2,
    IsActive BIT DEFAULT 1,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

-- Insert default admin user
INSERT INTO Users (Username, PasswordHash, FullName, Role) 
VALUES ('admin', 'admin123', 'System Administrator', 'admin');

-- Create views for easier data access
CREATE VIEW vw_AttendanceSummary AS
SELECT 
    ar.RecordID,
    s.StudentID,
    s.StudentName,
    s.Section,
    e.EventName,
    ar.AttendanceDate,
    ar.TimeIn,
    ar.TimeOut,
    CASE 
        WHEN ar.TimeOut IS NOT NULL THEN 
            DATEDIFF(MINUTE, ar.TimeIn, ar.TimeOut)
        ELSE NULL 
    END AS DurationMinutes,
    ar.CreatedAt,
    ar.UpdatedAt
FROM AttendanceRecords ar
INNER JOIN Students s ON ar.StudentID = s.StudentID
INNER JOIN Events e ON ar.EventID = e.EventID
WHERE s.IsActive = 1 AND e.IsActive = 1;

-- Create stored procedures for common operations

-- Procedure to mark attendance
CREATE PROCEDURE sp_MarkAttendance
    @StudentID NVARCHAR(50),
    @EventName NVARCHAR(255),
    @AttendanceDate DATE = NULL,
    @TimeIn DATETIME2 = NULL,
    @TimeOut DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Set default values
    IF @AttendanceDate IS NULL SET @AttendanceDate = CAST(GETDATE() AS DATE);
    IF @TimeIn IS NULL SET @TimeIn = GETDATE();
    
    -- Get EventID
    DECLARE @EventID INT;
    SELECT @EventID = EventID FROM Events WHERE EventName = @EventName AND IsActive = 1;
    
    IF @EventID IS NULL
    BEGIN
        -- Create event if it doesn't exist
        INSERT INTO Events (EventName) VALUES (@EventName);
        SET @EventID = SCOPE_IDENTITY();
    END
    
    -- Check if student exists
    IF NOT EXISTS (SELECT 1 FROM Students WHERE StudentID = @StudentID AND IsActive = 1)
    BEGIN
        RAISERROR('Student not found: %s', 16, 1, @StudentID);
        RETURN;
    END
    
    -- Check if record exists
    IF EXISTS (SELECT 1 FROM AttendanceRecords WHERE StudentID = @StudentID AND EventID = @EventID AND AttendanceDate = @AttendanceDate)
    BEGIN
        -- Update existing record
        IF @TimeOut IS NOT NULL
        BEGIN
            UPDATE AttendanceRecords 
            SET TimeOut = @TimeOut, 
                LastUpdateMs = DATEDIFF_BIG(MILLISECOND, '1970-01-01', GETDATE()),
                UpdatedAt = GETDATE()
            WHERE StudentID = @StudentID AND EventID = @EventID AND AttendanceDate = @AttendanceDate;
        END
        ELSE
        BEGIN
            UPDATE AttendanceRecords 
            SET TimeIn = @TimeIn,
                LastUpdateMs = DATEDIFF_BIG(MILLISECOND, '1970-01-01', GETDATE()),
                UpdatedAt = GETDATE()
            WHERE StudentID = @StudentID AND EventID = @EventID AND AttendanceDate = @AttendanceDate;
        END
    END
    ELSE
    BEGIN
        -- Insert new record
        INSERT INTO AttendanceRecords (StudentID, EventID, AttendanceDate, TimeIn, TimeOut, CheckInMs, LastUpdateMs)
        VALUES (@StudentID, @EventID, @AttendanceDate, @TimeIn, @TimeOut, 
                DATEDIFF_BIG(MILLISECOND, '1970-01-01', GETDATE()),
                DATEDIFF_BIG(MILLISECOND, '1970-01-01', GETDATE()));
    END
    
    -- Return the record
    SELECT * FROM vw_AttendanceSummary 
    WHERE StudentID = @StudentID AND EventName = @EventName AND AttendanceDate = @AttendanceDate;
END;

-- Procedure to get attendance by event
CREATE PROCEDURE sp_GetAttendanceByEvent
    @EventName NVARCHAR(255),
    @AttendanceDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @AttendanceDate IS NULL SET @AttendanceDate = CAST(GETDATE() AS DATE);
    
    SELECT * FROM vw_AttendanceSummary 
    WHERE EventName = @EventName 
    AND (@AttendanceDate IS NULL OR AttendanceDate = @AttendanceDate)
    ORDER BY 
        CASE WHEN TimeOut IS NULL THEN 0 ELSE 1 END, -- Active records first
        LastUpdateMs DESC;
END;

-- Procedure to get students by section
CREATE PROCEDURE sp_GetStudentsBySection
    @Section NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT StudentID, StudentName, Section, CreatedAt, UpdatedAt
    FROM Students 
    WHERE Section = @Section AND IsActive = 1
    ORDER BY StudentName;
END;

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Students TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON Events TO [YourAppUser];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON AttendanceRecords TO [YourAppUser];
-- GRANT EXECUTE ON sp_MarkAttendance TO [YourAppUser];
-- GRANT EXECUTE ON sp_GetAttendanceByEvent TO [YourAppUser];
-- GRANT EXECUTE ON sp_GetStudentsBySection TO [YourAppUser];

PRINT 'QR Attendance System database setup completed successfully!';
PRINT 'Default admin user created: username=admin, password=admin123';
PRINT 'Remember to change the default password and create appropriate database users.';
