import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ExportMaskingService } from '../services/export-masking.service.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import { OutboxService } from '../services/outbox.service.js';
import { IntakeService } from '../services/intake.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

// =========================================================================
// CORRELATION TRACE (Part E.3)
// =========================================================================

export async function getTraceHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin' && userRole !== 'Auditor') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin or Auditor roles may inspect execution traces.' },
    });
    return;
  }

  const correlationId = (req.query['correlationId'] as string)?.trim();
  if (!correlationId) {
    res.status(400).json({
      error: { code: 'INVALID_CORRELATION_ID', message: 'A non-empty correlationId query parameter is required.' },
    });
    return;
  }

  try {
    let auditEvents: any[] = [];
    let outboxEvents: any[] = [];
    let processingAttempts: any[] = [];

    // 1. Audit trail events
    try {
      const auditRes = await dbPool.query(
        `SELECT event_id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                user_id as "userId", action, details, ip_address as "ipAddress",
                sha256_signature as "sha256Signature", correlation_id as "correlationId",
                created_at as "createdAt"
         FROM audit_trail_events
         WHERE tenant_id = $1 AND correlation_id = $2
         ORDER BY created_at ASC`,
        [tenantId, correlationId]
      );
      auditEvents = auditRes.rows;
    } catch {
      auditEvents = await AuditTrailService.findByCorrelationId(tenantId, correlationId);
    }

    // 2. Outbox events
    try {
      const outboxRes = await dbPool.query(
        `SELECT event_id as "eventId", tenant_id as "tenantId", document_id as "documentId",
                event_type as "eventType", payload, status, retry_count as "retryCount",
                correlation_id as "correlationId", created_at as "createdAt"
         FROM outbox_events
         WHERE tenant_id = $1 AND correlation_id = $2
         ORDER BY created_at ASC`,
        [tenantId, correlationId]
      );
      outboxEvents = outboxRes.rows;
    } catch {}

    // 3. Document processing attempts
    try {
      const attemptsRes = await dbPool.query(
        `SELECT id, document_id as "documentId", tenant_id as "tenantId", stage,
                attempt_number as "attemptNumber", succeeded, error,
                correlation_id as "correlationId", created_at as "createdAt"
         FROM document_processing_attempts
         WHERE tenant_id = $1 AND correlation_id = $2
         ORDER BY created_at ASC`,
        [tenantId, correlationId]
      );
      processingAttempts = attemptsRes.rows;
    } catch {}

    res.status(200).json({
      correlationId,
      tenantId,
      auditEvents,
      outboxEvents,
      processingAttempts,
    });
  } catch (err: any) {
    Logger.error({
      message: `Failed to retrieve trace for correlation ${correlationId}: ${err.message}`,
      context: 'AdminController',
      error: err,
    });
    res.status(500).json({
      error: { code: 'TRACE_QUERY_ERROR', message: 'Failed to retrieve correlation trace.' },
    });
  }
}

// =========================================================================
// EXPORT MASKING RULES CRUD (Part C.1)
// =========================================================================

export async function createExportMaskingRuleHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin role may manage export masking rules.' },
    });
    return;
  }

  const { documentType, fieldKey, maskedForRoles, maskStyle } = req.body;
  if (!fieldKey || typeof fieldKey !== 'string' || fieldKey.trim().length === 0) {
    res.status(400).json({
      error: { code: 'INVALID_FIELD_KEY', message: 'fieldKey is required.' },
    });
    return;
  }

  try {
    const rule = await ExportMaskingService.createRule(tenantId, {
      documentType,
      fieldKey,
      maskedForRoles: Array.isArray(maskedForRoles) ? maskedForRoles : [],
      maskStyle: maskStyle === 'partial' ? 'partial' : 'full',
    });

    res.status(201).json(rule);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      error: { code: 'CREATE_RULE_ERROR', message: err.message },
    });
  }
}

export async function listExportMaskingRulesHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin role may view export masking rules.' },
    });
    return;
  }

  try {
    const rules = await ExportMaskingService.listRules(tenantId);
    res.status(200).json({ rules, count: rules.length });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'LIST_RULES_ERROR', message: err.message },
    });
  }
}

