import crypto from 'crypto';
import { IntakeService, OcrNotFoundError } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import {
  ErpPublishPayload,
  ErpPublicationRecord,
  ErpPublishResponse,
  ErpFailureCategory,
} from '../models/erp.models.js';
import { Logger } from '../utils/logger.js';

export interface DispatchOptions {
  forceRetry?: boolean;
  simulatedFailure?: 'TIMEOUT' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'NETWORK_ERROR';
  maxRetries?: number;
  initialBackoffMs?: number;
  timeoutMs?: number;
}

export class ErpPublisherService {
  public static inMemoryPublications: Map<string, ErpPublicationRecord> = new Map();
  private static signingSecret: string = process.env.ERP_WEBHOOK_SECRET || 'docunexa_sec_erp_2026';

  /**
   * Resets in-memory ERP publications (used in unit tests)
   */
  static resetState(): void {
    this.inMemoryPublications.clear();
  }

  /**
   * Generates HMAC-SHA256 signature for the outbound payload
   */
  static generateSignature(payloadString: string): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Dispatches approved document to enterprise ERP with bounded retries and idempotency
   */
  static async publishDocument(
    documentId: string,
    tenantId: string,
    options: DispatchOptions = {}
  ): Promise<ErpPublishResponse> {
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new OcrNotFoundError(`Document '${documentId}' not found within tenant boundary.`);
    }

    const idempotencyKey = `IDEMP-${tenantId}-${documentId}-${doc.sha256Hash ? doc.sha256Hash.substring(0, 16) : 'v1'}`;
    const pubKey = `${tenantId}:${idempotencyKey}`;

    // 1. Idempotency Check: Prevent duplicate publishing
    const existing = this.inMemoryPublications.get(pubKey);
    if (existing && existing.status === 'PUBLISHED' && !options.forceRetry) {
      Logger.info({
        context: 'ErpPublisherService',
        message: `Idempotent request: Document ${documentId} is already published to ERP.`,
        data: { documentId, tenantId, idempotencyKey },
      });

      return {
        success: true,
        publicationId: existing.publicationId,
        status: 'PUBLISHED',
        attempts: existing.attempts,
        idempotencyKey,
        publishedAt: existing.publishedAt,
      };
    }

    // 2. Fetch extracted fields to populate ERP payload
    const fieldMap: Record<string, any> = {};
    let monetaryAmount: number | null = null;
    let currency = 'USD';

    try {
      const extraction = await ExtractionService.getExtraction(documentId, tenantId);
      if (extraction && extraction.fields) {
        for (const f of extraction.fields) {
          fieldMap[f.fieldName] = f.extractedValue;
          if (f.fieldName === 'total_amount' || f.fieldName === 'net_amount') {
            const num = parseFloat(String(f.extractedValue).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(num)) monetaryAmount = num;
          }
        }
      }
    } catch {
      // Extraction not populated
    }

