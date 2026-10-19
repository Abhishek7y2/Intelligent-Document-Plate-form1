# DocuNexa Sprint 8 — Implementation Plan: Separation of Duties, Approval Hierarchy & ERP Publishing

**Version:** 1.0 — Execution Plan  
**Target:** Sprint 8 (Approval Workflow, Governance & ERP Publication)  
**Roles:** Principal Backend Architect, Workflow Security Engineer, ERP Integration Engineer, PostgreSQL Specialist, Lead QA Engineer  
**Baseline:** Sprint 7 CONDITIONAL PASS (237/237 backend tests, 12/12 frontend tests, clean builds, PostgreSQL 16 on port 5434 blocked, port 5433 untouched).

---

## 1. Executive Summary & Sprint Scope Boundaries

Sprint 8 introduces **Enterprise Multi-Tier Governance, Strict Separation of Duties (SoD), and Outbound ERP Integration** to the DocuNexa Platform. It bridges the gap between verified Human-in-the-Loop (HITL) review outcomes and external enterprise ledger lock (SAP S/4HANA, NetSuite, Salesforce).

### Approved In-Scope Boundaries:
1. **Separation of Duties (SoD) Engine**:
   - Cryptographic and relational enforcement preventing self-approval:
     - Document uploaders/submitters are prohibited from approving (`SOD_VIOLATION_SUBMITTER`).
     - HITL reviewers who corrected or confirmed fields are prohibited from approving (`SOD_VIOLATION_REVIEWER`).
     - Sequential/parallel multi-stage sign-offs prohibit the same approver from signing multiple steps (`SOD_VIOLATION_DUPLICATE_APPROVER`).
   - Server-side authorization gates (cannot be bypassed by Angular client manipulation or direct API requests).
   - Tenant boundary isolation enforced on all approval lookups and mutations.
2. **Hierarchical Approval Rules & Monetary Tiers**:
   - **Tier 1 ($< \$10,000.00$)**: Single authorized Approver sign-off.
   - **Tier 2 (\$10,000.00 through \$50,000.00 inclusive)**: Dual-control (2 distinct authorized approvers required).
   - **Tier 3 ($> \$50,000.00$)**: Executive sign-off (requires Finance Head / Executive / Admin sign-off).
   - **Fail-Safe Missing/Invalid Handling**: Documents missing a monetary value or containing unparseable/invalid values cannot bypass approval; they fail safe to Tier 3 or remain blocked until financial fields are resolved.
3. **ERP Outbound Publishing Connector**:
   - Outbound REST webhook dispatcher supporting HMAC-SHA256 request signing (`X-DocuNexa-Signature`).
   - Idempotent dispatch with duplicate prevention (`X-DocuNexa-Idempotency-Key` tracking in `erp_publications`).
   - Bounded retries (3 attempts) with exponential backoff and timeout handling.
   - Failure classification (`TIMEOUT`, `CLIENT_ERROR`, `SERVER_ERROR`, `NETWORK_ERROR`).
   - Durable status tracking (`PENDING`, `DISPATCHING`, `PUBLISHED`, `FAILED`) and tamper-evident audit logging.
4. **Angular 19 Integration**:
   - `HttpApprovalService` wired to backend REST API endpoints via `ApiClient`.
   - Connected `Approvals` view with real loading, error handling, SoD badge rendering, and decision submissions.

### Explicit Out-of-Scope (Strict Guardrails):
- **Sprint 9 Scope Deferred**: Semantic search indexing, PostgreSQL full-text/pgvector clause diffing, compare studio API backend.
- **Port 5433 Host Safety**: Existing PostgreSQL 12.12 cluster on port 5433 remains strictly protected and untouched.
- **Port 5434 PostgreSQL 16 Integration**: Remains marked **BLOCKED** until the dedicated container is provisioned. Safe in-memory fallback is utilized for isolated unit testing.

---

## 2. Requirements Traceability Matrix

