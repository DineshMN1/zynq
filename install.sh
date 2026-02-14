#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# zynqCloud Installer
# Self-hosted file cloud — your files, your server, your control
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Symbols
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${CYAN}→${NC}"
WARN="${YELLOW}!${NC}"

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║                                          ║"
  echo "  ║          ███████╗██╗   ██╗███╗   ██╗     ║"
  echo "  ║          ╚══███╔╝╚██╗ ██╔╝████╗  ██║     ║"
  echo "  ║            ███╔╝  ╚████╔╝ ██╔██╗ ██║     ║"
  echo "  ║           ███╔╝    ╚██╔╝  ██║╚██╗██║     ║"
  echo "  ║          ███████╗   ██║   ██║ ╚████║     ║"
  echo "  ║          ╚══════╝   ╚═╝   ╚═╝  ╚═══╝     ║"
  echo "  ║                                          ║"
  echo -e "  ║       ${WHITE}zynqCloud${CYAN} — Self-hosted File Cloud   ║"
  echo "  ║                                          ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  ${DIM}Your files. Your cloud. Your control.${NC}"
  echo ""
}

print_step() {
  echo -e "\n${BLUE}${BOLD}[$1/$TOTAL_STEPS]${NC} ${WHITE}${BOLD}$2${NC}"
  echo -e "${DIM}$(printf '%.0s─' {1..50})${NC}"
}

print_success() {
  echo -e "  ${CHECK} $1"
}

print_error() {
  echo -e "  ${CROSS} $1"
}

print_warning() {
  echo -e "  ${WARN} $1"
}

print_info() {
  echo -e "  ${ARROW} $1"
}

prompt_input() {
  local prompt="$1"
  local default="$2"
  local var_name="$3"

  if [ -n "$default" ]; then
    echo -en "  ${CYAN}?${NC} ${prompt} ${DIM}(${default})${NC}: "
  else
    echo -en "  ${CYAN}?${NC} ${prompt}: "
  fi
  read -r input
  if [ -z "$input" ] && [ -n "$default" ]; then
    printf -v "$var_name" '%s' "$default"
  else
    printf -v "$var_name" '%s' "$input"
  fi
}

prompt_secret() {
  local prompt="$1"
  local var_name="$2"

  echo -en "  ${CYAN}?${NC} ${prompt}: "
  read -rs input
  echo ""
  printf -v "$var_name" '%s' "$input"
}

prompt_yesno() {
  local prompt="$1"
  local default="$2"

  if [ "$default" = "y" ]; then
    echo -en "  ${CYAN}?${NC} ${prompt} ${DIM}(Y/n)${NC}: "
  else
    echo -en "  ${CYAN}?${NC} ${prompt} ${DIM}(y/N)${NC}: "
  fi
  read -r input
  input="${input:-$default}"
  [[ "$input" =~ ^[Yy] ]]
}

generate_secret() {
  openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\\/&|]/\\&/g'
}

TOTAL_STEPS=5
INSTALL_DIR="${INSTALL_DIR:-$HOME/zynqcloud}"

# ============================================================
# Main
# ============================================================

print_banner

echo -e "${WHITE}${BOLD}Welcome to the zynqCloud installer!${NC}"
echo -e "${DIM}This script will set up zynqCloud on your server.${NC}"
echo ""

# ────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ────────────────────────────────────────────────────────────
print_step 1 "Checking prerequisites"

MISSING=0

# Docker
if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  print_success "Docker ${DIM}v${DOCKER_VERSION}${NC}"
else
  print_error "Docker is not installed"
  print_info "Install: ${CYAN}https://docs.docker.com/get-docker/${NC}"
  MISSING=1
fi

# Docker Compose
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
  print_success "Docker Compose ${DIM}v${COMPOSE_VERSION}${NC}"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  print_success "Docker Compose ${DIM}v${COMPOSE_VERSION}${NC} (legacy)"
else
  print_error "Docker Compose is not installed"
  print_info "Install: ${CYAN}https://docs.docker.com/compose/install/${NC}"
  MISSING=1
fi

# curl
if command -v curl &>/dev/null; then
  print_success "curl"
else
  print_warning "curl not found (optional, used for health checks)"
fi

# openssl
if command -v openssl &>/dev/null; then
  print_success "openssl"
else
  print_warning "openssl not found (will use /dev/urandom for secrets)"
fi

if [ "$MISSING" -eq 1 ]; then
  echo ""
  print_error "${RED}Missing required dependencies. Please install them and re-run this script.${NC}"
  exit 1
fi

echo ""
print_success "${GREEN}All prerequisites met!${NC}"

