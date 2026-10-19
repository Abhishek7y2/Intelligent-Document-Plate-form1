# DocuNexa — PostgreSQL 16 + pgvector Sandbox Provisioning Plan

**Version:** 1.1.0  
**Target Architecture:** ADR-002 Compliance (PostgreSQL 16 + pgvector)  
**Author:** Principal DevOps Engineer & Database Architect  
**Status:** **BLOCKED — Docker Desktop Installation & User Authorization Required**

---

## 1. Executive Summary

This plan establishes an isolated, pinned **PostgreSQL 16 + pgvector** sandbox environment for DocuNexa Sprint 3 migration verification and Sprint 4 vector development.

### Safety Enforcements
- **Port 5433 Untouched:** The existing PostgreSQL 12.12 instance and its 49-table `docunexa` database remain active and completely unaltered.
- **Dedicated Port 5434:** The sandbox binds exclusively to `127.0.0.1:5434:5432` on localhost.
- **Fail-Fast Secret Management:** No hard-coded or fallback passwords exist in Docker Compose. Mandatory variables must be set in `.env.sandbox` (excluded by `.gitignore`).
- **Container Execution Paused:** Because Docker Desktop is not currently installed on the host, configuration files have been prepared and execution is paused awaiting user installation and authorization.

---

## 2. Pinned Sandbox Specification

### 2.1 Artifacts Prepared in Repository
1. [`docker-compose.sandbox.yml`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docker-compose.sandbox.yml): Pinned Compose service specification.
2. [`docker/sandbox-init.sh`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/docker/sandbox-init.sh): Automated entrypoint script creating `uuid-ossp`, `pgcrypto`, `vector`, and dedicated application role `docunexa_app`.
3. [`.env.sandbox.example`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/.env.sandbox.example): Safe placeholder template for sandbox secrets.
4. [`.gitignore`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/.gitignore): Updated to guarantee `.env.sandbox` and `*.sandbox` are never committed.

### 2.2 Compose Service Definition (`docker-compose.sandbox.yml`)
```yaml
version: '3.8'

services:
  docunexa-postgres-16-sandbox:
    image: pgvector/pgvector:0.7.4-pg16
    container_name: docunexa-postgres-16-sandbox
    restart: unless-stopped
    ports:
      - "127.0.0.1:5434:5432"
    environment:
      POSTGRES_DB: docunexa_sandbox
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${SANDBOX_POSTGRES_PASSWORD:?Error: SANDBOX_POSTGRES_PASSWORD is mandatory and must be defined in .env.sandbox}
      SANDBOX_APP_PASSWORD: ${SANDBOX_APP_PASSWORD:?Error: SANDBOX_APP_PASSWORD is mandatory and must be defined in .env.sandbox}
    volumes:
      - docunexa_pg16_sandbox_data:/var/lib/postgresql/data
      - ./docker/sandbox-init.sh:/docker-entrypoint-initdb.d/01-init-sandbox.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d docunexa_sandbox"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  docunexa_pg16_sandbox_data:
    name: docunexa_pg16_sandbox_data
```

### 2.3 Least-Privilege Role & Extension Initialization (`docker/sandbox-init.sh`)
```bash
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";

    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docunexa_app') THEN
            CREATE ROLE docunexa_app WITH LOGIN PASSWORD '${SANDBOX_APP_PASSWORD}';
        ELSE
            ALTER ROLE docunexa_app WITH PASSWORD '${SANDBOX_APP_PASSWORD}';
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE docunexa_sandbox TO docunexa_app;
    GRANT ALL ON SCHEMA public TO docunexa_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO docunexa_app;
EOSQL
```

---

## 3. Host Infrastructure Verification Evidence

| Item | Check Executed | Result | Impact |
|---|---|---|---|
| **Docker Engine** | `docker --version` | Not recognized | Cannot launch container automatically |
| **WSL 2** | `wsl -l -v` | No installed distros | Docker Desktop WSL backend requires distro |
| **Port 5433** | Direct probe | Listening (PostgreSQL 12.12) | **Preserved untouched** |
| **Port 5434** | Direct socket probe | Connection refused (Free) | Ready for sandbox binding |

---

## 4. Exact Instructions to Launch the Sandbox

Once Docker Desktop is installed and running on your system:

### Step 1: Create Your Secret File
Copy the example file and supply strong local sandbox credentials:
```powershell
Copy-Item .env.sandbox.example .env.sandbox
```
Edit `.env.sandbox`:
```ini
SANDBOX_POSTGRES_PASSWORD=<generated-superuser-password>
SANDBOX_APP_PASSWORD=<generated-app-password>
```

### Step 2: Start the Sandbox Service
```powershell
docker compose --env-file .env.sandbox -f docker-compose.sandbox.yml up -d
```

### Step 3: Verify the Sandbox Environment
```powershell
# 1. Verify healthcheck status
docker ps --filter name=docunexa-postgres-16-sandbox

# 2. Verify PostgreSQL version and extensions inside the sandbox
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "SELECT version();"
docker exec -it docunexa-postgres-16-sandbox psql -U postgres -d docunexa_sandbox -c "\dx"
```

### Step 4: Configure the DocuNexa Backend
Update `backend/.env` to point to the sandbox:
```ini
DB_HOST=127.0.0.1
DB_PORT=5434
DB_USERNAME=docunexa_app
DB_PASSWORD=<generated-app-password>
DB_DATABASE=docunexa_sandbox

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5434
POSTGRES_USER=docunexa_app
POSTGRES_PASSWORD=<generated-app-password>
POSTGRES_DB=docunexa_sandbox
```

### Step 5: Execute and Verify Migrations
```powershell
cd backend
npm run build
node -e "import('./dist/database/migrations/migrate.js').then(m => m.runMigrations());"
```

---

## 5. Gate Verdict & Current Status

**VERDICT: BLOCKED — database version, provisioning, or authorization prerequisite missing**

- **Root Cause:** Docker Desktop is not installed on the host; container startup is safely paused.
- **Sprint 4 Boundary:** Paused awaiting explicit user authorization.
