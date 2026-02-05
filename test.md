# CI Check Commands

Run these commands locally before pushing to verify all CI checks pass.

## Backend (apps/server)

```bash
cd apps/server

# Lint check
npm run lint

# Run tests (75 tests)
npm run test

# TypeScript build
npm run build
```

## Frontend (apps/client)

```bash
cd apps/client

# ESLint + Next.js lint
npm run lint

# Production build
npm run build
```

## Docker Build (optional)

```bash
# From project root
docker compose build
```

## Run All Checks (One Command)

```bash
cd "/Users/dinesh/DINE/selfhost app/zynq" && \
  (cd apps/server && npm run lint && npm run test && npm run build) && \
  (cd apps/client && npm run lint && npm run build)
```

## Run All Checks (With Labels)

```bash
cd "/Users/dinesh/DINE/selfhost app/zynq"

echo "=== Backend Lint ===" && cd apps/server && npm run lint && \
echo "=== Backend Tests ===" && npm run test && \
echo "=== Backend Build ===" && npm run build && \
cd ../client && \
echo "=== Frontend Lint ===" && npm run lint && \
echo "=== Frontend Build ===" && npm run build && \
echo "=== All CI checks passed ==="
```

## CI Pipeline Order

1. `backend-lint` - ESLint on server code
2. `backend-test` - Jest unit tests (75 tests)
3. `frontend-lint` - Next.js lint on client code
4. `frontend-build` - Next.js production build
