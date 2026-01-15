# QR Attendance System - API Test Script
# Tests the Python backend API endpoints

import requests
import json
import time
from datetime import datetime, date

# Configuration
BASE_URL = "http://localhost:8000"
API_KEY = None

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✓ Health check passed")
            print(f"  Response: {response.json()}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_login():
    """Test login and get API key"""
    print("\nTesting login...")
    try:
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            global API_KEY
            API_KEY = data["access_token"]
            print("✓ Login successful")
            print(f"  User: {data['user_info']['username']}")
            print(f"  Role: {data['user_info']['role']}")
            return True
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Login error: {e}")
        return False

def test_create_student():
    """Test creating a student"""
    print("\nTesting student creation...")
    try:
        student_data = {
            "StudentID": "TEST001",
            "StudentName": "Test Student",
            "Section": "Test Section"
        }
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.post(f"{BASE_URL}/students", json=student_data, headers=headers)
        if response.status_code == 200:
            print("✓ Student created successfully")
            print(f"  Student ID: {response.json()['StudentID']}")
            return True
        else:
            print(f"✗ Student creation failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Student creation error: {e}")
        return False

def test_get_students():
    """Test getting all students"""
    print("\nTesting get students...")
    try:
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.get(f"{BASE_URL}/students", headers=headers)
        if response.status_code == 200:
            students = response.json()
            print(f"✓ Retrieved {len(students)} students")
            for student in students[:3]:  # Show first 3
                print(f"  - {student['StudentID']}: {student['StudentName']} ({student['Section']})")
            return True
        else:
            print(f"✗ Get students failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Get students error: {e}")
        return False

def test_create_event():
    """Test creating an event"""
    print("\nTesting event creation...")
    try:
        event_data = {
            "EventName": "Test Event",
            "EventDescription": "A test event for API testing"
        }
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.post(f"{BASE_URL}/events", json=event_data, headers=headers)
        if response.status_code == 200:
            print("✓ Event created successfully")
            print(f"  Event: {response.json()['EventName']}")
            return True
        else:
            print(f"✗ Event creation failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Event creation error: {e}")
        return False

def test_mark_attendance():
    """Test marking attendance"""
    print("\nTesting attendance marking...")
    try:
        attendance_data = {
            "student_id": "TEST001",
            "event_name": "Test Event",
            "time_in": datetime.utcnow().isoformat() + "Z"
        }
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.post(f"{BASE_URL}/attendance/mark", json=attendance_data, headers=headers)
        if response.status_code == 200:
            print("✓ Attendance marked successfully")
            data = response.json()
            print(f"  Student: {data['StudentName']} ({data['StudentID']})")
            print(f"  Event: {data['EventName']}")
            print(f"  Time In: {data['TimeIn']}")
            return True
        else:
            print(f"✗ Attendance marking failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Attendance marking error: {e}")
        return False

def test_get_attendance():
    """Test getting attendance records"""
    print("\nTesting get attendance...")
    try:
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.get(f"{BASE_URL}/attendance/event/Test%20Event", headers=headers)
        if response.status_code == 200:
            records = response.json()
            print(f"✓ Retrieved {len(records)} attendance records")
            for record in records[:2]:  # Show first 2
                print(f"  - {record['StudentName']}: {record['TimeIn']} - {record['TimeOut'] or 'Active'}")
            return True
        else:
            print(f"✗ Get attendance failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Get attendance error: {e}")
        return False

def test_timeout_attendance():
    """Test timing out attendance"""
    print("\nTesting attendance timeout...")
    try:
        # Wait a moment before timing out
        time.sleep(2)
        
        attendance_data = {
            "student_id": "TEST001",
            "event_name": "Test Event",
            "time_out": datetime.utcnow().isoformat() + "Z"
        }
        headers = {"Authorization": f"Bearer {API_KEY}"}
        response = requests.post(f"{BASE_URL}/attendance/mark", json=attendance_data, headers=headers)
        if response.status_code == 200:
            print("✓ Attendance timeout successful")
            data = response.json()
            print(f"  Time Out: {data['TimeOut']}")
            if data['DurationMinutes']:
                print(f"  Duration: {data['DurationMinutes']} minutes")
            return True
        else:
            print(f"✗ Attendance timeout failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Attendance timeout error: {e}")
        return False

def main():
    """Run all tests"""
    print("QR Attendance System - API Test Suite")
    print("=====================================")
    print(f"Testing API at: {BASE_URL}")
    print()
    
    tests = [
        ("Health Check", test_health_check),
        ("Login", test_login),
        ("Create Student", test_create_student),
        ("Get Students", test_get_students),
        ("Create Event", test_create_event),
        ("Mark Attendance", test_mark_attendance),
        ("Get Attendance", test_get_attendance),
        ("Timeout Attendance", test_timeout_attendance),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"✗ {test_name} failed with exception: {e}")
    
    print("\n" + "="*50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
    
    print("\nNext steps:")
    print("1. Update your frontend to use the API endpoints")
    print("2. Implement Android app using the REST API")
    print("3. Set up production environment")

if __name__ == "__main__":
    main()
