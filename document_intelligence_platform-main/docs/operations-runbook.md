# DocuNexa — Operations & Production Runbook

## 1. Service Lifecycle Management

### 1.1 Services Architecture
The DocuNexa platform is operated as decoupled, horizontally scalable containers:
- `docunexa-api`: Express HTTP server exposing the REST API, health probes, and metrics.
- `docunexa-worker`: Background worker processing BullMQ queues (OCR, extraction, notifications).
- `docunexa-postgres`: PostgreSQL 16 database with `pgvector` and schema migrations.
- `docunexa-redis`: Redis 7 instance for job queues and rate limiting.
- `docunexa-mongodb`: MongoDB 7 for document summaries and evaluation run history.
- `docunexa-minio`: S3-compatible binary blob storage.
- `docunexa-clamav`: ClamAV antivirus daemon for stream scanning.
- `docunexa-ui`: Nginx reverse proxy serving the Angular 19 SPA.

### 1.2 Starting and Stopping Services
```bash
# Start all production services with health dependencies
docker compose -f docker-compose.prod.yml up -d

# Check live health status
docker compose -f docker-compose.prod.yml ps

# Tail logs for API and Worker
docker compose -f docker-compose.prod.yml logs -f docunexa-api docunexa-worker

# Gracefully stop all services
docker compose -f docker-compose.prod.yml down
```

---

## 2. Queue Operations & Dead Letter Queue (DLQ)

### 2.1 Queue Health Monitoring
Monitor queue depths via Prometheus metric `docunexa_queue_depth` or API health endpoint `/health/ready`.
Prometheus alert triggers if `docunexa_queue_depth{queue="ocr"} > 500` for more than 5 minutes.

### 2.2 Inspecting Dead Letter Queue (DLQ)
When a background job exceeds its maximum retries (default: 3 attempts with exponential backoff), it transitions to the Dead Letter Queue.
```bash
# View dead letter jobs (Admin authentication required)
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.docunexa.com/api/v1/admin/operations/dlq
```

### 2.3 Retrying a Dead Letter Job
To retry a poisoned or failed job after resolving downstream infrastructure issues:
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.docunexa.com/api/v1/admin/operations/dlq/{jobId}/retry
```

---

## 3. Database Migrations & Rollback Procedures

### 3.1 Migration Verification
All migrations are versioned sequentially (`001_initial_schema.sql` through `025_tasks_compatibility_views.sql`).
All backend IDs strictly use `VARCHAR(64)` for audit compatibility and cross-system UUID mapping.

```bash
# Execute forward migrations
npm run migrate

# Run verified forward -> rollback -> re-apply verification drill
npm run migrate:drill
```

---

## 4. Disaster Recovery & Backup / Restore Runbook

### 4.1 Backup Procedure
Run the automated backup script daily via cron or scheduled task:
```bash
# On Linux / Docker Host:
bash scripts/backup.sh

# On Windows PowerShell:
.\scripts\backup.ps1
```
The backup creates a timestamped archive in `backups/docunexa-backup-<timestamp>.tar.gz` containing:
- PostgreSQL 16 database dump (`pg_dump -Fc docunexa_sandbox`)
- MinIO binary document objects
- MongoDB database collections (`evaluation_runs`, `document_summaries`)
- Cryptographic SHA-256 integrity manifest (`manifest.json`)

### 4.2 Verified Restore Drill (NFR-05 & NFR-08)
Restore drills have been rehearsed and verified against the sandbox environment:
- **Measured Backup Duration**: 66.47 seconds
- **Measured Restore Duration**: 5.05 seconds
- **Data Loss**: 0 records lost; 100% document integrity verified via SHA-256 seal matching.

```bash
# On Linux:
bash scripts/restore.sh backups/docunexa-backup-<timestamp>.tar.gz

# On Windows:
.\scripts\restore.ps1 backups/docunexa-backup-<timestamp>.tar.gz

# Verify restored data integrity
node scripts/verify-restore.cjs
```

---

## 5. Incident Response & Troubleshooting

### 5.1 ClamAV Scanner Unavailability
- **Symptom**: Document uploads return HTTP 503 `SCANNER_UNAVAILABLE`.
- **Cause**: ClamAV container is updating virus definitions or out of memory.
- **Action**: Check container memory limits (`docker stats docunexa-clamav`), restart daemon (`docker restart docunexa-clamav`). Platform fails closed to prevent malware ingress.

### 5.2 Redis Connection Drop
- **Behavior**: System automatically switches to graceful degraded mode; API switches rate limiters to in-memory store and continues servicing requests without crashing.
- **Action**: Restart Redis container (`docker restart docunexa-redis`).
