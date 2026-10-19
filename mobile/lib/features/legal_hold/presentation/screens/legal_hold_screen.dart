import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/legal_hold_item.dart';
import '../bloc/legal_hold_bloc.dart';
import '../bloc/legal_hold_event.dart';
import '../bloc/legal_hold_state.dart';

class LegalHoldScreen extends StatelessWidget {
  final LegalHoldBloc? bloc;

  const LegalHoldScreen({super.key, this.bloc});

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<LegalHoldBloc>.value(
        value: bloc!,
        child: const _LegalHoldView(),
      );
    }
    return BlocProvider<LegalHoldBloc>(
      create: (_) => sl<LegalHoldBloc>()..add(const LegalHoldFetchRequested()),
      child: const _LegalHoldView(),
    );
  }
}

class _LegalHoldView extends StatefulWidget {
  const _LegalHoldView();

  @override
  State<_LegalHoldView> createState() => _LegalHoldViewState();
}

class _LegalHoldViewState extends State<_LegalHoldView> {
  bool _showActiveOnly = true;

  void _showPlaceHoldDialog(BuildContext context) {
    final matterNameController = TextEditingController();
    final matterNumberController = TextEditingController();
    final reasonController = TextEditingController();
    final docsController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.slate900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: AppSpacing.md,
            bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Place Emergency Legal Hold',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.slate400),
                      onPressed: () => Navigator.pop(sheetContext),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: AppColors.error900.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.error700),
                  ),
                  child: const Text(
                    'IMPORTANT: Placing an active legal hold freezes document deletion and overrides standard retention purge policies.',
                    style: TextStyle(fontSize: 11, color: AppColors.error300),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: matterNameController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Matter Name *',
                    labelStyle: const TextStyle(color: AppColors.slate400),
                    filled: true,
                    fillColor: AppColors.slate800,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: matterNumberController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Matter Number / Case ID *',
                    labelStyle: const TextStyle(color: AppColors.slate400),
                    filled: true,
                    fillColor: AppColors.slate800,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: reasonController,
                  maxLines: 2,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Mandatory Legal Justification *',
                    labelStyle: const TextStyle(color: AppColors.slate400),
                    filled: true,
                    fillColor: AppColors.slate800,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: docsController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Scope Document IDs (comma-separated)',
                    labelStyle: const TextStyle(color: AppColors.slate400),
                    filled: true,
                    fillColor: AppColors.slate800,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppButton(
                  label: 'Confirm & Place Legal Hold',
                  variant: AppButtonVariant.primary,
                  onPressed: () {
                    final matterName = matterNameController.text.trim();
                    final matterNumber = matterNumberController.text.trim();
                    final reason = reasonController.text.trim();
                    final docsRaw = docsController.text.trim();

                    if (matterName.isNotEmpty && matterNumber.isNotEmpty && reason.isNotEmpty) {
                      final docIds = docsRaw.isNotEmpty
                          ? docsRaw.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList()
                          : <String>[];

                      context.read<LegalHoldBloc>().add(LegalHoldPlaceRequested(
                            matterName: matterName,
                            matterNumber: matterNumber,
                            reason: reason,
                            scopeDocumentIds: docIds,
                          ));
                      Navigator.pop(sheetContext);
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showReleaseHoldDialog(BuildContext context, LegalHoldItem hold) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.slate900,
          title: Text(
            'Release Legal Hold ${hold.id}',
            style: const TextStyle(color: Colors.white, fontSize: 15),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                "Are you sure you want to lift the legal hold on '${hold.matterName}'? Normal retention schedules and purge eligibility will resume.",
                style: const TextStyle(color: AppColors.slate300, fontSize: 12),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: reasonController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Mandatory Release Justification *',
                  labelStyle: const TextStyle(color: AppColors.slate400),
                  filled: true,
                  fillColor: AppColors.slate800,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: AppColors.slate400)),
            ),
            ElevatedButton(
              onPressed: () {
                final reason = reasonController.text.trim();
                if (reason.isNotEmpty) {
                  context.read<LegalHoldBloc>().add(LegalHoldReleaseRequested(
                        holdId: hold.id,
                        releaseReason: reason,
                      ));
                  Navigator.pop(dialogContext);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error700),
              child: const Text('Confirm Release', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<LegalHoldBloc, LegalHoldState>(
      listener: (context, state) {
        if (state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: AppColors.success600,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      },
      builder: (context, state) {
        return AppScaffold(
          title: 'Emergency Legal Hold',
          floatingActionButton: state.isPermissionDenied
              ? null
              : FloatingActionButton(
                  onPressed: () => _showPlaceHoldDialog(context),
                  backgroundColor: AppColors.error700,
                  foregroundColor: Colors.white,
                  tooltip: 'Place Legal Hold',
                  child: const Icon(Icons.gavel_rounded),
                ),
          body: Column(
            children: [
              // Filter bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    FilterChip(
                      label: const Text('Active Holds'),
                      selected: _showActiveOnly,
                      onSelected: (val) => setState(() => _showActiveOnly = true),
                      selectedColor: AppColors.error700,
                      labelStyle: TextStyle(
                        color: _showActiveOnly ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    FilterChip(
                      label: const Text('All / Released'),
                      selected: !_showActiveOnly,
                      onSelected: (val) => setState(() => _showActiveOnly = false),
                      selectedColor: AppColors.primary600,
                      labelStyle: TextStyle(
                        color: !_showActiveOnly ? Colors.white : AppColors.slate300,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.slate800,
                    ),
                  ],
                ),
              ),
              const Divider(color: AppColors.slate800, height: 1),

              // Content Area
              Expanded(
                child: _buildBody(context, state),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, LegalHoldState state) {
    if (state.isLoading && state.holds.isEmpty) {
      return const Center(child: AppLoadingIndicator(message: 'Loading legal holds...'));
    }

    if (state.isPermissionDenied) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_person_outlined, size: 48, color: AppColors.warning500),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Permission Denied',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                state.permissionDeniedMessage ?? 'Emergency legal hold management requires the ADMIN_ACCESS permission.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.holds.isEmpty) {
      return Center(
        child: ErrorView(
          title: 'Unable to load legal holds',
          message: state.errorMessage!,
          onRetry: () => context.read<LegalHoldBloc>().add(const LegalHoldFetchRequested()),
        ),
      );
    }

    final filteredHolds = _showActiveOnly
        ? state.holds.where((h) => h.isActive).toList()
        : state.holds;

    if (filteredHolds.isEmpty) {
      return RefreshIndicator(
        onRefresh: () async {
          context.read<LegalHoldBloc>().add(const LegalHoldFetchRequested());
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(color: AppColors.slate800, shape: BoxShape.circle),
                    child: const Icon(Icons.gavel_outlined, size: 40, color: AppColors.slate500),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _showActiveOnly ? 'No Active Legal Holds' : 'No Legal Holds Found',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text('Place a legal hold using the gavel button below.', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        context.read<LegalHoldBloc>().add(const LegalHoldFetchRequested());
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: filteredHolds.length,
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final hold = filteredHolds[index];
          final isActive = hold.isActive;

          return Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate800,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isActive ? AppColors.error700 : AppColors.slate700,
                width: isActive ? 1.5 : 1.0,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Matter Number + Status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'CASE: ${hold.matterNumber}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary400),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: (isActive ? AppColors.error900 : AppColors.slate700).withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: isActive ? AppColors.error500 : AppColors.slate600),
                      ),
                      child: Text(
                        hold.status.displayName,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isActive ? AppColors.error400 : AppColors.slate300,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Matter Name
                Text(
                  hold.matterName,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 4),

                // Justification
                Text(
                  'Reason: ${hold.reason}',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate300),
                ),
                const SizedBox(height: AppSpacing.xs),

                // Scope Documents
                if (hold.scopeDocumentIds.isNotEmpty) ...[
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: hold.scopeDocumentIds.map((docId) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.slate700,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          docId,
                          style: const TextStyle(fontSize: 10, color: AppColors.slate300),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                ],

                // Footer metadata & Release action
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Placed by ${hold.placedBy} · ${hold.placedAt.day}/${hold.placedAt.month}/${hold.placedAt.year}',
                      style: const TextStyle(fontSize: 10, color: AppColors.slate500),
                    ),
                    if (isActive)
                      TextButton.icon(
                        icon: const Icon(Icons.lock_open_rounded, size: 14),
                        label: const Text('Release Hold', style: TextStyle(fontSize: 11)),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.error400,
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: state.isSubmitting ? null : () => _showReleaseHoldDialog(context, hold),
                      ),
                  ],
                ),

                if (!isActive && hold.releaseReason != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Release Justification: ${hold.releaseReason}',
                    style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.slate400),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
