# Deployment Guide

## Local Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Database: localhost:5432
```

## Local Production Test

```bash
# Build and run production containers
docker-compose up -d

# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

## Coolify Deployment

### 1. Prerequisites
- Coolify instance running
- Docker installed on server
- Git repository accessible

### 2. Setup in Coolify

#### Option A: Docker Compose (Recommended)

1. **Create New Resource** → **Docker Compose**
2. **Repository**: Point to your git repo
3. **Docker Compose File**: Select `docker-compose.yml`
4. **Environment Variables**:
   ```env
   POSTGRES_PASSWORD=your-secure-password
   DATABASE_URL=postgresql://countin:your-secure-password@db:5432/countin
   BACKEND_CORS_ORIGINS=https://your-domain.com
   ```
5. **Deploy**: Coolify will handle the rest

#### Option B: Separate Services

**Database Service**:
- Type: PostgreSQL 15
- Database: countin
- Username: countin
- Password: (set secure password)

**Backend Service**:
- Type: Dockerfile
- Dockerfile Path: `./backend/Dockerfile`
- Port: 8000
- Environment Variables:
  ```env
  DATABASE_URL=postgresql://countin:password@db:5432/countin
  BACKEND_CORS_ORIGINS=https://your-domain.com
  ```

**Frontend Service**:
- Type: Dockerfile
- Dockerfile Path: `./frontend/Dockerfile`
- Port: 3000
- Environment Variables:
  ```env
  VITE_API_URL=https://api.your-domain.com
  ```

### 3. Domain Configuration

In Coolify:
- Frontend: `your-domain.com` → frontend service (port 3000)
- Backend: `api.your-domain.com` → backend service (port 8000)

Coolify's Traefik will handle:
- SSL certificates (automatic Let's Encrypt)
- Reverse proxy
- Load balancing

### 4. Health Checks

Coolify automatically monitors:
- Database: PostgreSQL health check
- Backend: `/health` endpoint
- Frontend: Port 3000 availability

## Manual VPS Deployment

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone repository
git clone https://github.com/your-username/countin.git
cd countin

# Configure environment
cp .env.example .env
nano .env  # Update DATABASE_URL and POSTGRES_PASSWORD

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Nginx Reverse Proxy (if not using Coolify)

```nginx
# /etc/nginx/sites-available/countin
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Environment Variables

### Backend
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
BACKEND_CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
API_V1_STR=/api/v1
PROJECT_NAME=CountIn API
```

### Frontend
```env
VITE_API_URL=https://api.your-domain.com
```

### Database
```env
POSTGRES_USER=countin
POSTGRES_PASSWORD=secure-password
POSTGRES_DB=countin
```

## Maintenance

### View Logs
```bash
docker-compose logs -f [service-name]
```

### Restart Services
```bash
docker-compose restart [service-name]
```

### Update Application
```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Database
```bash
docker-compose exec db pg_dump -U countin countin > backup.sql
```

### Restore Database
```bash
docker-compose exec -T db psql -U countin countin < backup.sql
```

## Troubleshooting

### Frontend can't connect to backend
- Check `BACKEND_CORS_ORIGINS` includes your frontend domain
- Verify backend is running: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`

### Database connection fails
- Check `DATABASE_URL` format
- Ensure database is healthy: `docker-compose ps db`
- Verify credentials match between services

### Camera not detected
- HTTPS required for camera access (except localhost)
- Check browser permissions
- Verify webcam is connected

### Performance issues
- Reduce `detectionInterval` in frontend config
- Use lighter ML model (COCO-SSD lite_mobilenet_v2)
- Limit frame processing rate
- Check server resources: `docker stats`

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Set secure `BACKEND_CORS_ORIGINS` (not "*")
- [ ] Enable HTTPS (Coolify does this automatically)
- [ ] Regular backups configured
- [ ] Monitor logs for suspicious activity
- [ ] Keep Docker images updated
- [ ] Restrict database port (only internal Docker network)

## Monitoring

### Application Health
```bash
# Backend health
curl http://localhost:8000/health

# Database connection
docker-compose exec db psql -U countin -c "SELECT 1"

# Check all services
docker-compose ps
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Scaling Considerations

For high-traffic deployments:
1. Use PostgreSQL connection pooling (PgBouncer)
2. Add Redis for caching
3. Deploy multiple frontend/backend replicas
4. Use CDN for static assets
5. Implement rate limiting
6. Add monitoring (Prometheus + Grafana)
