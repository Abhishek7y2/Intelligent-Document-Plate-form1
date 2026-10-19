import { ConnectorService } from './connector.service.js';
import { IntakeService } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';

describe('Connector Sandbox & Posting Boundaries (Sprint 11 - INT-004, SEC-010)', () => {
  const TENANT_A = 'TNT-CONNECTOR-ALPHA';
  const TENANT_B = 'TNT-CONNECTOR-BETA';
  const ADMIN_USER = 'USR-FINANCE-ADMIN';

  beforeEach(() => {
    ConnectorService.setStoreMode('memory');
    ConnectorService.clearInMemory();
    IntakeService.setStoreMode('memory');
    IntakeService.clearInMemory();
    ExtractionService.setStoreMode('memory');
    ExtractionService.clearInMemory();

    // Seed approved document
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-APPROVED-100',
      tenantId: TENANT_A,
      fileName: 'Approved_Invoice.pdf',
      storagePath: '/tenants/TNT-CONNECTOR-ALPHA/DOC-APPROVED-100.pdf',
      fileSizeBytes: 24000,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-app-100',
      documentType: 'Tax Invoice',
      status: 'APPROVED',
      stage: 'INGESTION_COMPLETE',
      confidenceScore: 0.95,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    // Seed unapproved document
    IntakeService.setInMemoryDocument({
      documentId: 'DOC-DRAFT-200',
      tenantId: TENANT_A,
      fileName: 'Draft_Invoice.pdf',
      storagePath: '/tenants/TNT-CONNECTOR-ALPHA/DOC-DRAFT-200.pdf',
      fileSizeBytes: 24000,
      mimeType: 'application/pdf',
      sha256Hash: 'hash-draft-200',
      documentType: 'Tax Invoice',
      status: 'NEEDS_REVIEW',
      stage: 'HUMAN_REVIEW_REQUIRED',
      confidenceScore: 0.70,
      slaStatus: 'ON_TRACK',
      ingestionSource: 'MANUAL_UPLOAD',
      pageCount: 1,
      uploadedAt: new Date(),
    });

    // Seed extractions for approved document
    ExtractionService.setInMemoryExtraction({
      extractionId: 'EXT-100',
      documentId: 'DOC-APPROVED-100',
      tenantId: TENANT_A,
      documentType: 'Tax Invoice',
      templateVersion: 'v1.0',
      fields: [
        {
          fieldId: 'F1',
          fieldName: 'invoiceNumber',
          label: 'Invoice Number',
          dataType: 'STRING',
          extractedValue: 'inv-98721',
          confidence: 0.98,
          status: 'EXTRACTED',
          pageNumber: 1,
        },
        {
          fieldId: 'F2',
          fieldName: 'totalAmount',
          label: 'Total Amount',
          dataType: 'NUMBER',
          extractedValue: '45000.50',
          confidence: 0.95,
          status: 'EXTRACTED',
          pageNumber: 1,
        },
        {
          fieldId: 'F3',
          fieldName: 'invoiceDate',
          label: 'Invoice Date',
          dataType: 'DATE',
          extractedValue: '2026-10-12',
          confidence: 0.99,
          status: 'EXTRACTED',
          pageNumber: 1,
        },
      ],
      validationSummary: { isValid: true, totalFieldsExpected: 3, totalFieldsExtracted: 3, missingRequiredFields: [], lowConfidenceFields: [] },
      routingDecision: 'STP_PROCESSED',
      extractedAt: new Date().toISOString(),
    } as any);
  });

  describe('Mapping Registration & Sign-Off Gate', () => {
    it('should register mapping with isSignedOff = false until explicitly approved', async () => {
      const mapping = await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        version: 'v1.0',
        fieldMappings: [
          { docField: 'invoiceNumber', erpField: 'BELNR', required: true, transform: 'uppercase' },
          { docField: 'totalAmount', erpField: 'DMBTR', required: true, transform: 'none' },
        ],
      });

      expect(mapping).toBeDefined();
      expect(mapping.isSignedOff).toBe(false);
      expect(mapping.signedOffBy).toBeUndefined();
    });

    it('should allow authorized administrator to sign off on mapping', async () => {
      const mapping = await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        fieldMappings: [
          { docField: 'invoiceNumber', erpField: 'BELNR', required: true },
        ],
      });

      const signed = await ConnectorService.signOffMapping(TENANT_A, mapping.id, ADMIN_USER);
      expect(signed).not.toBeNull();
      expect(signed?.isSignedOff).toBe(true);
      expect(signed?.signedOffBy).toBe(ADMIN_USER);
      expect(signed?.signedOffAt).toBeDefined();
    });
  });

  describe('Posting Boundaries & Guardrails (INT-004, SEC-010)', () => {
    it('should REJECT external dispatch if mapping has NOT been signed off', async () => {
      // Mapping created but NOT signed off
      await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        fieldMappings: [
          { docField: 'invoiceNumber', erpField: 'BELNR', required: true },
        ],
      });

      const dispatch = await ConnectorService.dispatchToConnector(
        TENANT_A,
        'DOC-APPROVED-100',
        'SAP_BAPI'
      );

      expect(dispatch.success).toBe(false);
      expect(dispatch.status).toBe('REJECTED_UNSIGNED_MAPPING');
      expect(dispatch.errorMessage).toContain('has not been signed off');
    });

    it('should REJECT external dispatch if document is NOT in APPROVED state', async () => {
      // Create and sign off mapping
      const mapping = await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        fieldMappings: [
          { docField: 'invoiceNumber', erpField: 'BELNR', required: true },
        ],
      });
      await ConnectorService.signOffMapping(TENANT_A, mapping.id, ADMIN_USER);

      // Attempt dispatch of DRAFT / UNAPPROVED document
      const dispatch = await ConnectorService.dispatchToConnector(
        TENANT_A,
        'DOC-DRAFT-200',
        'SAP_BAPI'
      );

      expect(dispatch.success).toBe(false);
      expect(dispatch.status).toBe('REJECTED_UNAPPROVED');
      expect(dispatch.errorMessage).toContain('Only APPROVED documents may be dispatched');
    });

    it('should SUCCEED when both Document is APPROVED and Mapping is Signed Off', async () => {
      const mapping = await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        fieldMappings: [
          { docField: 'invoiceNumber', erpField: 'BELNR', required: true, transform: 'uppercase' },
          { docField: 'totalAmount', erpField: 'DMBTR', required: true, transform: 'none' },
          { docField: 'invoiceDate', erpField: 'BLDAT', required: true, transform: 'date_iso' },
        ],
      });
      await ConnectorService.signOffMapping(TENANT_A, mapping.id, ADMIN_USER);

      const dispatch = await ConnectorService.dispatchToConnector(
        TENANT_A,
        'DOC-APPROVED-100',
        'SAP_BAPI'
      );

      expect(dispatch.success).toBe(true);
      expect(dispatch.status).toBe('POSTED_SANDBOX');
      expect(dispatch.externalTransactionId).toBeDefined();
      expect(dispatch.payloadTransformed).toBeDefined();
      expect(dispatch.payloadTransformed?.BELNR).toBe('INV-98721'); // Uppercased
      expect(dispatch.payloadTransformed?.DMBTR).toBe('45000.50');
      expect(dispatch.payloadTransformed?.BLDAT).toBe('2026-10-12');
    });

    it('should fail with VALIDATION_FAILED if a required source field is missing from extractions', async () => {
      const mapping = await ConnectorService.upsertMapping(TENANT_A, {
        connectorType: 'SAP_BAPI',
        documentType: 'Tax Invoice',
        fieldMappings: [
          { docField: 'vendorTaxId', erpField: 'STCEG', required: true }, // Not present in DOC-APPROVED-100
        ],
      });
      await ConnectorService.signOffMapping(TENANT_A, mapping.id, ADMIN_USER);

      const dispatch = await ConnectorService.dispatchToConnector(
        TENANT_A,
        'DOC-APPROVED-100',
        'SAP_BAPI'
      );

      expect(dispatch.success).toBe(false);
      expect(dispatch.status).toBe('VALIDATION_FAILED');
      expect(dispatch.errorMessage).toContain("missing extracted source field 'vendorTaxId'");
    });

    it('should enforce tenant isolation during dispatch', async () => {
      const dispatch = await ConnectorService.dispatchToConnector(
        TENANT_B, // Tenant B attempts to dispatch Tenant A's document
        'DOC-APPROVED-100',
        'SAP_BAPI'
      );

      expect(dispatch.success).toBe(false);
      expect(dispatch.status).toBe('VALIDATION_FAILED');
      expect(dispatch.errorMessage).toContain('Document does not exist or access is forbidden');
    });
  });
});
