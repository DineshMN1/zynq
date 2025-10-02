# zynqCloud Backend

Self-hosted file management backend built with NestJS, PostgreSQL, and S3-compatible storage.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with HttpOnly cookies, role-based access control
- **File Management**: Upload, download, share, delete (soft & permanent) files
- **Folder Structure**: Hierarchical folder organization
- **Invite System**: Admin-only user invitations with email notifications
- **Storage Integration**: S3/MinIO for file storage, PostgreSQL for metadata
- **User Management**: Admin panel for user management and storage quotas
- **Settings**: User preferences (theme, telemetry)
- **Security**: Rate limiting, CORS, bcrypt password hashing, input validation

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 14+
- S3-compatible storage (MinIO, AWS S3, etc.)
- SMTP server (for invitation emails)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://zynqcloud:zynqcloud_password@localhost:5432/zynqcloud
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=zynqcloud_password
DATABASE_NAME=zynqcloud

# JWT & Cookies
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost

# SMTP (for invitations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=zynqCloud <no-reply@yourdomain.com>

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Features
ENABLE_TELEMETRY=false
PUBLIC_REGISTRATION=false
INVITE_TOKEN_TTL_HOURS=72

# Frontend
FRONTEND_URL=http://localhost:3000

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

### 3. Start Services with Docker

Start PostgreSQL and MinIO:

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL on port 5432
- Start MinIO on port 9000 (API) and 9001 (Console)
- Automatically run database migrations
- Create the `zynq-cloud` bucket in MinIO

Access MinIO Console: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

### 4. Run Database Migrations

The migrations run automatically via docker-compose. For manual execution:

```bash
psql -h localhost -U zynqcloud -d zynqcloud -f migrations/001_initial_schema.sql
```

### 5. Start the Backend

Development mode (with hot reload):

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

The API will be available at: **http://localhost:4000/api/v1**

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/me` | Get current user | Yes |

### Files

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/files` | List user's files | Yes |
| POST | `/files` | Create file metadata & get upload URL | Yes |
| GET | `/files/:id` | Get file metadata | Yes |
| DELETE | `/files/:id` | Soft delete file | Yes |
| POST | `/files/:id/restore` | Restore from trash | Yes |
| DELETE | `/files/:id/permanent` | Permanently delete | Yes |
| POST | `/files/:id/share` | Share file with user | Yes |
| GET | `/files/shared` | Get files shared with me | Yes |
| GET | `/files/trash` | Get trashed files | Yes |
| GET | `/files/:id/download` | Get download URL | Yes |

### Invitations (Admin Only)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/invites` | Create invitation | Admin |
| GET | `/invites` | List pending invites | Admin |
| POST | `/invites/:id/revoke` | Revoke invitation | Admin |
| POST | `/invites/accept` | Accept invitation | No |

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List all users | Admin |
| PUT | `/admin/users/:id` | Update user role/quota | Admin |
| DELETE | `/admin/users/:id` | Delete user | Admin |

### Settings

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/settings` | Get user settings | Yes |
| PUT | `/settings` | Update user settings | Yes |

## 🔐 Authentication Flow

### Registration

1. **With Invite Token**:
```bash
POST /api/v1/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "inviteToken": "uuid-token-here"
}
```

2. **Public Registration** (if enabled):
```bash
POST /api/v1/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

Response: Sets `jid` HttpOnly cookie and returns user data.

### Login

