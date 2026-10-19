# DocuNexa — Missing Screens, Modifications & Feature Gap Analysis

**Document ID:** AUDIT-REP-09  
**Audit Date:** 2026-10-13T18:14:00+05:30  
**Evaluator:** Principal Business Analyst & Solution Architect  

---

## 1. Screen Gap Categorization

### List A: Existing Screens to Retain (28 Screens)
The following 28 existing screens satisfy their complete functional purpose under the BRD, require no architectural changes, and are connected to live production APIs:
1. `SCR-01`: Sign In & Identity Gateway (`/login`)
2. `SCR-02`: Verify Email & Forgot Password (`/verify-email`)
3. `SCR-03`: Reset Password Form (`/reset-password`)
4. `SCR-04`: Access Denied Fallback (`/access-denied`)
5. `SCR-05`: Operational Dashboard (`/dashboard`)
6. `SCR-06`: Documents Library (`/documents`)
7. `SCR-07`: Document Detail & Timeline (`/documents/:id`)
8. `SCR-08`: Intake & Upload Studio (`/intake`)
9. `SCR-09`: Review Work Queue (`/review`)
10. `SCR-10`: Review Workbench 50/50 Split Studio (`/review/:id`)
11. `SCR-11`: Compare Studio (`/compare`)
12. `SCR-12`: Approvals Hub (`/approvals`)
13. `SCR-13`: Hybrid Search Studio (`/search`)
14. `SCR-14`: Grounded Q&A Assistant (`/qa`)
15. `SCR-16`: Reports & Analytics (`/reports`)
16. `SCR-17`: Admin Shell & Navigation (`/admin`)
17. `SCR-18`: Admin Overview (`/admin/overview`)
18. `SCR-19`: Admin Users & RBAC (`/admin/users`)
19. `SCR-20`: Admin Document Types (`/admin/document-types`)
20. `SCR-21`: Admin Schema Builder (`/admin/document-types/:id`)
21. `SCR-22`: Admin Workflow Rules (`/admin/workflow`)
22. `SCR-23`: Admin Retention & Legal Holds (`/admin/retention`)
23. `SCR-24`: Admin Security Settings (`/admin/security`)
24. `SCR-26`: Admin Notification Preferences (`/admin/notifications`)
25. `SCR-27`: Admin AI Quality Telemetry (`/admin/ai-quality`)
26. `SCR-28`: Admin Audit Trail & Ledgers (`/admin/audit`)
27. `SCR-29`: Admin Governance Reports (`/admin/reports`)
28. `SCR-30`: Admin Operations & Disaster Recovery (`/admin/operations`)

---

### List B: Existing Screens to Modify or Extend (2 Screens)

1. **`SCR-15`: Tasks Hub (`/tasks`)**
   - **Current Functionality:** Unified table displaying review and approval task queues with status filters and SLA indicators.
   - **Gaps / Desired Modification:** Add an optional interactive calendar/timeline view for review assignment due dates.
   - **Action:** **FIX**
   - **Priority:** P2
   - **Estimated Effort:** 8 engineering hours.

2. **`SCR-25`: Admin Integrations (`/admin/integrations`)**
   - **Current Functionality:** Configures outbound signed webhooks, subscription endpoints, and inspects delivery history.
   - **Gaps / Desired Modification:** Add a live health status card for background IMAP email polling daemon.
   - **Action:** **EXTEND**
   - **Priority:** P2
   - **Estimated Effort:** 12 engineering hours.

---

### List C: Genuinely New Screens to Create (1 Screen)

1. **`SCR-31`: Native iOS Document Scanner App (`FR-019`)**
   - **Proposed Name:** DocuNexa Mobile Scanner (iOS)
   - **Primary Users:** Contributor / Uploader, Approver
   - **BRD Reference:** Functional Requirement FR-019 (Mobile Client)
   - **Required Sections:** Camera capture viewport with automatic page edge detection, perspective distortion correction, contrast enhancement, instant upload with SHA-256 client hashing, and push notification approval prompts.
   - **Required APIs:** `POST /api/v1/documents/upload`, `POST /api/v1/approvals/:id/decide`.
   - **Action:** **CREATE**
   - **Priority:** P3
   - **Estimated Effort:** 120 engineering hours (15 person-days).
   - **Why Existing Screen Cannot Cover:** Mobile responsive web covers basic uploads, but hardware-accelerated camera edge detection and native iOS Keychain biometrics require a native Swift/SwiftUI application.

---

## 2. Backend & Data Model Gaps

| Subsystem | Current State | Required Enhancement | Effort | Priority |
| :--- | :--- | :--- | :---: | :---: |
| **Email Ingestion Daemon** | SMTP outbound sending operational (`nodemailer`). | Background IMAP/POP3 poller daemon to ingest documents from enterprise mailboxes (`FR-004`). | 16h | P2 |
| **Cloud Storage Adapters** | Local sandbox filesystem storage with S3 interface. | Configure live AWS S3 or MinIO bucket credentials for staging deployment. | 8h | P1 |
| **Worker Cluster Scaling** | Single-node in-process outbox worker. | Kubernetes multi-pod BullMQ / Redis worker cluster scaling for heavy OCR throughput. | 24h | P2 |
