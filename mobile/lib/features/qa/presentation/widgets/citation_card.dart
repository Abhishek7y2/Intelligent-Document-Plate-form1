import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/entities/qa_entity.dart';

class CitationCard extends StatelessWidget {
  final QaCitation citation;
  final VoidCallback? onVerify;
  final bool isVerifying;

  const CitationCard({
    super.key,
    required this.citation,
    this.onVerify,
    this.isVerifying = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: citation.isSuperseded ? AppColors.warning500 : AppColors.slate700,
          width: citation.isSuperseded ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.description_outlined,
                size: 16,
                color: citation.isSuperseded ? AppColors.warning500 : AppColors.primary400,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  citation.documentTitle,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.slate700,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'p. ${citation.pageNumber}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.slate300,
                  ),
                ),
              ),
            ],
          ),
          if (citation.isSuperseded) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, size: 12, color: AppColors.warning500),
                const SizedBox(width: 4),
                Text(
                  'Superseded version (${citation.sourceVersion}) -> Latest: ${citation.latestVersion ?? 'vNext'}',
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.warning500,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
          if (citation.section.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Section: ${citation.section}',
              style: const TextStyle(
                fontSize: 11,
                fontStyle: FontStyle.italic,
                color: AppColors.slate400,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.all(AppSpacing.xs),
            decoration: BoxDecoration(
              color: AppColors.slate900.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '"${citation.snippet}"',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.slate200,
                height: 1.3,
              ),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    citation.isAuthorized ? Icons.check_circle : Icons.block,
                    size: 14,
                    color: citation.isAuthorized ? AppColors.success500 : AppColors.error500,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    citation.isAuthorized ? 'Authorized Tenant Source' : 'Access Restricted',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: citation.isAuthorized ? AppColors.success500 : AppColors.error500,
                    ),
                  ),
                ],
              ),
              if (onVerify != null)
                TextButton(
                  onPressed: isVerifying ? null : onVerify,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: isVerifying
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Verify Access',
                          style: TextStyle(fontSize: 11, color: AppColors.primary400),
                        ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
