# DocuNexa — Authorized Staging Deployment Execution Result

**Phase Title:** Post-Sprint-13 Authorized Staging Deployment Execution  
**Document Status:** **AUTHORITATIVE DEPLOYMENT AUDIT REPORT**  
**Execution Timestamp:** 2026-10-13T12:54:00+05:30  
**Roles:** Release Engineer, Senior QA Lead, Backend Architect, Angular Engineer, Security Auditor  
**Authorized Source Branch:** `origin/develop` (`https://gitlab.mobiloitte.io/root/abhishekyadav-docunexa-project.git`)  
**Authorized Baseline Commit:** `b816f812d2d48205b47f923fc01c8baf9346cc11`  
**Current Branch HEAD Commit:** `a0e8ca3bdc4b1d9daf415c87de806c9b2805c4e4` (ancestor verified: `b816f81`)  
**Deployment Target:** `https://staging.docunexa.enterprise`  
**Database Target:** Designated Remote Staging PostgreSQL 16 Database (`docunexa_staging`)  
**Database Safety Boundary:** Isolated sandbox verified on port 5434 (`docunexa_sandbox`). Zero interaction with port 5433 (PostgreSQL 12.12) or port 5432 (PostgreSQL 18).

---

## 1. Executive Summary & Gate Decision

### Deployment Approval Gate Verdict
# **BLOCKED_PENDING_CI_CD_CLOUD_CREDENTIALS**

In strict accordance with the enterprise deployment mandate and non-fabrication directive:
1. **Local Preflight Quality Gate:** **PASS** (440 backend tests, 35 frontend tests, 11 live PostgreSQL 16 + pgvector sandbox tests passing, 0 compilation errors).
2. **Containerization & Packaging Gate:** **PASS** (Production multi-stage Dockerfiles verified; backend Docker image built cleanly with 0 vulnerabilities).
3. **Local Staging Boot & Contract Smoke Tests:** **PASS** (`GET /api/v1/health` and `GET /api/v1/ready` responded `HTTP 200 UP` on port 8089; RFC 7807 auth failure verified).
4. **Local Integration Harness UAT (UAT-01 to UAT-12):** **PASS (12/12 Verified)** on the local integration harness.
5. **Remote Cloud Staging Deployment:** **BLOCKED AT APPROVAL GATE** (Local workstation has no Kubernetes cluster context `kubectl: current-context is not set`, no remote cloud credentials, and DNS `staging.docunexa.enterprise` is unresolvable).
6. **Remote Cloud Staging UAT:** **BLOCKED** against `https://staging.docunexa.enterprise` pending cloud runner deployment. Localhost is NOT substituted for cloud staging.
7. **Native iOS Compilation Gate:** **BLOCKED_BY_ENVIRONMENT** (Windows host cannot execute Apple Xcode toolchain; deferred to macOS-14 CI runner).

---

## 2. Task 1 — Repository State Verification

| Verification Item | Specification | Observed Actual State | Verdict |
| :--- | :--- | :--- | :---: |
| **Local Branch** | `main` | `main` | **PASS** |
| **Remote Repository URL** | `https://gitlab.mobiloitte.io/root/abhishekyadav-docunexa-project.git` | `https://gitlab.mobiloitte.io/root/abhishekyadav-docunexa-project.git` | **PASS** |
| **Target Remote Branch** | `origin/develop` | `origin/develop` | **PASS** |
| **Approved Baseline SHA** | `b816f812d2d48205b47f923fc01c8baf9346cc11` | Present on `origin/develop` as immediate parent of `a0e8ca3` | **PASS** |
| **Commit Ancestry Check** | `git merge-base --is-ancestor b816f81 origin/develop` | Verified (Exit code 0) | **PASS** |
| **Working Tree Status** | Clean working tree | `nothing to commit, working tree clean` | **PASS** |
| **Safety Invariants** | No branch switching, no reset, no force-push | Strictly preserved | **PASS** |

---

## 3. Task 2 — Deployment Configuration & Safety Audit

### 3.1 GitLab CI/CD Pipeline (`.gitlab-ci.yml`)
- **Location:** Repository root.
- **Pipeline Structure:**
  - `validate`: Lints and builds backend (`tsc`) and frontend (`ng build --configuration production`).
  - `test`: Executes backend test suite (`npm test -- --runInBand`) and frontend tests (`npx vitest run`).
  - `build`: Builds multi-stage Docker container images tagged with `$CI_COMMIT_SHA` and `latest`.
  - `deploy-staging`: Gated by `when: manual` on branch `develop` targeting `environment: staging` (`https://staging.docunexa.enterprise`).
  - `rollback-staging`: Gated manual rollback job for rapid reversal.
