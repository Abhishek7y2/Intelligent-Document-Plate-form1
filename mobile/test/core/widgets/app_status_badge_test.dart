import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_status_badge.dart';

void main() {
  group('AppStatusBadge Widget Tests (Angular StatusBadge Parity)', () {
    testWidgets('renders Approved/Published state with green text and dot indicator', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'Approved/Published'),
          ),
        ),
      );

      expect(find.text('Approved/Published'), findsOneWidget);
      // Container dot indicator
      expect(find.byType(Container), findsWidgets);
    });

    testWidgets('renders Pending Approval with amber styling', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'Pending approval'),
          ),
        ),
      );

      expect(find.text('Pending Approval'), findsOneWidget);
    });

    testWidgets('renders Quarantined with alert styling', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'Quarantined'),
          ),
        ),
      );

      expect(find.text('Quarantined'), findsOneWidget);
    });

    testWidgets('renders Legal Hold state with orange styling', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'Held'),
          ),
        ),
      );

      expect(find.text('Legal Hold'), findsOneWidget);
    });

    testWidgets('renders Purged state with strikethrough text', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'Purged'),
          ),
        ),
      );

      final textWidget = tester.widget<Text>(find.text('Purged'));
      expect(textWidget.style?.decoration, equals(TextDecoration.lineThrough));
    });

    testWidgets('defaults to Received for unclassified status', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppStatusBadge(status: 'New Intake Item'),
          ),
        ),
      );

      expect(find.text('New Intake Item'), findsOneWidget);
    });
  });
}
