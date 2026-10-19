import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/features/review/domain/entities/review_workbench.dart';
import 'package:docunexa_mobile/features/review/presentation/widgets/evidence_overlay_painter.dart';

void main() {
  group('EvidenceOverlayPainter Coordinate Scaling & Behavior Tests', () {
    final testBoxes = [
      const ReviewBoundingBox(
        fieldKey: 'invoice_number',
        page: 1,
        x: 0.1,
        y: 0.2,
        w: 0.3,
        h: 0.05,
        confidence: 0.95,
      ),
      const ReviewBoundingBox(
        fieldKey: 'total_amount',
        page: 1,
        x: 0.7,
        y: 0.8,
        w: 0.2,
        h: 0.06,
        confidence: 0.65, // low confidence
      ),
      const ReviewBoundingBox(
        fieldKey: 'vendor_name',
        page: 2,
        x: 0.05,
        y: 0.1,
        w: 0.4,
        h: 0.08,
        confidence: 0.90,
      ),
    ];

    test('shouldRepaint returns true when selectedFieldKey changes', () {
      final painter1 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 1,
        selectedFieldKey: 'invoice_number',
      );
      final painter2 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 1,
        selectedFieldKey: 'total_amount',
      );

      expect(painter2.shouldRepaint(painter1), isTrue);
    });

    test('shouldRepaint returns true when currentPage changes', () {
      final painter1 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 1,
      );
      final painter2 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 2,
      );

      expect(painter2.shouldRepaint(painter1), isTrue);
    });

    test('shouldRepaint returns false when properties are identical', () {
      final painter1 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 1,
        selectedFieldKey: 'invoice_number',
      );
      final painter2 = EvidenceOverlayPainter(
        boundingBoxes: testBoxes,
        currentPage: 1,
        selectedFieldKey: 'invoice_number',
      );

      expect(painter2.shouldRepaint(painter1), isFalse);
    });

    testWidgets('paints correctly within CustomPaint canvas with no exceptions across sizes', (tester) async {
      // Test across multiple aspect ratios: Portrait (400x600), Landscape (800x400), Square (500x500)
      for (final size in [
        const Size(400, 600),
        const Size(800, 400),
        const Size(500, 500),
      ]) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: size.width,
                  height: size.height,
                  child: CustomPaint(
                    painter: EvidenceOverlayPainter(
                      boundingBoxes: testBoxes,
                      currentPage: 1,
                      selectedFieldKey: 'invoice_number',
                    ),
                  ),
                ),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('gracefully handles empty boxes or zero size without throwing', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 0,
                height: 0,
                child: CustomPaint(
                  painter: EvidenceOverlayPainter(
                    boundingBoxes: const [],
                    currentPage: 1,
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  });
}
