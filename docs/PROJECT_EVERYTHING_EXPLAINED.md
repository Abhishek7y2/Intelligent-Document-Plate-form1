# DocuNexa Platform — Master Project & Codebase Encyclopedia

## 1. Executive Platform Overview

**DocuNexa** is an enterprise-scale, cognitive Document Intelligence and Workflow Automation Platform. Designed for mission-critical legal, financial, and compliance operations, DocuNexa automates the ingestion, extraction, validation, version comparison, and governance of complex business documents (Master Services Agreements, Statement of Work agreements, vendor invoices, regulatory compliance filings).

### 1.1 Core Problems Solved
1. **Unstructured Data Chaos**: Eliminates manual data entry from scanned paper documents, multi-page PDFs, and high-volume billing streams.
2. **High-Stakes Contract Risk**: Automates clause-by-clause semantic redlining and risk identification between contract versions with AI plain-English summaries and counter-proposals.
3. **Financial Discrepancy Elimination**: Validates arithmetic consistency across invoice line items using deterministic client-side calculation engines ($\sum(\text{Qty} \times \text{Rate}) + \text{Tax} = \text{Total}$).
4. **Regulatory Governance & Separation of Duties (SoD)**: Enforces enterprise approval hierarchies preventing self-approval of contracts and invoices with cryptographic SHA-256 audit logging.

### 1.2 Technology Stack
- **Web Frontend**: Angular 18/19 Standalone Components, TypeScript, SCSS.
- **Reactivity & State**: Angular Signals (`signal()`, `computed()`, `effect()`) and RxJS Observables.
- **Design System**: DocuNexa Native Enterprise Design System (WCAG 2.1 AA compliant, 8px grid, compact 46px KPI strips, 2-row non-colliding headers).
- **Backend & Ingestion (Spec)**: Node.js / NestJS API Gateway, Python AI & OCR Pods (PaddleOCR / LayoutLMv3), PostgreSQL with `pgvector`, Redis BullMQ queues.
- **Build & SSR**: Angular Vite Dev Server, Ahead-of-Time (AOT) compilation, and SSR Server Hydration with `RenderMode.Server`.

---

## 2. Master Repository Directory Map

```
document_intelligence_platform-main/
├── ARCHITECTURE.md                  # Multi-tiered system architecture & data pipeline specs
├── DESIGN.md                        # Enterprise visual guidelines, color tokens & layout rules
├── DOCUMENT_INTELLIGENCE_PLATFORM_BRD_ANALYSIS.md # 11-page BRD audit & feature gap analysis
├── MEMORY.md                        # Engineering decisions, conventions, budgets & gotchas
├── PROJECT_EVERYTHING_EXPLAINED.md   # [THIS FILE] Comprehensive file-by-file encyclopedia
├── PROJECT_GRAPHIFY.md              # Mermaid lifecycle, state machine & dependency diagrams
├── README.md                        # Master repository onboarding, installation & quickstart
├── TODAYS_WORK_REPORT.md            # Daily technical audit, bug fixes & verification summary
├── WHOLE_UI.md                      # Exhaustive catalog of all 14 screens & layout anatomy
├── screenshots/                     # 16 High-resolution (1600x1000) visual verification captures
│   ├── 01_login.png ... 14_admin.png
├── docs/                            # Deep-dive enterprise architectural documentation
│   ├── README.md
│   ├── architecture/                # System, App, Backend, Frontend, DB, AI, Security specs
│   └── frontend/                    # Web app, routing, components, services, security specs
├── DocNexaReport/                   # Executive audit reports and stakeholder deliverables
└── document_intelligence_platform-main/
    └── document-intelligence-ui/   # Angular 18/19 Standalone Web Application
        ├── angular.json             # Workspace configuration, style budgets & build targets
        ├── package.json             # Node dependencies, scripts & devDependencies
        ├── take-screenshots.mjs     # Automated headless Chrome Puppeteer capture script
        ├── tsconfig.json            # Base TypeScript compiler configuration
        ├── src/
        │   ├── main.ts              # Client-side bootstrap entry point
        │   ├── server.ts            # Node SSR Express server entry point
        │   ├── styles.scss          # Global enterprise design tokens & utility classes
        │   ├── app/
        │   │   ├── app.config.ts    # Application dependency injection providers & routing
        │   │   ├── app.routes.ts    # Typed SPA route definitions & lazy-loaded paths
        │   │   ├── app.component.ts # Root layout shell component
        │   │   ├── core/            # Singleton services, guards, models & DTOs
        │   │   ├── shared/          # Reusable UI primitives, headers, sidebars & pipes
        │   │   └── features/        # All 14 screen components & feature modules
```

