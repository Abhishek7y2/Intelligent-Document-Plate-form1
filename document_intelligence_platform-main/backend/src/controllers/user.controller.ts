import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { InvitationService } from '../services/invitation.service.js';

/**
 * Handle inviting a user to the tenant organization (Admin only)
 */
export async function inviteUserHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const invitedBy = req.user?.userId;

    if (!tenantId || !invitedBy) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const { email, role } = req.body;
    if (!email || !role) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Email and role are required fields.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const result = await InvitationService.inviteUser({
      tenantId,
      invitedBy,
      email,
      role,
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: `Invitation successfully sent to ${result.email}.`,
      data: {
        invitationId: result.invitationId,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt,
        inviteUrl: result.inviteUrl,
        inviteToken: result.inviteToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List pending invitations for the tenant (Admin only)
 */
export async function listInvitationsHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    const invitations = await InvitationService.listPendingInvitations(tenantId);

    res.status(200).json({
      status: 'SUCCESS',
      tenantId,
      invitations,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke an invitation (Admin only)
 */
export async function revokeInvitationHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const invitationId = req.params['id'];

    if (!tenantId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
        instance: req.originalUrl,
      });
      return;
    }

    if (!invitationId) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'Invitation ID parameter is required.',
        status: 400,
        instance: req.originalUrl,
      });
      return;
    }

    const revoked = await InvitationService.revokeInvitation(invitationId, tenantId);

    res.status(200).json({
      status: 'SUCCESS',
      message: revoked ? `Invitation '${invitationId}' revoked successfully.` : `Invitation '${invitationId}' not found or already processed.`,
      revoked,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Change a user's role (Admin only, tenant-scoped, revokes sessions, audits change)
 * PATCH /api/v1/users/:id/role (Sprint 7 Part D.1)
 */
export async function updateUserRoleHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.userId;
    const targetUserId = req.params['id'];
    const { role } = req.body;

    if (!tenantId || !actorId) {
      res.status(401).json({
        type: 'https://api.docunexa.enterprise/errors/UNAUTHORIZED',
        title: 'Authentication token missing tenant context.',
        status: 401,
      });
      return;
    }

    if (!targetUserId || !role) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/BAD_REQUEST',
        title: 'User ID parameter and new role are required.',
        status: 400,
      });
      return;
    }

    const canonicalRoles = [
      'Admin', 'Reviewer', 'Approver', 'FinanceHead', 'Analyst', 'Auditor',
      'platform_operator', 'org_admin', 'contributor', 'reviewer', 'approver', 'auditor'
    ];

    if (!canonicalRoles.includes(role)) {
      res.status(400).json({
        type: 'https://api.docunexa.enterprise/errors/INVALID_ROLE',
        title: `Invalid role '${role}'. Must be one of: ${canonicalRoles.join(', ')}`,
        status: 400,
      });
      return;
    }

    const { dbPool } = await import('../database/postgres.client.js');
    const { AuditTrailService } = await import('../services/audit-trail.service.js');

    const client = await dbPool.connect();
    try {
      await client.query('BEGIN;');

      // Verify target user belongs to the tenant
      const userRes = await client.query(
        `SELECT user_id, email, full_name, role, tenant_id FROM users WHERE user_id = $1 AND tenant_id = $2`,
        [targetUserId, tenantId]
      );

      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK;');
        res.status(404).json({
          type: 'https://api.docunexa.enterprise/errors/USER_NOT_FOUND',
          title: `User '${targetUserId}' not found within tenant.`,
          status: 404,
        });
        return;
      }

      const prevRole = userRes.rows[0].role;

      // Update role
      await client.query(
        `UPDATE users SET role = $1 WHERE user_id = $2 AND tenant_id = $3`,
        [role, targetUserId, tenantId]
      );

      // Also update tenant_memberships if exists
      try {
        await client.query(
          `UPDATE tenant_memberships SET role = $1 WHERE user_id = $2 AND tenant_id = $3`,
          [role, targetUserId, tenantId]
        );
      } catch {}

      // Revoke existing sessions / tokens for the user
      try {
        await client.query(
          `DELETE FROM refresh_tokens WHERE user_id = $1`,
          [targetUserId]
        );
      } catch {}

      // Audit trail record with SHA-256 seal
      try {
        await AuditTrailService.recordEvent({
          tenantId,
          userId: actorId,
          action: 'USER_ROLE_CHANGED',
          details: {
            targetUserId,
            targetEmail: userRes.rows[0].email,
            previousRole: prevRole,
            newRole: role,
            sessionsRevoked: true,
          },
        });
      } catch {}

      await client.query('COMMIT;');

      res.status(200).json({
        status: 'SUCCESS',
        message: `User '${targetUserId}' role updated to '${role}'. Existing sessions revoked.`,
        data: {
          userId: targetUserId,
          tenantId,
          role,
          previousRole: prevRole,
        },
      });
    } catch (dbErr: any) {
      await client.query('ROLLBACK;');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

