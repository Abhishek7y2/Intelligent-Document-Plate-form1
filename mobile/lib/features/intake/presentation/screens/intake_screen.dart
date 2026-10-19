import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/intake_document.dart';
import '../bloc/intake_bloc.dart';
import '../bloc/intake_event.dart';
import '../bloc/intake_state.dart';

class IntakeScreen extends StatelessWidget {
  final IntakeBloc? bloc;

  const IntakeScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<IntakeBloc>.value(
        value: bloc!,
        child: const _IntakeView(),
      );
    }
    return BlocProvider<IntakeBloc>(
      create: (_) => sl<IntakeBloc>(),
      child: const _IntakeView(),
    );
  }
}

class _IntakeView extends StatelessWidget {
  const _IntakeView();

  static const Map<String, String> _documentTypes = {
    'purchase-invoice': 'Purchase Invoice',
    'receipt': 'Expense Receipt',
    'contract': 'Legal Contract',
    'tax-form': 'Tax / W-9 Form',
    'financial-statement': 'Financial Statement',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppScaffold(
      title: 'Secure Document Intake',
      body: BlocConsumer<IntakeBloc, IntakeState>(
        listener: (context, state) {
          if (state is IntakeSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Document ingested: ${state.result.documentId}'),
                backgroundColor: AppColors.success600,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is IntakeSelectingSource) {
            return const Center(
              child: AppLoadingIndicator(message: 'Preparing document capture...'),
            );
          }

          if (state is IntakeUploading) {
            return _buildUploadingView(context, state);
          }

          if (state is IntakeDuplicateConflict) {
            return _buildDuplicateConflictView(context, state);
          }

          if (state is IntakeSuccess) {
            return _buildSuccessView(context, state);
          }

          if (state is IntakeDocumentReady) {
            return _buildDocumentReadyView(context, state);
          }

          if (state is IntakeError && state.document == null) {
            return Center(
              child: ErrorView(
                title: 'Intake Error',
                message: state.message,
                correlationId: state.correlationId,
                onRetry: () => context.read<IntakeBloc>().add(const IntakeReset()),
              ),
            );
          }

          return _buildSourceSelectionView(context, theme, errorState: state is IntakeError ? state : null);
        },
      ),
    );
  }