```bash
POST /api/v1/auth/login
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

Response: Sets `jid` HttpOnly cookie.

### Logout

```bash
POST /api/v1/auth/logout
```

Clears the `jid` cookie.

## 📦 File Upload Flow

1. **Create file metadata**:
```bash
POST /api/v1/files
{
  "name": "document.pdf",
  "size": 1024000,
  "mimeType": "application/pdf",
  "parentId": null,  // optional
  "isFolder": false
}
```

Response:
```json
{
  "id": "file-uuid",
  "name": "document.pdf",
  "uploadUrl": "https://minio:9000/presigned-url...",
  "storage_path": "uuid-document.pdf",
  ...
}
```

2. **Upload file to presigned URL**:
```bash
PUT <uploadUrl>
Content-Type: application/pdf
Body: <file-binary-data>
```

3. **Download file**:
```bash
GET /api/v1/files/:id/download
```

Response:
```json
{
  "url": "https://minio:9000/presigned-download-url..."
}
```

## 👥 Invitation System

### Admin creates invitation:

```bash
POST /api/v1/invites
{
  "email": "newuser@example.com",
  "role": "user"
}
```

Response:
```json
{
  "id": "invite-uuid",
  "email": "newuser@example.com",
  "token": "token-uuid",
  "link": "http://localhost:3000/register?inviteToken=token-uuid",
  "status": "pending",
  "expires_at": "2024-01-15T12:00:00Z"
}
```

An email is automatically sent to the invitee with the registration link.

### New user registers with token:

```bash
POST /api/v1/auth/register
{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "password123",
  "inviteToken": "token-uuid"
}
```

## 🗄️ Database Schema

```sql
users (id, name, email, password_hash, role, storage_used, storage_limit, created_at, updated_at)
invitations (id, email, token, role, inviter_id, status, created_at, expires_at)
files (id, owner_id, name, mime_type, size, storage_path, parent_id, is_folder, deleted_at, created_at, updated_at)
shares (id, file_id, grantee_user_id, grantee_email, permission, created_by, created_at)
settings (id, user_id, key, value, updated_at)
```

## 🧪 Testing

Run unit tests:
```bash
npm run test
```

Run e2e tests:
```bash
npm run test:e2e
```

Test coverage:
```bash
npm run test:cov
```

## 🐳 Docker Deployment

### Build and run with Docker:

```bash
# Build image
docker build -t zynqcloud-backend .

# Run container
docker run -p 4000:4000 --env-file .env zynqcloud-backend
```

### Full stack with docker-compose:

```bash
docker-compose up -d
```

## 📊 Monitoring

The application uses NestJS built-in logging. For production:

1. **Health Check Endpoint** (add to `app.controller.ts`):
```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

2. **Prometheus Metrics**: Install `@willsoto/nestjs-prometheus`

3. **Error Tracking**: Integrate Sentry

## 🔒 Security Best Practices

- ✅ JWT tokens in HttpOnly cookies (XSS protection)
- ✅ Bcrypt password hashing (cost: 12)
- ✅ Rate limiting on all endpoints
- ✅ Input validation with class-validator
- ✅ CORS configured for frontend origin
- ✅ SQL injection protection via TypeORM
- ✅ Role-based access control

### Production Checklist:

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (32+ characters)
- [ ] Enable HTTPS and set `secure: true` on cookies
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Rotate secrets regularly
- [ ] Enable CSP headers
- [ ] Monitor logs and errors
- [ ] Set up S3 bucket lifecycle policies

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 4000 | Server port |
| NODE_ENV | Yes | - | Environment (development/production) |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| JWT_SECRET | Yes | - | JWT signing secret (32+ chars) |
| SMTP_HOST | Yes | - | SMTP server hostname |
| S3_ENDPOINT | Yes | - | S3 endpoint URL |
| S3_BUCKET | Yes | - | S3 bucket name |
| FRONTEND_URL | Yes | - | Frontend URL for invite links |
| PUBLIC_REGISTRATION | No | false | Allow registration without invite |
| INVITE_TOKEN_TTL_HOURS | No | 72 | Invite expiration (hours) |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Database connection fails
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Verify credentials match docker-compose.yml

### MinIO upload fails
- Check MinIO is running: `docker-compose ps`
- Verify bucket exists: http://localhost:9001
- Ensure S3_FORCE_PATH_STYLE=true for local MinIO

### Email invitations not sending
- Verify SMTP credentials
- For Gmail, use App Password (not account password)
- Check SMTP_PORT and SMTP_SECURE settings

### CORS errors
- Ensure CORS_ORIGIN matches frontend URL exactly
- Check frontend is using credentials: 'include'

---

Built with ❤️ using NestJS, TypeORM, and PostgreSQL