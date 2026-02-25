#!/usr/bin/env bash
# =============================================================================
# restore-postgres.sh — Restore a PostgreSQL backup
#
# Usage:
#   ./infra/scripts/restore-postgres.sh <backup-file.sql.gz>
#
# Example:
#   ./infra/scripts/restore-postgres.sh backups/company_intel_20240101_120000.sql.gz
#
# ⚠️  WARNING: This will DROP and recreate the target database!
#     Always verify the backup is valid before restoring to production.
#
# Requires:
#   - Docker Compose stack must be running (postgres service)
#   - POSTGRES_PASSWORD env var (or set in .env)
# =============================================================================

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_FILE="${1:-}"
COMPOSE_FILE="${REPO_ROOT}/infra/docker-compose.yml"
POSTGRES_USER="${POSTGRES_USER:-intel}"
POSTGRES_DB="${POSTGRES_DB:-company_intel}"

# ─── Validation ────────────────────────────────────────────────────────────────
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "❌ ERROR: No backup file specified." >&2
  echo "   Usage: $0 <backup-file.sql.gz>" >&2
  echo "" >&2
  echo "   Available backups:" >&2
  find "${REPO_ROOT}/backups" -name 'company_intel_*.sql.gz' 2>/dev/null | sort | tail -10 >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  # Try relative to repo root
  BACKUP_FILE="${REPO_ROOT}/${BACKUP_FILE}"
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "❌ ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

# ─── Load env ──────────────────────────────────────────────────────────────────
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

# ─── Confirmation prompt ────────────────────────────────────────────────────────
echo "⚠️  WARNING: This will DROP and recreate the database '${POSTGRES_DB}'!"
echo "   Backup file: ${BACKUP_FILE}"
echo ""
read -r -p "   Type 'yes' to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Restore ────────────────────────────────────────────────────────────────────
echo ""
echo "🔄 Dropping existing database '${POSTGRES_DB}'..."
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql --username="${POSTGRES_USER}" --dbname=postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" \
  -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"

echo "📥 Restoring from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" \
  | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
      psql \
        --username="${POSTGRES_USER}" \
        --dbname="${POSTGRES_DB}" \
        --no-password \
        --single-transaction \
        --quiet

echo "✅ Restore complete: database '${POSTGRES_DB}' restored successfully."
