import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/empty_state_view.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/document.dart';
import '../bloc/document_catalog_bloc.dart';
import '../bloc/document_catalog_event.dart';
import '../bloc/document_catalog_state.dart';

class DocumentCatalogScreen extends StatelessWidget {
  final DocumentCatalogBloc? bloc;

  const DocumentCatalogScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<DocumentCatalogBloc>.value(
        value: bloc!,
        child: const _DocumentCatalogView(),
      );
    }
    return BlocProvider<DocumentCatalogBloc>(
      create: (_) => sl<DocumentCatalogBloc>()..add(const DocumentsFetchRequested()),
      child: const _DocumentCatalogView(),
    );
  }
}

class _DocumentCatalogView extends StatefulWidget {
  const _DocumentCatalogView();

  @override
  State<_DocumentCatalogView> createState() => _DocumentCatalogViewState();
}

class _DocumentCatalogViewState extends State<_DocumentCatalogView> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();

  static const List<String> _statusFilters = [
    'ALL',
    'NEEDS_REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'PROCESSING',
    'QUARANTINED',
  ];

  static const List<String> _docTypeFilters = [
    'ALL',
    'INVOICE',
    'RECEIPT',
    'CONTRACT',
    'TAX_FORM',
  ];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isNearBottom) {
      context.read<DocumentCatalogBloc>().add(const DocumentsNextPageRequested());
    }
  }

  bool get _isNearBottom {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    return currentScroll >= (maxScroll * 0.9);
  }

  void _onSearchChanged(String query, DocumentFilter currentFilter) {
    context.read<DocumentCatalogBloc>().add(
          DocumentFilterChanged(currentFilter.copyWith(query: query)),
        );
  }

  void _onStatusSelected(String status, DocumentFilter currentFilter) {
    final newStatus = status == 'ALL' ? null : status;
    context.read<DocumentCatalogBloc>().add(
          DocumentFilterChanged(
            currentFilter.copyWith(status: newStatus, clearStatus: status == 'ALL'),
          ),
        );
  }

  void _onDocTypeSelected(String docType, DocumentFilter currentFilter) {
    final newDocType = docType == 'ALL' ? null : docType;
    context.read<DocumentCatalogBloc>().add(
          DocumentFilterChanged(
            currentFilter.copyWith(docType: newDocType, clearDocType: docType == 'ALL'),
          ),
        );
  }

  void _onSortChanged(String sortBy, DocumentFilter currentFilter) {
    context.read<DocumentCatalogBloc>().add(
          DocumentFilterChanged(currentFilter.copyWith(sortBy: sortBy)),
        );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppScaffold(
      title: 'Document Catalog',
      body: BlocBuilder<DocumentCatalogBloc, DocumentCatalogState>(
        builder: (context, state) {
          if (state is DocumentCatalogLoading || state is DocumentCatalogInitial) {
            return const Center(
              child: AppLoadingIndicator(message: 'Loading document catalog...'),
            );
          }

          if (state is DocumentCatalogError) {
            return Center(
              child: ErrorView(
                title: 'Unable to load documents',
                message: state.message,
                correlationId: state.correlationId,
                onRetry: () => context
                    .read<DocumentCatalogBloc>()
                    .add(const DocumentsRefreshRequested()),
              ),
            );
          }

          final loaded = state as DocumentCatalogLoaded;
          final documents = loaded.documents;
          final filter = loaded.filter;

          return Column(
            children: [
              // Search & Filters Header
              _buildFilterHeader(context, filter),

              // Document List View
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    context
                        .read<DocumentCatalogBloc>()
                        .add(const DocumentsRefreshRequested());
                  },
                  child: documents.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            EmptyStateView(
                              title: 'No Documents Found',
                              message: filter.query.isNotEmpty ||
                                      filter.status != null ||
                                      filter.docType != null
                                  ? 'No documents match the current filter criteria.'
                                  : 'No documents ingested into this tenant yet.',
                              actionLabel: 'Reset Filters',
                              onAction: () {
                                _searchController.clear();
                                context.read<DocumentCatalogBloc>().add(
                                      const DocumentFilterChanged(DocumentFilter()),
                                    );
                              },
                            ),
                          ],
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm,
                          ),
                          itemCount: documents.length + (loaded.isLoadingMore ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index >= documents.length) {
                              return const Padding(
                                padding: EdgeInsets.all(AppSpacing.md),
                                child: Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                ),
                              );
                            }

                            final document = documents[index];
                            return _buildDocumentCard(context, document);
                          },
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFilterHeader(BuildContext context, DocumentFilter currentFilter) {
    return Container(
      color: AppColors.slate900,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          // Search & Sort Row
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => _onSearchChanged(val, currentFilter),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search by title, ID, type...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                _onSearchChanged('', currentFilter);
                              },
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              PopupMenuButton<String>(
                icon: const Icon(Icons.sort_rounded, color: AppColors.primary400),
                tooltip: 'Sort Documents',
                onSelected: (val) => _onSortChanged(val, currentFilter),
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'date_desc',
                    child: Text('Newest Upload First'),
                  ),
                  const PopupMenuItem(
                    value: 'date_asc',
                    child: Text('Oldest Upload First'),
                  ),
                  const PopupMenuItem(
                    value: 'confidence_desc',
                    child: Text('Highest Confidence First'),
                  ),
                  const PopupMenuItem(
                    value: 'name_asc',
                    child: Text('Name (A-Z)'),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),

          // Horizontal Status Filter Chips
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _statusFilters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final status = _statusFilters[index];
                final isSelected = (status == 'ALL' && currentFilter.status == null) ||
                    (currentFilter.status?.toUpperCase() == status);

                return ChoiceChip(
                  label: Text(
                    status.replaceAll('_', ' '),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.slate400,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: AppColors.primary600,
                  backgroundColor: AppColors.slate800,
                  onSelected: (_) => _onStatusSelected(status, currentFilter),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
        ],
      ),
    );
  }

  Widget _buildDocumentCard(BuildContext context, DocumentItem document) {
    Color statusColor = AppColors.slate400;
    Color statusBg = AppColors.slate800;

    switch (document.status.toUpperCase()) {
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

    final formattedDate = DateFormat('MMM d, y • HH:mm').format(document.uploadedAt);
    final confPercent = (document.confidence * 100).toStringAsFixed(0);

    return Card(
      color: AppColors.slate900,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.slate800),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () {
          context.push('/documents/${document.id}');
        },
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Type & Status Badges
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.slate800,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      document.docType.replaceAll('_', ' '),
                      style: const TextStyle(
                        color: AppColors.primary400,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusBg,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: statusColor.withOpacity(0.3)),
                    ),
                    child: Text(
                      document.status.replaceAll('_', ' '),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),

              // Title
              Text(
                document.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),

              // ID
              Text(
                document.id,
                style: const TextStyle(
                  color: AppColors.slate500,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),

              // Bottom Info Row
              Row(
                children: [
                  const Icon(Icons.description_outlined,
                      size: 14, color: AppColors.slate400),
                  const SizedBox(width: 4),
                  Text(
                    '${document.pages}p • ${document.size}',
                    style: const TextStyle(color: AppColors.slate400, fontSize: 12),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  const Icon(Icons.verified_outlined,
                      size: 14, color: AppColors.emerald400),
                  const SizedBox(width: 4),
                  Text(
                    '$confPercent%',
                    style: const TextStyle(
                        color: AppColors.emerald300,
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                  const Spacer(),
                  Text(
                    formattedDate,
                    style: const TextStyle(color: AppColors.slate500, fontSize: 11),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right_rounded,
                      size: 16, color: AppColors.slate500),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
