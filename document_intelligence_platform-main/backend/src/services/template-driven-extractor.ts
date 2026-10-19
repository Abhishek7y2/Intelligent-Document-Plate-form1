import { ExtractedField, FieldGroundedEvidence, FieldEvidence } from '../models/extraction.models.js';
import { TemplateField } from '../models/schema.models.js';
import { NormalizedOcrResult, OcrWordToken, NormalizedBoundingBox } from '../models/ocr.models.js';

export interface FieldExtractor {
  extractFields(
    fields: TemplateField[],
    ocrResult: NormalizedOcrResult
  ): Promise<ExtractedField[]>;
}

export class TemplateDrivenExtractor implements FieldExtractor {
  async extractFields(
    fields: TemplateField[],
    ocrResult: NormalizedOcrResult
  ): Promise<ExtractedField[]> {
    const extracted: ExtractedField[] = [];
    const fullText = ocrResult.fullText || '';
    const allWords: OcrWordToken[] = [];

    for (const page of ocrResult.pages || []) {
      if (page.words) {
        allWords.push(...page.words);
      }
    }

    for (const def of fields) {
      const fieldKey = def.key || (def as any).fieldName;
      const label = def.label || fieldKey;
      const dataType = def.type || (def as any).dataType || 'STRING';
      const required = def.required ?? true;
      const confidenceThreshold = def.confidenceThreshold ?? 0.85;

      const candidate = this.extractCandidateValue(fieldKey, dataType, fullText, allWords);

      if (!candidate || candidate.rawValue === undefined || candidate.rawValue === '') {
        extracted.push({
          fieldId: def.id,
          fieldName: fieldKey,
          label,
          dataType,
          extractedValue: null,
          confidence: 0.0,
          status: required ? 'MISSING' : 'EXTRACTED',
          evidence: {
            page: 1,
            boxes: [],
            text: '',
            evidence_unmapped: true,
          },
          validationErrors: required ? [`Required field '${label}' was not detected in document.`] : [],
        });
        continue;
      }

      // Check regex pattern if defined
      const errors: string[] = [];
      if (def.regexPattern && typeof candidate.rawValue === 'string') {
        const regex = new RegExp(def.regexPattern);
        if (!regex.test(candidate.rawValue)) {
          errors.push(`Field '${label}' value '${candidate.rawValue}' fails format pattern.`);
        }
      }

      const status =
        errors.length > 0
          ? 'INVALID'
          : candidate.confidence < confidenceThreshold
          ? 'LOW_CONFIDENCE'
          : 'EXTRACTED';

      // Build Sprint 7 Part 0 normalized evidence boxes
      let fieldEvidence: FieldEvidence;
      if (candidate.evidence && candidate.evidence.wordTokens && candidate.evidence.wordTokens.length > 0) {
        const pageNum = candidate.evidence.pageNumber || 1;
        const pageInfo = ocrResult.pages?.find((p) => p.pageNumber === pageNum);
        const pWidth = pageInfo?.width || 2550;
        const pHeight = pageInfo?.height || 3300;

        const boxes: NormalizedBoundingBox[] = candidate.evidence.wordTokens.map((t) => {
          const w = t as any;
          const left = w.bbox?.left ?? 0;
          const top = w.bbox?.top ?? 0;
          const width = w.bbox?.width ?? 0;
          const height = w.bbox?.height ?? 0;
          return {
            x: w.x !== undefined ? w.x : Math.max(0, Math.min(1, Number((left / pWidth).toFixed(6)))),
            y: w.y !== undefined ? w.y : Math.max(0, Math.min(1, Number((top / pHeight).toFixed(6)))),
            w: w.w !== undefined ? w.w : Math.max(0, Math.min(1, Number((width / pWidth).toFixed(6)))),
            h: w.h !== undefined ? w.h : Math.max(0, Math.min(1, Number((height / pHeight).toFixed(6)))),
          };
        });

        fieldEvidence = {
          page: pageNum,
          boxes,
          text: candidate.evidence.textSnippet || String(candidate.rawValue),
          evidence_unmapped: false,
        };
      } else {
        fieldEvidence = {
          page: 1,
          boxes: [],
          text: String(candidate.rawValue || ''),
          evidence_unmapped: true,
        };
      }

      extracted.push({
        fieldId: def.id,
        fieldName: fieldKey,
        label,
        dataType,
        extractedValue: candidate.rawValue,
        normalizedValue: candidate.normalizedValue,
        confidence: candidate.confidence,
        status,
        groundedEvidence: candidate.evidence,
        evidence: fieldEvidence,
        validationErrors: errors.length > 0 ? errors : undefined,
      });
    }

    return extracted;
  }

