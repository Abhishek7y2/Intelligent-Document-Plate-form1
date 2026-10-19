import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../bloc/admin_bloc.dart';
import '../bloc/admin_event.dart';
import '../bloc/admin_state.dart';

class AdminHubScreen extends StatelessWidget {
  final AdminBloc? bloc;

  const AdminHubScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<AdminBloc>.value(
        value: bloc!,
        child: const _AdminHubView(),
      );
    }
    return BlocProvider<AdminBloc>(
      create: (_) => sl<AdminBloc>()..add(const AdminFetchTelemetryRequested()),
      child: const _AdminHubView(),
    );
  }
}

class _AdminHubView extends StatelessWidget {
  const _AdminHubView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AdminBloc, AdminState>(
      builder: (context, state) {
        return AppScaffold(
          title: 'Administration & Operations',
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Security / Restriction Notice Banner
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.primary900.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.primary700.withValues(alpha: 0.5)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_outlined, color: AppColors.primary400, size: 20),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Restricted Administrative Surface. Operations are monitored and immutably audited.',
                          style: TextStyle(color: AppColors.slate300, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Navigation Cards Grid / List
                _buildNavTile(
                  context,
                  title: 'Operational Telemetry & KPIs',
                  subtitle: 'Pipeline latency, throughput, OCR confidence & system health',
                  icon: Icons.speed_rounded,
                  badgeText: state.telemetry?.isHealthy == true ? 'HEALTHY' : 'MONITORED',
                  badgeColor: state.telemetry?.isHealthy == true ? AppColors.success500 : AppColors.primary400,
                  onTap: () => context.push('/admin/telemetry'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Emergency Legal Hold Freeze',
                  subtitle: 'Suspend deletion, freeze retention schedules & view matter audit seals',
                  icon: Icons.gavel_rounded,
                  badgeText: 'CRITICAL',
                  badgeColor: AppColors.error500,
                  onTap: () => context.push('/admin/legal-hold'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Operations Dead-Letter Queue',
                  subtitle: 'Inspect worker failures, pipeline exceptions & execute safe job retries',
                  icon: Icons.error_outline_rounded,
                  badgeText: state.telemetry != null && state.telemetry!.deadLetterQueueDepth > 0
                      ? '${state.telemetry!.deadLetterQueueDepth} Failed'
                      : 'DLQ Queue',
                  badgeColor: state.telemetry != null && state.telemetry!.deadLetterQueueDepth > 0
                      ? AppColors.error500
                      : AppColors.slate500,
                  onTap: () => context.push('/admin/operations'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'User Directory & Invitations',
                  subtitle: 'Manage member invitations, role assignments & revoke access',
                  icon: Icons.people_outline_rounded,
                  onTap: () => context.push('/admin/users'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Workflow Policies & Rules',
                  subtitle: 'Review document validation thresholds, SLA gates & routing criteria',
                  icon: Icons.rule_rounded,
                  onTap: () => context.push('/admin/rules'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Security & Masking Governance',
                  subtitle: 'MFA enforcement, session idle timeouts & automated PII redaction',
                  icon: Icons.shield_outlined,
                  onTap: () => context.push('/admin/security'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Enterprise Integrations & ERP',
                  subtitle: 'SAP/NetSuite connectors, SAML SSO & monitored IMAP mailboxes',
                  icon: Icons.hub_outlined,
                  onTap: () => context.push('/admin/integrations'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Immutable Audit Ledger',
                  subtitle: 'Search, inspect & export cryptographically verifiable event logs',
                  icon: Icons.receipt_long_outlined,
                  badgeText: 'SHA-256',
                  badgeColor: AppColors.success500,
                  onTap: () => context.push('/admin/audit'),
                ),
                const SizedBox(height: AppSpacing.sm),

                _buildNavTile(
                  context,
                  title: 'Correlation ID Trace Stepper',
                  subtitle: 'Inspect end-to-end processing across pipeline worker spans',
                  icon: Icons.timeline_rounded,
                  onTap: () => context.push('/admin/trace'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNavTile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    String? badgeText,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.slate700),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.slate700,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: Colors.white, size: 22),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (badgeText != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: (badgeColor ?? AppColors.primary500).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: badgeColor ?? AppColors.primary500),
                              ),
                              child: Text(
                                badgeText,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: badgeColor ?? AppColors.primary500,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.slate500),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
