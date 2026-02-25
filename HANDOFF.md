# Company Intel Bot — Session Handoff Document

> **Purpose:** Read this file at the start of a new AI session to understand exactly what has been built, what is pending, and how to continue. All work lives at `/home/ubuntu/Desktop/company-intel-bot/`.

---

## 🗺️ Project Overview

A multi-tenant company intelligence Slack bot built as a Turborepo monorepo with:
- **API** — NestJS + TypeScript (`apps/api`)
- **Admin UI** — Next.js 14 App Router + Tailwind + shadcn/ui (`apps/web`)
- **Worker** — BullMQ enrichment worker (`apps/worker`)
- **DB package** — Prisma + PostgreSQL + AES-256-GCM encryption (`packages/db`)
- **Shared package** — Zod schemas + TypeScript types (`packages/shared`)
- **Infra** — Caddy reverse proxy + Docker Compose + scripts (`infra/`)

**Final production URLs:**
- Admin UI: `https://ai.corporatespec.com`
- API: `https://api.ai.corporatespec.com`
- Slack events: `https://api.ai.corporatespec.com/integrations/slack/events`

---

## ✅ COMPLETED — What's been built

### Root-level files — ALL DONE ✅
`package.json` (now has `"packageManager": "pnpm@9.15.9"`), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.eslintrc.js`, `.prettierrc`, `.gitignore`, `.env.example`, `Makefile`

### `packages/db` — ALL DONE ✅ — **BUILDS CLEAN**
Full Prisma schema with all models: `Tenant`, `User`, `Membership`, `RefreshToken`, `IntegrationConfig`, `SlackWorkspace`, `ThreadMemory`, `Run`, `RunStep`, `ErrorLog`.
Files: `package.json`, `tsconfig.json`, `prisma/schema.prisma`, `src/client.ts`, `src/encryption.ts`, `src/seed.ts`, `src/index.ts`

### `packages/shared` — ALL DONE ✅ — **BUILDS CLEAN**
Files: `package.json`, `tsconfig.json`, `src/schemas/integration.schema.ts`, `src/schemas/result.schema.ts`, `src/types/enrichment.types.ts`, `src/index.ts`

### `apps/worker` — ALL DONE ✅ — **BUILDS CLEAN**
Files: `package.json`, `tsconfig.json`, `Dockerfile`, `src/main.ts`, `src/processors/enrichment.processor.ts`

The worker is a standalone BullMQ consumer (no NestJS). It:
1. Connects to Redis and processes `enrichment` queue
2. Creates Run records, loads integrations from DB, runs them in parallel
3. Calls LLM (openai/anthropic/gemini) with thread memory + results
4. Posts reply to Slack via Web API
5. Saves to ThreadMemory, marks Run COMPLETED/DEGRADED/FAILED

### `infra/` — ALL DONE ✅
Files:
- `infra/docker-compose.yml` — Production: api, web, worker, postgres, redis, caddy (6 services, healthchecks, depends_on, volumes)
- `infra/docker-compose.dev.yml` — Dev: postgres + redis only (ports 5432, 6379 exposed)
- `infra/Caddyfile` — HTTPS for ai.corporatespec.com + api.ai.corporatespec.com with security headers
- `infra/scripts/backup-postgres.sh` — pg_dump → gzip, 30-backup retention
- `infra/scripts/restore-postgres.sh` — safety-confirmed restore
- `infra/scripts/deploy.sh` — git pull → backup → build → migrate → up → healthcheck → prune

### `apps/api` — FILES WRITTEN BUT **BUILD FAILS** (46 TS errors) ❌
### `apps/web` — FILES WRITTEN BUT **BUILD FAILS** (1 config error) ❌

---

## ❌ STILL PENDING — Two build failures to fix

### Fix 1: `apps/web` — next.config.ts not supported by Next.js 14

**Error:**
```
Error: Configuring Next.js via 'next.config.ts' is not supported.
Please replace the file with 'next.config.js' or 'next.config.mjs'.
```

**Fix:** Delete `apps/web/next.config.ts` and create `apps/web/next.config.mjs`:

```js
// apps/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
};

