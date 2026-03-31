"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import os
from pathlib import Path
import json
import hashlib
import secrets
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Authentication Models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    message: str
    user: dict

class UserProfile(BaseModel):
    username: str
    full_name: str
    role: str

# Session management
sessions = {}  # session_token -> {username, role, user_data}

# Load teachers from JSON file
def load_teachers():
    teachers_file = Path(__file__).parent / "teachers.json"
    with open(teachers_file) as f:
        return json.load(f)

# Helper function to find teacher by username
def find_teacher(username: str):
    teachers_data = load_teachers()
    for teacher in teachers_data["teachers"]:
        if teacher["username"] == username:
            return teacher
    return None

# Helper function to verify password (simple hash verification)
def verify_password(password: str, stored_password: str) -> bool:
    # For this simple implementation, we do direct comparison
    # In production, use proper password hashing (bcrypt, argon2)
    return password == stored_password

# Helper function to get current user from session
def get_current_user(session_token: Optional[str] = Cookie(None)):
    if not session_token or session_token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return sessions[session_token]

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


# Authentication Endpoints
@app.post("/auth/login")
def login(request: LoginRequest):
    """Login with teacher username and password"""
    teacher = find_teacher(request.username)
    
    if not teacher or not verify_password(request.password, teacher["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create session token
    session_token = secrets.token_urlsafe(32)
    sessions[session_token] = {
        "username": teacher["username"],
        "full_name": teacher["full_name"],
        "role": teacher["role"]
    }
    
    response = JSONResponse({
        "message": f"Welcome, {teacher['full_name']}!",
        "user": {
            "username": teacher["username"],
            "full_name": teacher["full_name"],
            "role": teacher["role"]
        }
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True)
    return response


@app.post("/auth/logout")
def logout(current_user = Depends(get_current_user)):
    """Logout the current user"""
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie(key="session_token")
    return response


@app.get("/auth/me")
def get_profile(current_user = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "username": current_user["username"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
        "is_authenticated": True
    }


@app.get("/auth/status")
def check_auth_status(session_token: Optional[str] = Cookie(None)):
    """Check if user is authenticated (doesn't raise error if not)"""
    if session_token and session_token in sessions:
        user = sessions[session_token]
        return {
            "is_authenticated": True,
            "user": {
                "username": user["username"],
                "full_name": user["full_name"],
                "role": user["role"]
            }
        }
    return {"is_authenticated": False}
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, current_user = Depends(get_current_user)):
    """Sign up a student for an activity - requires teacher login"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, current_user = Depends(get_current_user)):
    """Unregister a student from an activity - requires teacher login"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
