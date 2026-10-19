import 'package:flutter/material.dart';
import '../../domain/entities/review_workbench.dart';

/// Modal bottom sheet allowing the reviewer to edit a selected field's value.
/// Requires both the corrected value and a justification reason to maintain
/// the backend's immutable audit log trail.
class FieldEditBottomSheet extends StatefulWidget {
  final ReviewField field;
  final Function(String correctedValue, String reason) onSave;

  const FieldEditBottomSheet({
    super.key,
    required this.field,
    required this.onSave,
  });

  static Future<void> show(
    BuildContext context, {
    required ReviewField field,
    required Function(String correctedValue, String reason) onSave,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: FieldEditBottomSheet(
          field: field,
          onSave: onSave,
        ),
      ),
    );
  }

  @override
  State<FieldEditBottomSheet> createState() => _FieldEditBottomSheetState();
}

class _FieldEditBottomSheetState extends State<FieldEditBottomSheet> {
  late final TextEditingController _valueController;
  late final TextEditingController _reasonController;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _valueController = TextEditingController(text: widget.field.value);
    _reasonController = TextEditingController();
  }

  @override
  void dispose() {
    _valueController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_formKey.currentState?.validate() ?? false) {
      final val = _valueController.text.trim();
      final reason = _reasonController.text.trim();
      widget.onSave(val, reason);
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLowConfidence = widget.field.confidence < 0.7;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Edit Field: ${widget.field.label}',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Key: ${widget.field.key} | Confidence: ${(widget.field.confidence * 100).toStringAsFixed(0)}%',
                        style: TextStyle(
                          fontSize: 12,
                          color: isLowConfidence ? const Color(0xFFD97706) : Colors.grey[600],
                          fontWeight: isLowConfidence ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Corrected Value',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _valueController,
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) {
                  return 'Value cannot be empty';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            Text(
              'Reason for Correction (Audit Log)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _reasonController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'e.g., OCR misread "8" as "B", verified from invoice header',
                hintStyle: TextStyle(fontSize: 12, color: Colors.grey[400]),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) {
                  return 'Reason is required for backend compliance audit';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Save Correction'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
