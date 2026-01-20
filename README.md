<div align="center">

# zynqCloud

### Self-Hosted File Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://docker.com/)

**Take control of your files. Host your own cloud.**

[Quick Start](#quick-start) · [Installation](docs/INSTALLATION.md) · [API Docs](backend/README.md) · [Contributing](CONTRIBUTING.md)

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
<img src="https://api.iconify.design/mdi:palette.svg?color=%237c3aed" width="48" height="48" alt="Theme" />
<br /><br />
<b>Dark/Light Theme</b>
<br />
<sub>Beautiful purple-accented UI</sub>
</td>
</tr>
</table>

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
- **Tailwind CSS** - Styling
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
- **Nginx** - Reverse Proxy
- **GitHub Actions** - CI/CD

</td>
</tr>
</table>

## Quick Start

### One-Command Deploy

```bash
git clone https://github.com/DineshMN1/zynq.git && cd zynq && docker-compose up -d
```

That's it! Access your cloud at:

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| **Frontend** | http://localhost:3001 | Register first user (becomes Owner) |
| **Backend API** | http://localhost:4000 | - |
| **MinIO Console** | http://localhost:9001 | `minioadmin` / `minioadmin` |

### Manual Setup

<details>
<summary><b>Click to expand manual installation steps</b></summary>

#### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- MinIO or S3-compatible storage

#### Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

#### Frontend Setup
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

See [Installation Guide](docs/INSTALLATION.md) for detailed instructions.

</details>

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              zynqCloud                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────────┐              ┌──────────────────┐               │
│    │                  │   REST API   │                  │               │
│    │  Next.js Frontend│◄────────────►│  NestJS Backend  │               │
│    │   (Port 3001)    │              │   (Port 4000)    │               │
│    │                  │              │                  │               │
│    └──────────────────┘              └────────┬─────────┘               │
│                                               │                          │
│                         ┌─────────────────────┼─────────────────────┐   │
│                         │                     │                     │   │
│                         ▼                     ▼                     ▼   │
│               ┌──────────────┐      ┌──────────────┐      ┌───────────┐│
│               │  PostgreSQL  │      │    MinIO     │      │   SMTP    ││
│               │  (Metadata)  │      │ (File Blobs) │      │  (Email)  ││
│               │  Port 5432   │      │  Port 9000   │      │           ││
│               └──────────────┘      └──────────────┘      └───────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
zynq/
├── frontend/                 # Next.js 15 Application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components (40+ UI components)
│   │   ├── context/         # Auth context provider
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # API client & utilities
│   └── Dockerfile
│
├── backend/                  # NestJS API Server
│   ├── src/
│   │   ├── auth/            # JWT authentication
│   │   ├── files/           # File CRUD & sharing
│   │   ├── users/           # User management
│   │   ├── invites/         # Invitation system
│   │   ├── admin/           # Admin operations
│   │   ├── storage/         # S3 integration
│   │   └── email/           # SMTP service
│   ├── migrations/          # Database schema
│   └── Dockerfile
│
├── docs/                     # Documentation
├── .github/                  # CI/CD workflows
├── docker-compose.yml        # Container orchestration
└── README.md
```

## Configuration

### Environment Variables

<details>
<summary><b>Frontend Environment</b></summary>

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

</details>

<details>
<summary><b>Backend Environment</b></summary>

```env
# backend/.env

# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=secure_password_here
DATABASE_NAME=zynqcloud

# Authentication (IMPORTANT: Use strong secret)
JWT_SECRET=your-super-secret-key-at-least-32-characters

# S3 Storage
S3_ENDPOINT=http://minio:9000
S3_BUCKET=zynq-cloud
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# CORS
CORS_ORIGIN=http://localhost:3001

# Email (Optional)
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

</details>

## User Roles & Permissions

| Role | Files | Users | Invites | Settings |
|:----:|:-----:|:-----:|:-------:|:--------:|
| **Owner** | Full Access | Manage All | Create/Revoke | All Settings |
| **Admin** | Full Access | View All | Create/Revoke | Limited |
| **User** | Own Files | - | - | Own Settings |

> **First Registration**: The first user to register automatically becomes the **Owner**

## API Overview

Full API documentation available in [backend/README.md](backend/README.md)

```
Authentication
  POST   /api/v1/auth/register     Create account
  POST   /api/v1/auth/login        Login
  POST   /api/v1/auth/logout       Logout
  GET    /api/v1/auth/me           Current user

Files
  GET    /api/v1/files             List files
  POST   /api/v1/files             Create/Upload file
  GET    /api/v1/files/:id         Get file details
  DELETE /api/v1/files/:id         Soft delete
  POST   /api/v1/files/:id/share   Share file

Admin (Requires Admin/Owner role)
  GET    /api/v1/admin/users       List all users
  PUT    /api/v1/admin/users/:id   Update user
  DELETE /api/v1/admin/users/:id   Delete user
  POST   /api/v1/invites           Create invitation
```

## Security

<table>
<tr>
<td width="50%">

### Implemented
- JWT with HttpOnly cookies
- Bcrypt password hashing (cost: 12)
- Role-based access control
- Input validation (class-validator)
- SQL injection protection (TypeORM)
- Rate limiting
- CORS protection

</td>
<td width="50%">

### Production Checklist
- [ ] Use HTTPS everywhere
- [ ] Set strong JWT_SECRET (32+ chars)
- [ ] Change default passwords
- [ ] Configure firewall rules
- [ ] Enable security headers
- [ ] Set up monitoring
- [ ] Regular backups

</td>
</tr>
</table>

> **Security Issues**: Please report security vulnerabilities to **mndinesh674@gmail.com** instead of opening a public issue.

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/zynq.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "feat: add amazing feature"

# Push and create a Pull Request
git push origin feature/amazing-feature
```

## Roadmap

- [ ] Mobile app (React Native)
- [ ] File versioning
- [ ] End-to-end encryption
- [ ] WebDAV support
- [ ] Thumbnail previews
- [ ] Full-text search
- [ ] Two-factor authentication
- [ ] Audit logs

## Support

<table>
<tr>
<td align="center">
<a href="https://github.com/DineshMN1/zynq/issues">
<img src="https://api.iconify.design/mdi:bug.svg?color=%237c3aed" width="32" height="32" /><br />
<b>Report Bug</b>
</a>
</td>
<td align="center">
<a href="https://github.com/DineshMN1/zynq/issues">
<img src="https://api.iconify.design/mdi:lightbulb.svg?color=%237c3aed" width="32" height="32" /><br />
<b>Request Feature</b>
</a>
</td>
<td align="center">
<a href="https://github.com/DineshMN1/zynq/discussions">
<img src="https://api.iconify.design/mdi:forum.svg?color=%237c3aed" width="32" height="32" /><br />
<b>Discussions</b>
</a>
</td>
<td align="center">
<a href="docs/INSTALLATION.md">
<img src="https://api.iconify.design/mdi:book-open-variant.svg?color=%237c3aed" width="32" height="32" /><br />
<b>Documentation</b>
</a>
</td>
</tr>
</table>

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

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[zynqCloud](https://github.com/DineshMN1/zynq)** - Your files, your cloud, your control.

Made with passion for privacy and self-hosting

<br />

<a href="https://github.com/DineshMN1/zynq/stargazers">
<img src="https://img.shields.io/github/stars/DineshMN1/zynq?style=social" alt="Stars" />
</a>
<a href="https://github.com/DineshMN1/zynq/network/members">
<img src="https://img.shields.io/github/forks/DineshMN1/zynq?style=social" alt="Forks" />
</a>

</div>
