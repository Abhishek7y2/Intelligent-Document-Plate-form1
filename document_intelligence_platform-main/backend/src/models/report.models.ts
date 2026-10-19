export type DateRangePreset = 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'This Quarter' | 'Custom Range';

export interface ReportFilterPayload {
  dateRange?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  documentType?: string;
  channel?: string;
}

export interface MetricCard {
  label: string;
  value: string | number;
  delta?: string;
  isPositive?: boolean;
  subtext?: string;
}

export interface VolumeTrendPoint {
  date: string;
  volume: number;
  approved: number;
  rejected: number;
}

export interface ExecutiveReportData {
  totalProcessed: number;
  stpRatePercent: number;
  averageSlaMinutes: number;
  complianceScorePercent: number;
  cards: MetricCard[];
  volumeTrend: VolumeTrendPoint[];
  statusDistribution: Record<string, number>;
}

export interface IngestionChannelStat {
  channel: string;
  count: number;
  percentage: number;
  failureRate: number;
}

export interface IngestionReportData {
  totalIngested: number;
  channels: IngestionChannelStat[];
  byDocumentType: Record<string, number>;
  quarantineCount: number;
  duplicateRejectionCount: number;
}

export interface SlaBottleneckBucket {
  bucket: string; // '< 4h', '4h - 24h', '> 24h (Breach)'
  count: number;
  percentage: number;
}

export interface AiSlaReportData {
  averageConfidencePercent: number;
  humanTouchRatePercent: number;
  lowConfidenceCount: number;
  slaBuckets: SlaBottleneckBucket[];
  fieldExtractionAccuracy: Record<string, number>;
}

export interface GovernanceAuditSummary {
  totalAuditEvents: number;
  sodAdherenceRatePercent: number;
  overriddenFieldCount: number;
  dualApprovedCount: number;
  securityIncidentsBlocked: number;
}

export interface GovernanceReportData {
  summary: GovernanceAuditSummary;
  recentAuditLogs: Array<{
    id: string;
    timestamp: string;
    actor: string;
    role: string;
    action: string;
    resource: string;
    status: 'SUCCESS' | 'WARNING' | 'FAILED';
  }>;
}

export interface ExceptionReasonStat {
  reason: string;
  count: number;
  percentage: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ExceptionsReportData {
  totalExceptions: number;
  activeQuarantines: number;
  rejectedInvoices: number;
  failedOcrCount: number;
  exceptionReasons: ExceptionReasonStat[];
}

export interface GovernanceReportMetrics {
  generatedAt: string;
  tenantId: string;
  filterRange: string;
  executive: ExecutiveReportData;
  ingestion: IngestionReportData;
  aiSla: AiSlaReportData;
  governance: GovernanceReportData;
  exceptions: ExceptionsReportData;
}
