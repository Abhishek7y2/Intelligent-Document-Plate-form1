# DocuNexa Platform — Engineering Memory & System Conventions

## 1. Project Context & Purpose

**DocuNexa** is an enterprise-grade Document Intelligence Platform built to automate, ingest, extract, review, compare, and govern high-stakes enterprise documents (contracts, master services agreements, vendor invoices, tax filings, compliance certificates).

The web frontend is architected in **Angular (v18/v19 Standalone)** with TypeScript, SCSS, and modern reactive patterns. The interface adheres to strict Tier-1 Enterprise B2B SaaS standards: high information density, instant visual comprehension ("ek nazar mein sab samajh mein aa jaye"), zero cognitive clutter, and robust compliance mechanisms.

---

## 2. Key Architectural Decisions & Engineering Conventions

### 2.1 Angular Standalone Component Architecture
- **No NgModules**: All application components, directives, and pipes are standalone (`standalone: true`).
- **Explicit Imports**: Every component explicitly declares its dependencies in the `@Component({ imports: [...] })` array (e.g., `CommonModule`, `FormsModule`, `RouterLink`, `LucideAngularModule`, shared UI pipes).
- **Control Flow Syntax**: Utilize Angular's modern control flow blocks (`@if`, `@for`, `@switch`, `@empty`) rather than structural directives (`*ngIf`, `*ngFor`) for optimal performance, type-checking, and readability.

### 2.2 Reactive State & Signal Management
- **Angular Signals (`signal()`, `computed()`, `effect()`)**: Core view states, active filters, selection indexes, and arithmetic calculations are powered by Signals for fine-grained reactivity.
- **RxJS Observables**: Used for asynchronous event streams, route param subscriptions, debounced search inputs, and HTTP mock pipelines.
- **Immutability**: State mutations follow immutable patterns, creating new object references rather than mutating in-place to guarantee predictable change detection.

### 2.3 Layout & Spatial Architecture
- **Strict Boundary Containment**:
  - Top-level and nested containers enforce `max-width: 100%`, `overflow-x: hidden`, and flex items enforce `min-width: 0`.
  - Eliminates horizontal overflow and unwanted viewport scrolling across all enterprise display resolutions.
- **Two-Row Non-Colliding Header Architecture**:
  - Header actions are structured into two distinct rows:
    - **Row 1**: Clause/Document Identity (Badge, Title, Category Pill, Risk Badge).
    - **Row 2**: Interactive Controls (Stepper navigation, Accept/Flag review actions, View Mode switches).
  - This architecture prevents button collisions or overlapping even when viewports are resized, zoomed to 125%, or viewed on compact laptops.
- **46px Compact Metric Strip**:
  - Bulky 160px KPI card stacks consume excessive vertical space, pushing comparison panes below the fold.
  - Replaced with a unified 46px height metric strip (`padding: 0.55rem 1.15rem; border-radius: 10px; background: #ffffff`) featuring inline dividers and colored category indicator dots.
  - Keeps the core document comparison stage visible above the fold.

### 2.4 Enterprise Color & Token Conventions
- **Primary Brand**: Indigo (`#4f46e5`, hover `#4338ca`, soft surface `#e0e7ff` / `#eef2ff`).
- **WCAG 2.1 AA Contrast**:
  - Critical / High Risk: `#dc2626` text on `#fee2e2` background with `#fecaca` border.
  - Medium Risk / Warning: `#b45309` text on `#fef3c7` background with `#fde68a` border.
  - Low Risk / Verified: `#166534` text on `#dcfce7` background with `#bbf7d0` border.
  - Neutral Page Canvas: `#f8fafc` (Slate-50); Cards: `#ffffff`; Borders: `#e2e8f0` / `#cbd5e1`.
- **Redline Diff Tokens**:
  - Additions (`<ins>`): `#dcfce7` soft green background, `#166534` text, underline styling.
  - Deletions (`<del>`): `#fee2e2` soft red background, `#991b1b` text, strikethrough styling.

---

## 3. High-Value Business Logic & Governance Patterns

