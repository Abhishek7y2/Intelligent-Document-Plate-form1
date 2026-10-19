import { DocumentRecord, DocumentStatus, DocumentProcessingAttempt, DocumentVersion, IngestionSource, UploadSuccessResponse } from '../models/intake.models.js';
import { validateUploadFile, sanitizeFileName, generateStorageKey } from '../utils/file-validator.js';
import { MalwareScanner, MockMalwareScanner, ScannerFactory } from './scanner.service.js';
import { ObjectStorageService, MemoryStorageService, StorageFactory } from './storage.service.js';
import { OutboxService } from './outbox.service.js';
import { Logger } from '../utils/logger.js';
import { dbPool } from '../database/postgres.client.js';
import { config } from '../config/env.config.js';
import { getCorrelationId } from '../middleware/correlation.middleware.js';
import crypto from 'crypto';

export class IntakeValidationError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'INVALID_FILE_PAYLOAD') {
    super(message);
    this.name = 'IntakeValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class MalwareDetectedError extends Error {
  statusCode: number;
  code: string;
  threatName: string;
  constructor(threatName: string) {
    super(`Malware detected: file rejected with threat signature '${threatName}'. File quarantined.`);
    this.name = 'MalwareDetectedError';
    this.statusCode = 422;
    this.code = 'MALWARE_DETECTED';
    this.threatName = threatName;
  }
}

export class DuplicateDocumentError extends Error {
  statusCode: number;
  code: string;
  existingDocumentId: string;
  constructor(existingDocumentId: string, hash: string) {
    super(`A document with matching SHA-256 hash '${hash}' already exists in this tenant (ID: ${existingDocumentId}).`);
    this.name = 'DuplicateDocumentError';
    this.statusCode = 409;
    this.code = 'DUPLICATE_DOCUMENT';
    this.existingDocumentId = existingDocumentId;
  }
}

export class DocumentNotEligibleError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'DOCUMENT_NOT_ELIGIBLE_FOR_PROCESSING') {
    super(message);
    this.name = 'DocumentNotEligibleError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class OcrNotFoundError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string) {
    super(message);
    this.name = 'OcrNotFoundError';
    this.statusCode = 404;
    this.code = 'OCR_RESULT_NOT_FOUND';
  }
}

export interface IngestOptions {
  tenantId: string;
  userId: string;
  buffer: Buffer;
  originalFilename: string;
  declaredMimeType: string;
  documentType?: string;
  ingestionSource?: IngestionSource;
  allowDuplicate?: boolean;
}

export class IntakeService {
  private static scanner: MalwareScanner = ScannerFactory.getScanner();
  private static storage: ObjectStorageService = StorageFactory.getStorage();
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryDocs = new Map<string, DocumentRecord>();
  private static inMemoryAttempts = new Map<string, DocumentProcessingAttempt[]>();
  private static inMemoryVersions = new Map<string, DocumentVersion[]>();

  static setScanner(scanner: MalwareScanner): void {
    this.scanner = scanner;
  }

  static setStorage(storage: ObjectStorageService): void {
    this.storage = storage;
  }

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStorage(): ObjectStorageService {
    return this.storage || StorageFactory.getStorage();
  }

  static getScanner(): MalwareScanner {
    return this.scanner || ScannerFactory.getScanner();
  }

  static clearInMemory(): void {
    this.inMemoryDocs.clear();
    this.inMemoryAttempts.clear();
    this.inMemoryVersions.clear();
  }

  static setInMemoryDocument(doc: DocumentRecord): void {
    this.inMemoryDocs.set(doc.documentId, { ...doc });
  }

  static getTenantDocuments(tenantId: string): DocumentRecord[] {
    const results: DocumentRecord[] = [];
    for (const doc of this.inMemoryDocs.values()) {
      if (doc.tenantId === tenantId) {
        results.push({ ...doc });
      }
    }
    return results;
  }

