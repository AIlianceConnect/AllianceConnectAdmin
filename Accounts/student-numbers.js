// Student Numbers Management System
let studentNumbers = [];
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
    updateStudentNumbersTable();
    updateSectionFilter();
    updateTotalCount();
    
    // Set status display
    document.getElementById('statusDisplay').textContent = firebaseReady ? 'Ready (Firebase)' : 'Ready (Local Storage)';
    
    // Add global test functions
    window.testStudentNumbersFirebase = testStudentNumbersFirebase;
    window.debugStudentNumbers = debugStudentNumbers;
});

// Global test function
async function testStudentNumbersFirebase() {
    console.log('=== STUDENT NUMBERS FIREBASE TEST ===');
    console.log('Firebase service available:', !!firebaseService);
    console.log('Window accountsFirebaseService:', !!window.accountsFirebaseService);
    
    if (firebaseService) {
        try {
            const numbers = await firebaseService.getStudentNumbers();
            console.log('Direct Firebase call - Student numbers:', numbers.length);
            console.log('Numbers data:', numbers);
            return numbers;
        } catch (error) {
            console.error('Direct Firebase call error:', error);
            return null;
        }
    } else {
        console.log('No Firebase service available');
        return null;
    }
}

// Debug student numbers
function debugStudentNumbers() {
    console.log('=== STUDENT NUMBERS DEBUG ===');
    console.log('studentNumbers array length:', studentNumbers.length);
    console.log('studentNumbers data:', studentNumbers);
    console.log('Firebase service available:', !!firebaseService);
    updateStudentNumbersTable();
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
    console.log('Initializing Firebase service for Student Numbers...');
    return new Promise((resolve) => {
        // Wait for Firebase service to be available
        const checkService = setInterval(() => {
            if (window.accountsFirebaseService) {
                clearInterval(checkService);
                firebaseService = window.accountsFirebaseService;
                console.log('Firebase service initialized for Student Numbers');
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
            console.log('Loading student numbers from Firebase...');
            studentNumbers = await firebaseService.getStudentNumbers();
            
            console.log('Firebase data loaded:', {
                studentNumbers: studentNumbers.length
            });
            
            // Set up real-time listener
            firebaseService.listenToStudentNumbers((numbers) => {
                console.log('Student numbers updated:', numbers.length);
                studentNumbers = numbers;
                updateStudentNumbersTable();
                updateSectionFilter();
                updateTotalCount();
            });
            
            console.log('Student numbers loaded from Firebase successfully');
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
            // Fallback to localStorage
            loadStudentNumbers();
        }
    } else {
        console.log('Firebase service not available, using localStorage fallback');
        // Fallback to localStorage
        loadStudentNumbers();
    }
}

// Load student numbers from localStorage
function loadStudentNumbers() {
    const storedNumbers = localStorage.getItem('studentNumbersDatabase');
    studentNumbers = storedNumbers ? JSON.parse(storedNumbers) : [];
}

// Save student numbers to localStorage
function saveStudentNumbers() {
    localStorage.setItem('studentNumbersDatabase', JSON.stringify(studentNumbers));
}

// Setup event listeners
function setupEventListeners() {
    // Add student number form
    const addForm = document.getElementById('addStudentNumberForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddStudentNumber);
    }
    
    // Edit student number form
    const editForm = document.getElementById('editStudentNumberForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditStudentNumber);
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchStudentNumbers');
    if (searchInput) {
        searchInput.addEventListener('input', updateStudentNumbersTable);
    }
    
    // Section filter
    const sectionFilter = document.getElementById('sectionFilter');
    if (sectionFilter) {
        sectionFilter.addEventListener('change', updateStudentNumbersTable);
    }
}

// Handle add student number form submission
async function handleAddStudentNumber(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('newStudentId').value.trim();
    const studentName = document.getElementById('newStudentName').value.trim();
    const course = document.getElementById('newCourse').value;
    const yearSection = document.getElementById('newYearSection').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const phone = document.getElementById('newPhone').value.trim();
    
    if (!studentId || !studentName) {
        showToast('Error', 'Please fill in Student Number and Name', 'error');
        return;
    }
    
    // Check if student number already exists
    const existingStudent = studentNumbers.find(s => s.studentId === studentId);
    if (existingStudent) {
        showToast('Error', 'Student number already exists', 'error');
        return;
    }
    
    const section = course && yearSection ? `${course} ${yearSection}` : '';
    const newStudent = {
        studentId,
        studentName,
        section,
        course,
        yearSection,
        email,
        phone,
        addedBy: 'Admin' // You can modify this to track who added
    };
    
    try {
        if (firebaseService) {
            // Add to Firebase
            await firebaseService.addStudentNumber(newStudent);
        } else {
            // Fallback to localStorage
            newStudent.addedAt = new Date().toISOString();
            studentNumbers.push(newStudent);
            saveStudentNumbers();
            
            // Update interface
            updateStudentNumbersTable();
            updateSectionFilter();
            updateTotalCount();
        }
        
        // Clear form
        document.getElementById('addStudentNumberForm').reset();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentNumberModal'));
        if (modal) modal.hide();
        
        showToast('Success', `Student number ${studentId} added successfully`, 'success');
        
    } catch (error) {
        console.error('Error adding student number:', error);
        showToast('Error', 'Failed to add student number', 'error');
    }
}

// Handle edit student number form submission
async function handleEditStudentNumber(e) {
    e.preventDefault();
    
    const originalStudentId = document.getElementById('editStudentId').value;
    const studentId = document.getElementById('editStudentNumber').value.trim();
    const studentName = document.getElementById('editStudentName').value.trim();
    const course = document.getElementById('editCourse').value;
    const yearSection = document.getElementById('editYearSection').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    
    if (!studentId || !studentName) {
        showToast('Error', 'Please fill in Student Number and Name', 'error');
        return;
    }
    
    // Check if student number already exists (excluding current one)
    const existingStudent = studentNumbers.find(s => s.studentId === studentId && s.studentId !== originalStudentId);
    if (existingStudent) {
        showToast('Error', 'Student number already exists', 'error');
        return;
    }
    
    const section = course && yearSection ? `${course} ${yearSection}` : '';
    const updateData = {
        studentId,
        studentName,
        section,
        course,
        yearSection,
        email,
        phone,
        updatedBy: 'Admin'
    };
    
    try {
        if (firebaseService) {
            // Update in Firebase
            await firebaseService.updateStudentNumber(originalStudentId, updateData);
        } else {
            // Fallback to localStorage
            const studentIndex = studentNumbers.findIndex(s => s.studentId === originalStudentId);
            if (studentIndex === -1) {
                showToast('Error', 'Student not found', 'error');
                return;
            }
            
            studentNumbers[studentIndex] = {
                ...studentNumbers[studentIndex],
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            
            saveStudentNumbers();
            
            // Update interface
            updateStudentNumbersTable();
            updateSectionFilter();
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editStudentNumberModal'));
        if (modal) modal.hide();
        
        showToast('Success', `Student number ${studentId} updated successfully`, 'success');
        
    } catch (error) {
        console.error('Error updating student number:', error);
        showToast('Error', 'Failed to update student number', 'error');
    }
}

// Update student numbers table
function updateStudentNumbersTable() {
    const tbody = document.getElementById('studentNumbersTable');
    const searchInput = document.getElementById('searchStudentNumbers');
    const sectionFilter = document.getElementById('sectionFilter');
    
    if (!tbody) return;
    
    let filteredStudents = studentNumbers;
    
    // Apply search filter
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(student => 
            student.studentId.toLowerCase().includes(searchTerm) ||
            student.studentName.toLowerCase().includes(searchTerm) ||
            student.section.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply section filter
    const selectedSection = sectionFilter ? sectionFilter.value : 'all';
    if (selectedSection !== 'all') {
        filteredStudents = filteredStudents.filter(student => student.section === selectedSection);
    }
    
    // Clear table
    tbody.innerHTML = '';
    
    if (filteredStudents.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center text-muted">No student numbers found</td>';
        tbody.appendChild(row);
        return;
    }
    
    // Sort by student ID
    filteredStudents.sort((a, b) => a.studentId.localeCompare(b.studentId));
    
    filteredStudents.forEach((student, idx) => {
        const row = document.createElement('tr');
        const addedDate = formatFirebaseTimestamp(student.addedAt);
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${student.studentId}</strong></td>
            <td>${student.studentName}</td>
            <td>${student.section || '-'}</td>
            <td>${addedDate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editStudentNumber('${student.studentId}')">Edit</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteStudentNumber('${student.studentId}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update section filter dropdown
function updateSectionFilter() {
    const dropdown = document.getElementById('sectionFilter');
    if (!dropdown) return;
    
    const sections = [...new Set(studentNumbers.map(s => s.section))].sort();
    
    dropdown.innerHTML = '<option value="all">All Sections</option>';
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        dropdown.appendChild(option);
    });
}

// Update total count display
function updateTotalCount() {
    const countSpan = document.getElementById('totalStudentCount');
    if (countSpan) {
        countSpan.textContent = studentNumbers.length;
    }
}

// Edit student number
function editStudentNumber(studentId) {
    const student = studentNumbers.find(s => s.studentId === studentId);
    if (!student) return;
    
    // Populate edit form
    document.getElementById('editStudentId').value = student.studentId;
    document.getElementById('editStudentNumber').value = student.studentId;
    document.getElementById('editStudentName').value = student.studentName;
    document.getElementById('editCourse').value = student.course;
    document.getElementById('editYearSection').value = student.yearSection;
    document.getElementById('editEmail').value = student.email || '';
    document.getElementById('editPhone').value = student.phone || '';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editStudentNumberModal'));
    modal.show();
}

// Delete student number
async function deleteStudentNumber(studentId) {
    const student = studentNumbers.find(s => s.studentId === studentId);
    if (!student) return;
    
    if (confirm(`Are you sure you want to delete student number ${studentId} (${student.studentName})?`)) {
        try {
            if (firebaseService) {
                // Delete from Firebase
                await firebaseService.deleteStudentNumber(studentId);
            } else {
                // Fallback to localStorage
                studentNumbers = studentNumbers.filter(s => s.studentId !== studentId);
                saveStudentNumbers();
                
                // Update interface
                updateStudentNumbersTable();
                updateSectionFilter();
                updateTotalCount();
            }
            
            showToast('Success', `Student number ${studentId} deleted successfully`, 'success');
            
        } catch (error) {
            console.error('Error deleting student number:', error);
            showToast('Error', 'Failed to delete student number', 'error');
        }
    }
}

// Clear all filters
function clearFilters() {
    const searchInput = document.getElementById('searchStudentNumbers');
    const sectionFilter = document.getElementById('sectionFilter');
    
    if (searchInput) searchInput.value = '';
    if (sectionFilter) sectionFilter.value = 'all';
    
    updateStudentNumbersTable();
}

// Import student numbers from CSV
function importStudentNumbers() {
    const modal = new bootstrap.Modal(document.getElementById('importCSVModal'));
    modal.show();
}

// Helper function to parse section string (e.g., "BSAIS 3-3" or "BSAIS")
function parseSection(sectionStr) {
    if (!sectionStr) return { course: '', yearSection: '', section: '' };
    
    const section = String(sectionStr).trim();
    
    // Try to match patterns like "BSAIS 3-3", "BSIS-AIS 1-2", etc.
    const match = section.match(/^([A-Z]+(?:-[A-Z]+)?)\s*(\d+-\d+)?$/i);
    
    if (match) {
        const course = match[1].toUpperCase();
        const yearSection = match[2] || '';
        return {
            course,
            yearSection,
            section: yearSection ? `${course} ${yearSection}` : course
        };
    }
    
    // If no match, check if it's just a course name
    const courseMatch = section.match(/^(BSIS-AIS|BSAIS|BSIT|BSCS|Other)$/i);
    if (courseMatch) {
        return {
            course: courseMatch[1],
            yearSection: '',
            section: courseMatch[1]
        };
    }
    
    // Default: use the whole string as section
    return {
        course: '',
        yearSection: '',
        section: section
    };
}

// Process XLSX import
async function processXLSXImport() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Error', 'Please select an XLSX file', 'error');
        return;
    }
    
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
            showToast('Error', 'XLSX file must contain at least a header row and one data row', 'error');
            return;
        }
        
        // Get headers (first row)
        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        
        // Find column indices - support multiple formats
        // Format 1: uniqueId, studentId, studentName, section
        // Format 2: StudentNumber, Name, Course, YearSection, Email, Phone
        const uniqueIdIdx = headers.findIndex(h => h === 'uniqueid');
        const studentIdIdx = headers.findIndex(h => 
            h === 'studentid' || 
            (h.includes('student') && h.includes('id')) ||
            (h.includes('student') && h.includes('number'))
        );
        const studentNameIdx = headers.findIndex(h => 
            h === 'studentname' || 
            h === 'name' ||
            (h.includes('name') && !h.includes('student'))
        );
        const sectionIdx = headers.findIndex(h => h === 'section');
        const courseIdx = headers.findIndex(h => h === 'course');
        const yearSectionIdx = headers.findIndex(h => 
            h === 'yearsection' || 
            (h.includes('year') && h.includes('section'))
        );
        const emailIdx = headers.findIndex(h => h === 'email' || h.includes('email'));
        const phoneIdx = headers.findIndex(h => h === 'phone' || h.includes('phone'));
        
        // Validate required columns
        if (studentIdIdx === -1 && uniqueIdIdx === -1) {
            showToast('Error', 'XLSX file must contain "studentId" or "uniqueId" column', 'error');
            return;
        }
        
        if (studentNameIdx === -1) {
            showToast('Error', 'XLSX file must contain "studentName" or "name" column', 'error');
            return;
        }
        
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        
        // Process data rows (skip header row)
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            if (!row || row.length === 0) continue;
            
            // Get studentId - prefer studentId, fallback to uniqueId
            let studentId = '';
            if (studentIdIdx !== -1) {
                studentId = String(row[studentIdIdx] || '').trim();
            }
            if (!studentId && uniqueIdIdx !== -1) {
                studentId = String(row[uniqueIdIdx] || '').trim();
            }
            
            const studentName = studentNameIdx !== -1 ? String(row[studentNameIdx] || '').trim() : '';
            
            if (!studentId || !studentName) {
                errors++;
                continue;
            }
            
            // Get section data - prefer section column, otherwise combine course and yearSection
            let course = '';
            let yearSection = '';
            let section = '';
            
            if (sectionIdx !== -1) {
                // Format: uniqueId, studentId, studentName, section
                const sectionStr = String(row[sectionIdx] || '').trim();
                const parsed = parseSection(sectionStr);
                section = parsed.section;
                course = parsed.course;
                yearSection = parsed.yearSection;
            } else if (courseIdx !== -1 || yearSectionIdx !== -1) {
                // Format: StudentNumber, Name, Course, YearSection, etc.
                course = courseIdx !== -1 ? String(row[courseIdx] || '').trim() : '';
                yearSection = yearSectionIdx !== -1 ? String(row[yearSectionIdx] || '').trim() : '';
                section = course && yearSection ? `${course} ${yearSection}` : (course || yearSection);
            }
            
            const email = emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '';
            const phone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            
            // Check if student already exists
            if (!studentNumbers.find(s => s.studentId === studentId)) {
                const newStudent = {
                    studentId,
                    studentName,
                    section,
                    course,
                    yearSection,
                    email,
                    phone,
                    addedAt: new Date().toISOString(),
                    addedBy: 'XLSX Import'
                };
                
                try {
                    if (firebaseService) {
                        await firebaseService.addStudentNumber(newStudent);
                    } else {
                        studentNumbers.push(newStudent);
                    }
                    imported++;
                } catch (error) {
                    console.error('Error adding student:', error);
                    errors++;
                }
            } else {
                skipped++;
            }
        }
        
        if (!firebaseService) {
            saveStudentNumbers();
        }
        
        updateStudentNumbersTable();
        updateSectionFilter();
        updateTotalCount();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('importCSVModal'));
        if (modal) modal.hide();
        
        let message = `Imported ${imported} student numbers.`;
        if (skipped > 0) message += ` Skipped ${skipped} duplicates.`;
        if (errors > 0) message += ` ${errors} rows had errors.`;
        
        showToast('Success', message, 'success');
        
    } catch (error) {
        showToast('Error', 'Failed to process XLSX file: ' + error.message, 'error');
        console.error('XLSX import error:', error);
    }
}

// Export student numbers to XLSX
function exportStudentNumbers() {
    if (studentNumbers.length === 0) {
        showToast('Warning', 'No student numbers to export', 'warning');
        return;
    }
    
    try {
        // Prepare data for export - matching the format: uniqueId, studentId, studentName, section
        const exportData = studentNumbers.map(student => ({
            'uniqueId': student.studentId,
            'studentId': student.studentId,
            'studentName': student.studentName,
            'section': student.section || ''
        }));
        
        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Numbers');
        
        // Set column widths for better readability
        const columnWidths = [
            { wch: 18 }, // uniqueId
            { wch: 18 }, // studentId
            { wch: 30 }, // studentName
            { wch: 20 }  // section
        ];
        worksheet['!cols'] = columnWidths;
        
        // Generate XLSX file
        const fileName = `student_numbers_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        showToast('Success', 'Student numbers exported successfully', 'success');
    } catch (error) {
        showToast('Error', 'Failed to export XLSX file: ' + error.message, 'error');
        console.error('XLSX export error:', error);
    }
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
