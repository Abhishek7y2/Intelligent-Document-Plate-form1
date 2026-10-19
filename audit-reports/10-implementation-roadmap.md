# DocuNexa — Prioritized Implementation & Remediation Roadmap

**Document ID:** AUDIT-REP-10  
**Audit Date:** 2026-10-13T18:15:00+05:30  
**Evaluator:** Technical Project Manager & Principal Solutions Architect  

---

## 1. Roadmap Overview & Phasing Strategy

The remaining implementation work focuses on transitioning DocuNexa from local integration verification into enterprise cloud staging and multi-channel expansion.

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
* **Objective:** Deploy DocuNexa onto a multi-node Kubernetes staging cluster to validate NFR-01 and NFR-05.
* **Tasks:**
  - **TSK-1.1:** Deploy PostgreSQL 16 with pgvector on managed cloud database (e.g. AWS RDS / Aurora) with WAL replication. (Effort: 16h | Priority: P1)
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
  - **TSK-3.1:** Execute simulated database failover and restore drill to demonstrate RTO <8h and RPO <24h (`NFR-05`). (Effort: 12h | Priority: P1)
  - **TSK-3.2:** Execute third-party SAST/DAST automated vulnerability scan and resolve any findings (`NFR-06`). (Effort: 16h | Priority: P1)
* **Stage Total:** 28 engineering hours (~3.5 person-days).

### Stage 4: Formal Business UAT Sign-Off
* **Objective:** Conduct formal stakeholder UAT sessions for UAT-01 through UAT-12.
* **Tasks:**
  - **TSK-4.1:** Seed staging environment with synthetic business corpus (Supplier Contracts, Purchase Invoices, Tax Forms). (Effort: 8h | Priority: P1)
  - **TSK-4.2:** Conduct guided UAT walkthroughs with business personas (Reviewer, Approver, Auditor, Admin). (Effort: 16h | Priority: P1)
  - **TSK-4.3:** Document sign-off certificates and baseline production release decision. (Effort: 8h | Priority: P1)
* **Stage Total:** 32 engineering hours (~4 person-days).

### Stage 5: Mobile Channel Expansion (Phase 4 Deliverable)
* **Objective:** Develop native iOS document scanner application (`FR-019`).
* **Tasks:**
  - **TSK-5.1:** Initialize Swift iOS project with Vision framework camera edge detection. (Effort: 40h | Priority: P3)
  - **TSK-5.2:** Implement secure upload and mobile approval workflow connected to backend REST APIs. (Effort: 48h | Priority: P3)
  - **TSK-5.3:** App Store distribution configuration and TestFlight release. (Effort: 32h | Priority: P3)
* **Stage Total:** 120 engineering hours (~15 person-days).

---

## 3. Prioritized Summary & Recommended Next 5 Tasks

1. **Task 1 (TSK-0.1 - P1):** Finalize Kubernetes manifests and Docker image builds for staging deployment.
2. **Task 2 (TSK-0.2 - P1):** Provision cloud S3/MinIO bucket credentials for persistent object storage.
3. **Task 3 (TSK-1.1 - P1):** Deploy PostgreSQL 16 with pgvector on managed cloud infrastructure with WAL streaming.
4. **Task 4 (TSK-2.1 - P2):** Deploy background IMAP poller worker for corporate email document intake.
5. **Task 5 (TSK-4.2 - P1):** Conduct formal stakeholder business UAT walkthroughs across UAT-01 through UAT-12.
