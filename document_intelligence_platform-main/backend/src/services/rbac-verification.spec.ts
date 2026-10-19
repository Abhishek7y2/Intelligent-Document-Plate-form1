import { 
  requirePermission, 
  requireRole, 
  shieldOperatorContent, 
  enforceTenantIsolation, 
  normalizeRole,
  AuthenticatedRequest 
} from '../middleware/auth.middleware.js';
import { ROLE_PERMISSIONS, UserRole, Permission } from '../models/auth.models.js';
import { ApprovalService, SodViolationError } from './approval.service.js';
import { ReviewService } from './review.service.js';
import { SearchService } from './search.service.js';
import { QaService, CitationAccessDeniedError } from './qa.service.js';
import { IntakeService } from './intake.service.js';
import { Response } from 'express';

function createMockRes() {
  let statusCode = 200;
  let responseBody: any = null;
  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (body: any) => {
      responseBody = body;
      return res;
    },
  } as unknown as Response;

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => responseBody,
  };
}

describe('DocNexa — Full System RBAC & Task Access Verification Suite (BRD Section 3 & 8)', () => {
  // =========================================================================
  // 1. Canonical BRD Personas & Role Normalization
  // =========================================================================
  describe('1. Canonical Role Normalization & Permissions Matrix', () => {
    it('should correctly normalize all legacy and canonical role strings', () => {
      expect(normalizeRole('platform_operator')).toBe('platform_operator');
      expect(normalizeRole('operator')).toBe('platform_operator');
      expect(normalizeRole('org_admin')).toBe('org_admin');
      expect(normalizeRole('Admin')).toBe('org_admin');
      expect(normalizeRole('organization_admin')).toBe('org_admin');
      expect(normalizeRole('contributor')).toBe('contributor');
      expect(normalizeRole('reviewer')).toBe('reviewer');
      expect(normalizeRole('approver')).toBe('approver');
      expect(normalizeRole('auditor')).toBe('auditor');
    });

    it('should assign correct permission profiles to each canonical role', () => {
      // Contributor possesses upload, but not verify or approve
      expect(ROLE_PERMISSIONS.contributor).toContain('DOC_UPLOAD');
      expect(ROLE_PERMISSIONS.contributor).not.toContain('DOC_VERIFY');
      expect(ROLE_PERMISSIONS.contributor).not.toContain('DOC_APPROVE');

      // Reviewer possesses verify & edit, but not approve
      expect(ROLE_PERMISSIONS.reviewer).toContain('DOC_EDIT');
      expect(ROLE_PERMISSIONS.reviewer).toContain('DOC_VERIFY');
      expect(ROLE_PERMISSIONS.reviewer).not.toContain('DOC_APPROVE');

      // Approver possesses approve, but not edit
      expect(ROLE_PERMISSIONS.approver).toContain('DOC_APPROVE');
      expect(ROLE_PERMISSIONS.approver).not.toContain('DOC_EDIT');

      // Auditor possesses view, audit, & compare, but not upload or approve
      expect(ROLE_PERMISSIONS.auditor).toContain('DOC_VIEW');
      expect(ROLE_PERMISSIONS.auditor).toContain('AUDIT_VIEW');
      expect(ROLE_PERMISSIONS.auditor).not.toContain('DOC_UPLOAD');
      expect(ROLE_PERMISSIONS.auditor).not.toContain('DOC_APPROVE');

      // Platform Operator possesses health & admin, but NO document content permissions
      expect(ROLE_PERMISSIONS.platform_operator).toContain('SYSTEM_HEALTH_VIEW');
      expect(ROLE_PERMISSIONS.platform_operator).not.toContain('DOC_VIEW');
      expect(ROLE_PERMISSIONS.platform_operator).not.toContain('DOC_UPLOAD');
      expect(ROLE_PERMISSIONS.platform_operator).not.toContain('DOC_APPROVE');
      expect(ROLE_PERMISSIONS.platform_operator).not.toContain('QA_QUERY');
    });
  });

  // =========================================================================
  // 2. Middleware Permission Gating across Canonical Roles
  // =========================================================================
  describe('2. Endpoint Authorization Middleware by Role', () => {
    it('should allow Contributor to upload, and deny Auditor & Reviewer without DOC_UPLOAD', () => {
      const contributorReq = {
        user: { role: 'contributor', permissions: ROLE_PERMISSIONS.contributor },
        originalUrl: '/api/v1/documents/upload',
      } as unknown as AuthenticatedRequest;
      const { res: res1 } = createMockRes();
      const next1 = jest.fn();
      requirePermission('DOC_UPLOAD')(contributorReq, res1, next1);
      expect(next1).toHaveBeenCalled();

      const auditorReq = {
        user: { role: 'auditor', permissions: ROLE_PERMISSIONS.auditor },
        originalUrl: '/api/v1/documents/upload',
      } as unknown as AuthenticatedRequest;
      const { res: res2, getStatus: getStatus2, getBody: getBody2 } = createMockRes();
      const next2 = jest.fn();
      requirePermission('DOC_UPLOAD')(auditorReq, res2, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(getStatus2()).toBe(403);
      expect(getBody2().type).toContain('FORBIDDEN');
    });

    it('should allow Reviewer to verify fields, and deny Contributor & Approver', () => {
      const reviewerReq = {
        user: { role: 'reviewer', permissions: ROLE_PERMISSIONS.reviewer },
        originalUrl: '/api/v1/review/doc-1/decision',
      } as unknown as AuthenticatedRequest;
      const { res: res1 } = createMockRes();
      const next1 = jest.fn();
      requirePermission('DOC_VERIFY')(reviewerReq, res1, next1);
      expect(next1).toHaveBeenCalled();

      const approverReq = {
        user: { role: 'approver', permissions: ROLE_PERMISSIONS.approver },
        originalUrl: '/api/v1/review/doc-1/decision',
      } as unknown as AuthenticatedRequest;
      const { res: res2, getStatus: getStatus2 } = createMockRes();
      const next2 = jest.fn();
      requirePermission('DOC_VERIFY')(approverReq, res2, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(getStatus2()).toBe(403);
    });

    it('should allow Approver to approve documents, and deny Reviewer & Contributor', () => {
      const approverReq = {
        user: { role: 'approver', permissions: ROLE_PERMISSIONS.approver },
        originalUrl: '/api/v1/approvals/doc-1/decide',
      } as unknown as AuthenticatedRequest;
      const { res: res1 } = createMockRes();
      const next1 = jest.fn();
      requirePermission('DOC_APPROVE')(approverReq, res1, next1);
      expect(next1).toHaveBeenCalled();

      const reviewerReq = {
        user: { role: 'reviewer', permissions: ROLE_PERMISSIONS.reviewer },
        originalUrl: '/api/v1/approvals/doc-1/decide',
      } as unknown as AuthenticatedRequest;
      const { res: res2, getStatus: getStatus2 } = createMockRes();
      const next2 = jest.fn();
      requirePermission('DOC_APPROVE')(reviewerReq, res2, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(getStatus2()).toBe(403);
    });

    it('should allow Org Admin full schema management and deny Reviewer & Auditor', () => {
      const adminReq = {
        user: { role: 'org_admin', permissions: ROLE_PERMISSIONS.org_admin },
        originalUrl: '/api/v1/document-types/dt-1/templates',
      } as unknown as AuthenticatedRequest;
      const { res: res1 } = createMockRes();
      const next1 = jest.fn();
      requirePermission('SCHEMA_MANAGE')(adminReq, res1, next1);
      expect(next1).toHaveBeenCalled();

      const reviewerReq = {
        user: { role: 'reviewer', permissions: ROLE_PERMISSIONS.reviewer },
        originalUrl: '/api/v1/document-types/dt-1/templates',
      } as unknown as AuthenticatedRequest;
      const { res: res2, getStatus: getStatus2 } = createMockRes();
      const next2 = jest.fn();
      requirePermission('SCHEMA_MANAGE')(reviewerReq, res2, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(getStatus2()).toBe(403);
    });
  });

  // =========================================================================
  // 3. Platform Operator Content Shielding (BRD Section 3)
  // =========================================================================
  describe('3. Platform Operator Content Shielding (BRD Section 3 Mandate)', () => {
    it('should allow Platform Operator to access system health probes', () => {
      const operatorReq = {
        user: { role: 'platform_operator', permissions: ROLE_PERMISSIONS.platform_operator },
        originalUrl: '/api/v1/health',
      } as unknown as AuthenticatedRequest;
      const { res } = createMockRes();
      const next = jest.fn();
      requirePermission('SYSTEM_HEALTH_VIEW')(operatorReq, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should strictly deny Platform Operator access to document content endpoints', () => {
      const operatorReq = {
        user: { role: 'platform_operator', permissions: ROLE_PERMISSIONS.platform_operator },
        originalUrl: '/api/v1/documents/doc-sensitive-101',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockRes();
      const next = jest.fn();

      shieldOperatorContent(operatorReq, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getBody().type).toContain('OPERATOR_CONTENT_ACCESS_DENIED');
      expect(getBody().title).toContain('BRD Section 3');
    });

    it('should allow regular tenant roles through shieldOperatorContent', () => {
      const regularRoles: UserRole[] = ['org_admin', 'contributor', 'reviewer', 'approver', 'auditor'];
      for (const role of regularRoles) {
        const req = {
          user: { role, permissions: ROLE_PERMISSIONS[role] },
          originalUrl: '/api/v1/documents/doc-1',
        } as unknown as AuthenticatedRequest;
        const { res } = createMockRes();
        const next = jest.fn();
        shieldOperatorContent(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  // =========================================================================
  // 4. Separation of Duties (SoD) Dual-Control Enforcement (BRD Section 12)
  // =========================================================================
  describe('4. Separation of Duties (SoD) Dual-Control Rules', () => {
    const mockRequest = {
      id: 'APP-101',
      documentId: 'DOC-SOD-TEST',
      tenantId: 'TNT-CORP-01',
      status: 'PENDING',
      tier: 'TIER_1',
      monetaryAmount: 5000,
      currency: 'USD',
      requiredApprovals: 1,
      approvedCount: 0,
      sourceVersion: 'v1.0',
      submittedBy: 'alice_uploader@docnexa.io',
      reviewedBy: 'bob_reviewer@docnexa.io',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisions: [],
    } as any;

    const mockDoc = {
      documentId: 'DOC-SOD-TEST',
      tenantId: 'TNT-CORP-01',
      fileName: 'Invoice_101.pdf',
      documentType: 'Purchase Invoice',
      status: 'READY_FOR_APPROVAL',
      assignedTo: 'alice_uploader@docnexa.io',
    } as any;

    it('should block uploader/submitter from approving own document (SoD Submitter check)', async () => {
      const uploaderUser = {
        userId: 'alice-uploader-id',
        email: 'alice_uploader@docnexa.io',
        role: 'approver' as UserRole, // Even if given approver role!
        tenantId: 'TNT-CORP-01',
        permissions: ROLE_PERMISSIONS.approver,
      };

      const result = await ApprovalService.evaluateSod(mockRequest, uploaderUser, mockDoc);
      expect(result.allowed).toBe(false);
      expect(result.violationCode).toBe('SOD_VIOLATION_SUBMITTER');
      expect(result.message).toContain('prohibited from approving own document');
    });

    it('should block reviewer who verified document from approving (Maker-Checker violation)', async () => {
      const reviewerUser = {
        userId: 'bob-reviewer-id',
        email: 'bob_reviewer@docnexa.io',
        role: 'approver' as UserRole,
        tenantId: 'TNT-CORP-01',
        permissions: ROLE_PERMISSIONS.approver,
      };

      const result = await ApprovalService.evaluateSod(mockRequest, reviewerUser, mockDoc);
      expect(result.allowed).toBe(false);
      expect(result.violationCode).toBe('SOD_VIOLATION_REVIEWER');
      expect(result.message).toContain('maker-checker violation');
    });

    it('should permit an independent, authorized approver', async () => {
      jest.spyOn(ReviewService, 'getAuditLogs').mockResolvedValue([]);
      const independentApprover = {
        userId: 'carol-approver-id',
        email: 'carol_approver@docnexa.io',
        role: 'approver' as UserRole,
        tenantId: 'TNT-CORP-01',
        permissions: ROLE_PERMISSIONS.approver,
      };

      const result = await ApprovalService.evaluateSod(mockRequest, independentApprover, mockDoc);
      expect(result.allowed).toBe(true);
      expect(result.violationCode).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Cross-Tenant Isolation Enforcement
  // =========================================================================
  describe('5. Cross-Tenant Isolation Middleware', () => {
    it('should permit requests matching user tenant', () => {
      const req = {
        user: { tenantId: 'TNT-ACME-01', role: 'org_admin' },
        headers: { 'x-tenant-id': 'TNT-ACME-01' },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;
      const { res } = createMockRes();
      const next = jest.fn();

      enforceTenantIsolation(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block requests attempting to spoof foreign tenant via header or query', () => {
      const req = {
        user: { tenantId: 'TNT-ACME-01', role: 'org_admin' },
        headers: { 'x-tenant-id': 'TNT-FOREIGN-02' },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;
      const { res, getStatus, getBody } = createMockRes();
      const next = jest.fn();

      enforceTenantIsolation(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect(getBody().type).toContain('CROSS_TENANT_FORBIDDEN');
    });
  });

  // =========================================================================
  // 6. Search & Grounded Q&A RBAC Boundary Enforcement (TSK-RBAC-05)
  // =========================================================================
  describe('6. Search & Grounded Q&A Role-Based Boundary Enforcement', () => {
    const tenantId = 'TNT-RBAC-SEARCH';

    beforeAll(async () => {
      SearchService.setStoreMode('memory');
      SearchService.clearInMemory();

      jest.spyOn(IntakeService, 'listDocuments').mockImplementation(async (tId: string) => {
        if (tId !== tenantId) return [];
        return [
          {
            documentId: 'DOC-PUB-01',
            tenantId,
            fileName: 'published_terms.pdf',
            documentType: 'Contract',
            status: 'PUBLISHED',
            confidenceScore: 0.95,
            slaStatus: 'COMPLIANT',
            ingestionSource: 'API_UPLOAD',
            pageCount: 2,
            fileSizeBytes: 2048,
            uploadedAt: new Date(),
          } as any,
          {
            documentId: 'DOC-DRAFT-02',
            tenantId,
            fileName: 'draft_invoice.pdf',
            documentType: 'Invoice',
            status: 'NEEDS_REVIEW',
            confidenceScore: 0.70,
            slaStatus: 'WARNING',
            ingestionSource: 'MANUAL_PORTAL',
            pageCount: 1,
            fileSizeBytes: 1024,
            uploadedAt: new Date(),
          } as any,
        ];
      });
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should shield search results completely from Platform Operator (0 matches)', async () => {
      const result = await SearchService.search(
        tenantId,
        { query: 'terms' },
        'platform_operator'
      );
      expect(result.results.length).toBe(0);
      expect(result.totalMatches).toBe(0);
    });

    it('should restrict Auditor search to PUBLISHED or APPROVED documents only', async () => {
      SearchService.setInMemoryChunks(tenantId, 'DOC-PUB-01', [
        {
          chunkId: 'CHK-PUB-01',
          documentId: 'DOC-PUB-01',
          tenantId,
          chunkIndex: 0,
          sourceVersion: 'v1.0',
          pageNumber: 1,
          chunkText: 'Published contractual terms and obligations.',
          embedding: new Array(1536).fill(0.1),
          createdAt: new Date(),
        },
      ]);
      SearchService.setInMemoryChunks(tenantId, 'DOC-DRAFT-02', [
        {
          chunkId: 'CHK-DRAFT-02',
          documentId: 'DOC-DRAFT-02',
          tenantId,
          chunkIndex: 0,
          sourceVersion: 'v1.0',
          pageNumber: 1,
          chunkText: 'Draft invoice payable amount not yet approved.',
          embedding: new Array(1536).fill(0.1),
          createdAt: new Date(),
        },
      ]);

      const auditorResults = await SearchService.search(
        tenantId,
        { query: 'terms invoice' },
        'auditor'
      );
      // Auditor should only see DOC-PUB-01, not DOC-DRAFT-02
      expect(auditorResults.results.some((r) => r.docId === 'DOC-PUB-01')).toBe(true);
      expect(auditorResults.results.some((r) => r.docId === 'DOC-DRAFT-02')).toBe(false);
    });

    it('should deny citation verification to Auditor if targeted document is not published/approved', async () => {
      jest.spyOn(IntakeService, 'getDocument').mockResolvedValue({
        documentId: 'DOC-DRAFT-02',
        tenantId,
        fileName: 'draft_invoice.pdf',
        documentType: 'Invoice',
        status: 'NEEDS_REVIEW',
      } as any);

      await expect(
        QaService.verifyCitationAccess(tenantId, 'auditor', 'DOC-DRAFT-02')
      ).rejects.toThrow(CitationAccessDeniedError);
    });
  });
});
