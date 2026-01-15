// Student account management system
let students = [];
let pendingRequests = [];
let studentNumbersDatabase = []; // This will store student numbers for validation
let firebaseService = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Firebase service
    const firebaseReady = await initializeFirebaseService();
    
    // Load data from Firebase
    await loadDataFromFirebase();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize the interface
    updateStudentTable();
    updateSectionDropdown();
    updatePendingRequestsTable();
    
    // Set status display
    document.getElementById('statusDisplay').textContent = firebaseReady ? 'Ready (Firebase)' : 'Ready (Local Storage)';
    
    // Add global test functions
    window.testFirebase = testFirebase;
    window.debugPendingRequests = debugPendingRequests;
});

// Global test function
async function testFirebase() {
    console.log('=== FIREBASE TEST ===');
    console.log('Firebase service available:', !!firebaseService);
    console.log('Window accountsFirebaseService:', !!window.accountsFirebaseService);
    
    if (firebaseService) {
        try {
            const requests = await firebaseService.getPendingRequests();
            console.log('Direct Firebase call - Pending requests:', requests.length);
            console.log('Requests data:', requests);
            return requests;
        } catch (error) {
            console.error('Direct Firebase call error:', error);
            return null;
        }
    } else {
        console.log('No Firebase service available');
        return null;
    }
}

// Debug pending requests
function debugPendingRequests() {
    console.log('=== PENDING REQUESTS DEBUG ===');
    console.log('pendingRequests array length:', pendingRequests.length);
    console.log('pendingRequests data:', pendingRequests);
    console.log('Firebase service available:', !!firebaseService);
    updatePendingRequestsTable();
}

// Format Firebase timestamp for display
function formatFirebaseTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        // Handle Firebase Timestamp objects
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000).toLocaleString();
        }
        // Handle regular Date objects or ISO strings
        return new Date(timestamp).toLocaleString();
    } catch (error) {
        console.error('Error formatting timestamp:', error, timestamp);
        return 'Invalid Date';
    }
}

