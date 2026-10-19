# DocuNexa — PostgreSQL 16 + pgvector Sandbox Administrator Runbook

**Document Version:** 1.0.0  
**Target Architecture:** ADR-002 Compliance (PostgreSQL 16 LTS with pgvector 0.7.4)  
**Audience:** DevOps Engineer, Database Administrator, Platform Operations Engineer  
**Status:** **AUTHORITATIVE OPERATIONAL RUNBOOK**  

---

## 1. Overview & Safety Invariants

This runbook provides the verified, step-by-step procedures for provisioning the isolated **PostgreSQL 16 + pgvector** sandbox container for the DocuNexa Enterprise Document Intelligence Platform.

### Mandatory Safety Invariants:
1. **Port 5433 (PostgreSQL 12.12 Legacy Cluster) is Strictly Untouched:**
   - The production host database running on port 5433 (`docunexa`) must never be targeted for migrations, stopped, or modified.
2. **Port 5432 (PostgreSQL 18 Windows Service) is Prohibited:**
   - Do not substitute PostgreSQL 18 for PostgreSQL 16. ADR-002 and production architecture mandate PostgreSQL 16 LTS with pgvector.
3. **Dedicated Port 5434 Exclusively:**
   - The sandbox must bind exclusively to `127.0.0.1:5434:5432` on the host.
4. **Preflight Guard Protected:**
   - The project migration runner [migrate.ts](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/migrations/migrate.ts) enforces static and runtime safety checks that immediately reject ports 5432, 5433, non-sandbox database names, and non-16 engines before any DDL runs.
5. **No Committed Secrets:**
   - Secrets must reside exclusively in `.env.sandbox`, which is ignored by Git. Never hard-code or commit credentials.

---

## 2. Prerequisites & Administrative Permissions

Before initiating provisioning, the host administrator must ensure the following prerequisites are met:

| Prerequisite | Minimum Required Specification | Verification Command | Notes |
|---|---|---|---|
| **OS** | Windows 10/11 Pro, Enterprise, or Server | `systeminfo` | Requires virtualization enabled in BIOS/UEFI |
| **Container Engine** | Docker Desktop 4.30+ OR Podman 4.9+ | `docker --version` or `podman --version` | Requires Local Administrator rights to install |
| **WSL 2 Backend** | WSL 2 with Ubuntu or standard Linux distro | `wsl --list --verbose` | Required for Docker Desktop on Windows |
| **Node.js** | Node.js 20.x or 22.x LTS with npm | `node --version` | Required to execute project migration runner |
| **Port 5434 Free** | Local port 5434 not in use | `Get-NetTCPConnection -LocalPort 5434` | Throws if free; must not be occupied |

---

## 3. Secure Local Secret Setup

1. Copy the secret template in the repository root:
   ```powershell
   Copy-Item .env.sandbox.example .env.sandbox
   ```
2. Verify that `.env.sandbox` is ignored by Git:
   ```powershell
   git check-ignore -v .env.sandbox
   # Expected output: .gitignore:17:*.sandbox .env.sandbox
   ```
3. Generate fresh, cryptographically strong passwords for local sandbox use:
   ```powershell
   # Generate 32-character high-entropy secret
   $SuperuserPassword = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   $AppPassword = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```
4. Populate `.env.sandbox` with the generated passwords:
   ```ini
   # Pinned Superuser Password for sandbox container admin
   SANDBOX_POSTGRES_PASSWORD=<YourGeneratedSuperuserPassword>

   # Least-Privilege Application Role Password
   SANDBOX_APP_PASSWORD=<YourGeneratedAppPassword>
   ```

---

## 4. Sandbox Startup Procedures

1. Open PowerShell in the repository root:
   ```powershell
   cd "c:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main"
   ```
2. Launch the isolated sandbox container using Docker Compose:
   ```powershell
   docker compose --env-file .env.sandbox -f docker-compose.sandbox.yml up -d
   ```
3. Inspect startup logs to ensure initialization succeeded:
   ```powershell
   docker logs docunexa-postgres-16-sandbox
   # Look for: [DOCUNEXA SANDBOX] PostgreSQL 16 + pgvector initialization completed successfully.
   ```

---

## 5. Server Identity, Extension & Role Verification

Run the following non-destructive checks to confirm sandbox readiness before executing migrations:

### Check 1: Container Health Status
```powershell
docker ps --filter name=docunexa-postgres-16-sandbox --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
# Expected Status: Up (healthy)
# Expected Ports: 127.0.0.1:5434->5432/tcp
```

### Check 2: Verify PostgreSQL Version
```powershell
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "SELECT version();"
# Expected Output: PostgreSQL 16.x ... on x86_64-pc-linux-gnu
```

### Check 3: Verify Installed Extensions
```powershell
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "\dx"
# Must list:
# - uuid-ossp
# - pgcrypto
# - vector (version 0.7.4)
```

### Check 4: Verify Least-Privilege Role Privileges
```powershell
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "\du docunexa_app"
# Must confirm:
# - Role name: docunexa_app
# - Attributes: Cannot login? (No, Login is permitted)
# - Superuser: NO (Must be NOSUPERUSER)
```

