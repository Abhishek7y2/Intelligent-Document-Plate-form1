export type ExportFormat = 'csv' | 'json';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REVOKED';

export type ExportReportType = 'executive' | 'ingestion' | 'ai_sla' | 'governance' | 'exceptions' | 'documents';

export interface RequestExportPayload {
  reportType: ExportReportType;
  format?: ExportFormat;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  maskPii?: boolean;
  filters?: Record<string, any>;
}

export interface ExportJobRecord {
  id: string;
  tenantId: string;
  userId: string;
  reportType: ExportReportType;
  format: ExportFormat;
  status: ExportStatus;
  filtersSnapshot: Record<string, any>;
  maskPii: boolean;
  maskedFields?: string[];
  totalRecords: number;
  filePath?: string;
  fileSizeBytes: number;
  sha256Hash?: string;
  downloadToken?: string;
  tokenExpiresAt?: Date;
  expiresAt: Date;
  downloadCount: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ExportJobSummary {
  id: string;
  reportType: ExportReportType;
  format: ExportFormat;
  status: ExportStatus;
  totalRecords: number;
  fileSizeBytes: number;
  sha256Hash?: string;
  downloadUrl?: string;
  expiresAt: string;
  createdAt: string;
}

export interface DownloadVerificationResult {
  allowed: boolean;
  exportJob?: ExportJobRecord;
  reason?: string;
}
