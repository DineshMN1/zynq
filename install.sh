#!/usr/bin/env bash
set -euo pipefail

# ZynqCloud one-command installer
# Usage:
#   bash install.sh             # zero-prompt, auto-generates secrets, starts stack
#   bash install.sh --advanced  # prompts for install dir, domain, SMTP, registration
#   bash install.sh --force     # overwrite existing .env (safe backup first)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
WARN="${YELLOW}!${NC}"
INFO="${CYAN}→${NC}"
APP_NAME="ZynqCloud"

# ── Defaults ─────────────────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-$HOME/zynqcloud}"
DOMAIN="${DOMAIN:-localhost}"
APP_PORT="${APP_PORT:-3000}"
APP_IMAGE="${ZYNQCLOUD_IMAGE:-dineshmn1/zynqcloud:latest}"
STORAGE_IMAGE="${ZYNQ_STORAGE_IMAGE:-dineshmn1/zynq-storage:latest}"
DATA_PATH="${ZYNQ_DATA_PATH:-${INSTALL_DIR}/data/files}"
DATA_PATH_SET="false"
if [ "${ZYNQ_DATA_PATH+x}" = "x" ]; then DATA_PATH_SET="true"; fi

# SMTP defaults (disabled — controlled via Admin UI at runtime)
SMTP_ENABLED="false"
SMTP_HOST="${SMTP_HOST:-smtp.example.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-ZynqCloud <no-reply@localhost>}"

DATABASE_USER="${DATABASE_USER:-${POSTGRES_USER:-zynqcloud}}"
DATABASE_NAME="${DATABASE_NAME:-${POSTGRES_DB:-zynqcloud}}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-${POSTGRES_PASSWORD:-}}"
JWT_SECRET="${JWT_SECRET:-}"
FILE_ENCRYPTION_MASTER_KEY="${FILE_ENCRYPTION_MASTER_KEY:-}"
STORAGE_SERVICE_TOKEN="${STORAGE_SERVICE_TOKEN:-}"
PUBLIC_REGISTRATION="${PUBLIC_REGISTRATION:-false}"
INVITE_TOKEN_TTL_HOURS="${INVITE_TOKEN_TTL_HOURS:-72}"
RATE_LIMIT_TTL="${RATE_LIMIT_TTL:-60000}"
RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-100}"
USE_HTTPS="${USE_HTTPS:-auto}"
EDIT_ENV="${EDIT_ENV:-false}"

# Installer mode flags
NON_INTERACTIVE="true"    # Default: zero prompts
FORCE_OVERWRITE="false"   # --force: overwrite existing .env
INIT_ONLY="false"         # --init-only: write files, do not start

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo -e "${INFO} $*"; }
ok()   { echo -e "${CHECK} $*"; }
warn() { echo -e "${WARN} $*"; }
err()  { echo -e "${RED}✗ $*${NC}"; }

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat <<USAGE
${APP_NAME} Installer

Usage:
  bash install.sh [options]

Options:
  --advanced             Prompt for install directory, domain, SMTP, and registration
  --force                Overwrite existing .env (a backup is created first)
  --dir <path>           Install directory (default: \$HOME/zynqcloud)
  --domain <host>        Public domain or IP (default: localhost)
  --port <port>          Host port for the app (default: 3000)
  --image <image:tag>    Docker image (default: dineshmn1/zynqcloud:latest)
  --use-https <auto|true|false>
  --init-only            Write config files only, do not start containers
  --edit-env             Open generated .env in editor before starting
  --no-edit-env          Skip editor prompt (default)
  --smtp-enable          Pre-enable SMTP in .env (also configurable via Admin UI)
  --smtp-host <host>
  --smtp-port <port>
  --smtp-secure <bool>
  --smtp-user <user>
  --smtp-pass <pass>
  --smtp-from <from>
  --help, -h             Show this help

Examples:
  bash install.sh
  bash install.sh --advanced
  bash install.sh --force
  bash install.sh --domain mycloud.example.com --port 8080
USAGE
}

