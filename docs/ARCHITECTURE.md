# DocuNexa Platform — System Architecture & Engineering Blueprint

## 1. Executive Platform Overview

**DocuNexa** is an enterprise-scale Document Intelligence and Cognitive Automation Platform designed for high-throughput, mission-critical legal, financial, and compliance operations. The platform transforms unstructured documents (multi-party contracts, complex vendor invoices, master services agreements, regulatory filings) into structured, cryptographically auditable, and human-in-the-loop (HITL) validated enterprise assets.

The platform architecture bridges advanced optical character recognition (OCR), neural semantic diffing, deterministic mathematical validation, and enterprise governance workflows.

---

## 2. Multi-Tiered System Architecture

```
+---------------------------------------------------------------------------------------+
|                                1. PRESENTATION TIER                                   |
|   Angular 18/19 Standalone Architecture | Signals & RxJS | High-Density Enterprise UI |
|   Dashboard | Intake | Documents | Review Workbench | Compare Studio | Approvals      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                          2. ORCHESTRATION & BUSINESS LOGIC TIER                       |
|  +---------------------+  +------------------------+  +----------------------------+  |
|  | Ingestion & Pre-OCR |  | Semantic Diff Engine   |  | Line-Item Math Engine      |  |
|  | Quarantine Pipeline |  | (Task 7D BRD Spec)     |  | (Deterministic Sum Check)  |  |
|  +---------------------+  +------------------------+  +----------------------------+  |
|  +---------------------+  +------------------------+  +----------------------------+  |
|  | HITL Review Engine  |  | Governance & SoD       |  | Grounded AI Assistant      |  |
|  | (Canvas Bounding Box)| | (Separation of Duties) |  | (AI-004 Page Citations)   |  |
|  +---------------------+  +------------------------+  +----------------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                3. STATE & DATA ACCESS TIER                            |
|  Reactive Repositories | InMemory / REST Adapters | Mock Store Tokens | Audit Journal |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                        4. INFRASTRUCTURE & INTEGRATION TIER                           |
|  ERP Webhook Dispatcher | Export Engine (CSV/JSON/PDF) | Cryptographic Hasher (SHA-256)|
+---------------------------------------------------------------------------------------+
```

---

## 3. Frontend Architecture (Angular 18/19 Standalone)

The frontend is built on Angular Standalone Components without legacy `NgModule` overhead.

### 3.1 Project Structure & Modular Topology

```
src/app/
├── core/
│   ├── services/                 # Singleton services (Auth, Notification, Export, Api)
│   ├── guards/                   # Route protection (AuthGuard, RoleGuard, SoDGuard)
│   ├── interceptors/             # HTTP tokens, error handlers, timing headers
│   └── models/                   # Strongly-typed domain models & enterprise DTOs
├── shared/
│   ├── components/               # Reusable UI primitives (Header, Sidebar, Badges, Modals)
│   ├── directives/               # Coordinate bounding-box directives, clipboard helpers
│   └── pipes/                    # Formatting pipes (Currency, RelativeTime, TextEllipsis)
└── features/
    ├── auth/                     # SCR-01: Enterprise Login, SAML/Okta SSO, OTP Verification
    ├── dashboard/                # SCR-02: Operations Executive Dashboard & SLA Alerts
    ├── intake/                   # SCR-03: Ingestion Studio & Quarantined Low-DPI Pipeline
    ├── documents/                # SCR-04 & SCR-05: Repository, Multi-Page Viewer, Export
    ├── review/                   # SCR-06 & SCR-07: 50/50 HITL Review & Line-Item Math Engine
    ├── compare/                  # SCR-08: Side-by-Side Version Diff & Clause Analysis Studio
    ├── approvals/                # SCR-09: Multi-Stage Approval Pipeline with SoD Enforcement
    ├── tasks/                    # SCR-10: Reviewer Priority Worklist & SLA Countdowns
    ├── search/                   # SCR-11: Hybrid & Semantic Search with Snippet Highlights
    ├── qa/                       # SCR-12: Grounded Q&A Assistant with Direct Page Citations
    └── admin/                    # SCR-13 & SCR-14: RBAC Matrices, Tenant Governance & Webhooks
```

