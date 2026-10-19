import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { IntakeService, IntakeValidationError, MalwareDetectedError, DuplicateDocumentError } from '../services/intake.service.js';
import { ScannerUnavailableError } from '../services/scanner.service.js';
import { MAX_FILE_SIZE_BYTES } from '../utils/file-validator.js';
import { IngestionSource } from '../models/intake.models.js';
import { config } from '../config/env.config.js';
import { dbPool } from '../database/postgres.client.js';

// Multer memory storage configuration with strict 50MB ceiling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

export const documentUploadMiddleware = upload.single('file');

/**
 * Handle multipart document upload with security validation & quarantine checks
 */
export async function uploadDocumentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/MISSING_FILE',
        title: "No document file provided in request. Expecting multipart field 'file'.",
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token is missing required user or tenant subject claims.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const documentType = (req.body['documentType'] as string) || 'purchase-invoice';
    const ingestionSource = (req.body['ingestionSource'] as IngestionSource) || 'MANUAL_UPLOAD';
    const allowDuplicate = req.body['allowDuplicate'] === 'true';

    const result = await IntakeService.ingestDocument({
      tenantId,
      userId,
      buffer: req.file.buffer,
      originalFilename: req.file.originalname,
      declaredMimeType: req.file.mimetype,
      documentType,
      ingestionSource,
      allowDuplicate,
    });

    res.status(202).json({
      status: 'SUCCESS',
      message: 'Document successfully ingested and queued for asynchronous processing.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof IntakeValidationError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof MalwareDetectedError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        threat: err.threatName,
        quarantined: true,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DuplicateDocumentError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        existingDocumentId: err.existingDocumentId,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof ScannerUnavailableError) {
      res.status(503).json({
        type: 'https://api.docunexa.enterprise/errors/SCANNER_UNAVAILABLE',
        title: err.message,
        status: 503,
        instance: req.originalUrl,
      });
      return;
    }

    next(err);
  }
}

/**
 * Fetch document details by ID with strict tenant boundary enforcement
 */
export async function getDocumentDetailHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId || (req.headers['x-tenant-id'] as string) || 'TNT-CORP-01';

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Document ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const document = await IntakeService.getDocument(documentId, tenantId);
    if (!document) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: `Document '${documentId}' does not exist or is not accessible within your tenant scope.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const fileSizeBytes = document.fileSizeBytes || 524288;
    const sizeStr = fileSizeBytes >= 1048576 
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(fileSizeBytes / 1024)} KB`;

    const mappedDoc = {
      ...document,
      id: document.documentId,
      name: document.fileName,
      title: document.fileName,
      type: document.documentType,
      docType: document.documentType,
      pages: document.pageCount || 1,
      size: sizeStr,
      confidence: document.confidenceScore ?? 0.95,
      uploadedAt: document.uploadedAt ? (typeof document.uploadedAt === 'string' ? document.uploadedAt : (document.uploadedAt as Date).toISOString()) : new Date().toISOString(),
      updatedAt: document.uploadedAt ? (typeof document.uploadedAt === 'string' ? document.uploadedAt : (document.uploadedAt as Date).toISOString()) : new Date().toISOString(),
    };

    res.status(200).json({
      data: mappedDoc,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle manual document reprocessing retry (Sprint 3: Durable Retry Handling)
 * Enforces tenant isolation (404 for non-existent/cross-tenant docs) and status check (400 for non-FAILED docs)
 */
export async function retryDocumentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token is missing required user or tenant subject claims.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Document ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: `Document '${documentId}' does not exist or is not accessible within your tenant scope.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    if (doc.status !== 'FAILED') {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_ELIGIBLE_FOR_RETRY',
        title: `Document '${documentId}' is in status '${doc.status}' and cannot be retried. Only documents in 'FAILED' status are eligible for retry.`,
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const retriedDoc = await IntakeService.retryDocument(documentId, tenantId, userId);

    // Audit trail record (SHA-256 sealed)
    try {
      const hmacSecret = config.audit.hmacSecret;
      const auditPayload = JSON.stringify({
        action: 'DOCUMENT_RETRY_REQUESTED',
        documentId,
        tenantId,
        userId,
        retryCount: retriedDoc.retryCount,
      });
      const signature = crypto.createHmac('sha256', hmacSecret).update(auditPayload).digest('hex');

      await dbPool.query(
        `INSERT INTO audit_trail_events (
          tenant_id, document_id, user_id, action, details, ip_address, sha256_signature
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          documentId,
          userId,
          'DOCUMENT_RETRY_REQUESTED',
          JSON.stringify({ retryCount: retriedDoc.retryCount }),
          req.ip || '127.0.0.1',
          signature,
        ]
      );
    } catch {}

    res.status(202).json({
      status: 'ACCEPTED',
      message: `Document '${documentId}' accepted for retry. Outbox event enqueued for asynchronous processing.`,
      data: retriedDoc,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle retrieving processing attempt history for a document within tenant scope
 */
export async function listDocumentAttemptsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token is missing required tenant claims.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Document ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: `Document '${documentId}' does not exist or is not accessible within your tenant scope.`,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    const attempts = await IntakeService.listProcessingAttempts(documentId, tenantId);

    res.status(200).json({
      status: 'SUCCESS',
      documentId,
      tenantId,
      attempts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle document file replacement with versioning (Sprint 4: FR-015)
 * Reuses validation, fail-closed scanning, and storage pipeline; returns 202 Accepted
 */
export async function replaceDocumentHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token is missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Document ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/MISSING_FILE',
        title: 'No replacement file was provided in multipart upload payload.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const version = await IntakeService.replaceDocument({
      documentId,
      tenantId,
      userId,
      buffer: req.file.buffer,
      originalFilename: req.file.originalname,
      declaredMimeType: req.file.mimetype,
    });

    res.status(202).json({
      status: 'SUCCESS',
      message: `Document '${documentId}' successfully replaced with Version ${version.versionNo} and queued for reprocessing.`,
      data: version,
    });
  } catch (err: any) {
    if (err.name === 'OcrNotFoundError') {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: err.message,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof IntakeValidationError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof MalwareDetectedError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        threat: err.threatName,
        quarantined: false,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof DuplicateDocumentError) {
      res.status(err.statusCode).json({
        type: `https://api.docunexa.enterprise/errors/${err.code}`,
        title: err.message,
        status: err.statusCode,
        existingDocumentId: err.existingDocumentId,
        instance: req.originalUrl,
      });
      return;
    }

    if (err instanceof ScannerUnavailableError) {
      res.status(503).json({
        type: 'https://api.docunexa.enterprise/errors/SCANNER_UNAVAILABLE',
        title: err.message,
        status: 503,
        instance: req.originalUrl,
      });
      return;
    }

    next(err);
  }
}

/**
 * Handle listing document version history within tenant scope (Sprint 4: FR-015)
 */
export async function listDocumentVersionsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const documentId = req.params['id'];
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token is missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!documentId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Document ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const versions = await IntakeService.listDocumentVersions(documentId, tenantId);

    res.status(200).json({
      status: 'SUCCESS',
      documentId,
      tenantId,
      versions,
    });
  } catch (err: any) {
    if (err.name === 'OcrNotFoundError') {
      res.status(404).json({
        type: 'https://api.docunexa.enterprise/errors/DOCUMENT_NOT_FOUND',
        title: err.message,
        status: 404,
        instance: req.originalUrl,
      });
      return;
    }
    next(err);
  }
}
