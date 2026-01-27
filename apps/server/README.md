<p align="center">
  <h1 align="center">zynqCloud Backend</h1>
  <p align="center">
    Production-ready REST API for self-hosted file management
    <br />
    <strong>NestJS</strong> · <strong>PostgreSQL</strong> · <strong>S3-Compatible Storage</strong>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat-square&logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

The zynqCloud backend is a robust, scalable REST API built with NestJS that provides:

- **Secure Authentication** - JWT tokens with HttpOnly cookies
- **File Management** - Upload, download, share, organize files
- **Role-Based Access** - Owner, Admin, User permission levels
- **S3 Integration** - Works with AWS S3, MinIO, or any S3-compatible storage
- **Invite System** - Controlled user registration via invitations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        zynqCloud Backend                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐│
│  │  Auth   │  │  Files  │  │ Invites │  │  Admin  │  │Settings││
│  │ Module  │  │ Module  │  │ Module  │  │ Module  │  │ Module ││
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬────┘│
│       │            │            │            │           │      │
│  ┌────┴────────────┴────────────┴────────────┴───────────┴────┐ │
│  │                      Core Services                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │  Users   │  │ Storage  │  │  Email   │  │  Guards  │    │ │
│  │  │ Service  │  │ Service  │  │ Service  │  │ & Pipes  │    │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │   PostgreSQL    │              │   S3 / MinIO    │           │
│  │   (Metadata)    │              │   (File Blobs)  │           │
│  └─────────────────┘              └─────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 14+ |
| ORM | TypeORM | 0.3.x |
| Auth | Passport + JWT | - |
| Storage | AWS SDK v3 | 3.x |
| Validation | class-validator | 0.14.x |

## Quick Start

### Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL 14+
- S3-compatible storage (MinIO for local development)
- pnpm, npm, or yarn

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start with Docker (PostgreSQL + MinIO)
docker-compose up -d postgres minio minio-init

# Run database migrations
psql -h localhost -U zynqcloud -d zynqcloud -f migrations/001_initial_schema.sql

# Start development server
npm run start:dev
```

The API will be available at `http://localhost:4000/api/v1`

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# ═══════════════════════════════════════════════════════════════
# SERVER CONFIGURATION
# ═══════════════════════════════════════════════════════════════
PORT=4000
NODE_ENV=development

# ═══════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=zynqcloud_password
DATABASE_NAME=zynqcloud
DATABASE_URL=postgresql://zynqcloud:zynqcloud_password@localhost:5432/zynqcloud

# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════
# IMPORTANT: Use a strong secret in production (min 32 characters)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost

# ═══════════════════════════════════════════════════════════════
# S3 / MINIO STORAGE
# ═══════════════════════════════════════════════════════════════
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# ═══════════════════════════════════════════════════════════════
# EMAIL (SMTP) - Optional
# ═══════════════════════════════════════════════════════════════
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=zynqCloud <no-reply@yourdomain.com>

# ═══════════════════════════════════════════════════════════════
# APPLICATION SETTINGS
# ═══════════════════════════════════════════════════════════════
FRONTEND_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
PUBLIC_REGISTRATION=false
INVITE_TOKEN_TTL_HOURS=72

# ═══════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

### Variable Reference

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `PORT` | No | `4000` | HTTP server port |
| `NODE_ENV` | Yes | - | `development` or `production` |
| `DATABASE_HOST` | Yes | - | PostgreSQL hostname |
| `DATABASE_PORT` | No | `5432` | PostgreSQL port |
| `DATABASE_USER` | Yes | - | Database username |
| `DATABASE_PASSWORD` | Yes | - | Database password |
| `DATABASE_NAME` | Yes | - | Database name |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration |
| `S3_ENDPOINT` | Yes | - | S3/MinIO endpoint URL |
| `S3_BUCKET` | Yes | - | Storage bucket name |
| `S3_ACCESS_KEY_ID` | Yes | - | S3 access key |
| `S3_SECRET_ACCESS_KEY` | Yes | - | S3 secret key |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `S3_FORCE_PATH_STYLE` | No | `false` | Required for MinIO |
| `CORS_ORIGIN` | Yes | - | Allowed CORS origins |
| `PUBLIC_REGISTRATION` | No | `false` | Allow signup without invite |
| `INVITE_TOKEN_TTL_HOURS` | No | `72` | Invite link expiration |

## API Reference

### Base URL

```
http://localhost:4000/api/v1
```

### Authentication

