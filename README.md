<div align="center">

# zynqCloud

**Self-hosted file storage. Your files, your server, your control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com/)

[Quick Start](#quick-start) • [Features](#features) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Quick Start

```bash
git clone https://github.com/your-username/zynq.git
cd zynq
docker compose up -d --build
```

Open **http://localhost:3000** → Create your admin account → Done!

---

## Features

| Feature | Description |
|---------|-------------|
| **File Management** | Upload, download, organize in folders |
| **Sharing** | Share with users or public links |
| **Roles** | Owner, Admin, User permissions |
| **Invites** | Invite-only registration |
| **Trash** | Soft delete with restore |
| **Deduplication** | SHA-256 hash prevents duplicates |
| **Storage Quotas** | Per-user storage limits |
| **SMTP** | Email for invites & password reset |
| **Themes** | Dark / Light mode |

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| **Backend** | NestJS 10, TypeORM, PostgreSQL |
| **Storage** | Local filesystem (encrypted) |
| **Auth** | JWT + HttpOnly Cookies |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       zynqCloud                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐              ┌─────────────┐          │
│  │   Next.js   │   REST API   │   NestJS    │          │
│  │   :3000     │◄────────────►│   :4000     │          │
│  └─────────────┘              └──────┬──────┘          │
│                                      │                  │
│                    ┌─────────────────┼─────────────┐   │
│                    ▼                 ▼             ▼   │
│              ┌──────────┐     ┌──────────┐   ┌──────┐ │
│              │ Postgres │     │  Files   │   │ SMTP │ │
│              │  :5432   │     │ (Local)  │   │      │ │
│              └──────────┘     └──────────┘   └──────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Services

| Service | URL | Credentials |
|---------|-----|-------------|
| App | http://localhost:3000 | First user = Owner |
| API | http://localhost:4000/api/v1 | — |

---

## Commands

```bash
docker compose up -d          # Start
docker compose down           # Stop
docker compose logs -f        # Logs
docker compose down -v        # Reset (deletes data)
```

---

## Configuration

Copy `apps/server/.env.example` and configure:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Auth secret (32+ chars) |
| `DATABASE_*` | PostgreSQL connection |
| `S3_*` | Storage (S3/MinIO) |
| `SMTP_*` | Email settings |

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for full setup guide.

---

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Security Policy](SECURITY.md)

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
# Development
cd apps/server && npm run start:dev
cd apps/client && npm run dev
```

---

## License

[MIT](LICENSE) © zynqCloud

---

<div align="center">

**Your files. Your cloud. Your control.**

⭐ Star us on GitHub if you find this useful!

</div>