---

## 3. Root Level & Governance Documentation Files

### 3.1 [`ARCHITECTURE.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/ARCHITECTURE.md)
- **Role**: Defines the complete multi-tiered technical architecture of DocuNexa.
- **Key Contents**:
  - Four-tier architectural blueprint: Presentation, Business Logic/Orchestration, State & Data Access, and Infrastructure.
  - Deep-dive specifications for the **Version Compare Studio** (BRD Task 7D), **HITL Review Canvas Projection**, **Invoice Arithmetic Engine**, and **Separation of Duties (SoD)**.
  - Data sanitization and PII/Financial masking pipeline for CSV, JSON, and PDF exports.
  - Non-authoritative reading aid legal disclaimers and cryptographic SHA-256 integrity seals.

### 3.2 [`DESIGN.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/DESIGN.md)
- **Role**: Authoritative design system reference for enterprise UI development.
- **Key Contents**:
  - Executive philosophy: Instant comprehension ("Ek Nazar Mein Samajh"), zero cognitive clutter, and strict boundary containment (`overflow-x: hidden`).
  - Calibrated WCAG 2.1 AA color tokens: Brand Indigo (`#4f46e5`), Critical Exposure (`#dc2626`), Warning (`#b45309`), and Verified (`#166534`).
  - Master-Detail Two-Column Studio Layout specifications (`310px` sticky navigator + fluid stage).
  - High-density **46px Compact Metric Strip** replacing bulky 160px KPI cards.
  - Two-row non-colliding stage header architecture preventing button overlap on any screen resolution.

### 3.3 [`MEMORY.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/MEMORY.md)
- **Role**: Engineering logbook and institutional knowledge repository.
- **Key Contents**:
  - Key architectural decisions: Standalone Angular components, fine-grained Signals reactivity, and explicit imports.
  - Build & style budget resolutions: Calibrating `anyComponentStyle` limits in `angular.json` to 60kB/80kB.
  - Server-Side Rendering (SSR) configurations: Setting parameterized routes (`review/:id`, `compare/:id`) to `RenderMode.Server` in `app.routes.server.ts` to prevent prerender build failures.
  - Lessons learned in horizontal overflow prevention and Puppeteer headless browser testing.

### 3.4 [`PROJECT_GRAPHIFY.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/PROJECT_GRAPHIFY.md)
- **Role**: Visual engineering blueprints containing 8 standard Mermaid process graphs.
- **Key Contents**:
  - Diagram 1: End-to-End Document Ingestion & Lifecycle State Machine.
  - Diagram 2: Frontend Routing Topology & SPA Navigation Graph.
  - Diagram 3: Compare Studio Architecture & Semantic Diff Data Flow (Task 7D).
  - Diagram 4: HITL Review Workbench Sequence & SVG Coordinate Projection.
  - Diagram 5: Separation of Duties (SoD) & Multi-Stage Approval Decision Logic.
  - Diagram 6: Frontend Component Architecture & Dependency Graph.
  - Diagram 7: Scoped Export & PII/Financial Masking Security Flow.
  - Diagram 8: AI Groundedness Guardrail (AI-004) Validation Sequence.

