import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../theme/app_spacing.dart';

/// Implements 100% architectural and visual parity with Angular's `Sidebar` component.
/// Provides a 4-tier structured enterprise navigation drawer matching the DocuNexa web sidebar.
class AppSidebarDrawer extends StatelessWidget {
  final String? activeRoute;

  const AppSidebarDrawer({
    super.key,
    this.activeRoute,
  });

  @override
  Widget build(BuildContext context) {
    final currentPath = activeRoute ?? GoRouterState.of(context).matchedLocation;

    return Drawer(
      backgroundColor: AppColors.slate900,
      elevation: 16,
      child: SafeArea(
        child: Column(
          children: [
            // BRAND HEADER MATCHING ANGULAR SIDEBAR
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.lg,
              ),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: AppColors.slate800, width: 1.0),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary600,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxWeight.soft,
                      ],
                    ),
                    child: const Icon(
                      Icons.auto_stories_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DocuNexa',
                          style: AppTypography.titleMedium.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          'Document Intelligence',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.slate400,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.slate400),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Close Navigation',
                  ),
                ],
              ),
            ),

            // NAVIGATION SECTIONS SCROLLABLE LIST
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.md,
                ),
                children: [
                  // SECTION 1: WORKSPACE
                  _buildSectionHeader('WORKSPACE'),
                  _buildNavItem(
                    context,
                    label: 'Dashboard',
                    icon: Icons.dashboard_outlined,
                    activeIcon: Icons.dashboard_rounded,
                    route: '/dashboard',
                    isSelected: currentPath == '/dashboard',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Documents',
                    icon: Icons.folder_outlined,
                    activeIcon: Icons.folder_rounded,
                    route: '/documents',
                    isSelected: currentPath == '/documents',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Intake / Scanner',
                    icon: Icons.document_scanner_outlined,
                    activeIcon: Icons.document_scanner_rounded,
                    route: '/intake',
                    isSelected: currentPath == '/intake',
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // SECTION 2: INTELLIGENCE & REVIEW
                  _buildSectionHeader('INTELLIGENCE & REVIEW'),
                  _buildNavItem(
                    context,
                    label: 'Review Workbench',
                    icon: Icons.rate_review_outlined,
                    activeIcon: Icons.rate_review_rounded,
                    route: '/review',
                    isSelected: currentPath.startsWith('/review'),
                  ),
                  _buildNavItem(
                    context,
                    label: 'Approvals Queue',
                    icon: Icons.assignment_turned_in_outlined,
                    activeIcon: Icons.assignment_turned_in_rounded,
                    route: '/approvals',
                    isSelected: currentPath.startsWith('/approvals'),
                  ),
                  _buildNavItem(
                    context,
                    label: 'Compare Studio',
                    icon: Icons.compare_arrows_rounded,
                    activeIcon: Icons.compare_arrows_rounded,
                    route: '/compare',
                    isSelected: currentPath.startsWith('/compare'),
                  ),
                  _buildNavItem(
                    context,
                    label: 'Grounded Q&A',
                    icon: Icons.psychology_outlined,
                    activeIcon: Icons.psychology_rounded,
                    route: '/qa',
                    isSelected: currentPath == '/qa',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Search & Discovery',
                    icon: Icons.search_rounded,
                    activeIcon: Icons.search_rounded,
                    route: '/documents', // triggers search modal/filter in catalog
                    isSelected: false,
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // SECTION 3: COLLABORATION & GOVERNANCE
                  _buildSectionHeader('COLLABORATION & GOVERNANCE'),
                  _buildNavItem(
                    context,
                    label: 'Tasks & Discussions',
                    icon: Icons.task_alt_rounded,
                    activeIcon: Icons.task_alt_rounded,
                    route: '/tasks',
                    isSelected: currentPath.startsWith('/tasks'),
                  ),
                  _buildNavItem(
                    context,
                    label: 'Notifications',
                    icon: Icons.notifications_outlined,
                    activeIcon: Icons.notifications_rounded,
                    route: '/notifications',
                    isSelected: currentPath == '/notifications',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Emergency Legal Hold',
                    icon: Icons.gavel_rounded,
                    activeIcon: Icons.gavel_rounded,
                    route: '/legal-hold',
                    isSelected: currentPath == '/legal-hold' || currentPath == '/admin/legal-hold',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Reports & Analytics',
                    icon: Icons.bar_chart_rounded,
                    activeIcon: Icons.bar_chart_rounded,
                    route: '/reports',
                    isSelected: currentPath == '/reports',
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // SECTION 4: ADMINISTRATION
                  _buildSectionHeader('ADMINISTRATION'),
                  _buildNavItem(
                    context,
                    label: 'Admin Hub',
                    icon: Icons.admin_panel_settings_outlined,
                    activeIcon: Icons.admin_panel_settings_rounded,
                    route: '/admin',
                    isSelected: currentPath == '/admin',
                  ),
                  _buildNavItem(
                    context,
                    label: 'System Telemetry',
                    icon: Icons.analytics_outlined,
                    activeIcon: Icons.analytics_rounded,
                    route: '/admin/telemetry',
                    isSelected: currentPath == '/admin/telemetry',
                  ),
                  _buildNavItem(
                    context,
                    label: 'User Directory',
                    icon: Icons.people_outline_rounded,
                    activeIcon: Icons.people_rounded,
                    route: '/admin/users',
                    isSelected: currentPath == '/admin/users',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Workflow Policies',
                    icon: Icons.account_tree_outlined,
                    activeIcon: Icons.account_tree_rounded,
                    route: '/admin/workflow',
                    isSelected: currentPath == '/admin/workflow',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Security & Masking',
                    icon: Icons.shield_outlined,
                    activeIcon: Icons.shield_rounded,
                    route: '/admin/security',
                    isSelected: currentPath == '/admin/security',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Integrations & ERP',
                    icon: Icons.hub_outlined,
                    activeIcon: Icons.hub_rounded,
                    route: '/admin/integrations',
                    isSelected: currentPath == '/admin/integrations',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Immutable Audit Ledger',
                    icon: Icons.receipt_long_outlined,
                    activeIcon: Icons.receipt_long_rounded,
                    route: '/admin/audit',
                    isSelected: currentPath == '/admin/audit',
                  ),
                  _buildNavItem(
                    context,
                    label: 'Correlation ID Trace',
                    icon: Icons.timeline_rounded,
                    activeIcon: Icons.timeline_rounded,
                    route: '/admin/trace',
                    isSelected: currentPath.startsWith('/admin/trace'),
                  ),
                  _buildNavItem(
                    context,
                    label: 'Operations DLQ',
                    icon: Icons.sync_problem_rounded,
                    activeIcon: Icons.sync_problem_rounded,
                    route: '/admin/operations',
                    isSelected: currentPath == '/admin/operations',
                  ),
                ],
              ),
            ),

            // USER PROFILE FOOTER
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: AppColors.slate800, width: 1.0),
                ),
              ),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                  backgroundColor: AppColors.primary600,
                  child: Icon(Icons.person_rounded, color: Colors.white, size: 20),
                ),
                title: Text(
                  'My Account',
                  style: AppTypography.titleSmall.copyWith(color: Colors.white),
                ),
                subtitle: Text(
                  'Profile, MFA & Sessions',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.slate400, fontSize: 11),
                ),
                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate500),
                onTap: () {
                  Navigator.of(context).pop();
                  context.push('/profile');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.slate500,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required String label,
    required IconData icon,
    required IconData activeIcon,
    required String route,
    required bool isSelected,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.of(context).pop(); // Close drawer
          context.push(route);
        },
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 2.0),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10.0),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary600.withOpacity(0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(
              color: isSelected ? AppColors.primary500.withOpacity(0.4) : Colors.transparent,
              width: 1.0,
            ),
          ),
          child: Row(
            children: [
              Icon(
                isSelected ? activeIcon : icon,
                color: isSelected ? AppColors.primary400 : AppColors.slate400,
                size: 20,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppColors.slate300,
                    fontSize: 13.5,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (isSelected)
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppColors.primary500,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class BoxWeight {
  static const BoxShadow soft = BoxShadow(
    color: Color(0x33000000),
    blurRadius: 8,
    offset: Offset(0, 2),
  );
}
