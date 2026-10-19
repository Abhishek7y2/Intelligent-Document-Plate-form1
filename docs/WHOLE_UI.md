# DocuNexa Platform — Master UI Design & Screen Catalog

## 1. Executive UI Design Philosophy

The **DocuNexa** user interface is designed for Tier-1 Enterprise B2B SaaS applications, specifically tailored for high-volume legal, financial, and compliance workflows. The interface adheres to three foundational tenets:

1. **Instant Comprehension ("Ek Nazar Mein Samajh")**:
   Critical data shifts, financial totals, and legal risks are surfaced immediately using structured visual badges, comparative change cards, and high-contrast indicators.
2. **High Information Density Without Visual Clutter**:
   Horizontal and vertical screen space is rigorously economized. Bulky 160px metric cards are consolidated into a high-density **46px Metric Strip**, ensuring that primary document review and comparison stages remain visible above the fold.
3. **Strict Zero-Overflow & Non-Colliding Layout Geometry**:
   Every container enforces strict boundary containment (`max-width: 100%`, `overflow-x: hidden`, `min-width: 0`). Headers use a two-row architecture separating identity from action controls to eliminate element overlapping across any display resolution or zoom setting.

---

## 2. Universal Design Tokens & Component Anatomy

### 2.1 Color Tokens & Contrast Matrix (WCAG 2.1 AA Compliant)

| Token Name | Hex Code | Usage Scenario |
| :--- | :--- | :--- |
| **Brand Primary Indigo** | `#4f46e5` | Primary CTA buttons, active tabs, brand accents |
| **Brand Primary Hover** | `#4338ca` | Focused/hover states on primary controls |
| **Brand Surface Subtle** | `#eef2ff` / `#e0e7ff` | Active row tints, badge backgrounds, pill highlights |
| **Critical / High Risk** | `#dc2626` | SLA breach alerts, High Risk clause badges, deletions |
| **Critical Surface Tint** | `#fee2e2` | Redline deletion highlight (`<del>`), alert banners |
| **Warning / Medium Risk** | `#b45309` | Pending review badges, arithmetic mismatch alerts |
| **Warning Surface Tint** | `#fef3c7` | Modifed clause badges, warning backgrounds |
| **Verified / Low Risk** | `#166534` | Approved badges, verified math indicators, additions |
| **Verified Surface Tint** | `#dcfce7` | Redline addition highlight (`<ins>`), verified pills |
| **Page Canvas Slate** | `#f8fafc` | Application canvas background (Slate-50) |
| **Card Surface White** | `#ffffff` | Elevated cards, comparison panes, modal sheets |
| **Borders & Dividers** | `#e2e8f0` / `#cbd5e1` | Card outlines, table dividers, strip separators |
| **Typography Dark** | `#0f172a` | Primary headers, clause titles, monetary figures |
| **Typography Slate** | `#334155` / `#475569` | Secondary body text, table cell values, metadata |
| **Typography Muted** | `#64748b` / `#94a3b8` | Subtitles, timestamps, breadcrumb links |

### 2.2 Reusable Component Patterns
- **46px Compact Metric Strip**: A single horizontal bar (`padding: 0.55rem 1.15rem; border-radius: 10px; background: #ffffff`) with inline dividers and colored indicator dots (amber, indigo, red, emerald).
- **Two-Row Header Architecture**:
  - **Row 1**: Item Identity (Badge, Title, Category Pill, Risk Badge).
  - **Row 2**: Interactive Controls (Stepper navigation, Accept/Flag review buttons, View Mode toggles).
- **Executive Shift Summary Card**: Triple-zone visual comparison (`v1.0 Baseline ➔ Delta Badge ➔ v2.0 Amendment`) with direct paragraph-level citations.
- **AI Counter-Proposal Box**: Dedicated fallback clause card with a 1-click clipboard copy feature (`navigator.clipboard.writeText`).
- **Synchronized Redline Panes**: Side-by-side split and unified manuscript views with dedicated 32px line-number columns.

---

## 3. Screen-by-Screen UI Catalog & Anatomy

---

