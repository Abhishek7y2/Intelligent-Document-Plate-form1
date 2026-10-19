# PHASE 0 — REPOSITORY INVENTORY AND BASELINE

**Target Repository:** `document_intelligence_platform-main`  
**Active Branch:** `mobile-frontend` (created from `feature/profile-authentication` @ `e9e2d49`)  
**Audit Date:** 2026-10-16  
**Auditor:** Principal Software Architect & QA Auditor  
**Status:** COMPLETE & VERIFIED  

---

## 1. Verified Repository Structure

The repository exhibits a two-tier monorepo structure:
- **Git Root:** `C:/Users/Mobiloitte/3D Objects/document_intelligence_platform-main` containing root `.git/`, `.gitlab-ci.yml`, `docs/`, `audit-reports/`, `docker/`, and performance testing harnesses.
- **Application Directory:** `C:/Users/Mobiloitte/3D Objects/document_intelligence_platform-main/document_intelligence_platform-main` containing the actual source code for `backend/` and `document-intelligence-ui/`.

```
document_intelligence_platform-main/ (Git Root)
├── .git/
├── .gitlab-ci.yml
├── docker-compose.sandbox.yml
├── docs/                                # Authoritative documentation & BRD
│   ├── audit/                           # Audit reports, registers, and sprint reports
│   │   ├── sprints/                     # SPRINT_<NUMBER>_AUDIT.md reports
│   │   ├── CURRENT_WORK_STATE.md
│   │   └── PHASE_0_REPOSITORY_INVENTORY.md
│   ├── BRD_AI_Evaluation_Report.md
│   ├── BRD_Defect_and_Root_Cause_Log.md
│   ├── BRD_Requirement_Traceability_Matrix.md
│   ├── DATABASE_SCHEMA_POSTGRES.sql
│   ├── final-audit-report.md
│   └── ...
├── audit-reports/
├── audit-reports-v2/
└── document_intelligence_platform-main/ # Inner Application Root
    ├── backend/                         # Node.js + TypeScript REST API
    │   ├── src/
    │   │   ├── app.ts                   # Express application setup
    │   │   ├── server.ts                # HTTP bootstrap & outbox poller
    │   │   ├── worker.ts                # BullMQ asynchronous background worker
    │   │   ├── controllers/             # 27 controllers (+ 11 test suites)
    │   │   ├── services/                # 44 domain services (+ 30 test suites)
    │   │   ├── middleware/              # 5 middleware handlers
    │   │   ├── models/                  # 19 domain models
    │   │   ├── database/migrations/     # 34 SQL migration scripts (26 versions)
    │   │   ├── routes/                  # Express route registration (api.routes.ts)
    │   │   ├── utils/                   # Utilities, loggers, normalizers
    │   │   └── workers/                 # BullMQ job processors
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── openapi.yaml                 # OpenAPI 3.1 specification (34.3 KB)
    ├── document-intelligence-ui/        # Angular 17+ (v22 CLI) Web Application
    │   ├── src/app/
    │   │   ├── core/                    # Core services, auth guards, interceptors
    │   │   ├── features/                # 14 feature modules:
    │   │   │   ├── admin/               # Administration sub-pages & settings
    │   │   │   ├── approvals/           # Approval queue and decision forms
    │   │   │   ├── auth/                # Login, MFA, OTP, email verification
    │   │   │   ├── compare/             # Version comparison studio
    │   │   │   ├── dashboard/           # Metrics and system overview
    │   │   │   ├── document-detail/     # Single document view and metadata
    │   │   │   ├── documents/           # Document repository and filters
    │   │   │   ├── intake/              # File upload wizard and queue
    │   │   │   ├── profile/             # User profile and avatar management
    │   │   │   ├── qa/                  # Grounded Q&A and citation interface
    │   │   │   ├── reports/             # Operational reports and export jobs
    │   │   │   ├── review/              # Review workbench & exception triage
    │   │   │   ├── search/              # Semantic search interface
    │   │   │   └── tasks/               # Collaborative task and comment tracking
    │   │   └── shared/                  # Reusable UI widgets and pipes
    │   ├── package.json
    │   └── angular.json
    ├── scripts/                         # Operational & DR backup/restore scripts
    ├── loadtest/                        # k6 and synthetic benchmark scripts
    └── tests/                           # Golden evaluation datasets
```

---

## 2. Verified Technology Stack

| Component | Declared / Target | Verified Runtime / Package |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js / TypeScript | Node `>=20.0.0`, TypeScript `5.5.2` (`npm run build` PASS) |
| **Backend Framework** | Express | Express `4.19.2`, Helmet `7.1.0`, CORS `2.8.5` |
| **Primary Database** | PostgreSQL | PostgreSQL 16, `pg` `8.12.0` (34 migration SQL files) |
| **Derived Database** | MongoDB | MongoDB 7.7+, `mongodb` `7.7.0` |
| **Queue & Cache** | Redis / BullMQ | BullMQ `6.3.15`, ioredis `6.0.0` |
| **Object Storage** | S3 / MinIO | `@aws-sdk/client-s3` `3.1151.0` |
| **OCR Engines** | Tesseract / Gemini | Tesseract CLI adapter + Gemini adapter |
| **Web Frontend** | Angular / TypeScript | Angular `^22.2.0`, RxJS `~7.8.0` (`localhost:4200` HTTP 200) |
| **Mobile Application** | Flutter / Dart | **Not yet initialized** (Target of Sprints 1–9) |
| **Existing iOS App** | Native Swift | **Completely absent** (0 `.swift` or Xcode files found) |

---

## 3. Tooling Constraints & Blockers

- **Flutter CLI:** `flutter` is not in the system `PATH`.
- **Dart CLI:** `dart` is not in the system `PATH`.
- **Android SDK:** Not found at `%LOCALAPPDATA%\Android\Sdk`.
- **Mitigation Strategy:** Flutter application files, Bloc/Riverpod architecture, typed API contracts, and widget tests will be authored and organized cleanly in the repository; build instructions will be provided.

---

## 4. Discovered Authoritative Specifications

1. **Document Intelligence Platform BRD v1.0 (29 Sept 2026):**
   - Covers FR-001 through FR-023, AI-001 through AI-009, NFR-01 through NFR-08, and UAT-01 through UAT-12.
2. **API Specification:** [`backend/openapi.yaml`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/openapi.yaml) (34.3 KB).
3. **Database Schema:** 26 schema versions across 34 SQL migration files.