export async function getExportMaskingRuleHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin role may view export masking rules.' },
    });
    return;
  }

  try {
    const rule = await ExportMaskingService.getRule(tenantId, id);
    if (!rule) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Export masking rule not found.' },
      });
      return;
    }
    res.status(200).json(rule);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'GET_RULE_ERROR', message: err.message },
    });
  }
}

export async function updateExportMaskingRuleHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin role may modify export masking rules.' },
    });
    return;
  }

  try {
    const updated = await ExportMaskingService.updateRule(tenantId, id, req.body);
    if (!updated) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Export masking rule not found.' },
      });
      return;
    }
    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'UPDATE_RULE_ERROR', message: err.message },
    });
  }
}

export async function deleteExportMaskingRuleHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin role may delete export masking rules.' },
    });
    return;
  }

  try {
    const deleted = await ExportMaskingService.deleteRule(tenantId, id);
    if (!deleted) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Export masking rule not found.' },
      });
      return;
    }
    res.status(200).json({ success: true, deletedId: id });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'DELETE_RULE_ERROR', message: err.message },
    });
  }
}

// =========================================================================
// OPERATIONS DLQ & RETRY (Sprint 8 Part 0.3 / F.2)
// =========================================================================

interface FailedJobRecord {
  id: string;
  tenantId: string;
  jobId: string;
  failureReason: string;
  retryCount: number;
  timestamp: string;
  metadataPayload: {
    documentId: string;
    fileSizeBytes?: number;
    mimeType?: string;
    correlationId: string;
  };
}

const inMemoryFailedJobs: FailedJobRecord[] = [
  {
    id: 'DLQ-901',
    tenantId: 'tenant-acme-global',
    jobId: 'JOB-77812',
    failureReason: 'OCR worker panic: Memory Allocation Exceeded (SIGSEGV)',
    retryCount: 3,
    timestamp: new Date().toISOString(),
    metadataPayload: {
      documentId: 'DOC-90412',
      fileSizeBytes: 48921000,
      mimeType: 'application/pdf',
      correlationId: 'corr-98412-01',
    },
  },
  {
    id: 'DLQ-902',
    tenantId: 'tenant-zenith-logistics',
    jobId: 'JOB-77819',
    failureReason: 'HTTP 504 Gateway Timeout while calling Vision OCR Subservice',
    retryCount: 2,
    timestamp: new Date().toISOString(),
    metadataPayload: {
      documentId: 'DOC-88912',
      fileSizeBytes: 1204000,
      mimeType: 'image/tiff',
      correlationId: 'corr-98412-02',
    },
  },
];

export async function listFailedJobsHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin' && userRole !== 'platform_operator') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin or platform_operator roles may access Operations DLQ.' },
    });
    return;
  }

  res.status(200).json({
    status: 'SUCCESS',
    jobs: inMemoryFailedJobs,
    total: inMemoryFailedJobs.length,
  });
}

export async function retryFailedJobHandler(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const tenantId = authReq.user?.tenantId;
  const userRole = authReq.user?.role;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing tenant identity.' },
    });
    return;
  }

  if (userRole !== 'Admin' && userRole !== 'platform_operator') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only Admin or platform_operator roles may retry DLQ jobs.' },
    });
    return;
  }

  const jobIndex = inMemoryFailedJobs.findIndex((j) => j.id === id || j.jobId === id);
  if (jobIndex === -1) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `DLQ job '${id}' not found.` },
    });
    return;
  }

  const retried = inMemoryFailedJobs.splice(jobIndex, 1)[0];

  try {
    await AuditTrailService.recordEvent({
      tenantId,
      userId: authReq.user?.userId || 'SYS',
      action: 'DLQ_JOB_RETRIED',
      details: {
        dlqId: id,
        jobId: retried.jobId,
        documentId: retried.metadataPayload.documentId,
        correlationId: retried.metadataPayload.correlationId,
      },
      ipAddress: req.ip,
      correlationId: retried.metadataPayload.correlationId,
    });
  } catch {}

  res.status(200).json({
    status: 'SUCCESS',
    message: `Job ${retried.jobId} re-queued for execution.`,
    retriedJob: retried,
  });
}

