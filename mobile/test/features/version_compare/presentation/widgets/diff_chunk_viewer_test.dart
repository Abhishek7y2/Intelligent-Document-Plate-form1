import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:docunexa_mobile/features/version_compare/domain/entities/document_comparison.dart';
import 'package:docunexa_mobile/features/version_compare/presentation/widgets/diff_chunk_viewer.dart';

void main() {
  group('DiffChunkViewer Widget Tests', () {
    testWidgets('renders empty message when chunks are empty', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DiffChunkViewer(chunks: []),
          ),
        ),
      );

      expect(find.text('(No textual changes detected)'), findsOneWidget);
    });

    testWidgets('renders rich text containing normal, added, and removed chunks', (tester) async {
      const chunks = [
        DiffChunk(text: 'Payment due within ', type: DiffChunkType.normal),
        DiffChunk(text: '30 days', type: DiffChunkType.removed),
        DiffChunk(text: '15 days', type: DiffChunkType.added),
        DiffChunk(text: ' of invoice date.', type: DiffChunkType.normal),
      ];

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DiffChunkViewer(chunks: chunks),
          ),
        ),
      );

      expect(find.byType(RichText), findsOneWidget);
      final richText = tester.widget<RichText>(find.byType(RichText));
      final textSpan = richText.text as TextSpan;

      expect(textSpan.children?.length, 4);
      expect((textSpan.children![0] as TextSpan).text, 'Payment due within ');
      expect((textSpan.children![1] as TextSpan).text, '30 days');
      expect((textSpan.children![2] as TextSpan).text, '15 days');
      expect((textSpan.children![3] as TextSpan).text, ' of invoice date.');
    });
  });
}
