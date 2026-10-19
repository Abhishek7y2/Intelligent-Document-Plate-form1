import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  ApprovalService,
  SodViolationError,
  ApprovalGateError,
  StaleVersionError,
  ApprovalConflictError,
} from '../services/approval.service.js';
import { OcrNotFoundError, DocumentNotEligibleError } from '../services/intake.service.js';
import { ApprovalDecisionPayload } from '../models/approval.models.js';

export async function getApprovalQueueHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const queue = await ApprovalService.getApprovalQueue(tenantId);
    res.status(200).json(queue);
  } catch (err: any) {
    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to retrieve approval queue.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function getApprovalDetailsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const documentId = req.params.id;
  const tenantId = req.user!.tenantId;

  try {
    const request = await ApprovalService.getOrCreateApprovalRequest(documentId, tenantId);
    res.status(200).json(request);
  } catch (err: any) {
    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to retrieve approval details.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}

export async function submitApprovalDecisionHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const documentId = req.params.id;
  const tenantId = req.user!.tenantId;
  const payload: ApprovalDecisionPayload = req.body;

  if (!payload || !payload.action) {
    res.status(400).json({
      type: 'https://api.docunexa.enterprise/errors/INVALID_REQUEST',
      title: 'Action is required in request payload.',
      status: 400,
      instance: req.originalUrl,
    });
    return;
  }

  try {
    const result = await ApprovalService.submitApprovalDecision(documentId, tenantId, payload, req.user!);
    res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof SodViolationError) {
      res.status(403).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Separation of Duties (SoD) policy restriction triggered.',
        status: 403,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof ApprovalGateError) {
      res.status(400).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Approval gate condition blocked sign-off.',
        status: 400,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof StaleVersionError || err instanceof ApprovalConflictError) {
      res.status(409).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Conflicting or stale approval state.',
        status: 409,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof OcrNotFoundError) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: 'Document not found.',
        status: 404,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DocumentNotEligibleError) {
      res.status(err.statusCode || 400).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: 'Document is not eligible for approval workflow.',
        status: err.statusCode || 400,
        detail: err.message,
        instance: req.originalUrl,
      });
      return;
    }

    res.status(500).json({
      type: 'https://api.docunexa.enterprise/errors/INTERNAL_ERROR',
      title: 'Failed to submit approval decision.',
      status: 500,
      detail: err.message,
      instance: req.originalUrl,
    });
  }
}