# ────────────────────────────────────────────────────────────
# Step 2: Configuration
# ────────────────────────────────────────────────────────────
print_step 2 "Configuration"

prompt_input "Install directory" "$INSTALL_DIR" INSTALL_DIR
prompt_input "Domain or IP (for CORS/frontend URL)" "localhost" DOMAIN

if [ "$DOMAIN" = "localhost" ]; then
  PROTOCOL="http"
  FRONTEND_URL="http://localhost:3000"
  CORS_ORIGIN="http://localhost:3000"
else
  if prompt_yesno "Use HTTPS?" "y"; then
    PROTOCOL="https"
  else
    PROTOCOL="http"
  fi
  FRONTEND_URL="${PROTOCOL}://${DOMAIN}"
  CORS_ORIGIN="${PROTOCOL}://${DOMAIN}"
fi

prompt_input "PostgreSQL password" "$(generate_secret 16 | tr -dc 'a-zA-Z0-9' | head -c 20)" DB_PASSWORD

# JWT Secret
JWT_SECRET=$(generate_secret 32)
print_info "JWT secret auto-generated ${DIM}(stored in .env)${NC}"

# Encryption key
ENCRYPTION_KEY=$(generate_secret 32)
print_info "Encryption master key auto-generated ${DIM}(stored in .env)${NC}"

# SMTP
echo ""
if prompt_yesno "Configure SMTP for email invites & password reset?" "n"; then
  SMTP_ENABLED="true"
  prompt_input "SMTP host" "smtp.gmail.com" SMTP_HOST
  prompt_input "SMTP port" "587" SMTP_PORT
  prompt_input "SMTP user" "" SMTP_USER
  prompt_secret "SMTP password" SMTP_PASS
  prompt_input "From address" "zynqCloud <no-reply@${DOMAIN}>" SMTP_FROM
else
  SMTP_ENABLED="false"
  SMTP_HOST="smtp.example.com"
  SMTP_PORT="587"
  SMTP_USER=""
  SMTP_PASS=""
  SMTP_FROM="zynqCloud <no-reply@localhost>"
fi

prompt_input "Data storage path" "${INSTALL_DIR}/data/files" DATA_PATH

# ────────────────────────────────────────────────────────────
# Step 3: Generate Files
# ────────────────────────────────────────────────────────────
print_step 3 "Generating configuration files"

mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_PATH"

# Write .env
cat > "${INSTALL_DIR}/.env" <<ENVEOF
# zynqCloud Environment — Generated by installer
# $(date -u +"%Y-%m-%d %H:%M:%S UTC")

JWT_SECRET=${JWT_SECRET}
FILE_ENCRYPTION_MASTER_KEY=${ENCRYPTION_KEY}
DB_PASSWORD=${DB_PASSWORD}
ZYNQ_DATA_PATH=${DATA_PATH}
ENVEOF
chmod 600 "${INSTALL_DIR}/.env"

print_success "Created ${DIM}${INSTALL_DIR}/.env${NC}"

# Write docker-compose.yml
cat > "${INSTALL_DIR}/docker-compose.yml" <<'COMPOSEEOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: zynqcloud-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: zynqcloud
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: zynqcloud
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zynqcloud -d zynqcloud"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks:
      - zynqcloud-network

  zynqcloud:
    image: ZYNQCLOUD_IMAGE_PLACEHOLDER
    container_name: zynqcloud
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://zynqcloud:${DB_PASSWORD}@postgres:5432/zynqcloud
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_USER: zynqcloud
      DATABASE_PASSWORD: ${DB_PASSWORD}
      DATABASE_NAME: zynqcloud
      JWT_SECRET: ${JWT_SECRET}
      FILE_STORAGE_PATH: /data/files
      FILE_ENCRYPTION_MASTER_KEY: ${FILE_ENCRYPTION_MASTER_KEY}
      EMAIL_ENABLED: "SMTP_ENABLED_PLACEHOLDER"
      SMTP_HOST: SMTP_HOST_PLACEHOLDER
      SMTP_PORT: SMTP_PORT_PLACEHOLDER
      SMTP_SECURE: "false"
      SMTP_USER: SMTP_USER_PLACEHOLDER
      SMTP_PASS: SMTP_PASS_PLACEHOLDER
      SMTP_FROM: "SMTP_FROM_PLACEHOLDER"
      CORS_ORIGIN: CORS_ORIGIN_PLACEHOLDER
      FRONTEND_URL: FRONTEND_URL_PLACEHOLDER
    ports:
      - "3000:80"
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
      device: ${ZYNQ_DATA_PATH}

networks:
  zynqcloud-network:
    driver: bridge
COMPOSEEOF

