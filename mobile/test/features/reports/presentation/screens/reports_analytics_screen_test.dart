import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reports/presentation/screens/reports_analytics_screen.dart';

void main() {
  group('ReportsAnalyticsScreen Widget Tests (Angular Reports Parity)', () {
    testWidgets('renders reports center, tabs, and executive overview metrics', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ReportsAnalyticsScreen(),
        ),
      );

      // Verify Header & Date Range
      expect(find.text('Reports & Governance'), findsOneWidget);
      expect(find.text('Date Range:'), findsOneWidget);
      expect(find.text('Last 30 Days'), findsOneWidget);

      // Verify Tabs
      expect(find.text('📊 Executive'), findsOneWidget);
      expect(find.text('🎯 AI Accuracy'), findsOneWidget);
      expect(find.text('⏱ SLA & Bottlenecks'), findsOneWidget);

      // Executive Tab KPIs
      expect(find.text('Total Ingested'), findsOneWidget);
      expect(find.text('4,891'), findsOneWidget);
      expect(find.text('Published'), findsOneWidget);
      expect(find.text('4,612'), findsOneWidget);
      expect(find.text('Intake Volume by Document Type'), findsOneWidget);
    });

    testWidgets('switching to AI Accuracy tab displays precision, recall, and citation fidelity', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ReportsAnalyticsScreen(),
        ),
      );

      // Tap AI Accuracy Tab
      await tester.tap(find.text('🎯 AI Accuracy'));
      await tester.pumpAndSettle();

      // Verify AI Metrics
      expect(find.text('Extraction Precision & Recall by Field (AI-008)'), findsOneWidget);
      expect(find.text('invoice_number'), findsOneWidget);
      expect(find.text('total_amount (Arithmetic Verified)'), findsOneWidget);
      expect(find.text('Grounded Q&A Citation Fidelity (AI-006)'), findsOneWidget);
      expect(find.text('Citation Grounding Rate:'), findsOneWidget);
    });

    testWidgets('tapping export CSV button triggers security audit toast notice', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ReportsAnalyticsScreen(),
        ),
      );

      // Tap Export CSV icon in AppBar
      final exportButton = find.byIcon(Icons.download_rounded);
      await tester.tap(exportButton);
      await tester.pump();

      // Settle simulated network delay
      await tester.pump(const Duration(milliseconds: 800));
      await tester.pumpAndSettle();

      // SnackBar security audit log notice
      expect(find.textContaining('SECURITY AUDIT LOGGED: Governance CSV export downloaded'), findsOneWidget);
    });
  });
}
