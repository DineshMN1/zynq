
# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Accept version as build arg, default to dev
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build


# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app

# Accept version as build arg, default to dev
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Switch to non-root user
RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
