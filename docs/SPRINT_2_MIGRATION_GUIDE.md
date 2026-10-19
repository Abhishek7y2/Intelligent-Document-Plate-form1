# DocuNexa Sprint 2: Database Migration Guide

**Target Database:** PostgreSQL 16  
**New Additive Migration:** `002_identity_and_sessions.sql`  

---

## 1. Migration Summary

This additive migration adds multi-tenant membership mapping and persistent session tracking for refresh token rotation:
- `tenant_memberships`: Maps users to multiple tenants with specific roles (`Admin`, `Reviewer`, `Analyst`, `Auditor`).
- `auth_sessions`: Tracks active refresh sessions, stores SHA-256 hashed refresh secrets, and manages `family_id` for reuse detection.

---

## 2. Execution Command

```bash
cd document_intelligence_platform-main/backend
npm run build
node dist/database/migrations/migrate.js
```
The migration runner records `002_identity_and_sessions.sql` in `schema_migrations` transactionally.
