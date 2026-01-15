# Alliance App Dashboard

## Setup Instructions

### Running the Application

This application uses Firebase and ES6 modules, which require a web server to run properly. You cannot open the HTML file directly in the browser due to CORS restrictions.

#### Option 1: Using Python (Recommended - Simple)

1. **Python 3:**
   ```bash
   # Navigate to the project directory
   cd "C:\Users\63916\Desktop\for ANDROID APP\homepage"
   
   # Python 3
   python -m http.server 8000
   ```

2. **Python 2:**
   ```bash
   python -m SimpleHTTPServer 8000
   ```

3. Open your browser and go to: `http://localhost:8000`

#### Option 2: Using Node.js (http-server)

1. Install http-server globally:
   ```bash
   npm install -g http-server
   ```

2. Navigate to the project directory:
   ```bash
   cd "C:\Users\63916\Desktop\for ANDROID APP\homepage"
   ```

3. Start the server:
   ```bash
   http-server -p 8000
   ```

4. Open your browser and go to: `http://localhost:8000`

#### Option 3: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

#### Option 4: Using PHP

1. If you have PHP installed:
   ```bash
   php -S localhost:8000
   ```

2. Open your browser and go to: `http://localhost:8000`

## Firebase Configuration

The application is configured to use Firebase Firestore and Firebase Storage:
- **Collection Name:** `Announcements`
- **Storage Path:** `announcements/`

### Firebase Security Rules

Make sure to configure your Firebase Security Rules in the Firebase Console:

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /Announcements/{announcementId} {
      allow read, write: if true; // Adjust based on your auth requirements
    }
  }
}
```

**Storage Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /announcements/{allPaths=**} {
      allow read, write: if true; // Adjust based on your auth requirements
    }
  }
}
```

## Features

- Create, edit, and delete announcements
- Upload images to Firebase Storage
- Search and filter announcements
- Tabbed interface (Today, Upcoming Events, Past, All Announcements)
- Real-time updates from Firebase
- Date, time, and location fields for events

## Troubleshooting

If you encounter CORS errors:
- Make sure you're running the application through a web server (not file://)
- Check that Firebase is properly initialized
- Verify Firebase Security Rules allow read/write access