# ── Argument parsing ───────────────────────────────────────────────────────────
parse_args() {
  require_value() {
    if [ $# -lt 2 ] || [ -z "${2:-}" ] || [ "${2#--}" != "$2" ]; then
      err "Missing value for option: $1"
      usage; exit 1
    fi
  }

  while [ $# -gt 0 ]; do
    case "$1" in
      --advanced)      NON_INTERACTIVE="false"; shift ;;
      --force)         FORCE_OVERWRITE="true"; shift ;;
      --dir)           require_value "$@"; INSTALL_DIR="$2"; shift 2 ;;
      --domain)        require_value "$@"; DOMAIN="$2"; shift 2 ;;
      --port)          require_value "$@"; APP_PORT="$2"; shift 2 ;;
      --image)         require_value "$@"; APP_IMAGE="$2"; shift 2 ;;
      --storage-image) require_value "$@"; STORAGE_IMAGE="$2"; shift 2 ;;
      --use-https)     require_value "$@"; USE_HTTPS="$2"; shift 2 ;;
      --init-only)     INIT_ONLY="true"; shift ;;
      --edit-env)      EDIT_ENV="true"; shift ;;
      --no-edit-env)   EDIT_ENV="false"; shift ;;
      --smtp-enable)   SMTP_ENABLED="true"; shift ;;
      --smtp-host)     require_value "$@"; SMTP_HOST="$2"; shift 2 ;;
      --smtp-port)     require_value "$@"; SMTP_PORT="$2"; shift 2 ;;
      --smtp-secure)   require_value "$@"; SMTP_SECURE="$2"; shift 2 ;;
      --smtp-user)     require_value "$@"; SMTP_USER="$2"; shift 2 ;;
      --smtp-pass)     require_value "$@"; SMTP_PASS="$2"; shift 2 ;;
      --smtp-from)     require_value "$@"; SMTP_FROM="$2"; shift 2 ;;
      --help|-h)       usage; exit 0 ;;
      *)
        err "Unknown option: $1"
        usage; exit 1
        ;;
    esac
  done

  if [ "$DATA_PATH_SET" != "true" ]; then
    DATA_PATH="${INSTALL_DIR}/data/files"
  fi
}

# ── TTY / prompt helpers ───────────────────────────────────────────────────────
is_tty() { [ -t 0 ]; }

prompt() {
  local var_name="$1" label="$2" default="$3" input
  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"; return
  fi
  echo -en "${CYAN}?${NC} ${label} ${DIM}(${default})${NC}: "
  read -r input
  printf -v "$var_name" '%s' "${input:-$default}"
}

prompt_secret() {
  local var_name="$1" label="$2" default="$3" input
  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"; return
  fi
  if [ -n "$default" ]; then
    echo -en "${CYAN}?${NC} ${label} ${DIM}(leave empty to keep existing)${NC}: "
  else
    echo -en "${CYAN}?${NC} ${label}: "
  fi
  read -rs input; echo ""
  printf -v "$var_name" '%s' "${input:-$default}"
}

prompt_yesno() {
  local var_name="$1" label="$2" default="$3" input
  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"; return
  fi
  local hint; [ "$default" = "true" ] && hint="Y/n" || hint="y/N"
  echo -en "${CYAN}?${NC} ${label} ${DIM}(${hint})${NC}: "
  read -r input
  input="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]')"
  if [ -z "$input" ]; then
    printf -v "$var_name" '%s' "$default"
  elif [ "$input" = "y" ] || [ "$input" = "yes" ]; then
    printf -v "$var_name" 'true'
  else
    printf -v "$var_name" 'false'
  fi
}

# ── Secret generation helpers ─────────────────────────────────────────────────
generate_base64_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 16
  else
    head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

decode_base64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl base64 -d -A 2>/dev/null; return
  fi
  if printf 'QQ==' | base64 --decode >/dev/null 2>&1; then
    base64 --decode 2>/dev/null; return
  fi
  if printf 'QQ==' | base64 -d >/dev/null 2>&1; then
    base64 -d 2>/dev/null; return
  fi
  base64 -D 2>/dev/null
}

is_valid_base64_32() {
  local key="$1" decoded_len
  [ -z "$key" ] && return 1
  decoded_len="$(printf '%s' "$key" | decode_base64 | wc -c | tr -d '[:space:]')" || return 1
  [ "$decoded_len" = "32" ]
}

is_valid_jwt_secret() {
  [ "${#1}" -ge 32 ]
}

# ── OS detection ──────────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s 2>/dev/null)" in
    Linux*)           echo "linux" ;;
    Darwin*)          echo "mac" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)                echo "unknown" ;;
  esac
}

