# Docker Hub Setup Guide

This guide walks you through pushing the zynqCloud Docker image to Docker Hub automatically via GitHub Actions.

## Prerequisites

- A GitHub repository with the zynqCloud codebase
- The release workflow at `.github/workflows/release.yml` (already included)

## Step 1: Create a Docker Hub Account

1. Go to [hub.docker.com](https://hub.docker.com)
2. Click **Sign Up** and create your account
3. Verify your email address

## Step 2: Create an Access Token

Docker Hub access tokens are more secure than using your password directly.

1. Log in to [Docker Hub](https://hub.docker.com)
2. Click your profile icon (top right) → **Account Settings**
3. Go to **Security** → **Access Tokens**
4. Click **New Access Token**
5. Give it a description (e.g., `zynqcloud-github-actions`)
6. Set permissions to **Read & Write**
7. Click **Generate**
8. **Copy the token immediately** — you won't be able to see it again

## Step 3: Add GitHub Repository Secrets

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

| Secret Name          | Value                        |
| -------------------- | ---------------------------- |
| `DOCKERHUB_USERNAME` | Your Docker Hub username     |
| `DOCKERHUB_TOKEN`    | The access token from Step 2 |

## Step 4: Test Locally Before Pushing

Always test your Docker image locally before pushing to production:

```bash
# Build the image locally
docker build -t yourusername/zynqcloud:test .

# Prepare environment
cp .env.example .env

# Use the locally built image for a test run
sed -i.bak 's|^ZYNQCLOUD_IMAGE=.*|ZYNQCLOUD_IMAGE=yourusername/zynqcloud:test|' .env

# Start all services
docker compose up -d

# Check container status
docker compose ps

# Test the health endpoint
curl http://localhost:3000/health

# Open in browser
open http://localhost:3000

# Check logs if something is wrong
docker compose logs -f

# Stop when done testing
docker compose down
rm -f .env.bak
```

## Step 5: Push a Release

The release workflow triggers automatically when you push a version tag:

```bash
# Make sure all changes are committed
git status

# Create a version tag
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

This will automatically:

1. Build the zynqCloud Docker image (frontend + backend combined)
2. Push to Docker Hub as `yourusername/zynqcloud:latest` and `yourusername/zynqcloud:1.0.0`
3. Create a GitHub Release with auto-generated release notes and source code
4. Attach `docker-compose.yml` and `install.sh` as release assets
5. Include `.env.example` for self-host users

On deployment, the one-shot `migrate` service in `docker-compose.yml` runs schema migrations before the app starts.

## Step 6: Verify

After the workflow completes (usually 3-5 minutes):

1. **GitHub Actions**: Go to your repo → **Actions** tab → check the "Release" workflow run
2. **Docker Hub**: Go to [hub.docker.com](https://hub.docker.com) and check for `yourusername/zynqcloud`
3. **Pull test**:
   ```bash
   docker pull yourusername/zynqcloud:latest
   ```

## How Users Install

Once your image is on Docker Hub, users can install zynqCloud with:

```bash
curl -fsSL https://raw.githubusercontent.com/DineshMN1/zynq/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/DineshMN1/zynq.git
cd zynq
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3000` and create your admin account.

## Updating Images

To release a new version:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Users update with:

```bash
docker compose pull
docker compose up -d
```

## Troubleshooting

**Workflow fails with "unauthorized"**

- Double-check that `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are set correctly in GitHub Secrets
- Ensure the access token has Read & Write permissions

**Image not appearing on Docker Hub**

- Check the Actions tab for error logs
- Verify your Docker Hub username matches the `DOCKERHUB_USERNAME` secret exactly (case-sensitive)

**Tag already exists**

- You cannot reuse a tag. Either delete the existing tag or use a new version number:
  ```bash
  git tag -d v1.0.0                    # delete local tag
  git push origin :refs/tags/v1.0.0    # delete remote tag
  git tag v1.0.0                       # re-create
  git push origin v1.0.0              # push again
  ```

**Container starts but app doesn't load**

- Check logs: `docker compose logs zynqcloud`
- Verify all env vars are set: `docker compose config`
- Check health: `curl http://localhost:3000/health`
