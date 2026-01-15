// Base62 encoding characters (0-9, A-Z, a-z)
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Encode studentId into a short reference number
function encodeStudentData(studentId) {
    // Convert studentId (string) to a number hash
    let hash = 0;
    for (let i = 0; i < studentId.length; i++) {
        hash = ((hash << 5) - hash) + studentId.charCodeAt(i);
        hash = hash & hash;
    }
    hash = Math.abs(hash);
    // Convert to base62 string (4 chars)
    let encoded = '';
    let num = hash;
    for (let i = 0; i < 4; i++) {
        encoded = BASE62[num % 62] + encoded;
        num = Math.floor(num / 62);
    }
    return 'S' + encoded;
}

// Decode reference number back to studentId (not possible, so return placeholder)
function decodeStudentData(reference) {
    // Not reversible, just return placeholder
    return {
        uniqueId: reference,
        studentId: 'Unknown',
        studentName: 'Unknown',
        section: 'Unknown'
    };
}

// Encode officerId into a short reference number
function encodeOfficerData(officerId) {
    // Convert officerId (string) to a number hash
    let hash = 0;
    for (let i = 0; i < officerId.length; i++) {
        hash = ((hash << 5) - hash) + officerId.charCodeAt(i);
        hash = hash & hash;
    }
    hash = Math.abs(hash);
    // Convert to base62 string (4 chars)
    let encoded = '';
    let num = hash;
    for (let i = 0; i < 4; i++) {
        encoded = BASE62[num % 62] + encoded;
        num = Math.floor(num / 62);
    }
    return 'O' + encoded;
}

// Decode reference number back to officerId (not possible, so return placeholder)
function decodeOfficerData(reference) {
    // Not reversible, just return placeholder
    return {
        uniqueId: reference,
        officerId: 'Unknown',
        officerName: 'Unknown',
        department: 'Unknown'
    };
}

// Export the functions
window.encodeStudentData = encodeStudentData;
window.decodeStudentData = decodeStudentData;
window.encodeOfficerData = encodeOfficerData;
window.decodeOfficerData = decodeOfficerData; 