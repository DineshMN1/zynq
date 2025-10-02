# ---- Frontend (Next.js) ----
FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy app
COPY . .

# Build Next.js
RUN npm run build

# Run Next.js
EXPOSE 3000
CMD ["npm", "run", "start"]
