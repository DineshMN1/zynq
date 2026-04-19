#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run this script from the zynqcloud directory." >&2
  exit 1
fi

echo "=== ZynqCloud Update ==="
echo ""

CURRENT=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' zynqcloud 2>/dev/null || echo "unknown")
echo "Running version : $CURRENT"
echo ""

echo "Pulling latest image..."
docker compose pull zynqcloud

echo ""
echo "Restarting app (database stays up)..."
docker compose up -d --no-deps zynqcloud

echo ""
NEW=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' zynqcloud 2>/dev/null || echo "unknown")
echo "Updated version : $NEW"
echo ""
docker compose ps zynqcloud
