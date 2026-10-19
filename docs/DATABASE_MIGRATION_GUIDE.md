# DocuNexa PostgreSQL Database Migration Guide

**Target Database:** PostgreSQL 16  
**Migration Directory:** `backend/src/database/migrations/`  

---

## 1. Migration Overview

DocuNexa uses an idempotent, transactional versioned SQL migration runner (`migrate.ts`).

- Every migration is an isolated `.sql` file starting with a numerical prefix (e.g., `001_initial_schema.sql`).
- Executed migrations are tracked in the `schema_migrations` table.
- Re-running the migration runner safely skips already-applied migrations.

---

## 2. Executing Migrations

To apply pending database migrations against your local or staging PostgreSQL instance:

```bash
cd document_intelligence_platform-main/backend
npm run build
node dist/database/migrations/migrate.js
```
