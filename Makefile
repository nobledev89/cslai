# =============================================================================
# Company Intel Bot — Makefile
# Usage: make <target>
# =============================================================================

.PHONY: help dev build lint type-check test clean \
        install migrate migrate-dev migrate-reset seed generate studio \
        docker-dev docker-down \
        deploy backup restore logs pm2-status pm2-restart pm2-stop pm2-start

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
	@echo "    make migrate       Run pending Prisma migrations (production)"
	@echo "    make migrate-dev   Create + apply a new migration (development)"
	@echo "    make migrate-reset Drop DB + re-run all migrations (DEV only)"
	@echo "    make seed          Seed DB with super-admin tenant + user"
	@echo "    make studio        Open Prisma Studio (browser DB GUI)"
	@echo ""
	@echo "  Docker (PostgreSQL + Redis only)"
	@echo "    make docker-dev    Start Postgres + Redis in Docker"
	@echo "    make docker-down   Stop and remove Docker containers"
	@echo ""
	@echo "  Production (PM2)"
	@echo "    make deploy        Pull latest + rebuild + restart PM2 services"
	@echo "    make pm2-status    Show PM2 process status"
	@echo "    make pm2-restart   Restart all PM2 processes"
	@echo "    make pm2-stop      Stop all PM2 processes"
	@echo "    make pm2-start     Start PM2 processes from ecosystem.config.js"
	@echo "    make logs          Tail all PM2 process logs"
	@echo "    make backup        Dump Postgres to ./backups/"
	@echo "    make restore       Restore a Postgres backup (interactive)"
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
# Docker (PostgreSQL + Redis only)
# =============================================================================

docker-dev:
	docker compose -f infra/docker-compose.dev.yml up -d
	@echo "✅ Postgres + Redis running. Apply migrations: make migrate"

docker-down:
	docker compose -f infra/docker-compose.dev.yml down

# =============================================================================
# Production deploy (run on server — uses PM2)
# =============================================================================

deploy:
	@echo "🚀 Deploying Company Intel Bot..."
	@echo "🔄 Fetching latest changes..."
	git fetch origin main
	git reset --hard origin/main
	pnpm install --no-frozen-lockfile
	$(MAKE) generate
	pnpm turbo run build
	@if [ -f .env ]; then export $$(grep -v '^#' .env | xargs); fi && $(MAKE) migrate
	@echo "📦 Copying Next.js static assets into standalone output..."
	cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
	@if [ -d "apps/web/public" ]; then cp -r apps/web/public apps/web/.next/standalone/apps/web/public; fi
	@echo "🔧 Updating Caddy configuration..."
	sudo cp infra/Caddyfile /etc/caddy/Caddyfile
	sudo systemctl reload caddy
	@echo "🔄 Restarting application services..."
	pm2 restart all --update-env
	pm2 save
	@echo "✅ Deploy complete."

pm2-status:
	pm2 status

pm2-restart:
	pm2 restart all --update-env

pm2-stop:
	pm2 stop all

pm2-start:
	pm2 start ecosystem.config.js

logs:
	pm2 logs

# =============================================================================
# Backup / Restore
# =============================================================================

backup:
	bash infra/scripts/backup-postgres.sh

restore:
	bash infra/scripts/restore-postgres.sh
