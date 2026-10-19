import {
  ExportService,
  ExportValidationError,
  ExportAccessDeniedError,
} from './export.service.js';
import { IntakeService } from './intake.service.js';
import { ReportService } from './report.service.js';

describe('Export Service (Sprint 11 - FR-018, SEC-008)', () => {
  const TENANT_A = 'TNT-EXPORT-ALPHA';
  const TENANT_B = 'TNT-EXPORT-BETA';
  const USER_A = 'USR-EXPORT-01';

  beforeEach(() => {
    ExportService.setStoreMode('memory');
    ExportService.clearInMemory();
    ReportService.setStoreMode('memory');
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-501',
      tenantId: TENANT_A,
      fileName: 'Sensitive_Payroll_John_Doe.pdf',
      storagePath: '/tenants/TNT-EXPORT-ALPHA/DOC-501.pdf',
      fileSizeBytes: 15000,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-501',
      documentType: 'Payroll',
      status: 'APPROVED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: 0.98,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });
  });

  describe('Asynchronous Export Request & Artifact Generation', () => {
    it('should queue and generate a CSV export with SHA-256 checksum seal', async () => {
      const job = await ExportService.requestExport(TENANT_A, USER_A, {
        reportType: 'documents',
        format: 'csv',
        maskPii: true,
      });

      expect(job).toBeDefined();
      expect(job.id).toMatch(/^EXP-/);
      expect(job.format).toBe('csv');
      expect(job.status).toBe('COMPLETED');
      expect(job.sha256Hash).toBeDefined();
      expect(job.sha256Hash?.length).toBe(64); // SHA-256 hex length
      expect(job.downloadUrl).toContain('/download?token=DLT-');
    });

    it('should reject invalid report types', async () => {
      await expect(
        ExportService.requestExport(TENANT_A, USER_A, {
          reportType: 'invalid_type_unknown' as any,
          format: 'csv',
        })
      ).rejects.toThrow(ExportValidationError);
    });

    it('should generate JSON export when requested', async () => {
      const job = await ExportService.requestExport(TENANT_A, USER_A, {
        reportType: 'governance',
        format: 'json',
      });

      expect(job.format).toBe('json');

      const url = new URL(`http://localhost${job.downloadUrl}`);
      const token = url.searchParams.get('token')!;
      const download = await ExportService.downloadExport(TENANT_A, job.id, token);

      expect(download.contentType).toBe('application/json');
      const parsed = JSON.parse(download.content);
      expect(parsed).toBeDefined();
    });
  });

  describe('PII and Financial Masking (SEC-008)', () => {
    it('should mask sensitive credit cards, SSNs, and emails in export', async () => {
      const rawText = 'Contact john.doe@example.com or 4532-1234-5678-9012 or 123-45-6789.';
      const masked = ExportService.maskSensitiveContent(rawText);

      expect(masked).not.toContain('john.doe@example.com');
      expect(masked).not.toContain('4532-1234-5678-9012');
      expect(masked).not.toContain('123-45-6789');
      expect(masked).toContain('j***@example.com');
      expect(masked).toContain('****-****-****-****');
      expect(masked).toContain('***-**-****');
    });
  });

  describe('Secure Download Verification & Tenant Isolation', () => {
    it('should permit download with valid short-lived token and matching tenant', async () => {
      const job = await ExportService.requestExport(TENANT_A, USER_A, {
        reportType: 'documents',
        format: 'csv',
      });

      const url = new URL(`http://localhost${job.downloadUrl}`);
      const token = url.searchParams.get('token')!;

      const download = await ExportService.downloadExport(TENANT_A, job.id, token);
      expect(download.content).toBeDefined();
      expect(download.sha256Hash).toBe(job.sha256Hash);
      expect(download.fileName).toContain(`DocuNexa_documents_export_${job.id}.csv`);
    });

    it('should reject download when token is invalid or missing', async () => {
      const job = await ExportService.requestExport(TENANT_A, USER_A, {
        reportType: 'documents',
        format: 'csv',
      });

      await expect(
        ExportService.downloadExport(TENANT_A, job.id, 'DLT-forged-invalid-token')
      ).rejects.toThrow(ExportAccessDeniedError);
    });

    it('should strictly reject download when accessed by a different tenant (Cross-Tenant Protection)', async () => {
      const job = await ExportService.requestExport(TENANT_A, USER_A, {
        reportType: 'documents',
        format: 'csv',
      });

      const url = new URL(`http://localhost${job.downloadUrl}`);
      const token = url.searchParams.get('token')!;

      // Tenant B attempts to use valid token from Tenant A
      await expect(
        ExportService.downloadExport(TENANT_B, job.id, token)
      ).rejects.toThrow(ExportAccessDeniedError);
    });
  });
});
