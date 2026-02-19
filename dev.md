# ZynqCloud Local Development

## Prerequisites

- Node.js `>=20`
- `pnpm >=9`
- Docker + Docker Compose

## Install dependencies

```bash
corepack enable
pnpm install
```

## Run in local dev mode (recommended)

```bash
pnpm dev
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/v1`

## Run local dev with Docker

```bash
pnpm docker:dev
```

Stop:

```bash
pnpm docker:down
```

## Run production with Docker

```bash
cp .env.example .env
pnpm docker:prod
```

Logs:

```bash
docker compose --env-file .env logs -f zynqcloud migrate postgres
```

## Build for production

```bash
pnpm build
```

## Build specific apps

```bash
pnpm --filter @zynqcloud/server build
pnpm --filter @zynqcloud/client build
```

## Build Docker image locally

```bash
docker build -t zynqcloud:local .
ZYNQCLOUD_IMAGE=zynqcloud:local docker compose up -d
```

## Run built app locally (server)

```bash
pnpm --filter @zynqcloud/server start:prod
```
