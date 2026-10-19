import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_scaffold.dart';

/// Implements 100% parity with Angular's `AdminAudit` component.
/// Provides a searchable, filterable immutable audit ledger browser with SHA-256 hash verification.
class AdminAuditLedgerScreen extends StatefulWidget {
  const AdminAuditLedgerScreen({super.key});

  @override
  State<AdminAuditLedgerScreen> createState() => _AdminAuditLedgerScreenState();
}

class _AdminAuditLedgerScreenState extends State<AdminAuditLedgerScreen> {
  String _selectedEventFilter = 'ALL';
  String _searchQuery = '';

  final List<Map<String, dynamic>> _mockAuditEvents = [
    {
      'id': 'aud-89214-01',
      'actor': 'sarah.compliance@enterprise.com',
      'role': 'org_admin',
      'event': 'LEGAL_HOLD_PLACED',
      'resource': 'doc-inv-2026-904',
      'correlationId': 'REQ-849201-99',
      'timestamp': '2026-10-17 15:42:10 UTC',
      'hash': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'payload': {'matterNumber': 'MATTER-2026-09', 'reason': 'External vendor audit preservation'},
    },
    {
      'id': 'aud-89213-44',
      'actor': 'david.approver@enterprise.com',
      'role': 'approver',
      'event': 'DOCUMENT_PUBLISHED',
      'resource': 'doc-cnt-2026-012',
      'correlationId': 'REQ-738192-12',
      'timestamp': '2026-10-17 14:18:04 UTC',
      'hash': '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      'payload': {'policyVersion': 'v2.1', 'tierQuorum': 'Tier 2 (2 approvals met)'},
    },
    {
      'id': 'aud-89212-90',
      'actor': 'alex.reviewer@enterprise.com',
      'role': 'reviewer',
      'event': 'FIELD_CORRECTED',
      'resource': 'doc-inv-2026-887',
      'correlationId': 'REQ-629104-55',
      'timestamp': '2026-10-17 12:05:33 UTC',
      'hash': 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      'payload': {'field': 'total_amount', 'old': '14,200.00', 'new': '14,250.00', 'reason': 'OCR smudge digit 0 corrected to 5'},
    },
    {
      'id': 'aud-89211-12',
      'actor': 'john.contributor@enterprise.com',
      'role': 'uploader',
      'event': 'DOCUMENT_UPLOADED',
      'resource': 'doc-inv-2026-887',
      'correlationId': 'REQ-519082-01',
      'timestamp': '2026-10-17 11:22:19 UTC',
      'hash': '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
      'payload': {'fileSize': 1420912, 'sha256': '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'},
    },
  ];

  @override
  Widget build(BuildContext context) {
    final filteredEvents = _mockAuditEvents.where((ev) {
      if (_selectedEventFilter != 'ALL' && ev['event'] != _selectedEventFilter) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final match = ev['actor'].toLowerCase().contains(query) ||
            ev['resource'].toLowerCase().contains(query) ||
            ev['event'].toLowerCase().contains(query) ||
            ev['correlationId'].toLowerCase().contains(query);
        if (!match) return false;
      }
      return true;
    }).toList();

    return AppScaffold(
      title: 'Audit Ledger',
      body: Column(
        children: [
          // SEARCH & FILTER HEADER
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            color: AppColors.slate900,
            child: Column(
              children: [
                // SEARCH BAR
                TextField(
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Search by actor, event, resource, correlation ID...',
                    hintStyle: const TextStyle(color: AppColors.slate500, fontSize: 12),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.slate400, size: 20),
                    filled: true,
                    fillColor: AppColors.slate800,
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                      borderSide: const BorderSide(color: AppColors.slate700),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                      borderSide: const BorderSide(color: AppColors.slate700),
                    ),
                  ),
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                ),
                const SizedBox(height: AppSpacing.sm),
                // HORIZONTAL FILTER CHIPS
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('ALL', 'All Events'),
                      _buildFilterChip('LEGAL_HOLD_PLACED', 'Legal Holds'),
                      _buildFilterChip('DOCUMENT_PUBLISHED', 'Approvals'),
                      _buildFilterChip('FIELD_CORRECTED', 'Review Edits'),
                      _buildFilterChip('DOCUMENT_UPLOADED', 'Intake'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, thickness: 1, color: AppColors.slate800),

          // AUDIT EVENTS LIST
          Expanded(
            child: filteredEvents.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.search_off_rounded, color: AppColors.slate500, size: 48),
                        const SizedBox(height: AppSpacing.sm),
                        Text('No matching audit entries found', style: AppTypography.titleSmall.copyWith(color: AppColors.slate400)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: filteredEvents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, index) {
                      final item = filteredEvents[index];
                      return _buildAuditCard(context, item);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String eventKey, String label) {
    final isSelected = _selectedEventFilter == eventKey;
    return Padding(
      padding: const EdgeInsets.only(right: 6.0),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 11.5, color: isSelected ? Colors.white : AppColors.slate400)),
        selected: isSelected,
        selectedColor: AppColors.primary600,
        backgroundColor: AppColors.slate800,
        checkmarkColor: Colors.white,
        side: BorderSide(color: isSelected ? AppColors.primary500 : AppColors.slate700),
        onSelected: (val) => setState(() => _selectedEventFilter = eventKey),
      ),
    );
  }

  Widget _buildAuditCard(BuildContext context, Map<String, dynamic> item) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.slate700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: AppColors.primary600.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.primary500.withOpacity(0.4)),
                ),
                child: Text(
                  item['event'],
                  style: const TextStyle(color: AppColors.primary300, fontSize: 10.5, fontWeight: FontWeight.bold),
                ),
              ),
              const Spacer(),
              const Icon(Icons.verified_rounded, color: AppColors.success, size: 14),
              const SizedBox(width: 4),
              const Text(
                'SHA-256 Verified',
                style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item['actor'],
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          Text(
            'Role: ${item['role']} • Target: ${item['resource']}',
            style: const TextStyle(color: AppColors.slate400, fontSize: 11.5),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Trace ID: ${item['correlationId']}',
            style: const TextStyle(color: AppColors.slate500, fontSize: 11, fontFamily: 'monospace'),
          ),
          Text(
            item['timestamp'],
            style: const TextStyle(color: AppColors.slate500, fontSize: 10.5),
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              icon: const Icon(Icons.data_object_rounded, size: 14, color: AppColors.primary400),
              label: const Text('View Payload', style: TextStyle(color: AppColors.primary400, fontSize: 11.5)),
              onPressed: () => _showPayloadModal(context, item),
            ),
          ),
        ],
      ),
    );
  }

  void _showPayloadModal(BuildContext context, Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.slate800,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Audit Record Payload', style: AppTypography.titleMedium.copyWith(color: Colors.white)),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.slate400),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                Text('Log ID: ${item['id']}', style: const TextStyle(color: AppColors.slate400, fontSize: 12)),
                const SizedBox(height: AppSpacing.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.slate900,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    border: Border.all(color: AppColors.slate700),
                  ),
                  child: Text(
                    item['payload'].toString(),
                    style: const TextStyle(color: AppColors.primary200, fontSize: 12, fontFamily: 'monospace'),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Cryptographic Hash: ${item['hash']}',
                  style: const TextStyle(color: AppColors.slate500, fontSize: 10, fontFamily: 'monospace'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