# Replace placeholders with actual values
ESCAPED_SMTP_ENABLED="$(escape_sed_replacement "${SMTP_ENABLED}")"
ESCAPED_SMTP_HOST="$(escape_sed_replacement "${SMTP_HOST}")"
ESCAPED_SMTP_PORT="$(escape_sed_replacement "${SMTP_PORT}")"
ESCAPED_SMTP_USER="$(escape_sed_replacement "${SMTP_USER}")"
ESCAPED_SMTP_PASS="$(escape_sed_replacement "${SMTP_PASS}")"
ESCAPED_SMTP_FROM="$(escape_sed_replacement "${SMTP_FROM}")"
ESCAPED_CORS_ORIGIN="$(escape_sed_replacement "${CORS_ORIGIN}")"
ESCAPED_FRONTEND_URL="$(escape_sed_replacement "${FRONTEND_URL}")"
sed -i.bak \
  -e "s|ZYNQCLOUD_IMAGE_PLACEHOLDER|dineshmn1/zynqcloud:latest|g" \
  -e "s|SMTP_ENABLED_PLACEHOLDER|${ESCAPED_SMTP_ENABLED}|g" \
  -e "s|SMTP_HOST_PLACEHOLDER|${ESCAPED_SMTP_HOST}|g" \
  -e "s|SMTP_PORT_PLACEHOLDER|${ESCAPED_SMTP_PORT}|g" \
  -e "s|SMTP_USER_PLACEHOLDER|${ESCAPED_SMTP_USER}|g" \
  -e "s|SMTP_PASS_PLACEHOLDER|${ESCAPED_SMTP_PASS}|g" \
  -e "s|SMTP_FROM_PLACEHOLDER|${ESCAPED_SMTP_FROM}|g" \
  -e "s|CORS_ORIGIN_PLACEHOLDER|${ESCAPED_CORS_ORIGIN}|g" \
  -e "s|FRONTEND_URL_PLACEHOLDER|${ESCAPED_FRONTEND_URL}|g" \
  "${INSTALL_DIR}/docker-compose.yml"
rm -f "${INSTALL_DIR}/docker-compose.yml.bak"

print_success "Created ${DIM}${INSTALL_DIR}/docker-compose.yml${NC}"

# ────────────────────────────────────────────────────────────
# Step 4: Start Services
# ────────────────────────────────────────────────────────────
print_step 4 "Starting zynqCloud"

cd "$INSTALL_DIR"

echo -e "  ${ARROW} Pulling Docker images..."
docker compose pull 2>&1 | while read -r line; do
  echo -e "    ${DIM}${line}${NC}"
done

echo -e "  ${ARROW} Starting containers..."
docker compose up -d 2>&1 | while read -r line; do
  echo -e "    ${DIM}${line}${NC}"
done

print_success "Containers started!"

# ────────────────────────────────────────────────────────────
# Step 5: Health Check
# ────────────────────────────────────────────────────────────
print_step 5 "Verifying installation"

echo -e "  ${ARROW} Waiting for services to be ready..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
    break
  fi
  RETRY=$((RETRY + 1))
  sleep 2
  echo -en "\r  ${ARROW} Waiting for backend... ${DIM}(${RETRY}/${MAX_RETRIES})${NC}  "
done

echo ""

if [ $RETRY -lt $MAX_RETRIES ]; then
  print_success "Backend is healthy!"
else
  print_warning "Backend didn't respond yet (it may still be starting)"
  print_info "Check logs: ${CYAN}docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f${NC}"
fi

# ────────────────────────────────────────────────────────────
# Done!
# ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║                                          ║"
echo "  ║    zynqCloud installed successfully!      ║"
echo "  ║                                          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${ARROW} Open ${CYAN}${BOLD}${FRONTEND_URL}${NC} in your browser"
echo -e "  ${ARROW} Create your admin account on first visit"
echo ""
echo -e "  ${DIM}Useful commands:${NC}"
echo -e "    ${WHITE}cd ${INSTALL_DIR}${NC}"
echo -e "    ${WHITE}docker compose logs -f${NC}         ${DIM}# View logs${NC}"
echo -e "    ${WHITE}docker compose restart${NC}         ${DIM}# Restart services${NC}"
echo -e "    ${WHITE}docker compose down${NC}            ${DIM}# Stop services${NC}"
echo -e "    ${WHITE}docker compose pull && docker compose up -d${NC}  ${DIM}# Update${NC}"
echo ""
echo -e "  ${DIM}Config: ${INSTALL_DIR}/.env${NC}"
echo -e "  ${DIM}Data:   ${DATA_PATH}${NC}"
echo ""
echo -e "  ${MAGENTA}${BOLD}Your files. Your cloud. Your control.${NC}"
echo ""
