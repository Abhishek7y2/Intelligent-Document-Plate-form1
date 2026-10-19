export type DiffChunkType = 'normal' | 'added' | 'removed';

export interface DiffChunk {
  text: string;
  type: DiffChunkType;
}

export type ClauseCategory = 'commercial' | 'legal' | 'compliance' | 'general';
export type ClauseChangeType = 'added' | 'removed' | 'modified' | 'unchanged';
export type RiskLevel = 'High' | 'Medium' | 'Low' | 'None';
export type ClauseReviewStatus = 'pending' | 'accepted' | 'flagged';

export interface ClauseDiff {
  id: string;
  sectionNumber: string;
  title: string;
  category: ClauseCategory;
  changeType: ClauseChangeType;
  version1Text: string;
  version2Text: string;
  beforeSummary: string;
  afterSummary: string;
  plainEnglishImpact: string;
  legalRecommendation: string;
  fallbackClause?: string;
  pageCitationV1: string;
  pageCitationV2: string;
  riskImpact: RiskLevel;
  summaryDelta?: string;
  isUncertainAlignment?: boolean;
  status: ClauseReviewStatus;
  v1Chunks: DiffChunk[];
  v2Chunks: DiffChunk[];
  unifiedChunks: DiffChunk[];
}

export type FieldDiffStatus = 'Added' | 'Removed' | 'Modified';

export interface FieldDiff {
  fieldKey: string;
  label: string;
  v1Value: string;
  v2Value: string;
  status: FieldDiffStatus;
  varianceImpact?: string;
  plainMeaning: string;
  pageCitationV1?: string;
  pageCitationV2?: string;
  reviewed?: boolean;
}

export interface ComparisonSummary {
  totalClauses: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  highRiskCount: number;
}

export interface DocumentComparisonPayload {
  documentId1: string;
  documentId2: string;
}

export interface DocumentComparisonResult {
  comparisonId: string;
  tenantId: string;
  document1: {
    id: string;
    name: string;
    version: string;
  };
  document2: {
    id: string;
    name: string;
    version: string;
  };
  summary: ComparisonSummary;
  clauses: ClauseDiff[];
  fieldDiffs: FieldDiff[];
  createdAt: string;
}
