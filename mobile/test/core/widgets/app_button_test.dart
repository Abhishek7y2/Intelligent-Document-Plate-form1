import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/core/widgets/app_button.dart';

void main() {
  group('AppButton Widget Tests', () {
    testWidgets('Renders label and triggers callback on press', (WidgetTester tester) async {
      var pressed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              label: 'Submit Document',
              onPressed: () => pressed = true,
            ),
          ),
        ),
      );

      expect(find.text('Submit Document'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);

      await tester.tap(find.text('Submit Document'));
      await tester.pump();

      expect(pressed, isTrue);
    });

    testWidgets('Shows CircularProgressIndicator when isLoading is true', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppButton(
              label: 'Submit Document',
              isLoading: true,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Submit Document'), findsNothing);
    });
  });
}
