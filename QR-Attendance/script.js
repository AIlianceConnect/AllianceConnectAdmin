// Firebase database service
let firebaseDB = null;
let attendanceRecords = [];
let students = [];

// Initialize QR code scanner
let html5QrcodeScanner = null;
let html5Qrcode = null;

// Add a variable to track last beep time
let lastBeepTime = 0;

// Global variable to track the most recently timed-out student
let recentTimedOutKey = null;
let recentTimedOutTimeout = null;

// Initialize Firebase and load data
async function initializeFirebase() {
    try {
        firebaseDB = window.firebaseDB;
        if (!firebaseDB) {
            console.error('Firebase not initialized. Please check firebase-config.js');
            return false;
        }

        // Load initial data (getStudents and getAttendanceRecords already handle Local Storage)
        attendanceRecords = await firebaseDB.getAttendanceRecords();
        students = await firebaseDB.getStudents();

        // Set up real-time listeners
        firebaseDB.listenToAttendanceRecords((records) => {
            // Save Firebase records to Local Storage if they don't exist there
            if (window.offlineSync) {
                const localRecords = window.offlineSync.getFromLocalStorage('attendance');
                const localRecordKeys = new Set(localRecords.map(r => 
                    `${r.studentId}_${r.date}_${r.event}`
                ));
                records.forEach(fbRecord => {
                    const key = `${fbRecord.studentId}_${fbRecord.date}_${fbRecord.event}`;
                    if (!localRecordKeys.has(key)) {
                        // Save to Local Storage
                        window.offlineSync.saveToLocalStorage('attendance', fbRecord, 'add');
                    }
                });
            }
            // Merge with Local Storage data
            if (window.offlineSync) {
                const localRecords = window.offlineSync.getFromLocalStorage('attendance');
                attendanceRecords = window.offlineSync.mergeData(localRecords, records, 'studentId');
            } else {
                attendanceRecords = records;
            }
            updateAttendanceTable();
            updateSectionDropdownAndStudentList();
        });

        firebaseDB.listenToStudents((studentList) => {
            // Save Firebase students to Local Storage if they don't exist there
            if (window.offlineSync) {
                const localStudents = window.offlineSync.getFromLocalStorage('students');
                const localStudentIds = new Set(localStudents.map(s => s.studentId));
                studentList.forEach(fbStudent => {
                    if (!localStudentIds.has(fbStudent.studentId)) {
                        // Save to Local Storage
                        window.offlineSync.saveToLocalStorage('students', fbStudent, 'add');
                    }
                });
            }
            // Merge with Local Storage data
            if (window.offlineSync) {
                const localStudents = window.offlineSync.getFromLocalStorage('students');
                students = window.offlineSync.mergeData(localStudents, studentList, 'studentId');
            } else {
                students = studentList;
            }
            // Update UI when students change
            updateSectionDropdownAndStudentList();
        });

        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Update offline status indicator (make it globally accessible)
window.updateOfflineStatus = function() {
    const offlineStatusEl = document.getElementById('offlineStatus');
    const pendingSyncCountEl = document.getElementById('pendingSyncCount');
    
    if (!offlineStatusEl || !window.offlineSync) return;
    
    const isOnline = window.offlineSync.isOnline;
    const pendingCount = window.offlineSync.getPendingSyncCount();
    
    if (!isOnline) {
        offlineStatusEl.textContent = '● Offline';
        offlineStatusEl.className = 'ms-3 badge bg-danger';
        offlineStatusEl.style.display = 'inline-block';
    } else {
        offlineStatusEl.textContent = '● Online';
        offlineStatusEl.className = 'ms-3 badge bg-success';
        offlineStatusEl.style.display = 'inline-block';
    }
    
    if (pendingCount > 0) {
        pendingSyncCountEl.textContent = `${pendingCount} pending`;
        pendingSyncCountEl.style.display = 'inline-block';
    } else {
        pendingSyncCountEl.style.display = 'none';
    }
};

// Listen for offline status changes
window.addEventListener('offlineStatusChanged', function(event) {
    if (typeof updateOfflineStatus === 'function') {
        updateOfflineStatus();
    }
});

// Initialize current event display
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Firebase first
    const firebaseInitialized = await initializeFirebase();
    
    // Always load from Local Storage first (for offline support)
    // getStudents() and getAttendanceRecords() already save Firebase data to Local Storage
    if (!firebaseInitialized) {
        console.error('Failed to initialize Firebase. Falling back to localStorage.');
        // Fallback to localStorage
        if (window.offlineSync) {
            attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            students = window.offlineSync.getFromLocalStorage('students');
        } else {
            attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
            students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
        }
    } else {
        // Refresh from Local Storage (which now includes Firebase data)
        if (window.offlineSync) {
            attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            students = window.offlineSync.getFromLocalStorage('students');
        }
    }

    const currentEvent = await firebaseDB?.getCurrentEvent() || localStorage.getItem('currentEvent');
    if (currentEvent) {
        document.getElementById('eventNameDisplay').textContent = currentEvent;
    } else {
        window.location.href = 'welcome.html';
    }
    
    // Update offline status indicator
    updateOfflineStatus();
    // Update every 5 seconds
    setInterval(updateOfflineStatus, 5000);
    
    updateEventFilter();
    const barcodeInput = document.getElementById('barcodeInput');
    const scanResult = document.getElementById('scanResult');
    const activateScanBtn = document.getElementById('activateScan');
    const deactivateScanBtn = document.getElementById('deactivateScan');
    if (barcodeInput) {
        barcodeInput.focus();
        barcodeInput.disabled = false;

        let scannerTimer = null;

        async function processBarcode(scannedValue) {
            if (!scannedValue) return;
            // Play beep sound once per scan
            const beep = document.getElementById('beepSound');
            if (beep) { beep.currentTime = 0; beep.play(); }

            const scanMode = document.querySelector('input[name="scanMode"]:checked').value;
            const today = new Date().toLocaleDateString();
            const currentEvent = localStorage.getItem('currentEvent');

            // Lookup student by barcode
            let foundStudent = null;
            if (firebaseDB) {
                foundStudent = await firebaseDB.findStudentByBarcode(scannedValue);
            } else {
                // Fallback to localStorage
                for (const s of students) {
                    if (encodeStudentData(s.studentId) === scannedValue) {
                        foundStudent = s;
                        break;
                    }
                }
            }

            if (foundStudent) {
                if (scanMode === 'normal') {
                    scanResult.innerHTML = `<span class='success'>✓ Found: ${foundStudent.studentName} (${foundStudent.studentId}) - ${foundStudent.section}</span>`;
                    try {
                        let existingRec = null;
                        if (firebaseDB) {
                            existingRec = await firebaseDB.findAttendanceRecord(
                                foundStudent.studentId, 
                                foundStudent.section, 
                                currentEvent, 
                                today
                            );
                        } else {
                            // Fallback to localStorage
                            const allRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
                            existingRec = allRecords.find(r =>
                                r.studentId === foundStudent.studentId &&
                                r.section === foundStudent.section &&
                                r.date === today &&
                                r.event === currentEvent
                            );
                        }
                        if (!existingRec) {
                            showToast('Student Found', `${foundStudent.studentName} (${foundStudent.studentId})`, 'success');
                        } else if (existingRec && existingRec.timeOut) {
                            showToast('Duplicate', `${foundStudent.studentName} (${foundStudent.studentId}) already timed out`, 'warning');
                        } else if (existingRec && !existingRec.timeOut) {
                            const nowMs = Date.now();
                            const checkInMs = existingRec.checkInMs || 0;
                            if (nowMs - checkInMs < 5000) {
                                // too soon to time-out
                            }
                        }
                    } catch (e) {}
                    markAttendance(foundStudent);
                } else if (scanMode === 'timeIn') {
                    const updated = updateStudentTimeIn(foundStudent.studentId, foundStudent.section, currentEvent, today);
                    if (updated) {
                        scanResult.innerHTML = `<span class='success'>✓ Updated time-in for: ${foundStudent.studentName} (${foundStudent.studentId})</span>`;
                        showToast('Updated time-in', `${foundStudent.studentName} (${foundStudent.studentId})`, 'success');
                        if (document.getElementById('autoSwitchMode').checked) {
                            document.getElementById('normalMode').checked = true;
                        }
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ No attendance record found for: ${foundStudent.studentName}</span>`;
                        showToast('Student Not Found', `${foundStudent.studentName} (${foundStudent.studentId})`, 'error');
                    }
                } else if (scanMode === 'timeOut') {
                    const updated = updateStudentTimeOut(foundStudent.studentId, foundStudent.section, currentEvent, today, 'manual');
                    if (updated) {
                        scanResult.innerHTML = `<span class='success'>✓ Updated time-out for: ${foundStudent.studentName} (${foundStudent.studentId})</span>`;
                        if (document.getElementById('autoSwitchMode').checked) {
                            document.getElementById('normalMode').checked = true;
                        }
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ No attendance record found for: ${foundStudent.studentName}</span>`;
                        showToast('Student Not Found', `${foundStudent.studentName} (${foundStudent.studentId})`, 'error');
                    }
                }
            } else {
                scanResult.innerHTML = `<span class='error'>✗ Student not found for barcode: ${scannedValue}</span>`;
                showToast('Student Not Found', `Barcode: ${scannedValue}`, 'error');
            }
        }

        // Debounced input: wait for short inactivity before processing
        barcodeInput.addEventListener('input', function() {
            if (scannerTimer) clearTimeout(scannerTimer);
            scannerTimer = setTimeout(() => {
                const value = barcodeInput.value.trim();
                if (!value) return;
                processBarcode(value);
                barcodeInput.value = '';
                if (!barcodeInput.disabled) barcodeInput.focus();
            }, 100);
        });

        // Enter/Tab completes the scan immediately
        barcodeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (scannerTimer) clearTimeout(scannerTimer);
                const value = barcodeInput.value.trim();
                if (!value) return;
                processBarcode(value);
                barcodeInput.value = '';
                if (!barcodeInput.disabled) barcodeInput.focus();
            }
        });

        // Keep focus on input
        document.addEventListener('click', function() {
            if (!barcodeInput.disabled) barcodeInput.focus();
        });
    }
    // Manual check-in modal wiring
    const manualBtn = document.getElementById('manualCheckInBtn');
    if (manualBtn) {
        const manualModalEl = document.getElementById('manualCheckInModal');
        let manualModal = null;
        if (manualModalEl && typeof bootstrap !== 'undefined') {
            manualModal = new bootstrap.Modal(manualModalEl);
        }
        // Track previous scanning state so we can restore it after closing
        let previousBarcodeDisabled = false;
        if (manualModalEl) {
            manualModalEl.addEventListener('show.bs.modal', function() {
                if (barcodeInput) {
                    previousBarcodeDisabled = barcodeInput.disabled;
                    barcodeInput.disabled = true;
                    barcodeInput.blur();
                }
                const idInput = document.getElementById('manualStudentId');
                if (idInput) setTimeout(() => idInput.focus(), 50);
            });
            manualModalEl.addEventListener('hidden.bs.modal', function() {
                if (barcodeInput) {
                    barcodeInput.disabled = previousBarcodeDisabled;
                    if (!barcodeInput.disabled) {
                        setTimeout(() => barcodeInput.focus(), 50);
                    }
                }
            });
        }
        manualBtn.addEventListener('click', function() {
            if (manualModal) manualModal.show();
            const idInput = document.getElementById('manualStudentId');
            if (idInput) setTimeout(() => idInput.focus(), 150);
        });
        const manualForm = document.getElementById('manualCheckInForm');
        if (manualForm) {
            manualForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const studentId = (document.getElementById('manualStudentId')?.value || '').trim();
                const studentName = (document.getElementById('manualStudentName')?.value || '').trim();
                const course = (document.querySelector('input[name="manualCourse"]:checked')?.value || '').trim();
                const yearSection = (document.getElementById('manualYearSection')?.value || '').trim();
                if (!studentId || !studentName || !course || !yearSection) return;
                const section = `${course} ${yearSection}`;
                const student = { studentId, studentName, section };
                
                // Add/update student in database if using Firebase
                if (firebaseDB) {
                    try {
                        const existingStudent = await firebaseDB.findStudentByBarcode(firebaseDB.encodeStudentData(studentId));
                        if (!existingStudent) {
                            await firebaseDB.addStudent(student);
                        } else {
                            await firebaseDB.updateStudent(studentId, { studentName, section });
                        }
                    } catch (error) {
                        console.error('Error updating student database:', error);
                    }
                }
                
                await markAttendance(student);
                showToast('Manual Check-in', `${studentName} (${studentId})`, 'success');
                // Clear and close modal
                manualForm.reset();
                if (manualModal) manualModal.hide();
            });
        }
    }

    // Manual check-out modal wiring
    const manualOutBtn = document.getElementById('manualCheckOutBtn');
    if (manualOutBtn) {
        const outModalEl = document.getElementById('manualCheckOutModal');
        let outModal = null;
        if (outModalEl && typeof bootstrap !== 'undefined') {
            outModal = new bootstrap.Modal(outModalEl);
        }
        let prevDisabled = false;
        if (outModalEl) {
            outModalEl.addEventListener('show.bs.modal', function() {
                if (barcodeInput) {
                    prevDisabled = barcodeInput.disabled;
                    barcodeInput.disabled = true;
                    barcodeInput.blur();
                }
                const input = document.getElementById('manualCheckOutStudentId');
                if (input) setTimeout(() => input.focus(), 50);
            });
            outModalEl.addEventListener('hidden.bs.modal', function() {
                if (barcodeInput) {
                    barcodeInput.disabled = prevDisabled;
                    if (!barcodeInput.disabled) setTimeout(() => barcodeInput.focus(), 50);
                }
            });
        }
        manualOutBtn.addEventListener('click', function() {
            if (outModal) outModal.show();
        });
        const outForm = document.getElementById('manualCheckOutForm');
        if (outForm) {
            outForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const studentId = (document.getElementById('manualCheckOutStudentId')?.value || '').trim();
                if (!studentId) return;
                const currentEvent = await firebaseDB?.getCurrentEvent() || localStorage.getItem('currentEvent');
                const today = new Date().toLocaleDateString();
                let records = [];
                if (firebaseDB) {
                    records = await firebaseDB.getAttendanceRecords();
                } else {
                    records = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
                }
                // Find the student's section from today's record in current event
                // Prefer the record with no timeOut yet; otherwise last record today
                const candidates = records.filter(r => r.studentId === studentId && r.event === currentEvent && r.date === today);
                let target = candidates.find(r => !r.timeOut);
                if (!target) {
                    // If all timed-out, choose the most recent by checkInMs
                    target = candidates.sort((a,b)=> (b.lastUpdateMs||b.checkInMs||0) - (a.lastUpdateMs||a.checkInMs||0))[0];
                }
                if (target) {
                    const updated = updateStudentTimeOut(target.studentId, target.section, target.event, target.date, 'manual');
                    if (updated) {
                        showToast('Manual Time-out', `${target.studentName || ''} (${target.studentId})`, 'error');
                    }
                } else {
                    showToast('Student Not Found', `No record for ${studentId} today`, 'error');
                }
                outForm.reset();
                if (outModal) outModal.hide();
            });
        }
    }
    if (activateScanBtn) {
        activateScanBtn.addEventListener('click', function() {
            barcodeInput.disabled = false;
            barcodeInput.focus();
        });
    }
    if (deactivateScanBtn) {
        deactivateScanBtn.addEventListener('click', function() {
            barcodeInput.blur();
            barcodeInput.disabled = true;
        });
    }
    // Set event filter to current event on page load
    const eventFilter = document.getElementById('eventFilter');
    if (eventFilter && currentEvent) {
        eventFilter.value = currentEvent;
        eventFilter.dispatchEvent(new Event('change'));
    }
});

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
    setTimeout(remove, 2500);
}

