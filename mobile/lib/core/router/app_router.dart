import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/approvals/presentation/screens/approval_detail_screen.dart';
import '../../features/approvals/presentation/screens/approvals_queue_screen.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_state.dart';
import '../../features/auth/presentation/screens/accept_invite_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/documents/presentation/screens/document_catalog_screen.dart';
import '../../features/documents/presentation/screens/document_detail_screen.dart';
import '../../features/intake/presentation/screens/intake_screen.dart';
import '../../features/profile/presentation/screens/user_profile_screen.dart';
import '../../features/review/presentation/screens/review_queue_screen.dart';
import '../../features/review/presentation/screens/review_workbench_screen.dart';
import '../../features/version_compare/presentation/screens/version_compare_screen.dart';
import '../../features/version_compare/presentation/screens/version_history_screen.dart';
import '../../features/tasks/presentation/screens/tasks_screen.dart';
import '../../features/tasks/presentation/screens/task_detail_screen.dart';
import '../../features/notifications/presentation/screens/notification_center_screen.dart';
import '../../features/qa/presentation/screens/qa_screen.dart';
import '../../features/admin/presentation/screens/admin_hub_screen.dart';
import '../../features/admin/presentation/screens/admin_telemetry_screen.dart';
import '../../features/admin/presentation/screens/user_directory_screen.dart';
import '../../features/admin/presentation/screens/workflow_rules_screen.dart';
import '../../features/admin/presentation/screens/operations_queue_screen.dart';
import '../../features/admin/presentation/screens/admin_security_screen.dart';
import '../../features/admin/presentation/screens/admin_integrations_screen.dart';
import '../../features/admin/presentation/screens/admin_audit_ledger_screen.dart';
import '../../features/admin/presentation/screens/admin_trace_screen.dart';
import '../../features/reports/presentation/screens/reports_analytics_screen.dart';
import '../../features/legal_hold/presentation/screens/legal_hold_screen.dart';
import '../widgets/app_sidebar_drawer.dart';
import '../di/injection_container.dart';
import '../theme/app_colors.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
      (dynamic _) => notifyListeners(),
    );
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

class AppRouter {
  const AppRouter._();