// Initialize Firebase service
async function initializeFirebaseService() {
    console.log('Initializing Firebase service...');
    return new Promise((resolve) => {
        // Wait for Firebase service to be available
        const checkService = setInterval(() => {
            if (window.accountsFirebaseService) {
                clearInterval(checkService);
                firebaseService = window.accountsFirebaseService;
                console.log('Firebase service initialized for Accounts');
                resolve(true);
            } else {
                console.log('Waiting for Firebase service...');
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(() => {
            clearInterval(checkService);
            if (!firebaseService) {
                console.error('Firebase service not available, falling back to localStorage');
            }
            resolve(false);
        }, 10000);
    });
}

// Load data from Firebase
async function loadDataFromFirebase() {
    console.log('loadDataFromFirebase called, firebaseService:', !!firebaseService);
    
    if (firebaseService) {
        try {
            console.log('Loading data from Firebase...');
            students = await firebaseService.getStudentAccounts();
            pendingRequests = await firebaseService.getPendingRequests();
            studentNumbersDatabase = await firebaseService.getStudentNumbers();
            
            console.log('Firebase data loaded:', {
                students: students.length,
                pendingRequests: pendingRequests.length,
                studentNumbers: studentNumbersDatabase.length
            });
            
            // Set up real-time listeners
            firebaseService.listenToStudentAccounts((accounts) => {
                console.log('Student accounts updated:', accounts.length);
                students = accounts;
                updateStudentTable();
                updateSectionDropdown();
            });
            
            firebaseService.listenToPendingRequests((requests) => {
                console.log('Pending requests updated:', requests.length);
                pendingRequests = requests;
                updatePendingRequestsTable();
            });
            
            firebaseService.listenToStudentNumbers((numbers) => {
                console.log('Student numbers updated:', numbers.length);
                studentNumbersDatabase = numbers;
            });
            
            console.log('Data loaded from Firebase successfully');
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
            // Fallback to localStorage
            loadStudents();
            loadPendingRequests();
            loadStudentNumbersDatabase();
        }
    } else {
        console.log('Firebase service not available, using localStorage fallback');
        // Fallback to localStorage
        loadStudents();
        loadPendingRequests();
        loadStudentNumbersDatabase();
    }
}

// Load students from localStorage
function loadStudents() {
    const storedStudents = localStorage.getItem('studentAccounts');
    students = storedStudents ? JSON.parse(storedStudents) : [];
}

// Save students to Firebase or localStorage
async function saveStudents() {
    if (firebaseService) {
        // Data is automatically saved through real-time listeners
        console.log('Students data is managed by Firebase real-time listeners');
    } else {
        localStorage.setItem('studentAccounts', JSON.stringify(students));
    }
}

// Load pending requests from localStorage (fallback)
function loadPendingRequests() {
    const storedRequests = localStorage.getItem('pendingAccountRequests');
    pendingRequests = storedRequests ? JSON.parse(storedRequests) : [];
}

// Save pending requests to Firebase or localStorage
async function savePendingRequests() {
    if (firebaseService) {
        // Data is automatically saved through real-time listeners
        console.log('Pending requests data is managed by Firebase real-time listeners');
    } else {
        localStorage.setItem('pendingAccountRequests', JSON.stringify(pendingRequests));
    }
}

// Load student numbers database for validation (fallback)
function loadStudentNumbersDatabase() {
    const storedNumbers = localStorage.getItem('studentNumbersDatabase');
    studentNumbersDatabase = storedNumbers ? JSON.parse(storedNumbers) : [];
}

// Setup event listeners
function setupEventListeners() {
    // Add student form
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', handleAddStudent);
    }
    
    // Edit student form
    const editStudentForm = document.getElementById('editStudentForm');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', handleEditStudent);
    }
    
    // Refresh data button
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // Export data button
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // Import data button
    const importBtn = document.getElementById('importData');
    if (importBtn) {
        importBtn.addEventListener('click', importData);
    }
    
    // Section dropdown
    const sectionDropdown = document.getElementById('sectionDropdown');
    if (sectionDropdown) {
        sectionDropdown.addEventListener('change', updateStudentListBySection);
    }
    
    // Section filter
    const sectionFilter = document.getElementById('sectionFilter');
    if (sectionFilter) {
        sectionFilter.addEventListener('change', updateStudentTable);
    }
}

// Handle add student form submission
function handleAddStudent(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('studentId').value.trim();
    const studentName = document.getElementById('studentName').value.trim();
    const course = document.querySelector('input[name="course"]:checked').value;
    const yearSection = document.getElementById('yearSection').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    if (!studentId || !studentName || !course || !yearSection) {
        showToast('Error', 'Please fill in all required fields', 'error');
        return;
    }
    
    // Check if student already exists
    const existingStudent = students.find(s => s.studentId === studentId);
    if (existingStudent) {
        showToast('Error', 'Student with this ID already exists', 'error');
        return;
    }
    
    const section = `${course} ${yearSection}`;
    const newStudent = {
        studentId,
        studentName,
        section,
        email,
        phone,
        createdAt: new Date().toISOString()
    };
    
    students.push(newStudent);
    saveStudents();
    
    // Clear form
    document.getElementById('addStudentForm').reset();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
    if (modal) modal.hide();
    
    // Update interface
    updateStudentTable();
    updateSectionDropdown();
    
    showToast('Success', `Student ${studentName} added successfully`, 'success');
}

// Refresh data
function refreshData() {
    loadStudents();
    loadPendingRequests();
    loadAttendanceRecords();
    updateStudentTable();
    updateSectionDropdown();
    updatePendingRequestsTable();
    showToast('Info', 'Data refreshed successfully', 'success');
}

// Refresh pending requests specifically
function refreshPendingRequests() {
    console.log('Manual refresh triggered');
    if (firebaseService) {
        console.log('Using Firebase refresh');
        firebaseService.getPendingRequests().then(requests => {
            console.log('Manual Firebase refresh got requests:', requests.length);
            pendingRequests = requests;
            updatePendingRequestsTable();
            showToast('Info', 'Pending requests refreshed from Firebase', 'success');
        }).catch(error => {
            console.error('Manual Firebase refresh error:', error);
            showToast('Error', 'Failed to refresh from Firebase', 'error');
        });
    } else {
        console.log('Using localStorage refresh');
        loadPendingRequests();
        updatePendingRequestsTable();
        showToast('Info', 'Pending requests refreshed from localStorage', 'success');
    }
}

// Export data to Excel
function exportData() {
    if (students.length === 0) {
        showToast('Warning', 'No students to export', 'warning');
        return;
    }
    
    // Import XLSX library if available
    if (typeof XLSX === 'undefined') {
        showToast('Error', 'Export functionality requires XLSX library', 'error');
        return;
    }
    
    const exportData = students.map((student, idx) => ({
        '#': idx + 1,
        'Student#': student.studentId,
        'Name': student.studentName,
        'Section': student.section,
        'Email': student.email || '',
        'Phone': student.phone || '',
        'Created': new Date(student.createdAt).toLocaleDateString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student Accounts');
    
    const fileName = `Student_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast('Success', 'Data exported successfully', 'success');
}

// Import data from Excel (placeholder)
function importData() {
    showToast('Info', 'Import functionality will be implemented with Firebase integration', 'warning');
}

// Update student table
function updateStudentTable() {
    const tbody = document.getElementById('studentRecords');
    if (!tbody) return;
    
    let filteredStudents = students;
    const sectionFilter = document.getElementById('sectionFilter');
    const selectedSection = sectionFilter ? sectionFilter.value : 'all';
    
    if (selectedSection !== 'all') {
        filteredStudents = students.filter(s => s.section === selectedSection);
    }
    
    tbody.innerHTML = '';
    filteredStudents.forEach((student, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${student.studentId}</td>
            <td>${student.studentName}</td>
            <td>${student.section}</td>
            <td>${student.email || '-'}</td>
            <td>${student.phone || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editStudent('${student.studentId}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${student.studentId}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update section dropdown
function updateSectionDropdown() {
    const dropdown = document.getElementById('sectionDropdown');
    const filter = document.getElementById('sectionFilter');
    
    if (!dropdown || !filter) return;
    
    const sections = [...new Set(students.map(s => s.section))].sort();
    
    // Update section dropdown
    dropdown.innerHTML = '';
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        dropdown.appendChild(option);
    });
    
    // Update section filter
    filter.innerHTML = '<option value="all">All Sections</option>';
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        filter.appendChild(option);
    });
    
    // Update student list by section
    if (sections.length > 0) {
        updateStudentListBySection();
    }
}

// Update student list by section
function updateStudentListBySection() {
    const tbody = document.getElementById('studentListBySection');
    const dropdown = document.getElementById('sectionDropdown');
    
    if (!tbody || !dropdown) return;
    
    const selectedSection = dropdown.value;
    const sectionStudents = students.filter(s => s.section === selectedSection);
    
    tbody.innerHTML = '';
    sectionStudents.forEach((student, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${student.studentId}</td>
            <td>${student.studentName}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editStudent('${student.studentId}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${student.studentId}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Helper function to parse section string (e.g., "BSAIS 3-3" or "BSAIS")
function parseSection(sectionStr) {
    if (!sectionStr) return { course: '', yearSection: '' };
    
    const section = String(sectionStr).trim();
    
    // Try to match patterns like "BSAIS 3-3", "BSIS-AIS 1-2", etc.
    const match = section.match(/^([A-Z]+(?:-[A-Z]+)?)\s+(\d+-\d+)$/i);
    
    if (match) {
        return {
            course: match[1].toUpperCase(),
            yearSection: match[2]
        };
    }
    
    // If no match, check if it's just a course name
    const courseMatch = section.match(/^(BSIS-AIS|BSAIS|BSIT|BSCS|Other)$/i);
    if (courseMatch) {
        return {
            course: courseMatch[1],
            yearSection: ''
        };
    }
    
    // Default: try to extract course from beginning
    const courseExtract = section.match(/^([A-Z]+(?:-[A-Z]+)?)/i);
    return {
        course: courseExtract ? courseExtract[1].toUpperCase() : '',
        yearSection: section.replace(/^[A-Z]+(?:-[A-Z]+)?\s*/i, '').trim()
    };
}

// Edit student
function editStudent(studentId) {
    const student = students.find(s => s.studentId === studentId);
    if (!student) {
        showToast('Error', 'Student not found', 'error');
        return;
    }
    
    // Parse section to get course and yearSection
    const { course, yearSection } = parseSection(student.section);
    
    // Populate edit form
    document.getElementById('editOriginalStudentId').value = student.studentId;
    document.getElementById('editStudentId').value = student.studentId;
    document.getElementById('editStudentName').value = student.studentName;
    document.getElementById('editYearSection').value = yearSection;
    document.getElementById('editEmail').value = student.email || '';
    document.getElementById('editPhone').value = student.phone || '';
    
    // Set course radio button
    if (course) {
        const courseRadio = document.querySelector(`input[name="editCourse"][value="${course}"]`);
        if (courseRadio) {
            courseRadio.checked = true;
        } else {
            // Default to BSIS-AIS if course not found
            document.getElementById('editCourseBsisAis').checked = true;
        }
    } else {
        document.getElementById('editCourseBsisAis').checked = true;
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
    modal.show();
}

// Handle edit student form submission
async function handleEditStudent(e) {
    e.preventDefault();
    
    const originalStudentId = document.getElementById('editOriginalStudentId').value;
    const studentId = document.getElementById('editStudentId').value.trim();
    const studentName = document.getElementById('editStudentName').value.trim();
    const course = document.querySelector('input[name="editCourse"]:checked')?.value || '';
    const yearSection = document.getElementById('editYearSection').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    
    if (!studentId || !studentName || !course || !yearSection) {
        showToast('Error', 'Please fill in all required fields', 'error');
        return;
    }
    
    // Check if student ID already exists (excluding current one)
    const existingStudent = students.find(s => s.studentId === studentId && s.studentId !== originalStudentId);
    if (existingStudent) {
        showToast('Error', 'Student with this ID already exists', 'error');
        return;
    }
    
    const section = `${course} ${yearSection}`;
    const updateData = {
        studentId,
        studentName,
        section,
        email,
        phone,
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (firebaseService) {
            // Find the student to get its Firebase document ID
            const originalStudent = students.find(s => s.studentId === originalStudentId);
            if (!originalStudent || !originalStudent.id) {
                showToast('Error', 'Student not found in database', 'error');
                return;
            }
            
            // If studentId changed, we need to delete old and create new document
            if (studentId !== originalStudentId) {
                // Check if new studentId already exists
                const existingStudent = students.find(s => s.studentId === studentId);
                if (existingStudent) {
                    showToast('Error', 'Student with this ID already exists', 'error');
                    return;
                }
                
                // Delete old document using its Firebase document ID
                await firebaseService.deleteStudentAccount(originalStudent.id);
                // Create new document with new studentId
                await firebaseService.addStudentAccount(updateData);
            } else {
                // Just update the existing document using its Firebase document ID
                await firebaseService.updateStudentAccount(originalStudent.id, updateData);
            }
        } else {
            // Fallback to localStorage
            const studentIndex = students.findIndex(s => s.studentId === originalStudentId);
            if (studentIndex === -1) {
                showToast('Error', 'Student not found', 'error');
                return;
            }
            
            // If studentId changed, remove old and add new
            if (studentId !== originalStudentId) {
                students = students.filter(s => s.studentId !== originalStudentId);
                students.push(updateData);
            } else {
                students[studentIndex] = {
                    ...students[studentIndex],
                    ...updateData
                };
            }
            
            saveStudents();
            
            // Update interface
            updateStudentTable();
            updateSectionDropdown();
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
        if (modal) modal.hide();
        
        showToast('Success', `Student ${studentName} updated successfully`, 'success');
        
    } catch (error) {
        console.error('Error updating student:', error);
        showToast('Error', 'Failed to update student', 'error');
    }
}

// Delete student
function deleteStudent(studentId) {
    const student = students.find(s => s.studentId === studentId);
    if (!student) return;
    
    if (confirm(`Are you sure you want to delete student ${student.studentName} (${studentId})?`)) {
        students = students.filter(s => s.studentId !== studentId);
        saveStudents();
        updateStudentTable();
        updateSectionDropdown();
        showToast('Success', `Student ${student.studentName} deleted successfully`, 'success');
    }
}

// Update all request tables
function updatePendingRequestsTable() {
    console.log('Updating request tables. Total requests:', pendingRequests.length);
    console.log('Pending requests:', pendingRequests.filter(req => req.status === 'pending').length);
    
    updatePendingRequestsTab();
    updateApprovedRequestsTab();
    updateRejectedRequestsTab();
    updateRequestCounts();
}

// Update pending requests tab
function updatePendingRequestsTab() {
    const tbody = document.getElementById('pendingRequestsTable');
    if (!tbody) return;
    
    const pendingRequestsList = pendingRequests.filter(req => req.status === 'pending');
    tbody.innerHTML = '';
    
    if (pendingRequestsList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted">No pending requests</td>';
        tbody.appendChild(row);
        return;
    }
    
    // Sort by request time (newest first)
    const sortedRequests = pendingRequestsList.sort((a, b) => new Date(b.requestTime) - new Date(a.requestTime));
    
    sortedRequests.forEach((request, idx) => {
        const row = document.createElement('tr');
        const requestTime = formatFirebaseTimestamp(request.requestTime);
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${request.studentId}</td>
            <td>${request.name}</td>
            <td>${request.email}</td>
            <td>${requestTime}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="approveRequest('${request.id}')">Approve</button>
                <button class="btn btn-sm btn-danger" onclick="rejectRequest('${request.id}')">Reject</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update approved requests tab
function updateApprovedRequestsTab() {
    const tbody = document.getElementById('approvedRequestsTable');
    if (!tbody) return;
    
    const approvedRequestsList = pendingRequests.filter(req => req.status === 'approved');
    tbody.innerHTML = '';
    
    if (approvedRequestsList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted">No approved requests</td>';
        tbody.appendChild(row);
        return;
    }
    
    // Sort by approval time (newest first)
    const sortedRequests = approvedRequestsList.sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
    
    sortedRequests.forEach((request, idx) => {
        const row = document.createElement('tr');
        const requestTime = formatFirebaseTimestamp(request.requestTime);
        const approvedTime = formatFirebaseTimestamp(request.approvedAt);
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${request.studentId}</td>
            <td>${request.name}</td>
            <td>${request.email}</td>
            <td>${requestTime}</td>
            <td>${approvedTime}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update rejected requests tab
function updateRejectedRequestsTab() {
    const tbody = document.getElementById('rejectedRequestsTable');
    if (!tbody) return;
    
    const rejectedRequestsList = pendingRequests.filter(req => req.status === 'rejected');
    tbody.innerHTML = '';
    
    if (rejectedRequestsList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center text-muted">No rejected requests</td>';
        tbody.appendChild(row);
        return;
    }
    
    // Sort by rejection time (newest first)
    const sortedRequests = rejectedRequestsList.sort((a, b) => new Date(b.rejectedAt) - new Date(a.rejectedAt));
    
    sortedRequests.forEach((request, idx) => {
        const row = document.createElement('tr');
        const requestTime = formatFirebaseTimestamp(request.requestTime);
        const rejectedTime = formatFirebaseTimestamp(request.rejectedAt);
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${request.studentId}</td>
            <td>${request.name}</td>
            <td>${request.email}</td>
            <td>${requestTime}</td>
            <td>${rejectedTime}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="resubmitRequest('${request.id}')">Resubmit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update request counts in tabs and header
function updateRequestCounts() {
    const pendingCount = pendingRequests.filter(req => req.status === 'pending').length;
    const approvedCount = pendingRequests.filter(req => req.status === 'approved').length;
    const rejectedCount = pendingRequests.filter(req => req.status === 'rejected').length;
    
    console.log('Counts - Pending:', pendingCount, 'Approved:', approvedCount, 'Rejected:', rejectedCount);
    
    // Update tab badges
    const pendingTabBadge = document.getElementById('pendingCount');
    const approvedTabBadge = document.getElementById('approvedCount');
    const rejectedTabBadge = document.getElementById('rejectedCount');
    const headerBadge = document.getElementById('pendingRequestsBadge');
    const headerCountSpan = document.getElementById('headerPendingCount');
    
    console.log('Elements found:', {
        pendingTabBadge: !!pendingTabBadge,
        approvedTabBadge: !!approvedTabBadge,
        rejectedTabBadge: !!rejectedTabBadge,
        headerBadge: !!headerBadge,
        headerCountSpan: !!headerCountSpan
    });
    
    if (pendingTabBadge) {
        pendingTabBadge.textContent = pendingCount;
        console.log('Updated pending tab badge to:', pendingCount);
    }
    if (approvedTabBadge) approvedTabBadge.textContent = approvedCount;
    if (rejectedTabBadge) rejectedTabBadge.textContent = rejectedCount;
    if (headerBadge) headerBadge.textContent = pendingCount;
    if (headerCountSpan) {
        headerCountSpan.textContent = pendingCount;
        console.log('Updated header count to:', pendingCount);
    }
}

// Get status badge HTML
function getStatusBadge(status) {
    switch(status) {
        case 'pending':
            return '<span class="badge bg-warning">Pending</span>';
        case 'approved':
            return '<span class="badge bg-success">Approved</span>';
        case 'rejected':
            return '<span class="badge bg-danger">Rejected</span>';
        default:
            return '<span class="badge bg-secondary">Unknown</span>';
    }
}

// Approve account request
async function approveRequest(requestId) {
    const request = pendingRequests.find(req => req.id === requestId);
    if (!request) return;
    
    try {
        // Check if student number exists in student numbers database
        const studentRecord = studentNumbersDatabase.find(record => record.studentId === request.studentId);
        
        if (!studentRecord) {
            showToast('Error', `Student ${request.studentId} not found in student numbers database. Please add the student number first.`, 'error');
            return;
        }
        
        // Check if student already has an account
        const existingAccount = students.find(s => s.studentId === request.studentId);
        if (existingAccount) {
            showToast('Error', `Student ${request.studentId} already has an account`, 'error');
            return;
        }
        
        // Use the student's information from the database
        const section = studentRecord.section || '';
        const studentName = studentRecord.studentName; // Use the name from database instead of request
        
        // Create student account
        const newStudent = {
            studentId: request.studentId,
            studentName: studentName,
            section: section,
            email: request.email,
            password: request.password, // Note: In production, this should be hashed
            approvedBy: 'Admin', // You can modify this to track who approved
        };
        
        if (firebaseService) {
            // Add to Firebase
            await firebaseService.addStudentAccount(newStudent);
            
            // Update request status in Firebase
            await firebaseService.updatePendingRequest(requestId, {
                status: 'approved',
                approvedAt: new Date(),
                approvedBy: 'Admin'
            });
        } else {
            // Fallback to localStorage
            newStudent.createdAt = new Date().toISOString();
            newStudent.approvedAt = new Date().toISOString();
            students.push(newStudent);
            saveStudents();
            
            // Update request status
            request.status = 'approved';
            request.approvedAt = new Date().toISOString();
            savePendingRequests();
            
            // Update UI
            updateStudentTable();
            updateSectionDropdown();
            updatePendingRequestsTable();
        }
        
        showToast('Success', `Account approved for ${studentName} (${request.studentId})`, 'success');
        
    } catch (error) {
        console.error('Error approving request:', error);
        showToast('Error', 'Failed to approve account request', 'error');
    }
}

// Reject account request
function rejectRequest(requestId) {
    const request = pendingRequests.find(req => req.id === requestId);
    if (!request) return;
    
    if (confirm(`Are you sure you want to reject the account request for ${request.name} (${request.studentId})?`)) {
        request.status = 'rejected';
        request.rejectedAt = new Date().toISOString();
        savePendingRequests();
        
        updatePendingRequestsTable();
        showToast('Info', `Account request rejected for ${request.name} (${request.studentId})`, 'warning');
    }
}

// Resubmit rejected request
function resubmitRequest(requestId) {
    const request = pendingRequests.find(req => req.id === requestId);
    if (!request) return;
    
    if (confirm(`Are you sure you want to resubmit the account request for ${request.name} (${request.studentId})?`)) {
        // Create a new request with the same data
        const newRequest = {
            id: generateRequestId(),
            studentId: request.studentId,
            name: request.name,
            email: request.email,
            password: request.password,
            status: 'pending',
            requestTime: new Date().toISOString()
        };
        
        // Add the new request
        pendingRequests.push(newRequest);
        savePendingRequests();
        
        // Update UI
        updatePendingRequestsTable();
        
        showToast('Success', `Account request resubmitted for ${request.name} (${request.studentId})`, 'success');
    }
}

// API endpoint for Android app to submit account requests
// This would be called by your Android app
function submitAccountRequest(studentId, name, email, password) {
    // Check if request already exists
    const existingRequest = pendingRequests.find(req => req.studentId === studentId && req.status === 'pending');
    if (existingRequest) {
        return { success: false, message: 'Account request already pending' };
    }
    
    // Check if student already has an account
    const existingAccount = students.find(s => s.studentId === studentId);
    if (existingAccount) {
        return { success: false, message: 'Student already has an account' };
    }
    
    // Create new request
    const newRequest = {
        id: generateRequestId(),
        studentId: studentId,
        name: name,
        email: email,
        password: password,
        status: 'pending',
        requestTime: new Date().toISOString()
    };
    
    pendingRequests.push(newRequest);
    savePendingRequests();
    updatePendingRequestsTable();
    
    return { success: true, message: 'Account request submitted successfully' };
}

// Generate unique request ID
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Simulate Android app request (for testing)
function simulateAndroidRequest() {
    const testRequests = [
        { studentId: '2024-0001', name: 'John Doe', email: 'john.doe@email.com', password: 'password123' },
        { studentId: '2024-0002', name: 'Jane Smith', email: 'jane.smith@email.com', password: 'password456' }
    ];
    
    testRequests.forEach(req => {
        submitAccountRequest(req.studentId, req.name, req.email, req.password);
    });
    
    showToast('Info', 'Test requests added', 'success');
}

// Toast helper
function showToast(title, message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-title">${title}</span>
        <span>${message || ''}</span>
        <button class="toast-close" aria-label="Close">×</button>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // Auto dismiss
    const remove = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 180);
    };
    
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) closeBtn.addEventListener('click', remove);
    
    setTimeout(remove, 3000);
}
