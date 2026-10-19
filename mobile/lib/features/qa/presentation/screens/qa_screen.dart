import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_loading_indicator.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../domain/entities/qa_entity.dart';
import '../bloc/qa_bloc.dart';
import '../bloc/qa_event.dart';
import '../bloc/qa_state.dart';
import '../widgets/citation_card.dart';

class QaScreen extends StatelessWidget {
  final QaBloc? bloc;
  final String? initialDocumentId;
  final String? initialDocumentTitle;

  const QaScreen({
    super.key,
    this.bloc,
    this.initialDocumentId,
    this.initialDocumentTitle,
  });

  @override
  Widget build(BuildContext context) {
    if (bloc != null) {
      return BlocProvider<QaBloc>.value(
        value: bloc!,
        child: const _QaView(),
      );
    }
    return BlocProvider<QaBloc>(
      create: (_) {
        final b = sl<QaBloc>()..add(const QaLoadAvailableDocuments());
        if (initialDocumentId != null) {
          b.add(QaSelectDocumentScope(
            documentId: initialDocumentId,
            documentTitle: initialDocumentTitle,
          ));
        }
        return b;
      },
      child: const _QaView(),
    );
  }
}

class _QaView extends StatefulWidget {
  const _QaView();

  @override
  State<_QaView> createState() => _QaViewState();
}

class _QaViewState extends State<_QaView> {
  final TextEditingController _questionController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _questionController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submitQuestion(BuildContext context) {
    final text = _questionController.text.trim();
    if (text.length >= 3) {
      context.read<QaBloc>().add(QaAskQuestion(text));
      _questionController.clear();
      _scrollToBottom();
    }
  }