export default nextConfig;
```

Then delete `apps/web/next.config.ts`.

---

### Fix 2: `apps/api` — 46 TypeScript errors

All errors fall into 6 groups. Fix them all:

#### Group A: `okResult`/`errResult` wrong call signature (28 errors)

The existing integration handlers were written with the OLD signature `okResult(items)` / `errResult(msg)`, but `packages/shared/src/schemas/result.schema.ts` defines them as `okResult(source, items, opts?)` and `errResult(source, message, opts?)`.

Fix each integration file. Correct signatures:
```typescript
okResult('SLACK', items, { durationMs })
errResult('SLACK', `error message`, { durationMs })
```

Files to fix:
- `apps/api/src/integrations/slack/slack.integration.ts`
- `apps/api/src/integrations/woocommerce/woocommerce.integration.ts`
- `apps/api/src/integrations/gmail/gmail.integration.ts`
- `apps/api/src/integrations/custom-rest/custom-rest.integration.ts`
- `apps/api/src/integrations/trackpod/trackpod.integration.ts`

#### Group B: `cookieParser` import in `apps/api/src/main.ts`

**Error (line 42):** `Type 'typeof cookieParser' has no call signatures`

**Current (line 10):**
```typescript
import * as cookieParser from 'cookie-parser';
```

**Fix:**
```typescript
import cookieParser from 'cookie-parser';
```

#### Group C: `EnrichmentJobPayload` wrong fields

**In `apps/api/src/integrations/slack/slack-events.controller.ts` (line 95):**
```
error TS2353: Object literal may only specify known properties, and 'trigger' does not exist in type 'EnrichmentJobPayload'.
```

`EnrichmentJobPayload` has no `trigger` field. **Remove the `trigger` line** from the payload object in `slack-events.controller.ts`.

**In `apps/api/src/queue/queue.producer.ts` (line 31):**
```
error TS2339: Property 'slackThreadTs' does not exist on type 'EnrichmentJobPayload'.
```

**Current:**
```typescript
jobId: `${payload.tenantId}:${payload.slackThreadTs ?? Date.now()}`,
```

**Fix:**
```typescript
jobId: `${payload.tenantId}:${payload.slack?.threadTs ?? Date.now()}`,
```

#### Group D: `integrations.service.ts` — `decryptObject` type

**Error (line 78):**
```
Argument of type 'unknown' is not assignable to parameter of type 'Record<string, unknown>'.
```

**Current (line 78):**
```typescript
const integration = this.registry.build(record.type, rawConfig);
```

**Fix** — cast rawConfig:
```typescript
const rawConfig = decryptObject(JSON.parse(record.configEnc)) as Record<string, unknown>;
```

#### Group E: `memory.service.ts` — Prisma JSON type issues (2 errors)

**Line 31 error:** cast needs to go through `unknown`:
```typescript
// Current:
const existing = (record.messages as MemoryMessage[]) ?? [];
// Fix:
const existing = (record.messages as unknown as MemoryMessage[]) ?? [];
```

**Line 46 error:** `messages` field type mismatch with Prisma `InputJsonValue`:
```typescript
// Current:
messages: trimmed,
// Fix:
messages: trimmed as unknown as Prisma.InputJsonValue,
```
Add import at top: `import type { Prisma } from '@prisma/client';`

#### Group F: TS2742 "inferred type cannot be named" errors (many files)

These errors appear in `tenants.service.ts`, `tenants.controller.ts`, `users.service.ts`, `users.controller.ts`, `integrations.service.ts`, `integrations.controller.ts`, `memory.service.ts`, `memory.controller.ts`, `runs.service.ts`, `runs.controller.ts`.

**Fix:** Add explicit return type annotations to each affected method. Examples:

```typescript
// tenants.service.ts
async findOne(id: string): Promise<Tenant | null> {
async findAll(): Promise<Tenant[]> {

// users.service.ts  
async findAll(tenantId: string): Promise<User[]> {

// runs.service.ts
async findAll(tenantId: string, skip = 0, take = 20): Promise<Run[]> {
async findOne(tenantId: string, id: string): Promise<Run & { steps: RunStep[] }> {
```

Import the relevant Prisma types at the top of each file:
```typescript
import type { Tenant, User, Run, RunStep, IntegrationConfig, Membership } from '@company-intel/db';
```

---

## 🛠️ Environment Setup (already done this session)

- Node.js 20.20.0 installed via NodeSource
- pnpm 9.15.9 installed via `sudo corepack enable && corepack prepare pnpm@9 --activate`
- `pnpm install` — ✅ clean (lockfile up to date)
- `prisma generate` — ✅ done

---

## 📋 What to do next (in order)

1. **Fix `apps/web/next.config.ts`** → rename to `next.config.mjs` (see Fix 1 above)
2. **Fix all 46 TS errors in `apps/api`** (see Fix 2 groups A–F above)
3. **Run `pnpm build`** from `/home/ubuntu/Desktop/company-intel-bot/` — should now be fully clean
4. **Run first Prisma migration** (requires postgres running):
   ```bash
   docker compose -f infra/docker-compose.dev.yml up -d
   cd packages/db && pnpm exec prisma migrate dev --name init
   ```
5. **Update HANDOFF.md** after build passes

---

## 🔑 Key Design Decisions

| Decision | Choice |
|----------|--------|
| Package manager | `pnpm` with workspaces |
| Build orchestration | Turborepo |
| API framework | NestJS 10 |
| Auth | JWT access (15m) + refresh (7d) in HttpOnly cookie |
| Encryption | AES-256-GCM, key = 32-byte hex in `ENCRYPTION_KEY` env var |
| Job queue | BullMQ + Redis (ioredis) |
| LLM abstraction | Single `LlmService` supports openai / anthropic / gemini |
| Integration interface | `testConnection()` + `runEnrichment(query)` |
| Trackpod | Feature-flagged stub — returns empty NormalizedResult |
| Thread memory key | `slack:{teamId}:{channelId}:{threadTs}` |

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

## 📁 Current File Tree

```
company-intel-bot/
├── .env.example                    ✅
├── .eslintrc.js                    ✅
├── .gitignore                      ✅
├── .prettierrc                     ✅
├── Makefile                        ✅
├── HANDOFF.md                      ✅ (this file)
├── package.json                    ✅ (has packageManager field)
├── pnpm-workspace.yaml             ✅
├── tsconfig.json                   ✅
├── turbo.json                      ✅
├── apps/
│   ├── api/                        ⚠️  FILES DONE — BUILD FAILS (46 TS errors)
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── package.json            ✅ (nestjs-pino + pino-http added)
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts             ← needs cookieParser import fix
│   │       ├── app.module.ts
│   │       ├── auth/               (full module) ✅
│   │       ├── common/             (decorators, pipes, filters) ✅
│   │       ├── health/             ✅
│   │       ├── integrations/       ← okResult/errResult calls need fixing
│   │       │   ├── slack/          ← slack-events.controller.ts has 'trigger' error
│   │       │   ├── woocommerce/    ← errResult/okResult call fixes needed
│   │       │   ├── gmail/          ← errResult/okResult call fixes needed
│   │       │   ├── custom-rest/    ← errResult/okResult call fixes needed
│   │       │   ├── trackpod/       ← okResult call fixes needed
│   │       │   ├── integrations.service.ts  ← decryptObject cast fix
│   │       │   └── integrations.controller.ts ← TS2742 return types needed
│   │       ├── llm/                ✅
│   │       ├── memory/             ← TS2742 return types + JSON cast fixes needed
│   │       ├── queue/              ← slackThreadTs → slack?.threadTs fix
│   │       ├── runs/               ← TS2742 return types needed
│   │       ├── tenants/            ← TS2742 return types needed
│   │       └── users/              ← TS2742 return types needed
│   ├── web/                        ⚠️  FILES DONE — BUILD FAILS (next.config.ts issue)
│   │   ├── Dockerfile
│   │   ├── next.config.ts          ← DELETE THIS, replace with next.config.mjs
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── src/                    ✅ all pages written
│   └── worker/                     ✅ COMPLETE — BUILDS CLEAN
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           └── processors/
│               └── enrichment.processor.ts
├── packages/
│   ├── db/                         ✅ COMPLETE — BUILDS CLEAN
│   └── shared/                     ✅ COMPLETE — BUILDS CLEAN
└── infra/                          ✅ COMPLETE
    ├── docker-compose.yml
    ├── docker-compose.dev.yml
    ├── Caddyfile
    └── scripts/
        ├── backup-postgres.sh
        ├── restore-postgres.sh
        └── deploy.sh
```

---

## 🏗️ Full 7-Stage Plan

| Stage | Description | Status |
|-------|-------------|--------|
| **Stage 1** | Monorepo scaffold — all package.json, tsconfig, configs, Dockerfiles, infra | 🔄 ~95% done (2 build fixes remaining) |
| **Stage 2** | Database migrations + encryption + seed script | ✅ Schema done — needs first migration (`prisma migrate dev`) |
| **Stage 3** | Admin UI v1 — auth pages, dashboard, all admin pages | ✅ Done — pending web build fix |
| **Stage 4** | Slack integration — events endpoint, signature verify, bot reply | ✅ Events controller + worker reply logic done |
| **Stage 5** | Thread memory — read/append/summarize/trim | ✅ Service done + worker integration done |
| **Stage 6** | Integrations v1 — Slack history, WooCommerce, Gmail, Custom REST, Trackpod stub | ✅ Handlers + worker orchestration done |
| **Stage 7** | Production hardening — rate limiting, dead-letter, pino logging, Caddy deploy | 🔄 Rate limiting + pino done in API, infra ready |

---

## ⚡ How to Continue in Next Session

1. Open a new AI session in `/home/ubuntu/Desktop/company-intel-bot/`
2. Say: **"Read `/home/ubuntu/Desktop/company-intel-bot/HANDOFF.md` and continue building the project from where it left off."**
3. The AI should:
   a. Fix `apps/web/next.config.ts` → `apps/web/next.config.mjs`
   b. Fix all 46 TypeScript errors in `apps/api` (see Fix 2 groups A–F above)
   c. Run `pnpm build` to confirm everything compiles
   d. Run first Prisma migration with dev compose stack
   e. Update this HANDOFF.md
