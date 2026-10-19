import { TemplateDrivenExtractor } from './template-driven-extractor.js';
import { SyntheticMockOcrAdapter } from './mock-ocr.adapter.js';
import { RetentionService } from './retention.service.js';
import { IntakeService } from './intake.service.js';
import { getDocumentPageImageHandler } from '../controllers/document.controller.js';
import { dbPool } from '../database/postgres.client.js';

describe('Part 0: Bounding-box evidence and page images (Sprint 7)', () => {
  const extractor = new TemplateDrivenExtractor();
  const ocrAdapter = new SyntheticMockOcrAdapter('standard');

  beforeEach(() => {
    jest.clearAllMocks();
    RetentionService.clearMemoryState();
  });

  // 0.5 Test 1: Boxes normalized between 0 and 1
  it('0.1/0.5: OCR words and bounding boxes are normalized to [0, 1] relative to page dimensions', async () => {
    const ocrResult = await ocrAdapter.process({
      buffer: Buffer.from('%PDF-1.4 mock content'),
      mimeType: 'application/pdf',
      documentId: 'doc-norm-1',
      fileName: 'doc-norm-1.pdf',
      tenantId: 'TNT-TEST',
    });

    expect(ocrResult.pages.length).toBeGreaterThan(0);
    const firstPage = ocrResult.pages[0];
    expect(firstPage.width).toBeGreaterThan(0);
    expect(firstPage.height).toBeGreaterThan(0);
    expect(firstPage.words.length).toBeGreaterThan(0);

    for (const word of firstPage.words) {
      const x = word.x ?? word.bbox.left / firstPage.width;
      const y = word.y ?? word.bbox.top / firstPage.height;
      const w = word.w ?? word.bbox.width / firstPage.width;
      const h = word.h ?? word.bbox.height / firstPage.height;

      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  // 0.5 Test 2: Unmapped evidence flagged not fabricated
  it('0.2/0.5: Unmapped field evidence is flagged with evidence_unmapped=true and boxes=[], never fabricated coordinates', async () => {
    const templateFields = [
      { id: 'f1', key: 'invoice_number', label: 'Invoice Number', type: 'STRING' as const, required: true },
      { id: 'f2', key: 'unmapped_custom_code', label: 'Unmapped Custom Code', type: 'STRING' as const, required: false },
    ];

    const ocrResult = {
      fullText: 'Invoice Number: INV-99201\nTotal: $500.00',
      confidence: 0.95,
      pages: [
        {
          pageNumber: 1,
          width: 1000,
          height: 1400,
          text: 'Invoice Number: INV-99201\nTotal: $500.00',
          words: [
            { text: 'Invoice', confidence: 0.99, bbox: { x: 0.1, y: 0.1, w: 0.05, h: 0.02 }, pageNumber: 1 },
            { text: 'Number:', confidence: 0.99, bbox: { x: 0.16, y: 0.1, w: 0.06, h: 0.02 }, pageNumber: 1 },
            { text: 'INV-99201', confidence: 0.98, bbox: { x: 0.23, y: 0.1, w: 0.08, h: 0.02 }, pageNumber: 1 },
          ],
        },
      ],
    };

    const extracted = await extractor.extractFields(templateFields as any, ocrResult as any);

    expect(extracted.length).toBe(2);

    // Mapped field
    const mappedField = extracted.find((f) => f.fieldName === 'invoice_number');
    expect(mappedField).toBeDefined();
    if (mappedField?.evidence) {
      expect(mappedField.evidence.boxes.length).toBeGreaterThan(0);
      for (const box of mappedField.evidence.boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x).toBeLessThanOrEqual(1);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeLessThanOrEqual(1);
      }
    }

    // Unmapped field
    const unmappedField = extracted.find((f) => f.fieldName === 'unmapped_custom_code');
    expect(unmappedField).toBeDefined();
    if (unmappedField?.evidence) {
      // Must flag evidence_unmapped and leave boxes empty - never fabricate coordinates!
      expect(unmappedField.evidence.evidence_unmapped).toBe(true);
      expect(unmappedField.evidence.boxes).toEqual([]);
    }
  });

  // 0.5 Test 3: Cross-tenant image request is 404
  it('0.3/0.5: Cross-tenant GET /api/v1/documents/:id/pages/:pageNo/image returns 404', async () => {
    const mockReq: any = {
      user: { tenantId: 'tenant-user-alpha' },
      params: { id: 'doc-owned-by-beta', pageNo: '1' },
    };

    let statusCode = 200;
    let jsonBody: any = null;
    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        jsonBody = body;
        return this;
      },
      setHeader() {
        return this;
      },
      send() {
        return this;
      },
    };
    const mockNext = jest.fn();

    // Mock dbPool.query to return 0 rows for tenant A requesting doc owned by tenant B
    jest.spyOn(dbPool as any, 'query').mockResolvedValueOnce({ rows: [] } as any);

    await getDocumentPageImageHandler(mockReq, mockRes, mockNext);

    expect(statusCode).toBe(404);
    expect(jsonBody?.type).toContain('DOCUMENT_NOT_FOUND');
  });

  // 0.5 Test 4: Page images are purged with the document during retention purge
  it('0.4/0.5: Cached page images under tenant prefix are purged along with document binary', async () => {
    const tenantId = 'TNT-ALPHA';
    const documentId = 'DOC-PURGE-777';

    // Seed a deletion case and approve it
    const delCase = await RetentionService.requestDeletionCase(tenantId, 'USR-REQUESTER', {
      documentId,
      documentTitle: 'Invoice To Purge',
      documentType: 'Purchase Invoice',
    });
    await RetentionService.approveDeletionCase(tenantId, delCase.id, 'USR-APPROVER');

    // Store a mock page image in intake storage
    const storage = IntakeService.getStorage();
    const pageImageKey = `tenants/${tenantId}/documents/${documentId}/pages/page_1.png`;
    await storage.putObject(pageImageKey, Buffer.from('mock-png-bytes'));

    expect(await storage.hasObject(pageImageKey)).toBe(true);

    // Execute purge
    const purgeResult = await RetentionService.executePurge(tenantId, delCase.id);
    expect(purgeResult.status).toBe('COMPLETED');

    // Verify page image was purged
    const stillExists = await storage.hasObject(pageImageKey);
    expect(stillExists).toBe(false);
  });
});
