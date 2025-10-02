# 🚀 Getting Started with zynqCloud

Complete guide to running the full-stack zynqCloud application (NestJS backend + Next.js frontend).

## 📦 What's Included

### Backend (NestJS + PostgreSQL + S3/MinIO)
- ✅ Complete authentication system with JWT cookies
- ✅ File management with presigned S3 uploads/downloads
- ✅ Admin invitation system with email notifications
- ✅ Role-based access control (user, admin, owner)
- ✅ Storage quota management
- ✅ File sharing functionality
- ✅ Soft delete with trash/restore
- ✅ User settings and preferences
- ✅ Rate limiting and security features

### Frontend (Next.js + Tailwind CSS)
- ✅ Modern landing page with hero section
- ✅ Login and registration pages with invite support
- ✅ Dashboard with sidebar navigation
- ✅ File grid with upload/share/delete actions
- ✅ Admin panel for user and invite management
- ✅ Dark/light theme toggle
- ✅ Fully typed TypeScript API client
- ✅ Responsive design

## 🏃 Quick Start (5 minutes)

### Step 1: Start Backend Services

```bash
cd backend
npm install
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- MinIO on ports 9000 (API) and 9001 (Console)
- Automatically creates database schema

### Step 2: Configure Backend Environment

```bash
cp .env.example .env
```

**Minimal configuration** (works out of the box with docker-compose):

```env
PORT=4000
NODE_ENV=development

# Database (matches docker-compose defaults)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=zynqcloud_password
DATABASE_NAME=zynqcloud

# JWT Secret (generate a strong one for production)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# SMTP (configure for email invitations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=zynqCloud <no-reply@yourdomain.com>

# MinIO (matches docker-compose defaults)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Features
PUBLIC_REGISTRATION=true
INVITE_TOKEN_TTL_HOURS=72
ENABLE_TELEMETRY=false

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### Step 3: Start Backend Server

```bash
npm run start:dev
```

Backend will be running at: **http://localhost:4000/api/v1**

### Step 4: Start Frontend

```bash
cd ../  # Back to root
npm install
npm run dev
```

Frontend will be running at: **http://localhost:3000**

### Step 5: Create First Admin User

Visit **http://localhost:3000** and click **"Get Started"** to register.

The first user can be made an admin by manually updating the database:

```bash
docker exec -it zynqcloud-postgres psql -U zynqcloud -d zynqcloud
```

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

## 🎯 Usage Guide

### 1. Authentication

#### Register a New User
- Navigate to **http://localhost:3000**
- Click **"Get Started"** or **"Register"**
- Fill in name, email, password
- If `PUBLIC_REGISTRATION=false`, you'll need an invite token

#### Login
- Navigate to **http://localhost:3000/login**
- Enter email and password
- You'll be redirected to the dashboard

### 2. File Management

#### Upload Files
1. Go to **Dashboard → My Files**
2. Click **"Upload File"** button
3. Select file from your computer
4. File is uploaded to MinIO and metadata stored in PostgreSQL

#### Create Folders
1. Click **"Create Folder"** button
2. Enter folder name
3. Navigate into folders by clicking them

#### Share Files
1. Click the **share icon** on any file
2. Enter recipient's email or user ID
3. Select permission (read/write)
4. File appears in recipient's **"Shared"** tab

#### Delete Files
1. Click **delete icon** to soft delete
2. File moves to **"Trash"**
3. From Trash: **Restore** or **Permanently Delete**

### 3. Admin Features

#### Invite New Users (Admin Only)
1. Go to **Dashboard → Settings → Invites**
2. Click **"Create Invite"**
3. Enter email and select role (user/admin)
4. Copy the invite link or email is sent automatically
5. Share link with new user

#### Manage Users (Admin Only)
1. Go to **Dashboard → Settings → Users**
2. View all users, storage usage, and roles
3. Update user roles or storage limits
4. Delete users if needed

### 4. Settings & Preferences

- **Theme**: Toggle dark/light mode
- **Telemetry**: Opt in/out of telemetry (if enabled)
- **Profile**: View account details and storage usage

## 🗂️ Project Structure

```
zynqcloud/
├── backend/                    # NestJS Backend
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── users/             # User management
│   │   ├── files/             # File operations
│   │   ├── invites/           # Invitation system
│   │   ├── admin/             # Admin operations
│   │   ├── settings/          # User settings
│   │   ├── storage/           # S3/MinIO integration
│   │   ├── email/             # Email service
│   │   └── main.ts            # Entry point
│   ├── migrations/            # Database migrations
│   ├── docker-compose.yml     # PostgreSQL + MinIO
│   └── package.json
│
├── src/                       # Next.js Frontend
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── login/             # Login page
│   │   ├── register/          # Registration page
│   │   └── dashboard/         # Protected dashboard
│   │       ├── files/         # My Files
│   │       ├── shared/        # Shared Files
│   │       ├── trash/         # Trash
│   │       ├── settings/      # Settings & Admin
│   │       └── profile/       # User Profile
│   ├── components/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── Header.tsx         # Top header with user menu
│   │   └── ui/                # shadcn components
│   └── lib/
│       ├── api.ts             # Typed API client
│       └── auth.ts            # Auth utilities
│
└── README.md                  # Main documentation
```

