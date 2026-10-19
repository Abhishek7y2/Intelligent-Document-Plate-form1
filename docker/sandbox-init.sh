#!/bin/bash
set -e

# DocuNexa PostgreSQL 16 Sandbox Initialization Script
# Executes on initial container database cluster creation

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 1. Enable Cryptographic & Vector Extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";

    -- 2. Create Dedicated Least-Privilege Application Role
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docunexa_app') THEN
            CREATE ROLE docunexa_app WITH LOGIN PASSWORD '${SANDBOX_APP_PASSWORD}';
        ELSE
            ALTER ROLE docunexa_app WITH PASSWORD '${SANDBOX_APP_PASSWORD}';
        END IF;
    END
    \$\$;

    -- 3. Grant Scoped Permissions on docunexa_sandbox
    GRANT CONNECT ON DATABASE docunexa_sandbox TO docunexa_app;
    GRANT ALL ON SCHEMA public TO docunexa_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE docunexa_app IN SCHEMA public GRANT ALL ON TABLES TO docunexa_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE docunexa_app IN SCHEMA public GRANT ALL ON SEQUENCES TO docunexa_app;
EOSQL

echo "[DOCUNEXA SANDBOX] PostgreSQL 16 + pgvector initialization completed successfully."
