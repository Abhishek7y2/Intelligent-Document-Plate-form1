import {
  BoundingBox2D,
  Polygon8Point,
  OcrWordToken,
  OcrPageResult,
} from '../models/ocr.models.js';

/**
 * Normalizes 2D bounding box to 8-point clockwise polygon:
 * [top-left-x, top-left-y, top-right-x, top-right-y, bottom-right-x, bottom-right-y, bottom-left-x, bottom-left-y]
 */
export function bboxToPolygon(bbox: BoundingBox2D): Polygon8Point {
  const left = Math.max(0, Number(bbox.left) || 0);
  const top = Math.max(0, Number(bbox.top) || 0);
  const width = Math.max(0, Number(bbox.width) || 0);
  const height = Math.max(0, Number(bbox.height) || 0);

  const right = Number((left + width).toFixed(2));
  const bottom = Number((top + height).toFixed(2));
  const cleanLeft = Number(left.toFixed(2));
  const cleanTop = Number(top.toFixed(2));

  return [cleanLeft, cleanTop, right, cleanTop, right, bottom, cleanLeft, bottom];
}

/**
 * Normalizes confidence score to [0.0, 1.0] range.
 * If raw score is in 0-100 range, it is divided by 100.
 */
export function normalizeConfidence(rawConfidence: number | undefined | null): number {
  if (rawConfidence === undefined || rawConfidence === null || isNaN(rawConfidence)) {
    return 0.0;
  }
  let score = Number(rawConfidence);
  if (score > 1.0 && score <= 100.0) {
    score = score / 100.0;
  }
  return Number(Math.max(0.0, Math.min(1.0, score)).toFixed(4));
}

/**
 * Validates bounding box coordinates for sanity and bounds.
 */
export function validateBoundingBox(
  bbox: BoundingBox2D,
  pageWidth: number,
  pageHeight: number
): { valid: boolean; normalizedBbox: BoundingBox2D; error?: string } {
  if (!bbox || typeof bbox !== 'object') {
    return {
      valid: false,
      normalizedBbox: { left: 0, top: 0, width: 0, height: 0 },
      error: 'Invalid bounding box object.',
    };
  }

  const left = Math.max(0, Math.min(pageWidth, Number(bbox.left) || 0));
  const top = Math.max(0, Math.min(pageHeight, Number(bbox.top) || 0));
  const width = Math.max(0, Math.min(pageWidth - left, Number(bbox.width) || 0));
  const height = Math.max(0, Math.min(pageHeight - top, Number(bbox.height) || 0));

  return {
    valid: true,
    normalizedBbox: {
      left: Number(left.toFixed(2)),
      top: Number(top.toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
    },
  };
}

/**
 * Calculates page-level aggregate confidence from word tokens.
 */
export function calculateAverageConfidence(words: OcrWordToken[]): number {
  if (!words || words.length === 0) return 0.0;
  const sum = words.reduce((acc, w) => acc + (w.confidence || 0), 0);
  return Number((sum / words.length).toFixed(4));
}

/**
 * Aggregates overall document confidence across pages.
 */
export function calculateDocumentOverallConfidence(pages: OcrPageResult[]): number {
  if (!pages || pages.length === 0) return 0.0;
  const allWords = pages.flatMap((p) => p.words);
  if (allWords.length > 0) {
    return calculateAverageConfidence(allWords);
  }
  const pageConfSum = pages.reduce((acc, p) => acc + (p.confidence || 0), 0);
  return Number((pageConfSum / pages.length).toFixed(4));
}
