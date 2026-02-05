# Local CI Build Checks

Run these commands **before pushing** to ensure the GitHub CI pipeline will pass. The steps below mirror the exact jobs in `.github/workflows/ci.yml`.

## Prerequisites

- Node.js 20+
- Docker (for docker build check)

---

## Job 1: Backend Lint & Test

```bash
cd apps/server
npm ci
npm run lint
npm run test
```

## Job 2: Frontend Lint & Build

```bash
cd apps/client
npm ci --legacy-peer-deps
npm run lint
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run build
```

## Job 3: Docker Build

Runs only after Job 1 and Job 2 pass.

```bash
docker build -t zynqcloud-backend ./apps/server
docker build -t zynqcloud-frontend ./apps/client
```

---

## Quick Run (All Jobs)

Copy-paste this from the project root to run everything sequentially:

```bash
# Job 1 — Backend
cd apps/server && npm ci && npm run lint && npm run test && cd ../..

# Job 2 — Frontend
cd apps/client && npm ci --legacy-peer-deps && npm run lint && NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run build && cd ../..

# Job 3 — Docker
docker build -t zynqcloud-backend ./apps/server
docker build -t zynqcloud-frontend ./apps/client
```

## What Each Step Checks

| Step | What it verifies |
|---|---|
| `npm ci` | Clean install from lockfile (catches dependency issues) |
| `npm run lint` | ESLint — no code style or unused import errors |
| `npm run test` | Jest — all 75 unit tests pass |
| `npm run build` | TypeScript compiles, Next.js pages build successfully |
| `docker build` | Dockerfile builds end-to-end (install, compile, package) |

> If all steps pass locally, your PR will pass CI.