  static GoRouter createRouter({AuthBloc? authBloc}) {
    final bloc = authBloc ?? (sl.isRegistered<AuthBloc>() ? sl<AuthBloc>() : null);

    return GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/dashboard',
      refreshListenable: bloc != null ? GoRouterRefreshStream(bloc.stream) : null,
      redirect: (context, state) {
        if (bloc == null) return null;

        final authState = bloc.state;
        final isAuthRoute = state.matchedLocation == '/login' ||
            state.matchedLocation == '/accept-invite';

        if (authState is Unauthenticated ||
            authState is AuthInitial ||
            authState is AuthError) {
          return isAuthRoute ? null : '/login';
        }

        if (authState is Authenticated) {
          if (authState.isBiometricLocked) {
            return '/login';
          }
          if (isAuthRoute) {
            return '/dashboard';
          }
        }

        return null;
      },
      routes: [
        // Public Auth Routes
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/accept-invite',
          builder: (context, state) {
            final token = state.uri.queryParameters['token'];
            return AcceptInviteScreen(initialToken: token);
          },
        ),

        // 5-Tab Authenticated Navigation Shell (Adaptive Layout matching Angular Shell)
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return LayoutBuilder(
              builder: (context, constraints) {
                final isTabletOrDesktop = constraints.maxWidth >= 768;

                if (isTabletOrDesktop) {
                  // TABLET / DESKTOP ADAPTIVE LAYOUT (MIRRORING ANGULAR WEB SHELL)
                  return Scaffold(
                    backgroundColor: AppColors.slate900,
                    body: Row(
                      children: [
                        SizedBox(
                          width: 260,
                          child: AppSidebarDrawer(activeRoute: state.matchedLocation),
                        ),
                        const VerticalDivider(width: 1, thickness: 1, color: AppColors.slate800),
                        Expanded(child: navigationShell),
                      ],
                    ),
                    floatingActionButton: FloatingActionButton(
                      onPressed: () => context.push('/intake'),
                      backgroundColor: AppColors.primary600,
                      foregroundColor: Colors.white,
                      tooltip: 'Ingest Document',
                      child: const Icon(Icons.document_scanner_rounded),
                    ),
                  );
                }

                // PHONE VIEWPORT: 5-TAB PERSISTENT NAVIGATION
                return Scaffold(
                  body: navigationShell,
                  bottomNavigationBar: BottomNavigationBar(
                    currentIndex: navigationShell.currentIndex,
                    onTap: (index) => navigationShell.goBranch(
                      index,
                      initialLocation: index == navigationShell.currentIndex,
                    ),
                    backgroundColor: AppColors.slate900,
                    selectedItemColor: AppColors.primary500,
                    unselectedItemColor: AppColors.slate400,
                    type: BottomNavigationBarType.fixed,
                    items: const [
                      BottomNavigationBarItem(
                        icon: Icon(Icons.dashboard_outlined),
                        activeIcon: Icon(Icons.dashboard_rounded),
                        label: 'Dashboard',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.folder_outlined),
                        activeIcon: Icon(Icons.folder_rounded),
                        label: 'Documents',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.rate_review_outlined),
                        activeIcon: Icon(Icons.rate_review_rounded),
                        label: 'Review',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.assignment_turned_in_outlined),
                        activeIcon: Icon(Icons.assignment_turned_in_rounded),
                        label: 'Approvals',
                      ),
                      BottomNavigationBarItem(
                        icon: Icon(Icons.person_outline_rounded),
                        activeIcon: Icon(Icons.person_rounded),
                        label: 'Profile',
                      ),
                    ],
                  ),
                  floatingActionButton: FloatingActionButton(
                    onPressed: () => context.push('/intake'),
                    backgroundColor: AppColors.primary600,
                    foregroundColor: Colors.white,
                    tooltip: 'Ingest Document',
                    child: const Icon(Icons.document_scanner_rounded),
                  ),
                );
              },
            );
          },
          branches: [
            // Branch 0: Dashboard
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/dashboard',
                  builder: (context, state) => const DashboardScreen(),
                ),
              ],
            ),
            // Branch 1: Documents
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/documents',
                  builder: (context, state) => const DocumentCatalogScreen(),
                ),
              ],
            ),
            // Branch 2: Review
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/review',
                  builder: (context, state) => const ReviewQueueScreen(),
                ),
              ],
            ),
            // Branch 3: Approvals
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/approvals',
                  builder: (context, state) => const ApprovalsQueueScreen(),
                ),
              ],
            ),
            // Branch 4: Profile
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  builder: (context, state) => const UserProfileScreen(),
                ),
              ],
            ),
          ],
        ),

        // Modal Intake Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/intake',
          builder: (context, state) => const IntakeScreen(),
        ),

        // Document Detail Push Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/documents/:id',
          builder: (context, state) {
            final documentId = state.pathParameters['id'] ?? '';
            return DocumentDetailScreen(documentId: documentId);
          },
        ),

        // Review Workbench Push Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/review/:id',
          builder: (context, state) {
            final documentId = state.pathParameters['id'] ?? '';
            return ReviewWorkbenchScreen(documentId: documentId);
          },
        ),

        // Approval Detail Push Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/approvals/:id',
          builder: (context, state) {
            final documentId = state.pathParameters['id'] ?? '';
            return ApprovalDetailScreen(documentId: documentId);
          },
        ),

        // Document Version History Push Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/documents/:id/versions',
          builder: (context, state) {
            final documentId = state.pathParameters['id'] ?? '';
            return VersionHistoryScreen(documentId: documentId);
          },
        ),

        // Document Version Comparison Studio Push Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/compare',
          builder: (context, state) {
            final docId1 = state.uri.queryParameters['doc1'] ?? state.uri.queryParameters['documentId1'] ?? '';
            final docId2 = state.uri.queryParameters['doc2'] ?? state.uri.queryParameters['documentId2'] ?? '';
            final comparisonId = state.uri.queryParameters['id'];
            return VersionCompareScreen(
              docId1: docId1,
              docId2: docId2,
              comparisonId: comparisonId,
            );
          },
        ),

        // Tasks List Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/tasks',
          builder: (context, state) => const TasksScreen(),
        ),

        // Task Detail Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/tasks/:id',
          builder: (context, state) {
            final taskId = state.pathParameters['id'] ?? '';
            return TaskDetailScreen(taskId: taskId);
          },
        ),

        // Notification Center Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/notifications',
          builder: (context, state) => const NotificationCenterScreen(),
        ),

        // Grounded Q&A Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/qa',
          builder: (context, state) {
            final docId = state.uri.queryParameters['docId'] ?? state.uri.queryParameters['documentId'];
            final docTitle = state.uri.queryParameters['title'] ?? state.uri.queryParameters['documentTitle'];
            return QaScreen(
              initialDocumentId: docId,
              initialDocumentTitle: docTitle,
            );
          },
        ),

        // Restricted Administration Hub Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin',
          builder: (context, state) => const AdminHubScreen(),
        ),

        // Admin Operational Telemetry Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/telemetry',
          builder: (context, state) => const AdminTelemetryScreen(),
        ),

        // User Directory & Roles Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/users',
          builder: (context, state) => const UserDirectoryScreen(),
        ),

        // Workflow Rules & Policies Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/rules',
          builder: (context, state) => const WorkflowRulesScreen(),
        ),

        // Operations DLQ Monitoring Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/operations',
          builder: (context, state) => const OperationsQueueScreen(),
        ),

        // Emergency Legal Hold Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/legal-hold',
          builder: (context, state) => const LegalHoldScreen(),
        ),

        // Legal Hold Direct Alias
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/legal-hold',
          builder: (context, state) => const LegalHoldScreen(),
        ),

        // Admin Security & Compliance Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/security',
          builder: (context, state) => const AdminSecurityScreen(),
        ),

        // Admin Integrations & Connectors Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/integrations',
          builder: (context, state) => const AdminIntegrationsScreen(),
        ),

        // Admin Immutable Audit Ledger Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/audit',
          builder: (context, state) => const AdminAuditLedgerScreen(),
        ),

        // Admin Distributed Trace Stepper Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/admin/trace',
          builder: (context, state) {
            final corrId = state.uri.queryParameters['id'] ?? state.uri.queryParameters['correlationId'];
            return AdminTraceScreen(initialCorrelationId: corrId);
          },
        ),

        // Enterprise Governance & Reports Center Route
        GoRoute(
          parentNavigatorKey: _rootNavigatorKey,
          path: '/reports',
          builder: (context, state) => const ReportsAnalyticsScreen(),
        ),
      ],
    );
  }

  static final GoRouter router = createRouter();
}