  Widget _buildSourceSelectionView(
    BuildContext context,
    ThemeData theme, {
    IntakeError? errorState,
  }) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Select Document Source',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.slate100,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Capture physical documents with auto-edge detection or select digital files from device storage.',
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
          ),
          const SizedBox(height: AppSpacing.lg),

          if (errorState != null) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              margin: const EdgeInsets.only(bottom: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.error900.withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.error600),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.error500),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      errorState.message,
                      style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.error200),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Camera Scanner Card
          _IntakeOptionCard(
            key: const Key('intake_camera_scan_button'),
            title: 'Camera Document Scanner',
            description: 'Automatic edge detection, perspective cropping, and high-fidelity contrast capture.',
            icon: Icons.document_scanner_rounded,
            accentColor: AppColors.primary500,
            onTap: () {
              context.read<IntakeBloc>().add(const IntakeScanCameraRequested());
            },
          ),
          const SizedBox(height: AppSpacing.md),

          // File Picker Card
          _IntakeOptionCard(
            key: const Key('intake_file_picker_button'),
            title: 'Digital File Storage',
            description: 'Select existing documents from local storage, downloads, or cloud folders.',
            icon: Icons.upload_file_rounded,
            accentColor: AppColors.success500,
            onTap: () {
              context.read<IntakeBloc>().add(const IntakePickFileRequested());
            },
          ),
          const SizedBox(height: AppSpacing.xl),

          // Enterprise Security & Formats Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate900,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.slate800),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.shield_outlined, color: AppColors.primary400, size: 20),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      'SECURE INGESTION STANDARDS',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: AppColors.primary400,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Supported formats: PDF, PNG, JPEG, TIFF, DOCX (Max 50 MB per file).\nAll uploads undergo server-side magic byte verification, cryptographic SHA-256 fingerprinting, tenant boundary isolation, and ClamAV malware scanning.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.slate400,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentReadyView(BuildContext context, IntakeDocumentReady state) {
    final theme = Theme.of(context);
    final doc = state.document;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Selected Document Preview Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate900,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.slate800),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primary900.withOpacity(0.5),
                      child: Icon(
                        doc.source == IntakeSource.cameraScan
                            ? Icons.camera_alt_rounded
                            : Icons.insert_drive_file_rounded,
                        color: AppColors.primary400,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doc.name,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate100,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${doc.formattedSize} • ${doc.mimeType}',
                            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.slate400),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.slate400),
                      tooltip: 'Remove',
                      onPressed: () {
                        context.read<IntakeBloc>().add(const IntakeDocumentRemoved());
                      },
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success900.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.success700),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle_rounded, color: AppColors.success400, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        'Pre-upload integrity verified',
                        style: theme.textTheme.labelSmall?.copyWith(color: AppColors.success300),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // Document Type Selector
          Text(
            'Document Classification Type',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.slate200,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate900,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.slate700),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: state.documentType,
                isExpanded: true,
                dropdownColor: AppColors.slate900,
                style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate100),
                icon: const Icon(Icons.arrow_drop_down_rounded, color: AppColors.slate400),
                items: _documentTypes.entries.map((entry) {
                  return DropdownMenuItem<String>(
                    value: entry.key,
                    child: Text(entry.value),
                  );
                }).toList(),
                onChanged: (newType) {
                  if (newType != null) {
                    context.read<IntakeBloc>().add(IntakeDocumentTypeChanged(newType));
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          // Upload Action Button
          AppButton(
            key: const Key('intake_start_upload_button'),
            label: 'Start Secure Upload',
            icon: Icons.cloud_upload_rounded,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeUploadStarted());
            },
          ),
          const SizedBox(height: AppSpacing.md),

          // Retake / Reselect Button
          AppButton(
            label: 'Choose Different File',
            variant: AppButtonVariant.secondary,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeDocumentRemoved());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildUploadingView(BuildContext context, IntakeUploading state) {
    final theme = Theme.of(context);
    final percent = (state.progress * 100).toInt();
    final sentKb = (state.sentBytes / 1024).toStringAsFixed(1);
    final totalKb = (state.totalBytes / 1024).toStringAsFixed(1);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(
            Icons.cloud_upload_rounded,
            color: AppColors.primary400,
            size: 64,
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Uploading Document...',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.slate100,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            state.document.name,
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xl),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: state.progress > 0 ? state.progress : null,
              minHeight: 10,
              backgroundColor: AppColors.slate800,
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary500),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$percent% Transmitted',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary400,
                ),
              ),
              Text(
                '$sentKb KB / $totalKb KB',
                style: theme.textTheme.bodySmall?.copyWith(color: AppColors.slate400),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          Text(
            'Transmitting securely with SHA-256 fingerprinting, server-side anti-malware quarantine verification, and idempotency protection.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.slate500,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),

          // Cancel Upload Button
          AppButton(
            key: const Key('intake_cancel_upload_button'),
            label: 'Cancel Upload',
            variant: AppButtonVariant.secondary,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeUploadCancelled());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDuplicateConflictView(BuildContext context, IntakeDuplicateConflict state) {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.warning900.withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.warning600),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.warning400,
                  size: 48,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Duplicate Document Detected',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.warning300,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  state.message,
                  style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate300),
                  textAlign: TextAlign.center,
                ),
                if (state.existingDocumentId != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Existing Document ID: ${state.existingDocumentId}',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: AppColors.warning200,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          Text(
            'A document with matching cryptographic content hash is already registered in your tenant. Do you want to force upload as a distinct record or discard?',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.slate400,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),

          // Force Duplicate Upload
          AppButton(
            key: const Key('intake_force_duplicate_button'),
            label: 'Force Ingest Anyway',
            variant: AppButtonVariant.primary,
            icon: Icons.check_circle_outline_rounded,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeUploadStarted(allowDuplicate: true));
            },
          ),
          const SizedBox(height: AppSpacing.md),

          // Cancel
          AppButton(
            label: 'Discard & Choose Another',
            variant: AppButtonVariant.secondary,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeDocumentRemoved());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView(BuildContext context, IntakeSuccess state) {
    final theme = Theme.of(context);
    final res = state.result;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AppColors.success900.withOpacity(0.6),
            child: const Icon(
              Icons.check_circle_rounded,
              color: AppColors.success400,
              size: 48,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Ingestion Successful!',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.slate100,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Document successfully transmitted and queued for asynchronous OCR extraction.',
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.slate400),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),

          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate900,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.slate800),
            ),
            child: Column(
              children: [
                _buildResultRow('DOCUMENT ID', res.documentId),
                const Divider(color: AppColors.slate800, height: 16),
                _buildResultRow('STATUS', res.status),
                const Divider(color: AppColors.slate800, height: 16),
                _buildResultRow('FILE NAME', res.fileName),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          AppButton(
            key: const Key('intake_view_catalog_button'),
            label: 'View in Document Catalog',
            icon: Icons.folder_open_rounded,
            onPressed: () {
              context.pop();
              context.push('/documents/${res.documentId}');
            },
          ),
          const SizedBox(height: AppSpacing.md),

          AppButton(
            label: 'Ingest Another Document',
            variant: AppButtonVariant.secondary,
            onPressed: () {
              context.read<IntakeBloc>().add(const IntakeReset());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.slate500,
            letterSpacing: 0.5,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.slate200,
          ),
        ),
      ],
    );
  }
}

class _IntakeOptionCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final Color accentColor;
  final VoidCallback onTap;

  const _IntakeOptionCard({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.slate900,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.slate800),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: accentColor.withOpacity(0.15),
              child: Icon(icon, color: accentColor, size: 26),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.slate100,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.slate400,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.slate500),
          ],
        ),
      ),
    );
  }
}
