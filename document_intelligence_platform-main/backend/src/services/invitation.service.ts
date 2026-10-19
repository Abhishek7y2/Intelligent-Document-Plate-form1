import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { hashPassword, hashToken, generateSecureToken, validatePasswordPolicy } from '../utils/crypto.js';
import { EmailService } from './email.service.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/env.config.js';
import { AuthService } from './auth.service.js';
import { UserInvitationRecord, UserRecord, UserRole } from '../models/auth.models.js';

export const CANONICAL_INVITE_ROLES = [
  'Admin',
  'Reviewer',
  'Analyst',
  'Auditor',
  'contributor',
  'approver',
  'platform_operator',
] as const;

export class InvitationService {
  private static inMemoryInvitations: Map<string, UserInvitationRecord> = new Map();

  static clearInMemory(): void {
    this.inMemoryInvitations.clear();
  }

  static clearMemoryState(): void {
    this.inMemoryInvitations.clear();
  }

  /**
   * Invites a new user to a tenant (Admin only)
   */
  static async inviteUser(params: {
    tenantId: string;
    invitedBy: string;
    email: string;
    role: string;
    inviterRole?: string;
  }): Promise<{
    id: string;
    invitationId: string;
    email: string;
    role: string;
    expiresAt: Date;
    inviteToken: string;
    token: string;
    inviteUrl: string;
  }> {
    const { tenantId, invitedBy, email, role, inviterRole } = params;

    if (inviterRole && inviterRole !== 'Admin') {
      const err: any = new Error('Only tenant administrators can invite new users.');
      err.statusCode = 403;
      throw err;
    }

    if (!email || !email.includes('@')) {
      const err: any = new Error('A valid email address is required.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Validate role against the canonical role list
    if (!CANONICAL_INVITE_ROLES.includes(role as any)) {
      const err: any = new Error(
        `Invalid role '${role}'. Role must be one of: ${CANONICAL_INVITE_ROLES.join(', ')}.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Reject if an active user with that email already exists in the tenant
    const existingUser = await AuthService.findUserByEmailAndTenant(normalizedEmail, tenantId);
    if (existingUser && existingUser.is_active) {
      const err: any = new Error(`An active user with email '${normalizedEmail}' already exists in this tenant.`);
      err.statusCode = 400;
      err.code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    // 3. Generate 32-byte secure token, store only its SHA-256 hash, 48h expiry
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const invitationId = `INV-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const record: UserInvitationRecord = {
      id: invitationId,
      tenant_id: tenantId,
      email: normalizedEmail,
      role,
      token_hash: tokenHash,
      invited_by: invitedBy,
      expires_at: expiresAt,
      accepted_at: null,
      created_at: new Date(),
    };

    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `INSERT INTO user_invitations (
            id, tenant_id, email, role, token_hash, invited_by, expires_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.id,
            record.tenant_id,
            record.email,
            record.role,
            record.token_hash,
            record.invited_by,
            record.expires_at,
            record.created_at,
          ]
        );
      } catch (err: any) {
        Logger.error({ message: `Database error creating user invitation: ${err.message}`, context: 'InvitationService' });
        throw err;
      }
    }

    this.inMemoryInvitations.set(tokenHash, record);

    const baseUrl = config.corsAllowedOrigins[0] || 'http://localhost:4200';
    const inviteUrl = `${baseUrl}/auth/accept-invite?token=${rawToken}`;

    // 4. Send invitation link via existing EmailService
    try {
      await EmailService.sendInvitationEmail(normalizedEmail, inviteUrl, tenantId, role);
    } catch (mailErr: any) {
      Logger.warn({
        message: `Invitation email could not be sent: ${mailErr.message}`,
        context: 'InvitationService',
      });
    }

    // 5. Audit via audit_trail_events (SHA-256 signed)
    try {
      const hmacSecret = config.audit.hmacSecret;
      const auditPayload = JSON.stringify({
        action: 'USER_INVITATION_CREATED',
        invitationId,
        tenantId,
        email: normalizedEmail,
        role,
        invitedBy,
      });
      const signature = crypto.createHmac('sha256', hmacSecret).update(auditPayload).digest('hex');

      await dbPool.query(
        `INSERT INTO audit_trail_events (
          tenant_id, user_id, action, details, ip_address, sha256_signature
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          invitedBy,
          'USER_INVITATION_CREATED',
          JSON.stringify({ invitationId, email: normalizedEmail, role }),
          '127.0.0.1',
          signature,
        ]
      );
    } catch {}

    Logger.info({
      message: `User invitation created for ${normalizedEmail} with role ${role}`,
      context: 'InvitationService',
      data: { invitationId, tenantId, email: normalizedEmail, role },
    });

    return {
      id: invitationId,
      invitationId,
      email: normalizedEmail,
      role,
      expiresAt,
      inviteToken: rawToken,
      token: rawToken,
      inviteUrl,
    };
  }

  /**
   * Lists pending invitations for a tenant (Admin only)
   */
  static async listPendingInvitations(tenantId: string): Promise<UserInvitationRecord[]> {
    if (AuthService.isDatabaseMode()) {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id, email, role, token_hash, invited_by, expires_at, accepted_at, created_at
           FROM user_invitations
           WHERE tenant_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC`,
          [tenantId]
        );
        return res.rows;
      } catch (err: any) {
        Logger.warn({ message: `Database error querying invitations: ${err.message}`, context: 'InvitationService' });
      }
    }

    const now = Date.now();
    return Array.from(this.inMemoryInvitations.values()).filter(
      (inv) => inv.tenant_id === tenantId && !inv.accepted_at && inv.expires_at.getTime() > now
    );
  }

  /**
   * Revokes an invitation (Admin only)
   */
  static async revokeInvitation(invitationId: string, tenantId: string): Promise<boolean> {
    if (AuthService.isDatabaseMode()) {
      try {
        const res = await dbPool.query(
          `DELETE FROM user_invitations
           WHERE id = $1 AND tenant_id = $2 AND accepted_at IS NULL`,
          [invitationId, tenantId]
        );
        if (res.rowCount && res.rowCount > 0) return true;
      } catch (err: any) {
        Logger.warn({ message: `Database error revoking invitation: ${err.message}`, context: 'InvitationService' });
      }
    }

    for (const [hash, inv] of this.inMemoryInvitations.entries()) {
      if (inv.id === invitationId && inv.tenant_id === tenantId) {
        this.inMemoryInvitations.delete(hash);
        return true;
      }
    }

    return false;
  }

  /**
   * Accepts invitation and creates user account (Public, rate-limited)
   */
  static async acceptInvitation(params: {
    token: string;
    password: string;
    fullName?: string;
  }): Promise<UserRecord> {
    const { token, password, fullName } = params;

    if (!token || typeof token !== 'string') {
      const err: any = new Error('Invalid, expired, or revoked invitation token.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Password policy validation
    const pwdCheck = validatePasswordPolicy(password);
    if (!pwdCheck.isValid) {
      const err: any = new Error(pwdCheck.message || 'Password does not meet complexity requirements.');
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = hashToken(token.trim());
    let invitation: UserInvitationRecord | null = null;

    if (AuthService.isDatabaseMode()) {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id, email, role, token_hash, invited_by, expires_at, accepted_at, created_at
           FROM user_invitations
           WHERE token_hash = $1`,
          [tokenHash]
        );
        if (res.rows.length > 0) {
          invitation = res.rows[0];
        }
      } catch (err: any) {
        Logger.warn({ message: `Database error fetching invitation: ${err.message}`, context: 'InvitationService' });
      }
    }

    if (!invitation) {
      invitation = this.inMemoryInvitations.get(tokenHash) || null;
    }

    // 2. Reject if expired, already used, or not found with generic 400
    if (!invitation || invitation.accepted_at || new Date(invitation.expires_at).getTime() <= Date.now()) {
      const err: any = new Error('Invalid, expired, or revoked invitation token.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = `USR-${crypto.randomBytes(6).toString('hex')}`;
    const name = (fullName || invitation.email.split('@')[0]).trim();

    const newUser: UserRecord = {
      user_id: userId,
      tenant_id: invitation.tenant_id,
      email: invitation.email,
      full_name: name,
      role: invitation.role as UserRole,
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date(),
      mfa_enabled: false,
    };

    if (AuthService.isDatabaseMode()) {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Create user
        await client.query(
          `INSERT INTO users (
            user_id, tenant_id, email, full_name, role, password_hash, is_active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newUser.user_id,
            newUser.tenant_id,
            newUser.email,
            newUser.full_name,
            newUser.role,
            newUser.password_hash,
            true,
            newUser.created_at,
          ]
        );

        // Create tenant membership
        await client.query(
          `INSERT INTO tenant_memberships (
            user_id, tenant_id, role, is_active, created_at
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, tenant_id) DO NOTHING`,
          [newUser.user_id, newUser.tenant_id, newUser.role, true]
        );

        // Mark invitation as accepted
        await client.query(
          `UPDATE user_invitations
           SET accepted_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [invitation.id]
        );

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({ message: `Database transaction error accepting invitation: ${err.message}`, context: 'InvitationService' });
        throw err;
      } finally {
        client.release();
      }
    }

    // Update in-memory invitation
    invitation.accepted_at = new Date();
    this.inMemoryInvitations.set(tokenHash, invitation);

    AuthService.updateInMemoryUser(newUser);

    Logger.info({
      message: `User ${newUser.user_id} (${newUser.email}) onboarded successfully via invitation in tenant ${newUser.tenant_id}`,
      context: 'InvitationService',
      data: { userId: newUser.user_id, tenantId: newUser.tenant_id, role: newUser.role },
    });

    return newUser;
  }
}
