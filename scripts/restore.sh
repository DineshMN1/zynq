#!/usr/bin/env bash
set -euo pipefail

# Restore zynqCloud from backup artifacts.
# Usage:
#   scripts/restore.sh --db backups/db-*.sql --files backups/files-*.tar.gz
# Optional:
#   --key backups/key-*.env --yes

DB_BACKUP=""
FILES_BACKUP=""
KEY_BACKUP=""
ASSUME_YES="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --db)
      DB_BACKUP="$2"
      shift 2
      ;;
    --files)
      FILES_BACKUP="$2"
      shift 2
      ;;
    --key)
      KEY_BACKUP="$2"
      shift 2
      ;;
    --yes)
      ASSUME_YES="true"
      shift
      ;;
    -h|--help)
      echo "Usage: scripts/restore.sh --db FILE --files FILE [--key FILE] [--yes]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -f .env ]; then
  echo "Missing .env in current directory" >&2
  exit 1
fi

if [ -z "$DB_BACKUP" ] || [ -z "$FILES_BACKUP" ]; then
  echo "--db and --files are required" >&2
  exit 1
fi

if [ ! -f "$DB_BACKUP" ]; then
  echo "DB backup not found: $DB_BACKUP" >&2
  exit 1
fi

if [ ! -f "$FILES_BACKUP" ]; then
  echo "Files backup not found: $FILES_BACKUP" >&2
  exit 1
fi

if [ -n "$KEY_BACKUP" ] && [ ! -f "$KEY_BACKUP" ]; then
  echo "Key backup not found: $KEY_BACKUP" >&2
  exit 1
fi

set -a
. ./.env
set +a

: "${DATABASE_USER:?DATABASE_USER is required in .env}"
: "${DATABASE_NAME:?DATABASE_NAME is required in .env}"
: "${ZYNQ_DATA_PATH:?ZYNQ_DATA_PATH is required in .env}"

if [ -n "$KEY_BACKUP" ]; then
  if ! grep -q '^FILE_ENCRYPTION_MASTER_KEY=' "$KEY_BACKUP"; then
    echo "Invalid key backup file: $KEY_BACKUP" >&2
    exit 1
  fi
  NEW_KEY="$(grep '^FILE_ENCRYPTION_MASTER_KEY=' "$KEY_BACKUP" | sed 's/^FILE_ENCRYPTION_MASTER_KEY=//')"
  CUR_KEY="${FILE_ENCRYPTION_MASTER_KEY:-}"
  if [ -n "$CUR_KEY" ] && [ "$NEW_KEY" != "$CUR_KEY" ]; then
    echo "Warning: key file differs from current .env key."
    echo "Restoring encrypted files will fail unless .env uses the original key."
    if [ "$ASSUME_YES" != "true" ]; then
      printf "Continue anyway? [y/N]: "
      read -r ans
      case "$ans" in
        y|Y) ;;
        *)
          echo "Aborted."
          exit 1
          ;;
      esac
    fi
  fi
fi

if [ "$ASSUME_YES" != "true" ]; then
  echo "This will overwrite database content and file data at $ZYNQ_DATA_PATH"
  printf "Continue restore? [y/N]: "
  read -r ans
  case "$ans" in
    y|Y) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

echo "Starting postgres..."
docker compose --env-file .env up -d postgres

echo "Waiting for postgres readiness..."
attempt=0
max_attempts=30
until docker compose --env-file .env exec -T postgres pg_isready -U "$DATABASE_USER" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

mkdir -p "$(dirname "$ZYNQ_DATA_PATH")"
echo "Restoring file archive..."
tar -xzf "$FILES_BACKUP" -C "$(dirname "$ZYNQ_DATA_PATH")"

echo "Restoring database..."
cat "$DB_BACKUP" | docker compose --env-file .env exec -T postgres \
  psql -U "$DATABASE_USER" -d "$DATABASE_NAME"

echo "Starting full stack..."
docker compose --env-file .env up -d

echo "Restore complete."
