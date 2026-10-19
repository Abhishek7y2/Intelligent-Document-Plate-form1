import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key});

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onSubmit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            ChangePasswordSubmitted(
              currentPassword: _currentPasswordController.text,
              newPassword: _newPasswordController.text,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is PasswordChangeSuccess) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.emerald600,
            ),
          );
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading;

        return AlertDialog(
          backgroundColor: AppColors.slate900,
          title: const Text(
            'Change Password',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (state is AuthError) ...[
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.xs),
                      decoration: BoxDecoration(
                        color: AppColors.rose900.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        state.message,
                        style: const TextStyle(
                            color: AppColors.rose300, fontSize: 12),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  TextFormField(
                    controller: _currentPasswordController,
                    obscureText: _obscureCurrent,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Current Password',
                      suffixIcon: IconButton(
                        icon: Icon(_obscureCurrent
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded),
                        onPressed: () {
                          setState(() {
                            _obscureCurrent = !_obscureCurrent;
                          });
                        },
                      ),
                    ),
                    validator: (val) {
                      if (val == null || val.isEmpty) {
                        return 'Current password required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _newPasswordController,
                    obscureText: _obscureNew,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'New Password (min. 8 chars)',
                      suffixIcon: IconButton(
                        icon: Icon(_obscureNew
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded),
                        onPressed: () {
                          setState(() {
                            _obscureNew = !_obscureNew;
                          });
                        },
                      ),
                    ),
                    validator: (val) {
                      if (val == null || val.length < 8) {
                        return 'Minimum 8 characters required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureNew,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Confirm New Password',
                    ),
                    validator: (val) {
                      if (val != _newPasswordController.text) {
                        return 'Passwords do not match';
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: isLoading ? null : () => Navigator.of(context).pop(),
              child: const Text('Cancel',
                  style: TextStyle(color: AppColors.slate400)),
            ),
            AppButton(
              label: 'Update Password',
              isLoading: isLoading,
              variant: AppButtonVariant.primary,
              onPressed: isLoading ? null : _onSubmit,
            ),
          ],
        );
      },
    );
  }
}
