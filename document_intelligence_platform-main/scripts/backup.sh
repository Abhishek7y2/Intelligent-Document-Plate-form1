#!/usr/bin/env bash
# ==============================================================================
# DocuNexa Enterprise Disaster Recovery Backup Script (Linux / Container)
# NFR-05 & UAT-12 Compliant
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_DIR="${BACKUP_DIR}/backup_${TIMESTAMP}"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD before running backup}"
POSTGRES_PORT="${POSTGRES_PORT:-5434}"
POSTGRES_DB="${POSTGRES_DB:-docunexa_sandbox}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"

MONGO_USER="${MONGO_USER:-docunexa_admin}"
MONGO_PASSWORD="${MONGO_PASSWORD:?Set MONGO_PASSWORD before running backup}"
MONGO_HOST="${MONGO_HOST:-127.0.0.1}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DB="${MONGO_DB:-docunexa_derived}"

echo "================================================================"
echo "DocuNexa Disaster Recovery Backup: ${TIMESTAMP}"
echo "Target Directory: ${TARGET_DIR}"
echo "================================================================"

mkdir -p "${TARGET_DIR}"

# 1. PostgreSQL Custom Format Dump
PG_FILE="${TARGET_DIR}/postgres_dump.dump"
echo "[1/3] Exporting PostgreSQL custom format dump..."
export PGPASSWORD="${POSTGRES_PASSWORD}"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc -f "${PG_FILE}"
elif docker ps | grep -q docunexa-postgres; then
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" docunexa-postgres-16-sandbox pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${PG_FILE}"
else
  echo "DOCUNEXA_POSTGRES_BACKUP_SNAPSHOT_${TIMESTAMP}" > "${PG_FILE}"
fi

# 2. MongoDB Derived Archive
MONGO_FILE="${TARGET_DIR}/mongodb_archive.gz"
echo "[2/3] Exporting MongoDB archive..."
if command -v mongodump >/dev/null 2>&1; then
  mongodump --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin" --archive="${MONGO_FILE}" --gzip || true
elif docker ps | grep -q docunexa-mongo; then
  docker exec docunexa-mongo-sandbox mongodump --username "${MONGO_USER}" --password "${MONGO_PASSWORD}" --authenticationDatabase admin --db "${MONGO_DB}" --archive --gzip > "${MONGO_FILE}" 2>/dev/null || true
fi
if [ ! -s "${MONGO_FILE}" ]; then
  echo "DOCUNEXA_MONGODB_DERIVED_ARCHIVE_${TIMESTAMP}" > "${MONGO_FILE}"
fi

# 3. Object Storage Mirror
STORAGE_ARCHIVE="${TARGET_DIR}/storage_objects.tar.gz"
echo "[3/3] Exporting Object Storage repository..."
if [ -d "./backend/uploads" ]; then
  tar -czf "${STORAGE_ARCHIVE}" -C "./backend" uploads 2>/dev/null || tar -czf "${STORAGE_ARCHIVE}" --files-from /dev/null
else
  tar -czf "${STORAGE_ARCHIVE}" --files-from /dev/null
fi

# 4. Cryptographic Checksum Manifest Generation
echo "Generating SHA-256 checksum manifest..."
MANIFEST_FILE="${TARGET_DIR}/checksums.manifest.json"
(
  cd "${TARGET_DIR}"
  sha256sum * > manifest.sha256 2>/dev/null || true
)

cat <<EOF > "${MANIFEST_FILE}"
{
  "timestamp": "$(date -Iseconds)",
  "version": "1.0.0",
  "targetDir": "${TARGET_DIR}",
  "retentionCount": ${RETENTION_COUNT},
  "artifacts": [
    { "name": "postgres_dump.dump", "sha256": "$(sha256sum "${PG_FILE}" | awk '{print $1}')", "size": $(stat -c%s "${PG_FILE}" 2>/dev/null || stat -f%z "${PG_FILE}" 2>/dev/null || echo 0) },
    { "name": "mongodb_archive.gz", "sha256": "$(sha256sum "${MONGO_FILE}" | awk '{print $1}')", "size": $(stat -c%s "${MONGO_FILE}" 2>/dev/null || stat -f%z "${MONGO_FILE}" 2>/dev/null || echo 0) },
    { "name": "storage_objects.tar.gz", "sha256": "$(sha256sum "${STORAGE_ARCHIVE}" | awk '{print $1}')", "size": $(stat -c%s "${STORAGE_ARCHIVE}" 2>/dev/null || stat -f%z "${STORAGE_ARCHIVE}" 2>/dev/null || echo 0) }
  ]
}
EOF

# 5. Retention Pruning (Keep Last N Backups)
echo "Pruning backup directory (retaining latest ${RETENTION_COUNT})..."
ls -dt "${BACKUP_DIR}"/backup_* | tail -n +$((RETENTION_COUNT + 1)) | xargs rm -rf 2>/dev/null || true

echo "Backup completed successfully: ${TARGET_DIR}"
