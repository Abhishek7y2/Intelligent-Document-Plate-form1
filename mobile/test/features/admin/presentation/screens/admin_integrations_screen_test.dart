import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/admin/presentation/screens/admin_integrations_screen.dart';

void main() {
  group('AdminIntegrationsScreen Widget Tests', () {
    testWidgets('renders all 4 integration connector cards', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminIntegrationsScreen(),
        ),
      );

      // Verify Header
      expect(find.text('Enterprise Integrations'), findsOneWidget);
      expect(find.text('Connectors & External Services'), findsOneWidget);

      // Verify Cards
      expect(find.text('ERP & Financials Export Connector'), findsOneWidget);
      expect(find.text('Monitored Ingestion Mailbox'), findsOneWidget);
      expect(find.text('Single Sign-On (SAML 2.0 / OIDC)'), findsOneWidget);
      expect(find.text('Outbound Signed Webhooks'), findsOneWidget);

      // Verify Action Buttons
      expect(find.text('Test ERP Connection'), findsOneWidget);
      expect(find.text('Check Mailbox Health'), findsOneWidget);
    });

    testWidgets('tapping test ERP connection triggers test ping and feedback', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminIntegrationsScreen(),
        ),
      );

      final pingButton = find.text('Test ERP Connection');
      await tester.tap(pingButton);
      await tester.pump();

      // Progress indicator appears
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Settle simulated network delay
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pumpAndSettle();

      // SnackBar appears
      expect(find.textContaining('ERP Test Ping Successful'), findsOneWidget);
    });
  });
}
