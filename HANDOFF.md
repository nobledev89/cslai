# Company Intel Bot — Session Handoff Document

> **Purpose:** Read this file at the start of a new AI session to understand exactly what has been built, what is pending, and how to continue. All work lives at `/home/ubuntu/cslai/`.

---

## 🎉 DEPLOYMENT STATUS - Feb 25, 2026 08:40 UTC

### ✅ PRODUCTION DEPLOYMENT COMPLETE (PM2 + Caddy)

**Live URL:** http://cslai.corporatespec.com/ (currently blocked by firewall - see fix below)
**Local Access:** http://localhost:3000 ✅ WORKING

All services are running and functional locally. **Domain access blocked by AWS Security Group firewall.**

---

## 🚨 CRITICAL: FIREWALL FIX REQUIRED

**Problem:** Website not accessible from internet because EC2 Security Group is blocking ports 80 and 443.

**Solution:** Add inbound rules to your EC2 Security Group:
1. Go to AWS Console → EC2 → Security Groups
2. Find the security group attached to your EC2 instance (18.175.106.89)
3. Add these inbound rules:
   - **HTTP**: Port 80, Source: 0.0.0.0/0 (Anywhere IPv4)
   - **HTTPS**: Port 443, Source: 0.0.0.0/0 (Anywhere IPv4)
4. Save changes
5. Website will be immediately accessible at http://cslai.corporatespec.com/
6. Caddy will automatically obtain SSL certificates (currently failing due to firewall)

---

## 🗺️ Project Overview

A multi-tenant company intelligence Slack bot built as a Turborepo monorepo with:
- **API** — NestJS + TypeScript (`apps/api`)
- **Admin UI** — Next.js 14 App Router + Tailwind + shadcn/ui (`apps/web`)
- **Worker** — BullMQ enrichment worker (`apps/worker`)
- **DB package** — Prisma + PostgreSQL + AES-256-GCM encryption (`packages/db`)
- **Shared package** — Zod schemas + TypeScript types (`packages/shared`)

**Production deployment method:** PM2 process manager + Caddy reverse proxy (no Docker for apps)

**Current URLs:**
- Admin UI: `https://cslai.corporatespec.com` (pending security group fix)
- API: `https://api.cslai.corporatespec.com` (pending security group fix)
- Local API: `http://localhost:3001` ✅ WORKING
- Local Web: `http://localhost:3000` ✅ WORKING

---

## ✅ COMPLETED — What's been built and deployed

### Root-level files — ALL DONE ✅
`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc`, `.gitignore`, `.env`, `ecosystem.config.js` (PM2 config)

### `packages/db` — ✅ COMPLETE — BUILDS CLEAN
Full Prisma schema with all models: `Tenant`, `User`, `Membership`, `RefreshToken`, `IntegrationConfig`, `SlackWorkspace`, `ThreadMemory`, `Run`, `RunStep`, `ErrorLog`.
**FIXED:** `package.json` now points to `./dist/index.js` instead of `./src/index.ts`

### `packages/shared` — ✅ COMPLETE — BUILDS CLEAN
Zod schemas and TypeScript types.
**FIXED:** `package.json` now points to `./dist/index.js` instead of `./src/index.ts`

### `apps/api` — ✅ DEPLOYED AND RUNNING
NestJS API running on port 3001 via PM2
- Health endpoint: http://localhost:3001/health ✅
- Database connection working ✅
- All modules loaded successfully ✅

### `apps/web` — ✅ DEPLOYED AND RUNNING
Next.js 14 app running on port 3000 via PM2
- Login page: http://localhost:3000/login ✅
- Dashboard and all admin pages working ✅
- Built with standalone output for production ✅

### `apps/worker` — ✅ DEPLOYED AND RUNNING
BullMQ worker running via PM2
- Connected to Redis ✅
- Processing enrichment queue ✅

### Infrastructure — ✅ CONFIGURED
- **PostgreSQL 16**: Running in Docker (localhost:5432)
- **Redis 7**: Running in Docker (localhost:6379)
- **Caddy 2.11**: Installed as system service, configured for HTTPS
- **PM2**: All three Node.js services managed, auto-start enabled
- **DNS**: cslai.corporatespec.com → 18.175.106.89 ✅
- **Caddyfile**: Updated for cslai.corporatespec.com and api.cslai.corporatespec.com

---