## 🔧 Configuration Options

### Backend Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PUBLIC_REGISTRATION` | Allow signup without invite | `true` or `false` |
| `INVITE_TOKEN_TTL_HOURS` | Invite link expiration | `72` (3 days) |
| `JWT_EXPIRES_IN` | Session duration | `7d` (7 days) |
| `ENABLE_TELEMETRY` | Anonymous usage stats | `false` |

### Frontend Environment Variables

Create `.env.local` in root:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:cov          # Coverage report
```

### Frontend Tests

```bash
npm run test              # Run tests
npm run test:watch        # Watch mode
```

## 📊 Monitoring & Debugging

### Check Backend Health

```bash
curl http://localhost:4000/api/v1/auth/me
```

### View Logs

**Backend logs**:
```bash
cd backend
npm run start:dev  # Logs appear in console
```

**Database logs**:
```bash
docker logs zynqcloud-postgres
```

**MinIO logs**:
```bash
docker logs zynqcloud-minio
```

### Access MinIO Console

1. Open **http://localhost:9001**
2. Login: `minioadmin` / `minioadmin`
3. View buckets and uploaded files

### Database Access

```bash
docker exec -it zynqcloud-postgres psql -U zynqcloud -d zynqcloud
```

```sql
-- View all users
SELECT id, name, email, role, storage_used, storage_limit FROM users;

-- View files
SELECT id, name, size, is_folder, deleted_at FROM files;

-- View invitations
SELECT id, email, status, expires_at FROM invitations;
```

## 🚢 Production Deployment

### Backend Deployment

1. **Build Docker image**:
```bash
cd backend
docker build -t zynqcloud-backend .
```

2. **Run in production**:
```bash
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=your-prod-db-url \
  -e JWT_SECRET=your-prod-secret \
  -e S3_ENDPOINT=your-s3-endpoint \
  zynqcloud-backend
```

3. **Use managed services**:
   - PostgreSQL: AWS RDS, DigitalOcean, Supabase
   - S3: AWS S3, DigitalOcean Spaces, Wasabi
   - Email: SendGrid, AWS SES, Mailgun

### Frontend Deployment

**Vercel** (recommended):
```bash
vercel --prod
```

**Docker**:
```bash
docker build -t zynqcloud-frontend .
docker run -p 3000:3000 zynqcloud-frontend
```

**Environment**:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Security Checklist

- [ ] Change default passwords (PostgreSQL, MinIO)
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS (Let's Encrypt)
- [ ] Set `secure: true` on cookies in production
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable SMTP for invitations
- [ ] Review CORS origins
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure S3 bucket policies

## 🐛 Troubleshooting

### "Failed to connect to database"
**Solution**:
```bash
docker-compose ps  # Check if PostgreSQL is running
docker-compose restart postgres
```

### "CORS error" in frontend
**Solution**: Ensure `CORS_ORIGIN` in backend `.env` matches frontend URL exactly.

### "Upload failed"
**Solution**: 
1. Check MinIO is running: `docker-compose ps`
2. Verify bucket exists: http://localhost:9001
3. Ensure `S3_FORCE_PATH_STYLE=true` for local MinIO

### "Invitation email not sent"
**Solution**:
1. Configure SMTP settings in `.env`
2. For Gmail, use [App Password](https://support.google.com/accounts/answer/185833)
3. Test SMTP connection

### "Storage limit exceeded"
**Solution**:
```bash
# Increase user's storage limit
docker exec -it zynqcloud-postgres psql -U zynqcloud -d zynqcloud
UPDATE users SET storage_limit = 21474836480 WHERE email = 'user@example.com';  -- 20GB
```

## 📚 API Examples

### Register

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Login

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Get Current User

```bash
curl http://localhost:4000/api/v1/auth/me \
  -b cookies.txt
```

### Upload File (2-step process)

**Step 1**: Create file metadata
```bash
curl -X POST http://localhost:4000/api/v1/files \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "isFolder": false
  }'
```

Returns: `{ "uploadUrl": "...", "id": "..." }`

**Step 2**: Upload to presigned URL
```bash
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: application/pdf" \
  --data-binary @document.pdf
```

### Create Invitation (Admin)

```bash
curl -X POST http://localhost:4000/api/v1/invites \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "role": "user"
  }'
```

## 🎓 Next Steps

1. **Customize Branding**: Update colors, logo, and text in frontend
2. **Add Features**: Implement version history, file previews, or comments
3. **Configure Backups**: Set up automated database and S3 backups
4. **Monitoring**: Integrate Prometheus, Grafana, or Sentry
5. **Scale**: Add Redis for caching, load balancing, CDN

## 🤝 Support

- **Documentation**: See `backend/README.md` and root `README.md`
- **Issues**: Report bugs on GitHub
- **Community**: Join discussions

## 📄 License

MIT License

---

**Happy self-hosting! 🚀**