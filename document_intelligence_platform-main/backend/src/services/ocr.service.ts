import {
  NormalizedOcrResult,
  OcrProcessOptions,
  PageGeometryResponse,
} from '../models/ocr.models.js';
import { OcrEngineAdapter } from './ocr-engine.interface.js';
import { TesseractCliAdapter } from './tesseract-ocr.adapter.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { GeminiOcrAdapter } from './gemini-ocr.adapter.js';
import {
  IntakeService,
  DocumentNotEligibleError,
  OcrNotFoundError,
} from './intake.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';
import { ocrPagesRepo } from '../database/derived-data.repository.js';

export { DocumentNotEligibleError, OcrNotFoundError };

export class OcrService {
  private static engine: OcrEngineAdapter =
    config.gemini?.ocrEngine === 'gemini' && config.gemini?.apiKey
      ? new GeminiOcrAdapter()
      : new TesseractCliAdapter();
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryOcrResults = new Map<string, NormalizedOcrResult>();

  static setEngine(engine: OcrEngineAdapter): void {
    this.engine = engine;
  }

  static getEngine(): OcrEngineAdapter {
    return this.engine;
  }

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static clearInMemory(): void {
    this.inMemoryOcrResults.clear();
  }

  /**
   * Main OCR Processing Pipeline
   */
  static async processDocument(
    documentId: string,
    tenantId: string,
    options: OcrProcessOptions = {}
  ): Promise<NormalizedOcrResult> {
    // 1. Atomically claim document for processing (enforces distributed lock, tenant boundary, and eligibility gates)
    const doc = await IntakeService.claimDocumentForProcessing(documentId, tenantId);

    try {
      // 2. Retrieve raw binary file strictly through approved object storage abstraction
      const storage = IntakeService.getStorage();
      let fileBuffer: Buffer;
      try {
        fileBuffer = await storage.getObject(doc.storagePath);
      } catch (err: any) {
        // Strict production safeguard: Never silently fabricate payloads for missing customer documents
        const isSyntheticAllowed =
          (config.env === 'development' || config.env === 'test') &&
          process.env['ALLOW_SYNTHETIC_OCR_FIXTURES'] === 'true';

        if (isSyntheticAllowed) {
          Logger.warn({
            message: `Storage binary '${doc.storagePath}' not in store; explicitly allowed synthetic fixture activated for test environment`,
            context: 'OcrService',
            data: { documentId, tenantId, storagePath: doc.storagePath },
          });
          fileBuffer = Buffer.from('%PDF-1.4\n%DocNexa Synthetic Document Buffer for Pipeline Processing\n%%EOF');
        } else {
          Logger.error({
            message: `Document storage payload missing or unreadable: ${err.message}`,
            context: 'OcrService',
            data: { documentId, tenantId, storagePath: doc.storagePath },
          });
          throw new DocumentNotEligibleError(
            `Document storage payload '${doc.storagePath}' could not be retrieved from object storage.`,
            404,
            'STORAGE_PAYLOAD_NOT_FOUND'
          );
        }
      }

      // 3. Select engine and execute OCR
      let activeEngine = this.engine;
      if (options.engineType === 'mock') {
        activeEngine = new SyntheticMockOcrAdapter();
      } else if (options.engineType === 'tesseract') {
        activeEngine = new TesseractCliAdapter();
      } else if (options.engineType === 'gemini') {
        activeEngine = new GeminiOcrAdapter();
      }

      const ocrResult = await activeEngine.process({
        documentId,
        tenantId,
        buffer: fileBuffer,
        mimeType: doc.mimeType,
        fileName: doc.fileName,
        maxPages: options.maxPages || 50,
        timeoutMs: options.timeoutMs || 60000,
      });

      // 4. Persist OCR normalized results and page layout geometry (transactional)
      await this.saveOcrResult(ocrResult);

      // 5. Update document status and confidence rating
      const nextStatus = ocrResult.overallConfidence >= 0.85 ? 'STP_PROCESSED' : 'NEEDS_REVIEW';
      await IntakeService.updateDocument(documentId, tenantId, {
        status: nextStatus,
        stage: 'OCR_COMPLETE',
        pageCount: ocrResult.pageCount,
        confidenceScore: ocrResult.overallConfidence,
        processedAt: new Date(),
      });

      Logger.info({
        message: `OCR and geometry normalization completed for ${documentId}`,
        context: 'OcrService',
        data: {
          documentId,
          tenantId,
          pageCount: ocrResult.pageCount,
          confidence: ocrResult.overallConfidence,
          engine: ocrResult.engine.name,
        },
      });

      return ocrResult;
    } catch (err: any) {
      // Ensure failed processing does NOT leave the document permanently stuck in PROCESSING
      await IntakeService.updateDocument(documentId, tenantId, {
        status: 'FAILED',
        stage: 'OCR_PIPELINE_FAILED',
      });
      throw err;
    }
  }