### Check 5: Confirm Host Port 5433 Remains Untouched
```powershell
Get-NetTCPConnection -LocalPort 5433 | Select-Object LocalAddress, LocalPort, State, OwningProcess
# Confirm process 5004 (PostgreSQL 12.12) is listening and unmodified
```

---

## 6. Migration Execution (001–011)

Execute the approved migrations using the project's migration runner, which enforces all static and runtime preflight safety checks:

```powershell
cd "c:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\document_intelligence_platform-main\backend"

# Set environment variables for the migration execution context
$env:DB_PORT="5434"
$env:POSTGRES_PORT="5434"
$env:DB_DATABASE="docunexa_sandbox"
$env:POSTGRES_DB="docunexa_sandbox"
$env:DB_USERNAME="docunexa_app"
$env:POSTGRES_USER="docunexa_app"
$env:DB_PASSWORD="<YourGeneratedAppPassword>"
$env:POSTGRES_PASSWORD="<YourGeneratedAppPassword>"

# Run migrations
npm run migrate
```

### Expected Output:
```text
[INFO] [MIGRATION GUARD] Connecting to target database for runtime preflight verification...
[INFO] [MIGRATION GUARD PASSED] Verified PostgreSQL 16 sandbox environment.
[INFO] Applying migration '001_initial_schema.sql'...
[INFO] Migration '001_initial_schema.sql' applied successfully.
...
[INFO] Applying migration '011_transactional_outbox_events.sql'...
[INFO] Migration '011_transactional_outbox_events.sql' applied successfully.
[INFO] Migration runner completed successfully.
```

---

## 7. Migration Ledger & Schema Verification

Verify that all 11 migrations are recorded in the migration ledger:

```powershell
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "SELECT migration_id, applied_at FROM schema_migrations ORDER BY migration_id ASC;"
```
Expected rows:
1. `001_initial_schema.sql`
2. `002_identity_and_sessions.sql`
3. `003_rate_limit_entries.sql`
4. `004_document_types_templates_policies.sql`
5. `005_document_intake_and_quarantine.sql`
6. `006_ocr_geometry_and_pages.sql`
7. `007_classification_and_field_extraction.sql`
8. `008_review_workbench_and_audit.sql`
9. `009_approvals_sod_and_erp_publishing.sql`
10. `010_semantic_search_and_version_compare.sql`
11. `011_transactional_outbox_events.sql`

### Verify Idempotency:
Run `npm run migrate` a second time:
```powershell
npm run migrate
```
Verify that all 11 migrations report: `Migration '...' already applied. Skipping.`

---

## 8. Live Database Integration Acceptance

Execute the backend integration test suite against the live sandbox:

```powershell
cd "c:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\document_intelligence_platform-main\backend"

$env:POSTGRES_PORT="5434"
$env:POSTGRES_DB="docunexa_sandbox"
$env:POSTGRES_USER="docunexa_app"
$env:POSTGRES_PASSWORD="<YourGeneratedAppPassword>"

npm test
```

### What This Test Suite Exercises on PostgreSQL 16:
- **Vector Retrieval:** Inserts 1536-dimensional embeddings and sorts with `<=>` cosine distance operator.
- **HNSW Indexing:** Confirms index viability and query planning.
- **Dimension Boundary:** Confirms database rejects non-1536 vectors.
- **Multi-Tenant Isolation:** Confirms Tenant A vector queries return 0 chunks from Tenant B.
- **Concurrency Locking:** Exercises `FOR UPDATE SKIP LOCKED` on concurrent connections.
- **Transactional Outbox:** Verifies approval state changes and outbox event writes commit or roll back atomically.
- **Lease Recovery:** Reclaims abandoned events with expired leases.

All 6 previously skipped integration tests must report **PASS**.

---

## 9. Failure Recovery & Cleanup Instructions

### Restarting the Sandbox Service:
If the container needs to be restarted:
```powershell
docker compose --env-file .env.sandbox -f docker-compose.sandbox.yml restart
```

### Stopping the Sandbox (Preserving Data Volume):
To stop the sandbox without losing the migrated database:
```powershell
docker compose --env-file .env.sandbox -f docker-compose.sandbox.yml down
# Note: DO NOT use the -v flag! Named volume 'docunexa_pg16_sandbox_data' is preserved.
```

### Purging and Rebuilding Sandbox (Only When Authorized):
If a clean slate reset of the sandbox is explicitly requested:
```powershell
docker compose --env-file .env.sandbox -f docker-compose.sandbox.yml down -v
# This removes container and volume 'docunexa_pg16_sandbox_data'.
# Next startup will re-execute docker/sandbox-init.sh from scratch.
```

---

## 10. Summary Checklist for Sign-Off

- [ ] Docker / Podman runtime active.
- [ ] `.env.sandbox` created with fresh passwords and ignored by Git.
- [ ] Container `docunexa-postgres-16-sandbox` running on port 5434.
- [ ] PostgreSQL version verified as 16.x.
- [ ] Extension `vector` verified as 0.7.4.
- [ ] Role `docunexa_app` verified as `NOSUPERUSER`.
- [ ] Migrations 001–011 applied with 11 rows in `schema_migrations`.
- [ ] Idempotent re-run verified.
- [ ] Live PostgreSQL integration tests passing (6/6).
- [ ] Host port 5433 (PostgreSQL 12.12) verified untouched.
