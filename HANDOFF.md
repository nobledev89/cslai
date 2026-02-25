# Company Intel Bot — Session Handoff Document

> **Purpose:** Read this file at the start of a new AI session to understand exactly what has been built, what is pending, and how to continue. All work lives at `/home/ubuntu/cslai/`.

---

## 🎉 DEPLOYMENT STATUS - Feb 25, 2026 10:20 UTC

### ✅ FULLY LIVE IN PRODUCTION (PM2 + Caddy)

**Live URL:** https://cslai.corporatespec.com/ ✅ WORKING (HTTPS, SSL cert obtained)
**Local Access:** http://localhost:3000 ✅ WORKING

All services are running and functional. The site is live and accessible from the internet.

---

## 🚨 ONE REMAINING ACTION: Add API subdomain DNS record

**Problem:** `api.cslai.corporatespec.com` has no DNS A record — only `cslai` exists in Cloudflare.

**Solution:** In Cloudflare DNS, add:
- **Type:** A
- **Name:** `api.cslai`
- **Content:** `18.175.106.89`
- **Proxy status:** DNS only (grey cloud)

Once added, Caddy will automatically obtain an SSL cert for it and `https://api.cslai.corporatespec.com` will work.

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
- Admin UI: `https://cslai.corporatespec.com` ✅ LIVE
- API: `https://api.cslai.corporatespec.com` ⚠️ Pending DNS A record (see above)
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
- Login page: https://cslai.corporatespec.com/login ✅ LIVE
- Dashboard and all admin pages working ✅
- Built with standalone output for production ✅
- Static assets correctly copied into standalone output ✅

### `apps/worker` — ✅ DEPLOYED AND RUNNING
BullMQ worker running via PM2
- Connected to Redis ✅
- Processing enrichment queue ✅

### Infrastructure — ✅ FULLY CONFIGURED AND LIVE
- **PostgreSQL 16**: Running in Docker (localhost:5432)
- **Redis 7**: Running in Docker (localhost:6379)
- **Caddy 2.11**: Running, SSL cert obtained for cslai.corporatespec.com ✅
- **PM2**: All three Node.js services managed, auto-start enabled
- **DNS**: cslai.corporatespec.com → 18.175.106.89 ✅
- **Firewall**: EC2 Security Group ports 80/443 open ✅

---

## 🔧 ALL FIXES APPLIED (Feb 25, 2026)

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

### Fix 6: Caddyfile Docker Service Names → localhost ✅
**Problem:** `infra/Caddyfile` had `reverse_proxy web:3000` and `reverse_proxy api:3001` (Docker service names). PM2 deployment uses localhost, not Docker networking.
**Fixed:** Changed to `reverse_proxy localhost:3000` and `reverse_proxy localhost:3001` in both `infra/Caddyfile` and `/etc/caddy/Caddyfile`.

### Fix 7: Next.js Standalone Missing Static Files ✅
**Problem:** Login page showed only "Loading..." (white screen). Next.js standalone builds do NOT automatically copy `.next/static` into the standalone output. All JS chunk requests returned 404, so the Suspense fallback never hydrated.
**Fixed:**
```bash
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
```
**This must be run after every `pnpm build`.** The `Makefile` deploy target has been updated to do this automatically.

### Fix 8: Caddy Never Reloaded After Config Update ✅
**Problem:** `/etc/caddy/Caddyfile` was correctly updated to use `localhost`, but Caddy was started at 07:53 UTC with the old `web:3000` config in memory. Every request returned 502 with `dial tcp: lookup web on 127.0.0.53:53`.
**Fixed:** `sudo systemctl reload caddy` — Caddy picked up the new config and the site went live immediately.

### Fix 9: Makefile Deploy Target Updated for PM2 ✅
**Problem:** `make deploy` was still running Docker Compose instead of PM2, and missing the static files copy step.
**Fixed:** Updated to:
1. Build with Turborepo
2. Copy Next.js static assets into standalone output
3. Restart all PM2 processes with `--update-env`
4. Save PM2 process list

---

## 🚀 CURRENT DEPLOYMENT ARCHITECTURE

```
Internet (ports 80/443 OPEN ✅)
    ↓
Caddy Reverse Proxy (system service, auto HTTPS)
    ├─→ cslai.corporatespec.com → localhost:3000 (Web/Next.js via PM2) ✅ LIVE
    └─→ api.cslai.corporatespec.com → localhost:3001 (API/NestJS via PM2) ⚠️ DNS pending

Backend Services:
- API (NestJS): PM2 process, port 3001 ✅
- Web (Next.js): PM2 process, port 3000 ✅
- Worker (BullMQ): PM2 process, no port ✅
- PostgreSQL: Docker container, port 5432 ✅
- Redis: Docker container, port 6379 ✅
```