// Update event filter dropdown
function updateEventFilter() {
    const eventFilter = document.getElementById('eventFilter');
    const events = new Set(attendanceRecords.map(record => record.event));
    eventFilter.innerHTML = '<option value="all">All Events</option>';
    events.forEach(event => {
        if (event) {
            const option = document.createElement('option');
            option.value = event;
            option.textContent = event;
            eventFilter.appendChild(option);
        }
    });
    // Set current event as selected
    const currentEvent = localStorage.getItem('currentEvent');
    if (currentEvent) {
        eventFilter.value = currentEvent;
    }
}

// Helper: Get unique sections from barcodeStudents
function getUniqueSectionsFromStudents(students) {
    const sections = new Set();
    students.forEach(s => {
        if (s.section && s.section !== 'undefined') sections.add(s.section);
    });
    return Array.from(sections);
}

// Helper: Get students by section from barcodeStudents
function getStudentsBySectionFromStudents(students, section) {
    return students.filter(s => s.section === section);
}

// Populate section dropdown and student list from attendance records for current event
function updateSectionDropdownAndStudentList() {
    const dropdown = document.getElementById('sectionDropdown');
    if (!dropdown) return;
    
    // Get the current event (not the event filter)
    const currentEvent = localStorage.getItem('currentEvent');
    if (!currentEvent) {
        dropdown.innerHTML = '';
        document.getElementById('studentListBySection').innerHTML = '';
        return;
    }
    
    // Only get sections from attendance records for the current event
    const sections = new Set();
    
    // Filter attendance records by current event only
    const filteredRecords = attendanceRecords.filter(r => r.event === currentEvent);
    
    filteredRecords.forEach(record => {
        if (record.section && record.section !== 'undefined') {
            sections.add(record.section);
        }
    });
    
    // Sort sections alphabetically
    const sortedSections = Array.from(sections).sort((a, b) => a.localeCompare(b));
    
    // Update dropdown
    dropdown.innerHTML = '';
    sortedSections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        dropdown.appendChild(option);
    });
    
    // Show students for the first section by default
    if (sortedSections.length > 0) {
        updateStudentListBySection(sortedSections[0]);
        dropdown.value = sortedSections[0];
    } else {
        document.getElementById('studentListBySection').innerHTML = '';
    }
}