# ── STEP 1: check_dependencies ────────────────────────────────────────────────
check_dependencies() {
  log "Checking dependencies"

  # Docker
  if ! command -v docker >/dev/null 2>&1; then
    local os; os=$(detect_os)
    err "Docker is not installed. Please install it and re-run."
    case "$os" in
      linux)   echo "  curl -fsSL https://get.docker.com | sh" ;;
      mac)     echo "  https://docs.docker.com/desktop/install/mac-install/" ;;
      windows) echo "  https://docs.docker.com/desktop/install/windows-install/" ;;
    esac
    exit 1
  fi

  # Docker Compose v2
  if ! docker compose version >/dev/null 2>&1; then
    local os; os=$(detect_os)
    err "Docker Compose plugin (v2) is not installed."
    if [ "$os" = "linux" ]; then
      log "Attempting to install Docker Compose plugin..."
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
      elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y docker-compose-plugin 2>/dev/null || true
      elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y docker-compose-plugin 2>/dev/null || true
      fi
      if docker compose version >/dev/null 2>&1; then
        ok "Docker Compose plugin installed"
        return 0
      fi
    fi
    err "Please install Docker Desktop or the Docker Compose plugin."
    echo "  https://docs.docker.com/compose/install/"
    exit 1
  fi

  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  ok "Docker Compose $(docker compose version --short 2>/dev/null || echo 'v2')"
}

# ── STEP 2: configure_advanced (only when --advanced) ─────────────────────────
configure_advanced() {
  echo ""
  echo -e "${CYAN}Advanced configuration — press Enter to accept defaults${NC}"
  echo ""

  local old_install_dir="$INSTALL_DIR"
  prompt INSTALL_DIR "Install directory" "$INSTALL_DIR"
  if [ "$DATA_PATH_SET" != "true" ] && [ "$DATA_PATH" = "${old_install_dir}/data/files" ]; then
    DATA_PATH="${INSTALL_DIR}/data/files"
  fi

  prompt DOMAIN "Domain or IP" "$DOMAIN"
  prompt_yesno PUBLIC_REGISTRATION "Enable public registration?" "$PUBLIC_REGISTRATION"

  echo ""
  echo -e "${DIM}SMTP (email notifications — can also be configured via Admin UI after install)${NC}"
  prompt_yesno SMTP_ENABLED "Enable SMTP?" "$SMTP_ENABLED"
  if [ "$SMTP_ENABLED" = "true" ]; then
    prompt SMTP_HOST "SMTP host" "$SMTP_HOST"
    prompt SMTP_PORT "SMTP port" "$SMTP_PORT"
    prompt_yesno SMTP_SECURE "SMTP TLS/SSL?" "$SMTP_SECURE"
    prompt SMTP_USER "SMTP username" "$SMTP_USER"
    prompt_secret SMTP_PASS "SMTP password" "$SMTP_PASS"
    prompt SMTP_FROM "From address" "$SMTP_FROM"
  fi
}

# ── STEP 3: generate_secrets ──────────────────────────────────────────────────
generate_secrets() {
  log "Generating secrets"

  if [ -z "$DATABASE_PASSWORD" ]; then
    DATABASE_PASSWORD="$(generate_password)"
  fi

  if ! is_valid_jwt_secret "$JWT_SECRET"; then
    JWT_SECRET="$(generate_base64_32)"
  fi

  if ! is_valid_base64_32 "$FILE_ENCRYPTION_MASTER_KEY"; then
    FILE_ENCRYPTION_MASTER_KEY="$(generate_base64_32)"
  fi

  if [ -z "$STORAGE_SERVICE_TOKEN" ]; then
    STORAGE_SERVICE_TOKEN="$(generate_password)"
  fi

  ok "Generated DATABASE_PASSWORD, JWT_SECRET, FILE_ENCRYPTION_MASTER_KEY, STORAGE_SERVICE_TOKEN"
}

