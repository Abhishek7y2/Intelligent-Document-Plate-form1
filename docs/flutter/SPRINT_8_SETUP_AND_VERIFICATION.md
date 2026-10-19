# SPRINT 8 SETUP AND VERIFICATION GUIDE
## Mobile Administration, Legal Hold & Operations Monitoring

## 1. Overview
This guide provides workstation and CI verification procedures for DocuNexa Mobile Sprint 8 features:
- Restricted Administrative Hub (`/admin`)
- Operational Telemetry Screen (`/admin/telemetry`)
- User Directory & Role Assignment (`/admin/users`)
- Workflow Policies & Rules Inspection (`/admin/rules`)
- Dead-Letter Queue (DLQ) Operations (`/admin/operations`)
- Emergency Legal Hold & Retention Freeze (`/admin/legal-hold`)

---

## 2. Environment Status & Prerequisites

### Workstation Toolchain Status
- **Current Status:** `NOT_RUN`
- **Limitation:** `BLK-001` — The host workstation does not have `flutter` or `dart` in its PATH environment variable.
- **Contract Adherence:** Authored test suites are not described as passed until executed in a verified runtime environment.

### Required Software for Verification
- Flutter SDK 3.22.x+ (Channel: stable)
- Dart SDK 3.4.x+
- Android Studio / Xcode (optional for unit/widget tests; required for device run)

---

## 3. Verification Commands

Run the following commands from the project root or CI runner:

```powershell
# Navigate to mobile project directory
cd mobile

# 1. Dependency Resolution
flutter pub get

# 2. Formatting Check (Strict Zero-Diff)
dart format --output=none --set-exit-if-changed .

# 3. Static Analysis (Zero Lints & Warnings)
flutter analyze --fatal-infos

# 4. Execute Sprint 8 Admin & Legal Hold Test Suites
flutter test test/features/admin/
flutter test test/features/legal_hold/

# 5. Execute Complete Test Suite (Sprints 1–8)
flutter test

# 6. Verify Debug Compilation (Smoke Build)
flutter build apk --debug
```

---

## 4. Test Suite Inventory

Sprint 8 authored **28 tests** across unit and widget specifications:

| Test File | Type | Test Count | Key Scenarios Covered |
|---|---|:---:|---|
| `test/features/admin/presentation/bloc/admin_bloc_test.dart` | Unit (BLoC) | 10 | Telemetry loading, 403 forbidden permissions, stale-data handling, user invitation creation, role update, workflow rule retrieval, DLQ retry, and error states. |
| `test/features/legal_hold/presentation/bloc/legal_hold_bloc_test.dart` | Unit (BLoC) | 6 | Hold listing, mandatory reason collection, emergency freeze creation, hold release, and permission denial. |
| `test/features/admin/presentation/screens/admin_telemetry_screen_test.dart` | Widget | 4 | Loading indicator, 403 permission-denied banner, loaded KPI cards and health metrics, and error state with retry. |
| `test/features/admin/presentation/screens/operations_queue_screen_test.dart` | Widget | 4 | Loading indicator, empty DLQ queue, failed job card with retry count & button, and access restriction. |
| `test/features/legal_hold/presentation/screens/legal_hold_screen_test.dart` | Widget | 4 | Loading indicator, empty state, active legal hold card with matter scope & release button, and permission denial. |

**Total Sprint 8 Authored Tests:** 28

---

## 5. Security & Permission Verification Matrix

| Endpoint | Method | Required Permission | Verified Mobile Behavior |
|---|---|---|---|
| `/api/v1/reports/kpis` | `GET` | `ADMIN` / `OPERATOR` | Renders throughput & SLA KPIs; shows restricted banner on 403. |
| `/api/v1/reports/governance`| `GET` | `ADMIN` / `AUDITOR` | Renders governance and hold stats. |
| `/api/v1/health` | `GET` | Public / Authenticated | Renders system uptime and database status. |
| `/api/v1/users/invitations` | `GET` | `USER_MANAGE` | Displays user directory; shows restricted banner on 403. |
| `/api/v1/users/invite` | `POST` | `USER_MANAGE` | Validates email & role, submits invitation, refreshes directory. |
| `/api/v1/users/invitations/:id` | `DELETE` | `USER_MANAGE` | Revokes pending invitation. |
| `/api/v1/users/:id/role` | `PATCH` | `USER_MANAGE` | Updates user role; rejects client-side tampering. |
| `/api/v1/policies` | `GET` | `POLICY_VIEW` | Read-only inspection of workflow rules. |
| `/api/v1/admin/operations/dlq` | `GET` | `ADMIN_ACCESS` | Inspects failed queue jobs; shows restricted banner on 403. |
| `/api/v1/admin/operations/dlq/:id/retry` | `POST` | `ADMIN_ACCESS` | Requeues failed task for re-execution. |
| `/api/v1/retention/holds` | `GET` | `ADMIN_ACCESS` | Lists active and released legal holds. |
| `/api/v1/retention/holds` | `POST` | `ADMIN_ACCESS` | Enforces mandatory `matterName`, `matterNumber`, and `reason`; displays freeze warning. |
| `/api/v1/retention/holds/:id/release` | `POST` | `ADMIN_ACCESS` | Enforces mandatory `releaseReason` before server dispatch. |

---

## 6. Sprint Completion Check
- [x] All admin views built under `mobile/lib/features/admin/`
- [x] Emergency legal hold built under `mobile/lib/features/legal_hold/`
- [x] Zero fabricated endpoints; all endpoints verified against Express routes
- [x] Mandatory confirmation and justification on legal hold creation and release
- [x] Web-only exclusion respected (no visual schema designer or webhook editor)
- [x] Navigation wired into router and user profile
- [x] Tests authored and documented; execution status marked `NOT_RUN`
- [x] STOPPED after Sprint 8. Sprint 9 awaiting explicit authorization.