### 3.5 [`WHOLE_UI.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/WHOLE_UI.md)
- **Role**: Exhaustive master catalog and specification sheet for all 14 screens.
- **Key Contents**:
  - Screen-by-screen breakdown from SCR-01 to SCR-14 covering route parameters, target personas, component anatomy, layout geometry, interactive states, and responsive adaptations.
  - Automated screen capture inventory mapping PNG evidence in `screenshots/`.

### 3.6 [`README.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/README.md)
- **Role**: Primary onboarding document for new engineers and DevOps staff.
- **Key Contents**: System prerequisites (Node.js 22+, Angular CLI), local installation steps, scripts for running dev servers, production building, and running test suites.

### 3.7 [`TODAYS_WORK_REPORT.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/TODAYS_WORK_REPORT.md)
- **Role**: Comprehensive audit report documenting the day's engineering accomplishments, bug fixes, BRD gap closures, and production build verifications.

### 3.8 [`DOCUMENT_INTELLIGENCE_PLATFORM_BRD_ANALYSIS.md`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/DOCUMENT_INTELLIGENCE_PLATFORM_BRD_ANALYSIS.md)
- **Role**: Original audit analyzing the codebase against the 11-page BRD v1.0 specification, identifying the 14 mandatory screens and compliance mandates.

---

## 4. Enterprise Architecture Documentation (`docs/`)

The `docs/` folder houses specialized architecture blueprints across the platform's multi-layered system:

### 4.1 System & Core Engineering (`docs/architecture/`)
- **`system-architecture.md`**: Overall distributed cloud topology, microservice interactions, ingestion message queues, and load balancing.
- **`application-architecture.md`**: Monorepo structure, state isolation, and component hierarchy between web and backend.
- **`backend-architecture.md`**: Node.js/NestJS service architecture, document controllers, database models, and REST gateways.
- **`frontend-architecture.md`**: Angular standalone component tree, reactive signal graph, and DocuNexa enterprise design tokens.
- **`mobile-architecture.md`**: Native iOS Swift blueprints, Combine/MVVM patterns, and offline-first caching for mobile reviewers.
- **`admin-architecture.md`**: Multi-tenant organization architecture, hierarchical tenant isolation, and RBAC matrix enforcement.
- **`database-architecture.md`**: PostgreSQL 16 schema, document indexing tables, JSONB metadata structures, and audit trail tables.
- **`ai-architecture.md`**: OCR extraction pipeline (PaddleOCR & LayoutLMv3), text chunking, embedding generation, and RAG retrieval pipelines.
- **`security-architecture.md`**: Zero-trust access policies, envelope encryption (AES-256), JWT token rotation, and SoD security policies.
- **`deployment-architecture.md`**: Docker containerization, Kubernetes helm charts, CI/CD pipeline triggers, and zero-downtime rolling deploys.

### 4.2 Frontend Application Engineering (`docs/frontend/`)
- **`web-application.md`**: Single-page web portal specifications, view models, and user interaction patterns.
- **`admin-application.md`**: Governance portal, custom extraction schema builder, and ERP webhook management.
- **`ui-architecture.md`**: Visual hierarchy, spatial spacing system, typography scales, and CSS custom property token registry.
- **`routing.md`**: SPA route registry, parameter resolvers, auth guards, and SSR hydration behavior.
- **`components.md`**: Catalog of UI primitives, modal windows, metric cards, and canvas controllers.
- **`services.md`**: Specifications for singleton core services (`AuthService`, `DocumentService`, `ExportService`).
- **`state-management.md`**: Signal-driven reactive UI states, computed selectors, and session persistence strategies.
- **`forms-validation.md`**: Centralized regex validators, arithmetic reconciliation rules, and error messaging standards.
- **`frontend-security.md`**: Content Security Policy (CSP), XSS sanitization, PII masking toggles, and secure credential handling.

---

## 5. Web Frontend Application Deep-Dive (`document-intelligence-ui/`)

Located at: `document_intelligence_platform-main/document-intelligence-ui/`

