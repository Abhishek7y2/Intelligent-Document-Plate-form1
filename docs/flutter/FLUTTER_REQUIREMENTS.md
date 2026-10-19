# FLUTTER MOBILE APPLICATION REQUIREMENTS SPECIFICATION

**System:** DocuNexa Mobile Client (Flutter / Dart)  
**Parent System:** DocuNexa Document Intelligence Platform  
**Target Operating Systems:** Android 8.0+ (API Level 26+), iOS 15.0+  
**Active Branch:** `mobile-frontend`  
**Date:** 2026-10-16  

---

## 1. Functional Requirements Matrix

The following functional requirements govern the behavior, workflows, and user interactions of the DocuNexa Mobile application:

| Req ID | Business Capability | Mobile Functional Specification | BRD / FR Trace | Priority |
| :--- | :--- | :--- | :---: | :---: |
| **MOB-FR-001** | **Secure Authentication** | Email and password login; biometric unlock via Fingerprint/FaceID; MFA 6-digit TOTP validation; session persistence. Excludes web demo buttons and local password bypasses. | `FR-001` | **P0** |
| **MOB-FR-002** | **Session Resiliency** | Automatic token refresh via `POST /api/v1/auth/refresh` on HTTP 401 without dropping active user work or navigating away. | `FR-001`, `DEF-011` | **P0** |
| **MOB-FR-003** | **Onboarding & Deep Links** | Deep-link parsing for invitation acceptance (`docunexa://invite?token=...`) and password reset tokens. | `FR-001` | **P1** |
| **MOB-FR-004** | **Camera Edge Ingestion** | Native camera document scanning with automatic edge detection, perspective correction, contrast enhancement, and 300 DPI pre-compression. | `FR-003`, `FR-004` | **P0** |
| **MOB-FR-005** | **File Upload & Progress** | Multipart streaming upload to `POST /api/v1/documents/upload` (fixing `DEF-001`) with byte-level progress bar and background completion. | `FR-003`, `DEF-001` | **P0** |
| **MOB-FR-006** | **Duplicate Conflict Sheet** | Detects HTTP 409 `DUPLICATE_DOCUMENT` on upload collision; presents bottom sheet allowing user to view existing document or force upload version. | `FR-005` | **P1** |
| **MOB-FR-007** | **Document Catalog & Search** | Infinite-scroll document list with status pills (Queued, Processing, Review, Approved); search bar header; filter chips for type and date range. | `FR-006`, `FR-016` | **P0** |
| **MOB-FR-008** | **Document Detail Inspection** | Tabbed detail view: Overview metadata, Extracted fields with confidence meters, Processing timeline stepper, and Version history list. | `FR-008`, `FR-015` | **P0** |
| **MOB-FR-009** | **Review Triage Queue** | Priority-ordered review queue (High, Medium, Low) with SLA countdown badges and assignment tags. | `FR-010` | **P0** |
| **MOB-FR-010** | **Mobile Review Workbench** | Swipeable Dual-Panel / Bottom Sheet: Top 55% = Pinch-to-zoom interactive document image with touch-scaled bounding boxes; Bottom 45% = Field correction form. | `FR-010`, `DEF-007` | **P0** |
| **MOB-FR-011** | **Field Value Corrections** | Tapping field centers document canvas on bounding box; field edit updates value via `PATCH /api/v1/review/:id/fields/:key` and records audit diff. | `FR-010`, `FR-011` | **P0** |
| **MOB-FR-012** | **Invoice Math Reconciliation** | Real-time calculation check alerting reviewer if line items or tax do not equal total (`Subtotal + Tax = Total`). | `FR-009` | **P1** |
| **MOB-FR-013** | **Approvals Queue & SoD** | Card-based approvals queue with swipe actions (swipe right = approve, swipe left = reject). Enforces Separation of Duties blocking self-approval. | `FR-013`, `FR-014` | **P0** |
| **MOB-FR-014** | **Version Comparison Diff** | Unified diff toggle replacing desktop side-by-side view; color-coded additions (green) and deletions (red); clause change summary card. | `FR-017` | **P1** |
| **MOB-FR-015** | **Grounded Q&A Chat** | Conversational messaging interface with AI assistant; verified citation tags link directly to highlighted coordinates on document page. | `FR-019` | **P1** |
| **MOB-FR-016** | **Operational Dashboard** | Tab 0 dashboard: KPI metric cards carousel, quick intake FAB, recent activities feed, processing queue mini-summary. | `FR-021` | **P0** |
| **MOB-FR-017** | **Task Management** | Segmented view ("My Tasks", "Assigned", "All") with status toggles and due date badges. | `FR-011` | **P1** |
| **MOB-FR-018** | **User Profile & Sessions** | Avatar photo upload via camera; active session list with one-tap revocation; biometric security toggle; MFA management. | `FR-001` | **P0** |
| **MOB-FR-019** | **Emergency Legal Hold** | Mobile toggle allowing Compliance Officers to place documents under Litigation Legal Hold immediately from phone. | `FR-022` | **P1** |
| **MOB-FR-020** | **Administrative Telemetry** | Service health indicators (PostgreSQL, Redis, Workers); queue depth gauges; failed job retry trigger. | `FR-021` | **P2** |

---

## 2. Non-Functional Requirements (Mobile Attributes)

| Quality Attribute | Specification & Acceptance Target | Verification Method |
| :--- | :--- | :--- |
| **Mobile Cold Start Latency** | Time to interactive dashboard (FCP) $\le 1.8$ seconds on mid-range Android devices. | Flutter DevTools CPU profiler benchmark. |
| **Network Resilience** | Graceful handling of network drops; offline caching of read views; automatic retry of idempotent requests on reconnect. | Airplane mode toggling & Charles proxy throttling. |
| **Memory Consumption** | Resident set size (RSS) $\le 180$ MB during active 20-page document image rendering and pinch-to-zoom. | Memory leak tracking & image cache eviction. |
| **Touch Ergonomics** | All interactive touch targets $\ge 48 \times 48$ dp in compliance with Material 3 & WCAG 2.1 AA. | Accessibility scanner & layout inspection. |
| **Battery & CPU Efficiency** | No background battery drain; image compression and OCR bounding box calculations offloaded to worker isolates. | Android Battery Historian profile. |
| **Cryptographic Security** | Zero plain-text token or secret storage; AES-256 encrypted local SQLite database; strict TLS 1.3 certificate validation. | Static analysis & local device sandbox inspection. |

---

## 3. Supported Platform & Device Matrix

- **Android Baseline:**
  - Minimum OS: Android 8.0 (API Level 26 "Oreo")
  - Target OS: Android 14 / 15 (API Level 34 / 35)
  - Hardware Requirements: Camera with autofocus, Biometric sensor (Fingerprint / Face), 3GB+ RAM.
- **iOS Baseline (Phase 2):**
  - Minimum OS: iOS 15.0
  - Hardware Requirements: iPhone 8 or later, FaceID / TouchID.
- **Display Densities:**
  - Responsive layouts scaled across `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, and `xxxhdpi` displays (screen widths 360dp to 480dp on phones).
