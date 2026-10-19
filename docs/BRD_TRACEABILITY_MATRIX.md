# DocuNexa Requirements Traceability Matrix (RTM)

**BRD Version:** 1.0  
**Stack Baseline:** Angular 19 | Node.js (TypeScript) | PostgreSQL 16  

---

| Requirement ID | Requirement Description | Frontend Component / Route | Backend Node.js Service / Endpoint | Database Entity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-001** | Multi-channel Document Intake | `DocumentIntake` (`/intake`) | `IntakeController.uploadDocument` (`POST /api/v1/intake/upload`) | `documents` | **MOCKED (UI 100%)** |
| **FR-002** | File Format & Malware Scanning | `DocumentIntake` (`/intake`) | `ScanService.scanPayload` | `documents.sha256_hash` | **MOCKED (UI 100%)** |
| **FR-003** | Document Repository Queue | `Documents` (`/documents`) | `DocumentController.listDocuments` (`GET /api/v1/documents`) | `documents` | **MOCKED (UI 100%)** |
| **FR-004** | Status & SLA Tracking | `Documents` (`/documents`) | `SlaService.calculateStatus` | `documents.sla_status` | **MOCKED (UI 100%)** |
| **FR-005** | Multi-stage OCR & Layout Extraction | `ReviewWorkbench` (`/review/:id`) | `OcrService.extractLayout` | `ocr_page_layouts` (JSONB) | **MOCKED (UI 100%)** |
| **FR-006** | Confidence Score Computation | `ReviewWorkbench` (`/review/:id`) | `ExtractionService.scoreField` | `extracted_fields.confidence` | **MOCKED (UI 100%)** |
| **FR-007** | Human-in-the-Loop Field Override | `ReviewWorkbench` (`/review/:id`) | `ReviewController.verifyField` (`POST /api/v1/review/verify`) | `extracted_fields` | **MOCKED (UI 100%)** |
| **FR-008** | Audit Trail Logging | `DocumentDetail` (`/documents/:id`) | `AuditService.logEvent` | `audit_trail_events` | **MOCKED (UI 100%)** |
| **FR-009** | Multi-level Approval Workflows | `ApprovalQueue` (`/approvals`) | `ApprovalController.submitAction` (`POST /api/v1/approvals/submit`) | `approval_steps` | **MOCKED (UI 100%)** |
| **FR-010** | Document Lock & Publication | `DocumentDetail` (`/documents/:id`) | `PublishService.lockDocument` | `documents.status` | **MOCKED (UI 100%)** |
| **FR-011** | Governance & Operations Telemetry | `Reports` (`/reports`) | `TelemetryService.getKpis` (`GET /api/v1/reports/kpis`) | `telemetry_hourly` | **MOCKED (UI 100%)** |
| **FR-012** | STP Performance Analytics | `Reports` (`/reports`) | `ReportController.getStpStats` | `telemetry_hourly` | **MOCKED (UI 100%)** |
| **FR-013** | SHA-256 Cryptographic Report Export | `Reports` (`/reports`) | `ExportService.generateCsv` (`GET /api/v1/reports/export`) | `audit_trail_events` | **MOCKED (UI 100%)** |
| **FR-014** | Multi-tenant RBAC & SoD | `AdminManagement` (`/admin`) | `AuthMiddleware.checkPermissions` | `users`, `roles` | **MOCKED (UI 100%)** |
| **FR-017** | Semantic Clause Diff Comparison | `DocumentCompare` (`/compare`) | `CompareService.computeDiff` (`POST /api/v1/compare`) | `clause_vectors` (`pgvector`) | **MOCKED (UI 100%)** |
| **FR-021** | Grounded Natural Language QA | `NaturalLanguageQa` (`/qa`) | `QaController.askQuestion` (`POST /api/v1/qa/query`) | `clause_vectors` (`pgvector`) | **MOCKED (UI 100%)** |