### 5.1 Project Configuration & Root Build Files
- **`angular.json`**:
  - The master configuration for the Angular CLI workspace.
  - Configures build targets for development, production, and SSR.
  - Defines calibrated component style budgets (`maximumWarning: "60kB"`, `maximumError: "80kB"`) to accommodate complex enterprise SCSS without failing production builds.
- **`package.json`**:
  - Defines project metadata, build scripts (`npm run build`, `npm start`, `npm run watch`), and package dependencies.
  - Includes `@angular/core`, `@angular/router`, `@angular/common`, `lucide-angular` (enterprise icons), and `puppeteer-core` (automated screenshot runner).
- **`package-lock.json`**: Exact deterministic lockfile guaranteeing reproducible dependency trees.
- **`tsconfig.json` & `tsconfig.app.json`**:
  - Configures TypeScript compiler settings (`strict: true`, `target: ES2022`, `moduleResolution: bundler`).
  - Enables strict null checking and Ahead-of-Time template type verification.
- **`take-screenshots.mjs`**:
  - Automated Puppeteer script that launches Google Chrome headlessly at enterprise resolution (`1600x1000`).
  - Automates SSO authentication, traverses through all 14 platform routes via client-side router dispatching, and saves high-resolution verification PNGs to the `screenshots/` directory.

### 5.2 Application Bootstrap & Global Assets (`src/`)
- **`src/main.ts`**: The client-side entry point that bootstraps the standalone `AppComponent` with application configuration providers (`appConfig`).
- **`src/server.ts`**: Express-based Node.js server handling Server-Side Rendering (SSR) requests, prerendering static routes, and serving dynamic routes.
- **`src/main.server.ts`**: The server-side bootstrap file initializing server hydration.
- **`src/index.html`**: Root HTML5 document skeleton containing the `<app-root>` injection tag, Google Fonts (`Inter`), and application viewport meta tags.
- **`src/styles.scss`**: Global SCSS stylesheet defining application CSS variables, typography scales, scrollbar styling, status badge classes, and layout utility classes.

### 5.3 Core Framework & Routing Configuration (`src/app/`)
- **`app.config.ts`**:
  - Defines the core dependency injection providers for the entire application.
  - Configures the Angular Router (`provideRouter(routes, withComponentInputBinding(), withViewTransitions())`), HTTP client (`provideHttpClient(withFetch())`), and client hydration (`provideClientHydration()`).
- **`app.config.server.ts`**: Server-side configuration merging `appConfig` with server rendering providers (`provideServerRendering()`).
- **`app.routes.ts`**:
  - Declarative typed route table mapping URL paths to lazy-loaded standalone components:
    - `/login` ➔ `LoginComponent`
    - `/verify-email` ➔ `VerifyEmailComponent`
    - `/dashboard` ➔ `DashboardComponent`
    - `/intake` ➔ `IntakeComponent`
    - `/documents` ➔ `DocumentsComponent`
    - `/documents/:id` ➔ `DocumentDetailComponent`
    - `/review` ➔ `ReviewComponent`
    - `/review/:id` ➔ `ReviewWorkbenchComponent`
    - `/compare` & `/compare/:id` ➔ `CompareStudioComponent`
    - `/approvals` ➔ `ApprovalsComponent`
    - `/tasks` ➔ `TasksComponent`
    - `/search` ➔ `SearchComponent`
    - `/qa` ➔ `QAComponent`
    - `/admin` ➔ `AdminComponent`
- **`app.routes.server.ts`**:
  - Specifies SSR rendering modes for each route.
  - Dynamically marks parameterized routes (`review/:id`, `compare/:id`) as `RenderMode.Server` to prevent static parameter prerendering errors.
- **`app.component.ts`, `.html`, `.scss`**:
  - The root shell component containing the global layout container, persistent Topbar header, collapsible Left Navigation Sidebar, and central `<router-outlet>`.

---

