// Store rental records in localStorage (fallback)
let rentalRecords = [];
let inventoryItems = [];
let students = [];
let officers = [];

// Firebase service
let rentalFirebaseService = null;

// Initialize barcode scanner
let html5QrcodeScanner = null;
let html5Qrcode = null;

// Add a variable to track last beep time
let lastBeepTime = 0;

// Initialize the system
document.addEventListener('DOMContentLoaded', async function () {
    // 1. Load from localStorage FIRST (for instant display & offline support)
    rentalRecords = JSON.parse(localStorage.getItem('rentalRecords')) || [];
    inventoryItems = JSON.parse(localStorage.getItem('inventoryItems')) || [];
    students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
    officers = JSON.parse(localStorage.getItem('barcodeOfficers')) || [];

    // Initialize Firebase
    try {
        if (window.firebaseDb) {
            rentalFirebaseService = new RentalSystemFirebaseService();

            // 2. Sync with Firebase in BACKGROUND (updates localStorage + UI)
            Promise.all([
                rentalFirebaseService.getRentalRecords(),
                rentalFirebaseService.getInventoryItems(),
                rentalFirebaseService.getStudents(),
                rentalFirebaseService.getOfficers()
            ]).then(([records, items, studentList, officerList]) => {
                rentalRecords = records;
                inventoryItems = items;
                students = studentList;
                officers = officerList;

                console.log('Firebase data synced & saved to localStorage');

                // Update tables with fresh data
                updateAvailableItemsTable();
                updateRentalRecordsTable();
                updateRentalHistoryTable();
            }).catch(err => {
                console.warn('Background sync failed, staying with local data:', err);
            });

            // Set up real-time listeners
            setupRealtimeListeners();
        } else {
            console.warn('Firebase not available, running in offline mode');
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
    // Initialize inventory if empty
    if (inventoryItems.length === 0) {
        initializeDefaultInventory();
    }

    // Initialize officers if empty
    if (officers.length === 0) {
        initializeDefaultOfficers();
    }

    // Initialize input mode handlers
    const scanMode = document.getElementById('scanMode');
    const manualMode = document.getElementById('manualMode');
    const barcodeInputSection = document.getElementById('barcodeInputSection');
    const manualInputSection = document.getElementById('manualInputSection');

    if (scanMode && manualMode) {
        // Toggle between scan and manual input modes
        scanMode.addEventListener('change', function () {
            if (this.checked) {
                barcodeInputSection.style.display = 'block';
                manualInputSection.style.display = 'none';
                document.getElementById('barcodeInput').focus();
                sessionStorage.removeItem('tempRenter');
                sessionStorage.removeItem('tempOfficer');
            }
        });

        manualMode.addEventListener('change', function () {
            if (this.checked) {
                barcodeInputSection.style.display = 'none';
                manualInputSection.style.display = 'block';
                populateDropdowns(); // Populate dropdowns when switching to manual mode
                sessionStorage.removeItem('tempRenter');
                sessionStorage.removeItem('tempOfficer');
            }
        });

        // Initialize Process Manual Transaction button
        const processManualTransactionBtn = document.getElementById('processManualTransaction');
        if (processManualTransactionBtn) {
            processManualTransactionBtn.addEventListener('click', handleManualTransaction);
        }

        // Add mode change handler for student inputs visibility
        const rentMode = document.getElementById('rentMode');
        const returnMode = document.getElementById('returnMode');
        const manualStudentInputs = document.getElementById('manualStudentInputs');

        if (rentMode && returnMode && manualStudentInputs) {
            rentMode.addEventListener('change', function () {
                if (this.checked && manualMode.checked) {
                    manualStudentInputs.style.display = 'block';
                    populateDropdowns('rent');
                }
            });

            returnMode.addEventListener('change', function () {
                if (this.checked && manualMode.checked) {
                    manualStudentInputs.style.display = 'none';
                    populateDropdowns('return');
                }
            });
        }

        // Add officer barcode scanning functionality
        const barcodeInputOfficer = document.getElementById('barcodeInputOfficer');
        if (barcodeInputOfficer) {
            barcodeInputOfficer.addEventListener('input', function (e) {
                const scannedValue = e.target.value.trim();
                if (!scannedValue) return;

                // Play beep sound
                const beep = document.getElementById('beepSound');
                if (beep) { beep.currentTime = 0; beep.play(); }

                // Look for officer
                const foundOfficer = officers.find(officer =>
                    encodeStudentData(officer.officerId) === scannedValue ||
                    officer.officerId === scannedValue
                );

                const scanResult = document.getElementById('scanResult');
                if (foundOfficer) {
                    sessionStorage.setItem('tempOfficer', JSON.stringify(foundOfficer));
                    scanResult.innerHTML = `<span class='info'>✓ Officer verified: ${foundOfficer.officerName}</span>`;

                    // Automatically process the transaction
                    const scanMode = document.querySelector('input[name="scanMode"]:checked').value;
                    const itemSelect = document.getElementById('itemSelect');

                    if (!itemSelect.value) {
                        scanResult.innerHTML = '<span class="error">✗ Please select an item first</span>';
                        return;
                    }

                    const item = JSON.parse(itemSelect.value);

                    if (scanMode === 'rent') {
                        const studentName = document.getElementById('studentName');
                        const studentId = document.getElementById('studentId');
                        const studentSection = document.getElementById('studentSection');

                        // Validate student inputs for rental
                        if (!studentName.value || !studentId.value || !studentSection.value) {
                            scanResult.innerHTML = '<span class="error">✗ Please fill in all student information first</span>';
                            return;
                        }

                        // Create student object
                        const student = {
                            studentName: studentName.value,
                            studentId: studentId.value,
                            section: studentSection.value
                        };

                        // Store student in session storage
                        sessionStorage.setItem('tempRenter', JSON.stringify(student));

                        // Process the rental
                        handleRental(item);

                        // Reset student form after successful rental
                        studentName.value = '';
                        studentId.value = '';
                        studentSection.value = '';
                    } else {
                        // Ask confirmation before processing return
                        confirmReturn(item);
                    }

                    // Reset item selection
                    itemSelect.value = '';
                } else {
                    scanResult.innerHTML = `<span class='error'>✗ Officer not found for barcode: ${scannedValue}</span>`;
                }

                // Clear input
                setTimeout(() => {
                    barcodeInputOfficer.value = '';
                }, 200);
            });
        }
    }

    // Manual item barcode input to auto-select item in dropdown
    const barcodeInputItemManual = document.getElementById('barcodeInputItemManual');
    if (barcodeInputItemManual) {
        barcodeInputItemManual.addEventListener('input', function (e) {
            const scannedValueRaw = e.target.value.trim();
            if (!scannedValueRaw) return;
            const scannedValue = normalizeBarcode(scannedValueRaw);

            // Determine current mode and eligibility
            const mode = document.querySelector('input[name="scanMode"]:checked')?.value || 'rent';
            const isItemRented = (item) => rentalRecords.some(r => r.itemId === item.id && r.status === 'active');

            // Find item by barcode or id
            const foundItem = inventoryItems.find(item =>
                normalizeBarcode(item.barcode) === scannedValue ||
                normalizeBarcode(item.id) === scannedValue
            );

            const scanResult = document.getElementById('scanResult');
            const itemSelect = document.getElementById('itemSelect');

            if (!foundItem) {
                if (scanResult) scanResult.innerHTML = `<span class='error'>✗ Item not found for barcode: ${scannedValueRaw}</span>`;
                setTimeout(() => { e.target.value = ''; }, 200);
                return;
            }

            // Validate eligibility for current mode
            const itemStatus = (foundItem.status || 'available').toLowerCase();
            const currentlyRented = isItemRented(foundItem);

            if (mode === 'rent') {
                // Get current student info if available
                const tempRenter = JSON.parse(sessionStorage.getItem('tempRenter') || 'null');
                const currentStudentId = tempRenter ? tempRenter.studentId : '';

                // Check if item is reserved
                if (itemStatus === 'reserved') {
                    const reservedBy = foundItem.reservedBy || foundItem.currentRenter || '';

                    // Extract student ID from reservedBy
                    let reservedStudentId = '';
                    if (reservedBy) {
                        const match = reservedBy.match(/\(([^)]+)\)/);
                        reservedStudentId = match ? match[1].trim() : reservedBy.trim();
                    }

                    // If reserved by someone else, block immediately
                    if (reservedStudentId && currentStudentId && reservedStudentId !== currentStudentId) {
                        if (scanResult) scanResult.innerHTML = `<span class='error'>✗ Item ${foundItem.name} (${foundItem.id}) is reserved by ${reservedBy} and cannot be rented by other students</span>`;
                        setTimeout(() => { e.target.value = ''; }, 200);
                        return;
                    }
                    // If reserved by current student or no student ID available, allow to proceed (will be validated in handleRental)
                }

                // Block rented items or items with invalid status
                if (itemStatus === 'rented' || (itemStatus !== 'reserved' && itemStatus !== 'available') || currentlyRented) {
                    if (scanResult) scanResult.innerHTML = `<span class='error'>✗ Item ${foundItem.name} (${foundItem.id}) is not available for rental (Status: ${itemStatus})</span>`;
                    setTimeout(() => { e.target.value = ''; }, 200);
                    return;
                }
            } else if (mode === 'return') {
                // For return, item must be currently rented
                if (!currentlyRented) {
                    if (scanResult) scanResult.innerHTML = `<span class='error'>✗ Item ${foundItem.name} (${foundItem.id}) is not eligible for return</span>`;
                    setTimeout(() => { e.target.value = ''; }, 200);
                    return;
                }
            }

            // Ensure dropdown is populated for current mode, then select the item
            populateDropdowns(mode);

            // Find matching option by parsing values and comparing id
            let matched = false;
            Array.from(itemSelect.options).forEach((opt) => {
                try {
                    const valueObj = opt.value ? JSON.parse(opt.value) : null;
                    if (valueObj && valueObj.id === foundItem.id) {
                        itemSelect.value = opt.value;
                        matched = true;
                    }
                } catch (_) {
                    // ignore non-JSON placeholder option
                }
            });

            if (matched) {
                if (scanResult) scanResult.innerHTML = `<span class='info'>✓ Selected: ${foundItem.name} (${foundItem.id})</span>`;
            } else {
                if (scanResult) scanResult.innerHTML = `<span class='error'>✗ Unable to select item in dropdown</span>`;
            }

            // Clear input
            setTimeout(() => { e.target.value = ''; }, 200);
        });
    }

    // Barcode input logic
    const barcodeInput = document.getElementById('barcodeInput');
    const scanResult = document.getElementById('scanResult');
    const activateScanBtn = document.getElementById('activateScan');
    const deactivateScanBtn = document.getElementById('deactivateScan');
    const cancelTransactionBtn = document.getElementById('cancelTransaction');

    if (barcodeInput) {
        barcodeInput.focus();
        barcodeInput.disabled = false;
        barcodeInput.addEventListener('input', function (e) {
            // Prevent scan logic if input is disabled or a modal is open
            if (barcodeInput.disabled || document.querySelector('.modal.show')) {
                barcodeInput.value = '';
                return;
            }
            const scannedValue = e.target.value.trim();
            if (!scannedValue) return;

            // Play beep sound
            const beep = document.getElementById('beepSound');
            if (beep) { beep.currentTime = 0; beep.play(); }

            // Get current scan mode
            const scanMode = document.querySelector('input[name="scanMode"]:checked').value;

            if (scanMode === 'rent') {
                // Check scanning state
                const tempRenter = sessionStorage.getItem('tempRenter');
                const tempOfficer = sessionStorage.getItem('tempOfficer');

                if (!tempRenter) {
                    // First scan: look for student
                    const foundStudent = students.find(student => encodeStudentData(student.studentId) === scannedValue || student.studentId === scannedValue);
                    if (foundStudent) {
                        // Check for unpaid transactions before storing student info
                        checkUnpaidTransactions(foundStudent.studentId).then(hasUnpaid => {
                            if (hasUnpaid) {
                                scanResult.innerHTML = `<span class='error'>✗ Student ${foundStudent.studentName} (${foundStudent.studentId}) has unpaid transactions. Please pay the outstanding balance before renting items.</span>`;
                                // Clear the barcode input
                                setTimeout(() => {
                                    barcodeInput.value = '';
                                    if (!barcodeInput.disabled) barcodeInput.focus();
                                }, 200);
                            } else {
                                // Store student info temporarily
                                sessionStorage.setItem('tempRenter', JSON.stringify(foundStudent));
                                scanResult.innerHTML = `<span class='info'>✓ Student found: ${foundStudent.studentName} (${foundStudent.studentId}) - ${foundStudent.section}. Please scan officer ID to verify.</span>`;
                            }
                        }).catch(error => {
                            console.error('Error checking unpaid transactions:', error);
                            // On error, allow the student to proceed
                            sessionStorage.setItem('tempRenter', JSON.stringify(foundStudent));
                            scanResult.innerHTML = `<span class='info'>✓ Student found: ${foundStudent.studentName} (${foundStudent.studentId}) - ${foundStudent.section}. Please scan officer ID to verify.</span>`;
                        });
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ Student not found for barcode: ${scannedValue}</span>`;
                    }
                } else if (!tempOfficer) {
                    // Second scan: look for officer by barcode reference
                    const foundOfficer = officers.find(officer => encodeStudentData(officer.officerId) === scannedValue || officer.officerId === scannedValue);
                    if (foundOfficer) {
                        sessionStorage.setItem('tempOfficer', JSON.stringify(foundOfficer));
                        scanResult.innerHTML = `<span class='info'>✓ Officer verified: ${foundOfficer.officerName}. Please scan the item to rent.</span>`;
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ Officer not found for barcode: ${scannedValue}</span>`;
                    }
                } else {
                    // Third scan: look for item and process rental
                    let foundItem = inventoryItems.find(item =>
                        normalizeBarcode(item.barcode) === normalizeBarcode(scannedValue) ||
                        normalizeBarcode(item.id) === normalizeBarcode(scannedValue)
                    );
                    if (foundItem) {
                        // Check if item is reserved before processing
                        const itemStatus = (foundItem.status || 'available').toLowerCase();
                        if (itemStatus === 'reserved') {
                            const tempRenterObj = JSON.parse(tempRenter);
                            const currentStudentId = tempRenterObj ? tempRenterObj.studentId : '';
                            const reservedBy = foundItem.reservedBy || foundItem.currentRenter || '';

                            // Extract student ID from reservedBy
                            let reservedStudentId = '';
                            if (reservedBy) {
                                const match = reservedBy.match(/\(([^)]+)\)/);
                                reservedStudentId = match ? match[1].trim() : reservedBy.trim();
                            }

                            // Block if reserved by someone else
                            if (reservedStudentId && currentStudentId && reservedStudentId !== currentStudentId) {
                                scanResult.innerHTML = `<span class='error'>✗ Item ${foundItem.name} (${foundItem.id}) is reserved by ${reservedBy} and cannot be rented by other students</span>`;
                                setTimeout(() => {
                                    barcodeInput.value = '';
                                    if (!barcodeInput.disabled) barcodeInput.focus();
                                }, 200);
                                return;
                            }
                        }

                        scanResult.innerHTML = '';
                        handleRental(foundItem);
                        return; // Prevent error message after modal
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ Item not found for barcode: ${scannedValue}</span>`;
                    }
                }
            } else if (scanMode === 'return') {
                // Require officer verification before return
                const tempOfficer = sessionStorage.getItem('tempOfficer');
                if (!tempOfficer) {
                    // First scan: look for officer by barcode reference
                    const foundOfficer = officers.find(officer => encodeStudentData(officer.officerId) === scannedValue || officer.officerId === scannedValue);
                    if (foundOfficer) {
                        sessionStorage.setItem('tempOfficer', JSON.stringify(foundOfficer));
                        scanResult.innerHTML = `<span class='info'>✓ Officer verified: ${foundOfficer.officerName}. Please scan the item to return.`;
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ Officer not found for barcode: ${scannedValue}</span>`;
                    }
                } else {
                    // Second scan: look for item and ask confirmation before processing return
                    let foundItem = inventoryItems.find(item =>
                        normalizeBarcode(item.barcode) === normalizeBarcode(scannedValue) ||
                        normalizeBarcode(item.id) === normalizeBarcode(scannedValue)
                    );
                    if (foundItem) {
                        confirmReturn(foundItem);
                    } else {
                        scanResult.innerHTML = `<span class='error'>✗ Item not found for barcode: ${scannedValue}</span>`;
                    }
                }
            }

            setTimeout(() => {
                barcodeInput.value = '';
                if (!barcodeInput.disabled) barcodeInput.focus();
            }, 200);
        });

        // Keep focus on input
        document.addEventListener('click', function () {
            if (!barcodeInput.disabled) barcodeInput.focus();
        });
    }

    if (activateScanBtn) {
        activateScanBtn.addEventListener('click', function () {
            barcodeInput.disabled = false;
            barcodeInput.focus();
        });
    }

    if (deactivateScanBtn) {
        deactivateScanBtn.addEventListener('click', function () {
            barcodeInput.blur();
            barcodeInput.disabled = true;
        });
    }

    if (cancelTransactionBtn) {
        cancelTransactionBtn.addEventListener('click', function () {
            sessionStorage.removeItem('tempRenter');
            sessionStorage.removeItem('tempOfficer');
            if (scanResult) scanResult.innerHTML = 'Transaction cancelled. Ready for new scan.';
            if (barcodeInput) barcodeInput.value = '';
            if (barcodeInput && !barcodeInput.disabled) barcodeInput.focus();
        });
    }

    // Initial update of tables
    updateAvailableItemsTable();
    updateRentalRecordsTable();
    updateRentalHistoryTable();
});

