// Simple API endpoints for Android app integration
// This file provides the API structure that your Android app will use

// API Configuration
const API_BASE_URL = window.location.origin; // Use current domain
const API_VERSION = 'v1';

// API Endpoints
const API_ENDPOINTS = {
    SUBMIT_REQUEST: `${API_BASE_URL}/api/${API_VERSION}/account-request`,
    CHECK_STATUS: `${API_BASE_URL}/api/${API_VERSION}/account-status`,
    LOGIN: `${API_BASE_URL}/api/${API_VERSION}/login`
};

// Account Request API
class AccountRequestAPI {
    
    // Submit account request from Android app
    static async submitRequest(studentData) {
        try {
            // Validate required fields
            if (!studentData.studentId || !studentData.name || !studentData.email || !studentData.password) {
                throw new Error('Missing required fields');
            }
            
            // In a real implementation, this would make an HTTP request to your backend
            // For now, we'll use the local function
            const result = submitAccountRequest(
                studentData.studentId,
                studentData.name,
                studentData.email,
                studentData.password
            );
            
            return {
                success: result.success,
                message: result.message,
                requestId: result.requestId || null
            };
            
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to submit request'
            };
        }
    }
    
    // Check account request status
    static async checkStatus(studentId) {
        try {
            const pendingRequests = JSON.parse(localStorage.getItem('pendingAccountRequests') || '[]');
            const request = pendingRequests.find(req => req.studentId === studentId);
            
            if (!request) {
                return {
                    success: false,
                    message: 'No request found for this student ID'
                };
            }
            
            return {
                success: true,
                status: request.status,
                message: `Request is ${request.status}`,
                requestId: request.id,
                submittedAt: request.requestTime,
                processedAt: request.approvedAt || request.rejectedAt
            };
            
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to check status'
            };
        }
    }
    
    // Login with approved account
    static async login(credentials) {
        try {
            const students = JSON.parse(localStorage.getItem('studentAccounts') || '[]');
            const student = students.find(s => 
                s.studentId === credentials.studentId && 
                s.password === credentials.password
            );
            
            if (!student) {
                return {
                    success: false,
                    message: 'Invalid credentials'
                };
            }
            
            return {
                success: true,
                message: 'Login successful',
                student: {
                    studentId: student.studentId,
                    name: student.studentName,
                    section: student.section,
                    email: student.email
                }
            };
            
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Login failed'
            };
        }
    }
}

// Export for use in other files
window.AccountRequestAPI = AccountRequestAPI;

// Example usage for Android app developers:
/*
// Submit account request
const studentData = {
    studentId: '2024-0001',
    name: 'John Doe',
    email: 'john.doe@email.com',
    password: 'password123'
};

AccountRequestAPI.submitRequest(studentData)
    .then(response => {
        if (response.success) {
            console.log('Request submitted:', response.message);
        } else {
            console.error('Error:', response.message);
        }
    });

// Check request status
AccountRequestAPI.checkStatus('2024-0001')
    .then(response => {
        console.log('Status:', response.status);
    });

// Login with approved account
const credentials = {
    studentId: '2024-0001',
    password: 'password123'
};

AccountRequestAPI.login(credentials)
    .then(response => {
        if (response.success) {
            console.log('Login successful:', response.student);
        } else {
            console.error('Login failed:', response.message);
        }
    });
*/


