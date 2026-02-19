#!/usr/bin/env bash
set -euo pipefail

# zynqcloud one-command installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/DineshMN1/zynq/main/install.sh | bash

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
APP_NAME="zynqcloud"
APP_WORDMARK="ZYNQCLOUD"

INSTALL_DIR="${INSTALL_DIR:-$HOME/zynqcloud}"
DOMAIN="${DOMAIN:-localhost}"
APP_PORT="${APP_PORT:-3000}"
APP_IMAGE="${ZYNQCLOUD_IMAGE:-dineshmn1/zynqcloud:latest}"
DATA_PATH="${ZYNQ_DATA_PATH:-${INSTALL_DIR}/data/files}"
DATA_PATH_SET="false"
if [ "${ZYNQ_DATA_PATH+x}" = "x" ]; then
  DATA_PATH_SET="true"
fi
SMTP_ENABLED="${EMAIL_ENABLED:-false}"
TEMPLATE_ONLY="false"
NON_INTERACTIVE="false"
USE_HTTPS="${USE_HTTPS:-auto}"

SMTP_HOST="${SMTP_HOST:-smtp.example.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-zynqcloud <no-reply@localhost>}"
DATABASE_USER="${DATABASE_USER:-${POSTGRES_USER:-zynqcloud}}"
DATABASE_NAME="${DATABASE_NAME:-${POSTGRES_DB:-zynqcloud}}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-${POSTGRES_PASSWORD:-}}"
JWT_SECRET="${JWT_SECRET:-}"
FILE_ENCRYPTION_MASTER_KEY="${FILE_ENCRYPTION_MASTER_KEY:-}"
PUBLIC_REGISTRATION="${PUBLIC_REGISTRATION:-false}"
INVITE_TOKEN_TTL_HOURS="${INVITE_TOKEN_TTL_HOURS:-72}"
RATE_LIMIT_TTL="${RATE_LIMIT_TTL:-60000}"
RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-100}"
EDIT_ENV="${EDIT_ENV:-ask}"

usage() {
  cat <<USAGE
${APP_NAME} installer

Options:
  --dir <path>           Install directory (default: \$HOME/zynqcloud)
  --domain <host>        Public domain/ip (default: localhost)
  --port <port>          Host port for app (default: 3000)
  --image <image:tag>    Docker image (default: dineshmn1/zynqcloud:latest)
  --data-path <path>     Host path for user files
  --smtp-enable          Enable SMTP in generated .env
  --smtp-host <host>
  --smtp-port <port>
  --smtp-secure <bool>
  --smtp-user <user>
  --smtp-pass <pass>
  --smtp-from <from>
  --use-https <auto|true|false>
  --edit-env             Open generated .env in editor before start
  --no-edit-env          Do not open .env editor
  --template-only        Generate files only, do not start containers
  --non-interactive      Never prompt; use defaults/flags/env
  --help                 Show this help
USAGE
}

log() {
  echo -e "${INFO} $*"
}

ok() {
  echo -e "${CHECK} $*"
}

warn() {
  echo -e "${WARN} $*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo -e "${RED}Missing required command: $1${NC}"
    exit 1
  }
}

print_banner() {
  echo -e "${BLUE}Z Y N Q C L O U D${NC}"
}

is_tty() {
  [ -t 0 ]
}

prompt() {
  local var_name="$1"
  local label="$2"
  local default="$3"
  local input

  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"
    return
  fi

  echo -en "${CYAN}?${NC} ${label} ${DIM}(${default})${NC}: "
  read -r input
  if [ -z "${input}" ]; then
    printf -v "$var_name" '%s' "$default"
  else
    printf -v "$var_name" '%s' "$input"
  fi
}

prompt_secret() {
  local var_name="$1"
  local label="$2"
  local default="$3"
  local input

  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"
    return
  fi

  if [ -n "$default" ]; then
    echo -en "${CYAN}?${NC} ${label} ${DIM}(leave empty to keep existing)${NC}: "
  else
    echo -en "${CYAN}?${NC} ${label}: "
  fi
  read -rs input
  echo ""
  if [ -z "$input" ]; then
    printf -v "$var_name" '%s' "$default"
  else
    printf -v "$var_name" '%s' "$input"
  fi
}