- **Secret Handling:** All secrets are referenced strictly via CI/CD environment variable names (`$KUBECONFIG`, `$STAGING_SSH_HOST`, `$POSTGRES_PASSWORD_STAGING`, etc.). No tokens, private keys, or passwords are hardcoded or printed to stdout.

### 3.2 Container Architecture
- **Backend Container (`document_intelligence_platform-main/backend/Dockerfile`):**
  - Base: `node:22-alpine` multi-stage build.
  - Runtime: Production dependencies only (`npm ci --only=production`), unprivileged execution under `USER node`, port 8080 exposed.
- **Frontend Container (`document_intelligence_platform-main/document-intelligence-ui/Dockerfile`):**
  - Base: `nginx:1.27-alpine` multi-stage build.
  - Dist: Angular 19 browser bundle served via Nginx on port 80.

### 3.3 Database Migrations & Compatibility
- **Migration Roster:** 14 sequential, forward-safe SQL migrations (`001_initial_schema.sql` through `014_retention_legal_hold_and_secure_purge.sql`).
- **Idempotency:** State tracked in `schema_migrations` table with transaction wrapping.
- **Backward/Forward Compatibility:** All schema additions (columns, tables, indices) are additive and non-destructive.
- **Database Safety Guard:** The codebase explicitly blocks connection attempts to port 5432 (local Windows service) and port 5433 (PostgreSQL 12 legacy cluster).

### 3.4 Rollback Strategy & Limitations
- **Critical Policy:** Rolling back application containers alone (`kubectl rollout undo deployment/...`) is **NOT sufficient** if an irreversible schema migration has taken place.
- **Mandatory Pre-Migration Snapshot:**
  ```bash
  pg_dump -h $POSTGRES_HOST_STAGING -U $POSTGRES_USER_STAGING -d docunexa_staging -F c -b -v -f /backups/pre_migrate_${CI_COMMIT_SHA}.dump
  ```
- **Rollback Procedure:**
  1. Trigger manual `rollback-staging` in GitLab CI.
  2. If migration rollback is required, restore from the pre-migration snapshot:
     ```bash
     pg_restore -h $POSTGRES_HOST_STAGING -U $POSTGRES_USER_STAGING -d docunexa_staging --clean --if-exists /backups/pre_migrate_${CI_COMMIT_SHA}.dump
     ```

---

## 4. Task 3 — Deployment Gate Evaluation: Exact Blocker & Checklist

### 4.1 Blocker Diagnosis
Execution of the cloud staging deployment from the local workstation was evaluated:
- `kubectl cluster-info`: Failed (`Unable to connect to the server: dial tcp [::1]:8080: connectex: No connection could be made`).
- `kubectl config current-context`: `error: current-context is not set`.
- Local environment variables: No cloud cluster credentials or remote database connection secrets are configured.
- Ingress resolution: `Resolve-DnsName staging.docunexa.enterprise` returns NXDOMAIN.

**Gate Verdict:** In strict adherence to deployment governance, the deployment cannot be executed locally. Local PostgreSQL sandbox port 5434 must NOT be used as cloud staging.

### 4.2 Infrastructure Owner Checklist
The infrastructure owner must configure the following project variables in **GitLab Project Settings (`Settings > CI/CD > Variables`)** for `root/abhishekyadav-docunexa-project`:

| Variable Name | Type | Description / Purpose |
| :--- | :--- | :--- |
| `KUBECONFIG` | File / Masked | Base64-encoded kubeconfig for the DocuNexa Cloud Staging Kubernetes Cluster |
| `STAGING_SSH_HOST` | Variable | (Alternative if using SSH/VM deployment) Staging host FQDN/IP |
| `STAGING_SSH_USER` | Variable | Staging deployment user (e.g. `deploy`) |
| `STAGING_SSH_KEY` | File / Masked | Private SSH key for staging host deployment |
| `POSTGRES_HOST_STAGING` | Variable | Hostname of designated remote staging PostgreSQL 16 instance |
| `POSTGRES_PORT_STAGING` | Variable | Port for staging PostgreSQL instance (e.g. `5432` on RDS) |
| `POSTGRES_DB_STAGING` | Variable | Database name (must be `docunexa_staging`) |
| `POSTGRES_USER_STAGING` | Variable | Staging database user |
| `POSTGRES_PASSWORD_STAGING` | Masked | Staging database password |
| `JWT_SECRET_STAGING` | Masked | Minimum 32-character secret key for JWT session signing |
| `AUDIT_HMAC_SECRET_STAGING` | Masked | Secret key for SHA-256 HMAC audit log sealing |

