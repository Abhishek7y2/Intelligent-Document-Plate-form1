export type QaStatus =
  | 'ANSWERED'
  | 'ABSTAINED'
  | 'CONFLICT_DETECTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'SECURITY_BLOCKED'
  | 'ERROR';

export type QaFeedbackType = 'HELPFUL' | 'NOT_HELPFUL' | 'FLAGGED';

export interface QaCitation {
  citationId: string;
  documentId: string;
  documentTitle: string;
  sourceVersion: string;
  pageNumber: number;
  section: string;
  spanId: string;
  snippet: string;
  isAuthorized: boolean;
  isRestricted?: boolean;
  isSuperseded?: boolean;
  latestVersion?: string;
}

export interface QaConflict {
  clauseA: string;
  clauseB: string;
  sourceVersionA: string;
  sourceVersionB: string;
  description: string;
}

export interface QaDocumentFreshness {
  documentId: string;
  documentName: string;
  usedVersion: string;
  latestVersion: string;
  isSuperseded: boolean;
  notice?: string;
}

export interface QaRequest {
  question: string;
  documentId?: string; // Optional single-doc focus from context dropdown
  documentIds?: string[]; // Optional multi-doc filter
  sessionId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface QaResponse {
  traceId: string;
  sessionId?: string;
  question: string;
  answer: string;
  status: QaStatus;
  abstentionReason?: string;
  confidence: number;
  citations: QaCitation[];
  conflicts?: QaConflict[];
  documentFreshness?: QaDocumentFreshness[];
  model: {
    name: string;
    version: string;
    provider: string;
  };
  durationMs: number;
  isPromptInjectionAttempt?: boolean;
}

export interface CitationVerificationResult {
  citationId: string;
  documentId: string;
  documentTitle?: string;
  sourceVersion: string;
  pageNumber: number;
  spanId?: string;
  isAuthorized: boolean;
  reason?: string;
  redirectUrl?: string;
}

export interface QaTraceRecord {
  traceId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  documentId?: string;
  questionHash: string;
  questionSanitized: string;
  answerSnippet?: string;
  status: QaStatus;
  abstentionReason?: string;
  confidenceScore: number;
  modelName: string;
  modelVersion: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  correlationId?: string;
  feedback?: QaFeedbackType;
  createdAt: Date;
}

export interface QaAvailableDocument {
  id: string;
  name: string;
  type: string;
  currentVersion: string;
  latestVersion?: string;
  isRestricted?: boolean;
  status: string;
  chunksCount: number;
}
