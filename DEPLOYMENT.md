# Deployment Guide

This document covers the full **local-dev → GitHub → EC2** workflow for the Company Intel Bot.

---

## Overview

```
Your Windows machine  (D:\CSLAI)
       │
       │  git push origin main
       ▼
GitHub  (https://github.com/nobledev89/cslai)
       │
       │  SSH into EC2, then: make deploy
       ▼
AWS EC2  (18.175.106.89)  →  https://cslai.corporatespec.com
```

Development happens **locally on Windows** (`D:\CSLAI`).  
The live EC2 instance only pulls from GitHub — it never receives files directly.

---

## Part 1 — One-time Local Setup (Windows)

### 1.1 Prerequisites (Windows)

| Tool | Install |
|------|---------|
| Git | https://git-scm.com/download/win |
| Node.js ≥ 20 | https://nodejs.org/ |
| pnpm ≥ 9 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Desktop | https://www.docker.com/products/docker-desktop/ (for local Postgres + Redis) |
| VS Code | https://code.visualstudio.com/ |
| SSH key pair | See §1.3 |

### 1.2 Clone the repository

Open **PowerShell** or **Git Bash**:

```powershell
git clone https://github.com/nobledev89/cslai.git D:\CSLAI
cd D:\CSLAI
pnpm install
```

### 1.3 Configure SSH access to EC2

If you do not already have an SSH key registered with the EC2 instance, create one and add the public key to the server:

```powershell
# Generate key (skip if you already have one)
ssh-keygen -t ed25519 -C "your-email@example.com"
# Default location: C:\Users\<you>\.ssh\id_ed25519

# Copy public key to EC2 (run once)
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@18.175.106.89 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Test the connection:

```powershell
ssh ubuntu@18.175.106.89
```

### 1.4 Local environment file

```powershell
copy .env.example .env
# Open .env in VS Code and fill in real values
code .env
```

Key secrets to generate:

```powershell
# ENCRYPTION_KEY (32 bytes → 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT secrets (64 bytes → 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 1.5 Start local services

```powershell
# Start Postgres + Redis (Docker Desktop must be running)
make docker-dev

# Apply migrations and seed the database
make migrate
make seed

# Start all services in watch/dev mode
make dev
# Web  →  http://localhost:3000
# API  →  http://localhost:3001
```

---

## Part 2 — Day-to-day Development Workflow

### 2.1 Make your changes locally

Edit files inside `D:\CSLAI` with VS Code (or any editor).  
All services hot-reload automatically when running `make dev`.

### 2.2 Update README.md (when applicable)

Whenever you add a feature, change an API endpoint, add an environment variable, or alter the architecture, update `README.md` accordingly:

```
Sections most likely to need updating
──────────────────────────────────────
Architecture diagram       → top of README
Tech Stack table           → if a new library is added
Repository Layout          → if a new app/package is added
Environment Variables      → if a new variable is introduced
API Reference              → if endpoints change
Production Deployment      → if the deploy process changes
```

### 2.3 Commit and push to main

```powershell
cd D:\CSLAI

# Stage all changes (or be selective)
git add .

# Write a clear commit message — use conventional commits style:
#   feat:   a new feature
#   fix:    a bug fix
#   docs:   documentation only
#   chore:  tooling / config changes
#   refactor: code refactoring
git commit -m "feat: describe what you changed"

# Push to GitHub
git push origin main
```

> **Tip:** Before pushing, verify nothing is broken:
> ```powershell
> pnpm turbo run build
> pnpm turbo run lint
> ```

---

## Part 3 — Deploy to EC2

### 3.1 SSH into the server

```powershell
ssh ubuntu@18.175.106.89
```

### 3.2 Run the deployment command

```bash
cd /home/ubuntu/cslai
make deploy
```

`make deploy` does the following in one shot:

| Step | Command |
|------|---------|
| 1 | `git pull origin main` — fetch latest code |
| 2 | `pnpm install --frozen-lockfile` — install/update deps |
| 3 | `pnpm turbo run build` — build all apps |
| 4 | `make migrate` — apply any pending DB migrations |
| 5 | Copy Next.js static assets into standalone output |
| 6 | `sudo cp infra/Caddyfile /etc/caddy/Caddyfile` — update Caddy config |
| 7 | `sudo systemctl reload caddy` — reload Caddy |
| 8 | `pm2 restart all --update-env` — reload processes |
| 9 | `pm2 save` — persist process list |

### 3.3 Verify the deployment

```bash
# Check PM2 processes are running
pm2 status

# Tail logs to confirm no startup errors
pm2 logs --lines 50

# Quick health check
curl -s https://api.cslai.corporatespec.com/health
```

Open the live site: **https://cslai.corporatespec.com**

### 3.4 Rollback (if needed)

```bash
cd /home/ubuntu/cslai

# Find the last good commit
git log --oneline -10

# Roll back to it
git reset --hard <commit-hash>

# Rebuild and restart
pnpm install --frozen-lockfile
pnpm turbo run build
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
pm2 restart all --update-env && pm2 save
```

---

## Part 4 — Updating `ecosystem.config.js` Secrets

If you need to rotate secrets (JWT keys, ENCRYPTION_KEY, API keys):

1. **Edit `ecosystem.config.js`** on the EC2 server directly (never commit real secrets to git):
   ```bash
   nano /home/ubuntu/cslai/ecosystem.config.js
   ```

2. Restart PM2 so it picks up the new env vars:
   ```bash
   pm2 restart all --update-env && pm2 save
   ```

> ⚠️ `ENCRYPTION_KEY` rotation will invalidate all stored integration credentials and LLM API keys in the database. Re-enter them via the Settings page after rotating.

---

## Part 5 — Database Migrations

### Create a new migration (locally)

```powershell
cd D:\CSLAI
pnpm --filter @company-intel/db exec prisma migrate dev --name describe_change
```

This creates a new migration file under `packages/db/prisma/migrations/`.  
**Commit and push it** — `make deploy` on EC2 will apply it automatically.

### Apply migrations manually on EC2

```bash
cd /home/ubuntu/cslai
make migrate
```

---

## Part 6 — Quick Reference Cheat Sheet

```
LOCAL (D:\CSLAI)
─────────────────────────────────────────────────────
make dev              Start all services in watch mode
make docker-dev       Start Postgres + Redis
make migrate-dev      Create + apply a new migration
make build            Build everything (pre-push check)
make lint             Run ESLint
make type-check       Run TypeScript type checker

GIT
─────────────────────────────────────────────────────
git add .             Stage all changes
git commit -m "..."   Commit
git push origin main  Push to GitHub

EC2 (ssh ubuntu@18.175.106.89)
─────────────────────────────────────────────────────
make deploy           Full deploy (pull+build+migrate+restart)
pm2 status            Check process health
pm2 logs              Tail all logs
make backup           Dump Postgres to ./backups/
```

---

## Appendix — EC2 Server Details

| Item | Value |
|------|-------|
| IP | `18.175.106.89` |
| SSH user | `ubuntu` |
| Repo path | `/home/ubuntu/cslai` |
| Live URL | https://cslai.corporatespec.com |
| API URL | https://api.cslai.corporatespec.com |
| Web port | `3000` |
| API port | `3001` |
| DB | PostgreSQL 16 on `localhost:5432` (Docker) |
| Cache | Redis 7 on `localhost:6379` (Docker) |
| Reverse proxy | Caddy 2 (systemd) |
| Process manager | PM2 |
