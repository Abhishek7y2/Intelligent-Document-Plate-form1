import { SchemaService, seedDefaultSchemaData, DatabasePersistenceError } from './schema.service.js';
import { dbPool } from '../database/postgres.client.js';
import { PolicyEvaluator } from './policy-evaluator.js';
import { ProcessingPolicyRecord, TemplateField } from '../models/schema.models.js';
import { isSafeRegex, safeRegexMatch } from '../utils/schema-validator.js';

describe('Sprint 3: SchemaService & PolicyEvaluator Comprehensive Audit Tests', () => {
  beforeEach(() => {
    seedDefaultSchemaData();
    SchemaService.setStoreModeForTesting('memory');
  });

  describe('Document Type Catalog & Multi-Tenant Fencing', () => {
    it('should list global default document types (Purchase Invoice, Supplier Contract, Internal Policy)', async () => {
      const types = await SchemaService.listDocumentTypes('TNT-CORP-01');
      expect(types.length).toBeGreaterThanOrEqual(3);

      const codes = types.map((t) => t.code);
      expect(codes).toContain('PUR-INVOICE');
      expect(codes).toContain('SUP-CONTRACT');
      expect(codes).toContain('INT-POLICY');
    });

    it('should retrieve a document type by id', async () => {
      const docType = await SchemaService.getDocumentType('purchase-invoice', 'TNT-CORP-01');
      expect(docType).toBeDefined();
      expect(docType?.code).toBe('PUR-INVOICE');
      expect(docType?.activeVersion).toBe('v2.1');
    });

    it('should block cross-tenant document type access', async () => {
      await SchemaService.createDocumentType(
        { typeId: 'custom-tax-form', code: 'TAX-FORM', name: 'Tenant B Tax Form' },
        'TNT-TENANT-B'
      );

      await expect(
        SchemaService.getDocumentType('custom-tax-form', 'TNT-TENANT-A')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'CROSS_TENANT_FORBIDDEN',
      });
    });

    it('should prevent creating duplicate document type with same identifier', async () => {
      await expect(
        SchemaService.createDocumentType(
          { typeId: 'purchase-invoice', code: 'PUR-INVOICE-2', name: 'Duplicate Invoice' },
          'TNT-CORP-01'
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DOCUMENT_TYPE_EXISTS',
      });
    });
  });

  describe('Extraction Templates & Version Activation Invariants', () => {
    it('should list templates for a document type', async () => {
      const templates = await SchemaService.listTemplates('purchase-invoice', 'TNT-CORP-01');
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates[0].version).toBe('v2.1');
    });

    it('should create a draft template and prevent publishing with empty fields', async () => {
      const draft = await SchemaService.createDraftTemplate(
        'purchase-invoice',
        { version: 'v3.0', name: 'Invoice v3 Empty', fields: [] },
        'TNT-CORP-01'
      );
      expect(draft.status).toBe('DRAFT');

      await expect(
        SchemaService.publishTemplate('purchase-invoice', 'v3.0', 'TNT-CORP-01')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'EMPTY_TEMPLATE_FIELDS',
      });
    });

    it('should publish a valid template, archive previous version, and update activeVersion atomically', async () => {
      const validFields: TemplateField[] = [
        {
          id: 'f1',
          key: 'vendor_name',
          label: 'Vendor Name',
          type: 'text',
          cardinality: 'single',
          required: true,
          masking: 'none',
          reviewerRole: 'reviewer',
          exportable: true,
          confidenceThreshold: 0.90,
        },
      ];

      await SchemaService.createDraftTemplate(
        'purchase-invoice',
        { version: 'v3.1', name: 'Invoice Schema v3.1', fields: validFields },
        'TNT-CORP-01'
      );

      const published = await SchemaService.publishTemplate('purchase-invoice', 'v3.1', 'TNT-CORP-01');
      expect(published.status).toBe('PUBLISHED');

      // Active version pointer updated
      const docType = await SchemaService.getDocumentType('purchase-invoice', 'TNT-CORP-01');
      expect(docType?.activeVersion).toBe('v3.1');

      // Previous version archived
      const oldTemplate = await SchemaService.getTemplate('purchase-invoice', 'v2.1', 'TNT-CORP-01');
      expect(oldTemplate?.status).toBe('ARCHIVED');
    });
  });

  describe('Persistence Safety: Eliminating Silent In-Memory Fallbacks', () => {
    it('should fail closed when configured for database mode and database is unavailable', async () => {
      // Temporarily set store mode to database
      SchemaService.setStoreModeForTesting('database');
      const spy = (jest.spyOn(dbPool, 'query') as any).mockRejectedValueOnce(new Error('Connection terminated'));

      try {
        await expect(
          SchemaService.listDocumentTypes('TNT-CORP-01')
        ).rejects.toThrow(DatabasePersistenceError);
      } finally {
        spy.mockRestore();
        // Restore memory mode for remaining unit tests
        SchemaService.setStoreModeForTesting('memory');
      }
    });
  });

  describe('Safe Regular Expressions & ReDoS Defense with Bounded Execution', () => {
    it('should accept valid, safe regex patterns', () => {
      const safe = isSafeRegex('^[A-Z0-9\\-]+$');
      expect(safe.safe).toBe(true);
    });

    it('should statically detect and reject dangerous nested quantifier patterns', () => {
      const dangerous = isSafeRegex('(a+)+$');
      expect(dangerous.safe).toBe(false);
      expect(dangerous.error).toContain('catastrophic backtracking');
    });

    it('should reject regex syntax errors', () => {
      const invalid = isSafeRegex('[a-z');
      expect(invalid.safe).toBe(false);
      expect(invalid.error).toContain('Invalid regular expression');
    });

    it('should safely match strings within bounded execution timeout', () => {
      const res = safeRegexMatch('^[0-9]{4}$', '2026', 1000);
      expect(res.matched).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('should reject regex patterns with repeated wildcards or overlapping alternations', () => {
      const wildcard = isSafeRegex('(.+)+');
      expect(wildcard.safe).toBe(false);
      expect(wildcard.error).toBeDefined();

      const alternation = isSafeRegex('(a|aa)+');
      expect(alternation.safe).toBe(false);
      expect(alternation.error).toBeDefined();
    });

    it('should reject inputs exceeding maximum evaluation length cap (8192 characters)', () => {
      const hugeInput = 'A'.repeat(8193);
      const res = safeRegexMatch('^[A-Z]+$', hugeInput);
      expect(res.matched).toBe(false);
      expect(res.error).toContain('exceeds maximum evaluation limit');
    });

    it('should safely handle null or undefined input text in safeRegexMatch', () => {
      const resNull = safeRegexMatch('^[A-Z]+$', null as any);
      expect(resNull.matched).toBe(false);

      const resUndef = safeRegexMatch('^[A-Z]+$', undefined as any);
      expect(resUndef.matched).toBe(false);
    });

    it('should safely handle malformed regex expressions without throwing unhandled exceptions', () => {
      const res = safeRegexMatch('[a-z', 'test');
      expect(res.matched).toBe(false);
      expect(res.error).toContain('Invalid regular expression');
    });
  });

  describe('Deterministic PolicyEvaluator: All Operators & Fail-Safe Invariants', () => {
    const policyWithAllOperators: ProcessingPolicyRecord = {
      policyId: 'pol-full-001',
      documentTypeId: 'purchase-invoice',
      tenantId: 'TNT-CORP-01',
      name: 'Comprehensive Financial Governance Policy',
      policyType: 'VALIDATION',
      version: 'v1.0',
      status: 'ACTIVE',
      rules: [
        {
          ruleId: 'R-HIGH-VALUE',
          name: 'High Value Threshold Gate',
          field: 'total_amount',
          operator: 'gt',
          value: 50000,
          action: 'REQUIRE_APPROVAL',
          message: 'Total amount exceeds $50,000 threshold.',
        },
        {
          ruleId: 'R-PROHIBITED-VENDOR',
          name: 'Sanctioned Vendor Check',
          field: 'vendor_name',
          operator: 'in',
          value: ['Blacklisted Corp', 'Sanctioned Logistics'],
          action: 'REJECT',
          message: 'Vendor is blacklisted.',
        },
        {
          ruleId: 'R-CONTAINS-DISPUTE',
          name: 'Disputed Invoice Check',
          field: 'notes',
          operator: 'contains',
          value: 'dispute',
          action: 'FLAG_REVIEW',
          message: 'Invoice has dispute notes.',
        },
        {
          ruleId: 'R-EMPTY-INVOICE-CHECK',
          name: 'Blank Invoice Number Check',
          field: 'invoice_number',
          operator: 'eq',
          value: '',
          action: 'REJECT',
          message: 'Invoice number cannot be blank.',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return PASSED when all rules pass without triggering review or reject', () => {
      const cleanData = {
        total_amount: 15000,
        vendor_name: 'Authorized Vendor Inc',
        notes: 'Standard payment terms net 30',
        invoice_number: 'INV-2026-9901',
      };

      const result = PolicyEvaluator.evaluate(policyWithAllOperators, cleanData);
      expect(result.status).toBe('PASSED');
      expect(result.summary).toContain('All policy validation checks passed');
    });

    it('should trigger REJECT and FAILED status when prohibited vendor matches', () => {
      const rejectedData = {
        total_amount: 5000,
        vendor_name: 'Blacklisted Corp',
        notes: 'Standard shipment',
        invoice_number: 'INV-001',
      };

      const result = PolicyEvaluator.evaluate(policyWithAllOperators, rejectedData);
      expect(result.status).toBe('FAILED');
      const rejectRule = result.ruleEvaluations.find((r) => r.ruleId === 'R-PROHIBITED-VENDOR');
      expect(rejectRule?.matched).toBe(true);
    });

    it('should trigger REQUIRES_REVIEW when high-value threshold is met', () => {
      const highValData = {
        total_amount: 75000,
        vendor_name: 'Authorized Vendor Inc',
        notes: 'Standard terms',
        invoice_number: 'INV-002',
      };

      const result = PolicyEvaluator.evaluate(policyWithAllOperators, highValData);
      expect(result.status).toBe('REQUIRES_REVIEW');
    });

    it('should NOT silently coerce strings as numbers for numeric comparisons (type mismatch)', () => {
      const testPolicy: ProcessingPolicyRecord = {
        policyId: 'pol-num-01',
        documentTypeId: 'purchase-invoice',
        tenantId: null,
        name: 'Strict Number Policy',
        policyType: 'VALIDATION',
        version: 'v1.0',
        status: 'ACTIVE',
        rules: [
          {
            ruleId: 'R-NUM-GT',
            name: 'Numeric GT Check',
            field: 'amount',
            operator: 'gt',
            value: 100,
            action: 'FLAG_REVIEW',
            message: 'Amount exceeds 100.',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Pass amount as a string "500" instead of number 500
      const result = PolicyEvaluator.evaluate(testPolicy, { amount: '500' });
      // Must fail safely due to type mismatch
      expect(result.status).toBe('FAILED');
      expect(result.ruleEvaluations[0].error).toContain('Type mismatch');
    });

    it('should evaluate date comparisons properly for gt / lt', () => {
      const datePolicy: ProcessingPolicyRecord = {
        policyId: 'pol-date-01',
        documentTypeId: 'supplier-contract',
        tenantId: null,
        name: 'Contract Expiration Policy',
        policyType: 'VALIDATION',
        version: 'v1.0',
        status: 'ACTIVE',
        rules: [
          {
            ruleId: 'R-EXPIRE-GATE',
            name: 'Expiration Gate',
            field: 'expiry_date',
            operator: 'gt',
            value: '2026-01-01',
            action: 'APPROVE',
            message: 'Contract is active through 2026.',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const res = PolicyEvaluator.evaluate(datePolicy, { expiry_date: '2026-12-31' });
      expect(res.ruleEvaluations[0].matched).toBe(true);
      expect(res.status).toBe('PASSED');
    });

    it('should reject unknown operators with controlled validation error and fail policy', () => {
      const badOperatorPolicy: any = {
        policyId: 'pol-bad-op',
        name: 'Bad Operator Policy',
        rules: [
          {
            ruleId: 'R-UNKNOWN',
            name: 'Unknown Operator',
            field: 'status',
            operator: 'unsupported_magic_op',
            value: 123,
            action: 'FLAG_REVIEW',
            message: 'Testing unknown operator.',
          },
        ],
      };

      const res = PolicyEvaluator.evaluate(badOperatorPolicy, { status: 'PENDING' });
      expect(res.status).toBe('FAILED');
      expect(res.ruleEvaluations[0].error).toContain('Unknown or unsupported policy operator');
    });

    it('should fail safely when evaluated against malformed policy definition', () => {
      const res = PolicyEvaluator.evaluate(null as any, {});
      expect(res.status).toBe('FAILED');
      expect(res.summary).toContain('Malformed policy definition');
    });

    it('should verify eq, neq, lte, gte, in, regex_match operators', () => {
      const opsPolicy: ProcessingPolicyRecord = {
        policyId: 'pol-ops-01',
        documentTypeId: 'purchase-invoice',
        tenantId: null,
        name: 'Ops Matrix Policy',
        policyType: 'VALIDATION',
        version: 'v1.0',
        status: 'ACTIVE',
        rules: [
          { ruleId: 'R-EQ', name: 'Eq Rule', field: 'status', operator: 'eq', value: 'approved', action: 'APPROVE', message: 'Status is approved.' },
          { ruleId: 'R-NEQ', name: 'Neq Rule', field: 'type', operator: 'neq', value: 'estimate', action: 'APPROVE', message: 'Type is not estimate.' },
          { ruleId: 'R-GTE', name: 'Gte Rule', field: 'score', operator: 'gte', value: 80, action: 'APPROVE', message: 'Score >= 80.' },
          { ruleId: 'R-LTE', name: 'Lte Rule', field: 'score', operator: 'lte', value: 95, action: 'APPROVE', message: 'Score <= 95.' },
          { ruleId: 'R-REGEX', name: 'Regex Rule', field: 'code', operator: 'regex_match', value: '^DOC-[0-9]+$', action: 'APPROVE', message: 'Code matches pattern.' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const res = PolicyEvaluator.evaluate(opsPolicy, {
        status: 'Approved',
        type: 'invoice',
        score: 85,
        code: 'DOC-12345',
      });

      expect(res.status).toBe('PASSED');
      expect(res.ruleEvaluations.every((r) => r.matched)).toBe(true);
    });
  });
});
