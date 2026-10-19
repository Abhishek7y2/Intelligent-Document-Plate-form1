import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/widgets/change_password_dialog.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/user_session.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../bloc/session_bloc.dart';
import '../bloc/session_event.dart';
import '../bloc/session_state.dart';

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadBiometricPreference();
  }

  Future<void> _loadBiometricPreference() async {
    final authRepo = sl<AuthRepository>();
    final enabled = await authRepo.isBiometricOptIn();
    if (mounted) {
      setState(() {
        _biometricEnabled = enabled;
      });
    }
  }

  Future<void> _onToggleBiometric(bool value) async {
    final authRepo = sl<AuthRepository>();
    if (value) {
      final canUse = await authRepo.canUseBiometrics();
      if (!canUse) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Biometric hardware is not available on this device.'),
              backgroundColor: AppColors.amber600,
            ),
          );
        }
        return;
      }
      final authenticated = await authRepo.authenticateWithBiometrics();
      if (authenticated) {
        await authRepo.setBiometricOptIn(true);
        if (mounted) setState(() => _biometricEnabled = true);
      }
    } else {
      await authRepo.setBiometricOptIn(false);
      if (mounted) setState(() => _biometricEnabled = false);
    }
  }

  void _showEditProfileDialog(BuildContext context, UserProfile profile) {
    final firstNameController = TextEditingController(text: profile.firstName);
    final lastNameController = TextEditingController(text: profile.lastName);
    final phoneController = TextEditingController(text: profile.phoneNumber);
    final formKey = GlobalKey<FormState>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.slate900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bottomSheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(bottomSheetContext).viewInsets.bottom + AppSpacing.md,
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Edit Profile Information',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: firstNameController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'First Name'),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: lastNameController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Last Name'),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextFormField(
                    controller: phoneController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Phone Number (E.164)',
                      hintText: '+15550142280',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: 'Save Changes',
                    variant: AppButtonVariant.primary,
                    onPressed: () {
                      if (formKey.currentState?.validate() ?? false) {
                        context.read<ProfileBloc>().add(
                              ProfileUpdateSubmitted(
                                firstName: firstNameController.text.trim(),
                                lastName: lastNameController.text.trim(),
                                phoneNumber: phoneController.text.trim(),
                              ),
                            );
                        Navigator.of(bottomSheetContext).pop();
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showSessionsDialog(BuildContext context) {
    context.read<SessionBloc>().add(const SessionsFetchRequested());

    showDialog(
      context: context,
      builder: (dialogContext) {
        return BlocBuilder<SessionBloc, SessionState>(
          builder: (context, state) {
            return AlertDialog(
              backgroundColor: AppColors.slate900,
              title: const Text(
                'Active Device Sessions',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: state is SessionLoading
                    ? const Center(child: AppLoadingIndicator(message: 'Loading sessions...'))
                    : state is SessionLoaded
                        ? ListView.separated(
                            shrinkWrap: true,
                            itemCount: state.sessions.length,
                            separatorBuilder: (_, __) => const Divider(color: AppColors.slate700),
                            itemBuilder: (context, index) {
                              final session = state.sessions[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  session.isCurrent ? Icons.phone_android_rounded : Icons.laptop_rounded,
                                  color: session.isCurrent ? AppColors.primary400 : AppColors.slate400,
                                ),
                                title: Text(
                                  '${session.browser} (${session.os})',
                                  style: const TextStyle(color: Colors.white, fontSize: 14),
                                ),
                                subtitle: Text(
                                  'IP: ${session.ipAddress}\nLast used: ${session.lastUsedAt}',
                                  style: const TextStyle(color: AppColors.slate400, fontSize: 12),
                                ),
                                trailing: session.isCurrent
                                    ? Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: AppColors.primary900.withOpacity(0.4),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(color: AppColors.primary500),
                                        ),
                                        child: const Text('Current', style: TextStyle(color: AppColors.primary300, fontSize: 11)),
                                      )
                                    : IconButton(
                                        icon: const Icon(Icons.delete_outline_rounded, color: AppColors.rose400),
                                        tooltip: 'Revoke Session',
                                        onPressed: () {
                                          context.read<SessionBloc>().add(SessionRevokeRequested(session.sessionId));
                                        },
                                      ),
                              );
                            },
                          )
                        : Text(
                            state is SessionError ? state.message : 'No active sessions found.',
                            style: const TextStyle(color: AppColors.slate400),
                          ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Close', style: TextStyle(color: AppColors.slate300)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return MultiBlocProvider(
      providers: [
        BlocProvider<ProfileBloc>(
          create: (_) => sl<ProfileBloc>()..add(const ProfileFetchRequested()),
        ),
        BlocProvider<SessionBloc>(
          create: (_) => sl<SessionBloc>(),
        ),
      ],
      child: AppScaffold(
        title: 'Profile & Security',
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading || state is ProfileInitial) {
              return const Center(child: AppLoadingIndicator(message: 'Loading user profile...'));
            }

            if (state is ProfileError && state.currentProfile == null) {
              return Center(
                child: ErrorView(
                  title: 'Unable to load profile',
                  message: state.message,
                  correlationId: state.correlationId,
                  onRetry: () => context.read<ProfileBloc>().add(const ProfileFetchRequested()),
                ),
              );
            }

            final profile = state is ProfileLoaded
                ? state.profile
                : (state as ProfileUpdating).currentProfile;

            return RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(const ProfileFetchRequested());
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  children: [
                    // Avatar & Basic Info Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          children: [
                            Stack(
                              children: [
                                CircleAvatar(
                                  radius: 44,
                                  backgroundColor: AppColors.slate800,
                                  backgroundImage: profile.avatarUrl != null && profile.avatarUrl!.isNotEmpty
                                      ? NetworkImage(profile.avatarUrl!)
                                      : null,
                                  child: profile.avatarUrl == null || profile.avatarUrl!.isEmpty
                                      ? const Icon(Icons.person_rounded, size: 48, color: AppColors.slate400)
                                      : null,
                                ),
                                Positioned(
                                  bottom: 0,
                                  right: 0,
                                  child: InkWell(
                                    onTap: () {
                                      // Minimal avatar update triggering upload with standard PNG mock bytes for verification
                                      const dummyPngBytes = [
                                        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                                        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                                        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                                        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                                        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                                        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                                        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                                        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
                                        0x42, 0x60, 0x82
                                      ];
                                      context.read<ProfileBloc>().add(
                                            const AvatarUploadSubmitted(
                                              fileBytes: dummyPngBytes,
                                              filename: 'avatar.png',
                                              mimeType: 'image/png',
                                            ),
                                          );
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(AppSpacing.xs),
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary600,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.camera_alt_rounded, size: 16, color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              profile.fullName.isNotEmpty ? profile.fullName : 'DocuNexa User',
                              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            Text(
                              profile.workEmail,
                              style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primary900.withOpacity(0.3),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.primary500.withOpacity(0.4)),
                              ),
                              child: Text(
                                '${profile.role} • ${profile.tenantId}',
                                style: const TextStyle(color: AppColors.primary300, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppButton(
                              label: 'Edit Profile',
                              variant: AppButtonVariant.secondary,
                              icon: Icons.edit_outlined,
                              onPressed: () => _showEditProfileDialog(context, profile),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Organization Details Card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Organization Details', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                            const Divider(color: AppColors.slate700),
                            _buildInfoRow('Department', profile.department),
                            _buildInfoRow('Designation', profile.designation),
                            _buildInfoRow('Employee ID', profile.employeeId),
                            _buildInfoRow('Status', profile.employmentStatus),
                            _buildInfoRow('Manager', profile.managerName),
                            _buildInfoRow('Location', profile.location),
                            _buildInfoRow('Phone', profile.phoneNumber.isNotEmpty ? profile.phoneNumber : 'Not configured'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Security & Sessions Card
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.fingerprint_rounded, color: AppColors.primary400),
                            title: const Text('Biometric Unlock'),
                            subtitle: const Text('Local convenience unlock (opt-in)'),
                            trailing: Switch(
                              value: _biometricEnabled,
                              onChanged: _onToggleBiometric,
                              activeColor: AppColors.primary500,
                            ),
                          ),
                          const Divider(height: 1, color: AppColors.slate700),
                          ListTile(
                            leading: const Icon(Icons.lock_reset_rounded, color: AppColors.primary400),
                            title: const Text('Change Password'),
                            subtitle: const Text('Rotate account password'),
                            trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
                            onTap: () {
                              showDialog(
                                context: context,
                                builder: (_) => const ChangePasswordDialog(),
                              );
                            },
                          ),
                          const Divider(height: 1, color: AppColors.slate700),
                          ListTile(
                            leading: const Icon(Icons.devices_rounded, color: AppColors.primary400),
                            title: const Text('Active Sessions'),
                            subtitle: const Text('View and revoke active devices'),
                            trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
                            onTap: () => _showSessionsDialog(context),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // Administration & Governance Card
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.admin_panel_settings_rounded, color: AppColors.amber400),
                            title: const Text('Administration & Operations'),
                            subtitle: const Text('Telemetry, user directory, DLQ & legal hold'),
                            trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
                            onTap: () => context.push('/admin'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // Sign Out Button
                    AppButton(
                      label: 'Sign Out',
                      variant: AppButtonVariant.danger,
                      icon: Icons.logout_rounded,
                      onPressed: () {
                        context.read<AuthBloc>().add(const LogoutRequested());
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.slate400, fontSize: 13)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
