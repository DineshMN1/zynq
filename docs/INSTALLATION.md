# Installation

## Docker (Recommended)

```bash
git clone https://github.com/your-username/zynq.git
cd zynq
docker compose up -d
```

**Services:**
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- PostgreSQL: localhost:5432

## Manual Setup

### Requirements

- Node.js 20+
- PostgreSQL 14+
- S3-compatible storage (MinIO for local)

### Database

```bash
createdb zynqcloud
psql -d zynqcloud -f apps/server/migrations/001_initial_schema.sql
```

### Backend

```bash
cd apps/server
cp .env.example .env
# Edit .env with your settings
npm install
npm run start:dev
```

### Frontend

```bash
cd apps/client
npm install
npm run dev
```

## Environment Variables

### Backend (.env)

```env
PORT=4000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=your_password
DATABASE_NAME=zynqcloud
JWT_SECRET=your-secret-at-least-32-characters
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## Production Checklist

- [ ] Use HTTPS
- [ ] Strong JWT_SECRET (32+ chars)
- [ ] Change default passwords
- [ ] Configure firewall
- [ ] Set up backups
- [ ] Enable rate limiting

## Troubleshooting

**Database connection failed:**
```bash
docker compose ps postgres
docker compose logs postgres
```

**CORS error:**
Check `CORS_ORIGIN` matches your frontend URL exactly.

**Upload failed:**
Verify MinIO is running and bucket exists.