// Set up real-time listeners for Firebase
function setupRealtimeListeners() {
    if (!rentalFirebaseService || !window.firebaseDb) {
        console.log('Firebase service not available for real-time listeners');
        return;
    }

    try {
        // Listen to inventory changes
        window.firebaseDb.collection('RentalSystem_inventory').onSnapshot((snapshot) => {
            console.log('Inventory updated in Firebase');
            inventoryItems = [];
            snapshot.forEach((doc) => {
                const itemData = doc.data();
                // Preserve all fields including rental times and reservation info
                inventoryItems.push({
                    id: doc.id,
                    ...itemData,
                    rentalStartTime: itemData.rentalStartTime || null,
                    rentalEndTime: itemData.rentalEndTime || null,
                    rentalHours: itemData.rentalHours || null,
                    reservedBy: itemData.reservedBy || itemData.currentRenter || '',
                    status: itemData.status || 'available'
                });
            });
            updateAvailableItemsTable();
            // Save to localStorage
            localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
            console.log(`Updated inventory: ${inventoryItems.length} items`);
        }, (error) => {
            console.error('Error listening to inventory:', error);
        });

        // Listen to rental records changes
        window.firebaseDb.collection('RentalSystem_rentalRecords').onSnapshot((snapshot) => {
            console.log('Rental records updated in Firebase');
            rentalRecords = [];
            snapshot.forEach((doc) => {
                rentalRecords.push({ id: doc.id, ...doc.data() });
            });
            updateRentalRecordsTable();
            updateRentalRecordsTable();
            updateRentalHistoryTable();
            // Save to localStorage
            localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
            console.log(`Updated rental records: ${rentalRecords.length} records`);
        }, (error) => {
            console.error('Error listening to rental records:', error);
        });

        console.log('Real-time listeners set up successfully');
    } catch (error) {
        console.error('Error setting up real-time listeners:', error);
    }
}

