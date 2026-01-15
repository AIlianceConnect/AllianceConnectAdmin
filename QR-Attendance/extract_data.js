// QR Attendance System - Data Extraction Script
// Extracts data from localStorage and saves to JSON files for migration

// Run this script in your browser console on the attendance system pages

function extractStudentsData() {
    try {
        const studentsData = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
        console.log('Found students:', studentsData.length);
        
        // Create downloadable JSON file
        const dataStr = JSON.stringify(studentsData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'students_data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('Students data exported to students_data.json');
        return studentsData;
    } catch (error) {
        console.error('Error extracting students data:', error);
        return [];
    }
}

function extractAttendanceData() {
    try {
        const attendanceData = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
        console.log('Found attendance records:', attendanceData.length);
        
        // Create downloadable JSON file
        const dataStr = JSON.stringify(attendanceData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'attendance_data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('Attendance data exported to attendance_data.json');
        return attendanceData;
    } catch (error) {
        console.error('Error extracting attendance data:', error);
        return [];
    }
}

function extractEventsData() {
    try {
        const attendanceData = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
        const events = new Set();
        
        attendanceData.forEach(record => {
            if (record.event) {
                events.add(record.event);
            }
        });
        
        const eventsData = Array.from(events).map(eventName => ({
            eventName: eventName,
            description: `Event: ${eventName}`,
            createdAt: new Date().toISOString()
        }));
        
        console.log('Found events:', eventsData.length);
        
        // Create downloadable JSON file
        const dataStr = JSON.stringify(eventsData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'events_data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('Events data exported to events_data.json');
        return eventsData;
    } catch (error) {
        console.error('Error extracting events data:', error);
        return [];
    }
}

function extractAllData() {
    console.log('=== QR Attendance System - Data Extraction ===');
    
    const students = extractStudentsData();
    const attendance = extractAttendanceData();
    const events = extractEventsData();
    
    console.log('\n=== Summary ===');
    console.log(`Students: ${students.length}`);
    console.log(`Attendance Records: ${attendance.length}`);
    console.log(`Events: ${events.length}`);
    
    // Create a combined summary
    const summary = {
        extractionDate: new Date().toISOString(),
        studentsCount: students.length,
        attendanceRecordsCount: attendance.length,
        eventsCount: events.length,
        students: students,
        attendanceRecords: attendance,
        events: events
    };
    
    const dataStr = JSON.stringify(summary, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'complete_data_export.json';
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('Complete data exported to complete_data_export.json');
    
    return summary;
}

// Auto-run the extraction
console.log('QR Attendance System Data Extraction Tool');
console.log('==========================================');
console.log('Available functions:');
console.log('- extractStudentsData() - Extract students data');
console.log('- extractAttendanceData() - Extract attendance records');
console.log('- extractEventsData() - Extract events data');
console.log('- extractAllData() - Extract all data');
console.log('');
console.log('Running complete extraction...');
extractAllData();