### SCR-01: Authentication & Enterprise SSO
- **Routes**: `/login`, `/verify-email`
- **Target Persona**: All enterprise roles (Operators, Reviewers, Approvers, Admins, Auditors).
- **Layout Anatomy**:
  - Split-screen layout: Left branded illustration with enterprise value propositions; right high-focus credential portal.
  - One-click **Enterprise SSO (SAML 2.0 / Okta OIDC)** authentication button with official shield iconography.
  - Standard enterprise email and password input fields with inline regex validation.
  - 6-Role Switcher dropdown for instant role simulation across development and staging environments.
  - Email verification screen (`/verify-email`) featuring auto-advancing 6-digit OTP code inputs with a 60-second resend countdown timer.

---

### SCR-02: Operations Executive Dashboard
- **Route**: `/dashboard`
- **Target Persona**: Operations Managers, Legal Directors, Compliance Leads.
- **Layout Anatomy**:
  - **High-Priority SLA Breach Alert Banner**: Highlighted in critical red (`#fee2e2`), displaying documents expiring within `<4h` with direct action links.
  - **6-KPI Metric Grid**: High-level telemetry covering Total Documents Ingested, In Review, Auto-Approved Rate, SLA Breaches, Pending Approvals, and System Accuracy (98.4%).
  - **Throughput & Processing Volume Chart**: Weekly trend visualization with document state breakdowns.
  - **Priority Attention Worklist**: Data table highlighting documents requiring human intervention, equipped with countdown badges and quick-action buttons.

---

### SCR-03: Document Ingestion & Quarantine Studio
- **Route**: `/intake`
- **Target Persona**: Ingestion Operators, Document Clerks.
- **Layout Anatomy**:
  - **Drag-and-Drop Upload Zone**: Supports batch ingestion for PDF, TIFF, PNG, and scanned agreements up to 50MB.
  - **Dual Tab Architecture**:
    1. **Live Upload Stream**: Real-time progress bars, OCR classification confidence meters, and pipeline progress indicators.
    2. **Quarantined Exceptions Queue**: Dedicated isolation tab for corrupt scans and low-resolution documents (<150 DPI).
  - **Exception Action Triggers**: Inline action buttons for `HITL Manual Override` and `Retry OCR (Binarize & Deskew)`.

---

### SCR-04: Document Repository & Scoped Data Export
- **Route**: `/documents`
- **Target Persona**: Document Managers, Compliance Officers, External Auditors.
- **Layout Anatomy**:
  - **Enterprise Filter Bar**: Multi-faceted filtering by Document Type (Contract, Invoice, PO, Regulatory), Ingestion Date range, Status, and Risk Exposure.
  - **Dense Document Data Table**: Features multi-select checkboxes, document preview thumbnails, file sizes, processing timestamps, and status badges.
  - **Scoped Data Export Studio Modal**:
    - Format Selection: CSV, JSON, or Audit PDF.
    - Scope Selection: All Documents, Selected Records, or Filtered Set.
    - **Compliance Masking Controls**: Granular toggles for **PII Masking** (redacting names/emails) and **Financial Masking** (masking account numbers and unit rates).

---

### SCR-05: Document Detail, Multi-Page Viewer & Audit Timeline
- **Route**: `/documents/:id`
- **Target Persona**: Legal Analysts, Auditors, Senior Reviewers.
- **Layout Anatomy**:
  - **Header Bar**: Displays document name, unique Doc ID, checksum hash, and deep-link shortcut to **Version Compare Studio**.
  - **Multi-Page Document Preview Stage**: Left pane with high-fidelity document rendering, page navigation controls, and zoom levels.
  - **Metadata & Extraction Inspector**: Right pane tabbed inspector displaying Extracted Entities, Confidence Scores, and Document Hierarchy.
  - **Immutable Audit Trail Timeline**: Chronological event stream displaying each lifecycle transition, timestamp, user handle, and SHA-256 seal.

---

### SCR-06: HITL 50/50 Split-Screen Review Workbench
- **Route**: `/review/:id`
- **Target Persona**: Human-in-the-Loop (HITL) Reviewers, Legal Paralegals.
- **Layout Anatomy**:
  - **50/50 Synchronized Split Screen**: Left pane dedicated to the document canvas; right pane dedicated to structured form inputs.
  - **Interactive SVG Canvas Overlay**: Extracted fields map to normalized bounding-box coordinates `[x, y, w, h]`. Focusing any form input dynamically illuminates the corresponding SVG bounding box with an indigo halo.
  - **Canvas Manipulation Bar**: Page switcher, zoom slider (75% to 150%), and 90° canvas rotation controls.
  - **Field Confidence Chips**: Displays per-field confidence percentages (e.g. `98% Confidence`); values under 85% show an amber warning icon.