prompt_yesno() {
  local var_name="$1"
  local label="$2"
  local default="$3"
  local input

  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    printf -v "$var_name" '%s' "$default"
    return
  fi

  if [ "$default" = "true" ]; then
    echo -en "${CYAN}?${NC} ${label} ${DIM}(Y/n)${NC}: "
  else
    echo -en "${CYAN}?${NC} ${label} ${DIM}(y/N)${NC}: "
  fi
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

decode_base64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl base64 -d -A 2>/dev/null
    return
  fi

  if printf 'QQ==' | base64 --decode >/dev/null 2>&1; then
    base64 --decode 2>/dev/null
    return
  fi

  if printf 'QQ==' | base64 -d >/dev/null 2>&1; then
    base64 -d 2>/dev/null
    return
  fi

  base64 -D 2>/dev/null
}

is_valid_base64_32() {
  local key="$1"
  local decoded_len

  if [ -z "$key" ]; then
    return 1
  fi

  decoded_len="$(printf '%s' "$key" | decode_base64 | wc -c | tr -d '[:space:]')" || return 1
  [ "$decoded_len" = "32" ]
}

is_valid_jwt_secret() {
  local secret="$1"
  [ "${#secret}" -ge 32 ]
}

prompt_jwt_secret() {
  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    if ! is_valid_jwt_secret "$JWT_SECRET"; then
      JWT_SECRET="$(generate_base64_32)"
      warn "Generated JWT_SECRET (missing/weak input)"
    fi
    return
  fi

  echo "JWT secret must be at least 32 characters."

  while true; do
    local choice
    echo -en "${CYAN}?${NC} JWT secret: [g]enerate / [p]aste ${DIM}(default: g)${NC}: "
    read -r choice
    choice="$(printf '%s' "$choice" | tr '[:upper:]' '[:lower:]')"
    [ -z "$choice" ] && choice="g"

    case "$choice" in
      g|generate)
        JWT_SECRET="$(generate_base64_32)"
        ok "Generated JWT_SECRET"
        return
        ;;
      p|paste)
        prompt_secret JWT_SECRET "Paste JWT secret (min 32 chars)" ""
        if is_valid_jwt_secret "$JWT_SECRET"; then
          return
        fi
        warn "Invalid JWT secret. It must be at least 32 characters."
        ;;
      *)
        warn "Invalid choice. Use 'g' (generate) or 'p' (paste)."
        ;;
    esac
  done
}

prompt_file_encryption_key() {
  if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
    if ! is_valid_base64_32 "$FILE_ENCRYPTION_MASTER_KEY"; then
      FILE_ENCRYPTION_MASTER_KEY="$(generate_base64_32)"
      warn "Generated FILE_ENCRYPTION_MASTER_KEY (missing/invalid input)"
    fi
    return
  fi

  echo "File encryption key must decode from base64 to exactly 32 bytes."

  while true; do
    local choice
    echo -en "${CYAN}?${NC} File encryption master key: [g]enerate / [p]aste ${DIM}(default: g)${NC}: "
    read -r choice
    choice="$(printf '%s' "$choice" | tr '[:upper:]' '[:lower:]')"
    [ -z "$choice" ] && choice="g"

    case "$choice" in
      g|generate)
        FILE_ENCRYPTION_MASTER_KEY="$(generate_base64_32)"
        ok "Generated FILE_ENCRYPTION_MASTER_KEY"
        return
        ;;
      p|paste)
        prompt_secret FILE_ENCRYPTION_MASTER_KEY "Paste file encryption master key (base64 32 bytes)" ""
        if is_valid_base64_32 "$FILE_ENCRYPTION_MASTER_KEY"; then
          return
        fi
        warn "Invalid key. It must be valid base64 and decode to exactly 32 bytes."
        ;;
      *)
        warn "Invalid choice. Use 'g' (generate) or 'p' (paste)."
        ;;
    esac
  done
}

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
    ok "Copied local templates"
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

  zynqcloud:
    image: ${ZYNQCLOUD_IMAGE:-dineshmn1/zynqcloud:latest}
    container_name: zynqcloud
    restart: unless-stopped
    depends_on:
      migrate:
        condition: service_completed_successfully
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

    cat > "$INSTALL_DIR/.env.example" <<'ENVEXAMPLEEOF'
