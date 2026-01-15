// Firebase database service
let firebaseDB = null;

// Initialize Firebase
async function initializeFirebase() {
    try {
        firebaseDB = window.firebaseDB;
        if (!firebaseDB) {
            console.error('Firebase not initialized. Please check firebase-config.js');
            return false;
        }
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Store generated barcodes for bulk download
let generatedBarcodes = [];

// Initialize Firebase on page load
document.addEventListener('DOMContentLoaded', async function() {
    await initializeFirebase();
});

// Handle bulk barcode generation from Excel file
document.getElementById('bulkUploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select an Excel file');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            // Clear previous barcodes
            const bulkBarcodesContainer = document.getElementById('bulkBarcodes');
            bulkBarcodesContainer.innerHTML = '';
            generatedBarcodes = [];

            // Generate barcodes for each student
            for (let index = 0; index < jsonData.length; index++) {
                const row = jsonData[index];
                const studentId = row['Student ID'] || row['StudentID'] || row['Student Id'] || row['studentId'] || row['studentid'];
                const studentName = row['Student Name'] || row['StudentName'] || row['Name'] || row['studentName'] || row['studentname'] || row['name'];
                const section = row['Section'] || row['section'];

                if (!studentId || !studentName || !section) {
                    console.warn(`Skipping row ${index + 1}: Missing required data`);
                    continue;
                }

                // Create encoded reference number (barcode) using only studentId
                const referenceNumber = encodeStudentData(studentId);

                // Update/add student in database
                try {
                    await updateStudentDatabase(studentId, studentName, section);
                } catch (error) {
                    console.error(`Error updating student ${studentId}:`, error);
                }

                // Create container for this barcode
                const barcodeContainer = document.createElement('div');
                barcodeContainer.className = 'barcode-container mb-3';
                barcodeContainer.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">${studentName}</h6>
                            <p class="card-text">ID: ${studentId}<br>Section: ${section}</p>
                            <svg id="barcode-${index}" style="background: transparent;"></svg>
                        </div>
                    </div>
                `;
                bulkBarcodesContainer.appendChild(barcodeContainer);

                // Generate barcode
                JsBarcode(`#barcode-${index}`, referenceNumber, {
                    format: "CODE128",
                    width: 1,
                    height: 30,
                    displayValue: true,
                    fontSize: 8,
                    margin: 1,
                    background: "transparent"
                });

                // Store barcode data for bulk download
                generatedBarcodes.push({
                    studentId,
                    studentName,
                    section,
                    referenceNumber
                });
            }

            // Show download all button if barcodes were generated
            if (generatedBarcodes.length > 0) {
                document.getElementById('downloadAllBarcodes').style.display = 'inline-block';
            }
        } catch (error) {
            console.error('Error processing Excel file:', error);
            alert('Error processing Excel file. Please make sure it has the correct format.');
        }
    };
    reader.readAsArrayBuffer(file);
});

// Handle bulk download of barcodes
document.getElementById('downloadAllBarcodes').addEventListener('click', async function() {
    if (generatedBarcodes.length === 0) {
        alert('No barcodes to download');
        return;
    }

    const zip = new JSZip();
    const padding = 10; // pixels

    // Create a hidden container for barcode rendering
    let hiddenContainer = document.getElementById('hiddenBarcodeContainer');
    if (!hiddenContainer) {
        hiddenContainer = document.createElement('div');
        hiddenContainer.id = 'hiddenBarcodeContainer';
        hiddenContainer.style.display = 'none';
        document.body.appendChild(hiddenContainer);
    }
    hiddenContainer.innerHTML = '';

    for (const { studentId, studentName, referenceNumber } of generatedBarcodes) {
        // Create an SVG for this barcode
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        hiddenContainer.appendChild(svg);

        // Generate barcode
        JsBarcode(svg, referenceNumber, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 12,
            margin: 5,
            background: "transparent"
        });

        // Convert SVG to PNG
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        });

        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;
        // Remove the white background fill
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);

        // Add to zip
        zip.file(`Barcode_${studentId}_${studentName}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
    }

    // Generate and download zip file
    zip.generateAsync({ type: 'blob' }).then(function(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'Barcodes.zip';
        link.click();
        URL.revokeObjectURL(link.href);
    });
});

// Handle single barcode generation
document.getElementById('barcodeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('studentId').value;
    const studentName = document.getElementById('studentName').value;
    const section = document.getElementById('section').value;
    
    // Create encoded reference number (barcode) using only studentId
    const referenceNumber = encodeStudentData(studentId);
    
    // Update/add student in database
    try {
        await updateStudentDatabase(studentId, studentName, section);
    } catch (error) {
        console.error('Error updating student database:', error);
    }
    
    // Clear previous barcode
    const barcodeElement = document.getElementById('barcode');
    barcodeElement.innerHTML = '<svg id="single-barcode" style="background: transparent;"></svg>';
    
    try {
        // Generate barcode
        JsBarcode("#single-barcode", referenceNumber, {
            format: "CODE128",
            width: 1,
            height: 30,
            displayValue: true,
            fontSize: 8,
            margin: 1,
            background: "transparent"
        });
        
        // Show download button
        document.getElementById('downloadBarcode').style.display = 'inline-block';
    } catch (error) {
        console.error('Error generating barcode:', error);
        alert('Error generating barcode. Please try again.');
    }
});

// Handle single barcode download
document.getElementById('downloadBarcode').addEventListener('click', function() {
    const svg = document.querySelector('#single-barcode');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        // Clear the canvas to ensure transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const link = document.createElement('a');
        link.download = 'barcode.png';
        // Set PNG with transparency
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
});

// Utility to update/add student in database
async function updateStudentDatabase(studentId, studentName, section) {
    try {
        if (firebaseDB) {
            const existingStudent = await firebaseDB.findStudentByBarcode(firebaseDB.encodeStudentData(studentId));
            if (!existingStudent) {
                await firebaseDB.addStudent({ studentId, studentName, section });
            } else {
                await firebaseDB.updateStudent(studentId, { studentName, section });
            }
        } else {
            // Fallback to localStorage
            let students = [];
            try {
                students = JSON.parse(localStorage.getItem('barcodeStudents')) || [];
            } catch (e) {}
            let found = false;
            students = students.map(s => {
                if (s.studentId === studentId) {
                    found = true;
                    return { ...s, studentName, section, uniqueId: studentId };
                }
                return s;
            });
            if (!found) {
                students.push({ uniqueId: studentId, studentId, studentName, section });
            }
            localStorage.setItem('barcodeStudents', JSON.stringify(students));
        }
    } catch (error) {
        console.error('Error updating student database:', error);
    }
} 