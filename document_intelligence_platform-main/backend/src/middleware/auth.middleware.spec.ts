import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.config.js';
import {
  authenticateJwt,
  requirePermission,
  requireRole,
  enforceTenantIsolation,
  AuthenticatedRequest,
} from './auth.middleware.js';

describe('Sprint 2: Auth & Multi-Tenant RBAC Middleware', () => {
  describe('authenticateJwt', () => {
    it('should return 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const mockReq = { headers: {}, originalUrl: '/api/v1/documents' } as unknown as AuthenticatedRequest;
      let status = 0;
      let jsonBody: any = null;
      const mockRes = {
        status: (s: number) => {
          status = s;
          return { json: (b: any) => (jsonBody = b) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(status).toBe(401);
      expect(jsonBody.type).toContain('UNAUTHORIZED');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 INVALID_TOKEN when token is malformed', async () => {
      const mockReq = {
        headers: { authorization: 'Bearer invalid_signature_token' },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;
      let status = 0;
      let jsonBody: any = null;
      const mockRes = {
        status: (s: number) => {
          status = s;
          return { json: (b: any) => (jsonBody = b) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(status).toBe(401);
      expect(jsonBody.type).toContain('INVALID_TOKEN');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should populate req.user and call next() for a valid token', async () => {
      const payload = {
        userId: 'USR-88210',
        email: 'analyst@docunexa.io',
        role: 'Reviewer',
        tenantId: 'TNT-CORP-01',
        permissions: ['DOC_VIEW', 'DOC_VERIFY'],
      };
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });

      const mockReq = {
        headers: { authorization: `Bearer ${token}` },
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;
      const mockRes = {} as unknown as Response;
      const mockNext = jest.fn();

      await authenticateJwt(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe('USR-88210');
      expect(mockReq.user?.tenantId).toBe('TNT-CORP-01');
    });
  });

  describe('requirePermission & requireRole RBAC', () => {
    it('should allow request when user possesses required permission', () => {
      const mockReq = {
        user: {
          userId: 'USR-88210',
          role: 'Reviewer',
          tenantId: 'TNT-CORP-01',
          permissions: ['DOC_VIEW', 'DOC_VERIFY'],
        },
      } as unknown as AuthenticatedRequest;
      const mockRes = {} as unknown as Response;
      const mockNext = jest.fn();

      const middleware = requirePermission('DOC_VIEW');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 FORBIDDEN when user lacks required permission', () => {
      const mockReq = {
        user: {
          userId: 'USR-88210',
          role: 'Reviewer',
          tenantId: 'TNT-CORP-01',
          permissions: ['DOC_VIEW'], // lacks DOC_DELETE
        },
        originalUrl: '/api/v1/documents/delete',
      } as unknown as AuthenticatedRequest;
      let status = 0;
      let jsonBody: any = null;
      const mockRes = {
        status: (s: number) => {
          status = s;
          return { json: (b: any) => (jsonBody = b) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      const middleware = requirePermission('DOC_DELETE');
      middleware(mockReq, mockRes, mockNext);

      expect(status).toBe(403);
      expect(jsonBody.type).toContain('FORBIDDEN');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 FORBIDDEN when role is not in allowed roles', () => {
      const mockReq = {
        user: {
          userId: 'USR-88210',
          role: 'Reviewer',
          tenantId: 'TNT-CORP-01',
          permissions: ['DOC_VIEW'],
        },
        originalUrl: '/api/v1/admin/settings',
      } as unknown as AuthenticatedRequest;
      let status = 0;
      let jsonBody: any = null;
      const mockRes = {
        status: (s: number) => {
          status = s;
          return { json: (b: any) => (jsonBody = b) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      const middleware = requireRole('Admin');
      middleware(mockReq, mockRes, mockNext);

      expect(status).toBe(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('enforceTenantIsolation', () => {
    it('should allow request when no conflicting tenant header is provided', () => {
      const mockReq = {
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01' },
        headers: {},
        query: {},
      } as unknown as AuthenticatedRequest;
      const mockRes = {} as unknown as Response;
      const mockNext = jest.fn();

      enforceTenantIsolation(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 CROSS_TENANT_FORBIDDEN when client supplies a foreign tenant ID', () => {
      const mockReq = {
        user: { userId: 'USR-88210', tenantId: 'TNT-CORP-01' },
        headers: { 'x-tenant-id': 'TNT-FOREIGN-99' }, // Tampered foreign tenant ID
        query: {},
        originalUrl: '/api/v1/documents',
      } as unknown as AuthenticatedRequest;
      let status = 0;
      let jsonBody: any = null;
      const mockRes = {
        status: (s: number) => {
          status = s;
          return { json: (b: any) => (jsonBody = b) };
        },
      } as unknown as Response;
      const mockNext = jest.fn();

      enforceTenantIsolation(mockReq, mockRes, mockNext);

      expect(status).toBe(403);
      expect(jsonBody.type).toContain('CROSS_TENANT_FORBIDDEN');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
