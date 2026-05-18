# ── Stage 1: Build Go backend ────────────────────────────────
FROM golang:1.25.9-alpine AS backend-builder
WORKDIR /build
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/api ./cmd/api

# ── Stage 2: Build React frontend ────────────────────────────
FROM node:25-alpine AS frontend-builder
WORKDIR /build
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION
ENV VITE_API_URL=/api/v1
RUN corepack enable
# Copy workspace config + lockfile first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile
COPY web/ ./web/
RUN pnpm --filter @zynqcloud/web build

# ── Stage 3: Production image ─────────────────────────────────
# Single Go binary serves both the API and the React SPA.
# No nginx, no supervisord — one process, one port.
FROM alpine:3.19

RUN apk add --no-cache ca-certificates curl wget su-exec && \
    addgroup -S app && adduser -S app -G app

# Go binary
COPY --from=backend-builder /bin/api /app/api
RUN chmod +x /app/api

# React SPA (served by Go's http.FileServer)
COPY --from=frontend-builder /build/web/dist /app/static

# File storage directory
RUN mkdir -p /data/files && chown -R app:app /app /data/files

# Entrypoint fixes bind-mount permissions then drops to app user
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/api/v1/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/app/api"]
