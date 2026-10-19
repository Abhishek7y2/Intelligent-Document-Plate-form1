/**
 * DocuNexa Sprint 5 — OCR and Document Geometry Models
 * BRD: FR-003, FR-005, FR-006
 * Version: 1.0.0
 */

export interface BoundingBox2D {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Polygon8Point = [number, number, number, number, number, number, number, number];

export interface NormalizedBoundingBox {
  x: number; // 0.0 to 1.0 relative to page width
  y: number; // 0.0 to 1.0 relative to page height
  w: number; // 0.0 to 1.0 relative to page width
  h: number; // 0.0 to 1.0 relative to page height
}

export interface OcrWordToken {
  id: string;
  text: string;
  confidence: number; // 0.0 to 1.0
  bbox: BoundingBox2D;
  polygon: Polygon8Point;
  pageNumber: number;
  page_number?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface OcrLineToken {
  id: string;
  text: string;
  confidence: number; // 0.0 to 1.0
  bbox: BoundingBox2D;
  polygon: Polygon8Point;
  pageNumber: number;
  words: OcrWordToken[];
}

export interface OcrPageResult {
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  rotationDegrees: number; // 0, 90, 180, 270
  text: string;
  confidence: number; // 0.0 to 1.0
  lines: OcrLineToken[];
  words: OcrWordToken[];
}

export interface OcrEngineInfo {
  name: string;
  version: string;
  language: string;
  isMock: boolean;
}

export interface CoordinateSystemSpec {
  units: 'pixels' | 'points' | 'normalized';
  origin: 'top_left';
  dpi: number;
}

export type OcrProcessingStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface NormalizedOcrResult {
  schemaVersion: '1.0.0';
  ocrResultId: string;
  documentId: string;
  tenantId: string;
  engine: OcrEngineInfo;
  coordinateSystem: CoordinateSystemSpec;
  status: OcrProcessingStatus;
  pageCount: number;
  fullText: string;
  overallConfidence: number; // 0.0 to 1.0
  pages: OcrPageResult[];
  metadata: {
    durationMs: number;
    processedAt: string;
    fileSizeBytes: number;
    mimeType: string;
    deskewAngleDegrees?: number;
  };
}

export interface OcrProcessInput {
  documentId: string;
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  maxPages?: number;
  timeoutMs?: number;
}

export interface OcrProcessOptions {
  engineType?: 'auto' | 'tesseract' | 'mock' | 'gemini';
  maxPages?: number;
  timeoutMs?: number;
}

export interface PageGeometryResponse {
  documentId: string;
  tenantId: string;
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  rotationDegrees: number;
  confidence: number;
  text: string;
  words: OcrWordToken[];
  lines: OcrLineToken[];
}
