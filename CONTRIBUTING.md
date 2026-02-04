# Contributing to zynqCloud

Thank you for your interest in contributing to zynqCloud! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please be kind and constructive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:

1. **Clear title** - Summarize the issue
2. **Environment** - OS, Node.js version, browser (if applicable)
3. **Steps to reproduce** - Detailed steps to reproduce the issue
4. **Expected behavior** - What you expected to happen
5. **Actual behavior** - What actually happened
6. **Screenshots/Logs** - If applicable

### Suggesting Features

We welcome feature suggestions! Please:

1. Check existing issues and discussions first
2. Describe the problem your feature would solve
3. Explain your proposed solution
4. Consider alternatives you've thought about

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** of the project
3. **Write tests** for new functionality
4. **Update documentation** if needed
5. **Ensure all tests pass** before submitting
6. **Write a clear PR description** explaining your changes

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker and Docker Compose (optional but recommended)

### Local Development

#### Using Docker (Recommended)

```bash
# Clone your fork
git clone https://github.com/DineshMN1/zynq.git
cd zynq

# Start infrastructure services
docker-compose up -d postgres minio minio-init

# Install and run backend
cd apps/server
cp .env.example .env
npm install
npm run start:dev

# In another terminal, install and run frontend
cd apps/client
cp .env.local.example .env.local
npm install
npm run dev
```

#### Manual Setup

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for detailed instructions.

### Project Structure

```
zynq/
├── apps/
│   ├── client/        # Next.js frontend
│   └── server/        # NestJS backend
├── docs/              # Documentation
└── .github/           # GitHub templates and workflows
```

## Coding Guidelines

### General

- Write clear, self-documenting code
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments only when the code isn't self-explanatory

### TypeScript

- Use TypeScript strict mode
- Avoid `any` type when possible
- Define interfaces for complex objects
- Use proper error handling

### Frontend (Next.js)

- Follow Next.js App Router conventions
- Use React Server Components where appropriate
- Keep components small and reusable
- Use shadcn/ui components for consistency

```typescript
// Good
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <Card onClick={() => onSelect(user.id)}>
      <CardHeader>{user.name}</CardHeader>
    </Card>
  );
}
```

### Backend (NestJS)

- Follow NestJS module structure
- Use DTOs for request/response validation
- Implement proper error handling with NestJS exceptions
- Write unit tests for services

```typescript
// Good
@Injectable()
export class UsersService {
  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
```

### CSS/Styling

- Use Tailwind CSS utility classes
- Follow the existing color scheme
- Ensure responsive design
- Test in both light and dark modes

### Git Commits

Write clear, concise commit messages:

```
feat: add file sharing functionality
fix: resolve authentication token refresh issue
docs: update installation guide
refactor: simplify file upload logic
test: add unit tests for user service
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Running CI Checks Locally

Before submitting a PR, run these checks locally to ensure CI passes. All commands should be run from the project root.

### Quick Check (All at once)

```bash
# Backend: lint + tests
cd apps/server && npm run lint && npm run test

# Frontend: lint + build
cd apps/client && npm run lint && npm run build
```

### Step-by-Step

#### Backend

```bash
cd apps/server

# 1. Lint check (must pass with zero errors)
npm run lint

# 2. Run all unit tests
npm run test
```

#### Frontend

```bash
cd apps/client

# 1. Lint check (warnings are OK, errors are not)
npm run lint

# 2. Build check (must compile successfully)
npm run build
```

> **Note:** The CI pipeline runs these exact commands. If they pass locally, your PR should pass CI.

## Testing

### Running Tests

```bash
# Backend tests
cd apps/server
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run test:cov      # Coverage report
```

### Writing Tests

- Write unit tests for new functionality
- Aim for meaningful coverage, not just numbers
- Test edge cases and error conditions
- Mock external dependencies

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding guidelines
   - Add tests if applicable
   - Update documentation

3. **Test your changes** (see [Running CI Checks Locally](#running-ci-checks-locally))
   ```bash
   # Backend
   cd apps/server && npm run lint && npm run test

   # Frontend
   cd apps/client && npm run lint && npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Use a clear title and description
   - Reference any related issues
   - Request review from maintainers

### PR Review Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] New functionality has tests
- [ ] Documentation is updated
- [ ] No security vulnerabilities introduced
- [ ] No breaking changes (or clearly documented)

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/your-username/zynqcloud/discussions)
- **Bugs**: Open an [Issue](https://github.com/your-username/zynqcloud/issues)
- **Security**: Email security@example.com

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions

Thank you for contributing to zynqCloud!
