import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { ROLE_ROUTE_ACCESS } from './core/models/permissions';

export const routes: Routes = [
  /* =========================
     AUTH ROUTES
  ========================= */
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },

  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email').then(
        (m) => m.VerifyEmail,
      ),
  },

  {
    path: 'forgot-password',
    redirectTo: 'verify-email',
    pathMatch: 'full',
  },

  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then(
        (m) => m.ResetPassword,
      ),
  },

  {
    path: 'access-denied',
    loadComponent: () =>
      import('./features/auth/access-denied/access-denied').then(
        (m) => m.AccessDenied,
      ),
  },

  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/auth/accept-invite/accept-invite').then(
        (m) => m.AcceptInvite,
      ),
  },

  /* =========================
     PROTECTED APPLICATION
  ========================= */
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },

      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/dashboard'] },
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },

      {
        path: 'documents',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/documents'] },
        loadComponent: () =>
          import('./features/documents/documents').then((m) => m.Documents),
      },

      {
        path: 'documents/:id',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/documents/:id'] },
        loadComponent: () =>
          import('./features/document-detail/document-detail').then(
            (m) => m.DocumentDetail,
          ),
      },

      {
        path: 'intake',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/intake'] },
        loadComponent: () =>
          import('./features/intake/intake').then((m) => m.Intake),
      },

      {
        path: 'review',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/review'] },
        loadComponent: () =>
          import('./features/review/review').then((m) => m.Review),
      },

      {
        path: 'review/:id',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/review/:id'] },
        loadComponent: () =>
          import('./features/review/review-workbench/review-workbench').then(
            (m) => m.ReviewWorkbench,
          ),
      },

      {
        path: 'compare',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/compare'] },
        loadComponent: () =>
          import('./features/compare/compare-studio').then(
            (m) => m.CompareStudio,
          ),
      },

      {
        path: 'compare/:id',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/compare/:id'] },
        loadComponent: () =>
          import('./features/compare/compare-studio').then(
            (m) => m.CompareStudio,
          ),
      },

      {
        path: 'approvals',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/approvals'] },
        loadComponent: () =>
          import('./features/approvals/approvals').then((m) => m.Approvals),
      },

      {
        path: 'search',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/search'] },
        loadComponent: () =>
          import('./features/search/search').then((m) => m.Search),
      },

      {
        path: 'qa',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/qa'] },
        loadComponent: () =>
          import('./features/qa/qa').then((m) => m.Qa),
      },

      {
        path: 'tasks',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/tasks'] },
        loadComponent: () =>
          import('./features/tasks/tasks').then((m) => m.Tasks),
      },

      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/reports'] },
        loadComponent: () =>
          import('./features/reports/reports').then((m) => m.Reports),
      },

      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/admin'] },
        loadComponent: () =>
          import('./features/admin/admin').then((m) => m.Admin),
        children: [
          {
            path: '',
            redirectTo: 'overview',
            pathMatch: 'full',
          },
          {
            path: 'overview',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/overview'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-overview/admin-overview').then((m) => m.AdminOverview),
          },
          {
            path: 'users',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/users'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-users/admin-users').then((m) => m.AdminUsers),
          },
          {
            path: 'document-types',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/document-types'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-document-types/admin-document-types').then((m) => m.AdminDocumentTypes),
          },
          {
            path: 'document-types/:id',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/document-types/:id'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-schema-builder/admin-schema-builder').then((m) => m.AdminSchemaBuilder),
          },
          {
            path: 'workflow',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/workflow'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-workflow/admin-workflow').then((m) => m.AdminWorkflow),
          },
          {
            path: 'retention',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/retention'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-retention/admin-retention').then((m) => m.AdminRetention),
          },
          {
            path: 'security',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/security'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-security/admin-security').then((m) => m.AdminSecurity),
          },
          {
            path: 'integrations',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/integrations'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-integrations/admin-integrations').then((m) => m.AdminIntegrations),
          },
          {
            path: 'notifications',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/notifications'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-notifications/admin-notifications').then((m) => m.AdminNotifications),
          },
          {
            path: 'ai-quality',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/ai-quality'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-ai-quality/admin-ai-quality').then((m) => m.AdminAiQuality),
          },
          {
            path: 'audit',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/audit'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-audit/admin-audit').then((m) => m.AdminAudit),
          },
          {
            path: 'reports',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/reports'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-reports/admin-reports').then((m) => m.AdminReports),
          },
          {
            path: 'operations',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/operations'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-operations/admin-operations').then((m) => m.AdminOperations),
          },
          {
            path: 'trace',
            canActivate: [roleGuard],
            data: { roles: ROLE_ROUTE_ACCESS['/admin/trace'] },
            loadComponent: () =>
              import('./features/admin/sub-pages/admin-trace/admin-trace').then((m) => m.AdminTrace),
          },
        ],
      },

      {
        path: 'profile',
        canActivate: [roleGuard],
        data: { roles: ROLE_ROUTE_ACCESS['/profile'] },
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'settings/my-profile',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
      {
        path: 'settings/profile',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
    ],
  },

  /* =========================
     FALLBACK
  ========================= */
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];