// Initialize default inventory items
function initializeDefaultInventory() {
    inventoryItems = [
        { id: 'SH001', name: 'Shoe Covers', barcode: 'SH001', status: 'available' },
        { id: 'SH002', name: 'Shoe Covers', barcode: 'SH002', status: 'available' },
        { id: 'AR001', name: 'Arnis', barcode: 'AR001', status: 'available' },
        { id: 'AR002', name: 'Arnis', barcode: 'AR002', status: 'available' },
        { id: 'CALC001', name: 'Calculator', barcode: 'CALC001', status: 'available' },
        { id: 'CALC002', name: 'Calculator', barcode: 'CALC002', status: 'available' }
    ];
    localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
}

// Initialize default officers
function initializeDefaultOfficers() {
    officers = [
        { officerId: 'OFF001', officerName: 'John Doe', position: 'Librarian' },
        { officerId: 'OFF002', officerName: 'Jane Smith', position: 'Assistant Librarian' }
    ];
    localStorage.setItem('barcodeOfficers', JSON.stringify(officers));
}

// Helper to normalize barcodes/IDs for comparison
function normalizeBarcode(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Handle rental process
/**
 * Check if a student has unpaid transactions
 * @param {string} studentId - The student ID to check
 * @returns {Promise<boolean>} - Returns true if student has unpaid transactions
 */
async function checkUnpaidTransactions(studentId) {
    if (!studentId) {
        return false;
    }

    try {
        // Check Firebase first if available
        if (rentalFirebaseService && window.firebaseDb) {
            try {
                // Query Firebase for all rental records for this student (both active and returned)
                // We filter by renterId first, then check status and paymentStatus in JavaScript
                // This avoids needing a composite index
                const querySnapshot = await window.firebaseDb.collection('RentalSystem_rentalRecords')
                    .where('renterId', '==', studentId)
                    .get();

                // Check if any returned records have paymentStatus === 'unpaid'
                let hasUnpaid = false;
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const status = (data.status || '').toLowerCase().trim();
                    const paymentStatus = (data.paymentStatus || '').toLowerCase().trim();

                    // Check if record is returned and unpaid
                    if (status === 'returned' && paymentStatus === 'unpaid') {
                        hasUnpaid = true;
                    }
                });

                if (hasUnpaid) {
                    return true;
                }
            } catch (firebaseError) {
                console.error('Error querying Firebase for unpaid transactions:', firebaseError);
                // If Firebase query fails (e.g., no index), fall through to localStorage check
            }
        }

        // Fallback to check against the global rentalRecords array (updated in real-time)
        // or localStorage if the global array is not available
        let recordsToCheck = rentalRecords && rentalRecords.length > 0
            ? rentalRecords
            : JSON.parse(localStorage.getItem('rentalRecords') || '[]');

        const hasUnpaid = recordsToCheck.some(record =>
            record.renterId === studentId &&
            (record.status || '').toLowerCase().trim() === 'returned' &&
            (record.paymentStatus || '').toLowerCase().trim() === 'unpaid'
        );

        return hasUnpaid;
    } catch (error) {
        console.error('Error checking unpaid transactions:', error);
        // On error, still check localStorage as fallback
        try {
            // First try global rentalRecords array (updated in real-time)
            if (typeof rentalRecords !== 'undefined' && rentalRecords && rentalRecords.length > 0) {
                const hasUnpaid = rentalRecords.some(record =>
                    record.renterId === studentId &&
                    (record.status || '').toLowerCase().trim() === 'returned' &&
                    (record.paymentStatus || '').toLowerCase().trim() === 'unpaid'
                );
                if (hasUnpaid) return true;
            }

            // Fallback to localStorage
            let localRecords = JSON.parse(localStorage.getItem('rentalRecords') || '[]');
            return localRecords.some(record =>
                record.renterId === studentId &&
                (record.status || '').toLowerCase().trim() === 'returned' &&
                (record.paymentStatus || '').toLowerCase().trim() === 'unpaid'
            );
        } catch (e) {
            console.error('Error in fallback check:', e);
            return false; // Allow rental if check fails to avoid blocking legitimate transactions
        }
    }
}

