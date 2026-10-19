import { BoundingBox2D, Polygon8Point, NormalizedBoundingBox } from './ocr.models.js';

export type ClassificationRoutingDecision = 'AUTO_CLASSIFIED' | 'MANUAL_TRIAGE';

export interface ClassificationResult {
  classificationId: string;
  documentId: string;
  tenantId: string;
  predictedType: string;
  confidenceScore: number;
  classifierName: string;
  isConfident: boolean;
  routingDecision: ClassificationRoutingDecision;
  matchingSignals: string[];
  classifiedAt: string;
}

export interface FieldEvidence {
  page: number;
  boxes: NormalizedBoundingBox[];
  text: string;
  evidence_unmapped?: boolean;
}

export interface FieldGroundedEvidence {
  pageNumber: number;
  textSnippet: string;
  boundingBox: BoundingBox2D;
  polygon: Polygon8Point;
  wordTokens: {
    id: string;
    text: string;
    confidence: number;
    bbox: BoundingBox2D;
  }[];
}

export type ExtractedFieldStatus = 'EXTRACTED' | 'LOW_CONFIDENCE' | 'MISSING' | 'INVALID';

export interface ExtractedField {
  fieldId: string;
  fieldName: string;
  label: string;
  dataType: string;
  extractedValue: any;
  normalizedValue?: any;
  confidence: number;
  status: ExtractedFieldStatus;
  groundedEvidence?: FieldGroundedEvidence;
  evidence?: FieldEvidence;
  validationErrors?: string[];
  sourceVersionId?: string;
}

export type MathReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'INCOMPLETE';

export interface InvoiceMathReconciliationResult {
  status: MathReconciliationStatus;
  netAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  expectedTotal?: number;
  delta: number;
  isReconciled: boolean;
  discrepancyReason?: string;
}

export interface ExtractionValidationSummary {
  isValid: boolean;
  totalFieldsExpected: number;
  totalFieldsExtracted: number;
  missingRequiredFields: string[];
  lowConfidenceFields: string[];
  reconciliationResult?: InvoiceMathReconciliationResult;
}

export type ExtractionRoutingDecision = 'STP_PROCESSED' | 'NEEDS_REVIEW';

export interface DocumentExtractionResult {
  extractionId: string;
  documentId: string;
  tenantId: string;
  documentType: string;
  templateVersion: string;
  fields: ExtractedField[];
  validationSummary: ExtractionValidationSummary;
  routingDecision: ExtractionRoutingDecision;
  extractedAt: string;
}
