# ZynqCloud

**Open-source self-hosted file storage for teams and individuals.**

Your files, your server, your encryption keys — zero vendor lock-in.

[Quick Start](#quick-start) · [Features](#features) · [Configuration](#configuration) · [Docs](#documentation) · [Contributing](#contributing)

---

## About

ZynqCloud is a privacy-first file cloud you deploy on your own infrastructure. It combines strong AES-256-GCM encryption, invite-only user management, role-based access control, and a clean web UI — packaged as a single Docker Compose stack that runs anywhere Docker does.

**Stack:** Go (Chi, GORM) · React 19 + Vite · PostgreSQL 16 · Docker

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/DineshMN1/zynq/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq
cp .env.example .env
# Edit .env — set JWT_SECRET, FILE_ENCRYPTION_MASTER_KEY, DATABASE_PASSWORD
docker compose up -d
```

Open `http://localhost:3000` → register the first account (becomes Owner automatically) → done.

> **Important:** Back up `FILE_ENCRYPTION_MASTER_KEY` separately from your server. Without it, encrypted files cannot be recovered even with a full database backup.

---

## Features

- **File management** — upload, download, folder tree, drag-and-drop, rename, move, trash + restore
- **Encryption at rest** — AES-256-GCM per-file keys wrapped by a master KEK; plaintext never touches disk
- **Deduplication** — SHA-256 hashing detects identical files; duplicates share one copy on disk
- **Three-tier RBAC** — Owner · Admin · User; Team Spaces add Viewer / Contributor / Admin space roles
- **File sharing** — public links or private shares with optional password and expiry
- **Invite-only registration** — email invitations with pre-assigned roles; public registration toggle
- **Per-user storage quotas** — configurable limits enforced at upload time with 507 on disk full
- **Audit log** — append-only record of every security-relevant action with IP and actor
- **Notification channels** — email, Microsoft Teams, or Resend webhooks for system events
- **Admin panel** — user management, monitoring dashboard, SMTP settings, quota control
- **Cloudflare Tunnel support** — expose securely without opening inbound ports
- **Light / Dark themes**

---

## Architecture

```text
┌─────────────────────────────────────────┐
│  Browser (React 19 + Vite + Tailwind)   │
└──────────────────┬──────────────────────┘
                   │ HTTP/REST (JWT cookie)
┌──────────────────▼──────────────────────┐
│  Go API  (Chi router · GORM · AES-GCM)  │
│  Single binary serves API + React SPA   │
└──────┬─────────────────────┬────────────┘
       │                     │
┌──────▼──────┐   ┌──────────▼──────────┐
│ PostgreSQL  │   │  /data/files (CAS)  │
│  (metadata) │   │  encrypted blobs    │
└─────────────┘   └─────────────────────┘
```

All services run in Docker Compose. The Go binary serves both the REST API and the pre-built React SPA — no separate reverse proxy required for basic deployments.

---

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description |
| --- | --- |
| `JWT_SECRET` | Auth signing secret — 32+ random characters |
| `FILE_ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte master key — **back this up** |
| `DATABASE_PASSWORD` | PostgreSQL password |
| `ZYNQ_DATA_PATH` | Host path where encrypted files are stored |
| `COOKIE_DOMAIN` | Your domain (e.g. `cloud.example.com`) |
| `CORS_ORIGIN` | Frontend URL (e.g. `https://cloud.example.com`) |

Generate secrets:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # FILE_ENCRYPTION_MASTER_KEY
```

See `.env.example` for the full reference with all options and defaults.

---

## Documentation

| Doc | Description |
| --- | --- |
| [docs/reverse-proxy.md](docs/reverse-proxy.md) | Caddy, nginx, Traefik, and LAN-only setup |
| [docs/backup-restore.md](docs/backup-restore.md) | Backup and restore runbook |
| [docs/updating.md](docs/updating.md) | Zero-downtime update guide |
| [docs/key-recovery.md](docs/key-recovery.md) | What to do if you lose your `.env` |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common failures and fixes |

---

## Operations

**Backup** (DB + files + key):

```bash
./scripts/backup.sh
```

**Update to latest:**

```bash
./scripts/update.sh
```

**Restore from backup:**

```bash
./scripts/restore.sh
```

**Enable automated daily DB backups:**

```bash
docker compose --profile backup up -d
```

---

## Hardware Requirements

| | Minimum | Recommended |
| --- | --- | --- |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Disk | 10 GB+ | SSD |
| OS | Linux with Docker | Ubuntu 22.04+ |

Runs on a Raspberry Pi 4, an Oracle Cloud free tier VM, or any VPS.

---

## Security

- AES-256-GCM encryption per file with KEK/DEK hierarchy
- bcrypt password hashing
- JWT in HTTP-only Secure cookies
- Rate limiting on auth endpoints (10 attempts / 15 min per IP)
- Blocked upload extensions (exe, bat, ps1, sh, dll, apk, and more)
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
- Path traversal protection on all file I/O
- Non-root user inside container
- Startup key fingerprint verification — server refuses to start if master key changed

To report a vulnerability privately, see [SECURITY.md](SECURITY.md).

---

## Development

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq

# Start PostgreSQL for local dev
docker compose -f docker-compose.dev.yml up -d

# Backend (Go)
cd server
cp .env.dev.example .env.dev
go run ./cmd/api

# Frontend (new terminal)
cd web
pnpm install
pnpm dev
```

Run backend tests:

```bash
cd server && go test ./...
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests are welcome — please keep changes focused and include tests for new behaviour.

---

## License

MIT © ZynqCloud

---

**Your files. Your cloud. Your control.**
