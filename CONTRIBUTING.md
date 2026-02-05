# Contributing

Thanks for your interest in contributing to zynqCloud!

## Getting Started

```bash
git clone https://github.com/your-username/zynq.git
cd zynq

# Start services
docker compose up -d postgres

# Backend
cd apps/server
cp .env.example .env
npm install
npm run start:dev

# Frontend (new terminal)
cd apps/client
npm install
npm run dev
```

## Before Submitting

Run these checks locally:

```bash
# Backend
cd apps/server
npm run lint
npm run test

# Frontend
cd apps/client
npm run lint
npm run build
```

## Pull Request Process

1. Fork and create a feature branch
2. Make changes, add tests if needed
3. Run lint and tests
4. Submit PR with clear description

## Commit Messages

Use conventional commits:

```
feat: add file preview
fix: resolve upload timeout
docs: update readme
```

## Code Style

- TypeScript strict mode
- Avoid `any` types
- Keep functions small
- Use existing patterns in codebase

## Questions?

Open an issue or discussion on GitHub.
