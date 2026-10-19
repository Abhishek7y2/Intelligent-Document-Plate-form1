import {
  NormalizedOcrResult,
  OcrProcessInput,
  OcrPageResult,
  OcrLineToken,
  OcrWordToken,
} from '../models/ocr.models.js';
import { OcrEngineAdapter } from './ocr-engine.interface.js';
import { bboxToPolygon } from '../utils/geometry-normalizer.js';
import { OcrProcessingError } from './tesseract-ocr.adapter.js';

export type MockOcrBehavior = 'standard' | 'empty' | 'multi_page' | 'corrupt' | 'timeout' | 'low_confidence' | 'contract' | 'policy';

export class SyntheticMockOcrAdapter implements OcrEngineAdapter {
  readonly name = 'mock-ocr-engine';
  readonly version = '1.0.0-mock';
  readonly isMock = true;

  private behavior: MockOcrBehavior;

  constructor(behavior: MockOcrBehavior = 'standard') {
    this.behavior = behavior;
  }

  setBehavior(behavior: MockOcrBehavior): void {
    this.behavior = behavior;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async process(input: OcrProcessInput): Promise<NormalizedOcrResult> {
    const startTime = Date.now();
    const { documentId, tenantId, buffer, mimeType, maxPages = 50 } = input;

    if (!buffer || buffer.length === 0) {
      throw new OcrProcessingError('Cannot perform OCR on empty or null document buffer.', 400, 'EMPTY_DOCUMENT_PAYLOAD');
    }

    if (this.behavior === 'corrupt') {
      throw new OcrProcessingError('Document file is corrupt or unparseable.', 422, 'CORRUPT_DOCUMENT_RASTERIZATION_FAILED');
    }

    if (this.behavior === 'timeout') {
      throw new OcrProcessingError('OCR engine operation exceeded time limit of 60000ms.', 504, 'OCR_TIMEOUT');
    }

    if (this.behavior === 'empty') {
      return {
        schemaVersion: '1.0.0',
        ocrResultId: `OCR-MOCK-${Date.now()}-001`,
        documentId,
        tenantId,
        engine: {
          name: this.name,
          version: this.version,
          language: 'eng',
          isMock: true,
        },
        coordinateSystem: {
          units: 'pixels',
          origin: 'top_left',
          dpi: 300,
        },
        status: 'SUCCESS',
        pageCount: 1,
        fullText: '',
        overallConfidence: 0.0,
        pages: [
          {
            pageNumber: 1,
            width: 2550,
            height: 3300,
            dpi: 300,
            rotationDegrees: 0,
            text: '',
            confidence: 0.0,
            lines: [],
            words: [],
          },
        ],
        metadata: {
          durationMs: Date.now() - startTime,
          processedAt: new Date().toISOString(),
          fileSizeBytes: buffer.length,
          mimeType,
        },
      };
    }

    const pageCount = this.behavior === 'multi_page' ? Math.min(maxPages, 2) : 1;
    const pages: OcrPageResult[] = [];

    for (let p = 1; p <= pageCount; p++) {
      const pageWords: OcrWordToken[] = [];
      const lines: OcrLineToken[] = [];

      let rawLines: { text: string; left: number; top: number; width: number; height: number }[];

      if (this.behavior === 'contract') {
        rawLines = [
          { text: 'MASTER SERVICES AGREEMENT', left: 100, top: 120, width: 600, height: 45 },
          { text: 'Between Acme Corp and Global Solutions Ltd.', left: 100, top: 180, width: 700, height: 35 },
          { text: 'Contract Number: CTR-2026-8801', left: 100, top: 240, width: 500, height: 30 },
          { text: 'Effective Date: 2026-04-01', left: 100, top: 300, width: 450, height: 30 },
          { text: 'Expiration Date: 2027-03-31', left: 100, top: 360, width: 450, height: 30 },
          { text: 'Total Contract Value: $500,000.00', left: 100, top: 420, width: 520, height: 32 },
          { text: 'Confidentiality Agreement and Indemnification clause applies.', left: 100, top: 480, width: 750, height: 30 },
        ];
      } else if (this.behavior === 'policy') {
        rawLines = [
          { text: 'ENTERPRISE INFORMATION SECURITY POLICY', left: 100, top: 120, width: 680, height: 45 },
          { text: 'Policy Document No: POL-2026-004', left: 100, top: 180, width: 500, height: 30 },
          { text: 'Effective Date: 2026-01-01', left: 100, top: 240, width: 420, height: 30 },
          { text: 'Version: v4.2', left: 100, top: 300, width: 250, height: 30 },
          { text: 'Corporate compliance standard and governance procedures.', left: 100, top: 360, width: 720, height: 30 },
        ];
      } else {
        rawLines =
          p === 1
            ? [
              { text: 'TAX INVOICE', left: 100, top: 120, width: 400, height: 45 },
              { text: 'Acme Global Supplies Corp.', left: 100, top: 200, width: 620, height: 35 },
              { text: 'Invoice No: INV-2026-9941', left: 100, top: 260, width: 550, height: 32 },
              { text: 'Total Due: $14,500.00', left: 100, top: 320, width: 480, height: 35 },
            ]
            : [
              { text: 'TERMS AND CONDITIONS', left: 100, top: 120, width: 580, height: 40 },
              { text: 'Payment due within 30 days of receipt.', left: 100, top: 180, width: 750, height: 30 },
            ];
      }

      for (let lIdx = 0; lIdx < rawLines.length; lIdx++) {
        const lineDef = rawLines[lIdx];
        const tokens = lineDef.text.split(' ');
        const lineWords: OcrWordToken[] = [];
        let wordLeft = lineDef.left;

        for (let wIdx = 0; wIdx < tokens.length; wIdx++) {
          const wText = tokens[wIdx];
          const wWidth = Math.max(30, Math.floor(lineDef.width / tokens.length));
          const wBbox = { left: wordLeft, top: lineDef.top, width: wWidth, height: lineDef.height };
          const pWidth = 2550;
          const pHeight = 3300;
          const normX = Math.max(0, Math.min(1, Number((wBbox.left / pWidth).toFixed(6))));
          const normY = Math.max(0, Math.min(1, Number((wBbox.top / pHeight).toFixed(6))));
          const normW = Math.max(0, Math.min(1, Number((wBbox.width / pWidth).toFixed(6))));
          const normH = Math.max(0, Math.min(1, Number((wBbox.height / pHeight).toFixed(6))));

          const wordToken: OcrWordToken = {
            id: `w-${p}-${pageWords.length + 1}`,
            text: wText,
            confidence: this.behavior === 'low_confidence' ? 0.62 : 0.985,
            bbox: wBbox,
            polygon: bboxToPolygon(wBbox),
            pageNumber: p,
            page_number: p,
            x: normX,
            y: normY,
            w: normW,
            h: normH,
          };
          lineWords.push(wordToken);
          pageWords.push(wordToken);
          wordLeft += wWidth + 10;
        }

        const lineBbox = { left: lineDef.left, top: lineDef.top, width: lineDef.width, height: lineDef.height };
        lines.push({
          id: `line-${p}-${lIdx + 1}`,
          text: lineDef.text,
          confidence: this.behavior === 'low_confidence' ? 0.62 : 0.985,
          bbox: lineBbox,
          polygon: bboxToPolygon(lineBbox),
          pageNumber: p,
          words: lineWords,
        });
      }

      pages.push({
        pageNumber: p,
        width: 2550,
        height: 3300,
        dpi: 300,
        rotationDegrees: 0,
        text: lines.map((l) => l.text).join('\n'),
        confidence: this.behavior === 'low_confidence' ? 0.62 : 0.985,
        lines,
        words: pageWords,
      });
    }

    const fullText = pages.map((p) => p.text).join('\n\n');
    const allWords = pages.flatMap((p) => p.words);
    const overallConfidence =
      allWords.length > 0
        ? Number((allWords.reduce((s, w) => s + w.confidence, 0) / allWords.length).toFixed(4))
        : 0.0;

    return {
      schemaVersion: '1.0.0',
      ocrResultId: `OCR-MOCK-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`,
      documentId,
      tenantId,
      engine: {
        name: this.name,
        version: this.version,
        language: 'eng',
        isMock: true,
      },
      coordinateSystem: {
        units: 'pixels',
        origin: 'top_left',
        dpi: 300,
      },
      status: 'SUCCESS',
      pageCount: pages.length,
      fullText,
      overallConfidence,
      pages,
      metadata: {
        durationMs: Date.now() - startTime,
        processedAt: new Date().toISOString(),
        fileSizeBytes: buffer.length,
        mimeType,
      },
    };
  }
}
