# Company Intel Bot

A multi-tenant company intelligence Slack bot — ask your Slack bot questions about companies and it fetches, enriches, and summarises data from your configured integrations using an LLM of your choice.

**Live URL:** https://cslai.corporatespec.com

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Operations](#database-operations)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [PM2 Process Management](#pm2-process-management)
- [Caddy Reverse Proxy](#caddy-reverse-proxy)
- [Backup & Restore](#backup--restore)
- [All Make Targets](#all-make-targets)
- [Adding a New Integration](#adding-a-new-integration)
- [Security Notes](#security-notes)

---

## Architecture

```
Internet (HTTPS — ports 80/443)
    │
    ▼
Caddy Reverse Proxy  (system service, auto HTTPS via Let's Encrypt)
    ├── cslai.corporatespec.com        → localhost:3000  (Admin UI)
    └── api.cslai.corporatespec.com    → localhost:3001  (API)

Node.js Services  (managed by PM2)
    ├── web     Next.js 14 Admin UI           port 3000
    ├── api     NestJS REST API               port 3001
    └── worker  BullMQ enrichment worker      (no port)

Infrastructure  (Docker Compose — postgres + redis only)
    ├── PostgreSQL 16    port 5432
    └── Redis 7          port 6379
```

| Component | Runtime | Status |
|-----------|---------|--------|
| Admin UI (Next.js 14) | PM2 | ✅ Live |
| API (NestJS 10) | PM2 | ✅ Live |
| Worker (BullMQ) | PM2 | ✅ Live |
| PostgreSQL 16 | Docker | ✅ Live |
| Redis 7 | Docker | ✅ Live |
| Caddy 2 | systemd | ✅ Live |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Package manager | pnpm 9 with workspaces |
| Build orchestration | Turborepo 2 |
| API framework | NestJS 10 + TypeScript |
| Admin UI | Next.js 14 App Router + Tailwind CSS |
| Background jobs | BullMQ + Redis (ioredis) |
| ORM / Database | Prisma 5 + PostgreSQL 16 |
| Encryption | AES-256-GCM (32-byte key) |
| Auth | JWT access tokens (15 min) + refresh tokens (7 days, HttpOnly cookie) |
| Logging | Pino + nestjs-pino |
| LLM providers | OpenAI / Anthropic Claude / Google Gemini (runtime-switchable, per-tenant priority chain) |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| Process manager | PM2 |

---

## Repository Layout

```
cslai/
├── apps/
│   ├── api/                  NestJS REST API (port 3001)
│   │   └── src/
│   │       ├── auth/         JWT auth, login, register, refresh
│   │       ├── tenants/      Tenant CRUD (OWNER role only)
│   │       ├── users/        User management within a tenant
│   │       ├── integrations/ Integration configs (encrypted keys)
│   │       ├── settings/     Per-tenant LLM settings + test endpoints
│   │       ├── memory/       Slack thread memory (conversation history)
│   │       ├── runs/         Enrichment run history + step logs
│   │       ├── llm/          Provider-agnostic LLM service (fallback chain)
│   │       ├── queue/        BullMQ job producer
│   │       ├── health/       /health + /ready endpoints
│   │       └── common/       Guards, decorators, pipes, filters
│   ├── web/                  Next.js 14 Admin UI (port 3000)
│   │   └── src/app/
│   │       ├── (auth)/       Login + Register pages
│   │       └── (dashboard)/  Dashboard, tenants, integrations,
│   │                         memory, runs, errors, settings
│   └── worker/               BullMQ enrichment worker (no port)
│       └── src/processors/   enrichment.processor.ts
│
├── packages/
│   ├── db/                   Prisma schema, client, encryption, seed
│   │   └── prisma/schema.prisma
│   └── shared/               Zod schemas + TypeScript types (shared)
│
├── infra/
│   ├── docker-compose.dev.yml  PostgreSQL + Redis
│   ├── Caddyfile               Reference Caddy config (copy to /etc/caddy/)
│   └── scripts/
│       ├── backup-postgres.sh
│       └── restore-postgres.sh
│
├── ecosystem.config.js       PM2 process definitions + env vars
├── Makefile                  Developer shortcuts (see make help)
├── turbo.json                Turborepo pipeline config
├── pnpm-workspace.yaml       pnpm workspace definition
└── .env.example              Template — copy to .env and fill in
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | Install via NodeSource or nvm |
| pnpm | ≥ 9 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker | any | Used only for PostgreSQL + Redis |
| make | any | Standard on Linux/macOS |

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> cslai
cd cslai
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set ENCRYPTION_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
```

Generate secrets:
```bash
# ENCRYPTION_KEY (32 bytes → 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT secrets (64 bytes → 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Start PostgreSQL + Redis

```bash
make docker-dev
# Postgres available on localhost:5432
# Redis available on localhost:6379
```

### 4. Run database migrations and seed

```bash
make migrate      # applies all pending migrations
make seed         # creates: admin@example.com / admin123, "Default Tenant"
```

### 5. Start all services in watch mode

```bash
make dev
# API  → http://localhost:3001
# Web  → http://localhost:3000
```

Or start individually:
```bash
pnpm --filter @company-intel/api dev
pnpm --filter @company-intel/web dev
pnpm --filter @company-intel/worker dev
```

### 6. Access the Admin UI

Open http://localhost:3000/login and sign in:
- **Email:** admin@example.com
- **Password:** admin123

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | ✅ | Redis connection for BullMQ |
| `ENCRYPTION_KEY` | ✅ | 64-char hex key for AES-256-GCM encryption |
| `JWT_ACCESS_SECRET` | ✅ | Signs access tokens (15 min lifetime) |
| `JWT_REFRESH_SECRET` | ✅ | Signs refresh tokens (7 day lifetime) |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_URL` | ✅ | Browser-side API base URL |
| `OPENAI_API_KEY` | ⚠️ | Fallback if no DB LLM settings configured |
| `ANTHROPIC_API_KEY` | ⚠️ | Fallback if no DB LLM settings configured |
| `GOOGLE_GEMINI_API_KEY` | ⚠️ | Fallback if no DB LLM settings configured |
| `SLACK_SIGNING_SECRET` | ⚠️ | Required for Slack event verification |
| `DEFAULT_LLM_PROVIDER` | — | `openai` \| `anthropic` \| `gemini` (env fallback only) |

> **Note:** LLM API keys and provider priority are configured per-tenant via the Settings page in the Admin UI. Keys are stored AES-256-GCM encrypted in the database. Environment variable keys are only used as a fallback if no DB settings exist.

> **Production:** All secrets are set inside `ecosystem.config.js` so PM2 injects them as environment variables.

---

## Database Operations

```bash
make generate       # Regenerate Prisma client after schema changes
make migrate-dev    # Create + apply a new migration (development)
make migrate        # Apply pending migrations (production)
make migrate-reset  # Reset DB + re-run all migrations (DEV ONLY)
make seed           # Seed DB with default admin user + tenant
make studio         # Open Prisma Studio at http://localhost:5555
```

### Schema location

```
packages/db/prisma/schema.prisma
```

### Models

| Model | Description |
|-------|-------------|
| `Tenant` | An organisation / workspace |
| `User` | A user belonging to a tenant |
| `Membership` | User ↔ Tenant role mapping (OWNER, ADMIN) |
| `RefreshToken` | Stored refresh tokens (rotated on use) |
| `IntegrationConfig` | Integration connection (type + encrypted credentials) |
| `TenantSetting` | Per-tenant LLM provider config (encrypted, with priority order) |
| `SlackWorkspace` | Slack workspace linked to a tenant |
| `ThreadMemory` | Slack thread conversation history |
| `Run` | An enrichment run triggered by Slack |
| `RunStep` | Individual steps within a run |
| `ErrorLog` | Application error records |

---

## API Reference

### Base URL

```
Production:  https://api.cslai.corporatespec.com/api
Local:       http://localhost:3001/api
```

### Authentication

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

Refresh tokens are stored in an `HttpOnly` cookie and rotated on every `/api/auth/refresh` call.

### Endpoints

#### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | — | Login, returns access token + sets refresh cookie |
| `POST` | `/api/auth/register` | — | Register a new user |
| `POST` | `/api/auth/refresh` | cookie | Rotate refresh token |
| `POST` | `/api/auth/logout` | cookie | Revoke refresh token |

#### Tenants

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tenants` | List all tenants |
| `POST` | `/api/tenants` | Create a new tenant |
| `PATCH` | `/api/tenants/:id` | Update tenant |
| `DELETE` | `/api/tenants/:id` | Delete a tenant |

#### Integrations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/integrations` | List all integrations for the tenant |
| `POST` | `/api/integrations` | Create a new integration |
| `PATCH` | `/api/integrations/:id` | Update an integration |
| `DELETE` | `/api/integrations/:id` | Delete an integration |
| `POST` | `/api/integrations/:id/test` | Test integration connectivity |

#### Settings (LLM)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings/llm` | Get LLM provider configs (API keys masked) |
| `PATCH` | `/api/settings/llm` | Save LLM configs + priority order |
| `POST` | `/api/settings/llm/test/:provider` | Test a provider's API key |

The LLM settings store per-tenant provider configurations including model choice, API key (AES-256-GCM encrypted), enabled state, and priority. The LLM service tries providers in priority order at runtime, falling back to the next on failure.

**Supported providers:** `openai`, `anthropic`, `gemini`

#### Memory

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/memory` | List all thread memories |
| `GET` | `/api/memory/:threadKey` | Get a thread with full message history |

#### Runs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/runs` | List recent enrichment runs |
| `GET` | `/api/runs/:id` | Get a run with all steps |

#### Slack Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/integrations/slack/events` | Slack events webhook receiver |

#### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/ready` | Readiness probe (checks DB) |

---

## Production Deployment

The production server runs on AWS EC2 (`18.175.106.89`). Deployment method: **PM2 + Caddy** (no Docker for application code).

### Redeploy after code changes

```bash
cd /home/ubuntu/cslai
make deploy
```

This single command:
1. `git pull origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm turbo run build`
4. `make migrate` — runs pending Prisma migrations
5. Copies Next.js static assets into standalone output
6. `pm2 restart all --update-env`
7. `pm2 save`

> **⚠️ Important:** The Next.js standalone build does **not** automatically bundle `.next/static`. Always run after a manual build:
> ```bash
> cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
> ```

### Admin credentials (seeded)

- **Email:** admin@example.com
- **Password:** admin123

---

## PM2 Process Management

| PM2 name | Port |
|----------|------|
| `api` | 3001 |
| `web` | 3000 |
| `worker` | — |

```bash
pm2 status                          # View all processes
pm2 logs                            # Tail all logs
pm2 logs api                        # Tail API logs
pm2 restart api --update-env        # Restart API (picks up env changes)
pm2 restart web --update-env        # Restart web
pm2 restart all --update-env        # Restart everything
pm2 save                            # Persist process list
```

Or use Make targets:
```bash
make pm2-status
make pm2-restart
make logs
```

---

## Caddy Reverse Proxy

```bash
sudo systemctl status caddy
sudo systemctl reload caddy      # Reload config without downtime
sudo systemctl restart caddy
sudo journalctl -u caddy -f      # View logs
```

### DNS records required

| Name | Type | Value |
|------|------|-------|
| `cslai` | A | `18.175.106.89` |
| `api.cslai` | A | `18.175.106.89` |

---

## Backup & Restore

```bash
make backup                                              # Dump to ./backups/
make restore backups/company_intel_YYYYMMDD_HHMMSS.sql.gz   # Restore
```

---

## All Make Targets

```
Development
  make install        Install all pnpm dependencies
  make dev            Start all services in dev mode (watch)
  make build          Build all packages and apps
  make lint           Run ESLint
  make type-check     Run TypeScript type checker
  make clean          Remove build outputs and caches

Database
  make generate       Regenerate Prisma client
  make migrate        Apply pending migrations (production)
  make migrate-dev    Create + apply a new migration (development)
  make migrate-reset  Drop DB + re-run all migrations (DEV ONLY)
  make seed           Seed DB with default admin user + tenant
  make studio         Open Prisma Studio at http://localhost:5555

Docker (PostgreSQL + Redis only)
  make docker-dev     Start Postgres + Redis containers
  make docker-down    Stop and remove containers

Production (PM2)
  make deploy         Pull + build + migrate + restart PM2
  make pm2-status     Show PM2 process status
  make pm2-restart    Restart all PM2 processes
  make pm2-stop       Stop all PM2 processes
  make pm2-start      Start from ecosystem.config.js
  make logs           Tail all PM2 logs
  make backup         Dump Postgres to ./backups/
  make restore        Restore a Postgres backup
```

---

## Adding a New Integration

1. **Create the integration class** in `apps/api/src/integrations/<name>/`:

```typescript
import { BaseIntegration } from '../integration.interface';

export class MyServiceIntegration implements BaseIntegration {
  readonly type = 'myservice';

  async testConnection(): Promise<void> {
    // Throw on failure
  }

  async fetchData(config: Record<string, unknown>, query: string): Promise<string> {
    // Return enrichment data as a string
  }
}
```

2. **Register** it in `apps/api/src/integrations/registry.service.ts`
3. **Add** it to `apps/api/src/integrations/integrations.module.ts` providers
4. **Add** a Zod config schema in `packages/shared/src/schemas/integration.schema.ts`
5. **Add** config fields to the Add Integration modal in `apps/web/src/app/(dashboard)/integrations/page.tsx`

---

## LLM Provider Configuration

LLM providers are configured per-tenant via **Settings → LLM Providers** in the Admin UI:

- Enter API keys for any/all of: OpenAI, Anthropic, Google Gemini
- Choose the model for each provider
- Set the priority order (drag up/down)
- Enable/disable individual providers
- Test each key with the **Test Connection** button

At runtime, the LLM service tries providers in priority order. If the highest-priority provider fails (rate limit, outage, invalid key), it automatically falls back to the next enabled provider.

**Supported models:**

| Provider | Models |
|----------|--------|
| OpenAI | GPT-5.2, GPT-5.2 Pro, GPT-5.1, GPT-5 Mini, GPT-5 Nano |
| Anthropic | Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5, Claude Opus 4.5, Claude Sonnet 4.5 |
| Google Gemini | Gemini 3.1 Pro (Preview), Gemini 3 Pro (Preview), Gemini 3 Flash (Preview), Gemini 2.5 Pro, Gemini 2.5 Flash |

---

## Security Notes

> ⚠️ The `ecosystem.config.js` contains **dev placeholder secrets**. Before handling real data, update all `CHANGEME` values.

| Secret | How to rotate |
|--------|--------------|
| `ENCRYPTION_KEY` | Generate a new 32-byte hex key. **⚠️ Rotating invalidates all stored integration credentials and LLM API keys.** |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | New 64-byte hex values. All active sessions will be invalidated. |
| LLM API keys | Update via Settings page in the Admin UI (stored encrypted in DB). |

**Firewall:** AWS Security Group allows inbound on ports 22, 80, 443 only. Ports 3000, 3001, 5432, 6379 are internal only.
