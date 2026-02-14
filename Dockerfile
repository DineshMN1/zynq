# ============================================================
# zynqCloud — Single Combined Image
# Builds both frontend (Next.js) and backend (NestJS) into
# one image with Nginx reverse proxy and Supervisord.
# ============================================================

# ── Stage 1: Build Backend ──────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build
COPY apps/server/package*.json ./
RUN npm ci
COPY apps/server/ .
RUN npm run build

# ── Stage 2: Build Frontend ─────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY apps/client/package*.json ./
RUN npm install --legacy-peer-deps
COPY apps/client/ .
ENV NEXT_PUBLIC_API_URL=/api/v1
RUN npm run build

# ── Stage 3: Production Image ──────────────────────────────
FROM node:20-alpine

# Install nginx, supervisord, and curl (for health checks)
RUN apk add --no-cache nginx supervisor curl

# Create app user
RUN addgroup -S app && adduser -S app -G app

# ── Backend setup ───────────────────────────────────────────
WORKDIR /app/server
COPY apps/server/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /build/dist ./dist

# ── Frontend setup (standalone mode) ────────────────────────
WORKDIR /app/client
COPY --from=frontend-builder /build/.next/standalone ./build/
COPY --from=frontend-builder /build/.next/static ./build/build/.next/static
COPY --from=frontend-builder /build/public ./build/build/public

# ── Config files ────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf

# Create required directories
RUN mkdir -p /var/log/nginx /tmp/nginx_client_body /tmp/nginx_proxy \
    /tmp/nginx_fastcgi /tmp/nginx_uwsgi /tmp/nginx_scgi \
    /data/files /var/log \
    && chown -R app:app /app /data/files /var/log/nginx /tmp

# Expose single port
EXPOSE 80

# Health check via nginx → backend
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
