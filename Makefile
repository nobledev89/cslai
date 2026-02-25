# =============================================================================
# Company Intel Bot — Makefile
# Usage: make <target>
# =============================================================================

.PHONY: help dev build lint type-check test clean \
        install migrate migrate-reset seed generate \
        docker-dev docker-prod docker-down \
        deploy backup restore logs

# Default target
help:
	@echo ""
	@echo "  Company Intel Bot — Available Commands"
	@echo "  ======================================"
	@echo ""
	@echo "  Development"
	@echo "    make install       Install all pnpm dependencies"
	@echo "    make dev           Start all services in dev mode (watch)"
	@echo "    make build         Build all packages and apps"
	@echo "    make lint          Run ESLint across all packages"
	@echo "    make type-check    Run TypeScript type checker"
	@echo "    make test          Run all tests"
	@echo "    make clean         Remove all build outputs and caches"
	@echo ""
	@echo "  Database"
	@echo "    make generate      Regenerate Prisma client from schema"
	@echo "    make migrate       Run pending Prisma migrations"
	@echo "    make migrate-reset Drop DB + re-run all migrations (DEV only)"
	@echo "    make seed          Seed DB with super-admin tenant + user"
	@echo ""
	@echo "  Docker"
	@echo "    make docker-dev    Start local dev stack (Postgres + Redis)"
	@echo "    make docker-prod   Start full production stack"
	@echo "    make docker-down   Stop and remove containers"
	@echo ""
	@echo "  Production"
	@echo "    make deploy        Pull latest + rebuild + restart on server"
	@echo "    make backup        Dump Postgres to ./backups/"
	@echo "    make restore       Restore latest backup (interactive)"
	@echo "    make logs          Tail all container logs"
	@echo ""

# =============================================================================
# Development
# =============================================================================

install:
	pnpm install

dev:
	pnpm turbo run dev --parallel

build:
	pnpm turbo run build

lint:
	pnpm turbo run lint

type-check:
	pnpm turbo run type-check

test:
	pnpm turbo run test

clean:
	pnpm turbo run clean
	find . -name "*.tsbuildinfo" -delete
	find . -name "dist" -not -path "*/node_modules/*" -type d -exec rm -rf {} + 2>/dev/null; true
	find . -name ".next" -not -path "*/node_modules/*" -type d -exec rm -rf {} + 2>/dev/null; true

# =============================================================================
# Database
# =============================================================================

generate:
	pnpm --filter @company-intel/db exec prisma generate

migrate:
	pnpm --filter @company-intel/db exec prisma migrate deploy

migrate-dev:
	pnpm --filter @company-intel/db exec prisma migrate dev

migrate-reset:
	@echo "⚠️  WARNING: This will DROP all data. Press Ctrl+C to abort."
	@sleep 3
	pnpm --filter @company-intel/db exec prisma migrate reset --force

seed:
	pnpm --filter @company-intel/db exec tsx src/seed.ts

studio:
	pnpm --filter @company-intel/db exec prisma studio

# =============================================================================
# Docker
# =============================================================================

docker-dev:
	docker compose -f infra/docker-compose.dev.yml up -d
	@echo "✅ Postgres + Redis running. Apply migrations: make migrate"

docker-prod:
	docker compose -f infra/docker-compose.yml up -d --build
	@echo "✅ Production stack started."

docker-down:
	docker compose -f infra/docker-compose.yml down
	docker compose -f infra/docker-compose.dev.yml down

docker-logs:
	docker compose -f infra/docker-compose.yml logs -f

# =============================================================================
# Production deploy (run on server)
# =============================================================================

deploy:
	@echo "🚀 Deploying Company Intel Bot..."
	git pull origin main
	pnpm install --frozen-lockfile
	pnpm turbo run build
	$(MAKE) migrate
	@echo "📦 Copying Next.js static assets into standalone output..."
	cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
	@if [ -d "apps/web/public" ]; then cp -r apps/web/public apps/web/.next/standalone/apps/web/public; fi
	pm2 restart all --update-env
	pm2 save
	@echo "✅ Deploy complete."

# =============================================================================
# Backup / Restore
# =============================================================================

backup:
	bash infra/scripts/backup-postgres.sh

restore:
	bash infra/scripts/restore-postgres.sh

# =============================================================================
# Logs
# =============================================================================

logs:
	docker compose -f infra/docker-compose.yml logs -f --tail=100