function updateStudentListBySection(section) {
    const tbody = document.getElementById('studentListBySection');
    if (!tbody) return;
    
    // Get the current event (not the event filter)
    const currentEvent = localStorage.getItem('currentEvent');
    if (!currentEvent) {
        tbody.innerHTML = '';
        return;
    }
    
    // Only show students who have attendance records for the current event and selected section
    const filteredRecords = attendanceRecords.filter(r => 
        r.section === section && 
        r.event === currentEvent
    );
    
    // Get unique students from attendance records only
    const uniqueStudents = new Map();
    
    filteredRecords.forEach(r => {
        if (r.studentId) {
            // Use the most recent record for each student (in case of duplicates)
            const key = r.studentId;
            if (!uniqueStudents.has(key)) {
                uniqueStudents.set(key, {
                    studentId: r.studentId,
                    studentName: r.studentName || '',
                    section: r.section
                });
            }
        }
    });
    
    // Sort by student ID
    const sortedStudents = Array.from(uniqueStudents.values()).sort((a, b) => 
        a.studentId.localeCompare(b.studentId)
    );
    
    tbody.innerHTML = '';
    sortedStudents.forEach((student, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${student.studentId}</td>
            <td>${student.studentName}</td>
        `;
        tbody.appendChild(row);
    });
}

// Function to update time-in for a specific student
async function updateStudentTimeIn(studentId, section, event, date) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const nowMs = Date.now();
    
    if (firebaseDB) {
        const record = await firebaseDB.findAttendanceRecord(studentId, section, event, date);
        if (record) {
            await firebaseDB.updateAttendanceRecord(record.id, {
                studentId: studentId,
                studentName: record.studentName || '', // Preserve existing studentName
                section: section,
                event: event,
                date: date,
                timeIn: timeString,
                checkInMs: record.checkInMs || nowMs, // Preserve existing checkInMs or use current time
                lastUpdateMs: nowMs
            });
            // Refresh attendanceRecords from Local Storage after update
            if (window.offlineSync) {
                attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            } else {
                attendanceRecords = await firebaseDB.getAttendanceRecords();
            }
            updateAttendanceTable();
            return true;
        }
    } else {
        // Fallback to localStorage
        let attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
        const recordIndex = attendanceRecords.findIndex(record => 
            record.studentId === studentId && 
            record.section === section && 
            record.event === event && 
            record.date === date
        );

        if (recordIndex !== -1) {
            attendanceRecords[recordIndex].timeIn = timeString;
            attendanceRecords[recordIndex].lastUpdateMs = nowMs;
            localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
            updateAttendanceTable();
            return true;
        }
    }
    return false;
}

// Function to update time-out for a specific student
async function updateStudentTimeOut(studentId, section, event, date, source = 'auto') {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const nowMs = Date.now();
    
    if (firebaseDB) {
        const record = await firebaseDB.findAttendanceRecord(studentId, section, event, date);
        if (record) {
            await firebaseDB.updateAttendanceRecord(record.id, {
                studentId: studentId,
                studentName: record.studentName || '', // Preserve existing studentName
                section: section,
                event: event,
                date: date,
                timeIn: record.timeIn || '', // Preserve existing timeIn
                timeOut: timeString,
                checkInMs: record.checkInMs || Date.now(), // Preserve existing checkInMs
                lastUpdateMs: nowMs
            });
            // Refresh attendanceRecords from Local Storage after update
            if (window.offlineSync) {
                attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            } else {
                attendanceRecords = await firebaseDB.getAttendanceRecords();
            }
            try {
                const title = source === 'manual' ? 'Updated time-out' : 'Time-out';
                showToast(title, `${record.studentName} (${record.studentId})`, 'error');
            } catch (e) {}
            // Set the global variable for 2 seconds
            recentTimedOutKey = `${studentId}-${section}-${event}-${date}`;
            if (recentTimedOutTimeout) clearTimeout(recentTimedOutTimeout);
            recentTimedOutTimeout = setTimeout(() => {
                recentTimedOutKey = null;
                updateAttendanceTable();
            }, 2000);
            updateAttendanceTable();
            return true;
        }
    } else {
        // Fallback to localStorage
        let attendanceRecords = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
        const recordIndex = attendanceRecords.findIndex(record => 
            record.studentId === studentId && 
            record.section === section && 
            record.event === event && 
            record.date === date
        );

        if (recordIndex !== -1) {
            attendanceRecords[recordIndex].timeOut = timeString;
            attendanceRecords[recordIndex].lastUpdateMs = nowMs;
            localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
            try {
                const r = attendanceRecords[recordIndex];
                const title = source === 'manual' ? 'Updated time-out' : 'Time-out';
                showToast(title, `${r.studentName} (${r.studentId})`, 'error');
            } catch (e) {}
            // Set the global variable for 2 seconds
            recentTimedOutKey = `${studentId}-${section}-${event}-${date}`;
            if (recentTimedOutTimeout) clearTimeout(recentTimedOutTimeout);
            recentTimedOutTimeout = setTimeout(() => {
                recentTimedOutKey = null;
                updateAttendanceTable();
            }, 2000);
            updateAttendanceTable();
            return true;
        }
    }
    return false;
}

// Update the updateAttendanceTable function
function updateAttendanceTable() {
    const tbody = document.getElementById('attendanceRecords');
    const eventFilter = document.getElementById('eventFilter').value;
    
    // Use the global attendanceRecords array which is updated by Firebase listeners
    let filteredRecords = attendanceRecords;
    if (eventFilter !== 'all') {
        filteredRecords = attendanceRecords.filter(record => record.event === eventFilter);
    }
    // Get unique records (one per student per event per day)
    const uniqueRecords = new Map();
    filteredRecords.forEach(record => {
        const key = `${record.studentId}-${record.section}-${record.event}-${record.date}`;
        if (!uniqueRecords.has(key)) {
            uniqueRecords.set(key, record);
        }
    });
    tbody.innerHTML = '';
    // Sort records so that those without timeOut are at the top, then by lastUpdateMs/checkInMs
    let sortedRecords = Array.from(uniqueRecords.values()).sort((a, b) => {
        const aHasTimeOut = !!a.timeOut;
        const bHasTimeOut = !!b.timeOut;
        if (aHasTimeOut !== bHasTimeOut) {
            // a with no timeOut comes before b with timeOut
            return aHasTimeOut ? 1 : -1;
        }
        // Both have or both don't have timeOut: sort by lastUpdateMs/checkInMs descending
        const timeA = a.lastUpdateMs || a.checkInMs || 0;
        const timeB = b.lastUpdateMs || b.checkInMs || 0;
        return timeB - timeA;
    });
    // If there is a recent timed-out key, move that record to the top and highlight it
    if (recentTimedOutKey) {
        const idx = sortedRecords.findIndex(r => `${r.studentId}-${r.section}-${r.event}-${r.date}` === recentTimedOutKey);
        if (idx !== -1) {
            const [recent] = sortedRecords.splice(idx, 1);
            sortedRecords.unshift(recent);
        }
    }
    sortedRecords.forEach((record, idx) => {
        const key = `${record.studentId}-${record.section}-${record.event}-${record.date}`;
        const row = document.createElement('tr');
        if (recentTimedOutKey && key === recentTimedOutKey) {
            row.style.backgroundColor = '#fff3cd'; // Bootstrap warning highlight
        }
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td>${record.studentId}</td>
            <td>${record.studentName}</td>
            <td>${record.section}</td>
            <td>${record.event || ''}</td>
            <td>${record.date}</td>
            <td>${record.timeIn || ''}</td>
            <td>${record.timeOut || ''}</td>
        `;
        tbody.appendChild(row);
    });
    // Update section dropdown and student list to reflect latest students
    updateSectionDropdownAndStudentList();
}