  /**
   * Retrieves complete OCR results and layout JSON
   */
  static async getOcrResult(documentId: string, tenantId: string): Promise<NormalizedOcrResult | null> {
    if (config.mongo.derivedStoreMode === 'mongo') {
      try {
        const pages = await ocrPagesRepo.findByDocument(tenantId, documentId);
        if (pages.length > 0) {
          const sorted = [...pages].sort((a: any, b: any) => (a.page_number || 0) - (b.page_number || 0));
          const fullText = sorted.map((p: any) => p.text || '').join('\n');
          const avgConf =
            sorted.reduce((acc: number, p: any) => acc + (p.confidence || 0), 0) / (sorted.length || 1);
          return {
            schemaVersion: '1.0.0',
            ocrResultId: `OCR-${documentId}`,
            coordinateSystem: { units: 'pixels', origin: 'top_left', dpi: 300 },
            documentId,
            tenantId,
            pageCount: sorted.length,
            fullText,
            overallConfidence: avgConf,
            pages: sorted.map((p: any) => ({
              pageNumber: p.page_number || 1,
              width: p.geometry?.width || 800,
              height: p.geometry?.height || 1000,
              dpi: p.geometry?.dpi || 300,
              rotationDegrees: 0,
              text: p.text || '',
              confidence: p.confidence || 0.95,
              words: p.words || [],
              lines: p.lines || [],
            })),
            status: 'SUCCESS',
            engine: {
              name: (sorted[0] as any)?.model_version || 'tesseract-v5',
              version: (sorted[0] as any)?.analysis_version || '1.0.0',
              language: 'eng',
              isMock: false,
            },
            metadata: {
              durationMs: 120,
              processedAt: new Date().toISOString(),
              fileSizeBytes: 1024,
              mimeType: 'application/pdf',
            },
          };
        }
      } catch (mongoErr: any) {
        Logger.warn({
          message: `Mongo read failed for OCR pages; falling back: ${mongoErr.message}`,
          context: 'OcrService',
        });
      }
    }

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT layout_json as "layoutJson"
           FROM document_ocr_results
           WHERE document_id = $1 AND tenant_id = $2`,
          [documentId, tenantId]
        );
        if (res.rows.length === 0) return null;
        return typeof res.rows[0].layoutJson === 'string'
          ? JSON.parse(res.rows[0].layoutJson)
          : res.rows[0].layoutJson;
      } catch (err: any) {
        Logger.error({ message: `Database error querying OCR result: ${err.message}`, error: err });
        throw err;
      }
    }

    const res = this.inMemoryOcrResults.get(documentId);
    if (!res || res.tenantId !== tenantId) return null;
    return { ...res };
  }

  /**
   * Retrieves page-specific geometry (page dimensions, words, bounding boxes, polygons)
   */
  static async getPageGeometry(
    documentId: string,
    pageNumber: number,
    tenantId: string
  ): Promise<PageGeometryResponse | null> {
    const ocrResult = await this.getOcrResult(documentId, tenantId);
    if (!ocrResult) return null;

    const page = ocrResult.pages.find((p) => p.pageNumber === pageNumber);
    if (!page) return null;

    return {
      documentId,
      tenantId,
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      dpi: page.dpi,
      rotationDegrees: page.rotationDegrees,
      confidence: page.confidence,
      text: page.text,
      words: page.words,
      lines: page.lines,
    };
  }

  private static async saveOcrResult(result: NormalizedOcrResult): Promise<void> {
    // Dual-write to Mongo derived data store when mode is dual or mongo
    if (config.mongo.derivedStoreMode !== 'postgres') {
      try {
        for (const page of result.pages) {
          const normalizedWords = page.words.map((w: any) => ({
            id: w.id,
            text: w.text,
            confidence: w.confidence,
            pageNumber: page.pageNumber,
            page_number: page.pageNumber,
            x: w.x !== undefined ? w.x : Math.max(0, Math.min(1, Number(((w.bbox?.left || 0) / (page.width || 1)).toFixed(6)))),
            y: w.y !== undefined ? w.y : Math.max(0, Math.min(1, Number(((w.bbox?.top || 0) / (page.height || 1)).toFixed(6)))),
            w: w.w !== undefined ? w.w : Math.max(0, Math.min(1, Number(((w.bbox?.width || 0) / (page.width || 1)).toFixed(6)))),
            h: w.h !== undefined ? w.h : Math.max(0, Math.min(1, Number(((w.bbox?.height || 0) / (page.height || 1)).toFixed(6)))),
            bbox: w.bbox,
            polygon: w.polygon,
          }));

          await ocrPagesRepo.insertOne(result.tenantId, {
            tenant_id: result.tenantId,
            document_id: result.documentId,
            source_version_id: (result as any).sourceVersionId || 'v1',
            analysis_version: result.engine.version || '1.0.0',
            model_version: result.engine.name || 'tesseract-v5',
            page_number: page.pageNumber,
            width: page.width,
            height: page.height,
            dpi: page.dpi,
            text: page.text,
            page_text: page.text,
            confidence: page.confidence,
            geometry: { width: page.width, height: page.height, dpi: page.dpi },
            tokens: normalizedWords,
            words: normalizedWords,
            lines: page.lines,
          });
        }
      } catch (mongoErr: any) {
        Logger.warn({
          message: `Mongo dual-write for OCR pages failed: ${mongoErr.message}`,
          context: 'OcrService',
        });
      }
    }

    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Upsert into document_ocr_results
        await client.query(
          `INSERT INTO document_ocr_results (
            document_id, tenant_id, engine_name, engine_version, status,
            total_pages, overall_confidence, full_text, layout_json, duration_ms, completed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          ON CONFLICT (document_id) DO UPDATE SET
            engine_name = EXCLUDED.engine_name,
            engine_version = EXCLUDED.engine_version,
            status = EXCLUDED.status,
            total_pages = EXCLUDED.total_pages,
            overall_confidence = EXCLUDED.overall_confidence,
            full_text = EXCLUDED.full_text,
            layout_json = EXCLUDED.layout_json,
            duration_ms = EXCLUDED.duration_ms,
            completed_at = CURRENT_TIMESTAMP`,
          [
            result.documentId,
            result.tenantId,
            result.engine.name,
            result.engine.version,
            result.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
            result.pageCount,
            result.overallConfidence,
            result.fullText,
            JSON.stringify(result),
            result.metadata.durationMs,
          ]
        );

        // Delete existing pages if re-running OCR
        await client.query(`DELETE FROM document_pages WHERE document_id = $1`, [result.documentId]);

        // Insert individual page records
        for (const page of result.pages) {
          const normalizedWords = page.words.map((w: any) => ({
            id: w.id,
            text: w.text,
            confidence: w.confidence,
            pageNumber: page.pageNumber,
            page_number: page.pageNumber,
            x: w.x !== undefined ? w.x : Math.max(0, Math.min(1, Number(((w.bbox?.left || 0) / (page.width || 1)).toFixed(6)))),
            y: w.y !== undefined ? w.y : Math.max(0, Math.min(1, Number(((w.bbox?.top || 0) / (page.height || 1)).toFixed(6)))),
            w: w.w !== undefined ? w.w : Math.max(0, Math.min(1, Number(((w.bbox?.width || 0) / (page.width || 1)).toFixed(6)))),
            h: w.h !== undefined ? w.h : Math.max(0, Math.min(1, Number(((w.bbox?.height || 0) / (page.height || 1)).toFixed(6)))),
            bbox: w.bbox,
            polygon: w.polygon,
          }));

          await client.query(
            `INSERT INTO document_pages (
              document_id, tenant_id, page_number, width, height, dpi, page_text, confidence, tokens_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              result.documentId,
              result.tenantId,
              page.pageNumber,
              page.width,
              page.height,
              page.dpi,
              page.text,
              page.confidence,
              JSON.stringify({ words: normalizedWords, lines: page.lines }),
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({ message: `Database error persisting OCR result: ${err.message}`, error: err });
        throw err;
      } finally {
        client.release();
      }
      return;
    }

    this.inMemoryOcrResults.set(result.documentId, { ...result });
  }
}
