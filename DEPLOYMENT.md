# CountIn Deployment Guide

## Coolify Deployment (Production)

This application is fully configured for Coolify deployment with Docker Compose.

### Prerequisites

- Coolify instance running
- Two subdomains configured:
  - `countin.ignacio.tech` (frontend)
  - `api.countin.ignacio.tech` (backend)

### Architecture

```
Internet
   │
   ├─→ countin.ignacio.tech ──────→ Frontend (port 3000)
   │                                     │
   └─→ api.countin.ignacio.tech ────→ Backend (port 8000)
                                          │
                                          └─→ Database (internal only)
```

### Step 1: Environment Variables

Set these in your Coolify project settings:

```bash
# Database Configuration
POSTGRES_USER=countin
POSTGRES_PASSWORD=<generate-secure-random-password>
POSTGRES_DB=countin

# Backend Configuration
DATABASE_URL=postgresql://countin:<your-password>@db:5432/countin
ENV=production
BACKEND_CORS_ORIGINS=https://countin.ignacio.tech,https://*.countin.ignacio.tech

# Frontend Configuration (Build-time)
VITE_API_URL=https://api.countin.ignacio.tech
```

**Important Notes:**
- Use a strong random password for `POSTGRES_PASSWORD`
- The `DATABASE_URL` must match the database credentials
- `VITE_API_URL` must be set as a **build argument** in Coolify

### Step 2: Coolify Configuration

1. **Create New Project** in Coolify
2. **Connect Git Repository** (main branch)
3. **Select Docker Compose** deployment type
4. **Set Compose File** to `docker-compose.yml`
5. **Configure Domains**:
   - Service `frontend` → `countin.ignacio.tech`
   - Service `backend` → `api.countin.ignacio.tech`
6. **Add Environment Variables** from Step 1
7. **Deploy!**

### Step 3: Service Routing

Coolify will automatically:
- Expose port 3000 from `frontend` service → `countin.ignacio.tech`
- Expose port 8000 from `backend` service → `api.countin.ignacio.tech`
- Keep database internal (no external exposure)
- Generate SSL certificates via Let's Encrypt

### Services Overview

| Service | Port | Public Access | Description |
|---------|------|---------------|-------------|
| `frontend` | 3000 | ✓ countin.ignacio.tech | Vite-built SPA |
| `backend` | 8000 | ✓ api.countin.ignacio.tech | FastAPI REST API |
| `db` | 5432 | ✗ Internal only | PostgreSQL 15 |

### Persistent Storage

- **Volume**: `postgres_data` - Database persistence
- **Backup**: Configure Coolify to backup this volume regularly

### Health Checks

- Database health check runs every 10s
- Backend waits for database to be healthy before starting
- Frontend waits for backend to be available

### API Documentation

Once deployed, API docs are available at:
- **Swagger UI**: `https://api.countin.ignacio.tech/docs`
- **ReDoc**: `https://api.countin.ignacio.tech/redoc`

---

## Local Development

### Quick Start

```bash
# Start all services with hot-reload
docker-compose -f docker-compose.dev.yml up

# Or rebuild and start
docker-compose -f docker-compose.dev.yml up --build
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Database**: localhost:5432

### Development Configuration

In development mode (`ENV=development`):
- CORS allows localhost origins automatically
- Backend runs with `--reload` flag
- Frontend proxies API requests to backend
- Database port exposed for direct access

### Environment Variables (Development)

Create `.env` file:

```bash
# Database
POSTGRES_USER=countin
POSTGRES_PASSWORD=countin
POSTGRES_DB=countin

# Backend
DATABASE_URL=postgresql://countin:countin@db:5432/countin
ENV=development

# Frontend (leave empty to use proxy)
VITE_API_URL=
```

---

## Troubleshooting

### Frontend Can't Reach Backend

- Verify `VITE_API_URL` is set correctly as build argument
- Check CORS settings in backend (should include your frontend domain)
- Verify backend service is running: `docker-compose ps`

### Database Connection Issues

- Check `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Verify database health: `docker-compose exec db pg_isready -U countin`
- Check logs: `docker-compose logs db`

### Backend Not Starting

- Check database is healthy first
- Review backend logs: `docker-compose logs backend`
- Verify all Python dependencies are installed

### Building Issues

- Clear Docker cache: `docker-compose build --no-cache`
- Remove volumes: `docker-compose down -v` (WARNING: deletes data)

---

## Updating Deployment

```bash
# In Coolify, simply push to main branch
git push origin main

# Coolify will automatically:
# 1. Pull latest code
# 2. Rebuild changed services
# 3. Rolling restart
```

---

## Security Checklist

- [ ] Strong database password set
- [ ] CORS configured for specific domains only
- [ ] SSL certificates active (handled by Coolify)
- [ ] Database not exposed publicly
- [ ] Regular backups configured
- [ ] Environment variables secured in Coolify
