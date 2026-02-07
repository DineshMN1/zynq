<div align="center">

# zynqCloud

**Self-hosted file storage. Your files, your server, your control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com/)

[![GitHub stars](https://img.shields.io/github/stars/DineshMN1/zynq?style=social)](https://github.com/DineshMN1/zynq/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/DineshMN1/zynq?style=social)](https://github.com/DineshMN1/zynq/network/members)
[![GitHub contributors](https://img.shields.io/github/contributors/DineshMN1/zynq)](https://github.com/DineshMN1/zynq/graphs/contributors)

[Quick Start](#quick-start) • [Features](#features) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Quick Start

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq
docker compose up -d --build
```

Open **http://localhost:3000** → Create your admin account → Done!

---

## Features

| Feature             | Description                           |
| ------------------- | ------------------------------------- |
| **File Management** | Upload, download, organize in folders |
| **Sharing**         | Share with users or public links      |
| **Roles**           | Owner, Admin, User permissions        |
| **Invites**         | Invite-only registration              |
| **Trash**           | Soft delete with restore              |
| **Deduplication**   | SHA-256 hash prevents duplicates      |
| **Storage Quotas**  | Per-user storage limits               |
| **SMTP**            | Email for invites & password reset    |
| **Themes**          | Dark / Light mode                     |

---

## Tech Stack

| Layer        | Technologies                                  |
| ------------ | --------------------------------------------- |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| **Backend**  | NestJS 10, TypeORM, PostgreSQL                |
| **Storage**  | Local filesystem (encrypted)                  |
| **Auth**     | JWT + HttpOnly Cookies                        |

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

| Service | URL                          | Credentials        |
| ------- | ---------------------------- | ------------------ |
| App     | http://localhost:3000        | First user = Owner |
| API     | http://localhost:4000/api/v1 | —                  |

---

## Commands

```bash
# Production
docker compose up -d --build  # Start (build & run)
docker compose down           # Stop
docker compose logs -f        # Logs
docker compose down -v        # Reset (deletes data)

# Development (hot reload, no rebuild needed)
pnpm docker:dev               # Start dev environment
pnpm docker:down              # Stop all containers
```

---

## Configuration

Copy `apps/server/.env.example` and configure:

| Variable     | Description             |
| ------------ | ----------------------- |
| `JWT_SECRET` | Auth secret (32+ chars) |
| `DATABASE_*` | PostgreSQL connection   |
| `S3_*`       | Storage (S3/MinIO)      |
| `SMTP_*`     | Email settings          |

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
# Local development (without Docker)
pnpm install
pnpm turbo run dev                    # Start all with hot reload

# Quality checks
pnpm turbo run lint                   # Lint all packages
pnpm turbo run test                   # Test all packages
pnpm turbo run build                  # Build all packages
```

---

## License

[MIT](LICENSE) © zynqCloud

---

<div align="center">

**Your files. Your cloud. Your control.**

⭐ Star us on GitHub if you find this useful!

</div>