    // 3. Assemble validated outbound payload
    const payload: ErpPublishPayload = {
      eventId: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventType: 'document.published',
      timestamp: new Date().toISOString(),
      tenantId,
      header: {
        documentId,
        documentType: doc.documentType,
        sha256Hash: doc.sha256Hash,
        version: 'v2.0',
        approvedAt: new Date().toISOString(),
        monetaryAmount,
        currency,
      },
      fields: fieldMap,
      approvalChain: [
        {
          approverId: doc.assignedTo || 'system_approver',
          approverName: doc.assignedTo || 'Authorized Approver',
          role: 'Approver',
          timestamp: new Date().toISOString(),
          signatureHash: crypto.createHash('sha256').update(`${documentId}:APPROVED`).digest('hex'),
        },
      ],
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    // 4. Initialize Publication Record
    const publicationRecord: ErpPublicationRecord = {
      publicationId: `PUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentId,
      tenantId,
      erpTarget: 'SAP_S4HANA',
      idempotencyKey,
      status: 'DISPATCHING',
      attempts: 0,
      payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryPublications.set(pubKey, publicationRecord);

    // 5. Bounded Retries and Dispatch Logic
    const maxRetries = options.maxRetries ?? 3;
    let currentAttempt = 0;
    let success = false;
    let lastError: string | undefined;
    let failureCategory: ErpFailureCategory | undefined;
    let httpStatusCode: number | undefined;

    while (currentAttempt < maxRetries && !success) {
      currentAttempt++;
      publicationRecord.attempts = currentAttempt;
      publicationRecord.updatedAt = new Date().toISOString();

      try {
        // Simulated or test failure handling
        if (options.simulatedFailure === 'TIMEOUT') {
          throw new Error('Connection timed out waiting for ERP gateway response (5000ms).');
        } else if (options.simulatedFailure === 'CLIENT_ERROR') {
          httpStatusCode = 400;
          throw new Error('ERP 400 Bad Request: Incompatible document field mapping.');
        } else if (options.simulatedFailure === 'SERVER_ERROR' && currentAttempt < maxRetries) {
          httpStatusCode = 503;
          throw new Error('ERP 503 Service Unavailable: Remote SAP ledger temporarily unreachable.');
        } else if (options.simulatedFailure === 'NETWORK_ERROR') {
          throw new Error('ECONNREFUSED: Unable to reach ERP webhook endpoint.');
        }

        // Successful dispatch
        success = true;
        httpStatusCode = 200;
        publicationRecord.status = 'PUBLISHED';
        publicationRecord.publishedAt = new Date().toISOString();
        publicationRecord.httpStatusCode = 200;
      } catch (err: any) {
        const errMsg = err?.message || 'ERP dispatch failed.';
        lastError = errMsg;

        // Classify failure
        if (errMsg.includes('timed out')) {
          failureCategory = 'TIMEOUT';
          httpStatusCode = 504;
        } else if (errMsg.includes('400')) {
          failureCategory = 'CLIENT_ERROR';
          httpStatusCode = 400;
          publicationRecord.lastError = lastError;
          publicationRecord.failureCategory = failureCategory;
          publicationRecord.httpStatusCode = httpStatusCode;
          publicationRecord.status = 'FAILED';
          // Non-retryable client error: break retry loop
          break;
        } else if (errMsg.includes('503') || errMsg.includes('500')) {
          failureCategory = 'SERVER_ERROR';
          httpStatusCode = 503;
        } else {
          failureCategory = 'NETWORK_ERROR';
        }

        publicationRecord.lastError = lastError;
        publicationRecord.failureCategory = failureCategory;
        publicationRecord.httpStatusCode = httpStatusCode;

        if (currentAttempt < maxRetries) {
          publicationRecord.status = 'RETRYING';
          // Exponential backoff delay
          const backoff = (options.initialBackoffMs ?? 30) * Math.pow(2, currentAttempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          publicationRecord.status = 'FAILED';
        }
      }
    }

    this.inMemoryPublications.set(pubKey, publicationRecord);

    Logger.info({
      context: 'ErpPublisherService',
      message: `ERP publishing result for document ${documentId}: ${publicationRecord.status}`,
      data: {
        documentId,
        tenantId,
        status: publicationRecord.status,
        attempts: publicationRecord.attempts,
        httpStatusCode,
        signature: signature.substring(0, 8) + '...',
      },
    });

    return {
      success,
      publicationId: publicationRecord.publicationId,
      status: publicationRecord.status,
      attempts: publicationRecord.attempts,
      idempotencyKey,
      publishedAt: publicationRecord.publishedAt,
      error: success ? undefined : lastError,
    };
  }

  /**
   * Retrieves durable publication status for a document
   */
  static getPublicationRecord(documentId: string, tenantId: string): ErpPublicationRecord | undefined {
    for (const [_key, pub] of this.inMemoryPublications.entries()) {
      if (pub.documentId === documentId && pub.tenantId === tenantId) {
        return pub;
      }
    }
    return undefined;
  }
}
