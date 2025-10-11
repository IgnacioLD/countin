# CountIn

Privacy-focused AI-powered people counting application with multi-camera support.

## Overview

CountIn is a real-time people counting system that uses browser-based AI detection. It supports three operation modes:

1. **Standalone Mode** - Single camera counting with line/area detection
2. **Hub Dashboard** - Central dashboard to monitor multiple camera stations
3. **Camera Station** - Connect cameras to a hub (sends only count data, no video)

## Key Features

### Privacy First
- No video streaming between cameras and hub
- Only count data is transmitted
- All AI processing happens locally in the browser
- Camera stations send only numerical counts

### Multi-Camera Architecture
- Hub dashboard aggregates data from multiple camera stations
- QR code pairing for easy setup
- Real-time WebSocket synchronization
- Camera management (rename, delete)
- Connection status monitoring

### Counting Capabilities
- Real-time person detection using TensorFlow.js COCO-SSD
- Line-based counting (crossing detection)
- Area-based counting (occupancy detection)
- Bidirectional counting (in/out)
- Session management and data export

## Tech Stack

### Frontend
- Vite + Vanilla JavaScript
- TensorFlow.js + COCO-SSD for person detection (client-side)
- Canvas API for drawing and visualization
- QRCode.js for pairing
- WebSocket for real-time updates

### Backend
- FastAPI (Python 3.11)
- PostgreSQL 15
- SQLAlchemy ORM
- WebSocket support
- Pydantic for data validation

### Deployment
- Docker + Docker Compose
- Coolify-ready configuration
- Nginx/Traefik reverse proxy compatible

## Architecture

```
Hub Dashboard (Browser)
        |
        | WebSocket (counts only)
        |
        +-- Camera Station 1 (Browser + Webcam)
        |   [Local AI Detection]
        |
        +-- Camera Station 2 (Browser + Webcam)
        |   [Local AI Detection]
        |
        +-- Camera Station N (Browser + Webcam)
            [Local AI Detection]
```

All communication flows through the FastAPI backend, but only count data is transmitted - never video.

## Quick Start

### Production Deployment (Coolify)

1. **Set Environment Variables:**

```bash
# Database
POSTGRES_USER=countin
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=countin
DATABASE_URL=postgresql://countin:<password>@db:5432/countin

# Application
ENV=production
BACKEND_CORS_ORIGINS=https://countin.ignacio.tech,https://*.countin.ignacio.tech
VITE_API_URL=https://api.countin.ignacio.tech

# Coolify Service FQDNs
SERVICE_FQDN_FRONTEND=countin.ignacio.tech
SERVICE_FQDN_BACKEND=api.countin.ignacio.tech
```

2. **Configure DNS/Routing:**
   - `countin.ignacio.tech` → Frontend service (port 3000)
   - `api.countin.ignacio.tech` → Backend service (port 8000)

3. **Deploy:**
   - Use `docker-compose.yml` in Coolify
   - Services will build and start automatically
   - Database tables are created on first backend startup

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/countin.git
cd countin

