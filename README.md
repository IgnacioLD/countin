# CountIn

AI-powered people counting application with line and area detection.

## Features

- Real-time person detection using RT-DETR
- Line and area-based counting
- Interactive drawing interface
- Session management and data export
- WebSocket support for live updates
- PostgreSQL database for data persistence

## Tech Stack

### Frontend
- Vite + Vanilla JS
- RT-DETR for person detection (client-side)
- Canvas API for drawing and visualization

### Backend
- FastAPI (Python)
- PostgreSQL
- SQLAlchemy ORM
- WebSocket support

## Quick Start

### Production Deployment (Coolify)

1. Set environment variables in Coolify:

```bash
POSTGRES_USER=countin
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=countin
DATABASE_URL=postgresql://countin:<password>@db:5432/countin
ENV=production
BACKEND_CORS_ORIGINS=https://countin.ignacio.tech,https://*.countin.ignacio.tech
VITE_API_URL=https://api.countin.ignacio.tech
```

2. Configure routing:
   - `countin.ignacio.tech` → frontend (port 3000)
   - `api.countin.ignacio.tech` → backend (port 8000)

3. Deploy with `docker-compose.yml`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Local Development

```bash
# Start all services with hot-reload
docker-compose -f docker-compose.dev.yml up

# Access:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - Database: localhost:5432
```

## API Endpoints

- `POST /api/v1/sessions` - Create counting session
- `GET /api/v1/sessions` - List sessions
- `GET /api/v1/sessions/{id}` - Get session details
- `GET /api/v1/sessions/{id}/stats` - Get session statistics
- `POST /api/v1/lines` - Create counting line/area
- `POST /api/v1/events` - Log crossing event
- `WS /api/v1/ws` - WebSocket for live updates

Full API documentation available at `/docs` when running.

## Architecture

```
┌─────────────┐
│  Frontend   │  (Vite, RT-DETR)
│  Port 3000  │
└──────┬──────┘
       │
       │ HTTP/WS
       │
┌──────▼──────┐
│   Backend   │  (FastAPI)
│  Port 8000  │
└──────┬──────┘
       │
       │ PostgreSQL
       │
┌──────▼──────┐
│  Database   │  (Internal)
│  Port 5432  │
└─────────────┘
```

## Configuration

All configuration is done via environment variables. See `.env.example` for available options.

## License

MIT
