import crypto from 'crypto';
import {
  ChunkRecord,
  SearchQueryPayload,
  SearchResponse,
  SearchResultItem,
  IndexDocumentResult,
  SearchFacetCounts,
} from '../models/search.models.js';
import { EmbeddingService } from './embedding.service.js';
import { IntakeService } from './intake.service.js';
import { OcrService } from './ocr.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export class SearchValidationError extends Error {
  statusCode = 400;
  code = 'SEARCH_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'SearchValidationError';
  }
}

export class IndexingError extends Error {
  statusCode = 422;
  code = 'INDEXING_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'IndexingError';
  }
}

export class SearchService {
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryChunks = new Map<string, ChunkRecord[]>(); // Key: `${tenantId}:${documentId}`

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  static clearInMemory(): void {
    this.inMemoryChunks.clear();
  }

  static setInMemoryChunks(tenantId: string, documentId: string, chunks: ChunkRecord[]): void {
    this.inMemoryChunks.set(`${tenantId}:${documentId}`, chunks);
  }

  static getTenantIndexedDocIds(tenantId: string): string[] {
    const docIds: string[] = [];
    const prefix = `${tenantId}:`;
    for (const key of this.inMemoryChunks.keys()) {
      if (key.startsWith(prefix)) {
        docIds.push(key.substring(prefix.length));
      }
    }
    return docIds;
  }

  static removeDocumentChunks(tenantId: string, documentId: string): void {
    this.inMemoryChunks.delete(`${tenantId}:${documentId}`);
  }

  /**
   * Chunks text using paragraph and sentence boundaries with token-aware sliding window.
   */
  static splitTextIntoChunks(
    fullText: string,
    maxChunkChars = 400,
    overlapChars = 50
  ): string[] {
    if (!fullText || fullText.trim().length === 0) {
      return [];
    }

    const paragraphs = fullText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const chunks: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxChunkChars) {
        chunks.push(paragraph);
        continue;
      }

