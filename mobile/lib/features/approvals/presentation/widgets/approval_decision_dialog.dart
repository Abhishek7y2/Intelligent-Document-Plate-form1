import 'package:flutter/material.dart';
import '../../domain/entities/approval_detail.dart';

class ApprovalDecisionDialog extends StatefulWidget {
  final ApprovalAction action;
  final Function(String reasonCode, String? comments) onConfirm;

  const ApprovalDecisionDialog({
    super.key,
    required this.action,
    required this.onConfirm,
  });

  static Future<void> show(
    BuildContext context, {
    required ApprovalAction action,
    required Function(String reasonCode, String? comments) onConfirm,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ApprovalDecisionDialog(
        action: action,
        onConfirm: onConfirm,
      ),
    );
  }

  @override
  State<ApprovalDecisionDialog> createState() => _ApprovalDecisionDialogState();
}

class _ApprovalDecisionDialogState extends State<ApprovalDecisionDialog> {
  final _commentsController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  late String _selectedReasonCode;

  final List<String> _approveReasons = [
    'Verified & Compliant',
    'Audited per Procurement SLA',
    'Executive Authorized Override',
  ];

  final List<String> _rejectReasons = [
    'Policy Non-Compliance',
    'Vendor Discrepancy',
    'Fraud / Suspect Billing',
    'Budget Exhausted',
  ];

  final List<String> _returnReasons = [
    'Missing Line-Item Detail',
    'Unclear Tax Allocation',
    'Contract Reference Required',
  ];

  @override
  void initState() {
    super.initState();
    switch (widget.action) {
      case ApprovalAction.approve:
        _selectedReasonCode = _approveReasons.first;
        break;
      case ApprovalAction.reject:
        _selectedReasonCode = _rejectReasons.first;
        break;
      case ApprovalAction.returnForChanges:
        _selectedReasonCode = _returnReasons.first;
        break;
    }
  }

  @override
  void dispose() {
    _commentsController.dispose();
    super.dispose();
  }

  List<String> get _currentReasons {
    switch (widget.action) {
      case ApprovalAction.approve:
        return _approveReasons;
      case ApprovalAction.reject:
        return _rejectReasons;
      case ApprovalAction.returnForChanges:
        return _returnReasons;
    }
  }

  Color get _actionColor {
    switch (widget.action) {
      case ApprovalAction.approve:
        return const Color(0xFF10B981);
      case ApprovalAction.reject:
        return const Color(0xFFEF4444);
      case ApprovalAction.returnForChanges:
        return const Color(0xFFF59E0B);
    }
  }

  String get _title {
    switch (widget.action) {
      case ApprovalAction.approve:
        return 'Authorize Approval';
      case ApprovalAction.reject:
        return 'Reject Document';
      case ApprovalAction.returnForChanges:
        return 'Return for Revision';
    }
  }

  void _handleSubmit() {
    if (_formKey.currentState?.validate() ?? false) {
      final comments = _commentsController.text.trim();
      widget.onConfirm(
        _selectedReasonCode,
        comments.isNotEmpty ? comments : null,
      );
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
              widget.action == ApprovalAction.approve
                  ? Icons.verified_user_rounded
                  : (widget.action == ApprovalAction.reject
                      ? Icons.cancel_outlined
                      : Icons.assignment_return_outlined),
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
              Text(
                'Reason Code *',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedReasonCode,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: _currentReasons
                    .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() {
                      _selectedReasonCode = val;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),
              Text(
                widget.action == ApprovalAction.approve ? 'Comments (Optional)' : 'Comments *',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[800],
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _commentsController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: widget.action == ApprovalAction.approve
                      ? 'Add audit or compliance notes...'
                      : 'Provide explicit feedback for the submitter or reviewer...',
                  hintStyle: TextStyle(fontSize: 12, color: Colors.grey[400]),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.all(12),
                ),
                validator: (val) {
                  if (widget.action != ApprovalAction.approve &&
                      (val == null || val.trim().isEmpty)) {
                    return 'Comments are required for rejections or returns';
                  }
                  return null;
                },
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
          onPressed: _handleSubmit,
          style: ElevatedButton.styleFrom(
            backgroundColor: _actionColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text('Confirm ${widget.action.apiValue}'),
        ),
      ],
    );
  }
}
