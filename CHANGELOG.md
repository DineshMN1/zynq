# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to ZynqCloud are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- Key fingerprint verification on startup — server refuses to start if `FILE_ENCRYPTION_MASTER_KEY` changed since first boot, preventing silent data loss
- `scripts/update.sh` — pulls latest image and restarts only the app container, leaving PostgreSQL untouched
- Automated PostgreSQL backup sidecar (`--profile backup`) using `postgres-backup-local`
- Backend test suite: crypto AES-256-GCM round-trip, stream encrypt/decrypt, JWT middleware, storage I/O and path traversal rejection
- Shared `MAX_FILE_BYTES` constant in `web/src/lib/constants.ts` (was duplicated across dashboard and team pages)
- New docs: `docs/reverse-proxy.md`, `docs/updating.md`, `docs/key-recovery.md`, `docs/troubleshooting.md`

### Fixed

- `GET /api/v1/health` now checks database connectivity and returns `503` when the DB is unreachable
- Upload handler returns `507 Insufficient Storage` when free disk would drop below `MIN_FREE_BYTES`
- Audit log writes are now synchronous — no events lost on DB hiccups mid-request
- File listing replaced 3×N `COUNT` queries for share counts with a single `GROUP BY` aggregation
- PostgreSQL container no longer exposes port 5432 to the host network
- Team page file uploads now use `uploadManager` (consistent with dashboard; removed duplicate XHR logic)
- Image thumbnails now display on the dashboard files page

### Removed

- Stale `server/.pnpm-store/`, `server/.turbo/`, `web/.turbo/` artifact directories
- Root-level `update.sh` duplicate (canonical script is `scripts/update.sh`)

---

## [1.0.7] - 2026-03-19

### Added

- Team Spaces with Viewer / Contributor / Admin space-level roles
- Drag-and-drop file moving between folders within a space
- Space activity log
- Admin panel with user management, quota control, and monitoring dashboard
- File type icons across the file grid
- File preview system: PDF (react-pdf), code (shiki syntax highlight), images (react-photo-view), Markdown (react-markdown + remark-gfm), video player controls
- Profile avatar upload with canvas resizing
- Folder size aggregation shown in file grid

### Fixed

- Team files page CI failures (gofmt, unused variables)
- Drag-to-move animated drop zone overlay
- Preview download URL

---

## [1.0.6] - 2026-02-27

### Added

- Notification channels: email, Microsoft Teams, Resend webhooks
- Audit log table and admin UI
- SMTP settings configurable from the admin panel (persisted to database, reloaded on startup)
- Cloudflare Tunnel optional sidecar (`--profile cloudflare`)
- Folder sizes, ZIP batch download, cross-platform dev scripts
- Upload pause / resume
- Auto-hide upload panel after 3 s when no active uploads
- Toast notification redesign: top-right, icons, slide-in animation, dismiss button

### Fixed

- Cookie auth failure over HTTP (Tailscale / local LAN) — token-based Bearer auth fallback
- Admin / owner `storage_limit` incorrectly showing 10 GB instead of unlimited
- Upload panel overlapping modal dialogs (z-index)
- Folder upload input missing `webkitdirectory` attribute
- Duplicate hash mismatch for text files
- Complete audit log coverage for all tracked actions
- Security hardening across backend handlers
- gofmt formatting in `main.go`, `audit.go`, `notification_channels.go`

### Security

- Bumped Go to 1.25.9 to patch `crypto/x509` CVEs (GO-2026-4947, GO-2026-4946, GO-2026-4870)
- `RWMutex` on config struct for concurrent SMTP settings reload

---

## [1.0.5] - 2026-02-24

### Added

- Go file storage service with Content-Addressable Storage (CAS) and SHA-256 deduplication
- Large-file and folder upload support (streaming encryption, 64 MiB chunks)
- Assembly worker pool for concurrent chunk handling (`MAX_ASSEMBLY_WORKERS`)
- Cross-platform disk stats (`statfs` on Linux/macOS/FreeBSD, stub on Windows)
- Owner-only in-app update flow

### Fixed

- Download OOM on large files — replaced buffered read with streaming decrypt
- Upload 500 error caused by bind-mount permission issues
- Dedup safety: blob deletion wrapped in `FOR UPDATE` transactions
- Frontend extension list aligned with backend dedup allowlist

### Security

- `govulncheck` added to CI; blocks on detected vulnerabilities
- Bumped Go to 1.25.8 to resolve 15 stdlib CVEs

---

## [1.0.4] - 2026-02-22

### Added

- Public share password protection and expiry
- Password attempt rate limiting on public share endpoints
- Composite database indexes on share queries (`created_by`, `is_public`)
- File preview dialog for public share links

### Fixed

- CSRF hardening and sanitized public share payloads
- SMTP implicit TLS (port 465) support and proper MIME headers
- Invite token generation from request host (fixes links sent from behind a proxy)
- Public share password and preview button styling on mobile

### Security

- Switched to cookie-only JWT auth — token no longer exposed in response body
- Configured CORS, trust-proxy, and global throttling enforced

---

## [1.0.3] - 2026-02-20

### Added

- SMTP email configuration UI in notification settings
- Enhanced SMTP service: configurable host, port, TLS, from address

---

## [1.0.2] - 2026-02-19

### Added

- File preview dialog in dashboard
- Folder size display in file grid and list views
- Installer alignment for quickstart and non-interactive modes

### Fixed

- Auth flow improvements: mobile scrollable layout, 401 redirect handling

---

## [1.0.1] - 2026-02-19

### Fixed

- `install.sh` URL corrections for self-hosted setup flow

---

## [1.0.0] - 2026-02-19

### Added

- Single Docker image — Go binary serves both the REST API and the React SPA (no separate nginx)
- User authentication: register, login, logout, forgot / reset password
- AES-256-GCM file encryption at rest with KEK / DEK hierarchy
- SHA-256 deduplication: identical files share one copy on disk
- Folder creation and tree navigation
- Drag-and-drop file upload with progress tracking
- User-to-user private file sharing and public share links
- Trash and restore
- Role-based access control: Owner, Admin, User
- Per-user storage quotas
- Invite-only registration with email invitations
- Light / Dark theme
- Docker Compose deployment
- Interactive `install.sh` installer
- `scripts/backup.sh` and `scripts/restore.sh`
