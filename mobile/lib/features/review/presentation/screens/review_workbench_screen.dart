import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/review_workbench.dart';
import '../bloc/review_workbench/review_workbench_bloc.dart';
import '../bloc/review_workbench/review_workbench_event.dart';
import '../bloc/review_workbench/review_workbench_state.dart';
import '../widgets/evidence_overlay_painter.dart';
import '../widgets/field_edit_bottom_sheet.dart';
import '../widgets/math_reconciliation_card.dart';
import '../widgets/review_decision_dialog.dart';

class ReviewWorkbenchScreen extends StatelessWidget {
  final String documentId;
  final ReviewWorkbenchBloc? bloc;

  const ReviewWorkbenchScreen({
    super.key,
    required this.documentId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<ReviewWorkbenchBloc>.value(
        value: bloc!,
        child: _ReviewWorkbenchView(documentId: documentId),
      );
    }
    return BlocProvider<ReviewWorkbenchBloc>(
      create: (_) => sl<ReviewWorkbenchBloc>()..add(LoadReviewWorkbench(documentId)),
      child: _ReviewWorkbenchView(documentId: documentId),
    );
  }
}

class _ReviewWorkbenchView extends StatefulWidget {
  final String documentId;

  const _ReviewWorkbenchView({required this.documentId});

  @override
  State<_ReviewWorkbenchView> createState() => _ReviewWorkbenchViewState();
}

