# ── Stage 1: Build Go Backend ────────────────────────────────
FROM golang:1.25-alpine AS backend-builder
WORKDIR /build
COPY apps/server/go.mod apps/server/go.sum ./
RUN go mod download
COPY apps/server/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api

# ── Stage 2: Build Frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION
ENV VITE_API_URL=/api/v1
COPY apps/client/package*.json ./
RUN npm install --legacy-peer-deps
COPY apps/client/ .
RUN npm run build

# ── Stage 3: Production Image ────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache nginx supervisor curl wget ca-certificates

# Create app user
RUN addgroup -S app && adduser -S app -G app

# ── Backend setup ────────────────────────────────────────────
COPY --from=backend-builder /bin/api /app/api

# ── Frontend setup (Vite static build) ──────────────────────
COPY --from=frontend-builder /build/dist /app/client/build

# ── Config files ─────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf

# Create required directories
RUN mkdir -p /var/log/nginx /tmp/nginx_client_body /tmp/nginx_proxy \
    /tmp/nginx_fastcgi /tmp/nginx_uwsgi /tmp/nginx_scgi \
    /data/files /var/log \
    && chmod +x /app/api \
    && chown -R app:app /app /data/files /var/log/nginx \
        /tmp/nginx_client_body /tmp/nginx_proxy /tmp/nginx_fastcgi \
        /tmp/nginx_uwsgi /tmp/nginx_scgi

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