function handleRental(item) {
    const scanResult = document.getElementById('scanResult');

    // Check item status from Firebase (source of truth)
    const itemStatus = (item.status || '').toLowerCase();

    // Get student and officer info from session storage
    const tempRenter = JSON.parse(sessionStorage.getItem('tempRenter'));
    const tempOfficer = JSON.parse(sessionStorage.getItem('tempOfficer'));

    if (!tempRenter) {
        scanResult.innerHTML = `<span class='error'>✗ Please scan student ID first</span>`;
        return;
    }

    if (!tempOfficer) {
        scanResult.innerHTML = `<span class='error'>✗ Please scan officer ID to verify</span>`;
        return;
    }

    // Check for unpaid transactions before allowing rental
    const studentId = tempRenter.studentId || '';
    checkUnpaidTransactions(studentId).then(hasUnpaid => {
        if (hasUnpaid) {
            scanResult.innerHTML = `<span class='error'>✗ This student has unpaid transactions. Please pay the outstanding balance before renting items.</span>`;
            // Clear the barcode input and re-enable it
            const barcodeInput = document.getElementById('barcodeInput');
            if (barcodeInput) {
                barcodeInput.value = '';
                barcodeInput.disabled = false;
                barcodeInput.focus();
            }
            // Clear temporary session data
            sessionStorage.removeItem('tempRenter');
            sessionStorage.removeItem('tempOfficer');
            return;
        }

        // Continue with rental process if no unpaid transactions
        proceedWithRental(item, tempRenter, tempOfficer, itemStatus, scanResult);
    }).catch(error => {
        console.error('Error checking unpaid transactions:', error);
        // On error, proceed with rental to avoid blocking legitimate transactions
        proceedWithRental(item, tempRenter, tempOfficer, itemStatus, scanResult);
    });
}

function proceedWithRental(item, tempRenter, tempOfficer, itemStatus, scanResult) {

    // Check if item is reserved - STRICT: Only the student who reserved it can rent it
    if (itemStatus === 'reserved') {
        const reservedBy = item.reservedBy || item.currentRenter || '';
        const studentId = tempRenter.studentId || '';

        // If item is reserved but no reservedBy info, block rental for safety
        if (!reservedBy) {
            scanResult.innerHTML = `<span class='error'>✗ Item ${item.name} (${item.id}) is reserved and cannot be rented (reservation information unavailable)</span>`;
            return;
        }

        // If no student ID available, block rental
        if (!studentId) {
            scanResult.innerHTML = `<span class='error'>✗ Item ${item.name} (${item.id}) is reserved and cannot be rented (student identification required)</span>`;
            return;
        }

        // Extract student ID from reservedBy field (format might be "Name (ID)" or just "ID")
        let reservedStudentId = '';
        // Try to extract ID from format "Name (ID)" or just use the whole string if it's just an ID
        const match = reservedBy.match(/\(([^)]+)\)/);
        if (match) {
            reservedStudentId = match[1].trim();
        } else {
            // If no parentheses, check if it's just an ID format
            reservedStudentId = reservedBy.trim();
        }

        // Strict comparison: Student ID must match exactly
        if (reservedStudentId && studentId && reservedStudentId === studentId) {
            // Allow rental - this student reserved it
            console.log('Item is reserved by the same student, allowing rental');
        } else {
            // Item is reserved by someone else - BLOCK rental
            scanResult.innerHTML = `<span class='error'>✗ Item ${item.name} (${item.id}) is reserved by ${reservedBy} and cannot be rented by other students</span>`;
            return;
        }
    }

    // Check if item is already rented
    if (itemStatus === 'rented') {
        scanResult.innerHTML = `<span class='error'>✗ Item ${item.name} (${item.id}) is already rented</span>`;
        return;
    }

    // Cross-check rentalRecords for active rental of this item (fallback check)
    // Use global rentalRecords array if available, otherwise fallback to localStorage
    const recordsToCheck = (typeof rentalRecords !== 'undefined' && rentalRecords && rentalRecords.length > 0)
        ? rentalRecords
        : JSON.parse(localStorage.getItem('rentalRecords') || '[]');
    const isRented = recordsToCheck.some(r => r.itemId === item.id && r.status === 'active');
    if (isRented && itemStatus !== 'reserved') {
        scanResult.innerHTML = `<span class='error'>✗ Item ${item.name} (${item.id}) is not available for rent</span>`;
        return;
    }

    // Disable barcode input while modal is open
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) barcodeInput.disabled = true;

    // Create and show rental hours modal
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class=\"modal-dialog\">
            <div class=\"modal-content\">
                <div class=\"modal-header\">
                    <h5 class=\"modal-title\">Enter Rental Duration</h5>
                    <button type=\"button\" class=\"btn-close\" onclick=\"closeRentalModal(this.closest('.modal'))\"></button>
                </div>
                <div class=\"modal-body\">
                    <p>Please enter the number of hours for rental (₱10 per hour)</p>
                    <div class=\"mb-3\">
                        <label for=\"rentalHours\" class=\"form-label\">Number of Hours:</label>
                        <input type=\"number\" class=\"form-control\" id=\"rentalHours\" min=\"1\" value=\"1\">
                    </div>
                    <div class=\"alert alert-info\">
                        <strong>Rental Details:</strong><br>
                        Student: ${tempRenter.studentName} (${tempRenter.studentId})<br>
                        Item: ${item.name} (${item.id})<br>
                        <span id=\"rateDisplay\">Rate: ₱10 for 1 hour</span>
                    </div>
                </div>
                <div class=\"modal-footer\">
                    <button type=\"button\" class=\"btn btn-secondary\" onclick=\"closeRentalModal(this.closest('.modal'))\">Cancel</button>
                    <button type=\"button\" class=\"btn btn-primary\" onclick=\"processRentalHours(${JSON.stringify(item).replace(/\"/g, '&quot;')}, this.closest('.modal'))\">Confirm Rental</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Add live update for rate
    setTimeout(() => {
        const rentalHoursInput = modal.querySelector('#rentalHours');
        const rateDisplay = modal.querySelector('#rateDisplay');
        if (rentalHoursInput && rateDisplay) {
            rentalHoursInput.addEventListener('input', function () {
                let hours = parseInt(rentalHoursInput.value);
                if (!hours || hours < 1) hours = 1;
                const total = hours * 10;
                rateDisplay.textContent = `Rate: ₱${total} for ${hours} hour${hours > 1 ? 's' : ''}`;
            });
        }
    }, 0);
}

