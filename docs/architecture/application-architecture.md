# Application Architecture — Monorepo & Tiering

## Monorepo Structure
DocuNexa is organized as a high-velocity workspace designed for enterprise governance and clear separation of concerns:

```
document_intelligence_platform-main/
├── docs/                                  # Central Enterprise Documentation System
├── screenshots/                           # Headless Chrome Automated UI Verification Captures
└── document_intelligence_platform-main/
    └── document-intelligence-ui/          # Angular 19 Enterprise Client Portal
        ├── src/
        │   ├── app/
        │   │   ├── core/                  # Core Singletons (Auth, Guards, Interceptors)
        │   │   ├── features/              # Modular Standalone Feature Domains
        │   │   │   ├── auth/              # Login & Multi-Factor Auth
        │   │   │   ├── dashboard/         # Executive KPIs & Operations Dashboard
        │   │   │   ├── intake-studio/     # Upload Hub & Quarantine Sandbox
        │   │   │   ├── documents/         # Document Repository & Filter Studio
        │   │   │   ├── document-detail/   # Document Canvas & Metadata Inspector
        │   │   │   ├── review-queue/      # HITL Review Workbench & Split-Screen Studio
        │   │   │   ├── compare/           # Document Version Comparison Studio
        │   │   │   ├── approvals/         # SoD-Enforced Approval & QA Workbench
        │   │   │   ├── tasks/             # Operator Task Board & Queue Manager
        │   │   │   ├── search/            # Full-Text & Semantic Search Studio
        │   │   │   ├── grounded-qa/       # RAG-Powered Grounded Q&A Assistant
        │   │   │   └── admin-studio/      # RBAC, Retention, Legal Hold, & Audit Hub
        │   │   ├── shared/                # Shared Components, Pipes, & UI Directives
        │   │   ├── app.component.ts       # Root Application Shell & Navigation Rail
        │   │   └── app.routes.ts          # Declarative Typed Route Configurations
        │   └── styles.scss                # DocuNexa Enterprise Design System & CSS Token Library
```

---

## Tiered Layering Model
* **Presentation Tier**: Angular 19 Standalone Components utilizing reactive Signals, Zoneless change detection, and SVG canvas rendering.
* **API Gateway Tier**: Node.js REST API handling JWT validation, payload schema validation, rate-limiting, and route dispatching.
* **Domain Service Tier**: Business logic execution for document state machine, math reconciliation, and Separation of Duties enforcement.
* **Data & AI Tier**: PostgreSQL 16 with pgvector extension, Redis BullMQ queues, and Python/C++ OCR worker pods.
