# Updating ZynqCloud

Updates are safe to run at any time. PostgreSQL data and the file volume are never touched.

---

## One-command update

From your install directory:

```bash
./scripts/update.sh
```

This pulls the latest image and restarts only the app container. PostgreSQL keeps running with no downtime.

---

## Manual update

```bash
docker compose pull zynqcloud
docker compose up -d --no-deps zynqcloud
```

---

## Pinning a specific version

Set `ZYNQ_VERSION` in `.env`:

```bash
ZYNQ_VERSION=v1.2.0
```

Then update to that version:

```bash
docker compose pull zynqcloud
docker compose up -d --no-deps zynqcloud
```

---

## Before updating

1. **Back up first** — always run `./scripts/backup.sh` before any update.
2. Check the [CHANGELOG](../CHANGELOG.md) for breaking changes.
3. If the update changes environment variables, compare `.env.example` with your `.env`.

---

## Downgrading

Set `ZYNQ_VERSION` to the older version in `.env`, then pull and restart:

```bash
docker compose pull zynqcloud
docker compose up -d --no-deps zynqcloud
```

> **Note:** Downgrading across a database migration may fail if the older version does not understand newer schema columns. Restore from a backup taken before the upgrade instead.

---

## Verifying the update

```bash
docker compose ps
```

The running image tag is shown in the sidebar footer of the web UI (`v{version}`).