// Add new function to process rental hours
async function processRentalHours(item, modal) {
    const rentalHoursInput = modal.querySelector('#rentalHours');
    const rentalHours = parseInt(rentalHoursInput.value);

    if (!rentalHours || isNaN(rentalHours) || rentalHours <= 0) {
        alert('Please enter a valid number of hours (minimum 1 hour)');
        return;
    }

    const tempRenter = JSON.parse(sessionStorage.getItem('tempRenter'));
    const tempOfficer = JSON.parse(sessionStorage.getItem('tempOfficer'));

    const rentalDate = new Date();
    const dueDate = new Date(rentalDate.getTime() + (rentalHours * 60 * 60 * 1000)); // Add hours to rental date
    const baseCost = rentalHours * 10; // ₱10 per hour

    const rental = {
        itemId: item.id,
        itemName: item.name,
        renterId: tempRenter.studentId,
        renterName: tempRenter.studentName,
        renterSection: tempRenter.section,
        officerId: tempOfficer.officerId,
        officerName: tempOfficer.officerName,
        rentalDate: rentalDate.toISOString(),
        dueDate: dueDate.toISOString(),
        rentalHours: rentalHours,
        baseCost: baseCost,
        status: 'active'
    };

    // Update item status
    item.status = 'rented';
    item.currentRenter = `${tempRenter.studentName} (${tempRenter.studentId})`;

    // Save to Firebase or localStorage
    if (rentalFirebaseService) {
        try {
            await rentalFirebaseService.updateInventoryItem(item.id, item);
            await rentalFirebaseService.addRentalRecord(rental);
            console.log('Rental record saved to Firebase');
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            // Fallback to localStorage
            localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
            rentalRecords.push(rental);
            localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
        }
    } else {
        // Fallback to localStorage
        localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
        rentalRecords.push(rental);
        localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
    }

    // Clear temporary info
    sessionStorage.removeItem('tempRenter');
    sessionStorage.removeItem('tempOfficer');

    // Remove the modal
    modal.remove();

    // Re-enable barcode input
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.disabled = false;
        barcodeInput.value = '';
        barcodeInput.focus();
    }

    // Update scan result
    const scanResult = document.getElementById('scanResult');
    scanResult.innerHTML = `<span class='success'>✓ Successfully rented ${item.name} (${item.id}) to ${tempRenter.studentName} (${tempRenter.studentId}) by ${tempOfficer.officerName} for ${rentalHours} hours</span>`;

    // Update tables
    updateAvailableItemsTable();
    updateRentalRecordsTable();
    updateRentalHistoryTable();
}

// Function to close the rental modal and re-enable barcode input
function closeRentalModal(modal) {
    modal.remove();
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) {
        barcodeInput.disabled = false;
        barcodeInput.value = '';
        barcodeInput.focus();
    }
}

// Handle return process
async function handleReturn(item) {
    const activeRental = rentalRecords.find(record =>
        record.itemId === item.id && record.status === 'active'
    );

    if (!activeRental) {
        scanResult.innerHTML = `<span class='error'>✗ No active rental found for ${item.name} (${item.id})</span>`;
        return;
    }

    // Get officer info from session storage
    const tempOfficer = JSON.parse(sessionStorage.getItem('tempOfficer'));
    if (!tempOfficer) {
        scanResult.innerHTML = `<span class='error'>✗ Please scan officer ID to verify return</span>`;
        return;
    }

    // Calculate rental duration and cost (robust for older records)
    const rentalDate = new Date(activeRental.rentalDate);
    const returnDate = new Date();
    const dueDate = activeRental.dueDate ? new Date(activeRental.dueDate) : null;

    // Determine base hours and cost if missing
    let rentalHoursVal = (typeof activeRental.rentalHours === 'number' && !isNaN(activeRental.rentalHours))
        ? activeRental.rentalHours
        : null;
    if (rentalHoursVal == null && dueDate) {
        const diffMs = Math.max(0, dueDate - rentalDate);
        rentalHoursVal = Math.max(1, Math.round(diffMs / (1000 * 60 * 60))); // round to nearest hour
    }
    const baseCostVal = (typeof activeRental.baseCost === 'number' && !isNaN(activeRental.baseCost))
        ? activeRental.baseCost
        : (rentalHoursVal ? rentalHoursVal * 10 : 0);

    // Calculate overtime if any
    let overtimeCost = 0;
    let overtimeMinutes = 0;
    if (dueDate && returnDate > dueDate) {
        overtimeMinutes = Math.ceil((returnDate - dueDate) / (1000 * 60)); // Convert to minutes
        overtimeCost = Math.ceil(overtimeMinutes / 30) * 5; // ₱5 per 30 minutes or less
    }

    const totalCost = baseCostVal + overtimeCost;

    // Update rental record with return information
    activeRental.returnDate = returnDate.toISOString();
    activeRental.status = 'returned';
    activeRental.returningOfficerId = tempOfficer.officerId;
    activeRental.returningOfficerName = tempOfficer.officerName;
    activeRental.overtimeMinutes = overtimeMinutes;
    activeRental.overtimeCost = overtimeCost;
    activeRental.totalCost = totalCost;
    activeRental.paymentStatus = 'unpaid';

    // Update item status
    item.status = 'available';
    item.lastRenter = item.currentRenter || item.reservedBy || '';
    item.currentRenter = '';
    item.reservedBy = '';  // Clear reservedBy field
    item.rentalStartTime = null;  // Clear rental times
    item.rentalEndTime = null;
    item.rentalHours = null;

    // Save to Firebase or localStorage
    if (rentalFirebaseService) {
        try {
            await rentalFirebaseService.updateInventoryItem(item.id, item);
            await rentalFirebaseService.updateRentalRecord(activeRental.id, activeRental);
            console.log('Item status and rental record updated in Firebase');
        } catch (error) {
            console.error('Error updating Firebase:', error);
            // Fallback to localStorage
            localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
            localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
        }
    } else {
        // Fallback to localStorage
        localStorage.setItem('inventoryItems', JSON.stringify(inventoryItems));
        localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
    }

    // Create and show custom payment popup
    // Disable scanning while popup is open
    const barcodeInputMain = document.getElementById('barcodeInput');
    if (barcodeInputMain) barcodeInputMain.disabled = true;
    const popup = document.createElement('div');
    popup.className = 'modal fade show';
    popup.style.display = 'block';
    popup.style.backgroundColor = 'rgba(0,0,0,0.5)';
    popup.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Rental Payment</h5>
                    <button type="button" class="btn-close" onclick="closePaymentDialog('${item.id}', '${returnDate.toISOString()}', document.getElementById('customTotalCost') ? document.getElementById('customTotalCost').value : ''); this.closest('.modal').remove(); const inp=document.getElementById('barcodeInput'); if (inp) { inp.disabled=false; inp.focus(); }"></button>
                </div>
                <div class="modal-body">
                    <p>Base Cost (${rentalHoursVal || 0} ${rentalHoursVal === 1 ? 'hour' : 'hours'}): ₱${baseCostVal}</p>
                    ${overtimeMinutes > 0 ? `<p>Overtime (${overtimeMinutes} minutes): ₱${overtimeCost}</p>` : ''}
                    <p class="mb-2"><strong>Total Cost (calculated): ₱${totalCost}</strong></p>
                    <div class="mb-2">
                        <label for="customTotalCost" class="form-label">Modify Total (optional)</label>
                        <input type="number" class="form-control" id="customTotalCost" step="0.01" min="0" value="${totalCost}">
                        <small class="form-text text-muted">Adjust this if you need to override the total to collect.</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closePaymentDialog('${item.id}', '${returnDate.toISOString()}', document.getElementById('customTotalCost') ? document.getElementById('customTotalCost').value : ''); this.closest('.modal').remove(); const inp=document.getElementById('barcodeInput'); if (inp) { inp.disabled=false; inp.focus(); }">Close</button>
                    <button type="button" class="btn btn-success" onclick="handlePayment('${item.id}', '${returnDate.toISOString()}', document.getElementById('customTotalCost') ? document.getElementById('customTotalCost').value : ''); this.closest('.modal').remove(); const inp=document.getElementById('barcodeInput'); if (inp) { inp.disabled=false; inp.focus(); }">Mark as Paid</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    // Persist normalized values on the record for future consistency
    activeRental.rentalHours = rentalHoursVal || activeRental.rentalHours;
    activeRental.baseCost = baseCostVal;

    // Clear temporary info
    sessionStorage.removeItem('tempOfficer');

    scanResult.innerHTML = `<span class='success'>✓ Successfully returned ${item.name} (${item.id}) by ${tempOfficer.officerName}</span>`;

    // Update tables
    updateAvailableItemsTable();
    updateRentalRecordsTable();
    updateRentalHistoryTable();
}

