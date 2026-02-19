#!/usr/bin/env bash
set -euo pipefail

# Create zynqCloud backups: DB dump, file archive, key file.
# Usage:
#   scripts/backup.sh
#   scripts/backup.sh --output-dir /path/to/backups

OUTPUT_DIR="backups"

while [ $# -gt 0 ]; do
  case "$1" in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: scripts/backup.sh [--output-dir DIR]"
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

set -a
. ./.env
set +a

: "${DATABASE_USER:?DATABASE_USER is required in .env}"
: "${DATABASE_NAME:?DATABASE_NAME is required in .env}"
: "${ZYNQ_DATA_PATH:?ZYNQ_DATA_PATH is required in .env}"

mkdir -p "$OUTPUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"

DB_FILE="$OUTPUT_DIR/db-$TS.sql"
FILES_FILE="$OUTPUT_DIR/files-$TS.tar.gz"
KEY_FILE="$OUTPUT_DIR/key-$TS.env"
META_FILE="$OUTPUT_DIR/manifest-$TS.txt"

printf "Creating DB backup: %s\n" "$DB_FILE"
docker compose --env-file .env exec -T postgres \
  pg_dump -U "$DATABASE_USER" -d "$DATABASE_NAME" > "$DB_FILE"

printf "Creating file backup: %s\n" "$FILES_FILE"
tar -czf "$FILES_FILE" -C "$(dirname "$ZYNQ_DATA_PATH")" "$(basename "$ZYNQ_DATA_PATH")"

printf "Saving encryption key: %s\n" "$KEY_FILE"
if ! grep -q '^FILE_ENCRYPTION_MASTER_KEY=' .env; then
  echo "Missing FILE_ENCRYPTION_MASTER_KEY in .env" >&2
  exit 1
fi
grep '^FILE_ENCRYPTION_MASTER_KEY=' .env > "$KEY_FILE"
chmod 600 "$KEY_FILE"

cat > "$META_FILE" <<META
created_at=$TS
database_user=$DATABASE_USER
database_name=$DATABASE_NAME
zynq_data_path=$ZYNQ_DATA_PATH
db_file=$(basename "$DB_FILE")
files_file=$(basename "$FILES_FILE")
key_file=$(basename "$KEY_FILE")
META

printf "Backup complete:\n"
printf "  %s\n  %s\n  %s\n  %s\n" "$DB_FILE" "$FILES_FILE" "$KEY_FILE" "$META_FILE"
