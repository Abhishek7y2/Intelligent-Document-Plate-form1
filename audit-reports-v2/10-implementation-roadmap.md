# DocNexa — Prioritized Implementation & Remediation Roadmap (Reconciled Baseline v2.0)

**Document ID:** AUDIT-REP-10-V2  
**Audit Date:** 2026-10-13T18:46:00+05:30  
**Evaluator:** Technical Project Manager & Principal Solutions Architect  

---

## 1. Roadmap Overview & Phasing Strategy

The remaining engineering activities are focused on transitioning DocNexa from verified local integration into an authorized multi-node cloud staging cluster, completing formal business UAT sign-off, and scheduling optional extensions.

---

## 2. Work Packages by Stage

### Stage 0: Baseline & Deployment Prerequisites
* **Objective:** Establish the containerized deployment environment and provision staging cloud credentials.
* **Tasks:**
  - **TSK-0.1:** Finalize Kubernetes deployment manifests (`k8s/`) and Docker container image builds. (Effort: 12h | Priority: P1)
  - **TSK-0.2:** Provision MinIO / AWS S3 staging bucket and configure IAM access credentials. (Effort: 6h | Priority: P1)
  - **TSK-0.3:** Connect enterprise staging SMTP/IMAP credentials in Kubernetes secrets. (Effort: 4h | Priority: P1)
* **Stage Total:** 22 engineering hours (~3 person-days).

### Stage 1: Cloud Staging Deployment & Multi-AZ Cluster
* **Objective:** Deploy DocNexa onto a multi-node Kubernetes staging cluster to validate NFR-01 and NFR-05.
* **Tasks:**
  - **TSK-1.1:** Deploy PostgreSQL 16 with pgvector on managed cloud database with WAL replication. (Effort: 16h | Priority: P1)
  - **TSK-1.2:** Deploy backend API pods with horizontal pod autoscaling (HPA) and Redis session cache. (Effort: 12h | Priority: P1)
  - **TSK-1.3:** Deploy Angular frontend via Nginx ingress controller with TLS 1.3 certificates. (Effort: 8h | Priority: P1)
* **Stage Total:** 36 engineering hours (~4.5 person-days).

### Stage 2: Operational Enhancements & Ingestion Adapters
* **Objective:** Complete background IMAP polling daemon and refine task visualization.
* **Tasks:**
  - **TSK-2.1:** Deploy background IMAP poller worker for automated corporate inbox ingestion (`FR-004`). (Effort: 16h | Priority: P2)
  - **TSK-2.2:** Add optional calendar/timeline Gantt view to Tasks Hub (`SCR-15`). (Effort: 8h | Priority: P2)
  - **TSK-2.3:** Add IMAP status card to Admin Integrations (`SCR-25`). (Effort: 6h | Priority: P2)
* **Stage Total:** 30 engineering hours (~3.5 person-days).

### Stage 3: Security & Disaster Recovery Rehearsal
* **Objective:** Validate RPO/RTO objectives and execute external penetration testing.
* **Tasks:**
  - **TSK-3.1:** Execute simulated database failover and restore drill to demonstrate BRD baseline RTO <8h / RPO <24h and test sub-hour WAL streaming targets (`NFR-05`). (Effort: 12h | Priority: P1)
  - **TSK-3.2:** Execute third-party SAST/DAST automated vulnerability scan and resolve any findings (`NFR-06`). (Effort: 16h | Priority: P1)
* **Stage Total:** 28 engineering hours (~3.5 person-days).

### Stage 4: Formal Business UAT Sign-Off
* **Objective:** Conduct formal stakeholder UAT sessions for UAT-01 through UAT-12 on live staging workspace.
* **Tasks:**
  - **TSK-4.1:** Seed staging environment with synthetic business corpus (Supplier Contracts, Purchase Invoices, Tax Forms). (Effort: 8h | Priority: P1)
  - **TSK-4.2:** Conduct guided UAT walkthroughs with business personas (Reviewer, Approver, Auditor, Admin). (Effort: 16h | Priority: P1)
  - **TSK-4.3:** Document sign-off certificates and baseline production release decision. (Effort: 8h | Priority: P1)
* **Stage Total:** 32 engineering hours (~4 person-days).

---

### Total Engineering Effort to Staging Gate & Sign-Off:
- **Core Web & Cloud Staging Total:** **148 engineering hours** (~18.5 person-days).

---

### Stage 5: Optional Mobile Channel Expansion (Phase 4 Architecture Extension)
* **Objective:** Standalone native iOS document scanner application (`ADR-003`). (Non-blocker for web release).
* **Tasks:**
  - **TSK-5.1:** Initialize Swift iOS project with Vision framework camera edge detection. (Effort: 40h | Priority: P3)
  - **TSK-5.2:** Implement secure upload and mobile approval workflow connected to backend REST APIs. (Effort: 48h | Priority: P3)
  - **TSK-5.3:** Biometric Keychain authentication and offline caching. (Effort: 32h | Priority: P3)
* **Optional Mobile Track Total:** 120 engineering hours (15 person-days).