// Add function to handle payment (marks as paid)
async function handlePayment(itemId, returnDate, customTotal) {
    const rental = rentalRecords.find(record => record.itemId === itemId && record.returnDate === returnDate);
    if (rental) {
        // Compute original totals
        const originalBase = typeof rental.baseCost === 'number' ? rental.baseCost : 0;
        const originalOvertimeCost = typeof rental.overtimeCost === 'number' ? rental.overtimeCost : 0;
        const originalTotal = typeof rental.totalCost === 'number' ? rental.totalCost : (originalBase + originalOvertimeCost);

        // Apply custom total if provided and valid and adjust overtime/time accordingly
        const parsedCustom = typeof customTotal === 'string' ? parseFloat(customTotal) : NaN;
        if (!isNaN(parsedCustom) && parsedCustom >= 0) {
            // Determine discount in multiples of ₱5
            const discount = Math.max(0, originalTotal - parsedCustom);
            const steps = Math.floor(discount / 5); // each step = ₱5

            if (steps > 0) {
                const minutesPerStep = 30;
                let minutesToAdjust = steps * minutesPerStep;
                let totalMinutesAdjusted = 0;

                // First reduce overtime minutes
                const currentOvertime = typeof rental.overtimeMinutes === 'number' ? rental.overtimeMinutes : 0;
                const usedForOvertime = Math.min(currentOvertime, minutesToAdjust);
                totalMinutesAdjusted += usedForOvertime;
                const remainingAfterOvertime = minutesToAdjust - usedForOvertime;

                const newOvertimeMinutes = Math.max(0, currentOvertime - usedForOvertime);
                rental.overtimeMinutes = newOvertimeMinutes;
                rental.overtimeCost = Math.ceil(newOvertimeMinutes / 30) * 5;

                // If discount remains, it means overtime is fully cleared; move the return time earlier
                if (remainingAfterOvertime > 0) {
                    const stepsLeft = Math.floor(remainingAfterOvertime / minutesPerStep);
                    totalMinutesAdjusted += stepsLeft * minutesPerStep;
                }

                // Shift return date earlier by the total minutes adjusted so history reflects the change
                if (totalMinutesAdjusted > 0) {
                    const currentReturn = new Date(rental.returnDate || returnDate);
                    const adjustedReturn = new Date(currentReturn.getTime() - totalMinutesAdjusted * 60 * 1000);
                    const startDate = new Date(rental.rentalDate);
                    rental.returnDate = (adjustedReturn < startDate ? startDate : adjustedReturn).toISOString();
                }
            }

            rental.totalCost = parsedCustom;
        }
        rental.paymentStatus = 'paid';

        // Save to Firebase or localStorage
        if (rentalFirebaseService) {
            try {
                await rentalFirebaseService.updateRentalRecord(rental.id, rental);
                console.log('Payment status updated in Firebase');
            } catch (error) {
                console.error('Error updating payment in Firebase:', error);
                // Fallback to localStorage
                localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
            }
        } else {
            // Fallback to localStorage
            localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
        }

        updateRentalRecordsTable();
        // Show success message
        const scanResult = document.getElementById('scanResult');
        if (scanResult) {
            const amount = typeof rental.totalCost === 'number' ? rental.totalCost : (typeof rental.baseCost === 'number' ? rental.baseCost : 0);
            scanResult.innerHTML = `<span class='success'>✓ Payment marked as paid for item ${rental.itemName} (${rental.itemId}) — Amount: ₱${amount}</span>`;
        }
    }
}

// Add function to close payment dialog (ensures payment status is unpaid)
async function closePaymentDialog(itemId, returnDate, customTotal) {
    const rental = rentalRecords.find(record => record.itemId === itemId && record.returnDate === returnDate);
    if (rental) {
        // Apply custom total if provided and valid (same logic as handlePayment)
        const originalBase = typeof rental.baseCost === 'number' ? rental.baseCost : 0;
        const originalOvertimeCost = typeof rental.overtimeCost === 'number' ? rental.overtimeCost : 0;
        const originalTotal = typeof rental.totalCost === 'number' ? rental.totalCost : (originalBase + originalOvertimeCost);

        const parsedCustom = typeof customTotal === 'string' ? parseFloat(customTotal) : NaN;
        if (!isNaN(parsedCustom) && parsedCustom >= 0) {
            // Determine discount in multiples of ₱5
            const discount = Math.max(0, originalTotal - parsedCustom);
            const steps = Math.floor(discount / 5);

            if (steps > 0) {
                const minutesPerStep = 30;
                let minutesToAdjust = steps * minutesPerStep;
                let totalMinutesAdjusted = 0;

                const currentOvertime = typeof rental.overtimeMinutes === 'number' ? rental.overtimeMinutes : 0;
                const usedForOvertime = Math.min(currentOvertime, minutesToAdjust);
                totalMinutesAdjusted += usedForOvertime;
                const remainingAfterOvertime = minutesToAdjust - usedForOvertime;

                const newOvertimeMinutes = Math.max(0, currentOvertime - usedForOvertime);
                rental.overtimeMinutes = newOvertimeMinutes;
                rental.overtimeCost = Math.ceil(newOvertimeMinutes / 30) * 5;

                if (remainingAfterOvertime > 0) {
                    const stepsLeft = Math.floor(remainingAfterOvertime / minutesPerStep);
                    totalMinutesAdjusted += stepsLeft * minutesPerStep;
                }

                if (totalMinutesAdjusted > 0) {
                    const currentReturn = new Date(rental.returnDate || returnDate);
                    const adjustedReturn = new Date(currentReturn.getTime() - totalMinutesAdjusted * 60 * 1000);
                    const startDate = new Date(rental.rentalDate);
                    rental.returnDate = (adjustedReturn < startDate ? startDate : adjustedReturn).toISOString();
                }
            }

            rental.totalCost = parsedCustom;
        }

        // Ensure payment status is unpaid
        rental.paymentStatus = 'unpaid';

        // Save to Firebase or localStorage
        if (rentalFirebaseService) {
            try {
                await rentalFirebaseService.updateRentalRecord(rental.id, rental);
                console.log('Payment status set to unpaid in Firebase');
            } catch (error) {
                console.error('Error updating payment in Firebase:', error);
                // Fallback to localStorage
                localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
            }
        } else {
            // Fallback to localStorage
            localStorage.setItem('rentalRecords', JSON.stringify(rentalRecords));
        }

        updateRentalRecordsTable();
        // Update history table if it exists (for rental-history.html page)
        if (typeof updateRentalHistoryTable === 'function') {
            updateRentalHistoryTable();
        } else if (typeof updateRentalHistoryTableStandalone === 'function') {
            updateRentalHistoryTableStandalone();
        }
    }
}

// Helper function to format Firebase Timestamp or Date
function formatDateTime(dateValue) {
    if (!dateValue) return '';

    let date;
    // Handle Firebase Timestamp object
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
    }
    // Handle Firestore Timestamp with seconds/nanoseconds
    else if (dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
    }
    // Handle Date object or ISO string
    else if (dateValue instanceof Date) {
        date = dateValue;
    }
    else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
    }
    else {
        return '';
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '';
    }

    // Format: MM/DD/YYYY HH:MM AM/PM
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-US', options);
}

