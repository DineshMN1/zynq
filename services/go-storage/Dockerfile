# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM golang:1.25.8-alpine AS builder

# TARGETARCH/TARGETOS are set automatically by `docker buildx build --platform`.
ARG TARGETOS=linux
ARG TARGETARCH=amd64

WORKDIR /build

# No external dependencies — go mod tidy generates an empty go.sum.
COPY go.mod ./
RUN go mod tidy

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-s -w" -trimpath \
    -o /bin/storage-service ./cmd/server

# ── Stage 2: minimal runtime ─────────────────────────────────────────────────
FROM alpine:3.19

# Non-root user for least-privilege operation.
RUN addgroup -S storage && adduser -S storage -G storage

WORKDIR /app

COPY --from=builder /bin/storage-service ./storage-service

# Data directory — override with a named volume in compose.
RUN mkdir -p /data/files && chown -R storage:storage /data/files

USER storage

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1

ENTRYPOINT ["./storage-service"]