### 3.2 State Management & Reactive Signals
- **Fine-Grained UI Reactivity**: Local component states (such as active clause index, active comparison tab, zoom scale, filter chips, and dirty input states) are managed via Angular Signals (`signal<T>()`, `computed()`).
- **Asynchronous Data Streams**: Multi-page document loading, debounced search filtering, and mock API network delays are governed by RxJS Observables (`Observable<T>`, `Subject<T>`, `switchMap`, `debounceTime`).
- **Decoupled Architecture**: View components consume data strictly through injected service contracts, enabling seamless transitions from mock stores to live microservice backends.

---

## 4. Deep Dive: Core Platform Engines

### 4.1 Version Compare Studio & Semantic Diff Engine (BRD Task 7D)
The Compare Studio (`SCR-08`) delivers a comprehensive side-by-side analysis between baseline and amendment document versions:

```
+-----------------------------------------------------------------------------------+
|                           COMPARE STUDIO DATA PIPELINE                            |
|                                                                                   |
|  [Document v1.0 Baseline]                      [Document v2.0 Amendment]          |
|              \                                            /                       |
|               v                                          v                        |
|       +----------------------------------------------------------+                |
|       |               Semantic Clause Alignment Engine           |                |
|       |  Matches clauses based on semantic headers & embeddings  |                |
|       +----------------------------------------------------------+                |
|                                     |                                             |
|                                     v                                             |
|       +----------------------------------------------------------+                |
|       |               Granular Redline Diff Parser               |                |
|       |   Identifies ADDED, REMOVED, MODIFIED, UNCHANGED tokens  |                |
|       +----------------------------------------------------------+                |
|                                     |                                             |
|                                     v                                             |
|       +----------------------------------------------------------+                |
|       |                 AI Legal Intelligence Engine             |                |
|       |  - Plain-English Business Shift Summary                  |                |
|       |  - Risk Exposure Scoring (High / Medium / Low)           |                |
|       |  - Balanced Counter-Proposal (Fallback Clause)           |                |
|       +----------------------------------------------------------+                |
|                                     |                                             |
|                                     v                                             |
|       +----------------------------------------------------------+                |
|       |                 Cryptographic Integrity Seal             |                |
|       |    Computes SHA-256 Audit Hash & Dual Document Citations |                |
|       +----------------------------------------------------------+                |
+-----------------------------------------------------------------------------------+
```

#### Key Capabilities & Architecture:
1. **Executive Shift Summary**: Formulates an immediate 3-zone visual comparison:
   - **Baseline Clause**: Pre-amendment text snippet and direct citation (`Page 2, Para 4`).
   - **Delta Transition**: Highlight of shift type (e.g. "Payment term contracted from 45 to 30 days").
   - **Amendment Clause**: Post-amendment language and target citation (`Page 2, Para 3`).
2. **AI Plain-English Impact & Counsel Guidance**: Translates dense legal boilerplate into concrete business exposure and actionable attorney advice.
3. **AI Recommended Counter-Proposal (Fallback Clause)**: Generates a balanced, enterprise-vetted compromise clause with one-click clipboard copying (`navigator.clipboard.writeText`) for rapid contract turnaround.
4. **Synchronized Redline Views**:
   - **Split View**: 50/50 dual pane with synchronized vertical scrolling.
   - **Unified Manuscript**: Continuous document flow with inline additions (`<ins>`) and deletions (`<del>`).
   - **Line Numbers**: Dedicated 32px column with monotonic sequence numbering.
5. **Reading Aid Disclaimer & Audit Integrity**: Permanently renders the statutory notice:
   *"AI comparison is an assistive reading aid. Final verification rests with qualified legal counsel."*
   Accompanied by a verifiable SHA-256 hash ensuring tamper-proof comparison states.

---

### 4.2 HITL Review Workbench & Canvas Projection Engine (SCR-06)
- **Coordinate Projection Matrix**: Extracted field metadata contains normalized bounding-box coordinates $[x, y, w, h]$ relative to the original document page.
- **Interactive SVG Canvas Overlay**:
  $$\text{Rendered } X = x \times \text{CanvasWidth}, \quad \text{Rendered } Y = y \times \text{CanvasHeight}$$
  When a reviewer focuses an extracted field on the right-hand form, the canvas highlights the bounding box with an animated indigo halo and scrolls the view into focus.
- **Viewport Manipulation**: Full pan, zoom (75% to 150%), and 90° clockwise/counter-clockwise orientation rotation without image distortion.

---

### 4.3 Deterministic Invoice Arithmetic Engine (SCR-07)
To prevent hallucination and detect OCR transcription errors on financial documents, DocuNexa implements a client-side deterministic math validator:

