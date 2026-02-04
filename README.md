<div align="center">

# zynqCloud

### Self-Hosted File Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://docker.com/)

**Take control of your files. Host your own cloud.**

[Quick Start](#quick-start) · [Project Structure](#project-structure) · [API Endpoints](#api-endpoints) · [Contributing](#contributing)

---

</div>

## Why zynqCloud?

In an era of data breaches and privacy concerns, zynqCloud gives you **complete ownership** of your files. No third-party access, no subscriptions, no compromises.

<table>
<tr>
<td width="50%">

### For Individuals
- Store personal documents securely
- Access files from anywhere
- Share with family & friends
- No monthly fees

</td>
<td width="50%">

### For Teams
- Collaborate on projects
- Role-based access control
- Invite-only registration
- Centralized file management

</td>
</tr>
</table>

---

## Features

<table>
<tr>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:shield-lock.svg?color=%237c3aed" width="48" height="48" alt="Security" />
<br /><br />
<b>Secure by Default</b>
<br />
<sub>JWT auth, bcrypt hashing, HttpOnly cookies</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:folder-multiple.svg?color=%237c3aed" width="48" height="48" alt="Files" />
<br /><br />
<b>File Management</b>
<br />
<sub>Upload, organize, share, and recover files</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:account-group.svg?color=%237c3aed" width="48" height="48" alt="Team" />
<br /><br />
<b>Team Collaboration</b>
<br />
<sub>Share files with granular permissions</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:cloud-sync.svg?color=%237c3aed" width="48" height="48" alt="Storage" />
<br /><br />
<b>S3 Compatible</b>
<br />
<sub>AWS S3, MinIO, or any S3 storage</sub>
</td>
</tr>
<tr>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:account-key.svg?color=%237c3aed" width="48" height="48" alt="Roles" />
<br /><br />
<b>Role-Based Access</b>
<br />
<sub>Owner, Admin, User permission levels</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:email-fast.svg?color=%237c3aed" width="48" height="48" alt="Invites" />
<br /><br />
<b>Invite System</b>
<br />
<sub>Controlled user registration</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:delete-restore.svg?color=%237c3aed" width="48" height="48" alt="Trash" />
<br /><br />
<b>Trash & Recovery</b>
<br />
<sub>Soft delete with restore option</sub>
</td>
<td align="center" width="25%">
<br />
<img src="https://api.iconify.design/mdi:content-duplicate.svg?color=%237c3aed" width="48" height="48" alt="Duplicate" />
<br /><br />
<b>Duplicate Detection</b>
<br />
<sub>SHA-256 content hashing prevents duplicates</sub>
</td>
</tr>
</table>

---

## Tech Stack

<table>
<tr>
<th align="left">Frontend</th>
<th align="left">Backend</th>
<th align="left">Infrastructure</th>
</tr>
<tr>
<td valign="top">

- **Next.js 15** - React Framework
- **React 19** - UI Library
- **TypeScript** - Type Safety
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Components
- **Framer Motion** - Animations

</td>
<td valign="top">

- **NestJS 10** - Node.js Framework
- **TypeORM** - Database ORM
- **PostgreSQL** - Database
- **Passport.js** - Authentication
- **AWS SDK** - S3 Integration
- **Nodemailer** - Email Service

</td>
<td valign="top">

- **Docker** - Containerization
- **Docker Compose** - Orchestration
- **MinIO** - S3 Storage
- **GitHub Actions** - CI/CD

</td>
</tr>
</table>

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### One-Command Deploy

```bash
git clone <repo-url>
cd Zync-main-imp
docker compose up -d --build
```

Wait for all containers to start, then open **http://localhost:3000**.

### First-Time Setup

On a fresh database, you'll be redirected to the setup page automatically:

1. Fill in your **name**, **email**, and **password** (minimum 8 characters)
2. Click **Create Administrator Account**
3. You'll be logged in and taken to the dashboard

This only happens once. All future users must be invited by the admin.

### Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **App** | http://localhost:3000 | First user becomes Owner |
| **API** | http://localhost:4000/api/v1 | - |
| **MinIO Console** | http://localhost:9001 | `minioadmin` / `minioadmin` |

### Reset Everything

```bash
docker compose down -v
docker compose up -d --build
```

### Rebuild Without Cache

```bash
docker compose down -v
docker compose build --no-cache frontend backend
docker compose up -d
```

### Stop

```bash
docker compose down
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                            zynqCloud                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐              ┌──────────────────┐        │
│   │                  │   REST API   │                  │        │
│   │  Next.js Frontend│◄────────────►│  NestJS Backend  │        │
│   │   (Port 3000)    │              │   (Port 4000)    │        │
│   │                  │              │                  │        │
│   └──────────────────┘              └────────┬─────────┘        │
│                                              │                  │
│                        ┌─────────────────────┼──────────────┐   │
│                        │                     │              │   │
│                        ▼                     ▼              ▼   │
│              ┌──────────────┐      ┌──────────────┐  ┌────────┐│
│              │  PostgreSQL  │      │    MinIO     │  │  SMTP  ││
│              │  (Metadata)  │      │ (File Blobs) │  │ (Email)││
│              │  Port 5432   │      │  Port 9000   │  │        ││
│              └──────────────┘      └──────────────┘  └────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Zync-main-imp/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── mainworkflow.md
├── users.md
│
├── apps/
│   ├── client/                          # Next.js 15 Frontend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── components.json
│   │   ├── postcss.config.mjs
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx           # Root layout (ThemeProvider, AuthProvider)
│   │       │   ├── globals.css          # Tailwind v4 + OKLCH theme variables
│   │       │   ├── page.tsx
│   │       │   ├── not-found.tsx
│   │       │   ├── global-error.tsx
│   │       │   ├── (auth)/
│   │       │   │   ├── login/
│   │       │   │   │   └── page.tsx     # Login with setup-status check
│   │       │   │   └── register/
│   │       │   │       ├── page.tsx
│   │       │   │       └── RegisterForm.tsx
│   │       │   ├── setup/
│   │       │   │   └── page.tsx         # First-time admin setup
│   │       │   ├── dashboard/
│   │       │   │   ├── layout.tsx       # Dashboard shell (Sidebar + Header)
│   │       │   │   ├── page.tsx
│   │       │   │   ├── files/
│   │       │   │   │   └── page.tsx     # File management + duplicate detection
│   │       │   │   ├── shared/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── trash/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── profile/
│   │       │   │   │   └── page.tsx
│   │       │   │   ├── settings/
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── users/
│   │       │   │   │   │   └── page.tsx
│   │       │   │   │   └── invites/
│   │       │   │   │       └── page.tsx
│   │       │   │   └── share/
│   │       │   │       └── [token]/
│   │       │   │           └── page.tsx
│   │       │   └── share/
│   │       │       └── [token]/
│   │       │           └── page.tsx
│   │       ├── components/
│   │       │   ├── Header.tsx           # Top bar (theme toggle, user menu, logout)
│   │       │   ├── Sidebar.tsx          # Collapsible nav with role-based links
│   │       │   ├── ThemeProvider.tsx     # Dark/light theme with flash prevention
│   │       │   ├── ErrorReporter.tsx
│   │       │   ├── toast-container.tsx
│   │       │   └── ui/                  # shadcn/ui components (~47 files)
│   │       ├── context/
│   │       │   └── AuthContext.tsx       # Auth state, login/logout, token management
│   │       ├── features/
│   │       │   ├── file/
│   │       │   │   └── components/
│   │       │   │       ├── create-folder-dialog.tsx
│   │       │   │       ├── duplicate-warning-dialog.tsx
│   │       │   │       ├── file-breadcrumb.tsx
│   │       │   │       ├── file-card.tsx
│   │       │   │       └── file-grid.tsx
│   │       │   └── share/
│   │       │       └── components/
│   │       │           └── public-link-dialog.tsx
│   │       ├── hooks/
│   │       │   ├── use-mobile.ts
│   │       │   ├── use-theme.ts
│   │       │   └── use-toast.ts
│   │       ├── lib/
│   │       │   ├── api.ts               # API client (auth, files, shares, settings)
│   │       │   ├── auth.ts
│   │       │   ├── file-hash.ts         # SHA-256 content hashing (Web Crypto API)
│   │       │   └── utils.ts
│   │       └── ee/                      # Enterprise edition stubs
│   │           ├── audit/
│   │           ├── team/
│   │           └── workspace/
│   │
│   └── server/                          # NestJS Backend
│       ├── Dockerfile
│       ├── package.json
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── migrations/
│       │   ├── 001_initial_schema.sql   # PostgreSQL init (users, files, shares, etc.)
│       │   └── 002_fix_shares_table.sql
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── common/
│           │   ├── decorators/
│           │   │   ├── current-user.decorator.ts
│           │   │   └── roles.decorator.ts
│           │   ├── entities/
│           │   │   └── base.entity.ts
│           │   ├── filters/
│           │   │   └── http-exception.filter.ts
│           │   ├── guards/
│           │   │   ├── jwt-auth.guard.ts
│           │   │   └── roles.guard.ts
│           │   └── middleware/
│           │       └── logging.middleware.ts
│           ├── core/
│           │   ├── core.module.ts
│           │   ├── auth/
│           │   │   ├── auth.module.ts
│           │   │   ├── auth.controller.ts   # Login, register, setup-status, logout
│           │   │   ├── auth.service.ts      # JWT, bcrypt, first-user OWNER logic
│           │   │   ├── dto/
│           │   │   │   ├── login.dto.ts
│           │   │   │   └── register.dto.ts
│           │   │   └── strategies/
│           │   │       └── jwt.strategy.ts
│           │   ├── file/
│           │   │   ├── file.module.ts
│           │   │   ├── file.service.ts      # CRUD, duplicate detection, hash check
│           │   │   ├── controllers/
│           │   │   │   └── file.controller.ts
│           │   │   ├── dto/
│           │   │   │   └── create-file.dto.ts
│           │   │   └── entities/
│           │   │       └── file.entity.ts   # Includes file_hash column
│           │   ├── user/
│           │   │   ├── user.module.ts
│           │   │   ├── user.service.ts
│           │   │   ├── controllers/
│           │   │   │   └── admin.controller.ts
│           │   │   ├── dto/
│           │   │   │   └── update-user.dto.ts
│           │   │   └── entities/
│           │   │       └── user.entity.ts
│           │   ├── invitation/
│           │   │   ├── invitation.module.ts
│           │   │   ├── invitation.controller.ts
│           │   │   ├── invitation.service.ts
│           │   │   ├── dto/
│           │   │   │   ├── create-invite.dto.ts
│           │   │   │   └── accept-invite.dto.ts
│           │   │   └── entities/
│           │   │       └── invitation.entity.ts
│           │   ├── share/
│           │   │   ├── share.module.ts
│           │   │   ├── controllers/
│           │   │   │   └── public-share.controller.ts
│           │   │   ├── dto/
│           │   │   │   └── share-file.dto.ts
│           │   │   └── entities/
│           │   │       └── share.entity.ts
│           │   ├── setting/
│           │   │   ├── setting.module.ts
│           │   │   ├── setting.controller.ts
│           │   │   ├── setting.service.ts
│           │   │   ├── dto/
│           │   │   │   └── update-settings.dto.ts
│           │   │   └── entities/
│           │   │       └── setting.entity.ts
│           │   └── storage/
│           │       ├── storage.module.ts
│           │       └── storage.service.ts   # MinIO/S3 file operations
│           ├── health/
│           │   ├── health.module.ts
│           │   └── health.controller.ts
│           ├── integrations/
│           │   └── email/
│           │       ├── email.module.ts
│           │       └── email.service.ts
│           ├── migrations/
│           │   └── 1738358400000-AddFileHashColumn.ts
│           └── ee/                          # Enterprise edition stubs
│               ├── ee.module.ts
│               ├── audit/
│               ├── sso/
│               ├── team/
│               ├── webhook/
│               └── workspace/
│
├── packages/
│   ├── shared-types/                    # Shared TypeScript types
│   └── ui/                              # Shared UI component library
│
├── docs/
│   └── INSTALLATION.md
│
└── .github/
    ├── workflows/
    │   └── ci.yml
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   └── feature_request.md
    └── PULL_REQUEST_TEMPLATE.md
```

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/setup-status` | No | Returns `{ needsSetup: boolean }` |
| POST | `/auth/register` | No | Register user (first user becomes OWNER) |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/logout` | Yes | Clear session |
| GET | `/auth/me` | Yes | Get current user |

### Files

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/files` | Yes | List files (paginated, searchable) |
| POST | `/files` | Yes | Create file/folder (409 if duplicate hash) |
| GET | `/files/check-duplicate/:hash` | Yes | Check if content hash exists |
| GET | `/files/:id` | Yes | Get file metadata |
| GET | `/files/:id/download` | Yes | Get presigned download URL |
| DELETE | `/files/:id` | Yes | Soft delete (move to trash) |
| POST | `/files/:id/restore` | Yes | Restore from trash |
| DELETE | `/files/:id/permanent` | Yes | Permanent delete |

---

## User Roles & Permissions

| Role | Files | Users | Invites | Settings |
|:----:|:-----:|:-----:|:-------:|:--------:|
| **Owner** | Full Access | Manage All | Create/Revoke | All Settings |
| **Admin** | Full Access | View All | Create/Revoke | Limited |
| **User** | Own Files | - | - | Own Settings |

> **First Registration**: The first user to register automatically becomes the **Owner**

---

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone the repo
git clone <repo-url>

# Create a feature branch
git checkout -b feature/new-feat

# Make your changes and commit
git commit -m "feat: add new feature"

# Push and create a Pull Request
git push origin feature/new-feat
```

---

## Acknowledgments

Built with these amazing open-source projects:

<p align="center">
<a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
<a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" /></a>
<a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind" /></a>
<a href="https://ui.shadcn.com"><img src="https://img.shields.io/badge/shadcn/ui-black?style=flat-square" alt="shadcn/ui" /></a>
<a href="https://typeorm.io"><img src="https://img.shields.io/badge/TypeORM-FE0803?style=flat-square" alt="TypeORM" /></a>
<a href="https://min.io"><img src="https://img.shields.io/badge/MinIO-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO" /></a>
<a href="https://postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
<a href="https://docker.com"><img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
</p>

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**zynqCloud** - Your files, your cloud, your control.

Made with passion for privacy and self-hosting

</div>
