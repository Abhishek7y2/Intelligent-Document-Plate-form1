import 'package:flutter/material.dart';
import '../../domain/entities/erp_publication.dart';

class ErpPublicationCard extends StatelessWidget {
  final ErpPublicationRecord? publication;
  final bool isPublishing;
  final VoidCallback onPublish;

  const ErpPublicationCard({
    super.key,
    this.publication,
    required this.isPublishing,
    required this.onPublish,
  });

  @override
  Widget build(BuildContext context) {
    final status = publication?.status ?? ErpPublicationStatus.pending;
    final isPublished = status == ErpPublicationStatus.published;
    final isFailed = status == ErpPublicationStatus.failed;

    Color statusColor;
    Color statusBg;
    IconData statusIcon;

    if (isPublished) {
      statusColor = const Color(0xFF10B981);
      statusBg = const Color(0xFFECFDF5);
      statusIcon = Icons.cloud_done_rounded;
    } else if (isFailed) {
      statusColor = const Color(0xFFEF4444);
      statusBg = const Color(0xFFFEF2F2);
      statusIcon = Icons.cloud_off_rounded;
    } else {
      statusColor = const Color(0xFF6366F1);
      statusBg = const Color(0xFFEEF2FF);
      statusIcon = Icons.cloud_upload_outlined;
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(statusIcon, color: statusColor, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Enterprise ERP Integration (${publication?.erpTarget ?? 'SAP S/4HANA'})',
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status.displayName,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (publication != null) ...[
            Text(
              'Idempotency Key: ${publication!.idempotencyKey}',
              style: TextStyle(fontSize: 11, color: Colors.grey[700]),
            ),
            const SizedBox(height: 2),
            Text(
              'Dispatch Attempts: ${publication!.attempts}${publication!.publishedAt != null ? ' • Published at: ${publication!.publishedAt!.toIso8601String().split('T').first}' : ''}',
              style: TextStyle(fontSize: 11, color: Colors.grey[700]),
            ),
            if (publication!.lastError != null) ...[
              const SizedBox(height: 6),
              Text(
                'Error: ${publication!.lastError}',
                style: const TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.w500),
              ),
            ],
          ] else ...[
            const Text(
              'Document is fully approved. Ready to dispatch outbound payload to connected enterprise ERP.',
              style: TextStyle(fontSize: 12, color: Colors.black87),
            ),
          ],
          if (!isPublished) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: isPublishing
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Icon(isFailed ? Icons.refresh : Icons.send_rounded, size: 16),
                label: Text(
                  isPublishing
                      ? 'Dispatching Outbound Event...'
                      : (isFailed ? 'Retry ERP Publication' : 'Dispatch to ERP (Outbox)'),
                ),
                onPressed: isPublishing ? null : onPublish,
                style: ElevatedButton.styleFrom(
                  backgroundColor: statusColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