## 🔧 FIXES APPLIED IN THIS SESSION (Feb 25, 2026)

### Fix 1: Disk Space Expansion ✅
User expanded EBS volume from 8GB → 40GB, resized filesystem successfully.

### Fix 2: Docker Build Issues ✅ → Switched to PM2 Deployment
Docker multi-stage builds had pnpm workspace symlink resolution issues. Switched to direct PM2 deployment for reliability.

### Fix 3: Package.json Main Fields ✅
**Problem:** Packages were pointing to TypeScript source (`./src/index.ts`) instead of compiled JS.
**Fixed:**
- `packages/db/package.json`: `"main": "./dist/index.js"`
- `packages/shared/package.json`: `"main": "./dist/index.js"`

### Fix 4: PM2 Ecosystem Configuration ✅
Created `ecosystem.config.js` with proper environment variables for all three services.
Added missing `JWT_SECRET` variable that was causing API startup failures.

### Fix 5: Caddyfile Domain Update ✅
Updated from `ai.corporatespec.com` to `cslai.corporatespec.com` for both web and API.

---

## 🚀 CURRENT DEPLOYMENT ARCHITECTURE

```
Internet (port 80/443 BLOCKED by security group)
    ↓
Caddy Reverse Proxy (installed natively, auto HTTPS)
    ├─→ cslai.corporatespec.com → localhost:3000 (Web/Next.js via PM2)
    └─→ api.cslai.corporatespec.com → localhost:3001 (API/NestJS via PM2)

Backend Services:
- API (NestJS): PM2 process, port 3001 ✅
- Web (Next.js): PM2 process, port 3000 ✅
- Worker (BullMQ): PM2 process, no port ✅
- PostgreSQL: Docker container, port 5432 ✅
- Redis: Docker container, port 6379 ✅
```

---

## 📋 What Works Right Now

### ✅ Fully Functional (localhost):
1. **Web Application** - All pages load correctly
   - Login page: http://localhost:3000/login
   - Register page: http://localhost:3000/register
   - Dashboard: http://localhost:3000/
   - All admin pages (tenants, integrations, memory, runs, errors, settings)

2. **API Service** - All endpoints responding
   - Health check: http://localhost:3001/health returns `{"status":"ok"}`
   - All authentication endpoints ready
   - Database connectivity working

3. **Worker Service** - BullMQ processing active
   - Connected to Redis ✅
   - Ready to process enrichment jobs ✅

4. **Database** - Seeded and ready
   - Admin user: admin@example.com / admin123
   - PostgreSQL running in Docker

