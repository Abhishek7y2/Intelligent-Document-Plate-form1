import { ClassificationResult } from '../models/extraction.models.js';
import { DocumentClassifier, RuleBasedClassifier } from './rule-based-classifier.js';
import { IntakeService, DocumentNotEligibleError, OcrNotFoundError } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export class ClassificationService {
  private static classifier: DocumentClassifier = new RuleBasedClassifier();
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryClassifications = new Map<string, ClassificationResult>();

  static setClassifier(classifier: DocumentClassifier): void {
    this.classifier = classifier;
  }

  static getClassifier(): DocumentClassifier {
    return this.classifier;
  }

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static clearInMemory(): void {
    this.inMemoryClassifications.clear();
  }

  /**
   * Executes document classification pipeline (FR-004)
   */
  static async classifyDocument(documentId: string, tenantId: string): Promise<ClassificationResult> {
    // 1. Fetch document and enforce tenant boundaries
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    // 2. Eligibility checks
    if (doc.status === 'QUARANTINED') {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' is quarantined due to malware and cannot be classified.`,
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

    // 3. Ensure OCR results exist
    const ocrResult = await OcrService.getOcrResult(documentId, tenantId);
    if (!ocrResult || !ocrResult.fullText) {
      throw new DocumentNotEligibleError(
        `Document '${documentId}' has not undergone OCR processing. Run OCR prior to classification.`,
        400,
        'OCR_REQUIRED_FOR_CLASSIFICATION'
      );
    }

    // 4. Run classification
    const output = await this.classifier.classify(ocrResult);

    const classificationResult: ClassificationResult = {
      classificationId: `CLS-${documentId}-${Date.now()}`,
      documentId,
      tenantId,
      predictedType: output.predictedType,
      confidenceScore: output.confidenceScore,
      classifierName: output.classifierName,
      isConfident: output.isConfident,
      routingDecision: output.routingDecision,
      matchingSignals: output.matchingSignals,
      classifiedAt: new Date().toISOString(),
    };

    // 5. Update document record in intake service
    await IntakeService.updateDocument(documentId, tenantId, {
      status: output.isConfident ? doc.status : 'NEEDS_REVIEW',
      stage: output.isConfident ? 'CLASSIFICATION_COMPLETED' : 'CLASSIFICATION_TRIAGE',
      confidenceScore: output.confidenceScore,
      ...(output.isConfident && output.predictedType !== 'unknown'
        ? { documentType: output.predictedType }
        : {}),
    });

    // 6. Save classification result
    await this.saveClassificationResult(classificationResult);

    Logger.info({
      message: 'Document classification completed',
      context: 'ClassificationService',
      data: {
        documentId,
        tenantId,
        predictedType: output.predictedType,
        confidence: output.confidenceScore,
        routingDecision: output.routingDecision,
      },
    });

    return classificationResult;
  }

  static async getClassification(documentId: string, tenantId: string): Promise<ClassificationResult | null> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT classification_id, document_id, tenant_id, predicted_type,
                  confidence_score, classifier_name, is_confident, routing_decision,
                  matching_signals, created_at
           FROM document_classifications
           WHERE document_id = $1 AND tenant_id = $2`,
          [documentId, tenantId]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          classificationId: row.classification_id,
          documentId: row.document_id,
          tenantId: row.tenant_id,
          predictedType: row.predicted_type,
          confidenceScore: parseFloat(row.confidence_score),
          classifierName: row.classifier_name,
          isConfident: row.is_confident,
          routingDecision: row.routing_decision,
          matchingSignals: row.matching_signals || [],
          classifiedAt: row.created_at.toISOString(),
        };
      } catch (err: any) {
        Logger.error({ message: `Database error querying classification: ${err.message}`, error: err });
        throw err;
      }
    }

    const res = this.inMemoryClassifications.get(documentId);
    if (!res || res.tenantId !== tenantId) return null;
    return { ...res };
  }

  private static async saveClassificationResult(result: ClassificationResult): Promise<void> {
    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO document_classifications (
            classification_id, document_id, tenant_id, predicted_type,
            confidence_score, classifier_name, is_confident, routing_decision, matching_signals, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (document_id) DO UPDATE SET
            predicted_type = EXCLUDED.predicted_type,
            confidence_score = EXCLUDED.confidence_score,
            classifier_name = EXCLUDED.classifier_name,
            is_confident = EXCLUDED.is_confident,
            routing_decision = EXCLUDED.routing_decision,
            matching_signals = EXCLUDED.matching_signals,
            created_at = CURRENT_TIMESTAMP`,
          [
            result.classificationId,
            result.documentId,
            result.tenantId,
            result.predictedType,
            result.confidenceScore,
            result.classifierName,
            result.isConfident,
            result.routingDecision,
            JSON.stringify(result.matchingSignals),
          ]
        );
      } catch (err: any) {
        Logger.error({ message: `Database error saving classification: ${err.message}`, error: err });
        throw err;
      }
      return;
    }

    this.inMemoryClassifications.set(result.documentId, { ...result });
  }
}