# ============================================================
# zynqcloud Self-Host Environment
# Copy this file to .env before running `docker compose up -d`
# ============================================================

# Docker image to pull
ZYNQCLOUD_IMAGE=dineshmn1/zynqcloud:latest

# Public port on host (host:container => APP_PORT:80)
APP_PORT=3000

# Database (used by postgres service and app)
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=zynqcloud
DATABASE_PASSWORD=change_this_db_password
DATABASE_NAME=zynqcloud

# Auth / crypto (required)
JWT_SECRET=replace_with_strong_secret_at_least_32_chars
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost
FILE_ENCRYPTION_MASTER_KEY=replace_with_32_byte_base64_key

# File storage on host
ZYNQ_DATA_PATH=./data/files

# App behavior
EMAIL_ENABLED=false
INVITE_TOKEN_TTL_HOURS=72
PUBLIC_REGISTRATION=false
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100

# URLs (use your real domain in production)
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# SMTP (used when EMAIL_ENABLED=true)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=zynqcloud <no-reply@yourdomain.com>
ENVEXAMPLEEOF
    ok "Wrote built-in templates"
  fi
}

parse_args() {
  require_value() {
    if [ $# -lt 2 ] || [ -z "${2:-}" ] || [ "${2#--}" != "$2" ]; then
      echo -e "${RED}Missing value for option: $1${NC}"
      usage
      exit 1
    fi
  }

  while [ $# -gt 0 ]; do
    case "$1" in
      --dir) require_value "$@"; INSTALL_DIR="$2"; shift 2 ;;
      --domain) require_value "$@"; DOMAIN="$2"; shift 2 ;;
      --port) require_value "$@"; APP_PORT="$2"; shift 2 ;;
      --image) require_value "$@"; APP_IMAGE="$2"; shift 2 ;;
      --data-path) require_value "$@"; DATA_PATH="$2"; DATA_PATH_SET="true"; shift 2 ;;
      --smtp-enable) SMTP_ENABLED="true"; shift ;;
      --smtp-host) require_value "$@"; SMTP_HOST="$2"; shift 2 ;;
      --smtp-port) require_value "$@"; SMTP_PORT="$2"; shift 2 ;;
      --smtp-secure) require_value "$@"; SMTP_SECURE="$2"; shift 2 ;;
      --smtp-user) require_value "$@"; SMTP_USER="$2"; shift 2 ;;
      --smtp-pass) require_value "$@"; SMTP_PASS="$2"; shift 2 ;;
      --smtp-from) require_value "$@"; SMTP_FROM="$2"; shift 2 ;;
      --use-https) require_value "$@"; USE_HTTPS="$2"; shift 2 ;;
      --edit-env) EDIT_ENV="true"; shift ;;
      --no-edit-env) EDIT_ENV="false"; shift ;;
      --template-only) TEMPLATE_ONLY="true"; shift ;;
      --non-interactive) NON_INTERACTIVE="true"; shift ;;
      --help|-h) usage; exit 0 ;;
      *)
        echo -e "${RED}Unknown option: $1${NC}"
        usage
        exit 1
        ;;
    esac
  done
  if [ "$DATA_PATH_SET" != "true" ]; then
    DATA_PATH="${INSTALL_DIR}/data/files"
  fi
}

