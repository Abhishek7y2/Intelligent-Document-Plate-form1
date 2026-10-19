import 'package:flutter/material.dart';

/// Modal dialog for confirming human review decisions:
/// - APPROVE (Requires override reason if math mismatch detected)
/// - REJECT
/// - REQUEST_CHANGES
class ReviewDecisionDialog extends StatefulWidget {
  final String action; // 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
  final bool requiresOverride;
  final Function(String? comments, String? overrideReason) onConfirm;

  const ReviewDecisionDialog({
    super.key,
    required this.action,
    required this.requiresOverride,
    required this.onConfirm,
  });

  static Future<void> show(
    BuildContext context, {
    required String action,
    required bool requiresOverride,
    required Function(String? comments, String? overrideReason) onConfirm,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ReviewDecisionDialog(
        action: action,
        requiresOverride: requiresOverride,
        onConfirm: onConfirm,
      ),
    );
  }

  @override
  State<ReviewDecisionDialog> createState() => _ReviewDecisionDialogState();
}

class _ReviewDecisionDialogState extends State<ReviewDecisionDialog> {
  final _commentsController = TextEditingController();
  final _overrideReasonController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _commentsController.dispose();
    _overrideReasonController.dispose();
    super.dispose();
  }

  String get _title {
    switch (widget.action) {
      case 'APPROVE':
        return 'Approve Document';
      case 'REJECT':
        return 'Reject Document';
      case 'REQUEST_CHANGES':
        return 'Request Changes';
      default:
        return 'Submit Decision';
    }
  }

  Color get _actionColor {
    switch (widget.action) {
      case 'APPROVE':
        return const Color(0xFF10B981);
      case 'REJECT':
        return const Color(0xFFEF4444);
      case 'REQUEST_CHANGES':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF4F46E5);
    }
  }

  void _handleConfirm() {
    if (_formKey.currentState?.validate() ?? false) {
      final comments = _commentsController.text.trim().isNotEmpty
          ? _commentsController.text.trim()
          : null;
      final overrideReason = _overrideReasonController.text.trim().isNotEmpty
          ? _overrideReasonController.text.trim()
          : null;

      widget.onConfirm(comments, overrideReason);
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _actionColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              widget.action == 'APPROVE'
                  ? Icons.check
                  : widget.action == 'REJECT'
                      ? Icons.close
                      : Icons.undo,
              color: _actionColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.requiresOverride && widget.action == 'APPROVE') ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Math discrepancy exists! An explicit override reason is mandatory to approve.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF991B1B),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Override Justification *',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[800],
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _overrideReasonController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'e.g., Authorized rounding difference per contract terms',
                    hintStyle: TextStyle(fontSize: 12, color: Colors.grey[400]),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.all(10),
                  ),
                  validator: (val) {
                    if (widget.requiresOverride && (val == null || val.trim().isEmpty)) {
                      return 'Override justification is required';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
              ],
              Text(
                'Review Comments (Optional)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _commentsController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Add notes for the audit trail or next review stage...',
                  hintStyle: TextStyle(fontSize: 12, color: Colors.grey[400]),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.all(10),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          onPressed: _handleConfirm,
          style: ElevatedButton.styleFrom(
            backgroundColor: _actionColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text('Confirm ${widget.action}'),
        ),
      ],
    );
  }
}
