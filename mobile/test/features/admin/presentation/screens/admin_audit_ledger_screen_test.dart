import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/admin/presentation/screens/admin_audit_ledger_screen.dart';

void main() {
  group('AdminAuditLedgerScreen Widget Tests', () {
    testWidgets('renders audit ledger search, filter chips, and events with SHA-256 badge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminAuditLedgerScreen(),
        ),
      );

      // Verify Header
      expect(find.text('Audit Ledger'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);

      // Verify Filter Chips
      expect(find.text('All Events'), findsOneWidget);
      expect(find.text('Legal Holds'), findsOneWidget);
      expect(find.text('Approvals'), findsOneWidget);

      // Verify Audit Entries & Verification Badges
      expect(find.text('LEGAL_HOLD_PLACED'), findsOneWidget);
      expect(find.text('DOCUMENT_PUBLISHED'), findsOneWidget);
      expect(find.text('SHA-256 Verified'), findsWidgets);
    });

    testWidgets('typing in search bar filters audit events', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminAuditLedgerScreen(),
        ),
      );

      // Enter search query
      final searchField = find.byType(TextField);
      await tester.enterText(searchField, 'sarah.compliance');
      await tester.pump();

      // Only Sarah's event appears
      expect(find.text('LEGAL_HOLD_PLACED'), findsOneWidget);
      expect(find.text('DOCUMENT_PUBLISHED'), findsNothing);
    });
  });
}
