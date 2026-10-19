import 'package:flutter/material.dart';
import '../../domain/entities/review_workbench.dart';

/// CustomPainter to render bounding box overlays on top of the document page image.
///
/// Coordinate contract:
/// - Source coordinates in [ReviewBoundingBox] are normalized ratios in the range [0.0, 1.0].
/// - [size] is the exact rendered size of the document page image (NOT screen bounds).
/// - Scaling: left = x * size.width, top = y * size.height, width = w * size.width, height = h * size.height.
/// - Selected field box is drawn with primary emphasis (thicker border, vibrant fill, badge).
/// - Unselected field boxes are drawn with subtle outline and semi-transparent fill.
class EvidenceOverlayPainter extends CustomPainter {
  final List<ReviewBoundingBox> boundingBoxes;
  final String? selectedFieldKey;
  final int currentPage;
  final Color primaryColor;
  final Color secondaryColor;

  EvidenceOverlayPainter({
    required this.boundingBoxes,
    required this.currentPage,
    this.selectedFieldKey,
    this.primaryColor = const Color(0xFF6366F1), // Indigo primary
    this.secondaryColor = const Color(0xFF0EA5E9), // Sky secondary
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    final pageBoxes = boundingBoxes.where((b) => b.page == currentPage).toList();

    for (final box in pageBoxes) {
      final isSelected = selectedFieldKey != null &&
          box.fieldKey.toLowerCase() == selectedFieldKey!.toLowerCase();

      // Normalize coordinate check (clamp to 0.0 - 1.0 safe range)
      final left = (box.x.clamp(0.0, 1.0)) * size.width;
      final top = (box.y.clamp(0.0, 1.0)) * size.height;
      final width = (box.w.clamp(0.0, 1.0)) * size.width;
      final height = (box.h.clamp(0.0, 1.0)) * size.height;

      final rect = Rect.fromLTWH(left, top, width, height);

      // Determine colors based on selection and confidence
      final strokeColor = isSelected
          ? primaryColor
          : (box.confidence < 0.7
              ? const Color(0xFFF59E0B) // Amber for low confidence
              : secondaryColor.withValues(alpha: 0.7));

      final fillColor = isSelected
          ? primaryColor.withValues(alpha: 0.25)
          : (box.confidence < 0.7
              ? const Color(0xFFF59E0B).withValues(alpha: 0.12)
              : secondaryColor.withValues(alpha: 0.08));

      // 1. Draw bounding box fill
      final fillPaint = Paint()
        ..color = fillColor
        ..style = PaintingStyle.fill;
      canvas.drawRect(rect, fillPaint);

      // 2. Draw bounding box stroke
      final strokePaint = Paint()
        ..color = strokeColor
        ..strokeWidth = isSelected ? 2.5 : 1.2
        ..style = PaintingStyle.stroke;
      canvas.drawRect(rect, strokePaint);

      // 3. Draw field label pill if selected or low confidence
      if (isSelected || box.confidence < 0.7) {
        final labelText = '${box.fieldKey} (${(box.confidence * 100).toStringAsFixed(0)}%)';
        final textSpan = TextSpan(
          text: labelText,
          style: TextStyle(
            color: Colors.white,
            fontSize: isSelected ? 10.0 : 9.0,
            fontWeight: FontWeight.w600,
          ),
        );
        final textPainter = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
        );
        textPainter.layout();

        final labelBgPaint = Paint()
          ..color = strokeColor
          ..style = PaintingStyle.fill;

        // Position pill slightly above rect, or inside if near top edge
        final pillTop = (top - textPainter.height - 4 < 0)
            ? top + 2
            : top - textPainter.height - 4;
        final pillRect = Rect.fromLTWH(
          left,
          pillTop,
          textPainter.width + 6,
          textPainter.height + 3,
        );

        canvas.drawRRect(
          RRect.fromRectAndRadius(pillRect, const Radius.circular(3)),
          labelBgPaint,
        );

        textPainter.paint(canvas, Offset(left + 3, pillTop + 1.5));
      }
    }
  }

  @override
  bool shouldRepaint(covariant EvidenceOverlayPainter oldDelegate) {
    return oldDelegate.selectedFieldKey != selectedFieldKey ||
        oldDelegate.currentPage != currentPage ||
        oldDelegate.boundingBoxes != boundingBoxes;
  }
}
