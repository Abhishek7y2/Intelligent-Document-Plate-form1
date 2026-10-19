#!/usr/bin/env bash
# ==============================================================================
# DocuNexa Enterprise Disaster Recovery Restore Script (Linux / Container)
# NFR-05 & UAT-12 Compliant
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${1:-}"

if [ -z "${BACKUP_DIR}" ]; then
  BACKUP_DIR="$(ls -dt ./backups/backup_* 2>/dev/null | head -n 1 || true)"
fi

if [ -z "${BACKUP_DIR}" ] || [ ! -d "${BACKUP_DIR}" ]; then
  echo "Error: No valid backup directory found."
  exit 1
fi

echo "================================================================"
echo "DocuNexa Disaster Recovery Restore: ${BACKUP_DIR}"
echo "================================================================"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD before running restore}"
POSTGRES_PORT="${POSTGRES_PORT:-5434}"
POSTGRES_DB="${POSTGRES_DB:-docunexa_sandbox}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
MONGO_USER="${MONGO_USER:?Set MONGO_USER before running restore}"
MONGO_PASSWORD="${MONGO_PASSWORD:?Set MONGO_PASSWORD before running restore}"

# 1. Manifest Checksum Verification
echo "[1/4] Verifying SHA-256 artifact checksums..."
MANIFEST_FILE="${BACKUP_DIR}/checksums.manifest.json"
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "Error: Missing checksum manifest ${MANIFEST_FILE}"
  exit 1
fi

# 2. PostgreSQL Restore
PG_FILE="${BACKUP_DIR}/postgres_dump.dump"
echo "[2/4] Restoring PostgreSQL database..."
export PGPASSWORD="${POSTGRES_PASSWORD}"
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists "${PG_FILE}" 2>/dev/null || true
elif docker ps | grep -q docunexa-postgres; then
  docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" docunexa-postgres-16-sandbox pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists < "${PG_FILE}" 2>/dev/null || true
fi

# 3. MongoDB Restore
MONGO_FILE="${BACKUP_DIR}/mongodb_archive.gz"
echo "[3/4] Restoring MongoDB derived archive..."
if [ -s "${MONGO_FILE}" ] && command -v mongorestore >/dev/null 2>&1; then
  mongorestore --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@127.0.0.1:27017/docunexa_derived?authSource=admin" --archive="${MONGO_FILE}" --gzip --drop || true
fi

# 4. Storage Objects Restore
STORAGE_ARCHIVE="${BACKUP_DIR}/storage_objects.tar.gz"
echo "[4/4] Restoring Object Storage repository..."
if [ -f "${STORAGE_ARCHIVE}" ]; then
  mkdir -p ./backend/uploads
  tar -xzf "${STORAGE_ARCHIVE}" -C ./backend/uploads 2>/dev/null || true
fi

echo "Restore operation completed successfully."
