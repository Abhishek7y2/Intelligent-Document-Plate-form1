import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/admin_bloc.dart';
import '../bloc/admin_event.dart';
import '../bloc/admin_state.dart';

class WorkflowRulesScreen extends StatelessWidget {
  final AdminBloc? bloc;

  const WorkflowRulesScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<AdminBloc>.value(
        value: bloc!,
        child: const _WorkflowRulesView(),
      );
    }
    return BlocProvider<AdminBloc>(
      create: (_) => sl<AdminBloc>()..add(const AdminFetchWorkflowRulesRequested()),
      child: const _WorkflowRulesView(),
    );
  }
}

class _WorkflowRulesView extends StatelessWidget {
  const _WorkflowRulesView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AdminBloc, AdminState>(
      builder: (context, state) {
        return AppScaffold(
          title: 'Workflow Policies & Rules',
          body: _buildBody(context, state),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, AdminState state) {
    if (state.isLoadingRules && state.rules.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading workflow rules...'));
    }

    if (state.isPermissionDenied) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_person_outlined, size: 48, color: AppColors.warning500),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Access Restricted',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                state.permissionDeniedMessage ?? 'Viewing workflow policies requires POLICY_VIEW permission.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.rules.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load workflow rules',
          message: state.errorMessage!,
          onRetry: () => context.read<AdminBloc>().add(const AdminFetchWorkflowRulesRequested()),
        ),
      );
    }

    if (state.rules.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<AdminBloc>().add(const AdminFetchWorkflowRulesRequested());
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(color: AppColors.slate800, shape: BoxShape.circle),
                    child: const Icon(Icons.rule_folder_outlined, size: 40, color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('No Policies Configured', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: AppSpacing.xs),
                  const Text('Visual schema and rule creation are managed via web administration.', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<AdminBloc>().add(const AdminFetchWorkflowRulesRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: state.rules.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final rule = state.rules[index];
          return Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate800,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.slate700),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary900.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${rule.documentType} · ${rule.policyType}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary400),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: rule.isActive ? AppColors.success900.withValues(alpha: 0.4) : AppColors.slate700,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: rule.isActive ? AppColors.success500 : AppColors.slate600),
                      ),
                      child: Text(
                        rule.status.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: rule.isActive ? AppColors.success400 : AppColors.slate300,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  rule.name,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                if (rule.description.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    rule.description,
                    style: const TextStyle(fontSize: 12, color: AppColors.slate300),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Version: ${rule.version} · Updated: ${rule.updatedAt.day}/${rule.updatedAt.month}/${rule.updatedAt.year}',
                  style: const TextStyle(fontSize: 11, color: AppColors.slate500),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
