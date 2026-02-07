FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:25-alpine
WORKDIR /app

# Install curl for health checks and debugging
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/main.js"]
