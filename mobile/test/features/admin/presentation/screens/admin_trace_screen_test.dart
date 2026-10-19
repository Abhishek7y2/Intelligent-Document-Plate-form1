import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/admin/presentation/screens/admin_trace_screen.dart';

void main() {
  group('AdminTraceScreen Widget Tests', () {
    testWidgets('renders correlation ID input and distributed timeline stepper', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminTraceScreen(initialCorrelationId: 'REQ-849201-99'),
        ),
      );

      // Verify Header & Input
      expect(find.text('Trace Visualizer'), findsOneWidget);
      expect(find.text('REQ-849201-99'), findsOneWidget);

      // Trigger Trace Search
      final traceButton = find.text('Trace');
      await tester.tap(traceButton);
      await tester.pump();

      // Settle simulated network delay
      await tester.pump(const Duration(milliseconds: 700));
      await tester.pumpAndSettle();

      // Verify Overview Metrics
      expect(find.text('Total Latency'), findsOneWidget);
      expect(find.text('6.36 s'), findsOneWidget);
      expect(find.text('COMPLETE'), findsOneWidget);

      // Verify Timeline Stages
      expect(find.text('1. Ingestion & Pre-Upload Validation'), findsOneWidget);
      expect(find.text('2. OCR Text & Layout Extraction'), findsOneWidget);
      expect(find.text('3. Extraction & Deterministic Arithmetic'), findsOneWidget);
      expect(find.text('4. Human-In-The-Loop Review Workspace'), findsOneWidget);
      expect(find.text('5. Multi-Tier Approval Decision & SoD Check'), findsOneWidget);
      expect(find.text('6. Transactional Outbox Job Dispatch'), findsOneWidget);
    });
  });
}