---

### SCR-07: Invoice Line-Item Math Engine & Arithmetic Validator
- **Route**: `/review/:id` *(Tab 2: Line Items)*
- **Target Persona**: Accounts Payable Specialists, Finance Reviewers.
- **Layout Anatomy**:
  - **Interactive Line-Item Data Grid**: Columns for Item Description, Quantity, Unit Rate, Tax Rate, and Line Total.
  - **Client-Side Deterministic Arithmetic Engine**: Dynamically calculates:
    $$\sum (\text{Quantity} \times \text{Rate}) + \text{Tax (18\%)} = \text{Calculated Total}$$
  - **Arithmetic Discrepancy Alert Banner**: Surfaces if calculated totals differ from OCR Grand Totals by $> ₹0.01$.
  - **One-Click Reconciliation Trigger**: `[Apply Calculated Math]` button automatically updates the extracted total and logs the correction.

---

### SCR-08: Side-by-Side Version Diff & Clause Analysis Studio
- **Routes**: `/compare`, `/compare/:id`
- **Target Persona**: Corporate Legal Counsel, Contract Negotiators, Procurement Directors.
- **Layout Anatomy**:
  - **Top Bar**: Version selectors (e.g. Master Services Agreement v1.0 vs Amendment v2.0) and export diff action.
  - **Compact 46px Metric Strip**: Displays Total Clauses (4), Added (1), Modified (2), Unchanged (1), and High Risk (1).
  - **Master-Detail Two-Column Grid**:
    - **Left Column (310px)**: Sticky Clause Navigator with search filter, category pills, review completion meter, and clause cards.
    - **Right Column (Remaining Width)**: Active comparison stage with zero horizontal overflow.
  - **Two-Row Non-Colliding Stage Header**:
    - Row 1: Clause Badge, Title, Category Pill, Risk Badge.
    - Row 2: Previous/Next Clause Stepper, Accept / Flag Review Actions.
  - **Executive Shift Summary Card**: Side-by-side shift overview (`Baseline ➔ Delta ➔ Amendment`) with dual page citations (`v1.0 Page 2, Para 4` vs `v2.0 Page 2, Para 3`).
  - **AI Plain-English Impact & Counsel Guidance**: Clear business impact statement and legal guidance.
  - **AI Recommended Counter-Proposal (Fallback Clause)**: Balanced compromise language with a 1-click clipboard copy feature.
  - **Synchronized Redline Panes**: Side-by-side split and unified manuscript views with dedicated 32px line numbers.
  - **Footer Integrity Bar**: Displays statutory Reading Aid legal disclaimer and cryptographic SHA-256 verification seal.

---

### SCR-09: Approval Center with Separation of Duties (SoD)
- **Route**: `/approvals`
- **Target Persona**: Finance Directors, Authorized Signatories, Senior Partners.
- **Layout Anatomy**:
  - **4-Stage Visual Approval Pipeline Stepper**: Intake ➔ HITL Review ➔ Finance Approval ➔ Final ERP Lock.
  - **Separation of Duties (SoD) Enforcement**: If the active user uploaded the document, the `Approve` button is disabled, styled with a safety pattern, and labeled `🛡️ SoD Protected`.
  - **Standardized Rejection Modal**: Requires explicit rejection categorization (`ERR-MATH-01`, `ERR-CONTRACT-02`, `ERR-EXPIRED-PO`, `ERR-TAX-04`) with mandatory justification notes.

---

### SCR-10: Reviewer Tasks & SLA Countdown Worklist
- **Route**: `/tasks`
- **Target Persona**: Document Reviewers, Queue Coordinators.
- **Layout Anatomy**:
  - **Priority Queue Tabs**: All Tasks, Urgent (<4h SLA), High Risk Contracts, In Discrepancy.
  - **Visual SLA Countdown Badges**: Color-coded badges indicating time remaining (e.g., `2h 14m Remaining`, `Overdue`).
  - **Batch Assignment Controls**: Multi-select actions to reassign tasks to team members or claim tasks directly.

---