All authenticated endpoints require a valid JWT token sent via:
- **Cookie**: `jid` (HttpOnly, set automatically on login)
- **Header**: `Authorization: Bearer <token>`

---

### Auth Endpoints

#### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "inviteToken": "optional-invite-token"
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "storage_used": 0,
  "storage_limit": 5368709120,
  "created_at": "2025-01-20T10:00:00.000Z"
}
```

> **Note**: First registered user automatically becomes `owner`

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response** `200 OK` - Sets `jid` HttpOnly cookie
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

#### Get Current User

```http
GET /auth/me
Cookie: jid=<token>
```

**Response** `200 OK`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "storage_used": 1048576,
  "storage_limit": 5368709120
}
```

#### Logout

```http
POST /auth/logout
Cookie: jid=<token>
```

**Response** `200 OK` - Clears cookie

---

### Files Endpoints

#### List Files

```http
GET /files?page=1&limit=50&search=&parentId=
Cookie: jid=<token>
```

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |
| `search` | string | Search by filename |
| `parentId` | string | Filter by parent folder |

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "document.pdf",
      "mime_type": "application/pdf",
      "size": 1048576,
      "is_folder": false,
      "parent_id": null,
      "created_at": "2025-01-20T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### Create File / Get Upload URL

```http
POST /files
Cookie: jid=<token>
Content-Type: application/json

{
  "name": "document.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "parentId": null,
  "isFolder": false
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "name": "document.pdf",
  "storage_path": "uuid-document.pdf",
  "uploadUrl": "https://s3.../presigned-upload-url",
  "created_at": "2025-01-20T10:00:00.000Z"
}
```

#### Upload Flow

1. Call `POST /files` to get presigned upload URL
2. `PUT` file binary to `uploadUrl`
3. File is now stored and ready

```bash
# Step 2: Upload to presigned URL
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: application/pdf" \
  --data-binary @document.pdf
```

#### Download File

```http
GET /files/:id/download
Cookie: jid=<token>
```

**Response** `200 OK`
```json
{
  "url": "https://s3.../presigned-download-url"
}
```

#### Delete File (Soft)

```http
DELETE /files/:id
Cookie: jid=<token>
```

**Response** `204 No Content`

#### Restore from Trash

```http
POST /files/:id/restore
Cookie: jid=<token>
```

**Response** `200 OK`

#### Permanent Delete

```http
DELETE /files/:id/permanent
Cookie: jid=<token>
```

**Response** `204 No Content`

#### Share File

```http
POST /files/:id/share
Cookie: jid=<token>
Content-Type: application/json

{
  "email": "recipient@example.com",
  "permission": "read",
  "isPublic": false
}
```

**Response** `201 Created`
```json
{
  "id": "share-uuid",
  "file_id": "file-uuid",
  "permission": "read",
  "publicLink": null
}
```

#### Get Shared Files

```http
GET /files/shared
Cookie: jid=<token>
```

#### Get Trash

```http
GET /files/trash?page=1&limit=50
Cookie: jid=<token>
```

---

### Invitations Endpoints (Admin/Owner Only)

#### Create Invitation

```http
POST /invites
Cookie: jid=<token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "user"
}
```

**Response** `201 Created`
```json
{
  "id": "uuid",
  "email": "newuser@example.com",
  "token": "invite-token",
  "link": "http://localhost:3001/register?inviteToken=invite-token",
  "role": "user",
  "status": "pending",
  "expires_at": "2025-01-23T10:00:00.000Z"
}
```

#### List Invitations

```http
GET /invites
Cookie: jid=<token>
```

#### Revoke Invitation

```http
POST /invites/:id/revoke
Cookie: jid=<token>
```

---

### Admin Endpoints (Admin/Owner Only)

#### List Users

```http
GET /admin/users?page=1&limit=50
Cookie: jid=<token>
```

**Response** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "storage_used": 1048576,
      "storage_limit": 5368709120,
      "created_at": "2025-01-20T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

#### Update User

```http
PUT /admin/users/:id
Cookie: jid=<token>
Content-Type: application/json

{
  "role": "admin",
  "storage_limit": 10737418240
}
```

#### Delete User

```http
DELETE /admin/users/:id
Cookie: jid=<token>
```

---

### Settings Endpoints

#### Get Settings

```http
GET /settings
Cookie: jid=<token>
```

#### Update Settings

