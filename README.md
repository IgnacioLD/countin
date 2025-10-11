# CountIn: Real-Time Vision-Based Occupancy Tracker

Browser-based people counting system using computer vision AI for event occupancy management and crowd analytics.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://countin.ignacio.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

CountIn is a real-time people counting application that uses computer vision to track occupancy levels for events, venues, and public spaces. Built with TensorFlow.js for frontend ML and FastAPI for backend data management.

### Key Features

- **Real-Time Person Detection**: TensorFlow.js with COCO-SSD models
- **Custom Tracking Algorithms**: Built-from-scratch person tracking
- **Directional Counting**: Virtual lines to count people entering/exiting
- **Camera Selection**: Choose from multiple connected webcams
- **Data Persistence**: PostgreSQL backend for session storage
- **Real-Time API**: FastAPI backend with WebSocket support
- **Export Features**: JSON data export for analysis
- **Privacy-First**: Browser-based detection, optional cloud storage

## Tech Stack

### Frontend
- **ML Framework**: TensorFlow.js
- **Build Tool**: Vite
- **Detection**: COCO-SSD person detection
- **UI**: Vanilla JavaScript (ES6+), HTML5 Canvas

### Backend
- **API**: FastAPI (Python)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **WebSocket**: FastAPI WebSockets for real-time updates

### Deployment
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx
- **Orchestration**: Coolify-ready

## Quick Start

### Development Mode

```bash
# Clone repository
git clone https://github.com/IgnacioLD/countin.git
cd countin

# Start all services with Docker Compose
docker-compose -f docker-compose.dev.yml up

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Production Mode

```bash
# Build and run production containers
docker-compose up -d

# Access at http://localhost
```

## Project Structure

```
countin/
├── frontend/                 # Vite-based frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── services/        # API & camera services
│   │   ├── tracker.js       # Person tracking logic
│   │   ├── line-manager.js  # Line crossing detection
│   │   └── main.js          # Application entry point
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── core/            # Config & database
│   │   └── main.py          # FastAPI app
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml        # Production setup
├── docker-compose.dev.yml    # Development setup
└── README.md
```

## API Endpoints

### Sessions
- `POST /api/v1/sessions/` - Create new session
- `GET /api/v1/sessions/` - List sessions
- `GET /api/v1/sessions/{id}` - Get session details
- `POST /api/v1/sessions/{id}/end` - End session
- `GET /api/v1/sessions/{id}/stats` - Get session statistics

### Counting Lines
- `POST /api/v1/lines/` - Create counting line
- `GET /api/v1/lines/session/{id}` - Get session lines
- `PATCH /api/v1/lines/{id}` - Update line
- `DELETE /api/v1/lines/{id}` - Delete line

### Events
- `POST /api/v1/events/` - Record crossing event
- `GET /api/v1/events/session/{id}` - Get session events

### WebSocket
- `WS /api/v1/ws/{session_id}` - Real-time session updates

Full API documentation available at `/docs` when backend is running.

## Usage

### 1. Camera Setup
- Click "Change Camera" to select from available webcams
- Grant camera permissions when prompted
- Choose your preferred camera from the list

### 2. Setup Mode
- Draw counting lines across entrances/exits
- Click "Add Line" and drag to create virtual lines
- Name each line for easy tracking
- Add multiple lines for different entrances

### 3. Counting Mode
- Switch to "Counting Mode" to start tracking
- People crossing lines are counted directionally (in/out)
- View real-time statistics and charts
- Activity log shows all crossing events

### 4. Session Management
- Name your session for easy identification
- Click "Save Session" to end and store data
- Use "Export Data" to download JSON report
- View historical sessions via API

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://countin:countin@db:5432/countin

# CORS Origins (comma-separated)
BACKEND_CORS_ORIGINS=http://localhost,http://localhost:3000

# API Configuration
API_V1_STR=/api/v1
PROJECT_NAME=CountIn API
```

## Deployment

### Coolify Deployment

1. **Create New Project** in Coolify
2. **Add Git Repository**: Link your CountIn repo
3. **Configure Services**:
   - Database: PostgreSQL 15
   - Backend: Dockerfile (./backend/Dockerfile)
   - Frontend: Dockerfile (./frontend/Dockerfile)
4. **Environment Variables**: Set `DATABASE_URL` and `BACKEND_CORS_ORIGINS`
5. **Deploy**: Coolify handles orchestration

### Manual VPS Deployment

```bash
# On your VPS
git clone <your-repo>
cd countin

# Copy and configure environment
cp .env.example .env
nano .env  # Update credentials

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev  # Development server on port 3000
npm run build  # Production build
```

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload  # Development server on port 8000
```

### Database Migrations (Optional - using Alembic)

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## Browser Requirements

- Modern browser with WebRTC (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Webcam access
- JavaScript enabled
- 4GB+ RAM recommended

## Performance

- **Detection Speed**: ~250-500ms per frame
- **Real-time**: Processes every 2nd frame at 30fps
- **Memory**: ~200-500MB (TensorFlow.js models)
- **Accuracy**: ~85-95% (depends on lighting/camera quality)

## Privacy & Ethics

- **Local Processing**: ML runs in browser, no video data sent to server
- **Optional Cloud Storage**: Only counting events stored, not video
- **Camera Privacy**: Explicit user permission required
- **GDPR Compliant**: No personal data stored
- **Ethical Use**: Designed for occupancy counting, not surveillance

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

**Ignacio Loyola Delgado**
- Website: [ignacio.tech](https://ignacio.tech)
- GitHub: [@IgnacioLD](https://github.com/IgnacioLD)
- Email: hi@ignacio.tech

## Acknowledgments

- TensorFlow.js team for browser-based ML
- COCO-SSD model contributors
- FastAPI framework
- Open source community

---

Built with ❤️ for the edge AI community
