import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantIdController = TextEditingController();
  final _otpCodeController = TextEditingController();
  final _mfaCodeController = TextEditingController();

  bool _obscurePassword = true;
  bool _isOtpMode = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _tenantIdController.dispose();
    _otpCodeController.dispose();
    _mfaCodeController.dispose();
    super.dispose();
  }

  void _onLoginPressed() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_isOtpMode) {
        context.read<AuthBloc>().add(
              OtpRequestSubmitted(email: _emailController.text.trim()),
            );
      } else {
        context.read<AuthBloc>().add(
              LoginSubmitted(
                email: _emailController.text.trim(),
                password: _passwordController.text,
                tenantId: _tenantIdController.text.trim().isEmpty
                    ? null
                    : _tenantIdController.text.trim(),
              ),
            );
      }
    }
  }

  void _onVerifyOtpPressed() {
    if (_otpCodeController.text.trim().isNotEmpty) {
      context.read<AuthBloc>().add(
            OtpVerifySubmitted(
              email: _emailController.text.trim(),
              code: _otpCodeController.text.trim(),
            ),
          );
    }
  }

  void _onMfaSubmitted() {
    if (_mfaCodeController.text.trim().isNotEmpty) {
      context.read<AuthBloc>().add(
            LoginSubmitted(
              email: _emailController.text.trim(),
              password: _passwordController.text,
              tenantId: _tenantIdController.text.trim().isEmpty
                  ? null
                  : _tenantIdController.text.trim(),
              mfaCode: _mfaCodeController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.slate950,
      body: SafeArea(
        child: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is Authenticated && !state.isBiometricLocked) {
              context.go('/dashboard');
            }
          },
          builder: (context, state) {
            final isLoading = state is AuthLoading;

            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.xl,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Enterprise Brand Header
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: AppColors.primary900.withOpacity(0.3),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: AppColors.primary500.withOpacity(0.3),
                            ),
                          ),
                          child: const Icon(
                            Icons.document_scanner_rounded,
                            size: 44,
                            color: AppColors.primary400,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'DOCUNEXA',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 2.0,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        'Document Intelligence Platform',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.slate400,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // Biometric Lock Screen State
                      if (state is Authenticated && state.isBiometricLocked) ...[
                        _buildBiometricUnlockCard(context),
                      ] else if (state is MfaRequiredState) ...[
                        _buildMfaVerificationCard(context, state, isLoading),
                      ] else if (state is OtpSentState) ...[
                        _buildOtpVerificationCard(context, state, isLoading),
                      ] else ...[
                        _buildMainLoginForm(context, state, isLoading),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildMainLoginForm(
    BuildContext context,
    AuthState state,
    bool isLoading,
  ) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Error Display
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

          if (state is Unauthenticated && state.message != null) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.amber900.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.amber600),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: AppColors.amber400, size: 20),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      state.message!,
                      style: const TextStyle(
                          color: AppColors.amber200, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],

          // Email Field
          TextFormField(
            key: const Key('login_email_input'),
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              labelText: 'Work Email',
              prefixIcon: Icon(Icons.mail_outline_rounded),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Email is required';
              }
              if (!value.contains('@')) {
                return 'Enter a valid corporate email';
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.md),

          // Password Field (if standard password mode)
          if (!_isOtpMode) ...[
            TextFormField(
              key: const Key('login_password_input'),
              controller: _passwordController,
              obscureText: _obscurePassword,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Password',
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
                if (value == null || value.isEmpty) {
                  return 'Password is required';
                }
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.md),

            // Optional Tenant ID
            TextFormField(
              key: const Key('login_tenant_input'),
              controller: _tenantIdController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Organization / Tenant ID (Optional)',
                prefixIcon: Icon(Icons.business_outlined),
                hintText: 'e.g. TNT-CORP-01',
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          // Primary Sign-In Button
          AppButton(
            key: const Key('login_submit_button'),
            label: _isOtpMode ? 'Send Verification Code' : 'Sign In',
            isLoading: isLoading,
            variant: AppButtonVariant.primary,
            onPressed: isLoading ? null : _onLoginPressed,
          ),
          const SizedBox(height: AppSpacing.sm),

          // OTP Mode Toggle
          TextButton(
            key: const Key('login_otp_toggle_button'),
            onPressed: () {
              setState(() {
                _isOtpMode = !_isOtpMode;
              });
            },
            child: Text(
              _isOtpMode
                  ? 'Sign In with Password Instead'
                  : 'Sign In with One-Time Email Code',
              style: const TextStyle(color: AppColors.primary400),
            ),
          ),

          // Accept Invitation Route Link
          TextButton(
            key: const Key('login_accept_invite_link'),
            onPressed: () => context.push('/accept-invite'),
            child: const Text(
              'Have an invitation token? Complete onboarding',
              style: TextStyle(color: AppColors.slate400, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBiometricUnlockCard(BuildContext context) {
    return Card(
      color: AppColors.slate900,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            const Icon(
              Icons.fingerprint_rounded,
              size: 56,
              color: AppColors.primary400,
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Session Locked',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Verify your biometric credential to unlock your active session.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate400, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: 'Unlock with Biometrics',
              icon: Icons.fingerprint_rounded,
              variant: AppButtonVariant.primary,
              onPressed: () {
                context
                    .read<AuthBloc>()
                    .add(const BiometricUnlockRequested());
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Sign Out & Use Password',
              variant: AppButtonVariant.ghost,
              onPressed: () {
                context.read<AuthBloc>().add(const LogoutRequested());
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMfaVerificationCard(
    BuildContext context,
    MfaRequiredState state,
    bool isLoading,
  ) {
    return Card(
      color: AppColors.slate900,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(
              Icons.shield_outlined,
              size: 48,
              color: AppColors.amber400,
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Two-Factor Authentication',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              state.message ??
                  'Enter the 6-digit code from your authenticator app.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.slate400, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextFormField(
              controller: _mfaCodeController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                letterSpacing: 8,
                fontWeight: FontWeight.bold,
              ),
              decoration: const InputDecoration(
                hintText: '000000',
                counterText: '',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Verify & Sign In',
              isLoading: isLoading,
              variant: AppButtonVariant.primary,
              onPressed: isLoading ? null : _onMfaSubmitted,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Cancel',
              variant: AppButtonVariant.ghost,
              onPressed: () {
                context.read<AuthBloc>().add(const AuthCheckRequested());
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOtpVerificationCard(
    BuildContext context,
    OtpSentState state,
    bool isLoading,
  ) {
    return Card(
      color: AppColors.slate900,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(
              Icons.mark_email_read_outlined,
              size: 48,
              color: AppColors.emerald400,
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Email Code Verification',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              state.message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.slate400, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextFormField(
              controller: _otpCodeController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                letterSpacing: 8,
                fontWeight: FontWeight.bold,
              ),
              decoration: const InputDecoration(
                hintText: '000000',
                counterText: '',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Verify Code',
              isLoading: isLoading,
              variant: AppButtonVariant.primary,
              onPressed: isLoading ? null : _onVerifyOtpPressed,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Back to Sign In',
              variant: AppButtonVariant.ghost,
              onPressed: () {
                setState(() {
                  _isOtpMode = false;
                });
                context.read<AuthBloc>().add(const AuthCheckRequested());
              },
            ),
          ],
        ),
      ),
    );
  }
}
