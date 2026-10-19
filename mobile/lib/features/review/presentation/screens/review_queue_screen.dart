import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/review_task.dart';
import '../bloc/review_queue/review_queue_bloc.dart';
import '../bloc/review_queue/review_queue_event.dart';
import '../bloc/review_queue/review_queue_state.dart';

class ReviewQueueScreen extends StatelessWidget {
  final ReviewQueueBloc? bloc;

  const ReviewQueueScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<ReviewQueueBloc>.value(
        value: bloc!,
        child: const _ReviewQueueView(),
      );
    }
    return BlocProvider<ReviewQueueBloc>(
      create: (_) => sl<ReviewQueueBloc>()..add(const FetchReviewQueue()),
      child: const _ReviewQueueView(),
    );
  }
}

class _ReviewQueueView extends StatefulWidget {
  const _ReviewQueueView();

  @override
  State<_ReviewQueueView> createState() => _ReviewQueueViewState();
}

class _ReviewQueueViewState extends State<_ReviewQueueView> {
  String? _selectedPriority;

  void _onPriorityChanged(String? priority) {
    setState(() {
      _selectedPriority = priority;
    });
    context.read<ReviewQueueBloc>().add(FilterReviewQueueByPriority(priority));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Human Review Queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Queue',
            onPressed: () {
              context.read<ReviewQueueBloc>().add(const RefreshReviewQueue());
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('All Priorities', null),
                const SizedBox(width: 8),
                _buildFilterChip('High Priority', 'high'),
                const SizedBox(width: 8),
                _buildFilterChip('Medium', 'medium'),
                const SizedBox(width: 8),
                _buildFilterChip('Low', 'low'),
              ],
            ),
          ),
          const Divider(height: 1),

          // Queue Content
          Expanded(
            child: BlocBuilder<ReviewQueueBloc, ReviewQueueState>(
              builder: (context, state) {
                if (state is ReviewQueueLoading) {
                  return const Center(
                    child: CircularProgressIndicator(),
                  );
                }

                if (state is ReviewQueueError) {
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
                              context.read<ReviewQueueBloc>().add(
                                    FetchReviewQueue(priority: _selectedPriority),
                                  );
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                }

                if (state is ReviewQueueLoaded) {
                  if (state.tasks.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            'Queue is Clear',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[700],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'No documents currently require manual review.',
                            style: TextStyle(color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () async {
                      context.read<ReviewQueueBloc>().add(const RefreshReviewQueue());
                    },
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: state.tasks.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        return _buildTaskCard(context, state.tasks[index]);
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

  Widget _buildFilterChip(String label, String? value) {
    final isSelected = _selectedPriority == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => _onPriorityChanged(value),
      selectedColor: const Color(0xFF6366F1).withValues(alpha: 0.15),
      labelStyle: TextStyle(
        color: isSelected ? const Color(0xFF4F46E5) : Colors.grey[700],
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
    );
  }

  Widget _buildTaskCard(BuildContext context, ReviewTaskItem task) {
    final priorityColor = _getPriorityColor(task.priority);
    final confidenceColor = _getConfidenceColor(task.confidence);

    return InkWell(
      onTap: () {
        context.push('/review/${task.docId}');
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
                    task.documentTitle,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: priorityColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    task.priority.toUpperCase(),
                    style: TextStyle(
                      color: priorityColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
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
                    task.type.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[700],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${task.pages} ${task.pages == 1 ? 'page' : 'pages'}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                const Spacer(),
                Icon(Icons.av_timer, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  '${task.slaHoursLeft}h SLA',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: task.slaHoursLeft <= 4 ? Colors.red : Colors.grey[700],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      'Confidence: ',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    Text(
                      '${(task.confidence * 100).toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: confidenceColor,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Text(
                      'Review',
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

  Color _getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'high':
        return const Color(0xFFEF4444);
      case 'medium':
        return const Color(0xFFF59E0B);
      case 'low':
      default:
        return const Color(0xFF10B981);
    }
  }

  Color _getConfidenceColor(double confidence) {
    if (confidence >= 0.85) return const Color(0xFF10B981);
    if (confidence >= 0.70) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }
}