  void _showDocumentScopePicker(BuildContext context, QaState state) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.slate900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bottomSheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Select Q&A Document Focus',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.slate400),
                      onPressed: () => Navigator.pop(bottomSheetContext),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                ListTile(
                  leading: const Icon(Icons.all_inclusive, color: AppColors.primary400),
                  title: const Text('All Tenant Documents', style: TextStyle(color: Colors.white)),
                  subtitle: const Text('Query across all processed files', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                  selected: state.selectedDocumentId == null,
                  onTap: () {
                    context.read<QaBloc>().add(const QaSelectDocumentScope(documentId: null));
                    Navigator.pop(bottomSheetContext);
                  },
                ),
                const Divider(color: AppColors.slate700),
                Expanded(
                  child: ListView.builder(
                    itemCount: state.availableDocuments.length,
                    itemBuilder: (context, index) {
                      final doc = state.availableDocuments[index];
                      final isSelected = state.selectedDocumentId == doc.documentId;
                      return ListTile(
                        leading: const Icon(Icons.description, color: AppColors.slate300),
                        title: Text(doc.title, style: const TextStyle(color: Colors.white, fontSize: 14)),
                        subtitle: Text('${doc.documentType} · ${doc.version}', style: const TextStyle(color: AppColors.slate400, fontSize: 12)),
                        selected: isSelected,
                        trailing: isSelected ? const Icon(Icons.check, color: AppColors.primary400) : null,
                        onTap: () {
                          context.read<QaBloc>().add(QaSelectDocumentScope(
                            documentId: doc.documentId,
                            documentTitle: doc.title,
                          ));
                          Navigator.pop(bottomSheetContext);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<QaBloc, QaState>(
      listener: (context, state) {
        if (state.lastVerifiedCitation != null) {
          final cert = state.lastVerifiedCitation!;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: cert.isAuthorized ? AppColors.success600 : AppColors.error600,
              content: Text(
                cert.isAuthorized
                    ? 'Citation Verified: Authorized access to ${cert.documentTitle ?? cert.documentId} (p. ${cert.pageNumber})'
                    : 'Access Denied: ${cert.reason ?? "User not permitted to view this source document"}',
              ),
              duration: const Duration(seconds: 4),
            ),
          );
        }
        _scrollToBottom();
      },
      builder: (context, state) {
        return AppScaffold(
          title: 'Grounded Document Q&A',
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh, color: AppColors.slate300),
              tooltip: 'Reset Conversation',
              onPressed: () {
                context.read<QaBloc>().add(const QaClearConversation());
              },
            ),
          ],
          body: Column(
            children: [
              // Document Focus Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                color: AppColors.slate800,
                child: Row(
                  children: [
                    const Icon(Icons.filter_alt_outlined, size: 16, color: AppColors.primary400),
                    const SizedBox(width: AppSpacing.xs),
                    const Text('Scope: ', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _showDocumentScopePicker(context, state),
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                state.selectedDocumentTitle ?? 'All Tenant Documents',
                                style: const TextStyle(
                                  color: AppColors.primary400,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Icon(Icons.arrow_drop_down, color: AppColors.primary400, size: 18),
                          ],
                        ),
                      ),
                    ),
                    if (state.selectedDocumentId != null)
                      GestureDetector(
                        onTap: () => context.read<QaBloc>().add(const QaSelectDocumentScope(documentId: null)),
                        child: const Icon(Icons.clear, size: 14, color: AppColors.slate400),
                      ),
                  ],
                ),
              ),

              // Conversation Area
              Expanded(
                child: state.conversation.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                decoration: BoxDecoration(
                                  color: AppColors.slate800,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.psychology_outlined, size: 48, color: AppColors.primary400),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              const Text(
                                'Enterprise Evidence-Grounded Q&A',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              const Text(
                                'Ask questions grounded in indexed documents with page-level citations. Ungrounded hallucinations are strictly prevented.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: AppColors.slate400),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: state.conversation.length,
                        itemBuilder: (context, index) {
                          final turn = state.conversation[index];
                          return _ConversationTurnWidget(
                            turn: turn,
                            isVerifyingCitation: state.isVerifyingCitation,
                            onVerifyCitation: (citation) {
                              context.read<QaBloc>().add(QaVerifyCitation(
                                documentId: citation.documentId,
                                citationId: citation.citationId,
                              ));
                            },
                            onFeedback: (feedback) {
                              if (turn.answer?.traceId != null) {
                                context.read<QaBloc>().add(QaSubmitFeedbackEvent(
                                  traceId: turn.answer!.traceId,
                                  feedback: feedback,
                                ));
                              }
                            },
                          );
                        },
                      ),
              ),

              // Bottom Input Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                decoration: const BoxDecoration(
                  color: AppColors.slate800,
                  border: Border(top: BorderSide(color: AppColors.slate700)),
                ),
                child: SafeArea(
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _questionController,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _submitQuestion(context),
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: const InputDecoration(
                            hintText: 'Ask a grounded question...',
                            hintStyle: TextStyle(color: AppColors.slate500, fontSize: 13),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
                          ),
                        ),
                      ),
                      IconButton(
                        icon: state.isAskingQuestion
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary400),
                              )
                            : const Icon(Icons.send_rounded, color: AppColors.primary500),
                        onPressed: state.isAskingQuestion ? null : () => _submitQuestion(context),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ConversationTurnWidget extends StatelessWidget {
  final QaConversationTurn turn;
  final bool isVerifyingCitation;
  final void Function(QaCitation) onVerifyCitation;
  final void Function(String) onFeedback;

  const _ConversationTurnWidget({
    required this.turn,
    required this.isVerifyingCitation,
    required this.onVerifyCitation,
    required this.onFeedback,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // User Question Bubble
        Align(
          alignment: Alignment.centerRight,
          child: Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm, left: 40),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.primary600,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              turn.question,
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
          ),
        ),

        // Assistant Answer Box
        if (turn.isLoading)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.md, right: 40),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.slate800,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.slate700),
            ),
            child: const Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary400),
                ),
                SizedBox(width: AppSpacing.sm),
                Text(
                  'Synthesizing grounded response...',
                  style: TextStyle(color: AppColors.slate300, fontSize: 12),
                ),
              ],
            ),
          )
        else if (turn.errorMessage != null)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.md, right: 40),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.error900.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.error700),
            ),
            child: Text(
              'Error: ${turn.errorMessage}',
              style: const TextStyle(color: AppColors.error300, fontSize: 12),
            ),
          )
        else if (turn.answer != null)
          _AnswerCard(
            answer: turn.answer!,
            feedbackGiven: turn.feedbackGiven,
            isVerifyingCitation: isVerifyingCitation,
            onVerifyCitation: onVerifyCitation,
            onFeedback: onFeedback,
          ),
      ],
    );
  }
}

