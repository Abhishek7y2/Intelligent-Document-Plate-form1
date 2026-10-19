import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SummaryService } from '../services/summary.service.js';
import { OcrNotFoundError } from '../services/intake.service.js';

export async function generateSummaryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const documentId = req.params['id'];

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing required tenant identity.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const { modelVersion } = req.body || {};

    const summary = await SummaryService.generateSummary({
      documentId,
      tenantId,
      userId,
      modelVersion,
    });

    res.status(201).json({
      status: 'SUCCESS',
      data: summary,
    });
  } catch (err: any) {
    if (err instanceof OcrNotFoundError || err.statusCode === 404 || err.message?.includes('not found')) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found within tenant boundary.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}

export async function getSummaryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const documentId = req.params['id'];

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const summary = await SummaryService.getSummary(documentId, tenantId);

    if (!summary) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/SUMMARY_NOT_FOUND',
        title: 'No summary found for document.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(200).json({
      status: 'SUCCESS',
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

export async function correctSummaryHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    const summaryId = req.params['summaryId'];
    const { correctedSummary, reason } = req.body || {};

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing user or tenant identity.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!correctedSummary || typeof correctedSummary !== 'string') {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'correctedSummary string is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const updated = await SummaryService.correctSummary({
      tenantId,
      summaryId,
      reviewerId: userId,
      correctedSummary,
      reason,
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Summary successfully reviewed and updated.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof OcrNotFoundError || err.statusCode === 404 || err.message?.includes('not found')) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/SUMMARY_NOT_FOUND',
        title: 'Summary not found within tenant boundary.',
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}
