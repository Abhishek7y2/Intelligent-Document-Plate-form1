import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  NormalizedOcrResult,
  OcrProcessInput,
  OcrPageResult,
  OcrLineToken,
  OcrWordToken,
} from '../models/ocr.models.js';
import { OcrEngineAdapter } from './ocr-engine.interface.js';
import { bboxToPolygon, normalizeConfidence } from '../utils/geometry-normalizer.js';
import { Logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export class OcrProcessingError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 500, code = 'OCR_PROCESSING_FAILED') {
    super(message);
    this.name = 'OcrProcessingError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class TesseractCliAdapter implements OcrEngineAdapter {
  readonly name = 'tesseract-cli';
  readonly version = '5.5.0';
  readonly isMock = false;

  private tesseractPath: string;
  private pdftoppmPath: string;

  constructor(customTesseractPath?: string, customPdftoppmPath?: string) {
    this.tesseractPath = customTesseractPath || this.findTesseractPath();
    this.pdftoppmPath = customPdftoppmPath || this.findPdftoppmPath();
  }

  private findTesseractPath(): string {
    const defaultWindowsPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    if (fs.existsSync(defaultWindowsPath)) {
      return defaultWindowsPath;
    }
    return 'tesseract';
  }

  private findPdftoppmPath(): string {
    const defaultWindowsPath = 'C:\\Program Files\\Release-24.08.0-0\\poppler-24.08.0\\Library\\bin\\pdftoppm.exe';
    if (fs.existsSync(defaultWindowsPath)) {
      return defaultWindowsPath;
    }
    return 'pdftoppm';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(this.tesseractPath, ['--version'], { timeout: 3000 });
      return stdout.includes('tesseract');
    } catch {
      return false;
    }
  }

  async process(input: OcrProcessInput): Promise<NormalizedOcrResult> {
    const startTime = Date.now();
    const { documentId, tenantId, buffer, mimeType, fileName: _fileName, maxPages = 50, timeoutMs = 60000 } = input;

    if (!buffer || buffer.length === 0) {
      throw new OcrProcessingError('Cannot perform OCR on empty or null document buffer.', 400, 'EMPTY_DOCUMENT_PAYLOAD');
    }

    if (buffer.length > 50 * 1024 * 1024) {
      throw new OcrProcessingError('Document exceeds maximum OCR payload limit of 50 MB.', 413, 'FILE_SIZE_LIMIT_EXCEEDED');
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `docunexa-ocr-${documentId}-`));

    try {
      const pageImages: string[] = [];

      if (mimeType === 'application/pdf') {
        const inputPdfPath = path.join(tmpDir, 'input.pdf');
        fs.writeFileSync(inputPdfPath, buffer);

        // Rasterize PDF at 300 DPI (FR-003 specification)
        const pagePrefix = path.join(tmpDir, 'page');
        try {
          await execFileAsync(this.pdftoppmPath, ['-png', '-r', '300', inputPdfPath, pagePrefix], {
            timeout: timeoutMs,
            maxBuffer: 50 * 1024 * 1024,
          });
        } catch (err: any) {
          const isTimeout = Boolean(err.killed || err.code === 'ETIMEDOUT' || (err.message && err.message.toLowerCase().includes('timed out')));
          if (isTimeout) {
            throw new OcrProcessingError(
              `PDF rasterization timed out after ${timeoutMs}ms. Underlying pdftoppm process was terminated.`,
              504,
              'OCR_RASTERIZATION_TIMEOUT'
            );
          }
          throw new OcrProcessingError(
            `Failed to rasterize PDF for OCR: ${err.message || 'pdftoppm execution failed'}`,
            422,
            'CORRUPT_DOCUMENT_RASTERIZATION_FAILED'
          );
        }

        const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('page-') && f.endsWith('.png'));
        // Sort numerically
        files.sort((a, b) => {
          const numA = parseInt(a.replace('page-', '').replace('.png', ''), 10) || 0;
          const numB = parseInt(b.replace('page-', '').replace('.png', ''), 10) || 0;
          return numA - numB;
        });

        if (files.length === 0) {
          throw new OcrProcessingError('PDF rasterization yielded 0 rendered pages.', 422, 'EMPTY_OR_CORRUPT_PDF');
        }

        const pagesToProcess = files.slice(0, maxPages);
        for (const file of pagesToProcess) {
          pageImages.push(path.join(tmpDir, file));
        }
      } else if (
        mimeType === 'image/png' ||
        mimeType === 'image/jpeg' ||
        mimeType === 'image/jpg' ||
        mimeType === 'image/tiff'
      ) {
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('tiff') ? 'tiff' : 'jpg';
        const imgPath = path.join(tmpDir, `page-1.${ext}`);
        fs.writeFileSync(imgPath, buffer);
        pageImages.push(imgPath);
      } else {
        throw new OcrProcessingError(
          `MIME type '${mimeType}' is not supported for rasterized OCR processing. Expected PDF, PNG, JPEG, or TIFF.`,
          415,
          'UNSUPPORTED_OCR_FORMAT'
        );
      }

      const pages: OcrPageResult[] = [];
      let pageNumber = 1;

      for (const pageImg of pageImages) {
        let tsvOutput = '';
        try {
          const { stdout } = await execFileAsync(this.tesseractPath, [pageImg, 'stdout', '-l', 'eng', 'tsv'], {
            timeout: timeoutMs,
            maxBuffer: 30 * 1024 * 1024,
          });
          tsvOutput = stdout;
        } catch (err: any) {
          const isTimeout = Boolean(err.killed || err.code === 'ETIMEDOUT' || (err.message && err.message.toLowerCase().includes('timed out')));
          if (isTimeout) {
            throw new OcrProcessingError(
              `Tesseract OCR execution timed out on page ${pageNumber} after ${timeoutMs}ms. Underlying tesseract process was terminated.`,
              504,
              'OCR_TIMEOUT'
            );
          }
          throw new OcrProcessingError(
            `Tesseract OCR execution failed on page ${pageNumber}: ${err.message}`,
            500,
            'TESSERACT_EXECUTION_ERROR'
          );
        }

        const pageResult = this.parseTsvOutput(tsvOutput, pageNumber);
        pages.push(pageResult);
        pageNumber++;
      }

      const durationMs = Date.now() - startTime;
      const fullText = pages.map((p) => p.text).join('\n\n').trim();
      const allWords = pages.flatMap((p) => p.words);
      const overallConfidence =
        allWords.length > 0
          ? Number((allWords.reduce((sum, w) => sum + w.confidence, 0) / allWords.length).toFixed(4))
          : 0.0;

      Logger.info({
        message: `OCR extraction completed successfully for ${documentId}`,
        context: 'TesseractCliAdapter',
        data: {
          documentId,
          tenantId,
          pageCount: pages.length,
          wordCount: allWords.length,
          durationMs,
        },
      });

      return {
        schemaVersion: '1.0.0',
        ocrResultId: `OCR-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`,
        documentId,
        tenantId,
        engine: {
          name: this.name,
          version: this.version,
          language: 'eng',
          isMock: false,
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
          durationMs,
          processedAt: new Date().toISOString(),
          fileSizeBytes: buffer.length,
          mimeType,
        },
      };
    } finally {
      // Secure directory cleanup: remove temp files
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Non-blocking cleanup error
      }
    }
  }

  private parseTsvOutput(tsv: string, pageNum: number): OcrPageResult {
    const linesRaw = tsv.split('\n');
    let pageWidth = 2550; // standard 8.5 x 11 at 300 DPI fallback
    let pageHeight = 3300;

    const words: OcrWordToken[] = [];
    const lineMap = new Map<string, { id: string; words: OcrWordToken[]; left: number; top: number; right: number; bottom: number }>();

    for (let i = 1; i < linesRaw.length; i++) {
      const row = linesRaw[i].split('\t');
      if (row.length < 12) continue;

      const level = parseInt(row[0], 10);
      const blockNum = row[2];
      const parNum = row[3];
      const lineNum = row[4];
      const left = parseInt(row[6], 10) || 0;
      const top = parseInt(row[7], 10) || 0;
      const width = parseInt(row[8], 10) || 0;
      const height = parseInt(row[9], 10) || 0;
      const conf = parseFloat(row[10]);
      const text = row[11]?.trim() || '';

      if (level === 1) {
        // Page level contains actual image dimensions
        if (width > 0) pageWidth = width;
        if (height > 0) pageHeight = height;
        continue;
      }

      if (level === 5 && text.length > 0) {
        // Word level
        const cleanConf = normalizeConfidence(conf);
        const bbox = { left, top, width, height };
        const polygon = bboxToPolygon(bbox);
        const normX = Math.max(0, Math.min(1, Number((left / pageWidth).toFixed(6))));
        const normY = Math.max(0, Math.min(1, Number((top / pageHeight).toFixed(6))));
        const normW = Math.max(0, Math.min(1, Number((width / pageWidth).toFixed(6))));
        const normH = Math.max(0, Math.min(1, Number((height / pageHeight).toFixed(6))));

        const wordToken: OcrWordToken = {
          id: `w-${pageNum}-${words.length + 1}`,
          text,
          confidence: cleanConf,
          bbox,
          polygon,
          pageNumber: pageNum,
          page_number: pageNum,
          x: normX,
          y: normY,
          w: normW,
          h: normH,
        };
        words.push(wordToken);

        const lineKey = `${blockNum}-${parNum}-${lineNum}`;
        const existingLine = lineMap.get(lineKey);
        if (!existingLine) {
          lineMap.set(lineKey, {
            id: `line-${pageNum}-${lineMap.size + 1}`,
            words: [wordToken],
            left,
            top,
            right: left + width,
            bottom: top + height,
          });
        } else {
          existingLine.words.push(wordToken);
          existingLine.left = Math.min(existingLine.left, left);
          existingLine.top = Math.min(existingLine.top, top);
          existingLine.right = Math.max(existingLine.right, left + width);
          existingLine.bottom = Math.max(existingLine.bottom, top + height);
        }
      }
    }

    const lines: OcrLineToken[] = [];
    for (const l of lineMap.values()) {
      const lineBbox = {
        left: l.left,
        top: l.top,
        width: l.right - l.left,
        height: l.bottom - l.top,
      };
      const lineText = l.words.map((w) => w.text).join(' ');
      const lineConf = Number(
        (l.words.reduce((sum, w) => sum + w.confidence, 0) / (l.words.length || 1)).toFixed(4)
      );

      lines.push({
        id: l.id,
        text: lineText,
        confidence: lineConf,
        bbox: lineBbox,
        polygon: bboxToPolygon(lineBbox),
        pageNumber: pageNum,
        words: l.words,
      });
    }

    const pageText = lines.map((l) => l.text).join('\n');
    const pageConfidence =
      words.length > 0
        ? Number((words.reduce((sum, w) => sum + w.confidence, 0) / words.length).toFixed(4))
        : 0.0;

    return {
      pageNumber: pageNum,
      width: pageWidth,
      height: pageHeight,
      dpi: 300,
      rotationDegrees: 0,
      text: pageText,
      confidence: pageConfidence,
      lines,
      words,
    };
  }
}
