# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta] - 2025-10-12

### Added
- Three operation modes: Standalone, Hub Dashboard, and Camera Station
- Real-time AI-powered person detection using TensorFlow.js COCO-SSD
- Line-based counting with directional detection (in/out)
- Area-based counting for occupancy monitoring
- Multi-camera hub dashboard with aggregated statistics
- QR code pairing for easy camera-to-hub connection
- WebSocket real-time synchronization between cameras and hub
- Camera management (rename, location, delete)
- Connection status monitoring with heartbeat system
- Line/area management controls in sidebar (draw, rename, delete, toggle direction)
- Color customization for counting lines and areas
- Video mirroring support with correct direction detection
- Session management and data export
- Mobile-responsive design with slide-out sidebar
- Interactive onboarding flow for first-time users
- Drawing tools (Line and Area modes) in sidebar
- Live statistics display in camera sidebar
- Setup guide overlay for drawing counting zones

### Features
- **Privacy-First Architecture**: No video streaming - only count data transmitted
- **Client-Side AI**: All detection happens locally in browser
- **Real-Time Updates**: WebSocket for instant synchronization
- **Multi-Camera Support**: Hub aggregates data from unlimited cameras
- **Flexible Counting**: Both line crossing and area occupancy detection
- **Bidirectional Counting**: Separate in/out counts with direction toggle
- **Camera Mirroring**: Proper coordinate handling for mirrored video
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Toggleable Sidebar**: Collapsible sidebar on both standalone and camera modes

### Technical
- Frontend: Vite + Vanilla JavaScript, TensorFlow.js, Canvas API
- Backend: FastAPI (Python 3.11), PostgreSQL 15, SQLAlchemy ORM
- Deployment: Docker + Docker Compose, Coolify-ready
- Real-time: WebSocket connections for hub and camera synchronization
- Database: Automatic table creation with SQLAlchemy migrations

### Fixed
- Camera sidebar toggle button visibility and positioning
- Layout issues with empty space in camera mode
- Camera online/offline status tracking in database
- Session control element null reference errors
- Startup script ImportError for non-existent init_db function
- Line/area name and color edits now sync between standalone and camera sidebars
- Mirrored canvas drawing coordinates
- Direction detection when video is mirrored
- Text labels remain readable on mirrored canvas

### Security
- All video processing local to browser
- No video storage or transmission
- HTTPS required for production
- Secure WebSocket connections (WSS)
- CORS configuration with origin validation

### Performance
- AI detection at ~3 FPS for optimal performance
- Lazy loading of TensorFlow.js models
- Database indexes for fast queries
- Minimal memory footprint per camera
- Efficient WebSocket message handling

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

### Known Issues
- None at this time

### Migration Notes
This is the initial beta release. No migration needed.

---

## Release Notes

### v1.0.0-beta - First Public Beta

This is the first public beta release of CountIn, a privacy-focused people counting system with multi-camera support.

**What's Working:**
- ✅ Standalone mode with line/area counting
- ✅ Hub dashboard with multi-camera aggregation
- ✅ Camera station mode with real-time sync
- ✅ QR code pairing
- ✅ Line and area management
- ✅ Mobile responsive design
- ✅ Video mirroring support
- ✅ Connection status monitoring

**What's Next:**
- Historical data visualization
- Export formats (CSV, JSON)
- Advanced analytics
- Custom detection zones
- Performance optimizations
- Additional AI models

**Feedback Welcome:**
Please report issues or suggest features on GitHub.