### 5.4 Core Services, Guards & Models (`src/app/core/`)

#### A. Core Services (`core/services/`)
- **`auth.service.ts`**:
  - Manages enterprise authentication, session tokens, and current user identity.
  - Stores authenticated user state in an Angular Signal (`currentUser = signal<AuthUser | null>(...)`).
  - Implements role switching across all 6 enterprise roles (`SUPER_ADMIN`, `COMPLIANCE_OFFICER`, `FINANCE_APPROVER`, `LEGAL_REVIEWER`, `INTAKE_OPERATOR`, `AUDITOR`).
- **`document.service.ts`**:
  - The central document data repository and state manager.
  - Maintains mock stores for ingested agreements, invoices, purchase orders, and extraction metadata.
  - Provides reactive methods for fetching document streams, updating field values, and logging lifecycle events.
- **`export.service.ts`**:
  - Orchestrates scoped data exports into CSV, JSON, and Audit PDF formats.
  - Applies role-based sanitization and data masking (PII redaction and financial number obfuscation).
- **`notification.service.ts`**: Manages global toast alerts, SLA warning banners, and error notifications.
- **`ui-state.service.ts`**: Manages global UI preferences, sidebar collapse states, active themes, and accessibility settings.

#### B. Route Guards (`core/guards/`)
- **`auth.guard.ts`**: Protects secure application routes, redirecting unauthenticated sessions to `/login`.

#### C. Domain Models & DTOs (`core/models/`)
- **`auth.model.ts`**: TypeScript interfaces defining `AuthUser`, `Role`, `UserPermission`, and `DemoRole` definitions.
- **`document.model.ts`**: Strongly typed definitions for `DocumentItem`, `ExtractedField`, `BoundingBox`, `LineItem`, `ClauseDiff`, and `AuditRecord`.
- **`export.model.ts`**: Type definitions for export options, masking flags, and generated file metadata.

---

### 5.5 Shared UI Components, Directives & Utilities (`src/app/shared/`)

- **`shared/ui/header/` (`header.ts`, `.html`, `.scss`)**:
  - Top navigation bar featuring the DocuNexa enterprise logo, global search shortcut (`Ctrl+K`), quick notification bell, SLA alert badges, and user profile role-switcher menu.
- **`shared/ui/sidebar/` (`sidebar.ts`, `.html`, `.scss`)**:
  - Collapsible navigation rail providing 1-click access to all 10 platform modules (Dashboard, Intake, Documents, Review, Compare, Approvals, Tasks, Search, Q&A, Admin) with active route indicator pills.
- **`shared/ui/loading-state/` (`loading-state.ts`, `.html`, `.scss`)**: Reusable skeleton loader with animated shimmer effects for data tables and canvas viewers.
- **`shared/ui/error-state/` (`error-state.ts`, `.html`, `.scss`)**: Standardized error recovery component featuring contextual illustrations and a "Retry" button.
- **`shared/ui/empty-state/` (`empty-state.ts`, `.html`, `.scss`)**: Zero-state placeholder displayed when queues or search results return empty.
- **`shared/ui/status-badge/` (`status-badge.ts`)**: Enterprise status pill rendering color-coded risk and pipeline stage tags with calibrated WCAG contrast.
- **`shared/ui/session-warning-modal/` (`session-warning-modal.ts`, `.html`, `.scss`)**: Security modal alerting users before session token expiry with an extend-session countdown.
- **`shared/ui/dev-panel/` (`dev-panel.ts`)**: Floating developer utility panel for instantaneous role-swapping and testing edge-case error states.
- **`shared/pipes/`**:
  - `file-size.pipe.pipe.ts`: Formats raw bytes into readable units (`KB`, `MB`, `GB`).
  - `format-time.pipe.ts`: Formats timestamps into relative time strings (`2 hours ago`, `Just now`).

---

### 5.6 Feature Screens & Modules (`src/app/features/`)

---

