# Crime Detection System

## Overview
A real-time crime detection and monitoring system that uses computer vision, emotion recognition, and environmental factors to assess potential criminal activity. The system processes video feeds to detect faces, analyze emotions, monitor environmental conditions, and evaluate the likelihood of criminal activity using fuzzy logic.

## Features
- Real-time face detection and emotion analysis
- Environmental monitoring (sound levels and crowd density)
- Camera interference detection
- Quick movement detection
- Real-time crime likelihood assessment
- Alert system for suspicious activities
- Snapshot capture of potential incidents
- WebSocket-based real-time notifications

## Technical Stack
- **Backend**: Django
- **Frontend**: JavaScript, HTML5, CSS3
- **Real-time Communication**: WebSocket (Django Channels)
- **Face Detection**: face-api.js
- **Machine Learning**: Fuzzy Logic (scikit-fuzzy)
- **Database**: SQLite
- **Authentication**: Django's built-in authentication system

## Prerequisites
- Python 3.x
- Node.js (for face-api.js)
- Web browser with WebRTC support
- Webcam or camera device

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd crime-system
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install django channels daphne scikit-fuzzy numpy
```

4. Apply database migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

5. Create a superuser:
```bash
python manage.py createsuperuser
```

6. Run the development server:
```bash
python manage.py runserver
```

## System Components

### Frontend Components
- Live video feed display
- Face detection overlay
- Real-time metrics display
- Alert notifications
- Responsive dashboard

### Backend Services
1. **Face Detection Service**
   - Real-time face detection
   - Emotion analysis
   - Expression recognition

2. **Environmental Analysis**
   - Sound level monitoring
   - Crowd density assessment
   - Movement detection

3. **Crime Prevention System**
   - Fuzzy logic-based crime likelihood assessment
   - Real-time alert generation
   - Incident logging

4. **Camera Interference Detection**
   - Camera blocking detection
   - Coverage detection
   - Quick movement analysis

## Key Features Explained

### Face Detection and Emotion Analysis
The system uses face-api.js to detect faces and analyze emotions including:
- Anger
- Fear
- Stress levels
- Facial expressions

### Environmental Monitoring
Tracks various environmental factors:
- Sound intensity
- Crowd density
- Rapid movements
- Time of day

### Camera Interference Detection
Monitors for potential camera tampering:
- Camera blocking
- Camera covering
- Rapid movements near camera

### Crime Likelihood Assessment
Uses fuzzy logic to evaluate crime likelihood based on:
- Emotional states
- Environmental conditions
- Time of day
- Camera interference

## Alert System
- Real-time WebSocket notifications
- Snapshot capture of incidents
- Alert logging and storage
- Alert severity classification

## Security Features
- Login required for access
- CSRF protection
- Secure WebSocket connections
- Media file access control

## Directory Structure
```
crime-detection-system/
├── config/                 # Project configuration
├── detection/             # Main application
├── accounts/             # User authentication
├── static/               # Static files
│   └── detection/        # App-specific static files
├── media/                # User-uploaded files
│   └── crime_snapshots/  # Incident snapshots
├── templates/            # HTML templates
└── manage.py            # Django management script
```

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
[Insert your license information here]

## Support
For support, please [insert contact information or support instructions]

## Acknowledgments
- face-api.js for face detection capabilities
- scikit-fuzzy for fuzzy logic implementation
- Django Channels for WebSocket support