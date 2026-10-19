import { Request, Response } from 'express';
import { ExportService } from '../services/export.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function requestExportHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { reportType, format, dateRange, startDate, endDate, maskPii } = req.body;
  const validTypes = ['executive', 'ingestion', 'ai_sla', 'governance', 'exceptions', 'documents'];
  if (!reportType || !validTypes.includes(reportType)) {
    res.status(400).json({
      error: { code: 'INVALID_REPORT_TYPE', message: `Invalid or missing reportType. Must be one of: ${validTypes.join(', ')}.` },
    });
    return;
  }

  try {
    const job = await ExportService.requestExport(tenantId, userId, {
      reportType,
      format: format || 'csv',
      dateRange,
      startDate,
      endDate,
      maskPii: maskPii !== false,
      userRole: authReq.user?.role,
    } as any);

    res.status(202).json(job);
  } catch (err: any) {
    Logger.error({
      message: `Failed to request export: ${err.message}`,
      context: 'ExportController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'EXPORT_REQUEST_ERROR', message: 'Failed to initiate asynchronous export.' },
    });
  }
}

export async function getExportJobHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const job = await ExportService.getExportJob(tenantId, id);
    if (!job) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Export job not found or access denied.' },
      });
      return;
    }

    res.status(200).json(job);
  } catch (err: any) {
    Logger.error({
      message: `Failed to fetch export job: ${err.message}`,
      context: 'ExportController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'EXPORT_FETCH_ERROR', message: 'Failed to retrieve export job status.' },
    });
  }
}

export async function listExportJobsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const jobs = await ExportService.listExportJobs(tenantId, userId, limit, offset);
    res.status(200).json({ jobs, count: jobs.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list export jobs: ${err.message}`,
      context: 'ExportController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'EXPORT_LIST_ERROR', message: 'Failed to list export jobs.' },
    });
  }
}

export async function downloadExportHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const { id } = req.params;
  const token = (req.query.token as string) || (req.headers['x-download-token'] as string);

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (!token) {
    res.status(400).json({
      error: { code: 'MISSING_DOWNLOAD_TOKEN', message: 'Short-lived download token is required.' },
    });
    return;
  }

  try {
    const result = await ExportService.downloadExport(tenantId, id, token, {
      userId: authReq.user?.userId || 'anonymous',
      role: authReq.user?.role || 'Admin',
      sessionId: authReq.user?.sessionId,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-Artifact-Checksum', result.sha256Hash);
    res.status(200).send(result.content);
  } catch (err: any) {
    const isSecurityError =
      err.message.includes('Token') ||
      err.message.includes('expired') ||
      err.message.includes('Access denied') ||
      err.message.includes('inactive') ||
      err.message.includes('revoked') ||
      err.statusCode === 403;
    res.status(isSecurityError ? 403 : 404).json({
      error: { code: 'DOWNLOAD_DENIED', message: err.message },
    });
  }
}

export async function revokeExportHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'anonymous';
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const revoked = await ExportService.revokeExport(tenantId, id, userId);
    res.status(200).json(revoked);
  } catch (err: any) {
    res.status(err.statusCode || 404).json({
      error: { code: 'EXPORT_REVOCATION_ERROR', message: err.message },
    });
  }
}
