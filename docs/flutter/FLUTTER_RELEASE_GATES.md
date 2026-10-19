# FLUTTER MOBILE RELEASE GATES & QUALITY CRITERIA

**Application:** DocuNexa Mobile Client  
**Governance Standard:** Zero Unmitigated P0/P1 Defects; 100% Passing Test Assertions per Sprint Gate  
**Date:** 2026-10-16  

---

## 1. Gating Framework & Evaluation Protocol

Every implementation sprint (Sprint 1 through Sprint 9) must undergo an independent gate review prior to advancing to the subsequent sprint. Gating uses four strict statuses:
- **`PASS`:** All acceptance criteria met, 100% automated tests pass, zero regressions, zero open P0/P1 bugs.
- **`PASS_WITH_NONBLOCKING_ISSUES`:** Core capabilities verified, minor cosmetic or non-blocking defects logged in register with approved mitigation plan.
- **`FAIL`:** Critical business logic broken, security vulnerability introduced, or test suite regressions detected.
- **`BLOCKED`:** External dependencies, credentials, or toolchain missing.

---

## 2. Sprint-by-Sprint Release Gate Matrix

| Gate ID | Sprint Focus | Mandatory Verification Criteria | Pass Threshold | Artifacts Required |
| :--- | :--- | :--- | :---: | :--- |
| **Gate 1** | **Foundation & Tokens** | Clean compilation; DI service registration verified; GoRouter routes navigate; light/dark theme tokens render. | 100% build & unit tests pass | `SPRINT_1_AUDIT.md`, `lcov.info` |
| **Gate 2** | **Auth & Sessions** | Backend JWT login verified; QueuedInterceptor token refresh verified on HTTP 401; biometric unlock functional; zero demo buttons. | 100% auth & session tests pass | `SPRINT_2_AUDIT.md`, negative auth test logs |
| **Gate 3** | **Dashboard & Catalog** | Paginated catalog queries `GET /documents`; skeleton loaders render; filter chips filter records; pull-to-refresh works. | Zero memory leaks; 100% widget tests | `SPRINT_3_AUDIT.md`, DevTools memory dump |
| **Gate 4** | **Intake & Scanner** | Camera scanner auto-crops edges; pre-compresses to 300 DPI; multipart upload to `POST /documents/upload` streams; handles 409 collisions. | Successful end-to-end ingestion | `SPRINT_4_AUDIT.md`, upload receipt logs |
| **Gate 5** | **Review Workbench** | Normalized coordinate ratios scale correctly on screen; bounding box selection works; field edits save via PATCH; math check alerts on mismatch. | Coordinate error < 1.0px; 100% tests pass | `SPRINT_5_AUDIT.md`, coordinate test logs |
| **Gate 6** | **Approvals & SoD** | Swipe-to-approve/reject works; Separation of Duties blocks uploader/reviewer with HTTP 403; high-value approvals prompt for biometrics. | Zero SoD bypasses; 100% approval tests | `SPRINT_6_AUDIT.md`, SoD test evidence |
| **Gate 7** | **Tasks & Q&A** | Task status toggles persist; Q&A conversational messages render; tapping citations centers viewer on exact document coordinates. | Citations accurately link coordinates | `SPRINT_7_AUDIT.md`, citation test logs |
| **Gate 8** | **Administration** | Health telemetry badges reflect live Postgres/Redis; user directory invites users; emergency Legal Hold toggle locks document. | 100% admin role guard tests pass | `SPRINT_8_AUDIT.md`, role permission logs |
| **Gate 9** | **Hardening & Store** | Cold start $\le 1.8$s; memory $\le 180$MB; WCAG 2.1 AA touch targets $\ge 48$dp; signed `.aab` / iOS archive builds with zero warnings. | Zero P0/P1 bugs; 85%+ code coverage | `SPRINT_9_AUDIT.md`, signed release bundle |

---

## 3. Rollback Procedures & Defect Escalation

1. **Gate Failure Escalation:** If a sprint fails its release gate, work on the subsequent sprint is strictly blocked. The engineering team immediately enters a stabilization phase to resolve the blocking defects.
2. **Rollback Policy:** In the event of an unrecoverable regression during sprint execution, Git branch state is rolled back to the tag of the previous passed gate:
   ```bash
   git reset --hard gate-sprint-N-pass
   ```
3. **Audit Trail:** Every gate decision is permanently recorded in `docs/audit/SPRINT_STATUS_TRACKER.md` with cryptographic commit hashes and test execution runtimes.