  private extractCandidateValue(
    key: string,
    dataType: string,
    fullText: string,
    words: OcrWordToken[]
  ): {
    rawValue: any;
    normalizedValue: any;
    confidence: number;
    evidence?: FieldGroundedEvidence;
  } | null {
    const k = key.toLowerCase();

    // 1. Invoice Number / Contract Number / Policy Number
    if (k.includes('invoice_number') || k.includes('number') || k.includes('control')) {
      const match =
        fullText.match(/INV-[\w\-]+/i) ||
        fullText.match(/CTR-[\w\-]+/i) ||
        fullText.match(/POL-[\w\-]+/i) ||
        fullText.match(/(?:Invoice\s*(?:No|#|Number)?[:\s]+)([\w\-]+)/i);

      if (match) {
        const val = match[1] || match[0];
        const evidence = this.groundValueToTokens(val, words);
        return {
          rawValue: val,
          normalizedValue: val,
          confidence: evidence ? 0.95 : 0.85,
          evidence,
        };
      }
    }

    // 2. Dates (invoice_date, effective_date, expiration_date)
    if (k.includes('date')) {
      const match = fullText.match(/\b(\d{4}-\d{2}-\d{2})\b/) || fullText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (match) {
        const val = match[0];
        const evidence = this.groundValueToTokens(val, words);
        return {
          rawValue: val,
          normalizedValue: val,
          confidence: evidence ? 0.96 : 0.88,
          evidence,
        };
      }
    }

    // 3. Supplier GSTIN / Tax ID
    if (k.includes('gstin') || k.includes('tax_id')) {
      const match = fullText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/);
      if (match) {
        const val = match[1];
        const evidence = this.groundValueToTokens(val, words);
        return {
          rawValue: val,
          normalizedValue: val,
          confidence: 0.98,
          evidence,
        };
      }
    }

    // 4. Currency / Amounts (net_amount, tax_amount, total_amount, contract_value)
    if (dataType.toLowerCase() === 'currency' || k.includes('amount') || k.includes('value')) {
      if (k.includes('total') || k.includes('contract_value')) {
        const match = fullText.match(/(?:Invoice Total|Total Amount|Total Due|Grand Total|Total Contract Value)[\s:\$]*([\d,\.]+)/i);
        if (match) {
          const numStr = match[1].replace(/,/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            const evidence = this.groundValueToTokens(match[1], words);
            return {
              rawValue: num,
              normalizedValue: num,
              confidence: 0.95,
              evidence,
            };
          }
        }
      }

      if (k.includes('net') || k.includes('subtotal')) {
        const match = fullText.match(/(?:Net Amount|Subtotal)[\s:\$]*([\d,\.]+)/i);
        if (match) {
          const numStr = match[1].replace(/,/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            const evidence = this.groundValueToTokens(match[1], words);
            return {
              rawValue: num,
              normalizedValue: num,
              confidence: 0.92,
              evidence,
            };
          }
        }
      }

      if (k.includes('tax')) {
        const match = fullText.match(/(?:Tax Amount|Tax|GST)[\s:\$]*([\d,\.]+)/i);
        if (match) {
          const numStr = match[1].replace(/,/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            const evidence = this.groundValueToTokens(match[1], words);
            return {
              rawValue: num,
              normalizedValue: num,
              confidence: 0.92,
              evidence,
            };
          }
        }
      }
    }

    // 5. Titles, strings, counterparty
    if (k.includes('title') || k.includes('counterparty') || k.includes('version')) {
      const match =
        fullText.match(/(?:Between|Counterparty:)[\s]+([\w\s]+(?:Ltd|Corp|Inc|LLC))/i) ||
        fullText.match(/Version:?\s*(v[\d\.]+)/i);
      if (match) {
        const val = match[1].trim();
        const evidence = this.groundValueToTokens(val.split(' ')[0], words);
        return {
          rawValue: val,
          normalizedValue: val,
          confidence: 0.9,
          evidence,
        };
      }
    }

    return null;
  }

  private groundValueToTokens(valSnippet: string, words: OcrWordToken[]): FieldGroundedEvidence | undefined {
    if (!valSnippet || words.length === 0) return undefined;
    const cleanTarget = valSnippet.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanTarget) return undefined;

    const matchedTokens: OcrWordToken[] = [];
    for (const w of words) {
      const cleanW = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanW && (cleanTarget.includes(cleanW) || cleanW.includes(cleanTarget))) {
        matchedTokens.push(w);
      }
    }

    if (matchedTokens.length === 0) return undefined;

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    const pageNum = matchedTokens[0].pageNumber;

    for (const t of matchedTokens) {
      minLeft = Math.min(minLeft, t.bbox.left);
      minTop = Math.min(minTop, t.bbox.top);
      maxRight = Math.max(maxRight, t.bbox.left + t.bbox.width);
      maxBottom = Math.max(maxBottom, t.bbox.top + t.bbox.height);
    }

    const bbox = {
      left: minLeft,
      top: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };

    return {
      pageNumber: pageNum,
      textSnippet: valSnippet,
      boundingBox: bbox,
      polygon: [
        bbox.left,
        bbox.top,
        bbox.left + bbox.width,
        bbox.top,
        bbox.left + bbox.width,
        bbox.top + bbox.height,
        bbox.left,
        bbox.top + bbox.height,
      ],
      wordTokens: matchedTokens.map((t) => ({
        id: t.id,
        text: t.text,
        confidence: t.confidence,
        bbox: t.bbox,
      })),
    };
  }
}
