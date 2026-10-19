import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ReviewService, ReviewValidationError } from '../services/review.service.js';
import { DocumentNotEligibleError, OcrNotFoundError } from '../services/intake.service.js';
import { Logger } from '../utils/logger.js';

export async function getReviewQueueHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Tenant context missing from authentication credentials.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const queue = await ReviewService.getReviewQueue(tenantId);
    res.status(200).json(queue);
  } catch (err: any) {
    Logger.error({
      context: 'ReviewController',
      message: 'Failed to retrieve review queue',
      error: err,
    });
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to retrieve review queue.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function getReviewWorkbenchHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Tenant context missing from authentication credentials.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const data = await ReviewService.getReviewWorkbenchData(id, tenantId);
    res.status(200).json(data);
  } catch (err: any) {
    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found within tenant boundary.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DocumentNotEligibleError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Document not eligible for review.',
        status: err.statusCode,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    Logger.error({
      context: 'ReviewController',
      message: `Failed to retrieve workbench data for document ${id}`,
      error: err,
    });
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to load Review Workbench.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function correctFieldHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id, key } = req.params;
  const tenantId = req.user?.tenantId;

  if (!tenantId || !req.user) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Authentication required.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  const { correctedValue, reason } = req.body;
  if (correctedValue === undefined) {
    res.status(400).json({
      type: 'https://api.docunexa.enterprise/errors/INVALID_PAYLOAD',
      title: 'Corrected field value must be provided.',
      status: 400,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const result = await ReviewService.correctField(id, tenantId, key, { correctedValue, reason }, req.user);
    res.status(200).json({
      success: true,
      message: `Field '${key}' successfully updated.`,
      field: result.field,
      reconciliationResult: result.reconciliationResult,
    });
  } catch (err: any) {
    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found within tenant boundary.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DocumentNotEligibleError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Field correction rejected.',
        status: err.statusCode,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    Logger.error({
      context: 'ReviewController',
      message: `Failed to correct field '${key}' for document ${id}`,
      error: err,
    });
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to correct field.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function submitReviewDecisionHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;

  if (!tenantId || !req.user) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Authentication required.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  const { action, comments, overrideReason } = req.body;
  if (!action || !['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(action)) {
    res.status(400).json({
      type: 'https://api.docunexa.enterprise/errors/INVALID_ACTION',
      title: 'Invalid review action. Must be APPROVE, REJECT, or REQUEST_CHANGES.',
      status: 400,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const result = await ReviewService.submitReviewDecision(
      id,
      tenantId,
      { action, comments, overrideReason },
      req.user
    );
    res.status(200).json({
      success: true,
      documentId: id,
      newStatus: result.status,
      newStage: result.stage,
      auditEvent: result.auditEvent,
    });
  } catch (err: any) {
    if (err instanceof ReviewValidationError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Review validation failed.',
        status: err.statusCode,
        detail: err.message,
        violations: err.details,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found within tenant boundary.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DocumentNotEligibleError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Review action rejected.',
        status: err.statusCode,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    Logger.error({
      context: 'ReviewController',
      message: `Failed to execute review action for document ${id}`,
      error: err,
    });
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to execute review decision.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function getReviewAuditLogsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Tenant context missing from authentication credentials.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const auditLogs = await ReviewService.getAuditLogs(id, tenantId);
    res.status(200).json({ auditLogs });
  } catch (err: any) {
    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found within tenant boundary.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to retrieve review audit logs.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}