# Start all services
docker-compose up -d

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - Database: localhost:5432
```

## Usage

### Standalone Mode

1. Open the application and select "Standalone" mode
2. Grant camera permissions
3. Draw counting lines or areas on the video
4. Switch to "Counting" mode to start detection
5. Export data from the session

### Hub Dashboard Mode

1. Open the application and select "Hub Dashboard" mode
2. A pairing code will be generated
3. Share this code or QR code with camera stations
4. Monitor all connected cameras in real-time
5. Manage cameras (rename, delete) from the dashboard

### Camera Station Mode

1. Open the application on a device with a camera
2. Select "Camera Station" mode
3. Enter the hub's pairing code
4. Provide a camera name and location
5. Grant camera permissions and start counting
6. Counts are sent to the hub in real-time

## API Documentation

### Sessions
- `POST /api/v1/sessions` - Create counting session
- `GET /api/v1/sessions` - List all sessions
- `GET /api/v1/sessions/{id}` - Get session details
- `GET /api/v1/sessions/{id}/stats` - Get session statistics
- `PATCH /api/v1/sessions/{id}` - Update session
- `DELETE /api/v1/sessions/{id}` - Delete session

### Counting Lines/Areas
- `POST /api/v1/lines` - Create counting line or area
- `GET /api/v1/lines/session/{session_id}` - Get lines for session
- `DELETE /api/v1/lines/{line_id}` - Delete line

### Events
- `POST /api/v1/events` - Log crossing event
- `GET /api/v1/events/session/{session_id}` - Get session events

### Hub Sessions
- `POST /api/v1/hubs` - Create hub dashboard session
- `GET /api/v1/hubs` - List hub sessions
- `GET /api/v1/hubs/{hub_id}` - Get hub details
- `GET /api/v1/hubs/code/{pairing_code}` - Find hub by code
- `GET /api/v1/hubs/{hub_id}/stats` - Get aggregated hub statistics

### Camera Stations
- `POST /api/v1/cameras/pair` - Pair camera with hub
- `GET /api/v1/cameras/hub/{hub_id}` - List hub cameras
- `GET /api/v1/cameras/{camera_id}` - Get camera details
- `PATCH /api/v1/cameras/{camera_id}` - Update camera (e.g., rename)
- `DELETE /api/v1/cameras/{camera_id}` - Delete camera
- `POST /api/v1/cameras/heartbeat` - Update camera connection status
- `POST /api/v1/cameras/{camera_id}/increment` - Increment count

### WebSocket
- `WS /api/v1/ws/hub/{hub_id}` - Hub dashboard real-time updates
- `WS /api/v1/ws/camera/{camera_id}` - Camera station connection

Full interactive API documentation available at `/docs` when running.

## Configuration

### Environment Variables

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `ENV` - Environment (development/production)
- `BACKEND_CORS_ORIGINS` - Allowed CORS origins (comma-separated)

**Frontend (build-time):**
- `VITE_API_URL` - Backend API URL (embedded during build)

### Database

PostgreSQL tables are automatically created on backend startup using SQLAlchemy migrations.

Tables:
- `sessions` - Counting sessions
- `counting_lines` - Line/area definitions
- `crossing_events` - Individual crossing events
- `count_snapshots` - Periodic count snapshots
- `hub_sessions` - Hub dashboard sessions
- `camera_stations` - Connected camera stations

## Troubleshooting

### CORS Errors

**Symptom:** "Cross-Origin Request Blocked" errors in browser console

**Solution:**
- Ensure `BACKEND_CORS_ORIGINS` includes your frontend domain
- Verify both frontend and backend URLs use HTTPS in production
- Check that `allow_origin_regex` in backend matches subdomain pattern

### Database Connection Issues

**Symptom:** Backend fails to start with database connection error

**Solution:**
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL container is running (`docker ps`)
- Check database logs for connection issues
- Verify database credentials match between services

### Camera Permission Issues

**Symptom:** Camera access denied or not working

**Solution:**
- HTTPS is required for camera access (except localhost)
- Grant camera permissions when browser prompts
- Check browser camera settings
- Try a different browser if issues persist

### Hub Pairing Issues

**Symptom:** Camera cannot connect to hub with pairing code

**Solution:**
- Verify pairing code is entered correctly (6 characters)
- Check that hub session is still active
- Ensure backend WebSocket connection is working
- Check browser console for connection errors

### Build/Deploy Issues

**Symptom:** Frontend build fails or shows blank page

**Solution:**
- Verify all npm dependencies are installed
- Check that `VITE_API_URL` is set correctly during build
- Clear browser cache and hard reload
- Check browser console for JavaScript errors
- Verify Vite build completed successfully

## Project Structure

```
countin/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # API route handlers
│   │   ├── core/                 # Config and database
│   │   ├── models/               # SQLAlchemy models
│   │   └── schemas/              # Pydantic schemas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # UI components
│   │   ├── services/             # API and camera services
│   │   ├── main.js               # Main application
│   │   ├── styles.css            # Styling
│   │   └── rfdetr-adapter.js     # AI detection adapter
│   ├── index.html
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml            # Production compose
└── README.md
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Security

- All video processing happens locally in the browser
- Only count data is transmitted over the network
- No video storage or transmission to backend
- HTTPS required for production deployments
- Secure WebSocket connections (WSS)

## Performance

- AI detection runs at ~3 FPS for optimal performance
- Lazy loading of TensorFlow.js models (loaded on demand)
- WebSocket for efficient real-time updates
- Database indexes for fast queries
- Minimal memory footprint per camera

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

Requires:
- WebRTC support for camera access
- Canvas API
- WebSocket support
- ES6+ JavaScript

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.
