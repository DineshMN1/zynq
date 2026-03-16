# zynqCloud Backend

NestJS REST API for file management.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm run start:dev
```

API runs at http://localhost:4000/api/v1

## Scripts

```bash
pnpm run start:dev    # Development
pnpm run build        # Build
pnpm run start:prod   # Production
pnpm run lint         # Lint
pnpm run test         # Tests
```

## Environment

See `.env.example` for backend-only development. For self-host production deployment, use root `.env.example`.

| Variable                     | Description                          |
| ---------------------------- | ------------------------------------ |
| `DATABASE_*`                 | PostgreSQL connection                |
| `JWT_SECRET`                 | Auth secret (32+ chars)              |
| `FILE_STORAGE_PATH`          | Local file storage path              |
| `FILE_ENCRYPTION_MASTER_KEY` | Base64 32-byte encryption master key |
| `SMTP_*`                     | Email settings                       |

## API Endpoints

### Auth

- `POST /auth/register` - Register (first user = owner)
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Current user
- `POST /auth/forgot-password` - Request reset
- `POST /auth/reset-password` - Reset password

### Files

- `GET /files` - List files
- `POST /files` - Create file/folder
- `GET /files/:id/download` - Download
- `DELETE /files/:id` - Soft delete
- `POST /files/:id/restore` - Restore

### Admin

- `GET /admin/users` - List users
- `POST /invites` - Create invite
- `GET /settings/smtp` - SMTP config
- `PUT /settings/smtp` - Update SMTP

## User Roles

| Role  | Access                |
| ----- | --------------------- |
| Owner | Full system access    |
| Admin | Manage users, invites |
| User  | Own files only        |