class _ReviewWorkbenchViewState extends State<_ReviewWorkbenchView> {
  final TransformationController _transformationController = TransformationController();

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ReviewWorkbenchBloc, ReviewWorkbenchState>(
      listener: (context, state) {
        if (state is ReviewWorkbenchDecisionSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Review decision "${state.result.status}" recorded successfully!'),
              backgroundColor: const Color(0xFF10B981),
            ),
          );
          context.pop();
        } else if (state is ReviewWorkbenchLoaded && state.submitError != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.submitError!),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      },
      builder: (context, state) {
        if (state is ReviewWorkbenchLoading) {
          return const Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading Review Workbench...'),
                ],
              ),
            ),
          );
        }

        if (state is ReviewWorkbenchError) {
          return Scaffold(
            appBar: AppBar(title: const Text('Review Document')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      state.errorCode == 'DOCUMENT_QUARANTINED'
                          ? Icons.shield_outlined
                          : Icons.error_outline,
                      size: 56,
                      color: state.errorCode == 'DOCUMENT_QUARANTINED'
                          ? Colors.amber
                          : Colors.red,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      state.errorCode == 'DOCUMENT_QUARANTINED'
                          ? 'Document Quarantined'
                          : 'Review Unavailable',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey[700]),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => context.pop(),
                      child: const Text('Return to Queue'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (state is ReviewWorkbenchLoaded) {
          return _buildWorkbenchView(context, state);
        }

        return const Scaffold(body: SizedBox.shrink());
      },
    );
  }

  Widget _buildWorkbenchView(BuildContext context, ReviewWorkbenchLoaded state) {
    final wb = state.workbench;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              wb.documentTitle,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Text(
              '${wb.documentType} • ${(wb.overallConfidence * 100).toStringAsFixed(0)}% Confidence',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.zoom_out_map),
            tooltip: 'Reset Zoom',
            onPressed: () {
              _transformationController.value = Matrix4.identity();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isTabletOrDesktop = constraints.maxWidth >= 768;

            if (isTabletOrDesktop) {
              // 50/50 HORIZONTAL SPLIT CANVAS (ANGULAR DESKTOP WORKBENCH 100% PARITY)
              return Row(
                children: [
                  // Left 50%: Document Canvas with Bounding Box Overlays & Page Controls
                  Expanded(
                    flex: 5,
                    child: Column(
                      children: [
                        Expanded(child: _buildDocumentPreview(context, state)),
                        _buildPageControlBar(context, state),
                      ],
                    ),
                  ),
                  const VerticalDivider(width: 1, thickness: 1, color: Color(0xFF334155)),
                  // Right 50%: Extracted Fields Validation Form & Sticky Decision Bar
                  Expanded(
                    flex: 5,
                    child: Column(
                      children: [
                        Expanded(child: _buildExtractedFieldsPanel(context, state)),
                        _buildDecisionActionBar(context, state),
                      ],
                    ),
                  ),
                ],
              );
            }

            // PHONE VIEWPORT: VERTICAL 50/50 SPLIT
            return Column(
              children: [
                // Top Preview Panel (50% of viewport height)
                Expanded(
                  flex: 5,
                  child: _buildDocumentPreview(context, state),
                ),

                // Page Selector / Bar
                _buildPageControlBar(context, state),

                // Bottom Extracted Fields & Decision Panel (50% of viewport height)
                Expanded(
                  flex: 5,
                  child: _buildExtractedFieldsPanel(context, state),
                ),

                // Bottom Sticky Decision Action Bar
                _buildDecisionActionBar(context, state),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildDocumentPreview(BuildContext context, ReviewWorkbenchLoaded state) {
    return Container(
      color: const Color(0xFF1E293B), // Dark slate canvas background
      child: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              transformationController: _transformationController,
              minScale: 0.5,
              maxScale: 4.0,
              boundaryMargin: const EdgeInsets.all(40),
              child: state.pageImageBytes != null
                  ? LayoutBuilder(
                      builder: (context, constraints) {
                        return Stack(
                          children: [
                            Image.memory(
                              state.pageImageBytes!,
                              fit: BoxFit.contain,
                            ),
                            Positioned.fill(
                              child: CustomPaint(
                                painter: EvidenceOverlayPainter(
                                  boundingBoxes: state.workbench.boundingBoxes,
                                  currentPage: state.currentPage,
                                  selectedFieldKey: state.selectedFieldKey,
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    )
                  : (state.isImageLoading
                      ? const Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        )
                      : const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.image_not_supported_outlined, color: Colors.grey, size: 48),
                              SizedBox(height: 8),
                              Text(
                                'Page preview not available',
                                style: TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        )),
            ),
          ),
          if (state.selectedFieldKey != null)
            Positioned(
              top: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black87.withValues(alpha: 0.75),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Highlighting: ${state.selectedFieldKey}',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPageControlBar(BuildContext context, ReviewWorkbenchLoaded state) {
    final totalPages = state.workbench.pages;
    return Container(
      color: Colors.grey[100],
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, size: 16),
            onPressed: state.currentPage > 1
                ? () {
                    context.read<ReviewWorkbenchBloc>().add(
                          ChangeWorkbenchPage(state.currentPage - 1),
                        );
                  }
                : null,
          ),
          Text(
            'Page ${state.currentPage} of $totalPages',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          IconButton(
            icon: const Icon(Icons.arrow_forward_ios, size: 16),
            onPressed: state.currentPage < totalPages
                ? () {
                    context.read<ReviewWorkbenchBloc>().add(
                          ChangeWorkbenchPage(state.currentPage + 1),
                        );
                  }
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildExtractedFieldsPanel(BuildContext context, ReviewWorkbenchLoaded state) {
    final wb = state.workbench;
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (wb.reconciliationResult != null)
          MathReconciliationCard(reconciliation: wb.reconciliationResult!),

        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(
            children: [
              const Text(
                'Extracted Fields',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(width: 6),
              Text(
                '(${wb.fields.length})',
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
            ],
          ),
        ),

        ...wb.fields.map((field) {
          final isSelected = field.key.toLowerCase() == (state.selectedFieldKey ?? '').toLowerCase();
          final isLowConf = field.confidence < 0.7;

          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFF6366F1)
                    : (isLowConf ? const Color(0xFFFDE68A) : Colors.grey[200]!),
                width: isSelected ? 1.5 : 1.0,
              ),
            ),
            child: ListTile(
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              onTap: () {
                context.read<ReviewWorkbenchBloc>().add(SelectField(field.key));
              },
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      field.label,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: isSelected ? const Color(0xFF4F46E5) : Colors.black87,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isLowConf ? const Color(0xFFFEF3C7) : const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${(field.confidence * 100).toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: isLowConf ? const Color(0xFFD97706) : Colors.grey[700],
                      ),
                    ),
                  ),
                ],
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  field.value.isEmpty ? '(Empty / Not Detected)' : field.value,
                  style: TextStyle(
                    fontSize: 14,
                    color: field.value.isEmpty ? Colors.grey[400] : Colors.black87,
                    fontStyle: field.value.isEmpty ? FontStyle.italic : FontStyle.normal,
                  ),
                ),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.edit_outlined, size: 18),
                color: const Color(0xFF4F46E5),
                tooltip: 'Edit Field',
                onPressed: () {
                  FieldEditBottomSheet.show(
                    context,
                    field: field,
                    onSave: (correctedValue, reason) {
                      context.read<ReviewWorkbenchBloc>().add(
                            CorrectWorkbenchField(
                              fieldKey: field.key,
                              correctedValue: correctedValue,
                              reason: reason,
                            ),
                          );
                    },
                  );
                },
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildDecisionActionBar(BuildContext context, ReviewWorkbenchLoaded state) {
    final requiresOverride = state.workbench.reconciliationResult != null &&
        !state.workbench.reconciliationResult!.mathValid;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: state.isSubmitting
                  ? null
                  : () {
                      ReviewDecisionDialog.show(
                        context,
                        action: 'REJECT',
                        requiresOverride: false,
                        onConfirm: (comments, overrideReason) {
                          context.read<ReviewWorkbenchBloc>().add(
                                SubmitWorkbenchDecision(
                                  action: 'REJECT',
                                  comments: comments,
                                ),
                              );
                        },
                      );
                    },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFEF4444),
                side: const BorderSide(color: Color(0xFFEF4444)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Reject'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              onPressed: state.isSubmitting
                  ? null
                  : () {
                      ReviewDecisionDialog.show(
                        context,
                        action: 'REQUEST_CHANGES',
                        requiresOverride: false,
                        onConfirm: (comments, overrideReason) {
                          context.read<ReviewWorkbenchBloc>().add(
                                SubmitWorkbenchDecision(
                                  action: 'REQUEST_CHANGES',
                                  comments: comments,
                                ),
                              );
                        },
                      );
                    },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFF59E0B),
                side: const BorderSide(color: Color(0xFFF59E0B)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Req Changes'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: state.isSubmitting
                  ? null
                  : () {
                      ReviewDecisionDialog.show(
                        context,
                        action: 'APPROVE',
                        requiresOverride: requiresOverride,
                        onConfirm: (comments, overrideReason) {
                          context.read<ReviewWorkbenchBloc>().add(
                                SubmitWorkbenchDecision(
                                  action: 'APPROVE',
                                  comments: comments,
                                  overrideReason: overrideReason,
                                ),
                              );
                        },
                      );
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: state.isSubmitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Approve', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
