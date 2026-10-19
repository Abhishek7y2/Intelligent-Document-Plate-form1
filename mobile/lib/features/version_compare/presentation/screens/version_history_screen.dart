import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../domain/entities/document_version.dart';
import '../bloc/version_compare_bloc.dart';
import '../bloc/version_compare_event.dart';
import '../bloc/version_compare_state.dart';

class VersionHistoryScreen extends StatelessWidget {
  final String documentId;
  final VersionCompareBloc? bloc;

  const VersionHistoryScreen({
    super.key,
    required this.documentId,
    this.bloc,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<VersionCompareBloc>.value(
        value: bloc!,
        child: _VersionHistoryView(documentId: documentId),
      );
    }
    return BlocProvider<VersionCompareBloc>(
      create: (_) => sl<VersionCompareBloc>()..add(LoadDocumentVersions(documentId)),
      child: _VersionHistoryView(documentId: documentId),
    );
  }
}

class _VersionHistoryView extends StatefulWidget {
  final String documentId;

  const _VersionHistoryView({required this.documentId});

  @override
  State<_VersionHistoryView> createState() => _VersionHistoryViewState();
}

class _VersionHistoryViewState extends State<_VersionHistoryView> {
  final Set<String> _selectedVersions = {};

  void _toggleVersion(String versionId) {
    setState(() {
      if (_selectedVersions.contains(versionId)) {
        _selectedVersions.remove(versionId);
      } else {
        if (_selectedVersions.length >= 2) {
          _selectedVersions.clear();
        }
        _selectedVersions.add(versionId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Version History'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              context.read<VersionCompareBloc>().add(LoadDocumentVersions(widget.documentId));
            },
          ),
        ],
      ),
      body: BlocBuilder<VersionCompareBloc, VersionCompareState>(
        builder: (context, state) {
          if (state is VersionCompareLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is VersionCompareError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(state.message, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        context.read<VersionCompareBloc>().add(LoadDocumentVersions(widget.documentId));
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is DocumentVersionsLoaded) {
            if (state.versions.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.history_toggle_off_rounded, size: 64, color: Colors.grey[400]),
                    const SizedBox(height: 16),
                    Text(
                      'No Previous Versions',
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'This document is at initial revision (v1.0).',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              );
            }

            return Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  color: const Color(0xFFF1F5F9),
                  child: Row(
                    children: [
                      const Icon(Icons.compare_arrows_rounded, size: 20, color: Color(0xFF475569)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _selectedVersions.length == 2
                              ? '2 versions selected. Ready for comparison.'
                              : 'Select 2 versions below to run side-by-side comparison.',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: state.versions.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final v = state.versions[index];
                      final isSelected = _selectedVersions.contains(v.id);

                      return InkWell(
                        onTap: () => _toggleVersion(v.id),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF6366F1) : Colors.grey[200]!,
                              width: isSelected ? 1.8 : 1.0,
                            ),
                          ),
                          child: Row(
                            children: [
                              Checkbox(
                                value: isSelected,
                                onChanged: (_) => _toggleVersion(v.id),
                                activeColor: const Color(0xFF4F46E5),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          v.versionLabel,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                        ),
                                        const SizedBox(width: 8),
                                        if (v.isCurrent)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFDCFCE7),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text(
                                              'CURRENT',
                                              style: TextStyle(
                                                color: Color(0xFF166534),
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Hash: ${v.sha256Hash.substring(0, 16)}...',
                                      style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                    ),
                                    Text(
                                      'Created: ${v.createdAt.toIso8601String().split('T').first}${v.createdBy != null ? ' by ${v.createdBy}' : ''}',
                                      style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (_selectedVersions.length == 2)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 8,
                          offset: const Offset(0, -3),
                        ),
                      ],
                    ),
                    child: SafeArea(
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.compare_arrows_rounded),
                          label: const Text('Compare Selected Versions'),
                          onPressed: () {
                            final list = _selectedVersions.toList();
                            context.push('/compare?doc1=${list[0]}&doc2=${list[1]}');
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4F46E5),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
