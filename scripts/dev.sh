#!/bin/sh
# Single command to start the full dev environment.
# Usage: pnpm dev
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Start Postgres (detached — returns immediately)
echo "Starting Postgres..."
docker compose -f "$ROOT/docker-compose.dev.yml" up -d

# Wait for Postgres to be ready before starting the API
echo "Waiting for Postgres..."
until docker exec zynqcloud-postgres-dev pg_isready -U zynqcloud -d zynqcloud > /dev/null 2>&1; do
  sleep 1
done
echo "Postgres ready."

# Start Go API in background
echo "Starting Go API (compiling...)..."
bash "$ROOT/scripts/dev-api.sh" &
API_PID=$!

# Kill API when this script exits (Ctrl+C or error)
trap 'echo "\nStopping..."; kill $API_PID 2>/dev/null; exit' INT TERM EXIT

# Wait for Go API to be ready before starting Vite
echo "Waiting for Go API..."
until curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; do
  sleep 1
done
echo "Go API ready."

# Start Vite in foreground (Ctrl+C here stops everything)
echo "Starting Vite..."
VITE_API_URL=/api/v1 pnpm --filter @zynqcloud/web dev