# ── Download or copy docker-compose + .env.example ────────────────────────────
download_or_copy_templates() {
  local script_dir=""
  if [ -n "${BASH_SOURCE[0]:-}" ]; then
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  elif [ -n "${0:-}" ] && [ "${0}" != "bash" ] && [ -f "${0}" ]; then
    script_dir="$(cd "$(dirname "${0}")" && pwd)"
  fi

  mkdir -p "$INSTALL_DIR"

  if [ -n "$script_dir" ] && [ -f "$script_dir/docker-compose.yml" ] && [ -f "$script_dir/.env.example" ]; then
    cp "$script_dir/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
    cp "$script_dir/.env.example" "$INSTALL_DIR/.env.example"
    ok "Copied deployment templates"
  else
    cat > "$INSTALL_DIR/docker-compose.yml" <<'COMPOSEEOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: zynqcloud-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: ${DATABASE_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DATABASE_USER} -d ${DATABASE_NAME}']
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks:
      - zynqcloud-network

  migrate:
    image: ${ZYNQCLOUD_IMAGE:-dineshmn1/zynqcloud:latest}
    container_name: zynqcloud-migrate
    restart: 'no'
    depends_on:
      postgres:
        condition: service_healthy
    command: ['node', '/app/server/dist/database/run-migrations.js']
    environment:
      NODE_ENV: production
      DATABASE_HOST: ${DATABASE_HOST:-postgres}
      DATABASE_PORT: ${DATABASE_PORT:-5432}
      DATABASE_USER: ${DATABASE_USER}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_NAME: ${DATABASE_NAME}
    networks:
      - zynqcloud-network

  storage-service:
    image: ${ZYNQ_STORAGE_IMAGE:-dineshmn1/zynq-storage:latest}
    container_name: zynqcloud-storage
    restart: unless-stopped
    environment:
      STORAGE_PORT: 5000
      STORAGE_PATH: /data/files
      SERVICE_TOKEN: ${STORAGE_SERVICE_TOKEN}
      MAX_CONCURRENT_UPLOADS: ${MAX_CONCURRENT_UPLOADS:-256}
      MAX_ASSEMBLY_WORKERS: ${MAX_ASSEMBLY_WORKERS:-32}
      SESSION_TTL_HOURS: ${SESSION_TTL_HOURS:-24}
      MIN_FREE_BYTES: ${MIN_FREE_BYTES:-536870912}
    volumes:
      - zynq_files:/data/files
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:5000/health || exit 1']
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - zynqcloud-network

  zynqcloud:
    image: ${ZYNQCLOUD_IMAGE:-dineshmn1/zynqcloud:latest}
    container_name: zynqcloud
    restart: unless-stopped
    depends_on:
      migrate:
        condition: service_completed_successfully
      storage-service:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST:-postgres}:${DATABASE_PORT:-5432}/${DATABASE_NAME}
      DATABASE_HOST: ${DATABASE_HOST:-postgres}
      DATABASE_PORT: ${DATABASE_PORT:-5432}
      DATABASE_USER: ${DATABASE_USER}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      DATABASE_NAME: ${DATABASE_NAME}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      COOKIE_DOMAIN: ${COOKIE_DOMAIN}
      FILE_STORAGE_PATH: /data/files
      FILE_ENCRYPTION_MASTER_KEY: ${FILE_ENCRYPTION_MASTER_KEY}
      EMAIL_ENABLED: ${EMAIL_ENABLED}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_SECURE: ${SMTP_SECURE}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM: ${SMTP_FROM}
      INVITE_TOKEN_TTL_HOURS: ${INVITE_TOKEN_TTL_HOURS}
      PUBLIC_REGISTRATION: ${PUBLIC_REGISTRATION}
      CORS_ORIGIN: ${CORS_ORIGIN}
      FRONTEND_URL: ${FRONTEND_URL}
      RATE_LIMIT_TTL: ${RATE_LIMIT_TTL}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX}
      STORAGE_SERVICE_URL: http://storage-service:5000
      STORAGE_SERVICE_TOKEN: ${STORAGE_SERVICE_TOKEN}
    ports:
      - '${APP_PORT:-3000}:80'
    volumes:
      - zynq_files:/data/files
    networks:
      - zynqcloud-network

volumes:
  postgres_data:
    driver: local
  zynq_files:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${ZYNQ_DATA_PATH:?ZYNQ_DATA_PATH is required}

networks:
  zynqcloud-network:
    driver: bridge
COMPOSEEOF
    ok "Wrote built-in docker-compose.yml"
  fi
}

