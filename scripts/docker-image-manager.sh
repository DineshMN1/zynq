#!/usr/bin/env bash
set -euo pipefail

STACK_DIR="${STACK_DIR:-}"
ENV_FILE_NAME="${ENV_FILE_NAME:-.env}"
DEFAULT_IMAGE_REPO="${DEFAULT_IMAGE_REPO:-dineshmn1/zynqcloud}"
SERVICES=("migrate" "zynqcloud")
COMPOSE_DIR=""
ENV_FILE=""

usage() {
  cat <<'EOF'
Usage:
  scripts/docker-image-manager.sh current
  scripts/docker-image-manager.sh upgrade [tag_or_image]
  scripts/docker-image-manager.sh downgrade <tag_or_image>
  scripts/docker-image-manager.sh set <tag_or_image>

Examples:
  scripts/docker-image-manager.sh upgrade
  scripts/docker-image-manager.sh upgrade v1.2.3
  scripts/docker-image-manager.sh downgrade v1.2.2
  scripts/docker-image-manager.sh set ghcr.io/acme/zynqcloud:v1.2.3

Run from anywhere:
  STACK_DIR=$HOME/zynqcloud scripts/docker-image-manager.sh upgrade v1.2.3
  curl -fsSL https://raw.githubusercontent.com/dineshmn1/zynq/main/scripts/docker-image-manager.sh | bash -s -- upgrade
  curl -fsSL https://raw.githubusercontent.com/dineshmn1/zynq/main/scripts/docker-image-manager.sh | bash -s -- v1.2.3
EOF
}

resolve_compose_dir() {
  if [[ -n "$STACK_DIR" && -f "$STACK_DIR/docker-compose.yml" ]]; then
    COMPOSE_DIR="$STACK_DIR"
  elif [[ -f "./docker-compose.yml" ]]; then
    COMPOSE_DIR="$(pwd)"
  elif [[ -f "$HOME/zynqcloud/docker-compose.yml" ]]; then
    COMPOSE_DIR="$HOME/zynqcloud"
  else
    echo "Could not find docker-compose.yml."
    echo "Run this command inside your zynqCloud install directory, or set STACK_DIR."
    exit 1
  fi

  ENV_FILE="$COMPOSE_DIR/$ENV_FILE_NAME"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  if [[ -f "$COMPOSE_DIR/.env.example" ]]; then
    cp "$COMPOSE_DIR/.env.example" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
}

normalize_image() {
  local input="$1"
  if [[ "$input" == */*:* ]]; then
    echo "$input"
    return
  fi

  if [[ "$input" == *:* ]]; then
    echo "$input"
    return
  fi

  echo "${DEFAULT_IMAGE_REPO}:${input}"
}

set_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ ("^" key "=") {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp_file"

  mv "$tmp_file" "$file"
}

get_current_image() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "${DEFAULT_IMAGE_REPO}:latest"
    return
  fi

  local current
  current="$(grep -E '^ZYNQCLOUD_IMAGE=' "$ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  if [[ -z "$current" ]]; then
    echo "${DEFAULT_IMAGE_REPO}:latest"
    return
  fi

  echo "$current"
}

deploy_image() {
  local image="$1"
  resolve_compose_dir
  ensure_env_file
  set_env_var "ZYNQCLOUD_IMAGE" "$image" "$ENV_FILE"

  echo "Stack directory: $COMPOSE_DIR"
  echo "Using image: $image"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" --env-file "$ENV_FILE" pull "${SERVICES[@]}"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d "${SERVICES[@]}"
}

command="${1:-}"
arg="${2:-}"

case "$command" in
  current)
    resolve_compose_dir
    get_current_image
    ;;
  set)
    if [[ -z "$arg" ]]; then
      usage
      exit 1
    fi
    deploy_image "$(normalize_image "$arg")"
    ;;
  upgrade)
    if [[ -z "$arg" ]]; then
      arg="latest"
    fi
    deploy_image "$(normalize_image "$arg")"
    ;;
  downgrade)
    if [[ -z "$arg" ]]; then
      usage
      exit 1
    fi
    deploy_image "$(normalize_image "$arg")"
    ;;
  v*|[0-9]*)
    deploy_image "$(normalize_image "$command")"
    ;;
  *)
    usage
    exit 1
    ;;
esac
