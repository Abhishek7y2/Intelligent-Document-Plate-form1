# SCREEN AND NAVIGATION INVENTORY — DOCUNEXA MOBILE

**Application:** DocuNexa Mobile (Flutter / Dart)  
**Routing Library:** `go_router` (v14.x)  
**Total Screens Mapped:** 33 Views (18 Full Parity, 9 Adapted, 4 Restricted, 2 Excluded)  
**Date:** 2026-10-16  

---

## 1. Top-Level Navigation Topology

DocuNexa Mobile organizes user navigation into three distinct routing tiers:
1. **Unauthenticated Auth Stack:** Public authentication, onboarding, email verification, and recovery screens.
2. **Authenticated App Shell (StatefulShellRoute):** Persistent 5-tab Bottom Navigation Bar preserving tab scroll position and view states.
3. **Modal & Sub-Route Push Stack:** Full-screen detail views, review workbenches, camera scanners, and administrative management sheets.

```mermaid
graph TD
    Root[App Router /]
    
    Root -->|Unauthenticated| AuthStack
    AuthStack --> Login[/login]
    AuthStack --> Verify[/verify-email]
    AuthStack --> Reset[/reset-password]
    AuthStack --> Invite[/accept-invite]
    AuthStack --> Denied[/access-denied]

    Root -->|Authenticated| MainTabs[StatefulShellRoute - 5 Tabs]
    MainTabs --> Tab0["Tab 0: /dashboard\n(DashboardScreen)"]
    MainTabs --> Tab1["Tab 1: /documents\n(DocumentCatalogScreen)"]
    MainTabs --> Tab2["Tab 2: /review\n(ReviewQueueScreen)"]
    MainTabs --> Tab3["Tab 3: /approvals\n(ApprovalsQueueScreen)"]
    MainTabs --> Tab4["Tab 4: /profile\n(UserProfileScreen)"]

    Tab0 --> FAB["FAB Modal: /intake\n(Camera Ingestion)"]
    Tab1 --> DocDetail["/documents/:id\n(DocumentDetailScreen)"]
    Tab1 --> Search["/search\n(SearchScreen)"]
    Tab1 --> QA["/qa\n(QaChatScreen)"]
    Tab1 --> Compare["/compare/:id\n(CompareDiffScreen)"]
    Tab1 --> Tasks["/tasks\n(TaskManagementScreen)"]
    Tab1 --> Reports["/reports\n(ReportsAnalyticsScreen)"]

    Tab2 --> Workbench["/review/:id\n(ReviewWorkbenchScreen)"]
    Tab3 --> ApprovalsSheet["/approvals/:id\n(ApprovalDetailSheet)"]

    Tab4 --> AdminDrawer["Admin Management Drawer"]
    AdminDrawer --> Telemetry["/admin/telemetry"]
    AdminDrawer --> Users["/admin/users"]
    AdminDrawer --> Retention["/admin/retention"]
    AdminDrawer --> Operations["/admin/operations"]
```

---

## 2. Complete Screen-by-Screen Routing & State Inventory

