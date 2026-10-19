import 'package:flutter/material.dart';
import '../../domain/entities/document_comparison.dart';

class DiffChunkViewer extends StatelessWidget {
  final List<DiffChunk> chunks;
  final double fontSize;

  const DiffChunkViewer({
    super.key,
    required this.chunks,
    this.fontSize = 13.0,
  });

  @override
  Widget build(BuildContext context) {
    if (chunks.isEmpty) {
      return const Text(
        '(No textual changes detected)',
        style: TextStyle(fontStyle: FontStyle.italic, color: Colors.grey),
      );
    }

    return RichText(
      text: TextSpan(
        style: TextStyle(
          fontSize: fontSize,
          height: 1.5,
          color: Colors.black87,
        ),
        children: chunks.map((chunk) {
          switch (chunk.type) {
            case DiffChunkType.added:
              return TextSpan(
                text: chunk.text,
                style: const TextStyle(
                  backgroundColor: Color(0xFFDCFCE7), // Green 100
                  color: Color(0xFF166534), // Green 800
                  fontWeight: FontWeight.w600,
                ),
              );
            case DiffChunkType.removed:
              return TextSpan(
                text: chunk.text,
                style: const TextStyle(
                  backgroundColor: Color(0xFFFEE2E2), // Red 100
                  color: Color(0xFF991B1B), // Red 800
                  decoration: TextDecoration.lineThrough,
                  fontWeight: FontWeight.w500,
                ),
              );
            case DiffChunkType.normal:
              return TextSpan(text: chunk.text);
          }
        }).toList(),
      ),
    );
  }
}
