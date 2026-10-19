import { Request, Response } from 'express';
import { ReportService } from '../services/report.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function getGovernanceReportHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const documentType = req.query.documentType as string | undefined;

    const report = await ReportService.getGovernanceReportMetrics(tenantId, {
      startDate,
      endDate,
      documentType,
    });

    res.status(200).json(report);
  } catch (err: any) {
    Logger.error({
      message: `Failed to generate governance report: ${err.message}`,
      context: 'ReportController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'REPORT_GENERATION_ERROR', message: 'Failed to aggregate report metrics.' },
    });
  }
}

export async function getOperationalKpiSummaryHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const kpis = await ReportService.getOperationalKpiSummary(tenantId);
    res.status(200).json(kpis);
  } catch (err: any) {
    Logger.error({
      message: `Failed to fetch KPI summary: ${err.message}`,
      context: 'ReportController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'KPI_FETCH_ERROR', message: 'Failed to aggregate operational KPIs.' },
    });
  }
}

export async function getExtractionQualityHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Authentication required. Missing tenant identity.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const documentType = req.query.documentType as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const report = await ReportService.getExtractionQuality(tenantId, {
      documentType,
      startDate,
      endDate,
    });

    res.status(200).json(report);
  } catch (err: any) {
    Logger.error({
      message: `Failed to generate extraction quality report: ${err.message}`,
      context: 'ReportController',
      error: err,
    });
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/REPORT_GENERATION_ERROR',
      title: 'Failed to generate extraction quality report.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}
