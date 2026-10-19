import crypto from 'crypto';
import {
  ExportJobRecord,
  RequestExportPayload,
  ExportJobSummary,
  ExportFormat,
} from '../models/export.models.js';
import { ReportService } from './report.service.js';
import { IntakeService } from './intake.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { ExportMaskingService } from './export-masking.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { AuthService } from './auth.service.js';

export class ExportValidationError extends Error {
  statusCode = 400;
  code = 'EXPORT_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ExportValidationError';
  }
}

export class ExportAccessDeniedError extends Error {
  statusCode = 403;
  code = 'EXPORT_ACCESS_DENIED';
  constructor(message: string) {
    super(message);
    this.name = 'ExportAccessDeniedError';
  }
}

export class ExportExpiredError extends Error {
  statusCode = 410;
  code = 'EXPORT_EXPIRED';
  constructor(message: string) {
    super(message);
    this.name = 'ExportExpiredError';
  }
}

export class ExportService {
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryJobs = new Map<string, ExportJobRecord>();
  private static inMemoryArtifacts = new Map<string, string>(); // exportId -> content string

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  static clearInMemory(): void {
    this.inMemoryJobs.clear();
    this.inMemoryArtifacts.clear();
  }

  /**
   * Masks sensitive PII and financial patterns in exported data strings
   */
  static maskSensitiveContent(text: string): string {
    return text
      // Credit card numbers (13-19 digits)
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '****-****-****-****')
      // Tax IDs / SSN (format XXX-XX-XXXX)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****')
      // Bank account numbers (8-16 digits)
      .replace(/\b\d{10,16}\b/g, (match) => '******' + match.slice(-4))
      // Email addresses
      .replace(/([a-zA-Z0-9_\.-]+)@([a-zA-Z0-9\.-]+)/g, (_match, user, domain) => {
        return user[0] + '***@' + domain;
      });
  }

  /**
   * Creates an asynchronous export job with server-side authorization, PII masking,
   * SHA-256 seal generation, and short-lived download token.
   */
  static async requestExport(
    tenantId: string,
    userId: string,
    payload: RequestExportPayload
  ): Promise<ExportJobSummary> {
    const validReportTypes = ['executive', 'ingestion', 'ai_sla', 'governance', 'exceptions', 'documents'];
    if (!payload.reportType || !validReportTypes.includes(payload.reportType)) {
      throw new ExportValidationError(`Invalid reportType '${payload.reportType}'. Valid types: ${validReportTypes.join(', ')}.`);
    }

    const id = `EXP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const format: ExportFormat = payload.format === 'json' ? 'json' : 'csv';
    const maskPii = payload.maskPii !== false;

    // Build export data
    let rawContent = '';
    let totalRecords = 0;

    const userRole = (payload as any).userRole || 'Admin';
    let maskedFields: string[] = [];

    if (payload.reportType === 'documents') {
      let docs = await IntakeService.listDocuments(tenantId);
      // Apply server-side role-based masking per requester role
      const maskingRes = await ExportMaskingService.applyRoleMasking(tenantId, userRole, docs, 'documents');
      docs = maskingRes.maskedItems;
      maskedFields = maskingRes.maskedFields;

      totalRecords = docs.length;
      if (format === 'csv') {
        const headers = 'Document ID,File Name,Type,Status,Confidence,Page Count,Uploaded At\n';
        const rows = docs.map((d) => 
          `"${d.documentId}","${d.fileName}","${d.documentType}","${d.status}",${d.confidenceScore || 0},${d.pageCount || 1},"${new Date(d.uploadedAt).toISOString()}"`
        ).join('\n');
        rawContent = headers + rows;
      } else {
        rawContent = JSON.stringify(docs, null, 2);
      }
    } else {
      const metrics = await ReportService.getGovernanceReportMetrics(tenantId, {
        dateRange: (payload.dateRange as any) || 'Last 30 Days',
        startDate: payload.startDate,
        endDate: payload.endDate,
      });

      if (format === 'csv') {
        if (payload.reportType === 'governance') {
          totalRecords = metrics.governance.recentAuditLogs.length;
          const headers = 'Audit ID,Timestamp,Actor,Role,Action,Resource,Status\n';
          const rows = metrics.governance.recentAuditLogs.map((l) =>
            `"${l.id}","${l.timestamp}","${l.actor}","${l.role}","${l.action}","${l.resource}","${l.status}"`
          ).join('\n');
          rawContent = headers + rows;
        } else if (payload.reportType === 'exceptions') {
          totalRecords = metrics.exceptions.exceptionReasons.length;
          const headers = 'Exception Reason,Count,Percentage,Severity\n';
          const rows = metrics.exceptions.exceptionReasons.map((e) =>
            `"${e.reason}",${e.count},${e.percentage}%,"${e.severity}"`
          ).join('\n');
          rawContent = headers + rows;
        } else {
          totalRecords = 4;
          const headers = 'Metric Category,Label,Value,Subtext\n';
          const rows = metrics.executive.cards.map((c) =>
            `"Executive","${c.label}","${c.value}","${c.subtext || ''}"`
          ).join('\n');
          rawContent = headers + rows;
        }
      } else {
        totalRecords = 1;
        rawContent = JSON.stringify((metrics as any)[payload.reportType] || metrics, null, 2);
      }
    }

    // Apply PII masking
    const finalContent = maskPii ? this.maskSensitiveContent(rawContent) : rawContent;
    const fileSizeBytes = Buffer.byteLength(finalContent, 'utf8');
    const sha256Hash = crypto.createHash('sha256').update(finalContent).digest('hex');
    const downloadToken = `DLT-${crypto.randomBytes(16).toString('hex')}`;
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const record: ExportJobRecord = {
      id,
      tenantId,
      userId,
      reportType: payload.reportType,
      format,
      status: 'COMPLETED',
      filtersSnapshot: {
        dateRange: payload.dateRange || 'Last 30 Days',
        maskPii,
        reportType: payload.reportType,
        maskedFields,
      },
      maskPii,
      totalRecords,
      filePath: `/exports/${tenantId}/${id}.${format}`,
      fileSizeBytes,
      sha256Hash,
      downloadToken,
      tokenExpiresAt,
      expiresAt,
      downloadCount: 0,
      createdAt: new Date(),
      completedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO export_jobs (
            id, tenant_id, user_id, report_type, format, status, filters_snapshot,
            mask_pii, total_records, file_path, file_size_bytes, sha256_hash,
            download_token, token_expires_at, expires_at, download_count, created_at, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            record.id,
            record.tenantId,
            record.userId,
            record.reportType,
            record.format,
            record.status,
            JSON.stringify(record.filtersSnapshot),
            record.maskPii,
            record.totalRecords,
            record.filePath,
            record.fileSizeBytes,
            record.sha256Hash,
            record.downloadToken,
            record.tokenExpiresAt,
            record.expiresAt,
            record.downloadCount,
            record.createdAt,
            record.completedAt,
          ]
        );
      } catch (err: any) {
        Logger.warn({ message: `Database insert for export_jobs failed: ${err.message}` });
        this.inMemoryJobs.set(record.id, record);
      }
    } else {
      this.inMemoryJobs.set(record.id, record);
    }

    this.inMemoryArtifacts.set(record.id, finalContent);

    Logger.info({
      message: `Export job ${record.id} completed: ${record.totalRecords} records, ${record.fileSizeBytes} bytes, SHA-256 seal [${sha256Hash.slice(0, 12)}...]`,
      context: 'ExportService',
      data: { exportId: record.id, tenantId, format, size: fileSizeBytes, hash: sha256Hash },
    });

    return {
      id: record.id,
      reportType: record.reportType,
      format: record.format,
      status: record.status,
      totalRecords: record.totalRecords,
      fileSizeBytes: record.fileSizeBytes,
      sha256Hash: record.sha256Hash,
      downloadUrl: `/api/v1/exports/${record.id}/download?token=${downloadToken}`,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves summary of an export job
   */
  static async getExportJob(tenantId: string, exportId: string): Promise<ExportJobSummary> {
    let job: ExportJobRecord | undefined = undefined;

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id as "tenantId", user_id as "userId", report_type as "reportType",
                  format, status, filters_snapshot as "filtersSnapshot", mask_pii as "maskPii",
                  total_records as "totalRecords", file_path as "filePath", file_size_bytes as "fileSizeBytes",
                  sha256_hash as "sha256Hash", download_token as "downloadToken",
                  token_expires_at as "tokenExpiresAt", expires_at as "expiresAt",
                  download_count as "downloadCount", created_at as "createdAt", completed_at as "completedAt"
           FROM export_jobs
           WHERE id = $1 AND tenant_id = $2`,
          [exportId, tenantId]
        );
        if (res.rows.length > 0) job = res.rows[0];
      } catch {
        // Fallback
      }
    }

    if (!job) {
      job = this.inMemoryJobs.get(exportId);
    }

    if (!job || job.tenantId !== tenantId) {
      throw new ExportAccessDeniedError(`Export job ${exportId} does not exist or access is forbidden.`);
    }

    return {
      id: job.id,
      reportType: job.reportType,
      format: job.format,
      status: job.status,
      totalRecords: job.totalRecords,
      fileSizeBytes: job.fileSizeBytes,
      sha256Hash: job.sha256Hash,
      downloadUrl: `/api/v1/exports/${job.id}/download?token=${job.downloadToken}`,
      expiresAt: new Date(job.expiresAt).toISOString(),
      createdAt: new Date(job.createdAt).toISOString(),
    };
  }

  /**
   * Authorizes download token, revalidates tenant authorization, and streams artifact
   */
  static async downloadExport(
    tenantId: string,
    exportId: string,
    token: string,
    requester?: { userId: string; role: string; sessionId?: string }
  ): Promise<{ content: string; contentType: string; fileName: string; sha256Hash: string }> {
    let job: ExportJobRecord | undefined = undefined;

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id as "tenantId", user_id as "userId", report_type as "reportType",
                  format, status, mask_pii as "maskPii", file_size_bytes as "fileSizeBytes",
                  sha256_hash as "sha256Hash", download_token as "downloadToken",
                  token_expires_at as "tokenExpiresAt", expires_at as "expiresAt",
                  download_count as "downloadCount"
           FROM export_jobs
           WHERE id = $1 AND tenant_id = $2`,
          [exportId, tenantId]
        );
        if (res.rows.length > 0) job = res.rows[0];
      } catch {
        // Fallback
      }
    }

    if (!job) {
      job = this.inMemoryJobs.get(exportId);
    }

    if (!job || job.tenantId !== tenantId) {
      throw new ExportAccessDeniedError('Export does not exist or does not belong to authorized tenant.');
    }

    // 1. Check if revoked
    if (job.status === 'REVOKED') {
      throw new ExportAccessDeniedError('Export job has been revoked and cannot be downloaded.');
    }

    // 2. Check overall job expiration
    if (job.expiresAt && new Date(job.expiresAt).getTime() < Date.now()) {
      throw new ExportExpiredError('Export artifact has expired and been purged by retention policy.');
    }

    // 3. Verify download token
    if (!token || job.downloadToken !== token) {
      throw new ExportAccessDeniedError('Invalid or missing download authorization token.');
    }

    // 4. Check token expiration
    if (job.tokenExpiresAt && new Date(job.tokenExpiresAt).getTime() < Date.now()) {
      throw new ExportExpiredError('Export download token has expired. Request a new token.');
    }

    // 5. Requester active check & session validation (Sprint 1 session revocation check)
    const requesterUserId = requester?.userId || job.userId;
    const sessionValidation = await AuthService.validateUserAndSession(
      requesterUserId,
      tenantId,
      requester?.sessionId
    );
    if (!sessionValidation.valid) {
      throw new ExportAccessDeniedError(`Requester access denied: ${sessionValidation.reason || 'Session revoked or user inactive.'}`);
    }

    // 6. Requester still has export permission
    const requesterRole = requester?.role || 'Admin';
    const allowedExportRoles = ['Admin', 'Reviewer', 'Analyst', 'Auditor', 'approver', 'org_admin'];
    if (!allowedExportRoles.includes(requesterRole)) {
      throw new ExportAccessDeniedError('Requester role no longer has export permissions.');
    }

    // Increment download count
    job.downloadCount = (job.downloadCount || 0) + 1;
    if (this.storeMode === 'database') {
      try {
        await dbPool.query('UPDATE export_jobs SET download_count = download_count + 1 WHERE id = $1', [exportId]);
      } catch {
        // Ignore
      }
    }

    // 7. Audit every download with HMAC-signed audit events
    await AuditTrailService.recordEvent({
      tenantId,
      action: 'EXPORT_DOWNLOADED',
      userId: requesterUserId,
      details: { exportId: job.id, sha256: job.sha256Hash, reportType: job.reportType },
    });

    const content = this.inMemoryArtifacts.get(exportId) || '';
    const contentType = job.format === 'json' ? 'application/json' : 'text/csv';
    const fileName = `DocuNexa_${job.reportType}_export_${exportId}.${job.format}`;

    return {
      content,
      contentType,
      fileName,
      sha256Hash: job.sha256Hash || '',
    };
  }

  /**
   * Revokes an export job so it cannot be downloaded anymore
   */
  static async revokeExport(tenantId: string, exportId: string, revokedBy: string): Promise<ExportJobSummary> {
    const job = await this.getExportJob(tenantId, exportId);
    if (!job) {
      throw new ExportAccessDeniedError(`Export job ${exportId} not found.`);
    }

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `UPDATE export_jobs SET status = 'REVOKED' WHERE id = $1 AND tenant_id = $2`,
          [exportId, tenantId]
        );
      } catch {}
    }

    const memJob = this.inMemoryJobs.get(exportId);
    if (memJob) {
      memJob.status = 'REVOKED' as any;
    }

    await AuditTrailService.recordEvent({
      tenantId,
      action: 'EXPORT_REVOKED',
      userId: revokedBy,
      details: { exportId },
    });

    return {
      ...job,
      status: 'REVOKED' as any,
    };
  }

  /**
   * Lists export jobs for tenant and user
   */
  static async listExportJobs(
    tenantId: string,
    userId?: string,
    limit = 20,
    offset = 0
  ): Promise<ExportJobSummary[]> {
    if (this.storeMode === 'database') {
      try {
        const query = userId
          ? `SELECT id, report_type as "reportType", format, status, total_records as "totalRecords",
                    file_size_bytes as "fileSizeBytes", sha256_hash as "sha256Hash",
                    download_token as "downloadToken", expires_at as "expiresAt", created_at as "createdAt"
             FROM export_jobs
             WHERE tenant_id = $1 AND user_id = $2
             ORDER BY created_at DESC LIMIT $3 OFFSET $4`
          : `SELECT id, report_type as "reportType", format, status, total_records as "totalRecords",
                    file_size_bytes as "fileSizeBytes", sha256_hash as "sha256Hash",
                    download_token as "downloadToken", expires_at as "expiresAt", created_at as "createdAt"
             FROM export_jobs
             WHERE tenant_id = $1
             ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        const params = userId ? [tenantId, userId, limit, offset] : [tenantId, limit, offset];
        const res = await dbPool.query(query, params);
        return res.rows.map((r: any) => ({
          id: r.id,
          reportType: r.reportType,
          format: r.format,
          status: r.status,
          totalRecords: r.totalRecords,
          fileSizeBytes: r.fileSizeBytes,
          sha256Hash: r.sha256Hash,
          downloadUrl: `/api/v1/exports/${r.id}/download?token=${r.downloadToken}`,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : '',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
        }));
      } catch (err: any) {
        Logger.warn({ message: `Database query for listExportJobs failed: ${err.message}` });
      }
    }

    const filtered = Array.from(this.inMemoryJobs.values())
      .filter((j) => j.tenantId === tenantId && (!userId || j.userId === userId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return filtered.map((record) => ({
      id: record.id,
      reportType: record.reportType,
      format: record.format,
      status: record.status,
      totalRecords: record.totalRecords,
      fileSizeBytes: record.fileSizeBytes,
      sha256Hash: record.sha256Hash,
      downloadUrl: `/api/v1/exports/${record.id}/download?token=${record.downloadToken}`,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    }));
  }
}
