#!/usr/bin/env bash
# =============================================================================
# backup-postgres.sh — Dump the production PostgreSQL database
#
# Usage:
#   ./infra/scripts/backup-postgres.sh [output-dir]
#
# Defaults:
#   Output directory: ./backups  (relative to repo root)
#   Filename:         company_intel_YYYYMMDD_HHMMSS.sql.gz
#
# Requires:
#   - Docker Compose stack must be running (postgres service)
#   - POSTGRES_PASSWORD env var (or set in .env)
# =============================================================================

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

OUTPUT_DIR="${1:-${REPO_ROOT}/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="company_intel_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${OUTPUT_DIR}/${FILENAME}"

COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.yml"
POSTGRES_USER="${POSTGRES_USER:-intel}"
POSTGRES_DB="${POSTGRES_DB:-company_intel}"

# ─── Preflight ──────────────────────────────────────────────────────────────────
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  if [[ -f "${REPO_ROOT}/.env" ]]; then
    # shellcheck disable=SC1091
    source "${REPO_ROOT}/.env"
  fi
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "❌ ERROR: POSTGRES_PASSWORD is not set. Export it or add to .env" >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

# ─── Backup ────────────────────────────────────────────────────────────────────
echo "📦 Backing up database '${POSTGRES_DB}' → ${BACKUP_PATH}"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
  | gzip > "${BACKUP_PATH}"

BACKUP_SIZE="$(du -sh "${BACKUP_PATH}" | cut -f1)"
echo "✅ Backup complete: ${BACKUP_PATH} (${BACKUP_SIZE})"

# ─── Retention: keep last 30 backups ────────────────────────────────────────────
KEEP=30
BACKUP_COUNT="$(find "${OUTPUT_DIR}" -name 'company_intel_*.sql.gz' | wc -l)"
if (( BACKUP_COUNT > KEEP )); then
  echo "🧹 Pruning old backups (keeping last ${KEEP})..."
  find "${OUTPUT_DIR}" -name 'company_intel_*.sql.gz' \
    | sort \
    | head -n "-${KEEP}" \
    | xargs rm -f
  echo "   Removed $((BACKUP_COUNT - KEEP)) old backup(s)"
fi
