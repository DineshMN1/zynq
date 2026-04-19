# Contributing to ZynqCloud

Thanks for your interest in contributing!

---

## Development Setup

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq

# Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Backend (Go 1.21+)
cd server
cp .env.dev.example .env.dev
go run ./cmd/api

# Frontend (new terminal, Node 20+, pnpm 9+)
cd web
pnpm install
pnpm dev
```

Frontend runs at `http://localhost:5173`, API at `http://localhost:4000`.

---

## Before Submitting

```bash
# Backend
cd server
go build ./...
go test ./...
go vet ./...

# Frontend
cd web
pnpm run lint
pnpm run build
```

All checks must pass. PRs with failing builds will not be merged.

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add file preview for PDF
fix: return 507 when disk is full
docs: update reverse-proxy guide
test: add crypto stream round-trip test
refactor: consolidate formatBytes to lib/auth
```

---

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make focused changes — one concern per PR
3. Add or update tests for new behaviour
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Submit the PR with a clear description of what and why

---

## Code Style

**Go:**

- `gofmt` formatted (CI enforces this)
- No `panic` in request handlers — return errors and write HTTP responses
- New handlers follow the existing `struct + method` pattern in `server/internal/handlers/`

**TypeScript/React:**

- Strict mode — no `any`
- New shared utilities go in `web/src/lib/`; new shared components go in `web/src/components/`
- Use the existing `uploadManager` for file uploads, not raw XHR

---

## Questions?

Open an issue or a discussion on GitHub.
