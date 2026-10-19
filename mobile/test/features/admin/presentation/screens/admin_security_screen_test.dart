import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/admin/presentation/screens/admin_security_screen.dart';

void main() {
  group('AdminSecurityScreen Widget Tests', () {
    testWidgets('renders security policy switches, dropdowns, and save button', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminSecurityScreen(),
        ),
      );

      // Verify Header
      expect(find.text('Tenant Security Governance'), findsOneWidget);
      expect(find.text('Authentication & MFA Enforcement'), findsOneWidget);
      expect(find.text('Session Inactivity & Timeout Controls'), findsOneWidget);
      expect(find.text('PII Masking & Field Data Redaction'), findsOneWidget);

      // Toggles
      expect(find.text('Require MFA for Privileged Roles'), findsOneWidget);
      expect(find.text('Mask Social Security & Tax ID Numbers'), findsOneWidget);
      expect(find.text('Mask Bank Routing & Account Numbers'), findsOneWidget);

      // Save Button
      expect(find.text('Save Security Settings'), findsOneWidget);
    });

    testWidgets('toggling a setting triggers unsaved changes warning bar', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminSecurityScreen(),
        ),
      );

      // Initially no warning bar
      expect(find.text('You have unsaved security configuration changes.'), findsNothing);

      // Toggle a switch
      final rememberDeviceSwitch = find.byType(Switch).at(1);
      await tester.tap(rememberDeviceSwitch);
      await tester.pump();

      // Warning bar appears
      expect(find.text('You have unsaved security configuration changes.'), findsOneWidget);
    });
  });
}
