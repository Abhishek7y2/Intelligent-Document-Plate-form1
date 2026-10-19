import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../theme/app_spacing.dart';
import 'app_sidebar_drawer.dart';

/// Enterprise Adaptive Scaffold providing 100% architectural and layout parity with Angular's Shell.
/// - On Phone viewports (< 768dp): Standard top app bar with notification badge, hamburger menu for drawer, and bottom navigation.
/// - On Tablet/Desktop viewports (>= 768dp): Persistent navigation sidebar matching Angular web desktop shell.
class AppScaffold extends StatelessWidget {
  final String? title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool showAppBar;
  final Widget? leading;
  final bool showNotificationBell;
  final int unreadNotificationsCount;
  final bool showUserAvatar;
  final Widget? drawer;

  const AppScaffold({
    super.key,
    this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.showAppBar = true,
    this.leading,
    this.showNotificationBell = true,
    this.unreadNotificationsCount = 0,
    this.showUserAvatar = true,
    this.drawer,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isTabletOrDesktop = constraints.maxWidth >= 768;

        if (isTabletOrDesktop) {
          // TABLET / DESKTOP ADAPTIVE LAYOUT (MIRRORING ANGULAR WEB SHELL)
          return Scaffold(
            backgroundColor: AppColors.slate900,
            body: Row(
              children: [
                // PERSISTENT SIDEBAR
                SizedBox(
                  width: 260,
                  child: drawer ?? const AppSidebarDrawer(),
                ),
                // VERTICAL DIVIDER
                const VerticalDivider(width: 1, thickness: 1, color: AppColors.slate800),
                // MAIN APPLICATION CONTENT AREA
                Expanded(
                  child: Scaffold(
                    backgroundColor: AppColors.slate900,
                    appBar: showAppBar ? _buildAppBar(context, isTablet: true) : null,
                    body: SafeArea(child: body),
                    floatingActionButton: floatingActionButton,
                  ),
                ),
              ],
            ),
          );
        }

        // PHONE VIEWPORT LAYOUT
        return Scaffold(
          backgroundColor: AppColors.slate900,
          drawer: drawer ?? const AppSidebarDrawer(),
          appBar: showAppBar ? _buildAppBar(context, isTablet: false) : null,
          body: SafeArea(child: body),
          floatingActionButton: floatingActionButton,
          bottomNavigationBar: bottomNavigationBar,
        );
      },
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, {required bool isTablet}) {
    return AppBar(
      title: title != null
          ? Text(
              title!,
              style: AppTypography.titleMedium.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.primary600,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(Icons.auto_stories_rounded, color: Colors.white, size: 16),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'DocuNexa',
                  style: AppTypography.titleMedium.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
      leading: leading,
      backgroundColor: AppColors.slate900,
      elevation: 0,
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1.0),
        child: Divider(height: 1.0, thickness: 1.0, color: AppColors.slate800),
      ),
      actions: [
        if (actions != null) ...actions!,
        if (showNotificationBell)
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined, color: AppColors.slate300),
                if (unreadNotificationsCount > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(3.0),
                      decoration: const BoxDecoration(
                        color: AppColors.primary600,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                      child: Text(
                        unreadNotificationsCount > 9 ? '9+' : '$unreadNotificationsCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            tooltip: 'Notifications',
            onPressed: () => context.push('/notifications'),
          ),
        if (showUserAvatar && !isTablet)
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm, left: AppSpacing.xs),
            child: GestureDetector(
              onTap: () => context.push('/profile'),
              child: const CircleAvatar(
                radius: 14,
                backgroundColor: AppColors.primary600,
                child: Icon(Icons.person_rounded, size: 16, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }
}
