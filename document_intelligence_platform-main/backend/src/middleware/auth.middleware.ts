import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.config.js';
import { UserRole, Permission, AuthTokenPayload, ROLE_PERMISSIONS } from '../models/auth.models.js';
import { AuthService } from '../services/auth.service.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  permissions: Permission[];
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Missing or invalid Authorization header.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['HS256'],
    };
    if (config.jwt.issuer) {
      verifyOptions.issuer = config.jwt.issuer;
    }
    if (config.jwt.audience) {
      verifyOptions.audience = config.jwt.audience;
    }

    const decoded = jwt.verify(token, config.jwt.secret, verifyOptions) as AuthTokenPayload;

    // Ensure essential subject and tenant boundaries are present in JWT
    if (!decoded.userId || !decoded.tenantId || !decoded.role) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/INVALID_TOKEN_CLAIMS',
        title: 'Authentication token is missing required subject claims.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    // Enforce real-time session revocation, expiry, and user active verification
    const validation = await AuthService.validateUserAndSession(decoded.userId, decoded.tenantId, decoded.sessionId);
    if (!validation.valid) {
      if (validation.reason === 'ACCOUNT_DEACTIVATED') {
        res.status(403).json({
          type: 'https://api.docunexa.enterprise/errors/ACCOUNT_DEACTIVATED',
          title: 'Account is deactivated. Access revoked.',
          status: 403,
          instance: req.originalUrl,
        });
        return;
      }
      if (validation.reason === 'SESSION_REVOKED') {
        res.status(401).json({
          type: 'https://api.docunexa.enterprise/errors/SESSION_REVOKED',
          title: 'Authentication session has been revoked.',
          status: 401,
          instance: req.originalUrl,
        });
        return;
      }
      if (validation.reason === 'SESSION_EXPIRED') {
        res.status(401).json({
          type: 'https://api.docunexa.enterprise/errors/TOKEN_EXPIRED',
          title: 'Authentication session has expired.',
          status: 401,
          instance: req.originalUrl,
        });
        return;
      }
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'User not found or credentials invalid.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    // If permissions array missing in payload, fallback to defined role matrix
    const rolePermissions = decoded.permissions?.length 
      ? decoded.permissions 
      : (ROLE_PERMISSIONS[decoded.role] || ROLE_PERMISSIONS[normalizeRole(decoded.role)] || []);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      permissions: rolePermissions,
      sessionId: decoded.sessionId,
    };
    next();
  } catch (err: any) {
    const isExpired = err.name === 'TokenExpiredError';
    res.status(401).json({
      type: `https://api.docunexa.enterprise/errors/${isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'}`,
      title: isExpired ? 'Authentication token has expired.' : 'Authentication token is invalid.',
      status: 401,
      instance: req.originalUrl,
    });
  }
}

export function normalizeRole(role: string | undefined | null): string {
  if (!role) return 'org_admin';
  const r = role.toLowerCase().replace(/[- ]/g, '_');
  if (r === 'admin' || r === 'organization_admin') return 'org_admin';
  if (r === 'operator') return 'platform_operator';
  return r;
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      res.status(403).json({
        type: 'https://api.docunexa.enterprise/errors/FORBIDDEN',
        title: `Permission '${permission}' is required for this action.`,
        status: 403,
        instance: req.originalUrl,
      });
      return;
    }
    next();
  };
}

export function requireRole(...allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map((r) => normalizeRole(r));
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = normalizeRole(req.user?.role);
    if (!req.user || (!normalizedAllowed.includes(userRole) && !allowedRoles.includes(req.user.role as any))) {
      res.status(403).json({
        type: 'https://api.docunexa.enterprise/errors/FORBIDDEN',
        title: `User role '${req.user?.role || 'NONE'}' is not authorized for this operation.`,
        status: 403,
        instance: req.originalUrl,
      });
      return;
    }
    next();
  };
}

/**
 * BRD Section 3 Boundary: Platform operator has no routine access to customer document content.
 */
export function shieldOperatorContent(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const userRole = normalizeRole(req.user?.role);
  if (userRole === 'platform_operator') {
    res.status(403).json({
      type: 'https://api.docunexa.enterprise/errors/OPERATOR_CONTENT_ACCESS_DENIED',
      title: 'Platform operators have no routine access to customer document content (BRD Section 3).',
      status: 403,
      instance: req.originalUrl,
    });
    return;
  }
  next();
}

/**
 * Enforces strict multi-tenant data fencing.
 * Rejects requests if client tries to request data for a tenant other than their authenticated tenant!
 */
export function enforceTenantIsolation(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
      title: 'Authentication required.',
      status: 401,
      instance: req.originalUrl,
    });
    return;
  }

  // Check header or query parameter tenant overrides
  const clientSuppliedTenant = (req.headers['x-tenant-id'] as string) || (req.query['tenantId'] as string) || (req.body && req.body.tenantId);

  if (clientSuppliedTenant && clientSuppliedTenant !== req.user.tenantId) {
    res.status(403).json({
      type: 'https://api.docunexa.enterprise/errors/CROSS_TENANT_FORBIDDEN',
      title: 'Cross-tenant access violation: Caller cannot access foreign tenant context.',
      status: 403,
      instance: req.originalUrl,
    });
    return;
  }

  next();
}