#### SCR-01: Authentication & SSO (`features/auth/`)
- **`login/login.ts`, `.html`, `.scss`**:
  - Enterprise authentication screen.
  - Supports one-click Enterprise SAML 2.0 / Okta SSO authentication.
  - Features quick 6-role demo access pills (`.pill-btn`) for rapid role switching.
  - Implements client-side regex email/password validation and account lockout simulation after 5 failed attempts.
- **`verify-email/verify-email.ts`, `.html`, `.scss`**:
  - Two-step MFA email and OTP verification screen.
  - Step 1: Work email submission.
  - Step 2: Auto-advancing 6-digit OTP code entry with a 60-second resend countdown timer.

---

#### SCR-02: Operations Executive Dashboard (`features/dashboard/`)
- **`dashboard.ts`, `.html`, `.scss`**:
  - Central operational command center.
  - **SLA Breach Alert Banner**: High-priority alert banner (`<4h remaining`) highlighting urgent documents requiring immediate human review.
  - **6-KPI Metric Strip**: Real-time telemetry cards displaying Total Ingested, In Review, Auto-Approved Rate (84.2%), SLA Breaches, Pending Approvals, and System Accuracy (98.4%).
  - **Funnel & Throughput Charts**: Interactive SVG visual bar charts rendering weekly ingestion volumes by category.
  - **Actionable Priority Table**: Dense document worklist highlighting documents by SLA urgency.

---

#### SCR-03: Document Ingestion & Quarantine (`features/intake/`)
- **`intake.ts`, `.html`, `.scss`**:
  - High-throughput ingestion portal.
  - **Drag-and-Drop Batch Dropzone**: Multi-file uploader supporting PDF, TIFF, PNG up to 50MB.
  - **Dual Tab Architecture**:
    - Tab 1: **Live Upload Stream** displaying active progress, OCR confidence scores, and processing stages.
    - Tab 2: **Quarantined Exceptions Queue** isolating scans that fail pre-flight resolution checks (<150 DPI) or have corrupt headers.
  - **Exception Remediation Triggers**: Inline action buttons for `HITL Manual Override` and `Retry OCR (Binarize & Deskew)`.

---

#### SCR-04: Document Repository & Export (`features/documents/`)
- **`documents.ts`, `.html`, `.scss`**:
  - Master document library with multi-column filtering by Document Type, Processing Status, Date Range, and Risk Level.
  - **Scoped Data Export Studio Modal**: Allows operators to package document data into CSV, JSON, or Audit PDF packages.
  - **Compliance Masking Controls**: Granular toggles for **PII Masking** (redacts names and contact details) and **Financial Masking** (masks bank accounts and unit rates).

---

#### SCR-05: Document Detail, Multi-Page Viewer & Audit (`features/documents/`)
- **`document-detail.ts`, `.html`, `.scss`**:
  - Deep-dive document inspector.
  - **Multi-Page High-Fidelity Viewer**: Left pane rendering multi-page document views with zoom and page controls.
  - **Metadata & Extraction Inspector**: Right pane displaying extracted entities, confidence scores, and field sources.
  - **Immutable Audit Trail Timeline**: Chronological event stream displaying each lifecycle transition, timestamp, user handle, and SHA-256 seal.
  - **Version Compare Deep Link**: Direct shortcut button navigating into the Version Compare Studio.

---

#### SCR-06 & SCR-07: HITL Review Workbench & Math Engine (`features/review/`)
- **`review.ts`, `.html`, `.scss`**:
  - Queue worklist for human reviewers displaying document priority, confidence scores, and SLA countdowns.
