# Installation Guide

This guide covers various installation methods for zynqCloud.

## Table of Contents

- [Docker Compose (Recommended)](#docker-compose-recommended)
- [Manual Installation](#manual-installation)
- [Production Deployment](#production-deployment)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

## Docker Compose (Recommended)

The easiest way to run zynqCloud is using Docker Compose, which sets up all required services automatically.

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DineshMN1/zynq.git
cd zynq

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3001 | Register first user as owner |
| Backend API | http://localhost:4000 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5432 | zynqcloud / supersecret_db_pass |

### First User Setup

1. Open http://localhost:3001
2. Click "Register"
3. The first user automatically becomes the **Owner** with full permissions
4. Subsequent users need an invite from an Admin/Owner

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes all data)
docker-compose down -v
```

## Manual Installation

For development or custom deployments, you can run each component separately.

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- MinIO or S3-compatible storage

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb zynqcloud

# Or using psql
psql -U postgres -c "CREATE DATABASE zynqcloud;"
psql -U postgres -c "CREATE USER zynqcloud WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE zynqcloud TO zynqcloud;"
```

### 2. MinIO Setup (Optional - for local S3)

```bash
# Using Docker
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create bucket
docker exec minio mc alias set myminio http://localhost:9000 minioadmin minioadmin
docker exec minio mc mb myminio/zynq-cloud
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=your_password
DATABASE_NAME=zynqcloud

# JWT (generate a secure random string, min 32 chars)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# CORS
CORS_ORIGIN=http://localhost:3000

# Optional: Email
# EMAIL_ENABLED=true
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-email
# SMTP_PASS=your-password

# Optional: Public registration (default: false, requires invite)
# PUBLIC_REGISTRATION=true
```

Run the backend:

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Run the frontend:

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm run start
```

## Production Deployment

### Security Checklist

- [ ] Use HTTPS for all services
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Change default database passwords
- [ ] Change default MinIO credentials
- [ ] Configure proper CORS origins
- [ ] Set up SSL certificates
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging

### Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: zynqcloud
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DATABASE_HOST: postgres
      DATABASE_USER: ${DB_USER}
      DATABASE_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY_ID: ${MINIO_USER}
      S3_SECRET_ACCESS_KEY: ${MINIO_PASSWORD}
      CORS_ORIGIN: https://your-domain.com
    depends_on:
      - postgres
      - minio
    restart: unless-stopped

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: https://api.your-domain.com/api/v1
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
```

Create `.env.prod`:

```env
DB_USER=zynqcloud
DB_PASSWORD=very-secure-password-here
MINIO_USER=minio-admin
MINIO_PASSWORD=very-secure-minio-password
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-chars
```

Deploy:

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Reverse Proxy (Nginx)

```nginx
# Frontend
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Environment Variables Reference

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 4000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `DATABASE_HOST` | Yes | - | PostgreSQL host |
| `DATABASE_PORT` | No | 5432 | PostgreSQL port |
| `DATABASE_USER` | Yes | - | Database user |
| `DATABASE_PASSWORD` | Yes | - | Database password |
| `DATABASE_NAME` | Yes | - | Database name |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `S3_ENDPOINT` | Yes | - | S3/MinIO endpoint URL |
| `S3_BUCKET` | Yes | - | S3 bucket name |
| `S3_ACCESS_KEY_ID` | Yes | - | S3 access key |
| `S3_SECRET_ACCESS_KEY` | Yes | - | S3 secret key |
| `S3_REGION` | No | us-east-1 | S3 region |
| `S3_FORCE_PATH_STYLE` | No | false | Use path-style URLs (required for MinIO) |
| `CORS_ORIGIN` | Yes | - | Allowed CORS origins (comma-separated) |
| `PUBLIC_REGISTRATION` | No | false | Allow registration without invite |
| `SMTP_HOST` | No | - | SMTP server host |
| `SMTP_PORT` | No | 587 | SMTP server port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASS` | No | - | SMTP password |
| `EMAIL_ENABLED` | No | false | Enable email sending |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API URL |

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Test connection
psql -h localhost -U zynqcloud -d zynqcloud
```

### MinIO Issues

```bash
# Check MinIO is running
docker-compose ps minio

# Check bucket exists
docker exec zynqcloud-minio mc ls myminio/

# Create bucket if missing
docker exec zynqcloud-minio mc mb myminio/zynq-cloud
```

### Backend Issues

```bash
# View backend logs
docker-compose logs backend

# Check environment variables
docker-compose exec backend env | grep -E "(DATABASE|S3|JWT)"
```

### Frontend Issues

```bash
# View frontend logs
docker-compose logs frontend

# Check API connection
curl http://localhost:4000/api/v1/health
```

### Common Errors

**"Invalid credentials"** - Check JWT_SECRET is set and consistent

**"CORS error"** - Verify CORS_ORIGIN includes your frontend URL

**"S3 connection failed"** - Check S3_ENDPOINT and credentials

**"Database connection refused"** - Ensure PostgreSQL is running and credentials are correct

### Reset Everything

```bash
# Stop all services and remove data
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

## Support

- [GitHub Issues](https://github.com/DineshMN1/zynq/issues)
- [Discussions](https://github.com/DineshMN1/zynq/discussions)