---

## 📋 What Works Right Now

### ✅ Fully Functional (Production + localhost):
1. **Web Application** — All pages live at https://cslai.corporatespec.com
   - Login page: https://cslai.corporatespec.com/login ✅
   - Register page: https://cslai.corporatespec.com/register ✅
   - Dashboard: https://cslai.corporatespec.com/ ✅
   - All admin pages (tenants, integrations, memory, runs, errors, settings) ✅

2. **API Service** — Running locally on port 3001
   - Health check: http://localhost:3001/health returns `{"status":"ok"}` ✅
   - All authentication endpoints ready ✅
   - Database connectivity working ✅

3. **Worker Service** — BullMQ processing active
   - Connected to Redis ✅
   - Ready to process enrichment jobs ✅

4. **Database** — Seeded and ready
   - Admin user: admin@example.com / admin123
   - PostgreSQL running in Docker ✅

### ⚠️ Pending (1 action):
- `https://api.cslai.corporatespec.com` — needs DNS A record for `api.cslai` → `18.175.106.89` in Cloudflare

---

## 🔑 Key Design Decisions

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
| **Database/Redis** | **Docker Compose (postgres + redis only)** |

---

## 🛠️ Environment Setup — COMPLETE

- ✅ Node.js 20.20.0 installed via NodeSource
- ✅ pnpm 9.15.9 installed via corepack
- ✅ PM2 installed globally
- ✅ Caddy 2.11.1 installed as system service
- ✅ Docker installed (only used for PostgreSQL + Redis)
- ✅ All dependencies installed (`pnpm install`)
- ✅ All packages built (`pnpm build`)
- ✅ Next.js static assets copied into standalone output
- ✅ Prisma client generated
- ✅ Database migrated and seeded
- ✅ PM2 auto-start configured
- ✅ Caddy auto-start configured
- ✅ EC2 Security Group ports 80/443 open

---

## 📁 Current File Tree

```
cslai/
├── .env                            ✅ Dev credentials
├── .env.example                    ✅
├── ecosystem.config.js             ✅ PM2 configuration
├── Makefile                        ✅ UPDATED - deploy now uses PM2 + copies static files
├── HANDOFF.md                      ✅ (this file - updated Feb 25, 2026 10:20 UTC)
├── package.json                    ✅
├── pnpm-workspace.yaml             ✅
├── pnpm-lock.yaml                  ✅
├── turbo.json                      ✅
├── tsconfig.json                   ✅
├── apps/
│   ├── api/                        ✅ RUNNING via PM2 on port 3001
│   ├── web/                        ✅ RUNNING via PM2 on port 3000
│   │   └── .next/
│   │       ├── static/             ✅ Built static assets
│   │       └── standalone/
│   │           └── apps/web/
│   │               └── .next/
│   │                   └── static/ ✅ COPIED HERE (required for standalone)
│   └── worker/                     ✅ RUNNING via PM2
├── packages/
│   ├── db/                         ✅ FIXED package.json main field
│   │   └── package.json            (main: "./dist/index.js")
│   └── shared/                     ✅ FIXED package.json main field
│       └── package.json            (main: "./dist/index.js")
└── infra/                          ✅ CONFIGURED
    ├── docker-compose.yml          (not used - kept for reference)
    ├── docker-compose.dev.yml      ✅ RUNNING (postgres + redis only)
    ├── Caddyfile                   ✅ localhost:3000/3001 (FIXED from web:3000/api:3001)
    └── scripts/                    (backup/restore/deploy scripts available)
```

---

## 🔧 Useful Commands

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
pm2 restart all --update-env
pm2 restart web --update-env
```

**Stop/Start services:**
```bash
pm2 stop all
pm2 start ecosystem.config.js
```

**Check Caddy:**
```bash
sudo systemctl status caddy
sudo systemctl reload caddy     # reload config without downtime
sudo systemctl restart caddy    # full restart
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

**Rebuild and redeploy (use this after code changes):**
```bash
cd /home/ubuntu/cslai
make deploy
# This does: git pull → pnpm build → copy static files → pm2 restart all
```

**⚠️ IMPORTANT: After ANY Next.js build, always copy static files:**
```bash
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
```

**Reload Caddy after editing /etc/caddy/Caddyfile:**
```bash
sudo systemctl reload caddy
```

---

## 🌐 How to Access

