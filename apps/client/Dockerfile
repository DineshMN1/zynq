FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Switch to non-root user
RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["npm", "run", "start"]
