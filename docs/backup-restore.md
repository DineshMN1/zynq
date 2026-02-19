# Backup And Restore

This runbook covers:

- PostgreSQL backups
- File blob backups (`ZYNQ_DATA_PATH`)
- Encryption key backup (`FILE_ENCRYPTION_MASTER_KEY`)
- Full restore after disk loss

If you lose disk data and do not have backups of **all three** (DB + files + key), recovery is incomplete.

## 1) What To Back Up

1. Database dump (logical SQL backup)
2. File data path from `.env` (`ZYNQ_DATA_PATH`)
3. Encryption key from `.env` (`FILE_ENCRYPTION_MASTER_KEY`)

## 2) Create Backups

Run from your zynqCloud directory (where `.env` and `docker-compose.yml` exist):

```bash
mkdir -p backups
set -a
. ./.env
set +a
```

Recommended:

```bash
scripts/backup.sh
```

Optional custom backup directory:

```bash
scripts/backup.sh --output-dir /path/to/backups
```

### 2.1 Backup PostgreSQL

```bash
TS=$(date +%Y%m%d-%H%M%S)
docker compose --env-file .env exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "backups/db-$TS.sql"
```

### 2.2 Backup Files

```bash
TS=$(date +%Y%m%d-%H%M%S)
tar -czf "backups/files-$TS.tar.gz" -C "$(dirname "$ZYNQ_DATA_PATH")" "$(basename "$ZYNQ_DATA_PATH")"
```

### 2.3 Backup Encryption Key (Critical)

```bash
grep '^FILE_ENCRYPTION_MASTER_KEY=' .env > "backups/key-$TS.env"
chmod 600 "backups/key-$TS.env"
```

Store key backup in a separate secure location (password manager / secrets manager / offline vault).

## 3) Restore After Disk Loss

### 3.1 Prepare New Host

1. Deploy same zynqCloud version (or compatible newer version).
2. Copy your old `.env` (or recreate with same `FILE_ENCRYPTION_MASTER_KEY` and DB values).
3. Ensure `ZYNQ_DATA_PATH` points to restore location.

### 3.2 Restore File Data

Recommended scripted restore:

```bash
scripts/restore.sh --db backups/db-YYYYMMDD-HHMMSS.sql --files backups/files-YYYYMMDD-HHMMSS.tar.gz
```

If you also exported a key file and want key consistency warning checks:

```bash
scripts/restore.sh --db backups/db-YYYYMMDD-HHMMSS.sql --files backups/files-YYYYMMDD-HHMMSS.tar.gz --key backups/key-YYYYMMDD-HHMMSS.env
```

Manual restore steps:

```bash
mkdir -p "$(dirname "$ZYNQ_DATA_PATH")"
tar -xzf backups/files-YYYYMMDD-HHMMSS.tar.gz -C "$(dirname "$ZYNQ_DATA_PATH")"
```

### 3.3 Start PostgreSQL Only

```bash
docker compose --env-file .env up -d postgres
```

### 3.4 Restore Database

```bash
cat backups/db-YYYYMMDD-HHMMSS.sql | docker compose --env-file .env exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### 3.5 Start Full Stack

```bash
docker compose --env-file .env up -d
```

Migration service runs before app startup in current compose.

## 4) Recommended Schedule

1. Daily DB backup
2. Daily file backup
3. Weekly offsite sync of backups
4. Monthly restore drill on a test machine

## 5) Recovery Limits

- Missing DB backup: file blobs exist but metadata/shares/users are lost.
- Missing files backup: DB exists but actual file content is lost.
- Missing encryption key: encrypted files cannot be decrypted.
