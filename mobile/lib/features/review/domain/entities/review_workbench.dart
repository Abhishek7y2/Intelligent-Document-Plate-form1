import 'package:equatable/equatable.dart';

class ReviewBoundingBox extends Equatable {
  final String id;
  final String fieldKey;
  final String label;
  final int page;
  final double x; // Normalized horizontal ratio [0.0, 1.0]
  final double y; // Normalized vertical ratio [0.0, 1.0]
  final double w; // Normalized width ratio [0.0, 1.0]
  final double h; // Normalized height ratio [0.0, 1.0]
  final double top; // Normalized percentage [0, 100]
  final double left; // Normalized percentage [0, 100]
  final double width; // Normalized percentage [0, 100]
  final double height; // Normalized percentage [0, 100]
  final String value;
  final int confidence;

  const ReviewBoundingBox({
    required this.id,
    required this.fieldKey,
    required this.label,
    required this.page,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    required this.top,
    required this.left,
    required this.width,
    required this.height,
    required this.value,
    required this.confidence,
  });

  @override
  List<Object?> get props => [
        id,
        fieldKey,
        label,
        page,
        x,
        y,
        w,
        h,
        top,
        left,
        width,
        height,
        value,
        confidence,
      ];
}

class ReviewField extends Equatable {
  final String key;
  final String fieldKey;
  final String label;
  final String value;
  final String originalValue;
  final int confidence; // 0 - 100
  final String status;
  final int page;
  final bool isMandatory;
  final bool evidenceUnmapped;
  final List<ReviewBoundingBox> evidenceBoxes;

  const ReviewField({
    required this.key,
    required this.fieldKey,
    required this.label,
    required this.value,
    required this.originalValue,
    required this.confidence,
    required this.status,
    required this.page,
    required this.isMandatory,
    required this.evidenceUnmapped,
    this.evidenceBoxes = const [],
  });

  bool get isLowConfidence => confidence < 80;
  bool get isHumanModified => value != originalValue;

  ReviewField copyWith({
    String? value,
    int? confidence,
    String? status,
  }) {
    return ReviewField(
      key: key,
      fieldKey: fieldKey,
      label: label,
      value: value ?? this.value,
      originalValue: originalValue,
      confidence: confidence ?? this.confidence,
      status: status ?? this.status,
      page: page,
      isMandatory: isMandatory,
      evidenceUnmapped: evidenceUnmapped,
      evidenceBoxes: evidenceBoxes,
    );
  }

  @override
  List<Object?> get props => [
        key,
        fieldKey,
        label,
        value,
        originalValue,
        confidence,
        status,
        page,
        isMandatory,
        evidenceUnmapped,
        evidenceBoxes,
      ];
}

class InvoiceReconciliation extends Equatable {
  final String status; // 'MATCH', 'MISMATCH', 'INCOMPLETE'
  final double netAmount;
  final double taxAmount;
  final double totalAmount;
  final double expectedTotal;
  final double delta;
  final String explanation;

  const InvoiceReconciliation({
    required this.status,
    required this.netAmount,
    required this.taxAmount,
    required this.totalAmount,
    required this.expectedTotal,
    required this.delta,
    required this.explanation,
  });

  bool get isMatch => status.toUpperCase() == 'MATCH';
  bool get isMismatch => status.toUpperCase() == 'MISMATCH';

  @override
  List<Object?> get props => [
        status,
        netAmount,
        taxAmount,
        totalAmount,
        expectedTotal,
        delta,
        explanation,
      ];
}

class PageDimension extends Equatable {
  final int pageNumber;
  final double width;
  final double height;
  final int dpi;

  const PageDimension({
    required this.pageNumber,
    required this.width,
    required this.height,
    required this.dpi,
  });

  @override
  List<Object?> get props => [pageNumber, width, height, dpi];
}

class ReviewWorkbench extends Equatable {
  final String documentId;
  final String documentTitle;
  final String documentType;
  final String status;
  final String stage;
  final int pages;
  final List<PageDimension> pageDimensions;
  final DateTime submittedAt;
  final double overallConfidence;
  final List<ReviewField> fields;
  final List<ReviewBoundingBox> boundingBoxes;
  final InvoiceReconciliation? reconciliation;

  const ReviewWorkbench({
    required this.documentId,
    required this.documentTitle,
    required this.documentType,
    required this.status,
    required this.stage,
    required this.pages,
    required this.pageDimensions,
    required this.submittedAt,
    required this.overallConfidence,
    required this.fields,
    required this.boundingBoxes,
    this.reconciliation,
  });

  List<ReviewBoundingBox> getBoxesForPage(int pageNumber) {
    return boundingBoxes.where((b) => b.page == pageNumber).toList();
  }

  @override
  List<Object?> get props => [
        documentId,
        documentTitle,
        documentType,
        status,
        stage,
        pages,
        pageDimensions,
        submittedAt,
        overallConfidence,
        fields,
        boundingBoxes,
        reconciliation,
      ];
}

class ReviewDecisionResult extends Equatable {
  final bool success;
  final String documentId;
  final String newStatus;
  final String newStage;

  const ReviewDecisionResult({
    required this.success,
    required this.documentId,
    required this.newStatus,
    required this.newStage,
  });

  @override
  List<Object?> get props => [success, documentId, newStatus, newStage];
}