# ── STEP 4: create_env ────────────────────────────────────────────────────────
create_env() {
  local protocol
  if [ "$DOMAIN" = "localhost" ]; then
    protocol="http"
  else
    case "$USE_HTTPS" in
      true)  protocol="https" ;;
      false) protocol="http" ;;
      *)     protocol="https" ;;
    esac
  fi

  local frontend_url="${protocol}://${DOMAIN}"
  if [ "$DOMAIN" = "localhost" ]; then
    frontend_url="http://localhost:${APP_PORT}"
  fi

  local cookie_domain="$DOMAIN"
  if [ "$DOMAIN" = "localhost" ]; then cookie_domain="localhost"; fi

  # Existing .env handling
  if [ -f "$INSTALL_DIR/.env" ]; then
    if [ "$FORCE_OVERWRITE" != "true" ]; then
      warn "Existing .env found — skipping (use --force to overwrite)"
      ok "Using existing $INSTALL_DIR/.env"
      return
    fi
    cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.env.bak.$(date +%s)"
    warn "Existing .env backed up"
  fi

  mkdir -p "$DATA_PATH"

  {
    printf '# ZynqCloud Environment — generated by install.sh\n'
    printf '# %s\n\n' "$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    printf 'ZYNQCLOUD_IMAGE="%s"\n' "$APP_IMAGE"
    printf 'ZYNQ_STORAGE_IMAGE="%s"\n' "$STORAGE_IMAGE"
    printf 'APP_PORT="%s"\n' "$APP_PORT"
    printf 'ZYNQ_DATA_PATH="%s"\n\n' "$DATA_PATH"
    printf 'DATABASE_HOST="postgres"\n'
    printf 'DATABASE_PORT="5432"\n'
    printf 'DATABASE_USER="%s"\n' "$DATABASE_USER"
    printf 'DATABASE_PASSWORD="%s"\n' "$DATABASE_PASSWORD"
    printf 'DATABASE_NAME="%s"\n\n' "$DATABASE_NAME"
    printf 'JWT_SECRET="%s"\n' "$JWT_SECRET"
    printf 'JWT_EXPIRES_IN="7d"\n'
    printf 'COOKIE_DOMAIN="%s"\n' "$cookie_domain"
    printf 'FILE_ENCRYPTION_MASTER_KEY="%s"\n' "$FILE_ENCRYPTION_MASTER_KEY"
    printf 'STORAGE_SERVICE_TOKEN="%s"\n\n' "$STORAGE_SERVICE_TOKEN"
    printf '# SMTP — disabled by default; enable and configure via Admin → Notifications\n'
    printf 'EMAIL_ENABLED="%s"\n' "$SMTP_ENABLED"
    printf 'SMTP_HOST="%s"\n' "$SMTP_HOST"
    printf 'SMTP_PORT="%s"\n' "$SMTP_PORT"
    printf 'SMTP_SECURE="%s"\n' "$SMTP_SECURE"
    printf 'SMTP_USER="%s"\n' "$SMTP_USER"
    printf 'SMTP_PASS="%s"\n' "$SMTP_PASS"
    printf 'SMTP_FROM="%s"\n\n' "$SMTP_FROM"
    printf 'INVITE_TOKEN_TTL_HOURS="%s"\n' "$INVITE_TOKEN_TTL_HOURS"
    printf 'PUBLIC_REGISTRATION="%s"\n' "$PUBLIC_REGISTRATION"
    printf 'RATE_LIMIT_TTL="%s"\n' "$RATE_LIMIT_TTL"
    printf 'RATE_LIMIT_MAX="%s"\n\n' "$RATE_LIMIT_MAX"
    printf 'CORS_ORIGIN="%s"\n' "$frontend_url"
    printf 'FRONTEND_URL="%s"\n' "$frontend_url"
  } > "$INSTALL_DIR/.env"

  chmod 600 "$INSTALL_DIR/.env"
  ok "Created $INSTALL_DIR/.env"
}

# ── edit .env before start ────────────────────────────────────────────────────
edit_env_if_requested() {
  [ "$EDIT_ENV" != "true" ] && return

  local editor="${EDITOR:-}"
  if [ -z "$editor" ]; then
    if command -v nano >/dev/null 2>&1; then
      editor="nano"
    elif command -v vi >/dev/null 2>&1; then
      editor="vi"
    fi
  fi

  if [ -z "$editor" ]; then
    warn "No editor found. Skipping .env review."
    return
  fi

  "$editor" "$INSTALL_DIR/.env"
}

# ── STEP 5: start_containers ─────────────────────────────────────────────────
start_containers() {
  log "Pulling Docker images"
  if ! docker compose --project-directory "$INSTALL_DIR" --env-file "$INSTALL_DIR/.env" pull; then
    err "Image pull failed."
    echo "  Fix $INSTALL_DIR/.env and re-run:"
    echo "    cd $INSTALL_DIR && docker compose --env-file .env pull"
    exit 1
  fi
  ok "Images pulled"

  log "Starting containers"
  if ! docker compose --project-directory "$INSTALL_DIR" --env-file "$INSTALL_DIR/.env" up -d; then
    err "Container startup failed."
    echo "  cd $INSTALL_DIR && docker compose --env-file .env logs"
    exit 1
  fi
  ok "Containers started"
}

