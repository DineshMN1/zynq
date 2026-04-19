# Troubleshooting

---

## Container won't start

**Check logs:**

```bash
docker compose logs zynqcloud
docker compose logs postgres
```

### "FILE_ENCRYPTION_MASTER_KEY has changed since first boot"

The master key in `.env` does not match the fingerprint stored in the database from first boot. Restore the original key — see [key-recovery.md](key-recovery.md).

### "JWT_SECRET is not set"

Set `JWT_SECRET` in `.env` to a random string of 32+ characters:

```bash
openssl rand -base64 48
```

### "schema check failed"

The database is empty or migrations haven't run. Ensure PostgreSQL is healthy before the app starts — the `depends_on: condition: service_healthy` in `docker-compose.yml` handles this automatically.

### "failed to initialize crypto"

`FILE_ENCRYPTION_MASTER_KEY` is set but invalid. It must be a base64-encoded string that decodes to exactly 32 bytes:

```bash
openssl rand -base64 32   # generates a valid key
```

---

## Can't log in / cookies not working

### "Unauthorized" on every request after login

The JWT cookie domain doesn't match the browser's address bar. Check:

```bash
COOKIE_DOMAIN=cloud.example.com   # must match your actual hostname, no scheme or port
```

For local access by IP, set `COOKIE_DOMAIN=` (empty).

### Cookie not set over HTTP

```bash
COOKIE_SECURE=false   # required when not using HTTPS
```

---

## Uploads fail

### "Storage limit exceeded" (403)

The user has hit their storage quota. An Owner or Admin can increase it in Settings → Users.

### "Insufficient disk space" (507)

The disk hosting `ZYNQ_DATA_PATH` is almost full. Free up space or expand the volume. The threshold is controlled by `MIN_FREE_BYTES` (default 512 MB).

### "File type not allowed" (400)

The file extension is blocked (exe, bat, ps1, sh, dll, apk, etc.). This is intentional and cannot be changed per-upload.

### Upload times out on large files

Increase `proxy_read_timeout` and `proxy_send_timeout` in your reverse proxy config to at least 3600 seconds. See [reverse-proxy.md](reverse-proxy.md).

---

## Health check fails

```bash
curl http://localhost:3000/api/v1/health
```

- `{"status":"ok"}` — app and database are up
- `{"message":"database unavailable"}` — app is running but cannot reach PostgreSQL

Check the postgres container:

```bash
docker compose ps postgres
docker compose logs postgres
```

---

## Share links don't work

Public share links contain your `FRONTEND_URL`. If the URL is set to `localhost` but you're accessing from another machine, links will be broken.

```bash
FRONTEND_URL=https://cloud.example.com
CORS_ORIGIN=https://cloud.example.com
```

---

## Disk stats show 0 or wrong values

On Docker Desktop (macOS/Windows), `statfs` may report inflated or zero values because the container filesystem is virtualised. Set `DISK_STATS_PATH` to a bind-mounted host path:

```bash
DISK_STATS_PATH=/data/files   # points at the bind mount inside the container
ZYNQ_DATA_PATH=/your/host/path
```

---

## Forgotten admin password

Connect to the database and reset the password hash:

```bash
docker compose exec postgres psql -U zynqcloud -d zynqcloud
```

```sql
UPDATE users
SET password_hash = '$2a$12$...'   -- bcrypt hash of new password
WHERE email = 'admin@example.com';
```

Generate a bcrypt hash using any online tool or:

```bash
htpasswd -bnBC 12 "" newpassword | tr -d ':\n'
```

---

## Getting more help

Open an issue on GitHub with:

- Output of `docker compose logs zynqcloud` (last 50 lines)
- Your `.env` with secrets redacted
- Steps to reproduce
