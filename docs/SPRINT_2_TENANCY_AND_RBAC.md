# DocuNexa Sprint 2: Multi-Tenancy & RBAC Matrix

**Focus:** Enterprise Tenant Isolation Boundaries & Dynamic Role Enforcement  

---

## 1. Multi-Tenant Isolation Rules

1. **No Client-Side Authority:** The backend derives the active tenant exclusively from verified JWT token claims. Client-supplied headers like `x-tenant-id` are validated against `req.user.tenantId`. If a client attempts to override the tenant ID with a foreign tenant, `enforceTenantIsolation` throws a **403 `CROSS_TENANT_FORBIDDEN`**.
2. **Database Query Fencing:** Every SQL query fetching documents, users, or audit records includes `WHERE tenant_id = $1` matching the verified token context.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Permission | Description | Admin | Reviewer | Analyst | Auditor |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `DOC_VIEW` | View document metadata & PDF layout | ✅ | ✅ | ✅ | ✅ |
| `DOC_EDIT` | Edit field candidate values | ✅ | ✅ | ❌ | ❌ |
| `DOC_VERIFY` | Mark field candidates verified | ✅ | ✅ | ❌ | ❌ |
| `DOC_APPROVE` | Publish document to downstream ERP | ✅ | ❌ | ❌ | ❌ |
| `DOC_DELETE` | Delete or purge document record | ✅ | ❌ | ❌ | ❌ |
| `REPORT_GENERATE` | Generate and export CSV/PDF reports | ✅ | ✅ | ✅ | ✅ |
| `COMPARE_VIEW` | Access clause diff comparison engine | ✅ | ✅ | ✅ | ❌ |
| `QA_QUERY` | Query natural language RAG assistant | ✅ | ✅ | ✅ | ❌ |
| `AUDIT_VIEW` | Inspect immutable audit logs | ✅ | ❌ | ❌ | ✅ |
| `ADMIN_ACCESS` | Access platform administration portal | ✅ | ❌ | ❌ | ❌ |
| `USER_MANAGE` | Invite, deactivate or change user roles| ✅ | ❌ | ❌ | ❌ |