### SCR-11: Hybrid & Semantic Search Studio
- **Route**: `/search`
- **Target Persona**: Knowledge Workers, Compliance Officers, Legal Researchers.
- **Layout Anatomy**:
  - **Search Bar**: Dual-mode input supporting keyword search and natural language queries.
  - **Filter Chips**: Quick filters for Contract Type, Jurisdiction, Effective Date, and Risk Score.
  - **Search Results Cards**: Displays document title, relevancy confidence score (e.g. `96% Match`), highlighted text snippets matching query keywords, and direct links to the Document Viewer.

---

### SCR-12: Grounded AI Q&A Assistant with Citations
- **Route**: `/qa`
- **Target Persona**: Legal Counsel, Executives, Procurement Teams.
- **Layout Anatomy**:
  - **Conversational Chat Interface**: Streamlined message feed supporting natural language contract inquiries.
  - **Strict Groundedness Guardrail (AI-004)**: Ensures answers are derived exclusively from indexed documents; out-of-scope queries are rejected with an explicit guardrail notice.
  - **Verifiable Page Citations**: Every generated response includes clickable page anchors (e.g. `[Page 2, Para 4]`) that link directly to the source document page in the Document Viewer.

---

### SCR-13: Admin Studio: Tenant Management & RBAC Matrix
- **Route**: `/admin` *(Tab: Users & Permissions)*
- **Target Persona**: Enterprise IT Administrators, Security Officers.
- **Layout Anatomy**:
  - **Multi-Tenant Organization Switcher**: Configure organization profile, domain white-lists, and regional settings.
  - **User Management Table**: Add, deactivate, and assign enterprise roles across team members.
  - **Granular RBAC Permission Matrix**: Visual matrix defining permissions (View, Ingest, Review, Approve, Export, Administer) across all 6 enterprise roles.

---

### SCR-14: Admin Studio: Governance, Schemas & ERP Webhooks
- **Route**: `/admin` *(Tab: Governance & Integrations)*
- **Target Persona**: Enterprise Architects, Compliance Directors.
- **Layout Anatomy**:
  - **Data Retention & Legal Hold Studio**: Configure document retention periods (e.g., 7 Years) and activate Legal Hold freeze toggles.
  - **Custom Extraction Schema Builder**: Define custom metadata fields, regex validation rules, and mandatory flags.
  - **Outbound ERP Webhook Dispatcher**: Configure SAP, NetSuite, and Salesforce webhook endpoints, view delivery logs, and trigger test payloads.

---

## 4. Visual Verification & Automated Screen Evidence

All 14 platform screens have been automatically verified in an automated headless Chrome session via Puppeteer at enterprise desktop resolution (`1600x1000`).

| Screenshot File | Screen Name | Verified Route | Key Visual Features Verified |
| :--- | :--- | :--- | :--- |
| `01_login.png` | Enterprise Login & SSO | `/login` | Enterprise SSO button, 6-role switcher |
| `02_verify_email.png` | Email Verification | `/verify-email` | 6-digit OTP input boxes, resend timer |
| `03_dashboard.png` | Operations Dashboard | `/dashboard` | SLA breach alert banner, 6 KPI cards |
| `04_documents.png` | Document Repository | `/documents` | Dense table, Scoped Export modal |
| `05_document_detail.png` | Document Viewer | `/documents/doc-101` | Multi-page preview, audit timeline |
| `06_intake.png` | Ingestion Studio | `/intake` | Drag-and-drop, Quarantine Exceptions tab |
| `07_review_queue.png` | Review Queue | `/review` | Worklist filters, status pills |
| `08_review_workbench.png` | 50/50 Review Workbench | `/review/doc-101` | Interactive bounding boxes, zoom/rotate |
| `09_compare_studio.png` | Compare Studio | `/compare/doc-101` | Master-Detail 2-column, 46px metric strip |
| `10_approvals.png` | Approval Center | `/approvals` | 4-stage pipeline stepper, SoD protection |
| `11_tasks.png` | Reviewer Tasks | `/tasks` | SLA countdown badges, priority filters |
| `12_search.png` | Semantic Search | `/search` | Relevance confidence, snippet highlights |
| `13_qa.png` | Grounded AI Q&A | `/qa` | AI-004 guardrails, page citations |
| `14_admin.png` | Admin Studio | `/admin` | RBAC matrix, retention rules, webhooks |

*All visual screenshots are stored in the repository at:* `screenshots/` and `document_intelligence_platform-main/screenshots/`.
