# DECISIONS AND BLOCKERS REGISTER — DOCUNEXA PLATFORM

## 1. Architectural & Development Decisions

| Decision ID | Area | Decision Summary | Rationale |
| :--- | :--- | :--- | :--- |
| **DEC-001** | Git Strategy | Dedicated branch `mobile-frontend` created from `feature/profile-authentication` | Isolates Flutter development while preserving working backend and Angular frontend branches. |
| **DEC-002** | Mobile Framework | Flutter & Dart targeting Android first | Meets cross-platform mobile requirement while maintaining full native performance. |
| **DEC-003** | Backend Reuse | Mobile app connects directly to existing Node.js `/api/v1` REST endpoints | Prevents duplicate backend logic, schemas, or secondary databases. |
| **DEC-004** | Document Ingestion Endpoint | Mobile client will target `/api/v1/documents/upload` | Aligns with the verified backend Express route table rather than the buggy frontend path. |
| **DEC-005** | State Management | Feature-scoped BLoC / Cubit architecture | Provides deterministic state transitions, clear offline/error states, and high testability for mobile. |
| **DEC-006** | Mobile Auth Security | Strip demo role switcher and local password bypass in Flutter | Eliminates critical security vulnerabilities (DEF-009, DEF-010) present in the web UI. |
| **DEC-007** | Network Session Resiliency | Dio interceptor with token refresh queue | Resolves DEF-011 by automatically refreshing expired access tokens using secure refresh tokens. |
| **DEC-008** | Review Workbench Mobile UX | Dual-panel InteractiveViewer with touch-scaled bounding boxes and bottom sheet editor | Translates desktop 50/50 split screen into ergonomic phone layout. |
| **DEC-009** | Backend Persistence Fix | Centralized database initialization hook in `server.ts` | Required to resolve DEF-002 / SEC-010 before conducting live mobile integration testing. |
| **DEC-010** | Mobile Parity Categorization | 18 Full Parity, 9 Mobile Adaptation, 4 Restricted Admin, 2 Web-Only Excluded | Establishes realistic, touch-ergonomic mobile scope while preventing desktop UI overload. |
| **DEC-011** | Dio Token Refresh Queue | Synchronized QueuedInterceptor in Dio handling HTTP 401 | Prevents session dropouts and eliminates web token management flaw (DEF-011 / SEC-009). |
| **DEC-012** | Mobile Review Workbench | Swipeable Dual-Panel with InteractiveViewer & normalized coordinate scaling | Resolves desktop split-screen usability issue and avoids coordinate scaling bugs (DEF-007). |
| **DEC-013** | Edge Camera Ingestion | Native scanner integration (`cunning_document_scanner`) with 300 DPI pre-compression | Optimizes cellular bandwidth while preserving high-resolution OCR fidelity. |
| **DEC-014** | Mobile Security & Biometrics | Hardware Keystore/Keychain via `flutter_secure_storage` and `local_auth` | Provides hardware-backed token security and biometric re-authentication for high-value actions. |
| **DEC-015** | Password Recovery Architecture | Omit unauthenticated password reset endpoint; use verified OTP login and authenticated password change (`change-password`) | Backend API does not expose an unauthenticated `/auth/forgot-password` endpoint. Document recovery flow follows backend contract reality rather than inventing imaginary endpoints. |
| **DEC-016** | TOTP MFA Challenge Contract | Retain login credentials in memory during challenge state to complete `POST /auth/login` | Backend `loginHandler` validates `if (!email || !password)` before checking `mfaCode`. Completing the TOTP challenge requires submitting credentials alongside `mfaCode` since no standalone unauthenticated verify endpoint exists. |
| **DEC-017** | Document File Operations & Preview | Rely on server-rendered page images (`/documents/:id/pages/:pageNo/image`); omit non-existent raw download | Backend does not expose a raw file download endpoint. Server-rendered PNG page raster with tenant isolation is the authorized inspection mechanism, preserving tenant compliance and retention boundaries. |
| **DEC-018** | Mobile Evidence Coordinate Geometry Scaling | Scale normalized ratios ($[0.0, 1.0]$) strictly against rendered image dimensions using `CustomPainter` inside `InteractiveViewer` | Prevents bounding box drift across screen sizes, device rotations, and zoom/pan actions. |
| **DEC-019** | Math Discrepancy & Compliance Override Enforcement | Enforce explicit override justifications on `APPROVE` decisions when math fails validation | Adheres strictly to backend `submitReviewDecisionHandler` which rejects un-justified approvals with HTTP 422 `INVOICE_TOTAL_MISMATCH`. |
| **DEC-020** | Separation of Duties Policy Enforcement | Server-side authoritative SoD enforcement via `POST /api/v1/approvals/:id/decide` with distinct policy error codes | Guarantees compliance boundaries cannot be bypassed by client-side state manipulation. |
| **DEC-021** | Outbound ERP Outbox Publishing Integration | Outbound ERP publication dispatch via `POST /api/v1/erp/publish/:id` with idempotency keys (`IDEMP-...`) | Protects against duplicate financial transactions while tracking enterprise dispatch status. |
| **DEC-022** | Grounded Q&A Citation Verification & Scope | Scoped question querying via `/qa/query` with server-side citation authorization verification via `POST /qa/citations/verify` | Strictly prevents ungrounded AI hallucinations and ensures cited spans are accessible to user tenant. |
| **DEC-023** | In-App vs Native Push Notifications | Implement full in-app notification center; document lack of APNs/FCM server contract without fabricating push delivery | Conforms to sprint requirement to avoid inventing push notification registration contracts while delivering a complete in-app notification center. |
| **DEC-024** | Emergency Legal Hold Mandatory Justification & Server Confirmation | Mandate non-empty `matterName`, `matterNumber`, and `reason` on placement, and `releaseReason` on release; display freeze warnings and confirm state transitions ONLY after HTTP response | Strictly adheres to backend retention policy invariants; guarantees legal hold freeze cannot be fabricated or implied without verified server confirmation. |
| **DEC-025** | Restricted Admin Operations & In-Flight DLQ Retry Guards | Enforce `ADMIN_ACCESS`, `USER_MANAGE`, and `POLICY_VIEW` permissions; guard against duplicate queue retries with in-flight state tracking | Prevents duplicate processing job dispatches and displays dedicated 403 Forbidden views when administrative roles are absent. |
| **DEC-026** | Single-Flight Refresh Fast-Path & In-Flight BLoC Guards | Compare failed request auth token against storage before refresh; drop duplicate concurrent mutation events in operational BLoCs | Prevents race-condition refresh loops, refresh token rotation invalidations, and duplicate financial/legal mutations on slow networks. |

---

## 2. Active Blockers & Mitigations

| Blocker ID | Severity | Description | Mitigation Strategy |
| :--- | :---: | :--- | :--- |
| **BLK-001** | **High** | Flutter & Dart CLI binaries are not in host environment PATH. | The entire Flutter application structure, Bloc state managers, repositories, DTOs, and UI widgets will be authored and organized cleanly in the repository; manual/CI execution commands will be documented. |
| **BLK-002** | **Resolved** | Backend services defaulted to in-memory mode in production. | **RESOLVED (Sprint 0D):** `persistence-initializer.ts` wired to `server.ts` startup enables durable database mode across all 15 services. |
| **BLK-003** | **Medium** | Missing mobile application baseline. | No native iOS or Android code exists to migrate; greenfield Flutter implementation guided strictly by Angular UI and BRD. |
