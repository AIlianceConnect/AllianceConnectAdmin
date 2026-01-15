QR Attendance System - Offline Usage Guide
=========================================

This folder contains a fully offline, portable QR Attendance System.

How to Use
----------
1. **Copy the entire folder** to your computer (including all files and the `lib` folder).
2. **Open the app:**
   - Double-click `index.html` (or any other HTML file) to open in your web browser.
   - For best compatibility (especially for camera/barcode features), run a local server (see below).
3. **Use the system:**
   - All features (attendance, events, barcode database, import/export) work offline.
   - Data is stored in your browser (LocalStorage). Each browser/PC has its own data.
   - Use the Export/Import features to move data between computers.

Running a Local Server (Recommended)
------------------------------------
Some browsers restrict features (like camera access or file downloads) when opening files directly. To avoid issues:

- **Windows:** Double-click `start_server.bat` (if present) and follow the instructions. Then open `http://localhost:8000` in your browser.
- **Any OS (with Python):**
  1. Open a terminal/command prompt in this folder.
  2. Run: `python -m http.server`
  3. Open `http://localhost:8000` in your browser.

Features
--------
- **Attendance Scanning:** Scan barcodes/QR codes to record attendance.
- **Events Management:** Create, search, import, export, and delete events.
- **Student Database:** Add, update, import, export, and clear student records.
- **All libraries are included locally** (no internet required).

Troubleshooting
---------------
- If you see errors about camera access or file downloads, try running a local server (see above).
- If you move to a new PC, use the Export/Import features to transfer your data.
- If you have issues, make sure you are using a modern browser (Chrome, Edge, Firefox, etc.).

Support
-------
For questions or help, contact your system administrator or the developer who provided this folder. 