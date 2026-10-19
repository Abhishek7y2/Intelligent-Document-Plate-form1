# DocuNexa Sprint 0 Frontend Integration Readiness

**Module:** Task S0-10 Frontend Integration Readiness  
**Target UI Workspace:** `document-intelligence-ui`  

---

## 1. UI Integration Mapping

| Angular UI Feature Component | Token Name | Current Dev State | Integration Plan for Backend |
| :--- | :--- | :---: | :--- |
| `Documents` (`/documents`) | `DOCUMENT_SERVICE_TOKEN` | `MockDocumentService` | Replace with `HttpDocumentService` connecting to `GET /api/v1/documents`. |
| `ReviewWorkbench` (`/review/:id`) | `REVIEW_SERVICE_TOKEN` | `MockReviewService` | Replace with `HttpReviewService` connecting to `POST /api/v1/documents/{id}/verify-field`. |
| `Reports` (`/reports`) | `REPORT_SERVICE_TOKEN` | `MockReportService` | Replace with `HttpReportService` connecting to `GET /api/v1/reports/export`. |
| `ApprovalQueue` (`/approvals`) | `APPROVAL_SERVICE_TOKEN` | `MockApprovalService` | Replace with `HttpApprovalService` connecting to `POST /api/v1/approvals/submit`. |
