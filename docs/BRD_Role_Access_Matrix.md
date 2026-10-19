# BRD Role & Access Control Matrix (RBAC & SoD)

**Authoritative Baseline:** Document Intelligence Platform BRD v1.0 Section 3  
**Implementation Source:** `backend/src/models/auth.models.ts`, `backend/src/middleware/auth.middleware.ts`, `document-intelligence-ui/src/app/core/models/permissions.ts`  
**Test Suite:** `backend/src/services/rbac-verification.spec.ts` (17 Automated Tests — 100% PASS)  
**Status:** ✅ Fully Enforced in Middleware & UI

---

## 1. Canonical Roles & Permissions Definition

```
                       CANONICAL BRD ROLE HIERARCHY
┌────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM OPERATOR                               │
│        (System Health Probes, Infrastructure Telemetry, No Docs)       │
└────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ORGANIZATION ADMIN                               │
│       (Users, Roles, Document Types, Templates, Policies, Queues)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   CONTRIBUTOR    │      │     REVIEWER     │      │     APPROVER     │
│ (Intake Upload,  │      │ (50/50 Canvas,   │      │ (Multi-Stage     │
│  Own Documents)  │      │  Math Check,     │      │  Approvals,      │
│                  │      │  Corrections)    │      │  SoD Dual-Ctrl)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AUDITOR / READER                                │
│       (Read-Only Search, Published Documents, Cryptographic Audit)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Granular Permission Tokens Matrix

| Permission Token | Canonical Description | Platform Operator | Organization Admin | Contributor | Reviewer | Approver | Auditor / Reader |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| `HEALTH_PROBE` | Access operational health checks and telemetry | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `TENANT_MANAGE` | Provision and configure tenant settings | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `USER_MANAGE` | Invite, assign roles, and deactivate users | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `SCHEMA_MANAGE` | Create, edit, and publish document schemas | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `POLICY_MANAGE` | Configure and publish business/validation rules | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `DOC_UPLOAD` | Ingest files via web, API, or email adapter | ❌ NO | ✅ YES | ✅ YES | ❌ NO | ❌ NO | ❌ NO |
| `DOC_VIEW` | Access document metadata and layout geometry | ❌ SHIELDED | ✅ YES | ✅ (Own Only) | ✅ YES | ✅ YES | ✅ (Approved) |
| `DOC_EDIT` | Modify document metadata and properties | ❌ NO | ✅ YES | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
| `DOC_VERIFY` | Accept, correct, or reject extracted fields | ❌ NO | ❌ NO | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
| `DOC_APPROVE` | Submit approval decisions (SoD enforced) | ❌ NO | ❌ NO | ❌ NO | ❌ NO | ✅ YES | ❌ NO |
| `COMPARE_VIEW` | Compare version redlines and clause diffs | ❌ SHIELDED | ✅ YES | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| `QA_QUERY` | Query document repository with page citations | ❌ SHIELDED | ✅ YES | ❌ NO | ✅ YES | ✅ YES | ✅ (Approved) |
| `AUDIT_VIEW` | Inspect cryptographic event logs and seals | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ✅ YES | ✅ YES |
| `EXPORT_GENERATE`| Generate and download scoped CSV/JSON exports | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ✅ (Masked) |
| `RETENTION_MANAGE`| Configure retention classes and freeze holds | ❌ NO | ✅ YES | ❌ NO | ❌ NO | ❌ NO | ❌ NO |

---

## 3. Separation of Duties (SoD) Dual-Control Rules

DocNexa enforces cryptographic Maker-Checker dual control in [`approval.controller.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/controllers/approval.controller.ts) and [`approval.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/approval.service.ts):

| SoD Rule Scenario | Requesting Actor Role | Document Context | Enforcement Mechanism | HTTP Response | Result |
|:---|:---|:---|:---|:---:|:---:|
| **Uploader Self-Approval** | `Approver` | Document was originally uploaded by same user (`uploadedBy === actorId`) | [`approval.controller.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/controllers/approval.controller.ts) detects identity match | `403 Forbidden` (`SOD_VIOLATION_SUBMITTER`) | 🛑 BLOCKED |
| **Reviewer Self-Approval** | `Approver` | Document fields were verified by same user (`verifiedBy === actorId`) | [`approval.controller.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/controllers/approval.controller.ts) detects review actor match | `403 Forbidden` (`SOD_VIOLATION_REVIEWER`) | 🛑 BLOCKED |
| **Independent Approver** | `Approver` | Distinct authorized user (`actorId !== uploadedBy && actorId !== verifiedBy`) | Verified through approval route policy stepper | `200 OK` (Decision Recorded) | ✅ ALLOWED |
| **Frontend SoD UI Warning** | `Approver` (in UI) | Document uploaded or reviewed by active user | Button disabled; renders `🛡️ SoD Protected: Cannot self-approve` banner | N/A (UI Disabled) | 🛑 BLOCKED |

---

## 4. Platform Operator Content Shielding (BRD Section 3)

The BRD mandates: *"Platform operator: Provision tenant and monitor processing health; No routine access to document content"*.

Implemented via [`shieldOperatorContent`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/middleware/auth.middleware.ts#L170-L185):

| Target Endpoint | Platform Operator Access | Standard Tenant User Access | Security Rule Enforced |
|:---|:---:|:---:|:---|
| `GET /api/v1/health` | ✅ ALLOWED (`200 OK`) | ✅ ALLOWED (`200 OK`) | Health monitoring open to platform operator |
| `GET /api/v1/documents` | 🛑 EMPTY (`[]` 0 docs) | ✅ ALLOWED (Filtered docs) | Content shielded from operator |
| `GET /api/v1/documents/:id` | 🛑 BLOCKED (`403 FORBIDDEN`) | ✅ ALLOWED (If authorized) | Explicit document access blocked |
| `POST /api/v1/search` | 🛑 0 RESULTS | ✅ ALLOWED (Snippet matches) | Zero document vectors exposed |
| `POST /api/v1/qa/query` | 🛑 BLOCKED (`403 FORBIDDEN`) | ✅ ALLOWED (Citations) | AI retrieval shielded from operator |
| `GET /api/v1/compare` | 🛑 BLOCKED (`403 FORBIDDEN`) | ✅ ALLOWED (Diffs) | Redline comparison shielded |

---

## 5. Multi-Tenant Isolation Verification

Tested using isolated synthetic tenants `TNT-CORP-01` (Tenant Alpha) and `TNT-CORP-02` (Tenant Beta):

| Test Vector | Attempted Action | Enforcement | Test Evidence | Verdict |
|:---|:---|:---|:---|:---:|
| **Cross-Tenant Document Read** | Tenant Alpha user requests `GET /api/v1/documents/DOC-TENANT-B` | [`enforceTenantIsolation`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/middleware/auth.middleware.ts) rejects query parameter override | Document query returns `404 Not Found` in Tenant A scope | ✅ PASS |
| **Cross-Tenant Vector Search** | Tenant Alpha user searches for confidential financial terms belonging to Tenant Beta | [`search.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/search.service.ts) filters embeddings by `tenant_id = $1` | Search returns 0 chunks; zero information leaked | ✅ PASS |
| **Cross-Tenant Compare** | Tenant Alpha user calls `POST /api/v1/compare` with Tenant B document ID | [`compare.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/compare.service.ts) asserts tenant on both document IDs | Throws `CompareTenantIsolationError` (`403 CROSS_TENANT_COMPARE_FORBIDDEN`) | ✅ PASS |
| **Cross-Tenant Q&A Query** | Tenant Alpha user asks question about Tenant Beta policy | [`qa.service.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/services/qa.service.ts) filters citation chunks strictly to `tenantId` | Q&A abstains with `abstain: true` ("No supporting evidence found") | ✅ PASS |
| **Header Spoofing Attack** | User injects `X-Tenant-ID: TNT-CORP-02` header with JWT signed for `TNT-CORP-01` | [`auth.middleware.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/middleware/auth.middleware.ts) validates cryptographic claims from JWT | Header rejected; request bounded strictly to JWT tenant | ✅ PASS |