// Section dropdown change event
const sectionDropdown = document.getElementById('sectionDropdown');
if (sectionDropdown) {
    sectionDropdown.addEventListener('change', function() {
        updateStudentListBySection(this.value);
    });
}

// Add event listener for event filter
document.getElementById('eventFilter').addEventListener('change', function() {
    updateAttendanceTable();
    updateSectionDropdownAndStudentList();
});

// Initial table update
updateAttendanceTable();

// Add event listener for clear button
const clearBtn = document.getElementById('clearRecords');
if (clearBtn) {
    clearBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to clear all attendance records?')) {
            if (firebaseDB) {
                try {
                    await firebaseDB.clearAllData();
                    attendanceRecords = [];
                    updateAttendanceTable();
                } catch (error) {
                    console.error('Error clearing records:', error);
                    alert('Error clearing records. Please try again.');
                }
            } else {
                // Fallback to localStorage
                attendanceRecords = [];
                localStorage.removeItem('attendanceRecords');
                updateAttendanceTable();
            }
        }
    });
}

// Add event listener for export button
const exportBtn = document.getElementById('exportRecords');
if (exportBtn) {
    exportBtn.addEventListener('click', function() {
        if (attendanceRecords.length === 0) {
            alert('No attendance records to export.');
            return;
        }
        // Get selected event for filename
        const eventFilter = document.getElementById('eventFilter');
        let selectedEvent = eventFilter ? eventFilter.value : 'all';
        if (!selectedEvent || selectedEvent === 'all') {
            selectedEvent = 'All_Events';
        }
        // Prepare data for export (Attendance Records)
        let exportData = attendanceRecords;
        if (selectedEvent !== 'All_Events') {
            exportData = attendanceRecords.filter(record => record.event === selectedEvent);
        }
        exportData = exportData.map((record, idx) => ({
            '#': idx + 1,
            'Student#': record.studentId,
            'Name': record.studentName,
            'Section': record.section,
            'Date': record.date,
            'Time-in': record.timeIn || '',
            'Time-out': record.timeOut || ''
        }));
        // Create worksheet and workbook
        const ws1 = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, 'Attendance Records');

        // Prepare data for second sheet: Students by Section
        // Get unique students per section
        const studentsBySection = {};
        exportData.forEach(record => {
            if (!record['Section']) return;
            if (!studentsBySection[record['Section']]) studentsBySection[record['Section']] = {};
            const key = record['Student#'] + '|' + record['Name'];
            if (!studentsBySection[record['Section']][key]) {
                studentsBySection[record['Section']][key] = {
                    'Student#': record['Student#'],
                    'Name': record['Name']
                };
            }
        });
        // Build export array: one table per section, with headers and blank row between
        let exportStudents = [];
        Object.keys(studentsBySection).sort().forEach(section => {
            // Section title row
            exportStudents.push({ 'Section': section });
            // Section data rows
            Object.values(studentsBySection[section]).forEach(student => {
                exportStudents.push(student);
            });
            // Blank row between sections
            exportStudents.push({});
        });
        // Create worksheet and workbook for students by section
        const ws2 = XLSX.utils.json_to_sheet(exportStudents);
        XLSX.utils.book_append_sheet(wb, ws2, 'Students by Section');

        // Save workbook to file
        const fileName = (selectedEvent.replace(/[^a-z0-9]/gi, '_')) + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
        const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

async function markAttendance(student) {
    const today = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const nowMs = Date.now();
    const currentEvent = await firebaseDB?.getCurrentEvent() || localStorage.getItem('currentEvent');
    
    // Check if there are any records for the current event before adding
    let eventRecordsBefore = [];
    if (firebaseDB) {
        eventRecordsBefore = await firebaseDB.getAttendanceRecordsByEvent(currentEvent);
    } else {
        eventRecordsBefore = attendanceRecords.filter(r => r.event === currentEvent);
    }
    const wasEventEmpty = eventRecordsBefore.length === 0;
    
    // Find if student already checked in today for this event
    let existing = null;
    if (firebaseDB) {
        existing = await firebaseDB.findAttendanceRecord(student.studentId, student.section, currentEvent, today);
    } else {
        existing = attendanceRecords.find(
            r => r.studentId === student.studentId && 
                 r.section === student.section &&
                 r.date === today &&
                 r.event === currentEvent
        );
    }
    
    if (!existing) {
        // First scan: check-in
        // Ensure record structure matches Firebase document format
        const record = {
            studentId: student.studentId || '',
            studentName: student.studentName || '',
            section: student.section || '',
            event: currentEvent || '',
            date: today,
            timeIn: currentTime,
            timeOut: '',
            checkInMs: nowMs,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        if (firebaseDB) {
            await firebaseDB.addAttendanceRecord(record);
            // Refresh attendanceRecords from Local Storage (which includes the newly added record)
            if (window.offlineSync) {
                attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            } else {
                attendanceRecords = await firebaseDB.getAttendanceRecords();
            }
        } else {
            // Fallback to localStorage
            attendanceRecords.push(record);
            // Remove any duplicate records for the same student, event, and date (keep the latest)
            const uniqueMap = new Map();
            attendanceRecords.forEach(rec => {
                const key = `${rec.studentId}-${rec.section}-${rec.event}-${rec.date}`;
                uniqueMap.set(key, rec);
            });
            attendanceRecords = Array.from(uniqueMap.values());
            localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
        }
        
        // Set event filter to current event and update table
        const eventFilter = document.getElementById('eventFilter');
        if (eventFilter && currentEvent) {
            eventFilter.value = currentEvent;
            eventFilter.dispatchEvent(new Event('change'));
        }
        updateAttendanceTable();
    } else if (!existing.timeOut) {
        // Second scan: check-out, only if at least 5 seconds have passed
        if (nowMs - (existing.checkInMs || 0) >= 5000) {
            // Only call updateStudentTimeOut, do not update table here
            await updateStudentTimeOut(student.studentId, student.section, currentEvent, today, 'auto');
            // Refresh attendanceRecords from Local Storage after update (updateStudentTimeOut already calls updateAttendanceTable)
            if (firebaseDB && window.offlineSync) {
                attendanceRecords = window.offlineSync.getFromLocalStorage('attendance');
            } else if (firebaseDB) {
                attendanceRecords = await firebaseDB.getAttendanceRecords();
            }
            // Do not call updateAttendanceTable or eventFilter change here
        }
    }
    
    // Automatically select the student's section in the section dropdown and update the left table
    const sectionDropdown = document.getElementById('sectionDropdown');
    if (sectionDropdown && student.section) {
        sectionDropdown.value = student.section;
        updateStudentListBySection(student.section);
    } else {
        updateSectionDropdownAndStudentList();
    }
    
    // Refresh page if this was the very first scan for the current event
    if (wasEventEmpty) {
        setTimeout(() => { location.reload(); }, 300);
    }
}

;