$$\text{Line Item Amount}_i = \text{Quantity}_i \times \text{Unit Price}_i$$
$$\text{Calculated Subtotal} = \sum_{i=1}^{n} \text{Line Item Amount}_i$$
$$\text{Calculated Grand Total} = \text{Calculated Subtotal} + \text{Tax (18\%)}$$

- **Discrepancy Threshold**: If $|\text{Calculated Grand Total} - \text{OCR Extracted Total}| > 0.01$, the platform:
  1. Activates an arithmetic discrepancy warning banner.
  2. Highlights the mismatched line-item row with an amber alert border.
  3. Provides an instant "Apply Calculated Math" override button to synchronize extracted financial records.

---

### 4.4 Ingestion & Quarantine Exception Pipeline (SCR-03)
Documents ingested via multi-channel endpoints (API upload, email gateway, ERP webhook) pass through a quality control gate:
- **Low-DPI & Corruption Quarantine**: Documents failing resolution criteria (<150 DPI) or exhibiting corrupt file headers are segregated into the **Quarantine Queue**.
- **Exception Remediation**: Reviewers can execute either:
  1. **Retry OCR**: Triggers an enhanced binarization and deskew pipeline.
  2. **HITL Manual Override**: Bypasses the pre-flight check and opens the document directly in the Review Workbench for manual field attribution.

---

### 4.5 Separation of Duties (SoD) & Governance Engine (SCR-09)
Enterprise compliance mandates that financial documents and contracts cannot be self-approved:
- **SoD Policy Verification**:
  ```typescript
  isSelfApprovalBlocked(document: DocumentItem, user: AuthUser): boolean {
    return document.uploadedBy === user.name && user.role !== 'SUPER_ADMIN';
  }
  ```
- **UI Safeguards**: When self-approval is detected, the `Approve` button is disabled, styled with a safety pattern, and accompanied by the `🛡️ SoD Protected` badge.
- **Rejection Codes**: Enforces mandatory standardized rejection categories (`ERR-MATH-01`, `ERR-CONTRACT-02`, `ERR-EXPIRED-PO`, `ERR-TAX-04`) with required audit notes.

---

### 4.6 Scoped Data Export & PII Masking Engine (SCR-04)
- **Multi-Format Export**: Generates sanitized CSV, JSON, and Audit PDF packages.
- **Compliance Masking**:
  - **PII Masking**: Redacts personal names, email addresses, and phone numbers (`J*** D**`).
  - **Financial Masking**: Obfuscates sensitive account numbers, tax IDs, and confidential unit rates (`****-****-1234`).

---

### 4.7 Grounded AI Assistant (AI-004 Guardrails) (SCR-12)
- **Groundedness Verification**: The Q&A assistant requires strict grounding in ingested document knowledge chunks.
- **Out-of-Context Handling**: Prompts asking questions outside the document scope trigger an explicit `AI-004 Groundedness Failure` notice: *"I cannot find this information in the indexed document repository."*
- **Verifiable Citations**: Every generated response includes clickable page anchors navigating directly to the source document page.

---

## 5. Security, Audit Logging & Cryptographic Integrity

1. **Role-Based Access Control (RBAC)**: Supports 6 enterprise roles:
   - `Super Admin`
   - `Compliance Officer`
   - `Finance Approver`
   - `Legal Reviewer`
   - `Document Intake Operator`
   - `Auditor (Read-Only)`
2. **Immutable Audit Trail**: Every user interaction (clause acceptance, override, rejection, export, field edit) generates an immutable audit record containing:
   - User ID & IP Address
   - UTC Timestamp
   - Previous Value ➔ New Value
   - Verification SHA-256 Hash
3. **Single Sign-On (SSO)**: Native support for Enterprise SAML 2.0 and Okta OpenID Connect (OIDC).

---

## 6. Build & Performance Optimization

- **Angular Compilation**: Built with Ahead-of-Time (AOT) compilation and tree-shaking.
- **Prerender & SSR Configuration**: Static routes are prerendered for near-instant Time to First Byte (TTFB), while dynamic parameterized routes (`/review/:id`, `/compare/:id`) are served dynamically via `RenderMode.Server`.
- **Zero Horizontal Overflow Policy**: Strict structural CSS constraints ensure flawless rendering across standard enterprise displays (1366x768 to 4K).
