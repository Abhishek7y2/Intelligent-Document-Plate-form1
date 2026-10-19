import {
  DocumentExtractionResult,
} from '../models/extraction.models.js';
import { FieldExtractor, TemplateDrivenExtractor } from './template-driven-extractor.js';
import { reconcileInvoiceAmounts } from '../utils/invoice-math-reconciler.js';
import { IntakeService, DocumentNotEligibleError, OcrNotFoundError } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { SchemaService } from './schema.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';
import { extractionRunsRepo } from '../database/derived-data.repository.js';

export class ExtractionService {
  private static extractor: FieldExtractor = new TemplateDrivenExtractor();
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryExtractions = new Map<string, DocumentExtractionResult>();

  static setExtractor(extractor: FieldExtractor): void {
    this.extractor = extractor;
  }

  static getExtractor(): FieldExtractor {
    return this.extractor;
  }

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static clearInMemory(): void {
    this.inMemoryExtractions.clear();
  }

  static setInMemoryExtraction(result: DocumentExtractionResult): void {
    this.inMemoryExtractions.set(result.documentId, result);
  }

  /**
   * Main Document Field Extraction Pipeline (FR-005, FR-006, FR-007, FR-008)
   */
  static async extractDocument(documentId: string, tenantId: string): Promise<DocumentExtractionResult> {
    // 1. Fetch document and enforce tenant boundaries
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    // 2. Eligibility checks
    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined due to malware and cannot enter field extraction.`,
        403,
        'DOCUMENT_QUARANTINED'
      );
    }

    if (doc.status === 'REJECTED') {
      throw new DocumentNotEligibleError(`Document '${documentId}' is marked as rejected.`, 400, 'DOCUMENT_REJECTED');
    }

    if (doc.status === 'PENDING_SCAN') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' has not completed pre-flight security scan.`,
        400,
        'DOCUMENT_NOT_SCANNED'
      );
    }

    // 3. Fetch normalized OCR results
    const ocrResult = await OcrService.getOcrResult(documentId, tenantId);
    if (!ocrResult || !ocrResult.fullText) {
      throw new DocumentNotEligibleError(
        `OCR extraction has not been performed on document '${documentId}'. OCR must complete before field extraction.`,
        400,
        'OCR_REQUIRED_FOR_EXTRACTION'
      );
    }

    // 4. Retrieve published template schema for document type
    const docType = await SchemaService.getDocumentType(doc.documentType, tenantId);
    if (!docType) {
      throw new DocumentNotEligibleError(
        `Document type '${doc.documentType}' is not registered in taxonomy catalog.`,
        400,
        'DOCUMENT_TYPE_NOT_FOUND'
      );
    }

    // Look for published template version
    const templates = await SchemaService.listTemplates(doc.documentType, tenantId);
    const activeTemplate = templates.find((t) => t.status === 'PUBLISHED') || templates[0];
    if (!activeTemplate || !activeTemplate.fields || activeTemplate.fields.length === 0) {
      throw new DocumentNotEligibleError(
        `No published extraction template found for document type '${doc.documentType}'.`,
        404,
        'TEMPLATE_NOT_CONFIGURED'
      );
    }

    // 5. Extract fields using template-driven extractor (FR-005, FR-006)
    const extractedFields = await this.extractor.extractFields(
      activeTemplate.fields as any,
      ocrResult
    );

    // 6. Mathematical validation (FR-007)
    let reconciliationResult = undefined;
    if (doc.documentType === 'purchase-invoice') {
      const netField = extractedFields.find((f) => f.fieldName === 'net_amount');
      const taxField = extractedFields.find((f) => f.fieldName === 'tax_amount');
      const totalField = extractedFields.find((f) => f.fieldName === 'total_amount');

      reconciliationResult = reconcileInvoiceAmounts(
        netField?.extractedValue,
        taxField?.extractedValue,
        totalField?.extractedValue
      );
    }

    // 7. Evaluate validation summary & human review routing (FR-008)
    const missingRequiredFields: string[] = [];
    const lowConfidenceFields: string[] = [];

    for (const f of extractedFields) {
      if (f.status === 'MISSING') {
        missingRequiredFields.push(f.fieldName);
      }
      if (f.status === 'LOW_CONFIDENCE' || f.confidence < 0.85) {
        lowConfidenceFields.push(f.fieldName);
      }
      if (f.status === 'INVALID') {
        missingRequiredFields.push(f.fieldName);
      }
    }

    const isMathValid = reconciliationResult ? reconciliationResult.isReconciled : true;
    const isFieldsValid = missingRequiredFields.length === 0 && lowConfidenceFields.length === 0;
    const isValid = isMathValid && isFieldsValid;

    const routingDecision = isValid ? 'STP_PROCESSED' : 'NEEDS_REVIEW';

    const extractionResult: DocumentExtractionResult = {
      extractionId: `EXT-${documentId}-${Date.now()}`,
      documentId,
      tenantId,
      documentType: doc.documentType,
      templateVersion: activeTemplate.version,
      fields: extractedFields,
      validationSummary: {
        isValid,
        totalFieldsExpected: activeTemplate.fields.length,
        totalFieldsExtracted: extractedFields.filter((f) => f.extractedValue !== null).length,
        missingRequiredFields,
        lowConfidenceFields,
        reconciliationResult,
      },
      routingDecision,
      extractedAt: new Date().toISOString(),
    };

    // 8. Update document status in intake service
    const nextStatus: 'STP_PROCESSED' | 'NEEDS_REVIEW' =
      routingDecision === 'STP_PROCESSED' ? 'STP_PROCESSED' : 'NEEDS_REVIEW';
    const nextStage =
      routingDecision === 'STP_PROCESSED' ? 'EXTRACTION_STP_COMPLETED' : 'HUMAN_REVIEW_REQUIRED';

    const avgConfidence =
      extractedFields.length > 0
        ? extractedFields.reduce((acc, f) => acc + f.confidence, 0) / extractedFields.length
        : 0;

    await IntakeService.updateDocument(documentId, tenantId, {
      status: nextStatus,
      stage: nextStage,
      confidenceScore: parseFloat(avgConfidence.toFixed(4)),
    });

    // 9. Persist extraction result
    await this.saveExtractionResult(extractionResult);

    Logger.info({
      message: 'Document extraction completed',
      context: 'ExtractionService',
      data: {
        documentId,
        tenantId,
        documentType: doc.documentType,
        templateVersion: activeTemplate.version,
        fieldsExtracted: extractionResult.validationSummary.totalFieldsExtracted,
        routingDecision,
      },
    });

    return extractionResult;
  }

  static async getExtraction(documentId: string, tenantId: string): Promise<DocumentExtractionResult | null> {
    if (config.mongo.derivedStoreMode === 'mongo') {
      try {
        const records = await extractionRunsRepo.findByDocument(tenantId, documentId);
        if (records.length > 0) {
          const latest: any = records[records.length - 1];
          return {
            extractionId: latest.extraction_id || `EXT-${documentId}`,
            documentId: latest.document_id,
            tenantId: latest.tenant_id,
            documentType: latest.document_type || 'Unknown',
            templateVersion: latest.analysis_version || '1.0.0',
            fields: latest.fields || [],
            validationSummary: latest.validation_summary || {},
            routingDecision: latest.routing_decision,
            extractedAt: (latest.created_at || new Date()).toISOString(),
          };
        }
      } catch (mongoErr: any) {
        Logger.warn({
          message: `Mongo read failed for extraction; falling back: ${mongoErr.message}`,
          context: 'ExtractionService',
        });
      }
    }

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT extraction_id, document_id, tenant_id, document_type,
                  template_version, fields, validation_summary, routing_decision, created_at
           FROM document_extractions
           WHERE document_id = $1 AND tenant_id = $2`,
          [documentId, tenantId]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          extractionId: row.extraction_id,
          documentId: row.document_id,
          tenantId: row.tenant_id,
          documentType: row.document_type,
          templateVersion: row.template_version,
          fields: row.fields || [],
          validationSummary: row.validation_summary || {},
          routingDecision: row.routing_decision,
          extractedAt: row.created_at.toISOString(),
        };
      } catch (err: any) {
        Logger.error({ message: `Database error querying extraction: ${err.message}`, error: err });
        throw err;
      }
    }

    const res = this.inMemoryExtractions.get(documentId);
    if (!res || res.tenantId !== tenantId) return null;
    return { ...res };
  }

  static async saveExtractionResult(result: DocumentExtractionResult): Promise<void> {
    // Immediately cache in memory so unawaited synchronous callers (e.g. setupExtraction) don't race
    this.inMemoryExtractions.set(result.documentId, { ...result });

    let sourceVersionId: string | undefined;
    try {
      const versions = await IntakeService.listDocumentVersions(result.documentId, result.tenantId);
      const currentVersion = versions.find((v) => v.isCurrent) || versions[0];
      sourceVersionId = currentVersion ? currentVersion.id : undefined;

      for (const f of result.fields) {
        if (!f.sourceVersionId && sourceVersionId) {
          f.sourceVersionId = sourceVersionId;
        }
      }
    } catch {}

    // Dual-write to Mongo derived data store when mode is dual or mongo
    if (config.mongo.derivedStoreMode !== 'postgres') {
      try {
        await extractionRunsRepo.insertOne(result.tenantId, {
          tenant_id: result.tenantId,
          document_id: result.documentId,
          source_version_id: sourceVersionId || 'v1',
          analysis_version: result.templateVersion || '1.0.0',
          model_version: 'template-extractor-v1',
          extraction_id: result.extractionId,
          document_type: result.documentType,
          fields: result.fields,
          validation_summary: result.validationSummary,
          routing_decision: result.routingDecision,
        });
      } catch (mongoErr: any) {
        Logger.warn({
          message: `Mongo dual-write for extraction run failed: ${mongoErr.message}`,
          context: 'ExtractionService',
        });
      }
    }

    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO document_extractions (
            extraction_id, document_id, tenant_id, document_type,
            template_version, fields, validation_summary, routing_decision, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (document_id) DO UPDATE SET
            document_type = EXCLUDED.document_type,
            template_version = EXCLUDED.template_version,
            fields = EXCLUDED.fields,
            validation_summary = EXCLUDED.validation_summary,
            routing_decision = EXCLUDED.routing_decision,
            created_at = CURRENT_TIMESTAMP`,
          [
            result.extractionId,
            result.documentId,
            result.tenantId,
            result.documentType,
            result.templateVersion,
            JSON.stringify(result.fields),
            JSON.stringify(result.validationSummary),
            result.routingDecision,
          ]
        );

        // Also update document_extracted_fields with source_version_id and evidence JSONB
        for (const f of result.fields) {
          await client.query(
            `INSERT INTO document_extracted_fields (
              document_id, field_key, field_label, extracted_value,
              confidence_score, is_verified, source_version_id, evidence, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (document_id, field_key, source_version_id) DO UPDATE SET
              extracted_value = EXCLUDED.extracted_value,
              confidence_score = EXCLUDED.confidence_score,
              is_verified = EXCLUDED.is_verified,
              evidence = EXCLUDED.evidence`,
            [
              result.documentId,
              f.fieldName,
              f.label || f.fieldName,
              f.extractedValue !== null ? String(f.extractedValue) : null,
              f.confidence,
              f.status === 'EXTRACTED' && f.confidence >= 0.85,
              sourceVersionId || null,
              f.evidence ? JSON.stringify(f.evidence) : null,
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({ message: `Database error saving extraction: ${err.message}`, error: err });
        throw err;
      } finally {
        client.release();
      }
      return;
    }

    this.inMemoryExtractions.set(result.documentId, { ...result });
  }
}
