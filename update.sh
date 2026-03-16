#!/usr/bin/env bash
# ZynqCloud — one-command update script
#
# Usage:
#   bash update.sh                     # updates from $HOME/zynqcloud
#   bash update.sh --dir /opt/zynq     # custom install directory
#   INSTALL_DIR=/opt/zynq bash update.sh
#
# What this does:
#   1. Pull latest Docker images
#   2. Force-recreate the migrate container so new migrations always run
#      (docker compose up -d alone reuses the exited migrate container and
#       skips any new migrations — this script fixes that)
#   3. Restart the app with the new image

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
CHECK="${GREEN}✓${NC}"
WARN="${YELLOW}!${NC}"
INFO="${CYAN}→${NC}"

log()  { echo -e "${INFO} $*"; }
ok()   { echo -e "${CHECK} $*"; }
warn() { echo -e "${WARN} $*"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/zynqcloud}"
APP_PORT="${APP_PORT:-3000}"

# ── Parse args ────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --port) APP_PORT="$2"; shift 2 ;;
    *) err "Unknown option: $1" ;;
  esac
done

ENV_FILE="$INSTALL_DIR/.env"
COMPOSE="docker compose --project-directory $INSTALL_DIR --env-file $ENV_FILE"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || err "No .env found at $ENV_FILE. Run install.sh first."

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose plugin not found. Install Docker Desktop or the Compose plugin."
fi

# Load APP_PORT from .env if present (override default)
if grep -q '^APP_PORT=' "$ENV_FILE" 2>/dev/null; then
  APP_PORT="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '"')"
fi

echo ""
echo -e "${CYAN}  ZynqCloud — Update${NC}"
echo ""

# ── Step 1: pull ──────────────────────────────────────────────────────────────
log "Pulling latest Docker images"
$COMPOSE pull || err "Image pull failed. Check your internet connection and try again."
ok "Images pulled"

# ── Step 2: run migrations ────────────────────────────────────────────────────
# The migrate container has restart:no. After the initial install it stays in
# 'exited' state. docker compose up -d treats that as service_completed_successfully
# and NEVER reruns it — new migrations from updated images would be silently skipped.
# --force-recreate removes the old container and runs a fresh one.
log "Running database migrations"
$COMPOSE up --force-recreate --no-deps -d migrate

# Wait for the migration container to finish
tries=60
i=0
while [ "$i" -lt "$tries" ]; do
  status="$(docker inspect --format='{{.State.Status}}' zynqcloud-migrate 2>/dev/null || echo 'missing')"
  if [ "$status" = "exited" ]; then
    exit_code="$(docker inspect --format='{{.State.ExitCode}}' zynqcloud-migrate 2>/dev/null || echo '1')"
    if [ "$exit_code" = "0" ]; then
      ok "Migrations completed"
      break
    else
      err "Migrations failed (exit code: $exit_code). Run: docker logs zynqcloud-migrate"
    fi
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge "$tries" ]; then
  warn "Migration container did not finish in time."
  echo "  Check: docker logs zynqcloud-migrate"
  exit 1
fi

# ── Step 3: restart app ───────────────────────────────────────────────────────
log "Restarting zynqcloud with new image"
$COMPOSE up -d zynqcloud
ok "Services updated"

# ── Step 4: health check ──────────────────────────────────────────────────────
log "Waiting for application to become healthy"
tries=45
i=0
while [ "$i" -lt "$tries" ]; do
  if curl -fsS "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
    ok "Application is healthy"
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge "$tries" ]; then
  warn "Health check timed out. The app may still be starting."
  echo "  Logs: docker compose --project-directory $INSTALL_DIR --env-file $ENV_FILE logs -f"
fi

echo ""
echo -e "${GREEN}  Update complete.${NC}"
echo ""
