import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class AcceptInviteScreen extends StatefulWidget {
  final String? initialToken;

  const AcceptInviteScreen({super.key, this.initialToken});

  @override
  State<AcceptInviteScreen> createState() => _AcceptInviteScreenState();
}

class _AcceptInviteScreenState extends State<AcceptInviteScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _tokenController;
  final _fullNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _tokenController = TextEditingController(text: widget.initialToken ?? '');
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _fullNameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onAcceptPressed() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            AcceptInviteSubmitted(
              token: _tokenController.text.trim(),
              password: _passwordController.text,
              fullName: _fullNameController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.slate950,
      appBar: AppBar(
        title: const Text('Accept Invitation'),
        backgroundColor: AppColors.slate900,
      ),
      body: SafeArea(
        child: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is InviteAcceptedSuccess) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Account activated successfully. Please sign in.'),
                  backgroundColor: AppColors.emerald600,
                ),
              );
              context.go('/login');
            }
          },
          builder: (context, state) {
            final isLoading = state is AuthLoading;

            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (state is AuthError) ...[
                          Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: AppColors.rose900.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.rose600),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded,
                                    color: AppColors.rose400, size: 20),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Text(
                                    state.message,
                                    style: const TextStyle(
                                        color: AppColors.rose200, fontSize: 13),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],

                        Text(
                          'Join DocuNexa Organization',
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Enter your invitation token and establish your account credentials.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.slate400,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),

                        // Invitation Token
                        TextFormField(
                          controller: _tokenController,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Invitation Token',
                            prefixIcon: Icon(Icons.vpn_key_outlined),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Invitation token is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // Full Name
                        TextFormField(
                          controller: _fullNameController,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Full Legal Name',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Full name is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // New Password
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'Set Password (min. 8 characters)',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.length < 8) {
                              return 'Password must be at least 8 characters';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // Confirm Password
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Confirm Password',
                            prefixIcon: Icon(Icons.lock_reset_rounded),
                          ),
                          validator: (value) {
                            if (value != _passwordController.text) {
                              return 'Passwords do not match';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.xl),

                        AppButton(
                          label: 'Activate Account',
                          isLoading: isLoading,
                          variant: AppButtonVariant.primary,
                          onPressed: isLoading ? null : _onAcceptPressed,
                        ),
                        const SizedBox(height: AppSpacing.md),

                        AppButton(
                          label: 'Cancel & Back to Sign In',
                          variant: AppButtonVariant.ghost,
                          onPressed: () => context.go('/login'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
