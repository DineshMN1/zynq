FROM golang:1.23-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /bin/api /app/api
RUN mkdir -p /data/files && chown -R app:app /data/files /app
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
CMD ["/app/api"]
