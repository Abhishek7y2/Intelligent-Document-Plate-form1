import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/approval_item.dart';
import '../bloc/approval_queue/approval_queue_bloc.dart';
import '../bloc/approval_queue/approval_queue_event.dart';
import '../bloc/approval_queue/approval_queue_state.dart';
import '../widgets/approval_tier_badge.dart';

class ApprovalsQueueScreen extends StatelessWidget {
  final ApprovalQueueBloc? bloc;

  const ApprovalsQueueScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<ApprovalQueueBloc>.value(
        value: bloc!,
        child: const _ApprovalsQueueView(),
      );
    }
    return BlocProvider<ApprovalQueueBloc>(
      create: (_) => sl<ApprovalQueueBloc>()..add(const FetchApprovalQueue()),
      child: const _ApprovalsQueueView(),
    );
  }
}

class _ApprovalsQueueView extends StatefulWidget {
  const _ApprovalsQueueView();

  @override
  State<_ApprovalsQueueView> createState() => _ApprovalsQueueViewState();
}

class _ApprovalsQueueViewState extends State<_ApprovalsQueueView> {
  ApprovalTier? _selectedTier;

  void _onTierChanged(ApprovalTier? tier) {
    setState(() {
      _selectedTier = tier;
    });
    context.read<ApprovalQueueBloc>().add(FilterApprovalQueueByTier(tier));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Approvals Center'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Queue',
            onPressed: () {
              context.read<ApprovalQueueBloc>().add(const RefreshApprovalQueue());
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips by Tier
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('All Tiers', null),
                const SizedBox(width: 8),
                _buildFilterChip('Tier 1 (<$10k)', ApprovalTier.tier1),
                const SizedBox(width: 8),
                _buildFilterChip('Tier 2 ($10k-$50k)', ApprovalTier.tier2),
                const SizedBox(width: 8),
                _buildFilterChip('Tier 3 (>$50k)', ApprovalTier.tier3),
              ],
            ),
          ),
          const Divider(height: 1),

          // Queue Content
          Expanded(
            child: BlocBuilder<ApprovalQueueBloc, ApprovalQueueState>(
              builder: (context, state) {
                if (state is ApprovalQueueLoading) {
                  return const Center(
                    child: CircularProgressIndicator(),
                  );
                }

                if (state is ApprovalQueueError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: Colors.red),
                          const SizedBox(height: 12),
                          Text(
                            state.message,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.refresh),
                            label: const Text('Retry'),
                            onPressed: () {
                              context.read<ApprovalQueueBloc>().add(const FetchApprovalQueue());
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                }

                if (state is ApprovalQueueLoaded) {
                  if (state.filteredItems.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.assignment_turned_in_outlined, size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            'No Pending Approvals',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[700],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'You have no documents awaiting sign-off.\nEnforcing strict Separation of Duties.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () async {
                      context.read<ApprovalQueueBloc>().add(const RefreshApprovalQueue());
                    },
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: state.filteredItems.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        return _buildApprovalCard(context, state.filteredItems[index]);
                      },
                    ),
                  );
                }

                return const SizedBox.shrink();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, ApprovalTier? value) {
    final isSelected = _selectedTier == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => _onTierChanged(value),
      selectedColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
      labelStyle: TextStyle(
        color: isSelected ? const Color(0xFF4F46E5) : Colors.grey[700],
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
    );
  }

  Widget _buildApprovalCard(BuildContext context, ApprovalQueueItem item) {
    final statusColor = item.status == ApprovalStatus.approved
        ? const Color(0xFF10B981)
        : (item.status == ApprovalStatus.rejected
            ? const Color(0xFFEF4444)
            : const Color(0xFFF59E0B));

    return InkWell(
      onTap: () {
        context.push('/approvals/${item.documentId}');
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[200]!),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.documentTitle,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                ApprovalTierBadge(tier: item.tier),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    item.documentType.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[700],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (item.amount != null)
                  Text(
                    '${item.currency}${item.amount!.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.black87,
                    ),
                  ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Stage ${item.currentStage}/${item.requiredApprovals}',
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Submitted by: ${item.submittedBy}',
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                ),
                Row(
                  children: [
                    Text(
                      'Sign Off',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                    Icon(
                      Icons.chevron_right,
                      size: 16,
                      color: Theme.of(context).primaryColor,
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