// Update available items table
function updateAvailableItemsTable() {
    const tbody = document.getElementById('availableItems');
    if (!tbody) return;

    tbody.innerHTML = '';
    // Get filter value
    const filter = document.getElementById('itemFilter');
    let filtered = inventoryItems;
    if (filter && filter.value !== 'all') {
        filtered = filtered.filter(item => item.name === filter.value);
    }

    // Ensure all items have required fields and preserve Firebase status
    filtered = filtered.map(item => {
        // Preserve Firebase status as source of truth
        const firebaseStatus = (item.status || '').toLowerCase();

        // Only check local rental records if Firebase doesn't have a status
        if (!firebaseStatus || firebaseStatus === 'available') {
            const isRented = rentalRecords.some(r => r.itemId === item.id && r.status === 'active');
            if (isRented) {
                return {
                    ...item,
                    status: 'rented'
                };
            }
        }

        // Preserve Firebase status and rental times
        return {
            ...item,
            status: item.status || 'available',
            rentalStartTime: item.rentalStartTime || null,
            rentalEndTime: item.rentalEndTime || null,
            reservedBy: item.reservedBy || item.currentRenter || '',
            currentRenter: item.currentRenter || ''
        };
    });

    // Sort: available first, then reserved, then rented, then by numeric part of ID
    filtered = filtered.sort((a, b) => {
        const statusA = (a.status || '').toLowerCase();
        const statusB = (b.status || '').toLowerCase();

        if (statusA !== statusB) {
            if (statusA === 'available') return -1;
            if (statusB === 'available') return 1;
            if (statusA === 'reserved') return -1;
            if (statusB === 'reserved') return 1;
        }

        const prefixA = a.id.match(/^[A-Z]+/i)?.[0] || '';
        const prefixB = b.id.match(/^[A-Z]+/i)?.[0] || '';
        if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
        const numA = parseInt(a.id.replace(/^[A-Z]+/i, ''), 10);
        const numB = parseInt(b.id.replace(/^[A-Z]+/i, ''), 10);
        return numA - numB;
    });

    filtered.forEach(item => {
        const status = (item.status || 'available').toLowerCase();
        let statusBadge = '';
        let renterInfo = '';
        let rentalStartTime = '';
        let rentalEndTime = '';

        // Format rental times for reserved or rented items
        if (status === 'reserved' || status === 'rented') {
            rentalStartTime = formatDateTime(item.rentalStartTime);
            rentalEndTime = formatDateTime(item.rentalEndTime);
        }

        // Determine status badge and renter info
        if (status === 'reserved') {
            statusBadge = '<span class="badge bg-warning text-dark">Reserved</span>';
            renterInfo = item.reservedBy || item.currentRenter || 'Reserved';
        } else if (status === 'rented') {
            statusBadge = '<span class="badge bg-danger">Rented</span>';
            renterInfo = item.currentRenter || 'Rented';
        } else {
            statusBadge = '<span class="badge bg-success">Available</span>';
            renterInfo = '';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${statusBadge}</td>
            <td>${renterInfo}</td>
            <td>${rentalStartTime || '-'}</td>
            <td>${rentalEndTime || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update rental records table
function updateRentalRecordsTable() {
    const tbody = document.getElementById('rentalRecords');
    if (!tbody) return;

    tbody.innerHTML = '';
    const now = new Date();

    rentalRecords.filter(record => record.status !== 'returned').forEach((record, idx) => {
        const rentalDate = new Date(record.rentalDate);
        const dueDate = record.dueDate ? new Date(record.dueDate) : null;

        // Calculate expected return and time remaining
        let expectedReturn = dueDate ? dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
        // Use a span with a unique id for live update
        let timeRemainingId = `time-remaining-${idx}`;

        // Calculate dynamic price (base + overtime if overdue)
        let price = typeof record.baseCost === 'number' ? record.baseCost : 0;
        let overtimeCost = 0;
        if (dueDate) {
            let now = new Date();
            if (now > dueDate) {
                let overtimeMinutes = Math.ceil((now - dueDate) / (1000 * 60));
                overtimeCost = Math.ceil(overtimeMinutes / 30) * 5; // ₱5 per 30 minutes or part thereof
            }
        }
        let totalPrice = price + overtimeCost;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.itemId}</td>
            <td>${record.itemName}</td>
            <td>${record.renterName}</td>
            <td>${record.renterSection}</td>
            <td>${rentalDate.toLocaleTimeString()}</td>
            <td>${expectedReturn}</td>
            <td><span id="${timeRemainingId}"></span></td>
            <td>₱${totalPrice}</td>
            <td>${record.status}</td>
        `;
        tbody.appendChild(row);
        // Initial update
        updateTimeRemainingSpan(timeRemainingId, dueDate);
    });
}

// Helper to update a single time remaining span
function updateTimeRemainingSpan(spanId, dueDate) {
    const span = document.getElementById(spanId);
    if (!span || !dueDate) return;
    let now = new Date();
    let diff = dueDate - now;
    let overdue = false;
    if (diff < 0) {
        overdue = true;
        diff = -diff;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    let timeRemaining = `${hours.toString().padStart(2, '0')}:${minutes
        .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (overdue) timeRemaining = `-${timeRemaining}`;
    span.textContent = timeRemaining;
}

// Set up live updating for rental records table
if (typeof window !== 'undefined') {
    if (window.rentalRecordsInterval) clearInterval(window.rentalRecordsInterval);
    window.rentalRecordsInterval = setInterval(() => {
        const tbody = document.getElementById('rentalRecords');
        if (!tbody) return;
        // For each row, update the time remaining span
        rentalRecords.filter(record => record.status !== 'returned').forEach((record, idx) => {
            const dueDate = record.dueDate ? new Date(record.dueDate) : null;
            updateTimeRemainingSpan(`time-remaining-${idx}`, dueDate);
        });
    }, 1000);
}

function updateRentalHistoryTable() {
    const tbody = document.getElementById('rentalHistoryRecords');
    if (!tbody) return;
    const dateInput = document.getElementById('historyDateFilter');
    let filterDate = dateInput && dateInput.value ? new Date(dateInput.value) : null;
    tbody.innerHTML = '';
    rentalRecords.forEach(record => {
        const rentalDateObj = new Date(record.rentalDate);
        const rentalDate = rentalDateObj.toLocaleDateString();
        const timeRented = rentalDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let timeReturned = '';
        if (record.returnDate) {
            const returnDateObj = new Date(record.returnDate);
            timeReturned = returnDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        // Filter by date if selected
        if (filterDate) {
            const recordDate = new Date(record.rentalDate);
            if (recordDate.toLocaleDateString() !== filterDate.toLocaleDateString()) {
                return;
            }
        }
        // Calculate expected return and time remaining
        const dueDate = record.dueDate ? new Date(record.dueDate) : null;
        let expectedReturn = dueDate ? dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
        let timeRemaining = '-';
        if (dueDate) {
            let compareDate = record.status === 'returned' ? new Date(record.returnDate) : new Date();
            let diff = dueDate - compareDate;
            let overdue = false;
            if (diff < 0) {
                overdue = true;
                diff = -diff;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            timeRemaining = `${hours.toString().padStart(2, '0')}:${minutes
                .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (overdue) timeRemaining = `-${timeRemaining}`;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.itemId}</td>
            <td>${record.itemName}</td>
            <td>${record.renterName} (${record.renterId})</td>
            <td>${record.renterSection}</td>
            <td>${rentalDate}</td>
            <td>${timeRented}</td>
            <td>${expectedReturn}</td>
            <td>${timeReturned}</td>
            <td>${timeRemaining}</td>
            <td>${record.status}</td>
            <td>${record.officerName ? record.officerName : ''}</td>
            <td>${record.returningOfficerName ? record.returningOfficerName : ''}</td>
            <td>${typeof record.totalCost === 'number' ? '₱' + record.totalCost : (typeof record.baseCost === 'number' ? '₱' + record.baseCost : '-')}</td>
            <td>${record.paymentStatus || '-'}</td>
            <td>
                ${(record.paymentStatus === 'unpaid' && record.status === 'returned') ? `<button class=\"btn btn-success btn-sm\" onclick=\"markAsPaid('${record.itemId}', '${record.returnDate}')\">Mark as Paid</button>` : '-'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Function to populate dropdowns for manual input
function populateDropdowns(mode = 'rent') {
    const itemSelect = document.getElementById('itemSelect');

    // Clear existing options
    itemSelect.innerHTML = '<option value="">Choose an item...</option>';

    // Build items list (all items visible)
    const items = inventoryItems.slice();

    // Sort by name (alphabetically), then by numeric part of ID
    items.sort((a, b) => {
        const byName = a.name.localeCompare(b.name);
        if (byName !== 0) return byName;
        const prefixA = a.id.match(/^[A-Z]+/i)?.[0] || '';
        const prefixB = b.id.match(/^[A-Z]+/i)?.[0] || '';
        if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
        const numA = parseInt(a.id.replace(/^[A-Z]+/i, ''), 10);
        const numB = parseInt(b.id.replace(/^[A-Z]+/i, ''), 10);
        return numA - numB;
    });

    // Create grouped sections for a cleaner, more professional look
    const createGroup = (label) => {
        const group = document.createElement('optgroup');
        group.label = label;
        return group;
    };

    const isItemRented = (item) => rentalRecords.some(r => r.itemId === item.id && r.status === 'active');

    if (mode === 'rent') {
        const availableGroup = createGroup('Available to Rent');
        const reservedGroup = createGroup('Reserved');
        const unavailableGroup = createGroup('Unavailable');

        items.forEach(item => {
            const itemStatus = (item.status || 'available').toLowerCase();
            const rented = isItemRented(item);
            const option = document.createElement('option');
            option.value = JSON.stringify(item);
            option.textContent = `${item.name} (${item.id})`;

            // Get current student info from sessionStorage to check if they reserved the item
            const tempRenter = JSON.parse(sessionStorage.getItem('tempRenter') || 'null');
            const currentStudentId = tempRenter ? tempRenter.studentId : '';

            if (itemStatus === 'available' && !rented) {
                // Fully available items
                availableGroup.appendChild(option);
            } else if (itemStatus === 'reserved' && !rented) {
                // Reserved items - check if reserved by current student
                const reservedBy = item.reservedBy || item.currentRenter || '';

                // Extract student ID from reservedBy
                let reservedStudentId = '';
                if (reservedBy) {
                    const match = reservedBy.match(/\(([^)]+)\)/);
                    reservedStudentId = match ? match[1].trim() : reservedBy.trim();
                }

                // Check if this item is reserved by the current student
                const isReservedByCurrentStudent = reservedStudentId && currentStudentId && reservedStudentId === currentStudentId;

                if (reservedBy) {
                    option.textContent += ` — Reserved by ${reservedBy}`;
                } else {
                    option.textContent += ` — Reserved`;
                }

                // Disable option if reserved by someone else
                if (!isReservedByCurrentStudent && reservedStudentId) {
                    option.disabled = true;
                    option.textContent += ' (Not available for other students)';
                    unavailableGroup.appendChild(option);
                } else {
                    // Allow selection if reserved by current student or student ID not available (will be validated in handleRental)
                    reservedGroup.appendChild(option);
                }
            } else {
                // Unavailable items (rented or other status)
                option.disabled = true;
                if (item.currentRenter) {
                    option.textContent += ` — Rented by ${item.currentRenter}`;
                } else if (itemStatus === 'rented') {
                    option.textContent += ` — Rented`;
                }
                unavailableGroup.appendChild(option);
            }
        });

        // Add counts to labels
        availableGroup.label += ` (${availableGroup.children.length})`;
        reservedGroup.label += ` (${reservedGroup.children.length})`;
        unavailableGroup.label += ` (${unavailableGroup.children.length})`;

        if (availableGroup.children.length) itemSelect.appendChild(availableGroup);
        if (reservedGroup.children.length) itemSelect.appendChild(reservedGroup);
        if (unavailableGroup.children.length) itemSelect.appendChild(unavailableGroup);
    } else { // return mode
        const rentedGroup = createGroup('Currently Rented');
        const notRentedGroup = createGroup('Not Rented');

        items.forEach(item => {
            const rented = isItemRented(item);
            const option = document.createElement('option');
            option.value = JSON.stringify(item);
            option.textContent = `${item.name} (${item.id})`;

            if (rented) {
                if (item.currentRenter) option.textContent += ` — Rented by ${item.currentRenter}`;
                rentedGroup.appendChild(option);
            } else {
                option.disabled = true;
                notRentedGroup.appendChild(option);
            }
        });

        rentedGroup.label += ` (${rentedGroup.children.length})`;
        notRentedGroup.label += ` (${notRentedGroup.children.length})`;

        if (rentedGroup.children.length) itemSelect.appendChild(rentedGroup);
        if (notRentedGroup.children.length) itemSelect.appendChild(notRentedGroup);
    }
}

// Function to handle manual transactions (both rental and return)
function handleManualTransaction() {
    const scanMode = document.querySelector('input[name="scanMode"]:checked').value;
    const itemSelect = document.getElementById('itemSelect');
    const scanResult = document.getElementById('scanResult');

    // Get officer from session storage (should be set by barcode scan)
    const tempOfficer = sessionStorage.getItem('tempOfficer');

    if (!tempOfficer) {
        scanResult.innerHTML = '<span class="error">✗ Please scan officer barcode first</span>';
        return;
    }

    if (!itemSelect.value) {
        scanResult.innerHTML = '<span class="error">✗ Please select an item</span>';
        return;
    }

    const item = JSON.parse(itemSelect.value);

    if (scanMode === 'rent') {
        const studentName = document.getElementById('studentName');
        const studentId = document.getElementById('studentId');
        const studentSection = document.getElementById('studentSection');

        // Validate student inputs for rental
        if (!studentName.value || !studentId.value || !studentSection.value) {
            scanResult.innerHTML = '<span class="error">✗ Please fill in all student information</span>';
            return;
        }

        // Create student object
        const student = {
            studentName: studentName.value,
            studentId: studentId.value,
            section: studentSection.value
        };

        // Store student in session storage (officer already stored from barcode scan)
        sessionStorage.setItem('tempRenter', JSON.stringify(student));

        // Process the rental
        handleRental(item);

        // Reset student form after successful rental
        studentName.value = '';
        studentId.value = '';
        studentSection.value = '';
    } else {
        // Ask confirmation before processing return
        confirmReturn(item);
    }

    // Reset item selection
    itemSelect.value = '';
}

// Show confirmation modal before returning an item
function confirmReturn(item) {
    const tempOfficer = JSON.parse(sessionStorage.getItem('tempOfficer') || 'null');
    const activeRental = rentalRecords.find(record => record.itemId === item.id && record.status === 'active');
    // Enforce: only active rentals can be returned
    if (!activeRental) {
        const scanResult = document.getElementById('scanResult');
        if (scanResult) {
            scanResult.innerHTML = `<span class='error'>✗ ${item.name} (${item.id}) has no active rental and cannot be returned</span>`;
        }
        const barcodeInputRestore = document.getElementById('barcodeInput');
        if (barcodeInputRestore) { barcodeInputRestore.disabled = false; barcodeInputRestore.focus(); }
        return;
    }
    const renterLabel = activeRental ? `${activeRental.renterName} (${activeRental.renterId})` : 'Unknown';

    // Temporarily disable barcode input to avoid accidental scans
    const barcodeInput = document.getElementById('barcodeInput');
    if (barcodeInput) barcodeInput.disabled = true;

    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Confirm Return</h5>
                    <button type="button" class="btn-close" onclick="this.closest('.modal').remove(); const inp=document.getElementById('barcodeInput'); if (inp) { inp.disabled=false; inp.focus(); }"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to return <strong>${item.name} (${item.id})</strong>?</p>
                    <ul class="mb-0">
                        <li>Renter: <strong>${renterLabel}</strong></li>
                        ${tempOfficer ? `<li>Officer: <strong>${tempOfficer.officerName} (${tempOfficer.officerId})</strong></li>` : ''}
                    </ul>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove(); const inp=document.getElementById('barcodeInput'); if (inp) { inp.disabled=false; inp.focus(); }">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirmReturnBtn">Confirm Return</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Wire confirm button
    const confirmBtn = modal.querySelector('#confirmReturnBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            modal.remove();
            if (barcodeInput) { barcodeInput.disabled = false; barcodeInput.focus(); }
            handleReturn(item);
        });
    }
}

// Add event listener for date filter
const historyDateFilter = document.getElementById('historyDateFilter');
if (historyDateFilter) {
    historyDateFilter.addEventListener('input', updateRentalHistoryTable);
}