configure_interactive() {
  local old_install_dir="$INSTALL_DIR"
  prompt INSTALL_DIR "Install directory" "$INSTALL_DIR"
  if [ "$DATA_PATH_SET" != "true" ] && [ "$DATA_PATH" = "${old_install_dir}/data/files" ]; then
    DATA_PATH="${INSTALL_DIR}/data/files"
  fi
  prompt DOMAIN "Domain or IP" "$DOMAIN"
  prompt APP_PORT "App port" "$APP_PORT"
  local prev_data_path="$DATA_PATH"
  prompt DATA_PATH "Data path" "$DATA_PATH"
  if [ "$DATA_PATH" != "$prev_data_path" ]; then
    DATA_PATH_SET="true"
  fi
  prompt APP_IMAGE "Docker image" "$APP_IMAGE"

  prompt DATABASE_USER "Database user" "$DATABASE_USER"
  prompt DATABASE_NAME "Database name" "$DATABASE_NAME"

  if [ -z "$DATABASE_PASSWORD" ]; then
    DATABASE_PASSWORD="$(generate_password)"
  fi
  prompt_secret DATABASE_PASSWORD "Database password" "$DATABASE_PASSWORD"

  prompt_jwt_secret

  prompt_file_encryption_key

  prompt_yesno PUBLIC_REGISTRATION "Enable public registration?" "$PUBLIC_REGISTRATION"
  prompt INVITE_TOKEN_TTL_HOURS "Invite token TTL (hours)" "$INVITE_TOKEN_TTL_HOURS"

  prompt_yesno SMTP_ENABLED "Enable SMTP?" "$SMTP_ENABLED"
  if [ "$SMTP_ENABLED" = "true" ]; then
    prompt SMTP_HOST "SMTP host" "$SMTP_HOST"
    prompt SMTP_PORT "SMTP port" "$SMTP_PORT"
    prompt_yesno SMTP_SECURE "SMTP secure/TLS?" "$SMTP_SECURE"
    prompt SMTP_USER "SMTP user" "$SMTP_USER"
    prompt_secret SMTP_PASS "SMTP password" "$SMTP_PASS"
    prompt SMTP_FROM "SMTP from" "$SMTP_FROM"
  fi
}

validate_inputs() {
  case "$APP_PORT" in
    ''|*[!0-9]*)
      echo -e "${RED}APP_PORT must be numeric (got: $APP_PORT)${NC}"
      exit 1
      ;;
  esac

  case "$USE_HTTPS" in
    auto|true|false) ;;
    *)
      echo -e "${RED}--use-https must be auto|true|false${NC}"
      exit 1
      ;;
  esac

  case "$EDIT_ENV" in
    ask|true|false) ;;
    *)
      echo -e "${RED}EDIT_ENV must be ask|true|false${NC}"
      exit 1
      ;;
  esac

}

write_env() {
  local protocol
  if [ "$DOMAIN" = "localhost" ]; then
    protocol="http"
  else
    case "$USE_HTTPS" in
      true) protocol="https" ;;
      false) protocol="http" ;;
      auto) protocol="https" ;;
    esac
  fi

  local frontend_url="${protocol}://${DOMAIN}"
  if [ "$DOMAIN" = "localhost" ]; then
    frontend_url="http://localhost:${APP_PORT}"
  fi

  local cookie_domain="$DOMAIN"
  if [ "$DOMAIN" = "localhost" ]; then
    cookie_domain="localhost"
  fi

  if [ -z "$DATABASE_PASSWORD" ]; then
    DATABASE_PASSWORD="$(generate_password)"
  fi
  if ! is_valid_jwt_secret "$JWT_SECRET"; then
    JWT_SECRET="$(generate_base64_32)"
    warn "Generated JWT_SECRET (missing/weak input)"
  fi
  if ! is_valid_base64_32 "$FILE_ENCRYPTION_MASTER_KEY"; then
    FILE_ENCRYPTION_MASTER_KEY="$(generate_base64_32)"
    warn "Generated FILE_ENCRYPTION_MASTER_KEY (missing/invalid input)"
  fi

  if [ "$SMTP_ENABLED" != "true" ]; then
    SMTP_HOST="smtp.example.com"
    SMTP_PORT="587"
    SMTP_SECURE="false"
    SMTP_USER=""
    SMTP_PASS=""
    SMTP_FROM="zynqcloud <no-reply@${DOMAIN}>"
  fi

  mkdir -p "$DATA_PATH"

  if [ -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.env.bak.$(date +%s)"
    warn "Existing .env backed up"
  fi

  cat > "$INSTALL_DIR/.env" <<ENVEOF
# zynqcloud Environment (generated)
# $(date -u +"%Y-%m-%d %H:%M:%S UTC")

ZYNQCLOUD_IMAGE=${APP_IMAGE}
APP_PORT=${APP_PORT}
ZYNQ_DATA_PATH=${DATA_PATH}

DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=${DATABASE_USER}
DATABASE_PASSWORD=${DATABASE_PASSWORD}
DATABASE_NAME=${DATABASE_NAME}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=${cookie_domain}
FILE_ENCRYPTION_MASTER_KEY=${FILE_ENCRYPTION_MASTER_KEY}

EMAIL_ENABLED=${SMTP_ENABLED}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

INVITE_TOKEN_TTL_HOURS=${INVITE_TOKEN_TTL_HOURS}
PUBLIC_REGISTRATION=${PUBLIC_REGISTRATION}
RATE_LIMIT_TTL=${RATE_LIMIT_TTL}
RATE_LIMIT_MAX=${RATE_LIMIT_MAX}

CORS_ORIGIN=${frontend_url}
FRONTEND_URL=${frontend_url}
ENVEOF

  chmod 600 "$INSTALL_DIR/.env"
  ok "Created $INSTALL_DIR/.env"
}

