import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:docunexa_mobile/core/theme/app_theme.dart';
import 'package:docunexa_mobile/features/auth/domain/entities/user.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:docunexa_mobile/features/auth/presentation/bloc/auth_state.dart';
import 'package:docunexa_mobile/features/auth/presentation/screens/login_screen.dart';

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockAuthBloc mockAuthBloc;

  setUp(() {
    mockAuthBloc = MockAuthBloc();
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      theme: AppTheme.darkTheme,
      home: BlocProvider<AuthBloc>.value(
        value: mockAuthBloc,
        child: const LoginScreen(),
      ),
    );
  }

  group('LoginScreen Widget Tests', () {
    testWidgets('renders corporate header, email and password fields, and sign in button', (tester) async {
      when(() => mockAuthBloc.state).thenReturn(const Unauthenticated());

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('DOCUNEXA'), findsOneWidget);
      expect(find.byKey(const Key('login_email_input')), findsOneWidget);
      expect(find.byKey(const Key('login_password_input')), findsOneWidget);
      expect(find.byKey(const Key('login_submit_button')), findsOneWidget);
      expect(find.text('Sign In with One-Time Email Code'), findsOneWidget);
    });

    testWidgets('displays validation errors when submitting empty form', (tester) async {
      when(() => mockAuthBloc.state).thenReturn(const Unauthenticated());

      await tester.pumpWidget(createWidgetUnderTest());

      final submitBtn = find.byKey(const Key('login_submit_button'));
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('switches to OTP login mode when OTP button is clicked', (tester) async {
      when(() => mockAuthBloc.state).thenReturn(const Unauthenticated());

      await tester.pumpWidget(createWidgetUnderTest());

      final otpToggle = find.byKey(const Key('login_otp_toggle_button'));
      await tester.tap(otpToggle);
      await tester.pumpAndSettle();

      expect(find.text('Send Verification Code'), findsOneWidget);
      expect(find.byKey(const Key('login_password_input')), findsNothing);
    });

    testWidgets('displays error banner when AuthError state is emitted', (tester) async {
      when(() => mockAuthBloc.state).thenReturn(const AuthError(
        message: 'Invalid email or password.',
        statusCode: 401,
      ));

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Invalid email or password.'), findsOneWidget);
    });

    testWidgets('displays MFA verification card when MfaRequiredState is active', (tester) async {
      when(() => mockAuthBloc.state).thenReturn(const MfaRequiredState(
        email: 'analyst@docunexa.io',
        message: 'Please provide your 6-digit TOTP verification code.',
      ));

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Two-Factor Authentication'), findsOneWidget);
      expect(find.text('Verify & Sign In'), findsOneWidget);
    });

    testWidgets('displays Biometric Lock Card when Authenticated and isBiometricLocked is true', (tester) async {
      const user = User(
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        tenantId: 'TNT-CORP-01',
        fullName: 'Jane Doe',
        role: 'Reviewer',
      );
      when(() => mockAuthBloc.state).thenReturn(const Authenticated(
        user: user,
        isBiometricLocked: true,
      ));

      await tester.pumpWidget(createWidgetUnderTest());

      expect(find.text('Session Locked'), findsOneWidget);
      expect(find.text('Unlock with Biometrics'), findsOneWidget);
    });
  });
}
