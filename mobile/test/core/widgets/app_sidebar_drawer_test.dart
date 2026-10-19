import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_sidebar_drawer.dart';

void main() {
  group('AppSidebarDrawer Widget Tests (Angular Sidebar Parity)', () {
    testWidgets('renders brand header, 4 enterprise sections, and account footer', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            drawer: AppSidebarDrawer(activeRoute: '/dashboard'),
            body: Text('Content'),
          ),
        ),
      );

      // Open Drawer
      final scaffoldState = tester.firstState<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      // Brand
      expect(find.text('DocuNexa'), findsOneWidget);
      expect(find.text('Document Intelligence'), findsOneWidget);

      // 4 Sections
      expect(find.text('WORKSPACE'), findsOneWidget);
      expect(find.text('INTELLIGENCE & REVIEW'), findsOneWidget);
      expect(find.text('COLLABORATION & GOVERNANCE'), findsOneWidget);
      expect(find.text('ADMINISTRATION'), findsOneWidget);

      // Workspace items
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Documents'), findsOneWidget);
      expect(find.text('Intake / Scanner'), findsOneWidget);

      // Intelligence items
      expect(find.text('Review Workbench'), findsOneWidget);
      expect(find.text('Approvals Queue'), findsOneWidget);
      expect(find.text('Compare Studio'), findsOneWidget);
      expect(find.text('Grounded Q&A'), findsOneWidget);

      // Governance items
      expect(find.text('Tasks & Discussions'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Emergency Legal Hold'), findsOneWidget);
      expect(find.text('Reports & Analytics'), findsOneWidget);

      // Admin items
      expect(find.text('Admin Hub'), findsOneWidget);
      expect(find.text('System Telemetry'), findsOneWidget);
      expect(find.text('Security & Masking'), findsOneWidget);
      expect(find.text('Integrations & ERP'), findsOneWidget);
      expect(find.text('Immutable Audit Ledger'), findsOneWidget);
      expect(find.text('Correlation ID Trace'), findsOneWidget);

      // Account footer
      expect(find.text('My Account'), findsOneWidget);
    });
  });
}