### 3.1 Version Compare Studio (Task 7D BRD Specification)
- **Executive Shift Summary**: Surfaces instant before-and-after change summaries (`v1.0 Baseline ➔ Delta ➔ v2.0 Amendment`) with direct paragraph-level citations (`Page 2, Para 4`).
- **AI Plain-English Impact & Counsel Guidance**: Translates dense legal jargon into plain-English business impact and specific attorney action items.
- **AI Recommended Counter-Proposal (Fallback Clause)**: Provides balanced legal compromise language with a 1-click clipboard copy feature (`navigator.clipboard.writeText`) to accelerate negotiations.
- **Synchronized Redline Panes**: Offers side-by-side split view and unified manuscript view with dedicated 32px line-number columns.
- **Dual Document Viewer Citations**: Clicking baseline or amendment citations navigates directly to the Document Viewer (`/documents/:id?page=X`) with deep-link state.
- **Reading Aid Disclaimer & Audit Integrity**: Prominently displays the mandatory legal disclaimer: *"AI comparison is an assistive reading aid. Final verification rests with qualified legal counsel."* coupled with SHA-256 cryptographic verification hashes.

### 3.2 HITL Review Workbench & Arithmetic Validation Engine
- **50/50 Synchronized Canvas & Form**: Left pane renders multi-page document images; right pane hosts structured field inputs.
- **Interactive SVG Bounding Box Projection**: Extracted fields map to bounding box coordinates `[x, y, width, height]`. Focusing a field highlights the corresponding SVG box on the document canvas with an active glow.
- **Deterministic Math Engine**: Reconciles line-item calculations dynamically:
  $$\sum (\text{Quantity} \times \text{Unit Price}) + \text{Tax (18\%)} = \text{Calculated Total}$$
  If the calculated total differs from the OCR Grand Total by $> ₹0.01$, an arithmetic discrepancy banner is displayed with instant "Apply Calculated Math" override.

### 3.3 Separation of Duties (SoD) & Enterprise Approvals
- **Self-Approval Prevention**: If the currently authenticated user (`currentUser.name`) matches the document submitter, the "Approve" button is automatically disabled with a security shield badge (`🛡️ SoD Protected: Cannot approve own submission`).
- **Standardized Rejection Taxonomy**: Requires explicit reason codes (`ERR-MATH-01`, `ERR-CONTRACT-02`, `ERR-EXPIRED-PO`, `ERR-TAX-04`) and audit notes before rejection can be committed.

### 3.4 AI Groundedness Guardrail (AI-004)
- **Zero Hallucination Constraint**: In the Q&A Assistant (`/qa`), user prompts are validated against indexed document chunks. Out-of-context queries are rejected with an explicit guardrail notice, requiring all answers to cite verifiable document page numbers.

---

## 4. Build, Budget & SSR Gotchas

### 4.1 Angular Style Budget Configuration
- **Gotcha**: High-density enterprise components with extensive split-screen SCSS and badge styling can exceed the default 16kB Angular CLI style budget, failing production builds.
- **Resolution**: In `angular.json`, component style budgets (`anyComponentStyle`) are calibrated to:
  ```json
  {
    "type": "anyComponentStyle",
    "maximumWarning": "60kB",
    "maximumError": "80kB"
  }
  ```
- **Optimization Rule**: Keep component SCSS lean by removing redundant legacy selectors and leveraging shared design tokens in `styles.scss`.

### 4.2 SSR & Hydration for Parameterized Routes
- **Gotcha**: Pre-rendering routes with dynamic parameters (`/review/:id`, `/compare/:id`) during `ng build` can trigger prerendering failure if route parameters cannot be resolved statically.
- **Resolution**: In `app.routes.server.ts`, define dynamic parameterized routes with `RenderMode.Server`:
  ```typescript
  export const serverRoutes: ServerRoute[] = [
    { path: 'review/:id', renderMode: RenderMode.Server },
    { path: 'compare/:id', renderMode: RenderMode.Server },
    { path: '**', renderMode: RenderMode.Prerender }
  ];
  ```

### 4.3 Automated Verification via Puppeteer
- Automated screenshot verification scripts (`take-screenshots.mjs`) run against the local Vite/Angular dev server at standard enterprise viewport resolution `1600x1000`.
- All visual assets and evidence are cataloged in `screenshots/` and verified with zero horizontal overflow.