  static async updateDocument(
    documentId: string,
    tenantId: string,
    updates: Partial<DocumentRecord>
  ): Promise<DocumentRecord | null> {
    const doc = await this.getDocument(documentId, tenantId);
    if (!doc) return null;

    const updated: DocumentRecord = {
      ...doc,
      ...updates,
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `UPDATE documents
           SET status = COALESCE($1, status),
               stage = COALESCE($2, stage),
               confidence_score = COALESCE($3, confidence_score),
               page_count = COALESCE($4, page_count),
               processed_at = COALESCE($5, processed_at)
           WHERE document_id = $6 AND tenant_id = $7`,
          [
            updates.status,
            updates.stage,
            updates.confidenceScore,
            updates.pageCount,
            updates.processedAt,
            documentId,
            tenantId,
          ]
        );
      } catch (err: any) {
        Logger.error({ message: `Database error updating document ${documentId}: ${err.message}`, error: err });
        throw err;
      }
    } else {
      this.inMemoryDocs.set(documentId, updated);
    }

    return updated;
  }

  /**
   * Atomically claims a document for processing, preventing concurrent processing race conditions
   * across multiple instances and enforcing eligibility checks.
   */
  static async claimDocumentForProcessing(
    documentId: string,
    tenantId: string
  ): Promise<DocumentRecord> {
    if (this.storeMode === 'database') {
      const updateRes = await dbPool.query(
        `UPDATE documents
         SET status = 'PROCESSING', stage = 'OCR_PIPELINE_ACTIVE'
         WHERE document_id = $1 AND tenant_id = $2
           AND status NOT IN ('PROCESSING', 'QUARANTINED', 'REJECTED', 'PENDING_SCAN')
           AND (status != 'FAILED' OR stage = 'OCR_PIPELINE_FAILED')
         RETURNING *`,
        [documentId, tenantId]
      );

      if (updateRes.rows.length > 0) {
        const row = updateRes.rows[0];
        return {
          documentId: row.document_id,
          tenantId: row.tenant_id,
          fileName: row.file_name,
          storagePath: row.file_path,
          fileSizeBytes: parseInt(row.file_size_bytes, 10),
          mimeType: row.mime_type,
          sha256Hash: row.sha256_hash,
          documentType: row.document_type,
          status: row.status,
          stage: row.stage,
          confidenceScore: row.confidence_score !== null ? parseFloat(row.confidence_score) : null,
          slaStatus: row.sla_status,
          ingestionSource: row.ingestion_source,
          pageCount: row.page_count,
          uploadedAt: row.uploaded_at,
          quarantineReason: row.quarantine_reason,
        };
      }

      // If 0 rows updated, query why to throw appropriate RFC 7807 problem details
      const checkRes = await dbPool.query(
        `SELECT status, stage, quarantine_reason FROM documents WHERE document_id = $1 AND tenant_id = $2`,
        [documentId, tenantId]
      );

      if (checkRes.rows.length === 0) {
        throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
      }

      const current = checkRes.rows[0];
      if (current.status === 'QUARANTINED') {
        throw new DocumentNotEligibleError(
          `Document '${documentId}' is quarantined due to malware and is prohibited from entering the processing pipeline.`,
          403,
          'DOCUMENT_QUARANTINED'
        );
      }
      if (current.status === 'PROCESSING') {
        throw new DocumentNotEligibleError(
          `Document '${documentId}' is already undergoing active OCR processing.`,
          409,
          'DOCUMENT_ALREADY_PROCESSING'
        );
      }
      if (current.status === 'REJECTED') {
        throw new DocumentNotEligibleError(`Document '${documentId}' is marked as rejected.`, 400, 'DOCUMENT_REJECTED');
      }
      if (current.status === 'PENDING_SCAN') {
        throw new DocumentNotEligibleError(
          `Document '${documentId}' has not completed mandatory pre-flight security scanning.`,
          400,
          'DOCUMENT_NOT_SCANNED'
        );
      }
      if (current.status === 'FAILED' && current.stage !== 'OCR_PIPELINE_FAILED') {
        throw new DocumentNotEligibleError(
          `Document '${documentId}' has failed ingestion and cannot be processed.`,
          400,
          'DOCUMENT_FAILED'
        );
      }

      throw new DocumentNotEligibleError(`Document '${documentId}' is not in an eligible state for processing.`, 400, 'DOCUMENT_NOT_ELIGIBLE');
    }

    // In-memory atomic state claim (single-thread synchronous block in event loop)
    const doc = this.inMemoryDocs.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined due to malware and is prohibited from entering the processing pipeline.`,
        403,
        'DOCUMENT_QUARANTINED'
      );
    }
    if (doc.status === 'PROCESSING') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is already undergoing active OCR processing.`,
        409,
        'DOCUMENT_ALREADY_PROCESSING'
      );
    }
    if (doc.status === 'REJECTED') {
      throw new DocumentNotEligibleError(`Document '${documentId}' is marked as rejected.`, 400, 'DOCUMENT_REJECTED');
    }
    if (doc.status === 'FAILED' && doc.stage !== 'OCR_PIPELINE_FAILED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' has failed ingestion and cannot be processed.`,
        400,
        'DOCUMENT_FAILED'
      );
    }
    if (doc.status === 'PENDING_SCAN') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' has not completed mandatory pre-flight security scanning.`,
        400,
        'DOCUMENT_NOT_SCANNED'
      );
    }

    doc.status = 'PROCESSING';
    doc.stage = 'OCR_PIPELINE_ACTIVE';
    return { ...doc };
  }

  /**
   * Secure ingestion workflow
   */
  static async ingestDocument(options: IngestOptions): Promise<UploadSuccessResponse> {
    const {
      tenantId,
      userId,
      buffer,
      originalFilename,
      declaredMimeType,
      documentType = 'purchase-invoice',
      ingestionSource = 'MANUAL_UPLOAD',
      allowDuplicate = false,
    } = options;

    // 1. Pre-flight file validation (Magic bytes, length limits, MIME match)
    const validation = validateUploadFile(buffer, declaredMimeType, originalFilename);
    if (!validation.valid) {
      Logger.warn({
        message: `File upload validation failed: ${validation.error}`,
        context: 'IntakeService',
        data: { tenantId, userId, filename: originalFilename, error: validation.error },
      });
      throw new IntakeValidationError(validation.error || 'File validation failed.', 422, 'FILE_VALIDATION_FAILED');
    }

    const sanitizedFilename = sanitizeFileName(originalFilename);
    const documentId = `DOC-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`;

    // 2. Check for duplicate SHA-256 within the same tenant if deduplication requested
    if (!allowDuplicate) {
      const existing = await this.findByHash(tenantId, validation.sha256Hash);
      if (existing) {
        Logger.warn({
          message: `Duplicate document rejected: ${validation.sha256Hash}`,
          context: 'IntakeService',
          data: { tenantId, existingId: existing.documentId, sha256: validation.sha256Hash },
        });
        throw new DuplicateDocumentError(existing.documentId, validation.sha256Hash);
      }
    }

    // 3. Pre-flight malware scan before persistent release
    const scanResult = await this.scanner.scanBuffer(buffer, sanitizedFilename);
    if (!scanResult.clean) {
      const quarantineKey = `tenants/${tenantId}/quarantine/${documentId}.${validation.detectedExtension}`;
      await this.storage.putObject(quarantineKey, buffer);

      const quarantinedRecord: DocumentRecord = {
        documentId,
        tenantId,
        fileName: sanitizedFilename,
        storagePath: quarantineKey,
        fileSizeBytes: validation.sizeBytes,
        mimeType: validation.mimeType,
        sha256Hash: validation.sha256Hash,
        documentType,
        status: 'QUARANTINED',
        stage: 'QUARANTINE_ISOLATED',
        confidenceScore: null,
        slaStatus: 'ON_TRACK',
        ingestionSource,
        pageCount: 1,
        uploadedAt: new Date(),
        quarantineReason: `Malware detected by ${scanResult.scanner}: ${scanResult.threatName || 'Unknown Threat'}`,
        scannedAt: scanResult.scannedAt,
      };

      await this.saveDocumentRecord(quarantinedRecord);

      Logger.warn({
        message: `Security incident: Document quarantined due to malware threat ${scanResult.threatName}`,
        context: 'IntakeService',
        data: { documentId, tenantId, threatName: scanResult.threatName, scanner: scanResult.scanner },
      });

      throw new MalwareDetectedError(scanResult.threatName || 'Identified Malicious Signature');
    }

    // 4. Store clean object in persistent staged storage
    const storageKey = generateStorageKey(tenantId, documentId, validation.detectedExtension);
    const stored = await this.storage.putObject(storageKey, buffer);

    // 5. Create active document record
    const record: DocumentRecord = {
      documentId,
      tenantId,
      fileName: sanitizedFilename,
      storagePath: stored.storagePath,
      fileSizeBytes: validation.sizeBytes,
      mimeType: validation.mimeType,
      sha256Hash: validation.sha256Hash,
      documentType,
      status: 'QUEUED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: null,
      slaStatus: 'ON_TRACK',
      ingestionSource,
      pageCount: 1,
      uploadedAt: new Date(),
      scannedAt: scanResult.scannedAt,
    };

    await this.saveDocumentRecord(record);

    Logger.info({
      message: `Document ingested successfully: ${documentId}`,
      context: 'IntakeService',
      data: {
        documentId,
        tenantId,
        fileName: sanitizedFilename,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256Hash,
        status: record.status,
      },
    });

    return {
      documentId: record.documentId,
      fileName: record.fileName,
      sha256Hash: record.sha256Hash,
      fileSizeBytes: record.fileSizeBytes,
      mimeType: record.mimeType,
      documentType: record.documentType,
      status: record.status,
      stage: record.stage,
      uploadedAt: record.uploadedAt.toISOString(),
    };
  }

  /**
   * Retrieve document by ID with strict tenant boundary enforcement
   */
  static async getDocument(documentId: string, tenantId: string): Promise<DocumentRecord | null> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT document_id as "documentId", tenant_id as "tenantId", file_name as "fileName",
                  file_path as "storagePath", file_size_bytes as "fileSizeBytes", mime_type as "mimeType",
                  sha256_hash as "sha256Hash", document_type as "documentType", status, stage,
                  confidence_score as "confidenceScore", sla_status as "slaStatus",
                  ingestion_source as "ingestionSource", page_count as "pageCount", uploaded_at as "uploadedAt"
           FROM documents
           WHERE document_id = $1 AND tenant_id = $2`,
          [documentId, tenantId]
        );
        if (res.rows.length > 0) {
          return res.rows[0];
        }
        return null;
      } catch (err: any) {
        Logger.error({ message: `Database error fetching document ${documentId}: ${err.message}`, error: err });
      }
    }

    const doc = this.inMemoryDocs.get(documentId);
    if (!doc) return null;
    if (doc.tenantId !== tenantId) return null;
    return { ...doc };
  }

  /**
   * List all documents for a tenant
   */
  static async listDocuments(tenantId: string): Promise<DocumentRecord[]> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT document_id as "documentId", tenant_id as "tenantId", file_name as "fileName",
                  file_path as "storagePath", file_size_bytes as "fileSizeBytes", mime_type as "mimeType",
                  sha256_hash as "sha256Hash", document_type as "documentType", status, stage,
                  confidence_score as "confidenceScore", sla_status as "slaStatus",
                  ingestion_source as "ingestionSource", page_count as "pageCount", uploaded_at as "uploadedAt"
           FROM documents
           WHERE tenant_id = $1`,
          [tenantId]
        );
        return res.rows;
      } catch (err: any) {
        Logger.error({ message: `Database error listing documents for tenant ${tenantId}: ${err.message}`, error: err });
        return [];
      }
    }

    const docs: DocumentRecord[] = [];
    for (const doc of this.inMemoryDocs.values()) {
      if (doc.tenantId === tenantId) {
        docs.push({ ...doc });
      }
    }
    return docs;
  }

  private static async findByHash(tenantId: string, hash: string): Promise<DocumentRecord | null> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT document_id as "documentId", tenant_id as "tenantId"
           FROM documents
           WHERE tenant_id = $1 AND sha256_hash = $2`,
          [tenantId, hash]
        );
        return res.rows.length > 0 ? res.rows[0] : null;
      } catch (err: any) {
        Logger.error({ message: `Error checking document hash: ${err.message}`, error: err });
        return null;
      }
    }

    for (const doc of this.inMemoryDocs.values()) {
      if (doc.tenantId === tenantId && doc.sha256Hash === hash && doc.status !== 'QUARANTINED') {
        return doc;
      }
    }
    return null;
  }

  private static async saveDocumentRecord(record: DocumentRecord): Promise<void> {
    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO documents (
            document_id, tenant_id, file_name, file_path, file_size_bytes,
            mime_type, sha256_hash, document_type, status, stage,
            confidence_score, sla_status, ingestion_source, uploaded_at, retry_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            record.documentId,
            record.tenantId,
            record.fileName,
            record.storagePath,
            record.fileSizeBytes,
            record.mimeType,
            record.sha256Hash,
            record.documentType,
            record.status,
            record.stage,
            record.confidenceScore,
            record.slaStatus,
            record.ingestionSource,
            record.uploadedAt,
            record.retryCount || 0,
          ]
        );

        // Atomic Transactional Outbox Event (quarantined files NEVER produce an outbox event)
        if (record.status !== 'QUARANTINED') {
          // Version 1 tracking (Sprint 4: FR-015)
          const versionId = `VER-${record.documentId}-1`;
          await client.query(
            `INSERT INTO document_versions (
              id, document_id, tenant_id, version_no, storage_key, sha256_hash, is_current, created_at
            ) VALUES ($1, $2, $3, 1, $4, $5, true, $6)
            ON CONFLICT (document_id, version_no) DO NOTHING`,
            [versionId, record.documentId, record.tenantId, record.storagePath, record.sha256Hash, record.uploadedAt]
          );

          await OutboxService.recordEvent(
            record.tenantId,
            record.documentId,
            'DOCUMENT_UPLOADED',
            {
              storagePath: record.storagePath,
              fileName: record.fileName,
              mimeType: record.mimeType,
              documentType: record.documentType,
            },
            client
          );
        }

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.code === '23505' && (err.constraint === 'documents_tenant_sha256_key' || err.constraint === 'documents_sha256_hash_key')) {
          throw new DuplicateDocumentError('CONCURRENT_COLLISION', record.sha256Hash);
        }
        Logger.error({ message: `Failed to persist document ${record.documentId}: ${err.message}`, error: err });
        throw err;
      } finally {
        client.release();
      }
      return;
    }

    this.inMemoryDocs.set(record.documentId, { ...record });

    // In-memory atomic outbox recording (quarantined files NEVER produce an outbox event)
    if (record.status !== 'QUARANTINED') {
      const v1: DocumentVersion = {
        id: `VER-${record.documentId}-1`,
        documentId: record.documentId,
        tenantId: record.tenantId,
        versionNo: 1,
        storageKey: record.storagePath,
        sha256Hash: record.sha256Hash,
        isCurrent: true,
        createdBy: null,
        createdAt: record.uploadedAt,
      };
      this.inMemoryVersions.set(record.documentId, [v1]);

      await OutboxService.recordEvent(
        record.tenantId,
        record.documentId,
        'DOCUMENT_UPLOADED',
        {
          storagePath: record.storagePath,
          fileName: record.fileName,
          mimeType: record.mimeType,
          documentType: record.documentType,
        }
      );
    }
  }

  /**
   * Records a document processing attempt into audit history
   */
  static async recordProcessingAttempt(attempt: DocumentProcessingAttempt): Promise<void> {
    const correlationId = attempt.correlationId || (getCorrelationId() !== 'N/A' ? getCorrelationId() : null);
    const enrichedAttempt: DocumentProcessingAttempt = {
      ...attempt,
      correlationId,
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO document_processing_attempts (
            id, document_id, tenant_id, stage, attempt_number, succeeded, error, created_at, correlation_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            enrichedAttempt.id,
            enrichedAttempt.documentId,
            enrichedAttempt.tenantId,
            enrichedAttempt.stage,
            enrichedAttempt.attemptNumber,
            enrichedAttempt.succeeded,
            enrichedAttempt.error || null,
            enrichedAttempt.createdAt,
            enrichedAttempt.correlationId,
          ]
        );
      } catch (err: any) {
        Logger.error({
          message: `Failed to record processing attempt for doc ${attempt.documentId}: ${err.message}`,
          context: 'IntakeService',
          error: err,
        });
      }
      return;
    }

    const list = this.inMemoryAttempts.get(attempt.documentId) || [];
    list.push(enrichedAttempt);
    this.inMemoryAttempts.set(attempt.documentId, list);
  }

  /**
   * Lists all processing attempts for a document within tenant boundary
   */
  static async listProcessingAttempts(documentId: string, tenantId: string): Promise<DocumentProcessingAttempt[]> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, document_id as "documentId", tenant_id as "tenantId", stage,
                  attempt_number as "attemptNumber", succeeded, error, created_at as "createdAt",
                  correlation_id as "correlationId"
           FROM document_processing_attempts
           WHERE document_id = $1 AND tenant_id = $2
           ORDER BY created_at DESC`,
          [documentId, tenantId]
        );
        return res.rows;
      } catch (err: any) {
        Logger.error({
          message: `Failed to list processing attempts for doc ${documentId}: ${err.message}`,
          context: 'IntakeService',
          error: err,
        });
        return [];
      }
    }

    const doc = await this.getDocument(documentId, tenantId);
    if (!doc) return [];
    const list = this.inMemoryAttempts.get(documentId) || [];
    return list.filter((a) => a.tenantId === tenantId);
  }

  /**
   * Manually retries a failed document: enforces tenant isolation, status check,
   * atomically updates status to QUEUED and writes DOCUMENT_RETRY_REQUESTED outbox event.
   */
  static async retryDocument(documentId: string, tenantId: string, userId: string): Promise<DocumentRecord> {
    const doc = await this.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    if (doc.status !== 'FAILED') {
      throw new DocumentNotEligibleError(
        `[DOCUMENT_NOT_ELIGIBLE_FOR_RETRY] Document '${documentId}' has status '${doc.status}' and cannot be retried. Only documents in 'FAILED' status are eligible for retry.`,
        400,
        'DOCUMENT_NOT_ELIGIBLE_FOR_RETRY'
      );
    }

    const newRetryCount = (doc.retryCount || 0) + 1;
    const updatedStatus: DocumentStatus = 'QUEUED';
    const updatedStage = 'INGESTION_COMPLETE';

    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE documents
           SET status = $1, stage = $2, retry_count = $3, last_error = NULL
           WHERE document_id = $4 AND tenant_id = $5`,
          [updatedStatus, updatedStage, newRetryCount, documentId, tenantId]
        );

        await OutboxService.recordEvent(
          tenantId,
          documentId,
          'DOCUMENT_RETRY_REQUESTED',
          {
            storagePath: doc.storagePath,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            documentType: doc.documentType,
            retryCount: newRetryCount,
            requestedBy: userId,
          },
          client
        );

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    doc.status = updatedStatus;
    doc.stage = updatedStage;
    doc.retryCount = newRetryCount;
    doc.lastError = null;
    this.inMemoryDocs.set(documentId, doc);

    if (this.storeMode !== 'database') {
      await OutboxService.recordEvent(
        tenantId,
        documentId,
        'DOCUMENT_RETRY_REQUESTED',
        {
          storagePath: doc.storagePath,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          documentType: doc.documentType,
          retryCount: newRetryCount,
          requestedBy: userId,
        }
      );
    }

    Logger.info({
      message: `Document ${documentId} manually retried by user ${userId} (Attempt #${newRetryCount})`,
      context: 'IntakeService',
      data: { documentId, tenantId, userId, retryCount: newRetryCount },
    });

    return doc;
  }

  /**
   * Retrieves all historical versions for a document within tenant scope
   */
  static async listDocumentVersions(documentId: string, tenantId: string): Promise<DocumentVersion[]> {
    const doc = await this.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, document_id as "documentId", tenant_id as "tenantId",
                  version_no as "versionNo", storage_key as "storageKey",
                  sha256_hash as "sha256Hash", is_current as "isCurrent",
                  created_by as "createdBy", created_at as "createdAt"
           FROM document_versions
           WHERE document_id = $1 AND tenant_id = $2
           ORDER BY version_no DESC`,
          [documentId, tenantId]
        );
        if (res.rows.length > 0) {
          return res.rows;
        }
      } catch (err: any) {
        Logger.warn({ message: `Database error querying document_versions: ${err.message}`, context: 'IntakeService' });
      }
    }

    const versions = this.inMemoryVersions.get(documentId) || [];
    return [...versions].sort((a, b) => b.versionNo - a.versionNo);
  }

  /**
   * Replaces document file with a new version (FR-015):
   * Validates file, scans for malware, preserves original object,
   * inserts new version, marks previous versions superseded, writes outbox event, and audits action.
   */
  static async replaceDocument(options: {
    documentId: string;
    tenantId: string;
    userId: string;
    buffer: Buffer;
    originalFilename: string;
    declaredMimeType: string;
  }): Promise<DocumentVersion> {
    const { documentId, tenantId, userId, buffer, originalFilename, declaredMimeType } = options;

    // 1. Enforce tenant boundary (returns 404 for documents in other tenants)
    const existingDoc = await this.getDocument(documentId, tenantId);
    if (!existingDoc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    // 2. Pre-flight file validation (magic bytes, MIME check)
    const validation = validateUploadFile(buffer, declaredMimeType, originalFilename);
    if (!validation.valid) {
      Logger.warn({
        message: `File upload validation failed during document replace: ${validation.error}`,
        context: 'IntakeService',
        data: { tenantId, userId, documentId, error: validation.error },
      });
      throw new IntakeValidationError(validation.error || 'File validation failed.', 422, 'FILE_VALIDATION_FAILED');
    }

    // 3. Duplicate SHA-256 check within tenant (reject if duplicate of a DIFFERENT document)
    const existingHashDoc = await this.findByHash(tenantId, validation.sha256Hash);
    if (existingHashDoc && existingHashDoc.documentId !== documentId) {
      Logger.warn({
        message: `Duplicate document rejected during replace: hash matches document ${existingHashDoc.documentId}`,
        context: 'IntakeService',
        data: { tenantId, existingId: existingHashDoc.documentId, sha256: validation.sha256Hash },
      });
      throw new DuplicateDocumentError(existingHashDoc.documentId, validation.sha256Hash);
    }

    // 4. Pre-flight malware scan (fail-closed)
    const scanResult = await this.scanner.scanBuffer(buffer, originalFilename);
    if (!scanResult.clean) {
      Logger.warn({
        message: `Security incident: Replacement document file rejected due to malware threat ${scanResult.threatName}`,
        context: 'IntakeService',
        data: { documentId, tenantId, threatName: scanResult.threatName, scanner: scanResult.scanner },
      });
      // Infected files produce NO version and NO outbox event
      throw new MalwareDetectedError(scanResult.threatName || 'Identified Malicious Signature');
    }

    // 5. Determine next version number
    const existingVersions = await this.listDocumentVersions(documentId, tenantId);
    const nextVersionNo = existingVersions.length > 0 
      ? Math.max(...existingVersions.map((v) => v.versionNo)) + 1 
      : 2;

    const sanitizedFilename = sanitizeFileName(originalFilename);
    const newVersionId = `VER-${documentId}-${nextVersionNo}`;

    // 6. Store in persistent storage under a new versioned key (Never overwrite original!)
    const versionStorageKey = generateStorageKey(tenantId, `${documentId}-v${nextVersionNo}`, validation.detectedExtension);
    const stored = await this.storage.putObject(versionStorageKey, buffer);

    const newVersionRecord: DocumentVersion = {
      id: newVersionId,
      documentId,
      tenantId,
      versionNo: nextVersionNo,
      storageKey: stored.storagePath,
      sha256Hash: validation.sha256Hash,
      isCurrent: true,
      createdBy: userId,
      createdAt: new Date(),
    };

    // 7. Atomic transaction in database
    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Demote current status on older versions
        await client.query(
          `UPDATE document_versions
           SET is_current = FALSE
           WHERE document_id = $1 AND tenant_id = $2`,
          [documentId, tenantId]
        );

        // Insert new version
        await client.query(
          `INSERT INTO document_versions (
            id, document_id, tenant_id, version_no, storage_key, sha256_hash, is_current, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)`,
          [
            newVersionRecord.id,
            newVersionRecord.documentId,
            newVersionRecord.tenantId,
            newVersionRecord.versionNo,
            newVersionRecord.storageKey,
            newVersionRecord.sha256Hash,
            newVersionRecord.createdBy,
            newVersionRecord.createdAt,
          ]
        );

        // Update document workflow table
        await client.query(
          `UPDATE documents
           SET file_name = $1, file_path = $2, file_size_bytes = $3, mime_type = $4,
               sha256_hash = $5, status = 'QUEUED', stage = 'INGESTION_COMPLETE',
               confidence_score = NULL
           WHERE document_id = $6 AND tenant_id = $7`,
          [
            sanitizedFilename,
            newVersionRecord.storageKey,
            validation.sizeBytes,
            validation.mimeType,
            validation.sha256Hash,
            documentId,
            tenantId,
          ]
        );

        // Mark pending approvals and review tasks for previous version as SUPERSEDED
        await client.query(
          `UPDATE approval_requests
           SET status = 'SUPERSEDED', updated_at = NOW()
           WHERE document_id = $1 AND tenant_id = $2 AND status = 'PENDING'`,
          [documentId, tenantId]
        );

        await client.query(
          `UPDATE review_tasks
           SET status = 'SUPERSEDED', updated_at = NOW()
           WHERE document_id = $1 AND tenant_id = $2 AND status IN ('Pending Review', 'IN_REVIEW')`,
          [documentId, tenantId]
        );

        // Write DOCUMENT_REPLACED outbox event atomically
        await OutboxService.recordEvent(
          tenantId,
          documentId,
          'DOCUMENT_REPLACED',
          {
            versionNo: nextVersionNo,
            storagePath: stored.storagePath,
            fileName: sanitizedFilename,
            mimeType: validation.mimeType,
            sourceVersionId: newVersionRecord.id,
            sha256Hash: validation.sha256Hash,
            replacedBy: userId,
          },
          client
        );

        // Record HMAC-signed audit trail event
        try {
          const hmacSecret = config.audit.hmacSecret;
          const auditPayload = JSON.stringify({
            action: 'DOCUMENT_REPLACED',
            documentId,
            tenantId,
            userId,
            versionNo: nextVersionNo,
            newSha256: validation.sha256Hash,
          });
          const signature = crypto.createHmac('sha256', hmacSecret).update(auditPayload).digest('hex');

          await client.query(
            `INSERT INTO audit_trail_events (
              tenant_id, document_id, user_id, action, details, ip_address, sha256_signature
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              tenantId,
              documentId,
              userId,
              'DOCUMENT_REPLACED',
              JSON.stringify({ versionNo: nextVersionNo, fileName: sanitizedFilename, sha256: validation.sha256Hash }),
              '127.0.0.1',
              signature,
            ]
          );
        } catch {}

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({ message: `Database error replacing document ${documentId}: ${err.message}`, error: err });
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory update
    const memVersions = this.inMemoryVersions.get(documentId) || [];
    for (const v of memVersions) {
      v.isCurrent = false;
    }
    memVersions.push(newVersionRecord);
    this.inMemoryVersions.set(documentId, memVersions);

    existingDoc.fileName = sanitizedFilename;
    existingDoc.storagePath = stored.storagePath;
    existingDoc.fileSizeBytes = validation.sizeBytes;
    existingDoc.mimeType = validation.mimeType;
    existingDoc.sha256Hash = validation.sha256Hash;
    existingDoc.status = 'QUEUED';
    existingDoc.stage = 'INGESTION_COMPLETE';
    existingDoc.confidenceScore = null;
    this.inMemoryDocs.set(documentId, existingDoc);

    // In-memory superseding of pending reviews & approvals
    try {
      const { ReviewService } = await import('./review.service.js');
      for (const [key, task] of ReviewService.inMemoryTasks.entries()) {
        if ((task.docId === documentId || (task as any).documentId === documentId) && task.tenantId === tenantId) {
          (task as any).status = 'SUPERSEDED';
        }
      }
    } catch {}

    try {
      const { ApprovalService } = await import('./approval.service.js');
      for (const [key, app] of ApprovalService.inMemoryRequests.entries()) {
        if (app.documentId === documentId && app.tenantId === tenantId) {
          (app as any).status = 'SUPERSEDED';
        }
      }
    } catch {}

    if (this.storeMode !== 'database') {
      await OutboxService.recordEvent(
        tenantId,
        documentId,
        'DOCUMENT_REPLACED',
        {
          versionNo: nextVersionNo,
          storagePath: stored.storagePath,
          fileName: sanitizedFilename,
          mimeType: validation.mimeType,
          sourceVersionId: newVersionRecord.id,
          sha256Hash: validation.sha256Hash,
          replacedBy: userId,
        }
      );
    }

    Logger.info({
      message: `Document ${documentId} replaced with new Version ${nextVersionNo}`,
      context: 'IntakeService',
      data: { documentId, tenantId, versionNo: nextVersionNo, fileName: sanitizedFilename },
    });

    return newVersionRecord;
  }

  /**
   * Returns all version storage keys for a document within tenant scope
   */
  static async getVersionStorageKeys(tenantId: string, documentId: string): Promise<string[]> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT storage_key FROM document_versions WHERE tenant_id = $1 AND document_id = $2`,
          [tenantId, documentId]
        );
        return res.rows.map((r: any) => r.storage_key);
      } catch {}
    }

    const versions = this.inMemoryVersions.get(documentId) || [];
    return versions.filter((v) => v.tenantId === tenantId).map((v) => v.storageKey);
  }
}

/**
 * Seed initial MVP documents into memory for zero-dependency standalone/fallback runtime
 */
export function seedDefaultDocuments(): void {
  const tenantA = 'TNT-CORP-01';

  const defaultDocs: DocumentRecord[] = [
    {
      documentId: 'DOC-10245',
      tenantId: tenantA,
      fileName: 'Master_Services_Agreement_2026.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10245.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'e1e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.98,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 12,
      uploadedAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      documentId: 'DOC-10245-v1',
      tenantId: tenantA,
      fileName: 'Master_Services_Agreement_v1.0.pdf',
      storagePath: '/tenants/TNT-CORP-01/v1.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'e1e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 12,
      uploadedAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      documentId: 'DOC-10245-v2',
      tenantId: tenantA,
      fileName: 'Master_Services_Agreement_v2.0_Amended.pdf',
      storagePath: '/tenants/TNT-CORP-01/v2.pdf',
      fileSizeBytes: 2148576,
      mimeType: 'application/pdf',
      sha256Hash: 'e2e2e3e4e5f67890123456789abcdef0123456789abcdef0123456789abcdef1',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.96,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 14,
      uploadedAt: new Date('2026-10-06T10:00:00Z'),
    },
    {
      documentId: 'DOC-10246',
      tenantId: tenantA,
      fileName: 'Invoice_Apex_Hardware_2026_9901.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10246.pdf',
      fileSizeBytes: 1048576,
      mimeType: 'application/pdf',
      sha256Hash: 'a1a2a3a4a5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Purchase Invoice',
      status: 'NEEDS_REVIEW',
      stage: 'REVIEW',
      confidenceScore: 0.92,
      slaStatus: 'WARNING',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 2,
      uploadedAt: new Date('2026-10-08T09:00:00Z'),
    },
    {
      documentId: 'DOC-10247',
      tenantId: tenantA,
      fileName: 'Internal_Security_Policy_v4.2.docx',
      storagePath: '/tenants/TNT-CORP-01/DOC-10247.docx',
      fileSizeBytes: 524288,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sha256Hash: 'b1b2b3b4b5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Internal Policy',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.99,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'EMAIL_INGEST',
      pageCount: 8,
      uploadedAt: new Date('2026-10-01T14:30:00Z'),
    },
    {
      documentId: 'DOC-10248',
      tenantId: tenantA,
      fileName: 'Vendor_Master_Agreement_2026.pdf',
      storagePath: '/tenants/TNT-CORP-01/DOC-10248.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      sha256Hash: 'c1c2c3c4c5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      documentType: 'Supplier Contract',
      status: 'APPROVED',
      stage: 'PUBLISHED',
      confidenceScore: 0.97,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 15,
      uploadedAt: new Date('2026-10-05T11:00:00Z'),
    },
  ];

  const defaultPdfBuffer = Buffer.from(
    '%PDF-1.4\n%DocNexa Enterprise Default Seed PDF\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n175\n%%EOF'
  );
  const defaultDocxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00]);

  for (const doc of defaultDocs) {
    IntakeService.setInMemoryDocument(doc);
    const payload = doc.mimeType === 'application/pdf' ? defaultPdfBuffer : defaultDocxBuffer;
    IntakeService.getStorage().putObject(doc.storagePath, payload).catch(() => {});
  }

  // Safe async PostgreSQL sync for default documents
  if (dbPool) {
    (async () => {
      try {
        for (const doc of defaultDocs) {
          await dbPool.query(
            `INSERT INTO documents (
               document_id, tenant_id, file_name, file_path, file_size_bytes,
               mime_type, sha256_hash, document_type, status, stage,
               confidence_score, sla_status, ingestion_source, page_count, uploaded_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (document_id) DO NOTHING`,
            [
              doc.documentId,
              doc.tenantId,
              doc.fileName,
              doc.storagePath,
              doc.fileSizeBytes,
              doc.mimeType,
              doc.sha256Hash,
              doc.documentType,
              doc.status,
              doc.stage,
              doc.confidenceScore,
              doc.slaStatus,
              doc.ingestionSource,
              doc.pageCount,
              doc.uploadedAt,
            ]
          );
        }
      } catch {
        // Ignored in non-migrated or standalone test environments
      }
    })();
  }
}

// Auto-seed default documents on module load
seedDefaultDocuments();

