export type SummaryStatus = 'draft' | 'reviewed' | 'ABSTAINED';

export interface SummaryEvidence {
  page?: number;
  pageNumber?: number;
  quote: string;
  charStart?: number;
  charEnd?: number;
  charSpan?: [number, number];
}

export type EvidenceItem = SummaryEvidence;

export interface DocumentSummary {
  id: string;
  documentId: string;
  tenantId: string;
  sourceVersionId?: string;
  summary: string;
  evidence: SummaryEvidence[];
  status: SummaryStatus;
  modelVersion: string;
  createdBy: string;
  correctedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryCorrection {
  id: string;
  summaryId: string;
  tenantId: string;
  previousSummary: string;
  correctedSummary: string;
  reviewerId: string;
  reason?: string;
  audit_signature?: string;
  original_summary?: string;
  correctedAt: Date;
}
