# Changelog

All notable changes to zynqCloud will be documented here.

## [Unreleased]

### Added

- SMTP email configuration UI
- Forgot password / reset password flow
- Duplicate file detection (SHA-256)
- Storage quota management
- Public file sharing with links
- One-shot migration service in docker-compose for production-safe startup
- Interactive `install.sh` wizard for env setup
- Backup and restore runbook + helper scripts (`scripts/backup.sh`, `scripts/restore.sh`)

### Fixed

- Test suite for auth and invitation services
- Portable self-host compose flow without local SQL bind mounts

## [0.1.0] - 2024-01-20

### Added

- Initial release
- User authentication (register, login, logout)
- File upload/download with local self-hosted storage
- Folder creation
- User-to-user file sharing
- Trash and restore functionality
- Role-based access (Owner, Admin, User)
- Invite-only registration
- Dark/light theme
- Docker Compose deployment