class _AnswerCard extends StatelessWidget {
  final QaAnswerResult answer;
  final String? feedbackGiven;
  final bool isVerifyingCitation;
  final void Function(QaCitation) onVerifyCitation;
  final void Function(String) onFeedback;

  const _AnswerCard({
    required this.answer,
    required this.feedbackGiven,
    required this.isVerifyingCitation,
    required this.onVerifyCitation,
    required this.onFeedback,
  });

  @override
  Widget build(BuildContext context) {
    final isUngrounded = answer.status == QaStatus.insufficientEvidence ||
        answer.status == QaStatus.abstained ||
        answer.status == QaStatus.securityBlocked;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md, right: 20),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.slate800,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUngrounded ? AppColors.warning500 : AppColors.slate700,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Status + Confidence + Latency
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    isUngrounded ? Icons.info_outline : Icons.verified,
                    size: 16,
                    color: isUngrounded ? AppColors.warning500 : AppColors.success500,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    answer.status.displayName,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: isUngrounded ? AppColors.warning500 : AppColors.success500,
                    ),
                  ),
                ],
              ),
              Text(
                '${(answer.confidence * 100).toStringAsFixed(0)}% Grounded · ${answer.durationMs}ms',
                style: const TextStyle(fontSize: 10, color: AppColors.slate400),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),

          // Abstention notice banner if ungrounded
          if (answer.abstentionReason != null) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.xs),
              decoration: BoxDecoration(
                color: AppColors.warning900.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.warning700),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shield_outlined, size: 14, color: AppColors.warning400),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      'Notice: ${answer.abstentionReason}',
                      style: const TextStyle(fontSize: 11, color: AppColors.warning300),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],

          // Answer Text
          SelectableText(
            answer.answer,
            style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: AppSpacing.sm),

          // Citations List
          if (answer.citations.isNotEmpty) ...[
            const Divider(color: AppColors.slate700),
            Row(
              children: [
                const Icon(Icons.format_quote, size: 14, color: AppColors.primary400),
                const SizedBox(width: 4),
                Text(
                  'Source Evidence (${answer.citations.length} cited)',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.slate300,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            ...answer.citations.map((c) => CitationCard(
                  citation: c,
                  onVerify: () => onVerifyCitation(c),
                  isVerifying: isVerifyingCitation,
                )),
          ],

          // Footer: Trace ID + Feedback buttons
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Model: ${answer.modelName}',
                style: const TextStyle(fontSize: 10, color: AppColors.slate500),
              ),
              Row(
                children: [
                  IconButton(
                    icon: Icon(
                      Icons.thumb_up_alt_outlined,
                      size: 16,
                      color: feedbackGiven == 'HELPFUL' ? AppColors.success500 : AppColors.slate400,
                    ),
                    onPressed: () => onFeedback('HELPFUL'),
                    tooltip: 'Helpful',
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.thumb_down_alt_outlined,
                      size: 16,
                      color: feedbackGiven == 'NOT_HELPFUL' ? AppColors.error500 : AppColors.slate400,
                    ),
                    onPressed: () => onFeedback('NOT_HELPFUL'),
                    tooltip: 'Not Helpful',
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.flag_outlined,
                      size: 16,
                      color: feedbackGiven == 'FLAGGED' ? AppColors.warning500 : AppColors.slate400,
                    ),
                    onPressed: () => onFeedback('FLAGGED'),
                    tooltip: 'Flag Issue',
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
