import 'package:equatable/equatable.dart';
import '../../domain/entities/legal_hold_item.dart';

class LegalHoldState extends Equatable {
  final List<LegalHoldItem> holds;
  final bool isLoading;
  final bool isSubmitting;
  final bool isPermissionDenied;
  final String? permissionDeniedMessage;
  final String? errorMessage;
  final String? successMessage;

  const LegalHoldState({
    this.holds = const [],
    this.isLoading = false,
    this.isSubmitting = false,
    this.isPermissionDenied = false,
    this.permissionDeniedMessage,
    this.errorMessage,
    this.successMessage,
  });

  LegalHoldState copyWith({
    List<LegalHoldItem>? holds,
    bool? isLoading,
    bool? isSubmitting,
    bool? isPermissionDenied,
    String? permissionDeniedMessage,
    String? errorMessage,
    bool clearError = false,
    String? successMessage,
    bool clearSuccess = false,
  }) {
    return LegalHoldState(
      holds: holds ?? this.holds,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isPermissionDenied: isPermissionDenied ?? this.isPermissionDenied,
      permissionDeniedMessage: isPermissionDenied == true
          ? (permissionDeniedMessage ?? this.permissionDeniedMessage)
          : null,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  @override
  List<Object?> get props => [
        holds,
        isLoading,
        isSubmitting,
        isPermissionDenied,
        permissionDeniedMessage,
        errorMessage,
        successMessage,
      ];
}