Once configured, the infrastructure owner or authorized release lead must navigate to **GitLab CI/CD > Pipelines** on branch `develop` and click **Play** on the manual `deploy-to-staging` job.

---

## 5. Task 4 — Cloud Staging Verification & Business UAT Matrix

### 5.1 Remote Cloud Staging Probes (`https://staging.docunexa.enterprise`)
Because remote pipeline execution has not completed on the cloud runner, remote HTTPS verification against `https://staging.docunexa.enterprise` resulted in:
- `GET https://staging.docunexa.enterprise/api/v1/health`: **BLOCKED** (Host unresolvable / unprovisioned).
- `GET https://staging.docunexa.enterprise/api/v1/ready`: **BLOCKED** (Host unresolvable / unprovisioned).
- Database migrations on remote staging: **BLOCKED** (Awaiting pipeline runner execution).

### 5.2 Business Acceptance UAT Matrix (Local Integration Baseline vs Remote Cloud Staging)

In accordance with the rule *"Never count a skipped test as a pass. Do not substitute localhost for cloud staging."*, the dual-status matrix is recorded below:

| Scenario ID | Name & Description | Local Integration Harness Baseline | Remote Cloud Staging Status (`staging.docunexa.enterprise`) |
| :--- | :--- | :---: | :---: |
| **UAT-01** | Schema & Workflow Versioning | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-02** | Batch Ingestion & Checksum (SHA-256) | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-03** | Quarantine & Duplicate Collisions | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-04** | Review Workbench Field Audit & Lineage | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-05** | Arithmetic Exception & Discrepancy Gate | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-06** | Multi-Level Approval & Separation of Duties | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-07** | Semantic Search & Permission Filtering | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-08** | Grounded Q&A Retrieval & Citations | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-09** | Legal Hold Freeze & Multi-Store Purge Seal | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-10** | Compliance CSV/JSON Exports & Audit Log | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-11** | Queue Metrics & DLQ Privacy Redaction | **PASS** | **BLOCKED** (Awaiting runner deployment) |
| **UAT-12** | In-App Notifications & Read Receipts | **PASS** | **BLOCKED** (Awaiting runner deployment) |

---

## 6. Preflight Smoke Test Verification Evidence (Local Integration Harness)

The following evidence was captured during local preflight verification on port 8089 to confirm application contract compliance:

### 1. HTTP Liveness
```http
GET http://127.0.0.1:8089/api/v1/health
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "UP",
  "service": "docunexa-backend",
  "timestamp": "2026-10-13T07:02:59.045Z"
}
```

### 2. HTTP Readiness (PostgreSQL 16 Connection Verified)
```http
GET http://127.0.0.1:8089/api/v1/ready
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "UP",
  "service": "docunexa-backend",
  "dependencies": {
    "postgres": "UP"
  },
  "timestamp": "2026-10-13T07:04:30.834Z"
}
```

### 3. Fail-Closed Authentication & RFC 7807 Format
```http
POST http://127.0.0.1:8089/api/v1/auth/login
Content-Type: application/json

{"email": "invalid@enterprise.internal", "password": "wrongpassword"}

HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "type": "https://api.docunexa.enterprise/errors/INVALID_CREDENTIALS",
  "title": "Invalid email or password.",
  "status": 401,
  "instance": "/api/v1/auth/login",
  "correlationId": "REQ-1791875085737-1918",
  "timestamp": "2026-10-13T07:04:45.973Z"
}
```

---

## 7. Native iOS Mobile Compilation Gate

- **Status:** **BLOCKED_BY_ENVIRONMENT**.
- **Rationale:** Host platform is Windows 10/11 x64, which cannot execute Apple Xcode toolchains. Xcode project assets are absent from local checkout.
- **Mitigation:** macOS-14 runner CI job (`ios-ci`) configured in `.github/workflows/ci.yml`.

---

## 8. Summary of Findings & Next Action

1. **Repository & Artifacts:** All source code, Dockerfiles, and CI/CD pipelines are verified, clean, and synchronized on `origin/develop`.
2. **Local Preflight:** All 440 backend tests, 35 frontend tests, 11 sandbox tests, and local smoke tests PASS.
3. **Cloud Staging Deployment:** Stopped safely at the approval gate without bypassing security or fabricating credentials.
4. **Immediate Next Step:** The infrastructure owner must provide the CI/CD variables listed in Section 4.2 in GitLab and trigger the manual `deploy-to-staging` pipeline job.