# ── STEP 6: wait_for_db ───────────────────────────────────────────────────────
wait_for_db() {
  log "Waiting for database to be ready"
  local tries=30 i=0
  while [ "$i" -lt "$tries" ]; do
    if docker exec zynqcloud-postgres pg_isready -U "$DATABASE_USER" -d "$DATABASE_NAME" >/dev/null 2>&1; then
      ok "Database is ready"
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  warn "Database did not become ready in time. Check logs:"
  echo "  docker logs zynqcloud-postgres"
  exit 1
}

# ── STEP 7: run_migrations ────────────────────────────────────────────────────
run_migrations() {
  log "Waiting for migrations to complete"
  local tries=60 i=0
  while [ "$i" -lt "$tries" ]; do
    local status
    status="$(docker inspect --format='{{.State.Status}}' zynqcloud-migrate 2>/dev/null || echo 'missing')"
    if [ "$status" = "exited" ]; then
      local exit_code
      exit_code="$(docker inspect --format='{{.State.ExitCode}}' zynqcloud-migrate 2>/dev/null || echo '1')"
      if [ "$exit_code" = "0" ]; then
        ok "Migrations completed"
        return 0
      else
        err "Migrations failed (exit code: $exit_code)"
        echo "  docker logs zynqcloud-migrate"
        exit 1
      fi
    fi
    i=$((i + 1))
    sleep 2
  done
  warn "Migration container did not finish in time. Check logs:"
  echo "  docker logs zynqcloud-migrate"
  exit 1
}

# ── STEP 8: health_check ──────────────────────────────────────────────────────
health_check() {
  log "Checking application health"
  local tries=45 i=0
  while [ "$i" -lt "$tries" ]; do
    if curl -fsS "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
      ok "Application is healthy"
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  warn "Health check timed out. The app may still be starting. Check logs:"
  echo "  docker compose --project-directory $INSTALL_DIR --env-file $INSTALL_DIR/.env logs -f"
}

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${BLUE}  Z Y N Q C L O U D${NC}"
  echo -e "${DIM}  Self-hosted cloud storage${NC}"
  echo ""
}

# ── Final summary ─────────────────────────────────────────────────────────────
print_summary() {
  local access_url="http://localhost:${APP_PORT}"
  if [ "$DOMAIN" != "localhost" ]; then
    local proto="https"
    [ "$USE_HTTPS" = "false" ] && proto="http"
    access_url="${proto}://${DOMAIN}"
  fi

  echo ""
  echo -e "${WHITE}--------------------------------------------------${NC}"
  echo -e "${WHITE}  ZynqCloud Installed Successfully${NC}"
  echo -e "${WHITE}  Access: ${access_url}${NC}"
  echo -e "${WHITE}  Admin setup: Complete in browser${NC}"
  echo -e "${WHITE}--------------------------------------------------${NC}"
  echo ""
  echo "  Install dir : $INSTALL_DIR"
  echo "  Env file    : $INSTALL_DIR/.env"
  echo "  Data path   : $DATA_PATH"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  print_banner
  parse_args "$@"

  # Validate flag values
  case "$APP_PORT" in
    ''|*[!0-9]*) err "APP_PORT must be numeric (got: $APP_PORT)"; exit 1 ;;
  esac
  case "$SMTP_PORT" in
    ''|*[!0-9]*) err "SMTP_PORT must be numeric (got: $SMTP_PORT)"; exit 1 ;;
  esac
  case "$USE_HTTPS" in
    auto|true|false) ;;
    *) err "--use-https must be auto|true|false"; exit 1 ;;
  esac

  log "Installing ${APP_NAME} in $INSTALL_DIR"

  check_dependencies

  # --advanced: prompt before generating secrets / writing files
  if [ "$NON_INTERACTIVE" = "false" ] && is_tty; then
    configure_advanced
  fi

  generate_secrets
  download_or_copy_templates
  create_env
  edit_env_if_requested

  if [ "$INIT_ONLY" = "true" ]; then
    ok "Init-only mode: files written, containers not started"
    echo ""
    echo "  Start manually:"
    echo "    cd $INSTALL_DIR && docker compose --env-file .env up -d"
    print_summary
    exit 0
  fi

  start_containers
  wait_for_db
  run_migrations
  health_check
  print_summary
}

main "$@"