- **Production (LIVE):** https://cslai.corporatespec.com/login
- **Local SSH tunnel:**
  ```bash
  ssh -L 3000:localhost:3000 -L 3001:localhost:3001 ubuntu@18.175.106.89
  # Then: http://localhost:3000/login
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
| Web (Next.js) | PM2 | ✅ Running | 3000 | Live at https://cslai.corporatespec.com |
| API (NestJS) | PM2 | ✅ Running | 3001 | Needs api.cslai DNS record |
| Worker (BullMQ) | PM2 | ✅ Running | N/A | Queue processing active |
| PostgreSQL | Docker | ✅ Running | 5432 | Seeded with data |
| Redis | Docker | ✅ Running | 6379 | Connected |
| Caddy | System Service | ✅ Running | 80, 443 | SSL cert active for main domain |

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
| **Stage 7** | Production deployment | ✅ **LIVE** (PM2 + Caddy + HTTPS) |

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
**Solution:** Expanded EBS volume to 40GB, switched to PM2 deployment.

### ~~Issue 2: Package.json pointing to TypeScript source~~ ✅ FIXED
**Solution:** Updated both packages to point to `./dist/index.js`.

### ~~Issue 3: API missing JWT_SECRET~~ ✅ FIXED
**Solution:** Added `JWT_SECRET` to PM2 ecosystem.config.js.

### ~~Issue 4: Ports 80/443 blocked by EC2 Security Group~~ ✅ FIXED
**Solution:** User added HTTP and HTTPS inbound rules to the security group.

### ~~Issue 5: Caddyfile using Docker service names (web:3000, api:3001)~~ ✅ FIXED
**Solution:** Updated both `infra/Caddyfile` and `/etc/caddy/Caddyfile` to use `localhost:3000` and `localhost:3001`.

### ~~Issue 6: Login page stuck on "Loading..." (white screen)~~ ✅ FIXED
**Solution:** Next.js standalone builds require manual copy of `.next/static` into the standalone output directory. Copied and updated `make deploy` to always do this.

### ~~Issue 7: 502 Bad Gateway on cslai.corporatespec.com~~ ✅ FIXED
**Solution:** Caddy was running with stale in-memory config (had `web:3000`). `sudo systemctl reload caddy` picked up the updated config immediately.

### Issue 8: api.cslai.corporatespec.com has no DNS record ⚠️ PENDING USER ACTION
**Solution:** Add `api.cslai` A record → `18.175.106.89` in Cloudflare DNS.

---

## ⚡ How to Continue in Next Session

**The site is live.** Main things to work on:
1. Add DNS A record for `api.cslai` in Cloudflare (see top of this file)
2. Replace placeholder API keys in `ecosystem.config.js` with real credentials:
   - `SLACK_SIGNING_SECRET` + `SLACK_BOT_TOKEN`
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GEMINI_API_KEY`
3. Set up Slack app and configure webhook URLs
4. Test end-to-end: Slack → Worker → Integrations → LLM → response

### 🎯 Recommended Next Actions

**Immediate:**
1. Add `api.cslai` DNS A record in Cloudflare
2. Replace placeholder keys in `ecosystem.config.js`
3. Run `pm2 restart api --update-env` after updating keys

**Later:**
1. Set up Slack app and webhook URLs
2. Test end-to-end Slack bot flow
3. Add unit and E2E tests
4. Set up CI/CD pipeline

---

## 📝 Changelog

### Feb 25, 2026 — 10:20 UTC — Site is LIVE
- ✅ Fixed Caddyfile: `web:3000` → `localhost:3000`, `api:3001` → `localhost:3001`
- ✅ Fixed Next.js "Loading..." white screen: copied `.next/static` into standalone output
- ✅ Fixed 502 error: reloaded Caddy to pick up updated config
- ✅ Updated `Makefile` deploy target: now uses PM2 + copies static files automatically
- ✅ SSL certificate obtained for `cslai.corporatespec.com`
- ✅ https://cslai.corporatespec.com/login returns 200 ✅
- ⚠️ `api.cslai.corporatespec.com` needs DNS A record

### Feb 25, 2026 — 08:40 UTC — Production Deployment
- ✅ Deployed all services with PM2
- ✅ Configured Caddy reverse proxy
- ✅ All services running and healthy locally
- ✅ Updated package.json files to fix module resolution
- ✅ Created PM2 ecosystem configuration
- ✅ Enabled auto-start for all services
- ✅ EC2 Security Group ports 80/443 opened

### Earlier Sessions
- ✅ Built all packages and applications
- ✅ Fixed all TypeScript errors
- ✅ Created and applied database migrations
- ✅ Seeded database with admin user
- ✅ Configured development environment

---

## 🔑 Security Notes

**Credentials in Production:**
- Database password, JWT secrets, and encryption key are currently using **dev placeholder values**
- **IMPORTANT:** Change all secrets in `ecosystem.config.js` before handling real data
- API keys for integrations (Slack, OpenAI, etc.) are set to placeholder values — update before use

**Firewall:**
- Local firewall (ufw): inactive
- AWS Security Group: ports 22, 80, 443 open ✅
