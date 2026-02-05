# zynqCloud

Self-hosted file storage. Your files, your server, your control.

## Quick Start

```bash
git clone <repo-url>
cd zynq
docker compose up -d --build
```

Open **http://localhost:3000** and create your admin account.

## Features

- File upload, folders, sharing
- Role-based access (Owner, Admin, User)
- Invite-only registration
- Trash with restore
- Duplicate detection (SHA-256)
- S3-compatible storage
- Dark/light theme

## Tech Stack

**Frontend:** Next.js 15, React 19, Tailwind CSS, shadcn/ui
**Backend:** NestJS, TypeORM, PostgreSQL
**Storage:** AWS S3 or MinIO

## Services

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| App | http://localhost:3000 | First user = Owner |
| API | http://localhost:4000/api/v1 | - |

## First User Setup

1. Visit http://localhost:3000
2. You'll be redirected to setup page
3. Create admin account (name, email, password)
4. Done - invite others from Settings > Invites

## Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Reset (deletes data)
docker compose down -v && docker compose up -d --build

# Logs
docker compose logs -f backend
```

## Environment

Copy `apps/server/.env.example` to `.env` and configure:

- `JWT_SECRET` - Strong secret (32+ chars)
- `DATABASE_*` - PostgreSQL connection
- `S3_*` - Storage configuration
- `SMTP_*` - Email for invites (optional)

## Project Structure

```
zynq/
├── apps/
│   ├── client/          # Next.js frontend
│   └── server/          # NestJS backend
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/setup-status` | Check if setup needed |
| POST | `/auth/register` | Register (first = owner) |
| POST | `/auth/login` | Login |
| GET | `/files` | List files |
| POST | `/files` | Create file/folder |
| DELETE | `/files/:id` | Move to trash |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