- **`review-workbench/review-workbench.ts`, `.html`, `.scss`**:
  - **50/50 Split-Screen Studio**: Left pane renders document image canvas; right pane hosts structured field inputs.
  - **Interactive Bounding Box Projection**: Extracted fields map to normalized coordinates `[x, y, w, h]`. Focusing a form field highlights the corresponding SVG bounding box on the document canvas with an active indigo glow.
  - **Invoice Line-Item Arithmetic Validator (SCR-07)**:
    - Interactive line-item table recalculating:
      $$\sum (\text{Quantity} \times \text{Rate}) + \text{Tax (18\%)} = \text{Calculated Total}$$
    - Displays an arithmetic discrepancy alert banner if the calculated sum differs from the OCR total by $> ₹0.01$.
    - Provides a 1-click `[Apply Calculated Math]` reconciliation button.

---

#### SCR-08: Version Compare Studio (`features/compare/`)
- **`compare-studio.ts`, `.html`, `.scss`**:
  - Flagship side-by-side contract comparison and semantic diff studio.
  - **Compact 46px Metric Strip**: Consolidates 4 key comparative metrics (Total Deltas, Modified Clauses, High Risk Shifts, Commercial Variance) into a high-density horizontal bar.
  - **Master-Detail 2-Column Grid**:
    - Left Column (310px): Sticky Clause Directory with search filter, category pills, and review progress meter.
    - Right Column (Remaining Width): Full comparison stage with strict zero horizontal overflow (`overflow-x: hidden`).
  - **Two-Row Non-Colliding Stage Header**:
    - Row 1: Clause Badge, Title, Category Pill, Risk Badge.
    - Row 2: Previous/Next Stepper and Accept/Flag Review Actions.
  - **Executive Shift Summary Card**: Triple-zone visual comparison (`v1.0 Baseline ➔ Delta Badge ➔ v2.0 Amendment`) with dual document page citations (`Page 2, Para 4`).
  - **AI Plain-English Impact & Counsel Guidance**: Clear business impact statement and legal guidance.
  - **AI Recommended Counter-Proposal (Fallback Clause)**: Balanced compromise language with a 1-click clipboard copy feature (`navigator.clipboard.writeText`).
  - **Synchronized Redline Panes**: Side-by-side split view and unified manuscript view with dedicated 32px line numbers.
  - **Footer Integrity Bar**: Displays statutory Reading Aid legal disclaimer and cryptographic SHA-256 verification seal.

---

#### SCR-09: Approval Center with Separation of Duties (`features/approvals/`)
- **`approvals.ts`, `.html`, `.scss`**:
  - Multi-stage governance and sign-off portal.
  - **4-Stage Visual Approval Pipeline Stepper**: Ingestion ➔ Review ➔ Finance Approval ➔ Final ERP Lock.
  - **Separation of Duties (SoD) Enforcement**: If the active user uploaded the document, the `Approve` button is disabled, styled with a safety pattern, and labeled `🛡️ SoD Protected: Cannot approve documents you uploaded`.
  - **Standardized Rejection Modal**: Requires explicit rejection categorization (`ERR-MATH-01`, `ERR-CONTRACT-02`, `ERR-EXPIRED-PO`, `ERR-TAX-04`) with mandatory justification notes.

---

#### SCR-10: Reviewer Tasks Worklist (`features/tasks/`)
- **`tasks.ts`, `.html`, `.scss`**:
  - Priority task manager for document operators and reviewers.
  - Filterable by priority, SLA deadline, document category, and assignment state.
  - Features visual countdown timers (`2h 14m Remaining`, `Overdue`) and 1-click task claiming.

---

#### SCR-11: Semantic & Hybrid Search Studio (`features/search/`)
- **`search.ts`, `.html`, `.scss`**:
  - Search studio supporting combined natural language and exact keyword search.
  - Displays relevance confidence match scores (e.g. `96% Match`), highlighted matching text snippets, and deep links into Document Detail views.

---

#### SCR-12: Grounded AI Q&A Assistant (`features/qa/`)
- **`qa.ts`, `.html`, `.scss`**:
  - Conversational interface for querying contract terms and invoice histories.
  - **Strict Groundedness Guardrail (AI-004)**: Ensures answers are derived exclusively from indexed documents; out-of-scope queries are rejected with an explicit guardrail notice.
  - **Verifiable Page Citations**: Every generated response includes clickable page anchors (e.g. `[Page 2, Para 4]`) that link directly to the source document page in the Document Viewer.