      // Split large paragraphs by sentences or sliding window
      let start = 0;
      while (start < paragraph.length) {
        let end = Math.min(start + maxChunkChars, paragraph.length);
        if (end < paragraph.length) {
          // Look for sentence end or punctuation near end
          const lastPeriod = paragraph.lastIndexOf('. ', end);
          if (lastPeriod > start + maxChunkChars / 2) {
            end = lastPeriod + 1;
          }
        }
        const slice = paragraph.slice(start, end).trim();
        if (slice.length > 0) {
          chunks.push(slice);
        }
        if (end >= paragraph.length) break;
        start = Math.max(start + 1, end - overlapChars);
      }
    }

    return chunks;
  }

  /**
   * Idempotently indexes document OCR text into vector chunks.
   */
  static async indexDocument(
    documentId: string,
    tenantId: string,
    options: { force?: boolean; expectedVersion?: string } = {}
  ): Promise<IndexDocumentResult> {
    const startTime = Date.now();

    // 1. Fetch document record & enforce tenant boundary
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      throw new IndexingError(`Document ${documentId} not found in tenant ${tenantId}.`);
    }

    // 2. Freshness & Security Gate: do not index quarantined or failed documents
    if (doc.status === 'QUARANTINED' || doc.status === 'FAILED') {
      return {
        documentId,
        tenantId,
        chunksIndexed: 0,
        status: 'SKIPPED',
        durationMs: Date.now() - startTime,
        reason: `Document is in ineligible status '${doc.status}'.`,
      };
    }

    // 2b. Version Freshness Guard: do not allow retries of older versions to overwrite newer active chunks
    if (options.expectedVersion && this.storeMode === 'memory') {
      const existing = this.inMemoryChunks.get(`${tenantId}:${documentId}`);
      if (existing && existing.length > 0) {
        const activeVersion = existing[0]?.sourceVersion;
        if (activeVersion && activeVersion !== options.expectedVersion) {
          Logger.warn({
            context: 'SearchService',
            message: `Stale version indexing skipped for document ${documentId}: active version is ${activeVersion}, requested was ${options.expectedVersion}`,
            data: { documentId, tenantId, activeVersion, expectedVersion: options.expectedVersion },
          });
          return {
            documentId,
            tenantId,
            chunksIndexed: 0,
            status: 'SKIPPED',
            durationMs: Date.now() - startTime,
            reason: `Stale version indexing rejected: document already has active chunks for version ${activeVersion}.`,
          };
        }
      }
    }

    // 3. Extract text from OCR service or document metadata
    let sourceText = '';
    let pageNumber = 1;

    try {
      const ocrResult = await OcrService.getOcrResult(documentId, tenantId);
      if (ocrResult && ocrResult.fullText) {
        sourceText = ocrResult.fullText;
      }
    } catch {
      // Fallback: if OCR not yet run, use file name and metadata
      sourceText = `${doc.fileName} - Document Type: ${doc.documentType}`;
    }

    if (!sourceText.trim()) {
      sourceText = `Document: ${doc.fileName} (${doc.documentType})`;
    }

    // 4. Chunk text
    const textChunks = this.splitTextIntoChunks(sourceText);
    if (textChunks.length === 0) {
      textChunks.push(sourceText);
    }

    // 5. Generate vector embeddings for all chunks
    const chunkRecords: ChunkRecord[] = [];
    for (let i = 0; i < textChunks.length; i++) {
      const text = textChunks[i]!;
      const embedding = await EmbeddingService.generateEmbedding(text);
      chunkRecords.push({
        chunkId: `CHK-${crypto.randomBytes(8).toString('hex')}`,
        documentId,
        tenantId,
        chunkIndex: i,
        sourceVersion: options.expectedVersion || 'v1.0',
        pageNumber,
        chunkText: text,
        embedding,
        createdAt: new Date(),
      });
    }

    // 6. Persistence: Idempotent replace
    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Check active database version before deleting
        if (options.expectedVersion) {
          const verCheck = await client.query(
            'SELECT source_version FROM document_chunks WHERE tenant_id = $1 AND document_id = $2 LIMIT 1',
            [tenantId, documentId]
          );
          if (verCheck.rows.length > 0 && verCheck.rows[0].source_version !== options.expectedVersion) {
            await client.query('ROLLBACK');
            return {
              documentId,
              tenantId,
              chunksIndexed: 0,
              status: 'SKIPPED',
              durationMs: Date.now() - startTime,
              reason: `Stale version indexing rejected: active chunks exist for version ${verCheck.rows[0].source_version}.`,
            };
          }
        }

        // Delete previous chunks
        await client.query(
          'DELETE FROM document_chunks WHERE tenant_id = $1 AND document_id = $2',
          [tenantId, documentId]
        );

        // Insert new chunks
        for (const chunk of chunkRecords) {
          const vectorStr = `[${chunk.embedding.join(',')}]`;
          await client.query(
            `INSERT INTO document_chunks (
              chunk_id, document_id, tenant_id, chunk_index, source_version,
              page_number, chunk_text, embedding
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
            [
              chunk.chunkId,
              chunk.documentId,
              chunk.tenantId,
              chunk.chunkIndex,
              chunk.sourceVersion,
              chunk.pageNumber,
              chunk.chunkText,
              vectorStr,
            ]
          );
        }
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({
          message: `Database error indexing document ${documentId}: ${err.message}`,
          context: 'SearchService',
          error: err,
        });
        throw new IndexingError(`Database indexing failed: ${err.message}`);
      } finally {
        client.release();
      }
    } else {
      // Memory Store: atomically overwrite
      this.inMemoryChunks.set(`${tenantId}:${documentId}`, chunkRecords);
    }

    Logger.info({
      message: `Document indexed successfully: ${documentId}`,
      context: 'SearchService',
      data: { documentId, tenantId, chunksCount: chunkRecords.length },
    });

    return {
      documentId,
      tenantId,
      chunksIndexed: chunkRecords.length,
      status: 'INDEXED',
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Search documents using Hybrid Vector + Full-Text semantic search.
   */
  static async search(
    tenantId: string,
    payload: SearchQueryPayload,
    userRole?: string
  ): Promise<SearchResponse> {
    if (!payload.query || payload.query.trim().length === 0) {
      throw new SearchValidationError('Search query parameter "query" is required and cannot be empty.');
    }

    const query = payload.query.trim();
    const limit = Math.max(1, Math.min(payload.limit || 10, 50));
    const offset = Math.max(0, payload.offset || 0);
    const filters = payload.filters || {};
    const mode = payload.retrievalMode || 'hybrid';

    // Role-based content shielding & visibility per BRD Section 3
    const normalizedRole = (userRole || '').toLowerCase().replace(/[- ]/g, '_');
    if (normalizedRole === 'platform_operator') {
      return {
        query,
        totalMatches: 0,
        results: [],
        facets: { byType: {}, byStatus: {} },
      };
    }

    // 1. Generate query embedding
    const queryVector = await EmbeddingService.generateEmbedding(query);

    // 2. Fetch candidate documents for tenant
    const allTenantDocs = await IntakeService.listDocuments(tenantId);
    let validDocs = allTenantDocs.filter(
      (d) => d.status !== 'QUARANTINED' && d.status !== 'FAILED'
    );
    if (normalizedRole === 'auditor') {
      validDocs = validDocs.filter((d) => d.status === 'PUBLISHED' || d.status === 'APPROVED');
    }

    const docMap = new Map<string, any>();
    for (const d of validDocs) {
      docMap.set(d.documentId, d);
    }

    // 3. Collect chunks
    let candidateChunks: ChunkRecord[] = [];
    if (this.storeMode === 'database') {
      try {
        const vectorStr = `[${queryVector.join(',')}]`;
        const res = await dbPool.query(
          `SELECT chunk_id as "chunkId", document_id as "documentId", tenant_id as "tenantId",
                  chunk_index as "chunkIndex", source_version as "sourceVersion", page_number as "pageNumber",
                  chunk_text as "chunkText", (1 - (embedding <=> $1::vector)) as "vectorScore"
           FROM document_chunks
           WHERE tenant_id = $2
           ORDER BY embedding <=> $1::vector ASC
           LIMIT 100`,
          [vectorStr, tenantId]
        );
        candidateChunks = res.rows.map((r: any) => ({
          ...r,
          embedding: queryVector, // placeholder for scoring
        }));
      } catch (err: any) {
        Logger.warn({
          message: `Database search failed; falling back to memory chunks: ${err.message}`,
          context: 'SearchService',
        });
        candidateChunks = this.getAllInMemoryChunksForTenant(tenantId);
      }
    } else {
      candidateChunks = this.getAllInMemoryChunksForTenant(tenantId);
    }

    // 4. Score and Rank Chunks
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const scoredResults: {
      chunk: ChunkRecord;
      doc: any;
      score: number;
      snippet: string;
      highlighted: string;
    }[] = [];

    for (const chunk of candidateChunks) {
      const doc = docMap.get(chunk.documentId);
      if (!doc) continue; // Ensure document is valid and belongs to tenant

      // Apply metadata filters
      if (filters.documentId && chunk.documentId !== filters.documentId) {
        continue;
      }
      if (filters.documentType && filters.documentType !== 'All Types') {
        if (doc.documentType !== filters.documentType) continue;
      }
      if (filters.status && filters.status !== 'All Status') {
        if (doc.status !== filters.status && filters.status !== 'Approved/Published') {
          continue;
        }
      }

      // Compute vector similarity: 0.0 to 1.0
      let vectorScore = 0.5;
      if (chunk.embedding && chunk.embedding.length === 1536) {
        const cos = EmbeddingService.cosineSimilarity(queryVector, chunk.embedding);
        vectorScore = Math.max(0, Math.min(1, (cos + 1) / 2));
      }

      // Compute keyword match score: 0.0 to 1.0
      let keywordHits = 0;
      const lowerText = chunk.chunkText.toLowerCase();
      for (const term of queryTerms) {
        if (lowerText.includes(term)) {
          keywordHits++;
        }
      }
      const keywordScore = queryTerms.length > 0 ? keywordHits / queryTerms.length : 0.5;

      // Combine score based on mode
      let finalScore = 0;
      if (mode === 'semantic') {
        finalScore = vectorScore;
      } else if (mode === 'keyword') {
        finalScore = keywordScore;
      } else {
        // Hybrid: 60% semantic + 40% keyword
        finalScore = 0.6 * vectorScore + 0.4 * keywordScore;
      }

      // Generate highlighted snippet
      const highlighted = this.highlightSnippet(chunk.chunkText, queryTerms);
      const snippet = chunk.chunkText.slice(0, 160) + (chunk.chunkText.length > 160 ? '...' : '');

      scoredResults.push({
        chunk,
        doc,
        score: finalScore,
        snippet,
        highlighted,
      });
    }

    // Sort descending by relevance score
    scoredResults.sort((a, b) => b.score - a.score);

    // Group / deduplicate by document ID (take highest scoring chunk per document) unless disabled
    const deduplicate = payload.deduplicateDocuments !== false;
    const seenDocs = new Set<string>();
    const docResults: SearchResultItem[] = [];

    const facetByType: Record<string, number> = {};
    const facetByStatus: Record<string, number> = {};

    for (const item of scoredResults) {
      const type = item.doc.documentType || 'Unknown';
      const status = item.doc.status || 'Unknown';
      facetByType[type] = (facetByType[type] || 0) + 1;
      facetByStatus[status] = (facetByStatus[status] || 0) + 1;

      if (!deduplicate || !seenDocs.has(item.doc.documentId)) {
        seenDocs.add(item.doc.documentId);
        docResults.push({
          docId: item.doc.documentId,
          title: item.doc.fileName,
          category: item.doc.documentType,
          status: item.doc.status,
          matchScore: Math.round(item.score * 100) / 100,
          snippet: item.snippet,
          highlightedSnippet: item.highlighted,
          pageNumber: item.chunk.pageNumber,
          sourceVersion: item.chunk.sourceVersion,
          updatedAt: item.doc.uploadedAt ? new Date(item.doc.uploadedAt).toISOString() : new Date().toISOString(),
          confidence: item.doc.confidenceScore ? Math.round(item.doc.confidenceScore * 100) : 95,
          tags: [item.doc.documentType, item.doc.status],
        });
      }
    }

    const totalMatches = docResults.length;
    const paginatedResults = docResults.slice(offset, offset + limit);

    const facets: SearchFacetCounts = {
      byType: facetByType,
      byStatus: facetByStatus,
    };

    return {
      query,
      totalMatches,
      results: paginatedResults,
      facets,
    };
  }

  private static getAllInMemoryChunksForTenant(tenantId: string): ChunkRecord[] {
    const list: ChunkRecord[] = [];
    for (const [key, chunks] of this.inMemoryChunks.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        list.push(...chunks);
      }
    }
    return list;
  }

  static async deleteDocumentIndex(documentId: string, tenantId: string): Promise<boolean> {
    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          'DELETE FROM document_chunks WHERE tenant_id = $1 AND document_id = $2',
          [tenantId, documentId]
        );
      } catch (err: any) {
        Logger.error({
          message: `Failed to delete document index for ${documentId}: ${err.message}`,
          context: 'SearchService',
          error: err,
        });
        throw err;
      }
    }
    this.inMemoryChunks.delete(`${tenantId}:${documentId}`);
    return true;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static highlightSnippet(text: string, terms: string[]): string {
    if (!terms.length) return text;
    let result = text;
    for (const term of terms) {
      const safeTerm = this.escapeRegex(term);
      try {
        const regex = new RegExp(`(${safeTerm})`, 'gi');
        result = result.replace(regex, '<mark>$1</mark>');
      } catch {
        // Fallback safely
      }
    }
    return result;
  }
}
