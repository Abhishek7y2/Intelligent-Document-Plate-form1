import { BoundingBox2D } from './ocr.models.js';

export interface ChunkRecord {
  chunkId: string;
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  sourceVersion: string;
  pageNumber: number;
  boundingBox?: BoundingBox2D;
  chunkText: string;
  embedding: number[];
  createdAt: Date;
}

export interface SearchQueryFilters {
  documentId?: string;
  documentType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  supplier?: string;
  tags?: string[];
}

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';

export interface SearchQueryPayload {
  query: string;
  filters?: SearchQueryFilters;
  limit?: number;
  offset?: number;
  retrievalMode?: RetrievalMode;
  deduplicateDocuments?: boolean;
}

export interface SearchResultItem {
  docId: string;
  title: string;
  category: string;
  status: string;
  matchScore: number;
  snippet: string;
  highlightedSnippet?: string;
  pageNumber: number;
  sourceVersion: string;
  updatedAt: string;
  amount?: number;
  confidence?: number;
  tags?: string[];
}

export interface SearchFacetCounts {
  byType?: Record<string, number>;
  byStatus?: Record<string, number>;
}

export interface SearchResponse {
  query: string;
  totalMatches: number;
  results: SearchResultItem[];
  facets?: SearchFacetCounts;
}

export interface IndexDocumentResult {
  documentId: string;
  tenantId: string;
  chunksIndexed: number;
  status: 'INDEXED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  reason?: string;
}
