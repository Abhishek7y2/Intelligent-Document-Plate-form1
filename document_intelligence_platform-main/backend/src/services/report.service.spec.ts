import { ReportService } from './report.service.js';
import { IntakeService } from './intake.service.js';

describe('Report & Telemetry Service (Sprint 11 - FR-017)', () => {
  const TENANT_A = 'TNT-REPORT-ALPHA';
  const TENANT_B = 'TNT-REPORT-BETA';

  beforeEach(() => {
    ReportService.setStoreMode('memory');
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();

    // Seed mock documents in Tenant A
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-101',
      tenantId: TENANT_A,
      fileName: 'Invoice_101.pdf',
      storagePath: '/tenants/TNT-REPORT-ALPHA/DOC-101.pdf',
      fileSizeBytes: 10240,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-101',
      documentType: 'Tax Invoice',
      status: 'APPROVED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: 0.96,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-102',
      tenantId: TENANT_A,
      fileName: 'Invoice_102.pdf',
      storagePath: '/tenants/TNT-REPORT-ALPHA/DOC-102.pdf',
      fileSizeBytes: 20480,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-102',
      documentType: 'Tax Invoice',
      status: 'REJECTED',
      stage: 'HUMAN_REVIEW_REQUIRED',
      confidenceScore: 0.65,
      slaStatus: 'WARNING',
      ingestionSource: 'EMAIL_INGEST',
      pageCount: 2,
      uploadedAt: new Date(),
    });

    IntakeService.setInMemoryDocument({
      documentId: 'DOC-103',
      tenantId: TENANT_A,
      fileName: 'Malware_103.pdf',
      storagePath: '/tenants/TNT-REPORT-ALPHA/DOC-103.pdf',
      fileSizeBytes: 4096,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-103',
      documentType: 'Unknown',
      status: 'QUARANTINED',
      stage: 'SECURITY_SCAN',
      confidenceScore: 0.0,
      slaStatus: 'BREACHED',
      ingestionSource: 'API_CONNECTOR',
      pageCount: 1,
      uploadedAt: new Date(),
    });
  });

  describe('Operational Metrics Reconciliation', () => {
    it('should aggregate metrics accurately matching seeded documents', async () => {
      const report = await ReportService.getGovernanceReportMetrics(TENANT_A, { dateRange: 'Last 30 Days' });

      expect(report).toBeDefined();
      expect(report.tenantId).toBe(TENANT_A);
      expect(report.filterRange).toBe('Last 30 Days');

      // Executive section
      expect(report.executive.totalProcessed).toBe(3);
      expect(report.executive.cards.length).toBe(4);

      // Ingestion section
      expect(report.ingestion.channels).toBeDefined();

      // AI SLA section
      expect(report.aiSla.averageConfidencePercent).toBeGreaterThan(0);

      // Governance section
      expect(report.governance.recentAuditLogs.length).toBeGreaterThan(0);

      // Exceptions section
      expect(report.exceptions.activeQuarantines).toBe(1);
      expect(report.exceptions.rejectedInvoices).toBe(1);
    });

    it('should calculate STP rate based on high confidence approved documents', async () => {
      const report = await ReportService.getGovernanceReportMetrics(TENANT_A);
      // Total = 3, Approved with confidence >= 0.90 is DOC-101 (1 out of 3 = 33%)
      expect(report.executive.stpRatePercent).toBe(33);
    });

    it('should provide summary KPIs endpoint data', async () => {
      const kpis = await ReportService.getOperationalKpiSummary(TENANT_A);
      expect(kpis.totalProcessed).toBe(3);
      expect(kpis.stpRatePercent).toBe(33);
      expect(kpis.kpis.length).toBe(4);
      expect(kpis.generatedAt).toBeDefined();
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    it('should return isolated metrics for empty Tenant B without leaking Tenant A data', async () => {
      const reportB = await ReportService.getGovernanceReportMetrics(TENANT_B);
      expect(reportB.tenantId).toBe(TENANT_B);
      expect(reportB.exceptions.activeQuarantines).toBe(0);
      expect(reportB.exceptions.rejectedInvoices).toBe(0);
    });
  });
});