---

#### SCR-13 & SCR-14: Admin Studio: RBAC, Governance & ERP (`features/admin/`)
- **`admin.ts`, `.html`, `.scss`**: Admin portal container hosting navigation tabs.
- **`admin-overview.ts`**: High-level platform health, tenant usage quotas, and system latency metrics.
- **`admin-users.ts` (SCR-13)**: Multi-tenant organization switcher, user management directory, and interactive 6-role RBAC permission matrix.
- **`admin-retention.ts` (SCR-14)**: Data retention policy rules (e.g., 7-year statutory retention) and Legal Hold freeze toggles.
- **`admin-schema-builder.ts` (SCR-14)**: Visual schema builder for defining custom extraction fields, regex formats, and mandatory validation rules.
- **`admin-integrations.ts` (SCR-14)**: Configuration studio for outbound ERP webhooks (SAP S/4HANA, NetSuite, Salesforce) with delivery log inspector and test payload triggers.

---

## 6. Visual Evidence Catalog (`screenshots/`)

All 14 platform screens have been automatically captured and verified in high-resolution (`1600x1000` PNG format) via `take-screenshots.mjs`:

| File Name | Screen Identity | Route | Verified Key Elements |
| :--- | :--- | :--- | :--- |
| `01_login.png` | Authentication & SSO | `/login` | SAML/Okta SSO button, 6-role quick switcher |
| `02_verify_email.png` | Email Verification | `/verify-email` | Step 1: Email input & recovery flow |
| `02_mfa_step2_otp.png` | 6-Digit OTP Verification | `/verify-email` | Step 2: Auto-advancing 6-digit OTP fields |
| `03_dashboard.png` | Executive Operations Dashboard | `/dashboard` | SLA breach alert banner (`<4h`), 6 KPI cards |
| `04_documents.png` | Document Repository | `/documents` | Faceted filters, Scoped Export modal triggers |
| `05_document_detail.png` | Document Detail Viewer | `/documents/DOC-10247` | Multi-page preview, extraction metadata inspector |
| `06_intake.png` | Ingestion & Quarantine Studio | `/intake` | Batch upload dropzone, Quarantined Exceptions tab |
| `07_review_queue.png` | Review Worklist Queue | `/review` | Priority worklist, confidence indicators, assignment |
| `08_review_workbench.png` | 50/50 Split-Screen Review | `/review/DOC-10247` | Interactive bounding-box canvas, math engine |
| `09_compare_studio.png` | Side-by-Side Version Diff Studio | `/compare` | 46px compact metric strip, AI Fallback clause |
| `10_approvals.png` | Approval Center | `/approvals` | 4-stage pipeline stepper, SoD protection badge |
| `11_tasks.png` | Reviewer Task Board | `/tasks` | SLA countdown badges, priority filters |
| `12_search.png` | Semantic & Hybrid Search | `/search` | Relevance confidence scores, highlighted snippets |
| `13_qa.png` | Grounded AI Q&A Assistant | `/qa` | AI-004 guardrails, clickable page citations |
| `14_admin.png` | Admin Studio & Governance | `/admin` | RBAC matrix, retention rules, ERP webhooks |

---

## 7. Developer Cheatsheet & Operational Commands

### 7.1 Running Locally
```bash
# Navigate to web application directory
cd "document_intelligence_platform-main/document-intelligence-ui"

# Launch development server
npm start
# -> Access at http://localhost:4200
```

### 7.2 Production Build Verification
```bash
# Execute production build
npm run build
# -> Verifies AOT compilation, style budgets, and 27 static prerendered routes
```

### 7.3 Automated Screenshot Capture
```bash
# Capture fresh high-resolution screenshots for all 14 screens
node take-screenshots.mjs
# -> Outputs high-res PNGs to screenshots/
```
