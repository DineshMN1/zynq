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

## FAQ

<details>
<summary><strong>1. What is zynqCloud and who is it for?</strong></summary>

zynqCloud is an open‑source, self‑hosted file cloud built for developers, small teams, and privacy‑conscious individuals who want full control over their data. Instead of trusting a third party with your files, you run zynqCloud on your own server — a VPS, home lab, or even a Raspberry Pi — and keep everything under your roof.

It gives you a modern web UI for uploading, organizing, and sharing files with features like user roles, invitations, storage quotas, and encrypted storage, all without monthly fees or vendor lock‑in.

</details>

<details>
<summary><strong>2. How does zynqCloud compare to Google Drive or OneDrive?</strong></summary>

|                          | Google Drive / OneDrive            | zynqCloud                           |
| ------------------------ | ---------------------------------- | ----------------------------------- |
| **Who holds your data?** | Google / Microsoft                 | You                                 |
| **Encryption keys**      | Controlled by the provider         | You control the master key          |
| **Monthly cost**         | $2–$10/month per user              | Free (you pay only for your server) |
| **Storage limit**        | 15 GB free, then paid tiers        | Limited only by your disk           |
| **Privacy**              | Data scanned for ads / AI training | Zero third‑party access             |
| **Customization**        | None                               | Full source code access             |

zynqCloud is ideal when you need privacy, unlimited storage on your own hardware, and zero recurring costs.

</details>

<details>
<summary><strong>3. How does zynqCloud compare to Nextcloud, Seafile, or Cloudreve?</strong></summary>

- **Simpler stack** — zynqCloud runs as two Node.js containers + PostgreSQL. No PHP, Redis, Apache, Cron, or Aria2 required. `docker compose up` and you're done.
- **Encryption by default** — Every file is encrypted at rest with AES‑256‑GCM using per‑file keys. Nextcloud and Cloudreve treat encryption as an optional plugin.
- **Built‑in deduplication** — SHA‑256 hashing detects identical files before upload. Duplicates share a single copy on disk.
- **Modern UI** — Built with Next.js 15 and Tailwind CSS. Responsive, fast, and supports light/dark themes out of the box.
- **Lower resource usage** — Node.js event‑loop handles concurrency without spawning processes. Typical idle memory: 80–150 MB for the backend.

</details>

<details>
<summary><strong>4. Is my data encrypted?</strong></summary>

Yes, every file is encrypted at rest using **AES‑256‑GCM** with an envelope encryption model:

1. Each file gets its own random 256‑bit **Data Encryption Key (DEK)**
2. The DEK encrypts the file content with AES‑256‑GCM (authenticated encryption — detects tampering)
3. The DEK itself is encrypted with a master **Key Encryption Key (KEK)** and stored alongside the file metadata
4. Compromising one file's DEK does not expose any other file

Your files are never stored in plaintext on disk.

</details>

<details>
<summary><strong>5. How secure is zynqCloud?</strong></summary>

Security is built into every layer:

- **Password hashing** — bcrypt with cost factor 12, resistant to brute‑force and rainbow‑table attacks
- **JWT cookies** — httpOnly, Secure, SameSite=strict — tokens are not accessible to JavaScript, preventing XSS theft
- **Rate limiting** — Login: 5 req/min, forgot‑password: 3 req/min to throttle brute‑force attempts
- **File upload validation** — Dangerous extensions (.exe, .bat, .ps1, etc.) are blocked; MIME types are validated against a whitelist of 60+ safe types
- **Input validation** — All request bodies are validated with `class-validator`; unknown fields are stripped automatically
- **Email enumeration prevention** — The forgot‑password endpoint always returns the same response, preventing attackers from discovering valid email addresses
- **Non‑root Docker containers** — Both backend and frontend run as unprivileged users inside their containers

</details>

<details>
<summary><strong>6. What are the minimum hardware requirements?</strong></summary>

zynqCloud is designed to run on minimal hardware:

|          | Minimum                        | Recommended     |
| -------- | ------------------------------ | --------------- |
| **CPU**  | 1 vCPU                         | 2 vCPU          |
| **RAM**  | 1 GB                           | 2 GB            |
| **Disk** | 10 GB+ (depends on your files) | SSD recommended |
| **OS**   | Any Linux with Docker          | Ubuntu 22.04+   |

A single `docker compose up -d --build` deploys PostgreSQL, the backend, and the frontend. Works on any cloud provider (AWS, DigitalOcean, Hetzner, Oracle Cloud free tier) or a home server.

</details>

<details>
<summary><strong>7. Can I migrate from another cloud storage?</strong></summary>

Yes. zynqCloud stores files in a standard directory structure on your server. To migrate:

1. Deploy zynqCloud and create your account
2. Upload your files through the web UI (supports drag‑and‑drop, folder uploads, and parallel uploads of up to 3 files)
3. Your files are encrypted and stored immediately

For bulk migration, you can upload folders directly — the folder structure is preserved in zynqCloud. There is no proprietary format; if you ever leave zynqCloud, your files remain on your server in their original form (encrypted, but decryptable with your master key).

</details>

<details>
<summary><strong>8. How does file deduplication work?</strong></summary>

Before uploading, zynqCloud computes a **SHA‑256 hash** of each file:

- **Client‑side hashing** — The hash is calculated in a background **Web Worker** so the browser UI never freezes, even for large files
- **Server‑side check** — If a file with the same hash already exists in your account, the upload is skipped and the existing file is referenced instead
- **Scope** — Deduplication applies to documents and images (PDF, DOCX, PNG, JPG, etc.)
- **Result** — Identical files are stored only once on disk, saving storage space automatically

This means uploading the same 50 MB PDF twice uses only 50 MB of disk space, not 100 MB.

</details>

<details>
<summary><strong>9. Does zynqCloud support team collaboration?</strong></summary>

Yes. zynqCloud includes built‑in multi‑user features:

- **Roles** — Three levels: Owner (full control), Admin (manage users), and User (standard access)
- **Invite‑only registration** — The owner can send email invitations with pre‑assigned roles. Public registration can be disabled
- **Per‑user storage quotas** — Admins can set storage limits for each user (e.g., 10 GB per user)
- **File sharing** — Share files privately with specific users (read or write permission) or generate public links
- **SMTP integration** — Send invitations and password reset emails through your own mail server

</details>

<details>
<summary><strong>10. How do I update zynqCloud?</strong></summary>

Updating is a single command:

```bash
docker compose pull
docker compose up -d
```

This pulls the latest images and restarts the containers. Your data is stored in Docker volumes and the PostgreSQL database, so nothing is lost during updates.

For version‑pinned deployments, use a specific tag:

```yaml
image: yourusername/zynqcloud-backend:v1.2.0
```

Database migrations run automatically on startup — no manual steps required.

</details>

---

## License

MIT © zynqCloud

<div align="center">

**Your files. Your cloud. Your control.**

</div>