| BRD / FR Requirement | Feature Component | Backend Service & Controller | Schema / Persistence | Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **BRD-REQ-010** / **FR-010** | Separation of Duties (SoD) Enforcer | `ApprovalService.evaluateSod()`<br>`ApprovalController.submitDecision` | `approval_requests`<br>`approval_decisions` | `approval.service.spec.ts`<br>`approval.controller.spec.ts` |
| **BRD-REQ-011** / **FR-011** | Multi-Level Approval Hierarchy | `ApprovalService.determineTier()`<br>`ApprovalService.submitDecision` | `approval_requests.tier`<br>`approval_requests.required_approvals` | `approval.service.spec.ts`<br>`approval.controller.spec.ts` |
| **FR-010-GATE** | Pre-Flight Approval Gate & Invariants | `ApprovalService.validateGateConditions()` | `documents.status`<br>`documents.stage` | `approval.service.spec.ts` |
| **FR-022** | Tamper-Evident Approval Audit Trail | `ApprovalService.recordAuditLog()` | `review_audit_events`<br>`approval_decisions` | `approval.service.spec.ts` |
| **FR-013-ERP** | Outbound ERP Publishing Connector | `ErpPublisherService.publishDocument()`<br>`ErpController.retryPublication` | `erp_publications`<br>`erp_dispatch_logs` | `erp-publisher.service.spec.ts`<br>`erp.controller.spec.ts` |
| **FR-013-IDEMP** | Idempotency & Deduplication Engine | `ErpPublisherService.ensureIdempotency()` | `erp_publications.idempotency_key` | `erp-publisher.service.spec.ts` |
| **UI-SCR-09** | Angular 19 Approval Center Integration | `HttpApprovalService`<br>`ApprovalsComponent` | REST Client Integration | `http-approval.service.spec.ts`<br>`approvals.spec.ts` |

---

## 3. Monetary Threshold Rules & Boundary Specifications

| Monetary Value ($V$) | Approval Tier | Required Sign-offs | Required Roles | Boundary Test Cases |
| :--- | :---: | :---: | :--- | :--- |
| $0.00 \le V < \$10,000.00$ | **Tier 1** | 1 Approver | `Approver`, `FinanceHead`, `Admin` | `$9,999.99` $\rightarrow$ Tier 1<br>`$0.00` $\rightarrow$ Tier 1 |
| $\$10,000.00 \le V \le \$50,000.00$ | **Tier 2** | 2 Approvers (Distinct) | `Approver`, `FinanceHead`, `Admin` | `$10,000.00` $\rightarrow$ Tier 2<br>`$50,000.00` $\rightarrow$ Tier 2 |
| $V > \$50,000.00$ | **Tier 3** | 2 Approvers (at least 1 Executive) | `FinanceHead` or `Admin` mandatory | `$50,000.01` $\rightarrow$ Tier 3<br>`$2,500,000.00` $\rightarrow$ Tier 3 |
| Missing / NaN / Null / Negative | **Tier 3 (Fail-Safe)** | 2 Approvers (Executive) | `FinanceHead`, `Admin` | `null`, `""`, `"INVALID"`, `-$500.00` |

### Boundary Inclusivity Guarantees:
- **Exact \$10,000.00**: Evaluated as **Tier 2** (dual-approver required).
- **Exact \$50,000.00**: Evaluated as **Tier 2** (dual-approver required).
- **\$50,000.01**: Evaluated as **Tier 3** (executive sign-off required).
- **Non-Financial Documents (e.g. Policies)**: Default to 1-stage Policy Owner / Admin approval.

---

## 4. Separation of Duties (SoD) Invariants

1. **Rule 1 (Uploader Fence)**: If `userId === document.submittedBy`, approval is blocked:
   $$\text{Decision} \rightarrow 403 \text{ Forbidden } (\text{SOD\_VIOLATION\_SUBMITTER})$$
2. **Rule 2 (Reviewer Fence)**: If `userId === document.reviewedBy` or user has an entry in `field_corrections` for this document:
   $$\text{Decision} \rightarrow 403 \text{ Forbidden } (\text{SOD\_VIOLATION\_REVIEWER})$$
3. **Rule 3 (Sequential/Parallel Quorum Fence)**: In Tier 2 and Tier 3 workflows requiring $\ge 2$ approvals, an approver who already signed Step 1 cannot sign Step 2:
   $$\text{Decision} \rightarrow 403 \text{ Forbidden } (\text{SOD\_VIOLATION\_DUPLICATE\_APPROVER})$$
4. **Rule 4 (Version Immutability)**: Approval decisions must provide the target `sourceVersion`. If the document was updated to a newer version since review:
   $$\text{Decision} \rightarrow 409 \text{ Conflict } (\text{STALE\_VERSION\_ERROR})$$

---

## 5. Outbound ERP Publishing Architecture

