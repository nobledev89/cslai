#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Production deployment script for Company Intel Bot
#
# Usage:
#   ./infra/scripts/deploy.sh [--skip-backup] [--no-migrate]
#
# What this does:
#   1. Pull latest code from git
#   2. Back up the database (unless --skip-backup)
#   3. Build all Docker images
#   4. Run Prisma migrations (unless --no-migrate)
#   5. Restart services with zero-downtime rolling update
#   6. Health-check the API
#   7. Clean up dangling images
#
# Requires:
#   - Docker Compose v2+
#   - .env file in repo root with all production secrets
#   - Git remote configured
# =============================================================================

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.yml"

SKIP_BACKUP=false
NO_MIGRATE=false
HEALTH_CHECK_RETRIES=20
HEALTH_CHECK_INTERVAL=5

# ─── Argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case "${arg}" in
    --skip-backup) SKIP_BACKUP=true ;;
    --no-migrate)  NO_MIGRATE=true ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      exit 1
      ;;
  esac
done

# ─── Helpers ────────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*"; }
log_section() { echo ""; echo "═══════════════════════════════════════════════"; log "▶ $*"; echo "═══════════════════════════════════════════════"; }

# ─── Load .env ──────────────────────────────────────────────────────────────────
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${REPO_ROOT}/.env"; set +a
  log "Loaded .env"
else
  log "⚠️  No .env file found at ${REPO_ROOT}/.env — using environment variables"
fi

# ─── Preflight checks ──────────────────────────────────────────────────────────
log_section "Preflight checks"

if ! command -v docker &>/dev/null; then
  echo "❌ docker is not installed or not in PATH" >&2; exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "❌ Docker Compose v2 not available. Run: apt install docker-compose-plugin" >&2; exit 1
fi

for var in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Required env var ${var} is not set" >&2; exit 1
  fi
done

log "✅ All preflight checks passed"

# ─── 1. Pull latest code ────────────────────────────────────────────────────────
log_section "Pulling latest code"
cd "${REPO_ROOT}"
git fetch --all
git pull origin "$(git rev-parse --abbrev-ref HEAD)"
log "✅ Code updated to: $(git rev-parse --short HEAD)"

# ─── 2. Database backup ─────────────────────────────────────────────────────────
if [[ "${SKIP_BACKUP}" == "false" ]]; then
  log_section "Database backup (pre-deploy)"
  # Only back up if postgres is already running
  if docker compose -f "${COMPOSE_FILE}" ps postgres 2>/dev/null | grep -q "running"; then
    "${SCRIPT_DIR}/backup-postgres.sh"
  else
    log "⚠️  postgres not running — skipping pre-deploy backup"
  fi
else
  log "⚠️  Skipping backup (--skip-backup)"
fi

# ─── 3. Build Docker images ──────────────────────────────────────────────────────
log_section "Building Docker images"
docker compose -f "${COMPOSE_FILE}" build \
  --pull \
  --parallel \
  api worker web

log "✅ Images built"

# ─── 4. Run Prisma migrations ────────────────────────────────────────────────────
if [[ "${NO_MIGRATE}" == "false" ]]; then
  log_section "Running Prisma migrations"
  # Start postgres only if not running
  docker compose -f "${COMPOSE_FILE}" up -d postgres redis
  log "Waiting for postgres to be healthy..."
  for i in $(seq 1 30); do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres \
        pg_isready -U "${POSTGRES_USER:-intel}" -d "${POSTGRES_DB:-company_intel}" &>/dev/null; then
      log "✅ Postgres ready"
      break
    fi
    if (( i == 30 )); then
      echo "❌ Postgres did not become healthy in time" >&2; exit 1
    fi
    sleep 2
  done

  # Run migrations using the api image which has prisma installed
  docker compose -f "${COMPOSE_FILE}" run --rm \
    --entrypoint="" \
    -e DATABASE_URL="postgresql://${POSTGRES_USER:-intel}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-company_intel}" \
    api \
    sh -c "cd /app/apps/api && npx prisma migrate deploy"

  log "✅ Migrations applied"
else
  log "⚠️  Skipping migrations (--no-migrate)"
fi

# ─── 5. Rolling service restart ─────────────────────────────────────────────────
log_section "Deploying services"
docker compose -f "${COMPOSE_FILE}" up -d \
  --remove-orphans \
  --no-build

log "✅ Services started"

# ─── 6. Health check ─────────────────────────────────────────────────────────────
log_section "Health check"
log "Waiting for API to be healthy (${HEALTH_CHECK_RETRIES} retries, ${HEALTH_CHECK_INTERVAL}s interval)..."

API_HEALTHY=false
for i in $(seq 1 "${HEALTH_CHECK_RETRIES}"); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    API_HEALTHY=true
    log "✅ API is healthy (HTTP 200)"
    break
  fi
  log "   Attempt ${i}/${HEALTH_CHECK_RETRIES} — status ${HTTP_STATUS}, retrying in ${HEALTH_CHECK_INTERVAL}s..."
  sleep "${HEALTH_CHECK_INTERVAL}"
done

if [[ "${API_HEALTHY}" == "false" ]]; then
  echo "" >&2
  echo "❌ API health check failed after ${HEALTH_CHECK_RETRIES} attempts" >&2
  echo "   Check logs: docker compose -f ${COMPOSE_FILE} logs api" >&2
  exit 1
fi

# ─── 7. Cleanup ──────────────────────────────────────────────────────────────────
log_section "Cleanup"
docker image prune -f
log "✅ Dangling images pruned"

# ─── Done ────────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✅  Deployment complete!                      ║"
echo "║                                               ║"
echo "║  Admin UI:  https://ai.corporatespec.com      ║"
echo "║  API:       https://api.ai.corporatespec.com  ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
log "Deployed commit: $(git rev-parse --short HEAD)"
