import { Request, Response } from 'express';
import { RetentionService } from '../services/retention.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { Logger } from '../utils/logger.js';

export async function listRetentionPoliciesHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const policies = await RetentionService.listRetentionPolicies(tenantId);
    res.status(200).json({ policies, count: policies.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list retention policies: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'POLICY_FETCH_ERROR', message: 'Failed to retrieve retention policies.' },
    });
  }
}

export async function upsertRetentionPolicyHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'unknown_admin';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { documentType, retentionPeriodYears, triggerEvent, actionAfterExpiry, version } = req.body;
  if (!documentType || typeof retentionPeriodYears !== 'number') {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'documentType and retentionPeriodYears (number) are required.' },
    });
    return;
  }

  try {
    const policy = await RetentionService.upsertRetentionPolicy(tenantId, userId, {
      documentType,
      retentionPeriodYears,
      triggerEvent,
      actionAfterExpiry,
      version,
    });
    res.status(200).json({ policy });
  } catch (err: any) {
    Logger.error({
      message: `Failed to upsert retention policy: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(400).json({
      error: { code: 'POLICY_UPDATE_ERROR', message: err.message },
    });
  }
}

export async function listLegalHoldsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const holds = await RetentionService.listLegalHolds(tenantId);
    res.status(200).json({ holds, count: holds.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list legal holds: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'LEGAL_HOLD_FETCH_ERROR', message: 'Failed to retrieve legal holds.' },
    });
  }
}

export async function placeLegalHoldHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'unknown_counsel';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { matterName, matterNumber, reason, scopeDocumentIds, scopeDocumentType } = req.body;
  if (!matterName || !matterNumber || !reason) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'matterName, matterNumber, and reason are required.' },
    });
    return;
  }

  try {
    const hold = await RetentionService.placeLegalHold(tenantId, userId, {
      matterName,
      matterNumber,
      reason,
      scopeDocumentIds,
      scopeDocumentType,
    });
    res.status(201).json({ hold });
  } catch (err: any) {
    Logger.error({
      message: `Failed to place legal hold: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'LEGAL_HOLD_CREATE_ERROR', message: 'Failed to place legal hold.' },
    });
  }
}

export async function releaseLegalHoldHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'unknown_counsel';
  const { id } = req.params;
  const { releaseReason } = req.body;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (!releaseReason) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'releaseReason is required to release a legal hold.' },
    });
    return;
  }

  try {
    const hold = await RetentionService.releaseLegalHold(tenantId, id, userId, releaseReason);
    if (!hold) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Legal hold not found.' },
      });
      return;
    }
    res.status(200).json({ success: true, hold });
  } catch (err: any) {
    Logger.error({
      message: `Failed to release legal hold: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'LEGAL_HOLD_RELEASE_ERROR', message: 'Failed to release legal hold.' },
    });
  }
}

export async function listDeletionCasesHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const cases = await RetentionService.listDeletionCases(tenantId);
    res.status(200).json({ cases, count: cases.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list deletion cases: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'DELETION_CASES_FETCH_ERROR', message: 'Failed to retrieve deletion cases.' },
    });
  }
}

export async function requestDeletionCaseHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userId = authReq.user?.userId || 'unknown_requester';

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  const { documentId, documentTitle, documentType, sourceVersion, legalBasis, retentionPolicyId } = req.body;
  if (!documentId || !documentTitle || !documentType) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'documentId, documentTitle, and documentType are required.' },
    });
    return;
  }

  try {
    const deletionCase = await RetentionService.requestDeletionCase(tenantId, userId, {
      documentId,
      documentTitle,
      documentType,
      sourceVersion,
      legalBasis,
      retentionPolicyId,
    });
    res.status(201).json({ case: deletionCase });
  } catch (err: any) {
    Logger.error({
      message: `Failed to request deletion case: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'DELETION_REQUEST_ERROR', message: 'Failed to submit deletion request.' },
    });
  }
}

export async function approveDeletionCaseHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const approverId = authReq.user?.userId || 'unknown_approver';
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const approvedCase = await RetentionService.approveDeletionCase(tenantId, id, approverId);
    res.status(200).json({ success: true, case: approvedCase });
  } catch (err: any) {
    const isSodViolation = err.message.includes('Separation of Duties');
    res.status(isSodViolation ? 403 : 400).json({
      error: { code: isSodViolation ? 'SOD_VIOLATION' : 'APPROVAL_ERROR', message: err.message },
    });
  }
}

export async function executePurgeHandler(req: Request, res: Response): Promise<void> {
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
    const result = await RetentionService.executePurge(tenantId, id);
    if (result.status === 'PAUSED_BY_LEGAL_HOLD') {
      res.status(409).json({
        status: 'PAUSED_BY_LEGAL_HOLD',
        message: 'Purge execution frozen: Active legal hold is in place for this document.',
        case: result,
      });
      return;
    }
    res.status(200).json({ success: true, case: result });
  } catch (err: any) {
    Logger.error({
      message: `Failed to execute purge for case ${id}: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'PURGE_EXECUTION_ERROR', message: err.message },
    });
  }
}

export async function getPurgeEvidenceHandler(req: Request, res: Response): Promise<void> {
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
    const deletionCase = await RetentionService.getDeletionCase(tenantId, id);
    if (!deletionCase) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Deletion case not found.' },
      });
      return;
    }

    const ledger = await RetentionService.listPurgeLedger(tenantId, id);
    res.status(200).json({
      caseId: deletionCase.id,
      documentId: deletionCase.documentId,
      status: deletionCase.status,
      evidence: deletionCase.evidence,
      purgeSignatureHash: deletionCase.purgeSignatureHash,
      auditLedger: ledger,
    });
  } catch (err: any) {
    Logger.error({
      message: `Failed to get purge evidence: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'EVIDENCE_FETCH_ERROR', message: 'Failed to retrieve purge evidence.' },
    });
  }
}

export async function listPurgeLedgerHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  try {
    const caseId = req.query.caseId as string | undefined;
    const ledger = await RetentionService.listPurgeLedger(tenantId, caseId);
    res.status(200).json({ ledger, count: ledger.length });
  } catch (err: any) {
    Logger.error({
      message: `Failed to list purge audit ledger: ${err.message}`,
      context: 'RetentionController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'LEDGER_FETCH_ERROR', message: 'Failed to retrieve purge audit ledger.' },
    });
  }
}