| # | Route Path | Screen Class Name | Navigation Type | Role Requirements | Primary BLoC / State Manager | Backend Route(s) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `/login` | `LoginScreen` | Root Stack | Public | `AuthBloc` | `POST /auth/login`, `POST /auth/request-otp` |
| **2** | `/verify-email` | `VerifyEmailScreen` | Push Route | Public | `AuthBloc` | `POST /auth/verify-otp`, `POST /auth/request-otp` |
| **3** | `/reset-password` | `ResetPasswordScreen` | Push Route | Public | `AuthBloc` | `POST /auth/request-password-reset`, `POST /auth/confirm-password-reset` |
| **4** | `/access-denied` | `AccessDeniedScreen` | Push Route | Public | Stateless | N/A (Client redirect on 403 guard) |
| **5** | `/accept-invite` | `AcceptInviteScreen` | Deep Link Push | Public | `AuthBloc` | `POST /auth/accept-invite` |
| **6** | `/dashboard` | `DashboardScreen` | Shell Tab 0 | All Authenticated | `DashboardBloc` | `GET /reports/kpis`, `GET /documents?limit=5`, `GET /review/queue?limit=5` |
| **7** | `/documents` | `DocumentCatalogScreen` | Shell Tab 1 | Tenant Roles | `DocumentCatalogBloc` | `GET /documents` |
| **8** | `/documents/:id` | `DocumentDetailScreen` | Push Route | Tenant Roles | `DocumentDetailBloc` | `GET /documents/:id`, `POST /documents/:id/retry` |
| **9** | `/intake` | `IntakeScreen` | Modal Sheet / FAB | Contributor, Reviewer, Approver, Admin | `IntakeBloc` | `POST /documents/upload` |
| **10**| `/review` | `ReviewQueueScreen` | Shell Tab 2 | Reviewer, Org Admin | `ReviewQueueBloc` | `GET /review/queue` |
| **11**| `/review/:id` | `ReviewWorkbenchScreen` | Full-Screen Push | Reviewer, Org Admin | `ReviewWorkbenchBloc` | `GET /review/workbench/:id`, `PATCH /review/:id/fields/:key`, `POST /review/:id/decision` |
| **12**| `/compare` | `CompareSelectorScreen` | Push Route | Tenant Roles | `CompareBloc` | `GET /documents?limit=20` |
| **13**| `/compare/:id` | `CompareDiffScreen` | Push Route | Tenant Roles | `CompareDiffBloc` | `POST /compare`, `GET /compare/:id` |
| **14**| `/approvals` | `ApprovalsQueueScreen` | Shell Tab 3 | Approver, Org Admin | `ApprovalsBloc` | `GET /approvals/queue`, `POST /approvals/:id/decision` |
| **15**| `/search` | `SearchScreen` | Push Route | Tenant Roles | `SearchBloc` | `GET /search` |
| **16**| `/qa` | `QaChatScreen` | Push Route | Tenant Roles | `QaBloc` | `POST /qa/ask`, `POST /qa/verify-citation` |
| **17**| `/tasks` | `TaskManagementScreen` | Push Route | Tenant Roles | `TaskBloc` | `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id` |
| **18**| `/reports` | `ReportsAnalyticsScreen` | Push Route | All Roles | `ReportsBloc` | `GET /reports/governance`, `GET /reports/operational`, `GET /reports/kpis` |
| **19**| `/profile` | `UserProfileScreen` | Shell Tab 4 | All Roles | `ProfileBloc` | `GET /users/profile`, `POST /users/profile/avatar`, `DELETE /auth/sessions/:id` |
| **20**| `/admin/telemetry` | `AdminTelemetryScreen` | Drawer Push | Org Admin, Operator | `AdminTelemetryBloc` | `GET /health/ready`, `GET /admin/telemetry` |
| **21**| `/admin/users` | `UserDirectoryScreen` | Drawer Push | Org Admin | `UserManagementBloc` | `GET /admin/users`, `POST /users/invite`, `PATCH /users/:id/role` |
| **22**| `/admin/document-types` | `DocTypesCatalogScreen` | Drawer Push | Org Admin | `DocTypeAdminBloc` | `GET /admin/document-types` |
| **23**| `/admin/document-types/:id` | *Web-Only Banner* | Informational | Org Admin | Stateless | *Excluded: Redirects user to web schema builder* |
| **24**| `/admin/workflow` | `WorkflowRulesScreen` | Drawer Push | Org Admin | `WorkflowAdminBloc` | `GET /admin/workflow/rules` |
| **25**| `/admin/retention` | `RetentionPoliciesScreen` | Drawer Push | Org Admin | `RetentionAdminBloc` | `GET /retention/policies`, `POST /retention/holds` |
| **26**| `/admin/security` | `SecuritySettingsScreen` | Drawer Push | Org Admin | `SecurityAdminBloc` | `GET /admin/security/policies` |
| **27**| `/admin/integrations` | `IntegrationsScreen` | Drawer Push | Org Admin | `IntegrationsBloc` | `GET /admin/integrations` |
| **28**| `/admin/integrations/webhooks` | *Web-Only Banner* | Informational | Org Admin | Stateless | *Excluded: Redirects user to web scripting portal* |
| **29**| `/admin/notifications` | `NotificationConfigScreen` | Drawer Push | Org Admin, Operator | `NotificationAdminBloc` | `GET /admin/notifications/templates` |
| **30**| `/admin/ai-quality` | `AiQualityBenchmarkScreen` | Drawer Push | Org Admin | `AiQualityBloc` | `GET /admin/ai-quality/benchmarks` |
| **31**| `/admin/audit` | `AuditLedgerScreen` | Drawer Push | Org Admin, Operator | `AuditLedgerBloc` | `GET /admin/audit` |
| **32**| `/admin/operations` | `OperationsDashboardScreen` | Drawer Push | Operator, Org Admin | `OperationsBloc` | `GET /admin/operations/queue`, `POST /documents/:id/retry` |
| **33**| `/admin/trace/:correlationId` | `TraceViewerScreen` | Deep Link / Push | Admin, Operator | `TraceBloc` | `GET /admin/trace/:correlationId` |

---

## 3. Deep Linking Schema (`docunexa://`)

The mobile client registers the custom URL scheme `docunexa://` and universal links `https://app.docunexa.com`:
- `docunexa://invite?token={token}` -> Navigates to `/accept-invite?token={token}`
- `docunexa://reset-password?token={token}` -> Navigates to `/reset-password?token={token}`
- `docunexa://documents/{id}` -> Navigates to `/documents/{id}`
- `docunexa://review/{id}` -> Navigates to `/review/{id}`
- `docunexa://trace/{correlationId}` -> Navigates to `/admin/trace/{correlationId}`