```http
PUT /settings
Cookie: jid=<token>
Content-Type: application/json

{
  "theme": "dark",
  "notifications": true
}
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 5368709120,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255),
    size BIGINT DEFAULT 0,
    storage_path VARCHAR(500),
    parent_id UUID REFERENCES files(id) ON DELETE CASCADE,
    is_folder BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    inviter_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Shares table
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    grantee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    grantee_email VARCHAR(255),
    permission VARCHAR(50) DEFAULT 'read',
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## User Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full system access, first registered user |
| `admin` | Manage users, invites, view all files |
| `user` | Manage own files, access shared files |

## Development

### Available Scripts

```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build

# Start production server
npm run start:prod

# Run linter
npm run lint

# Format code
npm run format

# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

### Project Structure

```
backend/
├── src/
│   ├── auth/                 # Authentication module
│   │   ├── decorators/       # @CurrentUser, @Roles
│   │   ├── dto/              # Login, Register DTOs
│   │   ├── guards/           # JWT, Roles guards
│   │   ├── strategies/       # Passport JWT strategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── files/                # File management module
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── files.controller.ts
│   │   ├── files.service.ts
│   │   └── files.module.ts
│   ├── users/                # User management
│   ├── invites/              # Invitation system
│   ├── admin/                # Admin operations
│   ├── settings/             # User settings
│   ├── storage/              # S3 integration
│   ├── email/                # SMTP service
│   ├── common/               # Shared utilities
│   ├── app.module.ts         # Root module
│   └── main.ts               # Entry point
├── migrations/               # SQL migrations
├── test/                     # Test files
├── Dockerfile
├── .env.example
└── package.json
```

## Production Deployment

### Docker

```bash
# Build production image
docker build -t zynqcloud-backend .

# Run container
docker run -d \
  --name zynqcloud-backend \
  -p 4000:4000 \
  --env-file .env.production \
  zynqcloud-backend
```

### Docker Compose

```yaml
backend:
  build: ./backend
  environment:
    NODE_ENV: production
    DATABASE_HOST: postgres
    JWT_SECRET: ${JWT_SECRET}
    S3_ENDPOINT: http://minio:9000
  depends_on:
    - postgres
    - minio
  restart: unless-stopped
```

### Production Checklist

#### Security

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (32+ characters, randomly generated)
- [ ] Enable HTTPS (set `secure: true` on cookies)
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Use strong database passwords
- [ ] Rotate secrets regularly

#### Infrastructure

- [ ] Set up database backups
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up S3 bucket lifecycle policies
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation

#### Performance

- [ ] Enable gzip compression
- [ ] Configure proper cache headers
- [ ] Set up CDN for static assets
- [ ] Monitor memory usage
- [ ] Configure connection limits

### Health Check

Add a health endpoint for load balancers:

```bash
curl http://localhost:4000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:00:00.000Z",
  "uptime": 3600
}
```

## Security

### Implemented Security Measures

| Feature | Implementation |
|---------|---------------|
| Password Hashing | bcrypt (cost factor: 12) |
| Token Storage | HttpOnly cookies (XSS protection) |
| CSRF Protection | SameSite cookie policy |
| SQL Injection | TypeORM parameterized queries |
| Input Validation | class-validator decorators |
| Rate Limiting | @nestjs/throttler |
| CORS | Configurable allowed origins |
| Role-Based Access | Custom guards |

### Security Headers (Recommended)

Configure in reverse proxy (Nginx/Caddy):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL status
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Test connection
psql -h localhost -U zynqcloud -d zynqcloud -c "SELECT 1"
```

### S3/MinIO Upload Failed

```bash
# Check MinIO status
docker-compose ps minio

# Verify bucket exists
docker exec zynqcloud-minio mc ls myminio/

# Check credentials
curl http://localhost:9000/minio/health/live
```

### JWT/Auth Issues

- Verify `JWT_SECRET` is consistent across restarts
- Check cookie domain matches your setup
- Ensure frontend sends `credentials: 'include'`

### CORS Errors

- Verify `CORS_ORIGIN` exactly matches frontend URL
- Include protocol (`http://` or `https://`)
- Check for trailing slashes

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

<p align="center">
  <strong>zynqCloud Backend</strong> - Built with NestJS for production-grade performance
  <br />
  <a href="https://github.com/DineshMN1/zynq">GitHub</a> ·
  <a href="https://github.com/DineshMN1/zynq/issues">Report Bug</a> ·
  <a href="https://github.com/DineshMN1/zynq/discussions">Discussions</a>
</p>
