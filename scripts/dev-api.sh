#!/bin/sh
# Start the Go API server for local development.
# Loads env vars from server/.env.dev (gitignored).
# Copy server/.env.dev.example → server/.env.dev if missing.
set -e

# Add common Go install locations to PATH (pnpm scripts don't inherit shell PATH)
export PATH="$PATH:/usr/local/go/bin:/opt/homebrew/bin:$HOME/go/bin:$HOME/.local/bin"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env.dev"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copying from .env.dev.example"
  cp "$ROOT/server/.env.dev.example" "$ENV_FILE"
fi

set -a
# server/.env.dev — Go-specific config
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# Build DATABASE_URL from root .env (same creds Docker Compose uses).
# Grep each variable individually to avoid sourcing the whole file
# (values like SMTP_FROM contain < > which break shell source).
if [ -f "$ROOT/.env" ]; then
  _get() { grep "^$1=" "$ROOT/.env" | tail -1 | cut -d= -f2-; }

  # Database — build URL from individual components.
  # Always use localhost: the DATABASE_HOST in root .env is 'postgres'
  # (Docker internal hostname), which doesn't resolve on the host machine.
  if [ -z "$DATABASE_URL" ]; then
    DB_PORT="$(_get DATABASE_PORT)"; DB_PORT="${DB_PORT:-5432}"
    DB_USER="$(_get DATABASE_USER)"; DB_USER="${DB_USER:-zynqcloud}"
    DB_PASS="$(_get DATABASE_PASSWORD)"; DB_PASS="${DB_PASS:-supersecret_db_pass}"
    DB_NAME="$(_get DATABASE_NAME)"; DB_NAME="${DB_NAME:-zynqcloud}"
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:$DB_PORT/$DB_NAME"
  fi

  # Auth / crypto — pull from root .env if not set in server/.env.dev
  [ -z "$JWT_SECRET" ] && export JWT_SECRET="$(_get JWT_SECRET)"
  [ -z "$FILE_ENCRYPTION_MASTER_KEY" ] && export FILE_ENCRYPTION_MASTER_KEY="$(_get FILE_ENCRYPTION_MASTER_KEY)"
fi

cd "$ROOT/server"
exec go run ./cmd/api
