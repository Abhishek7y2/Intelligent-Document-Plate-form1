import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AuthService, seedTestUsers } from './auth.service.js';
import { IntakeService, DuplicateDocumentError } from './intake.service.js';
import { config, requireSecret } from '../config/env.config.js';
import { ROLE_PERMISSIONS, UserRecord, AuthSession } from '../models/auth.models.js';

describe('Sprint 1: Security Containment Verification Suite', () => {
  const tenantA = 'TNT-CORP-01';
  const tenantB = 'TNT-CORP-02';

  beforeEach(async () => {
    IntakeService.clearInMemory();
    await seedTestUsers();
  });

  describe('1. Mock JWT Bypass Elimination (SEC-001)', () => {
    it('should reject mock-jwt-token- prefix with 401 INVALID_TOKEN', async () => {
      const mockReq = {
        headers: { authorization: 'Bearer mock-jwt-token-USR-ADMIN-01' },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              body = data;
            },
          };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(body.type).toContain('INVALID_TOKEN');
    });
  });

  describe('2. Hardcoded Secrets Elimination & Validation (SEC-002)', () => {
    it('should throw fatal error when required secret is missing', () => {
      expect(() => requireSecret('MISSING_TEST_SECRET_VARIABLE', 32)).toThrow(
        /Required environment secret 'MISSING_TEST_SECRET_VARIABLE' is missing/
      );
    });

    it('should throw fatal error when secret is shorter than minimum length', () => {
      process.env['SHORT_TEST_SECRET'] = 'short_secret_123';
      expect(() => requireSecret('SHORT_TEST_SECRET', 32)).toThrow(
        /must be at least 32 characters long/
      );
      delete process.env['SHORT_TEST_SECRET'];
    });

    it('should accept valid high-entropy secret >= 32 characters', () => {
      process.env['VALID_TEST_SECRET'] = '0123456789abcdef0123456789abcdef0123456789abcdef';
      const secret = requireSecret('VALID_TEST_SECRET', 32);
      expect(secret).toBe('0123456789abcdef0123456789abcdef0123456789abcdef');
      delete process.env['VALID_TEST_SECRET'];
    });
  });

  describe('3. JWT Verification Algorithm Pinning & Claim Validation', () => {
    it('should reject forged token signed with an untrusted secret', async () => {
      const forgedToken = jwt.sign(
        { userId: 'USR-88210', email: 'analyst@docunexa.io', role: 'Admin', tenantId: tenantA },
        'AttackerWrongSecret123456789012345678901234567890',
        { algorithm: 'HS256' }
      );

      const mockReq = {
        headers: { authorization: `Bearer ${forgedToken}` },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => (body = d) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(body.type).toContain('INVALID_TOKEN');
    });

    it('should reject tokens missing essential claims (userId, tenantId, or role)', async () => {
      const incompleteToken = jwt.sign(
        { email: 'analyst@docunexa.io' }, // Missing userId, tenantId, role
        config.jwt.secret,
        { algorithm: 'HS256' }
      );

      const mockReq = {
        headers: { authorization: `Bearer ${incompleteToken}` },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => (body = d) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(body.type).toContain('INVALID_TOKEN_CLAIMS');
    });
  });

  describe('4. Deactivated User Access Revocation (SEC-003 & UAT-08)', () => {
    it('should deny access with 403 ACCOUNT_DEACTIVATED when user is deactivated', async () => {
      // 1. Setup deactivated user
      const deactivatedUser: UserRecord = {
        user_id: 'USR-DEACTIVATED-01',
        tenant_id: tenantA,
        email: 'deactivated@docunexa.io',
        full_name: 'Deactivated User',
        role: 'Reviewer',
        password_hash: 'hash',
        is_active: false,
        created_at: new Date(),
      };
      AuthService.setInMemoryUser(deactivatedUser);

      // 2. Issue otherwise valid JWT for this user
      const validToken = jwt.sign(
        {
          userId: deactivatedUser.user_id,
          email: deactivatedUser.email,
          role: deactivatedUser.role,
          tenantId: tenantA,
          permissions: ROLE_PERMISSIONS.reviewer,
        },
        config.jwt.secret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const mockReq = {
        headers: { authorization: `Bearer ${validToken}` },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => (body = d) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(body.type).toContain('ACCOUNT_DEACTIVATED');
    });

    it('should deny access with 401 SESSION_REVOKED when session is marked revoked', async () => {
      const sessionId = 'SESSION-REVOKED-99';
      const activeUser: UserRecord = {
        user_id: 'USR-ACTIVE-01',
        tenant_id: tenantA,
        email: 'active@docunexa.io',
        full_name: 'Active User',
        role: 'Reviewer',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
      };
      AuthService.setInMemoryUser(activeUser);

      const revokedSession: AuthSession = {
        session_id: sessionId,
        user_id: activeUser.user_id,
        tenant_id: tenantA,
        refresh_token_hash: 'hash99',
        family_id: 'fam99',
        is_revoked: true,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        last_used_at: new Date(),
      };
      AuthService.setInMemorySession(revokedSession);

      const token = jwt.sign(
        {
          userId: activeUser.user_id,
          email: activeUser.email,
          role: activeUser.role,
          tenantId: tenantA,
          permissions: ROLE_PERMISSIONS.reviewer,
          sessionId,
        },
        config.jwt.secret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const mockReq = {
        headers: { authorization: `Bearer ${token}` },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;

      let statusCode = 0;
      let body: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return { json: (d: any) => (body = d) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(body.type).toContain('SESSION_REVOKED');
    });

    it('should revoke all user sessions when deactivateUser is executed', async () => {
      const userId = 'USR-TARGET-DEACT';
      const user: UserRecord = {
        user_id: userId,
        tenant_id: tenantA,
        email: 'target@docunexa.io',
        full_name: 'Target User',
        role: 'Reviewer',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
      };
      AuthService.setInMemoryUser(user);

      const sessionId = 'SESS-TO-BE-REVOKED';
      const session: AuthSession = {
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantA,
        refresh_token_hash: 'hash_target',
        family_id: 'fam_target',
        is_revoked: false,
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        last_used_at: new Date(),
      };
      AuthService.setInMemorySession(session);

      // Verify active before deactivation
      const before = await AuthService.validateUserAndSession(userId, tenantA, sessionId);
      expect(before.valid).toBe(true);

      // Perform deactivation
      await AuthService.deactivateUser(userId, tenantA);

      // Verify deactivated & session revoked
      const after = await AuthService.validateUserAndSession(userId, tenantA, sessionId);
      expect(after.valid).toBe(false);
      expect(after.reason).toBe('ACCOUNT_DEACTIVATED');
    });
  });

  describe('5. Tenant-Scoped Document Retrieval & Hash Deduplication (SEC-005 & SEC-006)', () => {
    const dummyPdf = Buffer.from('%PDF-1.4\nTest Document Content\n%%EOF');

    it('should strictly return null when Tenant B attempts to fetch Tenant A document', async () => {
      const docA = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyPdf,
        originalFilename: 'tenant_a_doc.pdf',
        declaredMimeType: 'application/pdf',
      });

      // Authorized access succeeds
      const fetchA = await IntakeService.getDocument(docA.documentId, tenantA);
      expect(fetchA).not.toBeNull();
      expect(fetchA?.documentId).toBe(docA.documentId);

      // Unauthorized cross-tenant access returns null
      const fetchB = await IntakeService.getDocument(docA.documentId, tenantB);
      expect(fetchB).toBeNull();
    });

    it('should allow two different tenants to upload identical files without conflict', async () => {
      const docA = await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyPdf,
        originalFilename: 'common_invoice.pdf',
        declaredMimeType: 'application/pdf',
      });

      const docB = await IntakeService.ingestDocument({
        tenantId: tenantB,
        userId: 'USR-AUDIT-01',
        buffer: dummyPdf,
        originalFilename: 'common_invoice.pdf',
        declaredMimeType: 'application/pdf',
      });

      expect(docA.sha256Hash).toBe(docB.sha256Hash);
      expect(docA.documentId).not.toBe(docB.documentId);

      const recordA = await IntakeService.getDocument(docA.documentId, tenantA);
      const recordB = await IntakeService.getDocument(docB.documentId, tenantB);
      expect(recordA?.tenantId).toBe(tenantA);
      expect(recordB?.tenantId).toBe(tenantB);
    });

    it('should reject duplicate upload within the SAME tenant', async () => {
      await IntakeService.ingestDocument({
        tenantId: tenantA,
        userId: 'USR-88210',
        buffer: dummyPdf,
        originalFilename: 'invoice_once.pdf',
        declaredMimeType: 'application/pdf',
      });

      await expect(
        IntakeService.ingestDocument({
          tenantId: tenantA,
          userId: 'USR-88210',
          buffer: dummyPdf,
          originalFilename: 'invoice_twice.pdf',
          declaredMimeType: 'application/pdf',
        })
      ).rejects.toThrow(DuplicateDocumentError);
    });
  });

  describe('6. Canonical BRD Roles Authorization Verification', () => {
    it('should define and support all canonical BRD roles in permissions matrix', () => {
      const canonicalRoles = [
        'org_admin',
        'contributor',
        'reviewer',
        'approver',
        'auditor',
        'platform_operator',
      ];

      for (const role of canonicalRoles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }

      // Contributor can upload, cannot approve
      expect(ROLE_PERMISSIONS.contributor).toContain('DOC_UPLOAD');
      expect(ROLE_PERMISSIONS.contributor).not.toContain('DOC_APPROVE');

      // Approver can approve, cannot manage users
      expect(ROLE_PERMISSIONS.approver).toContain('DOC_APPROVE');
      expect(ROLE_PERMISSIONS.approver).not.toContain('USER_MANAGE');

      // Platform operator has no customer document view
      expect(ROLE_PERMISSIONS.platform_operator).not.toContain('DOC_VIEW');
      expect(ROLE_PERMISSIONS.platform_operator).toContain('ADMIN_ACCESS');
    });
  });
});
