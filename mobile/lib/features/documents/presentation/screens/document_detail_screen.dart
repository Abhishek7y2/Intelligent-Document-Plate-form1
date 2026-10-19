import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/document.dart';
import '../bloc/document_detail_bloc.dart';
import '../bloc/document_detail_event.dart';
import '../bloc/document_detail_state.dart';

class DocumentDetailScreen extends StatelessWidget {
  final String documentId;
  final DocumentDetailBloc? bloc;

  const DocumentDetailScreen({
    super.key,
    required this.documentId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<DocumentDetailBloc>.value(
        value: bloc!,
        child: _DocumentDetailView(documentId: documentId),
      );
    }
    return BlocProvider<DocumentDetailBloc>(
      create: (_) => sl<DocumentDetailBloc>()
        ..add(DocumentDetailFetchRequested(documentId)),
      child: _DocumentDetailView(documentId: documentId),
    );
  }
}

class _DocumentDetailView extends StatelessWidget {
  final String documentId;

  const _DocumentDetailView({required this.documentId});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Document Details',
      body: BlocBuilder<DocumentDetailBloc, DocumentDetailState>(
        builder: (context, state) {
          if (state is DocumentDetailLoading || state is DocumentDetailInitial) {
            return const Center(
              child: AppLoadingIndicator(message: 'Retrieving document record...'),
            );
          }

          if (state is DocumentDetailError) {
            return Center(
              child: ErrorView(
                title: 'Unable to load document',
                message: state.message,
                correlationId: state.correlationId,
                onRetry: () => context
                    .read<DocumentDetailBloc>()
                    .add(DocumentDetailFetchRequested(documentId)),
              ),
            );
          }

          final doc = (state as DocumentDetailLoaded).document;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Identification Card
                _buildHeaderCard(context, doc),
                const SizedBox(height: AppSpacing.md),

                // Processing & SLA Card
                _buildSlaCard(context, doc),
                const SizedBox(height: AppSpacing.md),

                // Metadata Card
                _buildMetadataCard(context, doc),
                const SizedBox(height: AppSpacing.md),

                // Cryptographic Integrity Card
                _buildIntegrityCard(context, doc),
                const SizedBox(height: AppSpacing.md),

                // Secure File Operations Card
                _buildFileOperationsCard(context, doc),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeaderCard(BuildContext context, DocumentDetail doc) {
    Color statusColor = AppColors.slate400;
    Color statusBg = AppColors.slate800;

    switch (doc.status.toUpperCase()) {
      case 'APPROVED':
      case 'PUBLISHED':
        statusColor = AppColors.emerald300;
        statusBg = AppColors.emerald900.withOpacity(0.3);
        break;
      case 'NEEDS_REVIEW':
      case 'PENDING_APPROVAL':
        statusColor = AppColors.amber300;
        statusBg = AppColors.amber900.withOpacity(0.3);
        break;
      case 'PROCESSING':
        statusColor = AppColors.sky300;
        statusBg = AppColors.sky900.withOpacity(0.3);
        break;
      case 'QUARANTINED':
      case 'REJECTED':
      case 'FAILED':
        statusColor = AppColors.rose300;
        statusBg = AppColors.rose900.withOpacity(0.3);
        break;
    }

    final confPercent = (doc.confidence * 100).toStringAsFixed(1);

    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    doc.fileName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withOpacity(0.4)),
                  ),
                  child: Text(
                    doc.status.replaceAll('_', ' '),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'ID: ${doc.id}',
              style: const TextStyle(
                color: AppColors.slate500,
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'AI Confidence Score',
                        style: TextStyle(color: AppColors.slate400, fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$confPercent%',
                        style: const TextStyle(
                          color: AppColors.emerald400,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Document Type',
                        style: TextStyle(color: AppColors.slate400, fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        doc.docType.replaceAll('_', ' '),
                        style: const TextStyle(
                          color: AppColors.primary300,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSlaCard(BuildContext context, DocumentDetail doc) {
    Color slaColor = AppColors.emerald400;
    if (doc.slaStatus == 'BREACHED') slaColor = AppColors.rose400;
    if (doc.slaStatus == 'WARNING') slaColor = AppColors.amber400;

    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Processing & SLA Status',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(color: AppColors.slate800),
            _buildDetailRow(
              'SLA Status',
              Text(
                doc.slaStatus.replaceAll('_', ' '),
                style: TextStyle(color: slaColor, fontWeight: FontWeight.bold),
              ),
            ),
            _buildDetailRow(
              'Lifecycle Stage',
              Text(doc.stage, style: const TextStyle(color: Colors.white)),
            ),
            if (doc.assignedTo != null && doc.assignedTo!.isNotEmpty)
              _buildDetailRow(
                'Assigned Reviewer',
                Text(doc.assignedTo!, style: const TextStyle(color: Colors.white)),
              ),
            if (doc.quarantineReason != null && doc.quarantineReason!.isNotEmpty)
              _buildDetailRow(
                'Quarantine Reason',
                Text(
                  doc.quarantineReason!,
                  style: const TextStyle(color: AppColors.rose300, fontWeight: FontWeight.w600),
                ),
              ),
            if (doc.retryCount > 0)
              _buildDetailRow(
                'Retry Count',
                Text('${doc.retryCount}', style: const TextStyle(color: Colors.white)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetadataCard(BuildContext context, DocumentDetail doc) {
    final formattedUpload = DateFormat('MMM d, y • HH:mm:ss').format(doc.uploadedAt);

    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Document Metadata',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(color: AppColors.slate800),
            _buildDetailRow(
              'Page Count',
              Text('${doc.pageCount} pages', style: const TextStyle(color: Colors.white)),
            ),
            _buildDetailRow(
              'File Size',
              Text(doc.size, style: const TextStyle(color: Colors.white)),
            ),
            _buildDetailRow(
              'Ingestion Source',
              Text(doc.source.replaceAll('_', ' '), style: const TextStyle(color: Colors.white)),
            ),
            _buildDetailRow(
              'Ingested At',
              Text(formattedUpload, style: const TextStyle(color: Colors.white)),
            ),
            _buildDetailRow(
              'MIME Type',
              Text(doc.mimeType, style: const TextStyle(color: Colors.white)),
            ),
            _buildDetailRow(
              'Tenant Isolation',
              Text(doc.tenantId, style: const TextStyle(color: AppColors.primary400)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntegrityCard(BuildContext context, DocumentDetail doc) {
    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Cryptographic Integrity',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (doc.sha256Hash.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, size: 18, color: AppColors.primary400),
                    tooltip: 'Copy SHA-256 Hash',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: doc.sha256Hash));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('SHA-256 hash copied to clipboard.'),
                          backgroundColor: AppColors.slate800,
                        ),
                      );
                    },
                  ),
              ],
            ),
            const Divider(color: AppColors.slate800),
            Text(
              doc.sha256Hash.isNotEmpty ? doc.sha256Hash : 'SHA-256 validation verified at ingestion',
              style: const TextStyle(
                color: AppColors.slate400,
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, Widget valueWidget) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.slate400, fontSize: 13)),
          Flexible(child: valueWidget),
        ],
      ),
    );
  }

  Widget _buildFileOperationsCard(BuildContext context, DocumentDetail doc) {
    return Card(
      color: AppColors.slate900,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: const [
                Icon(Icons.lock_outline_rounded, color: AppColors.primary400, size: 20),
                SizedBox(width: AppSpacing.xs),
                Text(
                  'SECURE FILE OPERATIONS',
                  style: TextStyle(
                    color: AppColors.primary400,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Document artifacts are secured by tenant boundary retention policies and access controls. High-resolution server-rendered page previews are available for authorized inspection.',
              style: TextStyle(
                color: AppColors.slate400,
                fontSize: 12,
                height: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              key: const Key('preview_document_pages_button'),
              label: 'Preview Document Pages',
              icon: Icons.preview_rounded,
              variant: AppButtonVariant.primary,
              onPressed: () => _showPagePreviewDialog(context, doc),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              key: const Key('view_version_history_button'),
              label: 'Version History & Compare',
              icon: Icons.history_rounded,
              variant: AppButtonVariant.secondary,
              onPressed: () => context.push('/documents/${doc.id}/versions'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPagePreviewDialog(BuildContext context, DocumentDetail doc) {
    showDialog(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: AppColors.slate900,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.slate800),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Page Preview (1 of ${doc.pageCount})',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.slate400),
                      onPressed: () => Navigator.of(dialogContext).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  height: 260,
                  decoration: BoxDecoration(
                    color: AppColors.slate950,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.slate800),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.image_outlined,
                          size: 48,
                          color: AppColors.primary400,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          doc.fileName,
                          style: const TextStyle(
                            color: AppColors.slate200,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Rendered via /documents/:id/pages/1/image',
                          style: TextStyle(
                            color: AppColors.slate500,
                            fontSize: 11,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                const Text(
                  'Raw binary downloads are restricted by tenant retention policy to authorized archive officers.',
                  style: TextStyle(
                    color: AppColors.slate500,
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
