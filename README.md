<div align="center">

# zynqCloud

**An open-source & self‑hostable file cloud for teams and individuals.**

Self‑hosted file storage with roles, invites, sharing, and quotas — your files, your server, your control.

[Quick Start](#quick-start) • [About](#about) • [Features](#features) • [Installation](#installation) • [Support](#support) • [Contributing](#contributing)

<a href="https://immich.dineshmn.me/s/zynq-demo">
  <img src="https://img.shields.io/badge/%E2%96%B6%EF%B8%8F_Watch_Demo-blue?style=for-the-badge&logoColor=white" alt="Watch Demo" />
</a>

</div>

---

## About

zynqCloud helps you run a private file cloud on your own infrastructure. You get a clean UI, strong access control, and familiar workflows without vendor lock‑in.

- Manage users, roles, and storage quotas
- Share files privately or publicly
- Keep ownership of your data and configuration

If you stop using zynqCloud, your files and database remain fully on your servers.

---

## Quick Start

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq
docker compose up -d --build
```

Open `http://localhost:3000` → Create your admin account → Done.

---

## Features

- Upload, download, and organize files
- Private and public sharing links
- Invite-only registration
- Roles: Owner, Admin, User
- Per‑user storage quotas
- Trash with restore
- SMTP for invites and password reset
- Light/Dark themes

---

## Installation

**Docker (recommended)**

```bash
docker compose up -d --build
```

**Development**

```bash
pnpm install
pnpm turbo run dev
```

---

## Configuration

Copy `apps/server/.env.example` to `apps/server/.env` and configure:

| Variable     | Description             |
| ------------ | ----------------------- |
| `JWT_SECRET` | Auth secret (32+ chars) |
| `DATABASE_*` | PostgreSQL connection   |
| `SMTP_*`     | Email settings          |

---

## Support

If you need help, open an issue or start a discussion in the repository.

---

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` and keep changes focused.

---

## License

MIT © zynqCloud

<div align="center">

**Your files. Your cloud. Your control.**

</div>