```
                    ┌───────────────────────────┐
                    │  All Required Approvals   │
                    │        Completed          │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │  Status: APPROVED         │
                    │  Stage:  PENDING_PUBLISH  │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │   ErpPublisherService     │
                    │   - Generate Payload      │
                    │   - Calculate HMAC-SHA256 │
                    │   - Check Idempotency Key │
                    └─────────────┬─────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ▼                             ▼
       [Idempotent Hit: Exists]       [New Outbound Dispatch]
       Return Cached Publication       POST to ERP Endpoint
                                                 │
                                                 ▼
                                     ┌───────────────────────┐
                                     │  Bounded Retry (3x)   │
                                     │  Timeout (5000ms)     │
                                     └───────────┬───────────┘
                                                 │
                                 ┌───────────────┴───────────────┐
                                 │                               │
                                 ▼                               ▼
                           [HTTP 200/201]                  [HTTP 4xx/5xx/Timeout]
                        Status: PUBLISHED                 Status: FAILED / RETRYING
                        Audit: ERP_PUBLISHED              Audit: ERP_PUBLISH_FAILED
```

---

## 6. Database Migration DDL (PostgreSQL 16)
**File:** `backend/src/database/migrations/009_approvals_sod_and_erp_publishing.sql`

```sql
-- 1. Extend documents.status constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check 
    CHECK (status IN ('PENDING_SCAN', 'QUARANTINED', 'QUEUED', 'PROCESSING', 'STP_PROCESSED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'FAILED', 'PENDING_APPROVAL', 'PUBLISHED'));

-- 2. Approval Requests Table
CREATE TABLE IF NOT EXISTS approval_requests (
    request_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    tier VARCHAR(16) NOT NULL DEFAULT 'TIER_1',
    monetary_amount NUMERIC(14, 2),
    currency VARCHAR(8) DEFAULT 'USD',
    required_approvals INT NOT NULL DEFAULT 1,
    approved_count INT NOT NULL DEFAULT 0,
    source_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_approval_req_doc FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_req_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_approval_req_doc UNIQUE (document_id)
);

-- 3. Approval Decisions Table
CREATE TABLE IF NOT EXISTS approval_decisions (
    decision_id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    approver_id VARCHAR(64) NOT NULL,
    approver_name VARCHAR(255) NOT NULL,
    approver_role VARCHAR(64) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    reason_code VARCHAR(128) NOT NULL,
    comments TEXT,
    signature_hash VARCHAR(64) NOT NULL,
    source_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_decision_req FOREIGN KEY (request_id) REFERENCES approval_requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_decision_doc FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_decision_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 4. ERP Publications & Dispatch Log Table
CREATE TABLE IF NOT EXISTS erp_publications (
    publication_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    erp_target VARCHAR(64) NOT NULL DEFAULT 'SAP_S4HANA',
    idempotency_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    http_status_code INT,
    payload JSONB NOT NULL,
    last_error TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_erp_pub_doc FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_erp_pub_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_erp_pub_idempotency UNIQUE (tenant_id, idempotency_key)
);
```

---

## 7. Implementation Steps & Sequencing

1. **Step 1: Database Migration**: Author `009_approvals_sod_and_erp_publishing.sql`.
2. **Step 2: Backend Models & Types**: Create `backend/src/models/approval.models.ts` and `backend/src/models/erp.models.ts`.
3. **Step 3: Approval Service**: Implement `backend/src/services/approval.service.ts` with tier calculation, SoD validation, multi-stage quorum tracking, and audit logging.
4. **Step 4: ERP Publisher Service**: Implement `backend/src/services/erp-publisher.service.ts` with HMAC signature generator, idempotency manager, bounded retries, and failure classification.
5. **Step 5: Controllers & Routes**:
   - `ApprovalController` for `/approvals/queue`, `/approvals/:id`, `/approvals/:id/decide`.
   - `ErpController` for `/erp/publish/:id`, `/erp/status/:id`.
   - Mount routes in `backend/src/routes/api.routes.ts` with `authenticateJwt`, `enforceTenantIsolation`, and `requirePermission('DOC_APPROVE')`.
6. **Step 6: Frontend Integration**:
   - Create `HttpApprovalService` in `document-intelligence-ui/src/app/core/services/http-approval.service.ts`.
   - Wire `HttpApprovalService` into `Approvals` component.
7. **Step 7: Comprehensive Verification**:
   - Run backend tests (unit + regression).
   - Run frontend unit tests and production builds.
   - Author `docs/SPRINT_8_EXECUTION_REPORT.md`.
