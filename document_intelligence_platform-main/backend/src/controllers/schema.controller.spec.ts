import { Response } from 'express';
import {
  listDocumentTypesHandler,
  getDocumentTypeHandler,
  createDocumentTypeHandler,
  validateTemplateHandler,
  evaluatePolicyHandler,
} from './schema.controller.js';
import { AuthenticatedRequest, requirePermission, enforceTenantIsolation } from '../middleware/auth.middleware.js';
import { SchemaService, seedDefaultSchemaData } from '../services/schema.service.js';

describe('Sprint 3: SchemaController & Authorization Security Tests', () => {
  beforeEach(() => {
    seedDefaultSchemaData();
  });

  describe('Document Types Controller', () => {
    it('should list available document types for authenticated tenant', async () => {
      const mockReq = {
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['SCHEMA_VIEW'] },
        headers: {},
      } as unknown as AuthenticatedRequest;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await listDocumentTypesHandler(mockReq, mockRes, mockNext);

      expect(responseData).toBeDefined();
      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
      expect(responseData.total).toBeGreaterThanOrEqual(3);
    });

    it('should return 404 RFC 7807 problem details for non-existent document type', async () => {
      const mockReq = {
        params: { id: 'non-existent-type-999' },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['SCHEMA_VIEW'] },
        headers: {},
        originalUrl: '/api/v1/document-types/non-existent-type-999',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let responseData: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
            },
          };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await getDocumentTypeHandler(mockReq, mockRes, mockNext);

      expect(statusCode).toBe(404);
      expect(responseData.type).toContain('NOT_FOUND');
    });

    it('should create a new document type for Admin role', async () => {
      const mockReq = {
        body: {
          typeId: 'custom-settlement-agreement',
          code: 'SETTLE-AGREE',
          name: 'Settlement Agreement',
          description: 'Legal settlement terms and release clauses.',
        },
        user: { userId: 'USR-ADMIN-01', tenantId: 'TNT-CORP-01', role: 'Admin', permissions: ['SCHEMA_MANAGE'] },
        headers: {},
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let responseData: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
            },
          };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await createDocumentTypeHandler(mockReq, mockRes, mockNext);

      expect(statusCode).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data.typeId).toBe('custom-settlement-agreement');
    });
  });

  describe('Template Definition Validation', () => {
    it('should return valid = true for well-formed field definitions', async () => {
      const mockReq = {
        body: {
          fields: [
            {
              id: 'f1',
              key: 'contract_title',
              label: 'Contract Title',
              type: 'text',
              cardinality: 'single',
              required: true,
              masking: 'none',
              reviewerRole: 'reviewer',
              exportable: true,
              confidenceThreshold: 0.85,
            },
          ],
        },
        headers: {},
      } as unknown as AuthenticatedRequest;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await validateTemplateHandler(mockReq, mockRes, mockNext);

      expect(responseData.valid).toBe(true);
    });

    it('should return 422 UNPROCESSABLE_ENTITY when a field contains dangerous ReDoS pattern', async () => {
      const mockReq = {
        body: {
          fields: [
            {
              id: 'f1',
              key: 'vulnerable_field',
              label: 'Vulnerable Field',
              type: 'text',
              cardinality: 'single',
              required: true,
              regexPattern: '(a+)+$', // Catastrophic backtracking pattern
              masking: 'none',
              reviewerRole: 'reviewer',
              exportable: true,
              confidenceThreshold: 0.85,
            },
          ],
        },
        headers: {},
        originalUrl: '/api/v1/document-types/purchase-invoice/templates/validate',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let responseData: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
            },
          };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await validateTemplateHandler(mockReq, mockRes, mockNext);

      expect(statusCode).toBe(422);
      expect(responseData.type).toContain('UNPROCESSABLE_ENTITY');
      expect(responseData.errors[0]).toContain('dangerous regular expression');
    });
  });

  describe('Policy Evaluation Endpoint', () => {
    it('should evaluate policy against payload and return structured results', async () => {
      // Create a test policy first
      const policy = await SchemaService.createDraftPolicy(
        'purchase-invoice',
        {
          name: 'Quick Evaluation Policy',
          policyType: 'VALIDATION',
          version: 'v1.0',
          rules: [
            {
              ruleId: 'R-CHECK-AMOUNT',
              name: 'Minimum Amount Check',
              field: 'total_amount',
              operator: 'gt',
              value: 0,
              action: 'FLAG_REVIEW',
              message: 'Amount must be greater than zero.',
            },
          ],
        },
        'TNT-CORP-01'
      );

      const mockReq = {
        params: { id: policy.policyId },
        body: {
          data: {
            total_amount: 500,
          },
        },
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['POLICY_EVALUATE'] },
        headers: {},
      } as unknown as AuthenticatedRequest;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await evaluatePolicyHandler(mockReq, mockRes, mockNext);

      expect(responseData).toBeDefined();
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('REQUIRES_REVIEW');
      expect(responseData.data.ruleEvaluations.length).toBe(1);
    });
  });

  describe('RBAC & Multi-Tenant Fencing on Schema Endpoints', () => {
    it('should reject non-admin users from creating document types (requires SCHEMA_MANAGE)', () => {
      const requireSchemaManage = requirePermission('SCHEMA_MANAGE');
      const mockReq = {
        user: { userId: 'USR-ANALYST-01', tenantId: 'TNT-CORP-01', role: 'Analyst', permissions: ['SCHEMA_VIEW'] },
      } as unknown as AuthenticatedRequest;

      let responseStatus = 0;
      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return { json: jest.fn() };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      requireSchemaManage(mockReq, mockRes, mockNext);

      expect(responseStatus).toBe(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block cross-tenant header tampering via enforceTenantIsolation', () => {
      const mockReq = {
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01', role: 'Reviewer', permissions: ['SCHEMA_VIEW'] },
        headers: { 'x-tenant-id': 'TNT-FOREIGN-99' }, // Header tampering attempt
      } as unknown as AuthenticatedRequest;

      let responseStatus = 0;
      let responseBody: any = null;
      const mockRes = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseBody = data;
            },
          };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      enforceTenantIsolation(mockReq, mockRes, mockNext);

      expect(responseStatus).toBe(403);
      expect(responseBody.type).toContain('FORBIDDEN');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request when user is missing from request', async () => {
      const mockReq = {
        headers: {},
      } as unknown as AuthenticatedRequest;

      const mockRes = {} as unknown as Response;
      const mockNext = jest.fn();

      await listDocumentTypesHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
        })
      );
    });
  });
});
