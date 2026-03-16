#!/usr/bin/env bash
# ci-local.sh — run every CI check locally before pushing.
#
# Mirrors .github/workflows/ci.yml exactly so there are no surprises on push.
#
# Usage:
#   bash scripts/ci-local.sh           # all checks (skips Docker build)
#   bash scripts/ci-local.sh --docker  # also build the Docker image

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

DOCKER_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --docker) DOCKER_BUILD=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
declare -a FAILED_STEPS=()

step_start() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}${DIM} …${NC}"; }
step_pass()  { echo -e "${GREEN}  ✓ $1${NC}"; PASS=$((PASS + 1)); }
step_fail()  { echo -e "${RED}  ✗ $1${NC}"; FAIL=$((FAIL + 1)); FAILED_STEPS+=("$1"); }

run() {
  local label="$1"; shift
  step_start "$label"
  if "$@"; then
    step_pass "$label"
  else
    step_fail "$label"
  fi
}

# Root of the monorepo (parent of this script's directory)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "\n${BOLD}ZynqCloud — Local CI${NC}  ${DIM}(mirrors .github/workflows/ci.yml)${NC}"
echo -e "${DIM}repo: $REPO_ROOT${NC}"

# ── 1. Install dependencies ───────────────────────────────────────────────────

run "pnpm install" pnpm install --frozen-lockfile

# ── 2. Backend lint, test, build ──────────────────────────────────────────────

run "backend: lint"  pnpm --filter @zynqcloud/server lint
run "backend: test"  pnpm --filter @zynqcloud/server test
run "backend: e2e"   pnpm --filter @zynqcloud/server test:e2e
run "backend: build" pnpm --filter @zynqcloud/server build

# ── 3. Frontend lint, test, build ─────────────────────────────────────────────

run "frontend: lint"  pnpm --filter @zynqcloud/client lint
run "frontend: test"  pnpm --filter @zynqcloud/client test

VITE_API_URL=http://localhost:4000/api/v1 \
  run "frontend: build" pnpm --filter @zynqcloud/client build

# ── 4. Go API: vet, test, govulncheck ────────────────────────────────────────

GO_DIR="$REPO_ROOT/apps/server"

if command -v go >/dev/null 2>&1; then
  run "go: vet"  bash -c "cd '$GO_DIR' && go vet ./..."
  run "go: test" bash -c "cd '$GO_DIR' && go test ./..."

  # govulncheck: install if missing, then run
  if ! command -v govulncheck >/dev/null 2>&1; then
    step_start "go: install govulncheck"
    if go install golang.org/x/vuln/cmd/govulncheck@latest; then
      step_pass "go: install govulncheck"
    else
      step_fail "go: install govulncheck"
    fi
  fi

  if command -v govulncheck >/dev/null 2>&1; then
    # govulncheck exits 3 when vulnerabilities are found — treat as failure
    run "go: govulncheck" bash -c "cd '$GO_DIR' && govulncheck ./..."
  fi
else
  echo -e "${YELLOW}  ⚠ Go not found — skipping go vet / test / govulncheck${NC}"
fi

# ── 5. Docker build (opt-in) ──────────────────────────────────────────────────

if [ "$DOCKER_BUILD" = "true" ]; then
  if command -v docker >/dev/null 2>&1; then
      run "docker: build app image" docker build -t zynqcloud:ci .
    run "docker: build storage image" \
      docker build -t zynq-storage:ci "$GO_DIR"
  else
    echo -e "${YELLOW}  ⚠ Docker not found — skipping image builds${NC}"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo -e "${BOLD}Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}"

if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
  echo -e "\n${RED}Failed steps:${NC}"
  for s in "${FAILED_STEPS[@]}"; do
    echo -e "  ${RED}✗${NC} $s"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}${BOLD}All checks passed — safe to push.${NC}\n"