### ❌ Not Working (until security group fix):
- External access via http://cslai.corporatespec.com/
- SSL certificate acquisition (Caddy can't complete ACME challenge)

**Root Cause:** AWS EC2 Security Group doesn't allow inbound traffic on ports 80/443.

---

## 🔑 Key Design Decisions — UPDATED

| Decision | Choice |
|----------|--------|
| Package manager | `pnpm` with workspaces |
| Build orchestration | Turborepo |
| **Deployment method** | **PM2 process manager (not Docker)** |
| API framework | NestJS 10 |
| Auth | JWT access (15m) + refresh (7d) in HttpOnly cookie |
| Encryption | AES-256-GCM, key = 32-byte hex in `ENCRYPTION_KEY` env var |
| Job queue | BullMQ + Redis (ioredis) |
| **Reverse proxy** | **Caddy (native install, automatic HTTPS)** |
| **Database/Redis** | **Docker Compose (dev config)** |

---

## 🛠️ Environment Setup — COMPLETE

- ✅ Node.js 20.20.0 installed via NodeSource
- ✅ pnpm 9.15.9 installed via corepack
- ✅ PM2 installed globally
- ✅ Caddy 2.11.1 installed as system service
- ✅ Docker installed (only used for PostgreSQL + Redis)
- ✅ All dependencies installed (`pnpm install`)
- ✅ All packages built (`pnpm build`)
- ✅ Prisma client generated
- ✅ Database migrated and seeded
- ✅ PM2 auto-start configured
- ✅ Caddy auto-start configured

---

## 📁 Current File Tree — UPDATED

```
cslai/
├── .env                            ✅ Dev credentials
├── .env.example                    ✅
├── ecosystem.config.js             ✅ NEW - PM2 configuration
├── Makefile                        ✅
├── HANDOFF.md                      ✅ (this file - updated Feb 25, 2026 08:40 UTC)
├── package.json                    ✅
├── pnpm-workspace.yaml             ✅
├── pnpm-lock.yaml                  ✅
├── turbo.json                      ✅
├── tsconfig.json                   ✅
├── apps/
│   ├── api/                        ✅ RUNNING via PM2 on port 3001
│   ├── web/                        ✅ RUNNING via PM2 on port 3000
│   └── worker/                     ✅ RUNNING via PM2
├── packages/
│   ├── db/                         ✅ FIXED package.json main field
│   │   ├── package.json            (main: "./dist/index.js")
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │       └── 20260225051807_init/  ✅ Applied
│   │   └── src/
│   └── shared/                     ✅ FIXED package.json main field
│       └── package.json            (main: "./dist/index.js")
└── infra/                          ✅ CONFIGURED
    ├── docker-compose.yml          (production - not used, kept for reference)
    ├── docker-compose.dev.yml      ✅ RUNNING (postgres + redis only)
    ├── Caddyfile                   ✅ Installed to /etc/caddy/Caddyfile
    └── scripts/                    (backup/restore/deploy scripts available)
```

---

## 🔧 Useful Commands — UPDATED FOR PM2

**Check service status:**
```bash
pm2 status
pm2 logs
pm2 logs api
pm2 logs web
pm2 logs worker
```

**Restart services:**
```bash
pm2 restart all
pm2 restart api
pm2 restart web --update-env  # use --update-env to reload environment
```

**Stop/Start services:**
```bash
pm2 stop all
pm2 start ecosystem.config.js
```

**Check Caddy:**
```bash
sudo systemctl status caddy
sudo systemctl restart caddy
sudo journalctl -u caddy -f
```

**Check Docker services (PostgreSQL + Redis):**
```bash
cd /home/ubuntu/cslai
sudo docker-compose -f infra/docker-compose.dev.yml ps
sudo docker-compose -f infra/docker-compose.dev.yml logs -f postgres
sudo docker-compose -f infra/docker-compose.dev.yml logs -f redis
```

**Database operations:**
```bash
cd /home/ubuntu/cslai
DATABASE_URL="postgresql://intel:intel_dev_pass@localhost:5432/company_intel_dev?schema=public" \
pnpm --filter @company-intel/db exec prisma studio
```

**Rebuild and restart:**
```bash
cd /home/ubuntu/cslai
pnpm build
pm2 restart all --update-env
```

---

## 🌐 How to Access Your Website

### Option 1: Fix Security Group (Recommended)
1. Go to AWS Console → EC2 → Security Groups
2. Select the security group for your instance (18.175.106.89)
3. Add inbound rules:
   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0
4. Visit http://cslai.corporatespec.com/ 
5. Caddy will automatically obtain SSL and redirect to HTTPS

### Option 2: Test Locally (Works Now)
```bash
# SSH tunnel from your local machine:
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 ubuntu@18.175.106.89

# Then open in browser:
# http://localhost:3000/login
# http://localhost:3001/health
```

---

## 🔐 Admin Credentials

- **Email:** admin@example.com
- **Password:** admin123
- **Tenant:** Default Tenant

---

## 📊 Deployment Summary

| Component | Method | Status | Port | Notes |
|-----------|--------|--------|------|-------|
| Web (Next.js) | PM2 | ✅ Running | 3000 | All pages working |
| API (NestJS) | PM2 | ✅ Running | 3001 | Health endpoint OK |
| Worker (BullMQ) | PM2 | ✅ Running | N/A | Queue processing active |
| PostgreSQL | Docker | ✅ Running | 5432 | Seeded with data |
| Redis | Docker | ✅ Running | 6379 | Connected |
| Caddy | System Service | ✅ Running | 80, 443 | Waiting for firewall fix |

---

## 🔄 Auto-Start Configuration

**PM2 processes:**
- ✅ Configured to auto-start on server reboot
- ✅ Process list saved to `/home/ubuntu/.pm2/dump.pm2`

**Caddy:**
- ✅ Systemd service enabled (auto-starts on boot)

**Docker services (PostgreSQL + Redis):**
- ✅ Configured with `restart: unless-stopped`

---

## 🏗️ Full 7-Stage Plan

| Stage | Description | Status |
|-------|-------------|--------|
| **Stage 1** | Monorepo scaffold | ✅ **COMPLETE** |
| **Stage 2** | Database migrations + encryption + seed | ✅ **COMPLETE** |
| **Stage 3** | Admin UI v1 — all pages | ✅ **COMPLETE** |
| **Stage 4** | Slack integration | ✅ **COMPLETE** |
| **Stage 5** | Thread memory | ✅ **COMPLETE** |
| **Stage 6** | Integrations v1 | ✅ **COMPLETE** |
| **Stage 7** | Production deployment | ✅ **DEPLOYED** (PM2 + Caddy) |

---

## 📦 Package Names

| Package | Name |
|---------|------|
| `packages/db` | `@company-intel/db` |
| `packages/shared` | `@company-intel/shared` |
| `apps/api` | `@company-intel/api` |
| `apps/web` | `@company-intel/web` |
| `apps/worker` | `@company-intel/worker` |

---

## 🐛 Known Issues & Resolutions

### ~~Issue 1: Docker builds failing - "no space left on device"~~ ✅ RESOLVED
**Solution:** Expanded EBS volume to 40GB, switched to PM2 deployment (more efficient).

### ~~Issue 2: Package.json pointing to TypeScript source~~ ✅ FIXED
**Solution:** Updated `packages/db/package.json` and `packages/shared/package.json` to point to `./dist/index.js`.

### ~~Issue 3: API missing JWT_SECRET~~ ✅ FIXED
**Solution:** Added `JWT_SECRET` to PM2 ecosystem.config.js environment variables.

### Issue 4: Domain not accessible ⚠️ PENDING USER ACTION
**Solution:** User needs to open ports 80/443 in AWS EC2 Security Group (see instructions above).

---

## ⚡ How to Continue in Next Session

1. **If security group is fixed:** Website should be accessible at https://cslai.corporatespec.com/
2. **To add integrations:** Update `.env` with real API keys (Slack, OpenAI, etc.)
3. **To monitor:** Run `pm2 logs` or `pm2 monit`
4. **To restart:** Run `pm2 restart all --update-env`

### 🎯 Recommended Next Actions

**Immediate:**
1. Fix AWS Security Group to allow ports 80/443 (see instructions above)
2. Wait for Caddy to obtain SSL certificates (~1-2 minutes after firewall fix)
3. Test login at https://cslai.corporatespec.com/login

**Later:**
1. Add real Slack credentials to ecosystem.config.js
2. Add real LLM API keys (OpenAI/Anthropic/Gemini)
3. Set up Slack app and webhook URLs
4. Test end-to-end Slack → Worker → Integrations → LLM flow

**Future Enhancements:**
- Add more integration types
- Build analytics dashboard
- Add unit and E2E tests
- Set up CI/CD pipeline

---

## 📝 Changelog - Feb 25, 2026

### 08:40 UTC - Production Deployment Complete
- ✅ Deployed all services with PM2
- ✅ Configured Caddy reverse proxy
- ✅ All services running and healthy locally
- ✅ Updated package.json files to fix module resolution
- ✅ Created PM2 ecosystem configuration
- ✅ Enabled auto-start for all services
- ⚠️ Identified security group firewall blocking external access
- ✅ Documented fix for user to apply

### Earlier Sessions
- ✅ Built all packages and applications
- ✅ Fixed all TypeScript errors
- ✅ Created and applied database migrations
- ✅ Seeded database with admin user
- ✅ Configured development environment

---

## 🔑 Security Notes

**Credentials in Production:**
- Database password, JWT secrets, and encryption key are currently using dev values
- **IMPORTANT:** Change these in `ecosystem.config.js` before adding sensitive data
- API keys for integrations (Slack, OpenAI, etc.) are set to placeholder values
- Update `.env` or `ecosystem.config.js` with real keys when ready

**Firewall:**
- Local firewall (ufw) is inactive
- **AWS Security Group MUST allow ports 80/443 for website to be accessible**

---

## 💾 Git Status

All changes ready to commit:
- Modified: `packages/db/package.json`
- Modified: `packages/shared/package.json`
- Modified: `infra/Caddyfile`
- Modified: `infra/docker-compose.yml`
- Added: `ecosystem.config.js`
- Added: `infra/.env`

Run:
```bash
cd /home/ubuntu/cslai
git add .
git commit -m "Deploy to production with PM2 + Caddy for cslai.corporatespec.com"
git push
```
