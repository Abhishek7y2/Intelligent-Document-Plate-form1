import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/admin_bloc.dart';
import '../bloc/admin_event.dart';
import '../bloc/admin_state.dart';

class UserDirectoryScreen extends StatelessWidget {
  final AdminBloc? bloc;

  const UserDirectoryScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<AdminBloc>.value(
        value: bloc!,
        child: const _UserDirectoryView(),
      );
    }
    return BlocProvider<AdminBloc>(
      create: (_) => sl<AdminBloc>()..add(const AdminFetchUsersRequested()),
      child: const _UserDirectoryView(),
    );
  }
}

class _UserDirectoryView extends StatelessWidget {
  const _UserDirectoryView();

  void _showInviteUserSheet(BuildContext context, AdminState state) {
    final emailController = TextEditingController();
    String selectedRole = state.roles.isNotEmpty ? state.roles.first.role : 'Reviewer';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.slate900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                top: AppSpacing.md,
                bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Invite Organization Member',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.slate400),
                          onPressed: () => Navigator.pop(sheetContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'User Email Address *',
                        labelStyle: const TextStyle(color: AppColors.slate400),
                        filled: true,
                        fillColor: AppColors.slate800,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const Text('Assign Role:', style: TextStyle(color: AppColors.slate300, fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: AppSpacing.xs),
                    DropdownButtonFormField<String>(
                      value: selectedRole,
                      dropdownColor: AppColors.slate800,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: AppColors.slate800,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      items: (state.roles.isNotEmpty
                              ? state.roles.map((r) => r.role).toList()
                              : ['Admin', 'Reviewer', 'Approver', 'Analyst', 'Auditor', 'contributor', 'platform_operator'])
                          .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setSheetState(() => selectedRole = val);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppButton(
                      label: 'Send Official Invitation',
                      onPressed: () {
                        final email = emailController.text.trim();
                        if (email.isNotEmpty && email.contains('@')) {
                          context.read<AdminBloc>().add(AdminInviteUserRequested(
                            email: email,
                            role: selectedRole,
                          ));
                          Navigator.pop(sheetContext);
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AdminBloc, AdminState>(
      listener: (context, state) {
        if (state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: AppColors.success600,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      builder: (context, state) {
        return AppScaffold(
          title: 'User Directory & Roles',
          floatingActionButton: state.isPermissionDenied
              ? null
              : FloatingActionButton(
                  onPressed: () => _showInviteUserSheet(context, state),
                  backgroundColor: AppColors.primary600,
                  foregroundColor: Colors.white,
                  tooltip: 'Invite User',
                  child: const Icon(Icons.person_add_rounded),
                ),
          body: _buildBody(context, state),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, AdminState state) {
    if (state.isLoadingUsers && state.invitations.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading user directory...'));
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
                'Permission Denied',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                state.permissionDeniedMessage ?? 'User management requires the USER_MANAGE permission.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.invitations.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load invitations',
          message: state.errorMessage!,
          onRetry: () => context.read<AdminBloc>().add(const AdminFetchUsersRequested()),
        ),
      );
    }

    if (state.invitations.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<AdminBloc>().add(const AdminFetchUsersRequested());
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
                    child: const Icon(Icons.people_outline, size: 40, color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text('No Pending Invitations', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: AppSpacing.xs),
                  const Text('Invite new organization members using the + button below.', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<AdminBloc>().add(const AdminFetchUsersRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: state.invitations.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final inv = state.invitations[index];
          return Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate800,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.slate700),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.primary700,
                  child: Text(
                    inv.email.isNotEmpty ? inv.email[0].toUpperCase() : 'U',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(inv.email, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white), overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.slate700,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(inv.role.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary400)),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            inv.isExpired
                                ? 'Expired'
                                : 'Expires: ${inv.expiresAt.day}/${inv.expiresAt.month}/${inv.expiresAt.year}',
                            style: TextStyle(fontSize: 11, color: inv.isExpired ? AppColors.error400 : AppColors.slate400),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: state.isSubmittingAction
                      ? null
                      : () {
                          context.read<AdminBloc>().add(AdminRevokeInvitationRequested(inv.invitationId));
                        },
                  style: TextButton.styleFrom(foregroundColor: AppColors.error400),
                  child: const Text('Revoke', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
