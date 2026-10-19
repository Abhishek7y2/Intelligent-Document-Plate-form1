import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/datasources/approval_exceptions.dart';
import '../../../domain/entities/erp_publication.dart';
import '../../../domain/repositories/approval_repository.dart';
import 'approval_detail_event.dart';
import 'approval_detail_state.dart';

class ApprovalDetailBloc extends Bloc<ApprovalDetailEvent, ApprovalDetailState> {
  final ApprovalRepository repository;

  ApprovalDetailBloc({required this.repository}) : super(ApprovalDetailInitial()) {
    on<LoadApprovalDetail>(_onLoadApprovalDetail);
    on<SubmitApprovalDecisionEvent>(_onSubmitApprovalDecision);
    on<PublishDocumentToErpEvent>(_onPublishDocumentToErp);
    on<RefreshErpPublicationStatus>(_onRefreshErpPublicationStatus);
  }

  Future<void> _onLoadApprovalDetail(
    LoadApprovalDetail event,
    Emitter<ApprovalDetailState> emit,
  ) async {
    emit(ApprovalDetailLoading());
    try {
      final request = await repository.getApprovalDetails(event.documentId);
      ErpPublicationRecord? erpRecord;

      try {
        erpRecord = await repository.getErpPublicationStatus(event.documentId);
      } catch (_) {
        // ERP record failure is non-blocking
      }

      emit(ApprovalDetailLoaded(
        request: request,
        erpRecord: erpRecord,
      ));
    } catch (e) {
      emit(ApprovalDetailError(e.toString()));
    }
  }

  Future<void> _onSubmitApprovalDecision(
    SubmitApprovalDecisionEvent event,
    Emitter<ApprovalDetailState> emit,
  ) async {
    if (state is! ApprovalDetailLoaded) return;
    final currentState = state as ApprovalDetailLoaded;
    if (currentState.isSubmittingDecision) return;

    emit(currentState.copyWith(isSubmittingDecision: true, clearErrors: true));

    try {
      final result = await repository.submitApprovalDecision(
        documentId: currentState.request.documentId,
        action: event.action,
        reasonCode: event.reasonCode,
        comments: event.comments,
        sourceVersion: currentState.request.sourceVersion,
      );

      emit(ApprovalDecisionSuccessState(result));
    } on SodViolationException catch (e) {
      emit(currentState.copyWith(
        isSubmittingDecision: false,
        sodViolationCode: e.code,
        sodViolationMessage: e.userFriendlyExplanation,
      ));
    } on ApprovalGateException catch (e) {
      emit(currentState.copyWith(
        isSubmittingDecision: false,
        errorMessage: 'Gate Condition Blocked: ${e.message}',
      ));
    } on StaleVersionException catch (e) {
      emit(currentState.copyWith(
        isSubmittingDecision: false,
        errorMessage: 'Stale Version Conflict: ${e.message}',
      ));
    } on ApprovalConflictException catch (e) {
      emit(currentState.copyWith(
        isSubmittingDecision: false,
        errorMessage: 'Concurrent Decision Conflict: ${e.message}',
      ));
    } catch (e) {
      emit(currentState.copyWith(
        isSubmittingDecision: false,
        errorMessage: 'Approval submission failed: ${e.toString()}',
      ));
    }
  }

  Future<void> _onPublishDocumentToErp(
    PublishDocumentToErpEvent event,
    Emitter<ApprovalDetailState> emit,
  ) async {
    if (state is! ApprovalDetailLoaded) return;
    final currentState = state as ApprovalDetailLoaded;
    if (currentState.isPublishingErp) return;

    emit(currentState.copyWith(isPublishingErp: true, clearErrors: true));

    try {
      final pubResult = await repository.publishToErp(
        documentId: currentState.request.documentId,
        forceRetry: event.forceRetry,
      );

      // Re-fetch ERP status record
      final erpRecord = await repository.getErpPublicationStatus(currentState.request.documentId);

      emit(currentState.copyWith(
        isPublishingErp: false,
        erpRecord: erpRecord ??
            ErpPublicationRecord(
              publicationId: pubResult.publicationId,
              documentId: currentState.request.documentId,
              tenantId: currentState.request.tenantId,
              erpTarget: 'SAP_S4HANA',
              idempotencyKey: pubResult.idempotencyKey,
              status: pubResult.status,
              attempts: pubResult.attempts,
              publishedAt: pubResult.publishedAt,
              createdAt: DateTime.now(),
            ),
      ));
    } catch (e) {
      emit(currentState.copyWith(
        isPublishingErp: false,
        errorMessage: 'ERP Publication failed: ${e.toString()}',
      ));
    }
  }

  Future<void> _onRefreshErpPublicationStatus(
    RefreshErpPublicationStatus event,
    Emitter<ApprovalDetailState> emit,
  ) async {
    if (state is! ApprovalDetailLoaded) return;
    final currentState = state as ApprovalDetailLoaded;

    try {
      final erpRecord = await repository.getErpPublicationStatus(currentState.request.documentId);
      emit(currentState.copyWith(erpRecord: erpRecord));
    } catch (_) {}
  }
}