edit_env_if_requested() {
  local should_edit="$EDIT_ENV"
  if [ "$should_edit" = "ask" ]; then
    if [ "$NON_INTERACTIVE" = "true" ] || ! is_tty; then
      should_edit="false"
    else
      prompt_yesno should_edit "Review/edit .env before starting containers?" "true"
    fi
  fi

  if [ "$should_edit" != "true" ]; then
    return
  fi

  local editor="${EDITOR:-}"
  if [ -z "$editor" ]; then
    if command -v nano >/dev/null 2>&1; then
      editor="nano"
    elif command -v vi >/dev/null 2>&1; then
      editor="vi"
    fi
  fi

  if [ -z "$editor" ]; then
    warn "No editor found. Skipping interactive edit."
    return
  fi

  "$editor" "$INSTALL_DIR/.env"
}

start_stack() {
  cd "$INSTALL_DIR"
  need_cmd curl

  log "Pulling images"
  docker compose --env-file .env pull

  log "Starting containers"
  docker compose --env-file .env up -d

  local tries=45
  local i=0
  log "Checking health endpoint"
  while [ "$i" -lt "$tries" ]; do
    if curl -fsS "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
      ok "Service healthy at http://localhost:${APP_PORT}"
      return
    fi
    i=$((i + 1))
    sleep 2
  done

  warn "Health check timeout. Check logs:"
  echo "  docker compose --env-file .env logs -f"
}

print_summary() {
  local install_url="http://localhost:${APP_PORT}"
  if [ "$DOMAIN" != "localhost" ]; then
    local proto="https"
    [ "$USE_HTTPS" = "false" ] && proto="http"
    install_url="${proto}://${DOMAIN}"
  fi

  echo ""
  echo -e "${WHITE}Congratulations! ${APP_NAME} is ready.${NC}"
  echo "  Stack dir : $INSTALL_DIR"
  echo "  Compose   : $INSTALL_DIR/docker-compose.yml"
  echo "  Env file  : $INSTALL_DIR/.env"
  echo "  Data path : $DATA_PATH"
  echo ""
  echo -e "${CYAN}Your app is ready at:${NC}"
  echo -e "${WHITE}${install_url}${NC}"
  echo -e "${DIM}\"Own your files. Own your cloud.\"${NC}"
  echo ""

  if [ "$TEMPLATE_ONLY" = "true" ]; then
    echo "Generated deployment files:"
    echo "  - docker-compose.yml"
    echo "  - .env"
    echo ""
  fi
}

main() {
  print_banner
  parse_args "$@"
  validate_inputs

  need_cmd docker
  if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}Docker Compose plugin is required (docker compose ...)${NC}"
    exit 1
  fi

  if [ "$NON_INTERACTIVE" != "true" ] && is_tty; then
    configure_interactive
  fi

  validate_inputs

  echo ""
  log "Preparing ${APP_NAME} in $INSTALL_DIR"

  download_or_copy_templates
  write_env
  edit_env_if_requested

  if [ "$TEMPLATE_ONLY" = "true" ]; then
    ok "Template-only mode: containers not started"
    print_summary
    exit 0
  fi

  start_stack
  print_summary
}

main "$@"
