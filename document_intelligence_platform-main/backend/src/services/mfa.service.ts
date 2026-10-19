import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config/env.config.js';
import { encryptAesGcm, decryptAesGcm } from '../utils/crypto.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';
import { AuthService } from './auth.service.js';
import { UserRecord } from '../models/auth.models.js';

export interface MfaEnrollmentResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface MfaVerifyEnrollmentResponse {
  success: boolean;
  message: string;
  recoveryCodes: string[];
}

export class MfaService {
  // Temporary enrollment store for in-memory tests or pending enrollments
  private static pendingEnrollments: Map<string, { secret: string; expiresAt: number }> = new Map();

  /**
   * Generates a new TOTP secret and QR code for user enrollment.
   * Does NOT activate MFA until verified with a valid code.
   */
  static async enroll(user: UserRecord, currentCode?: string): Promise<MfaEnrollmentResponse> {
    if (user.mfa_enabled) {
      if (!currentCode) {
        const err: any = new Error('Current MFA code or recovery code is required to re-enroll MFA.');
        err.statusCode = 400;
        throw err;
      }
      const verification = await this.verifyTotpOrRecoveryCode(user, currentCode);
      if (!verification.valid) {
        const err: any = new Error('Invalid current MFA verification or recovery code.');
        err.statusCode = 400;
        throw err;
      }
    }

    const secret = generateSecret();
    const serviceName = 'DocuNexa';
    const otpauthUrl = generateURI({ issuer: serviceName, label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Encrypt secret with AES-256-GCM using MFA_ENC_KEY
    const encryptedSecret = encryptAesGcm(secret, config.mfa.encKey);

    // Save encrypted secret on user (with mfa_enabled = false until verified)
    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `UPDATE users
           SET mfa_secret_enc = $1, mfa_enabled = false
           WHERE user_id = $2 AND tenant_id = $3`,
          [encryptedSecret, user.user_id, user.tenant_id]
        );
      } catch (err: any) {
        Logger.warn({
          message: `Database update failed during MFA enroll: ${err.message}`,
          context: 'MfaService',
        });
      }
    }

    user.mfa_secret_enc = encryptedSecret;
    user.mfa_enabled = false;
    AuthService.updateInMemoryUser(user);

    this.pendingEnrollments.set(user.user_id, {
      secret,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
    });

    Logger.info({
      message: `MFA enrollment initiated for user ${user.user_id}`,
      context: 'MfaService',
      data: { userId: user.user_id, tenantId: user.tenant_id },
    });

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verifies the enrollment TOTP code, enables MFA on the account, and issues 8 one-time recovery codes.
   */
  static async verifyEnrollment(user: UserRecord, code: string): Promise<MfaVerifyEnrollmentResponse> {
    if (!code || typeof code !== 'string') {
      const err: any = new Error('TOTP code is required.');
      err.statusCode = 400;
      throw err;
    }

    // Retrieve secret
    let plainSecret: string | null = null;
    const pending = this.pendingEnrollments.get(user.user_id);
    if (pending && pending.expiresAt > Date.now()) {
      plainSecret = pending.secret;
    } else if (user.mfa_secret_enc) {
      try {
        plainSecret = decryptAesGcm(user.mfa_secret_enc, config.mfa.encKey);
      } catch (err: any) {
        Logger.error({ message: `Failed to decrypt MFA secret: ${err.message}`, context: 'MfaService' });
      }
    }

    if (!plainSecret) {
      const err: any = new Error('No pending MFA enrollment found. Please initiate enrollment first.');
      err.statusCode = 400;
      throw err;
    }

    // Verify token
    const verifyRes = verifySync({ token: code.trim(), secret: plainSecret });
    if (!verifyRes || !verifyRes.valid) {
      const err: any = new Error('Invalid TOTP verification code.');
      err.statusCode = 400;
      throw err;
    }

    // Generate 8 cryptographically random recovery codes
    const plainRecoveryCodes: string[] = [];
    const hashedRecoveryCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
      plainRecoveryCodes.push(formatted);
      const hash = crypto.createHash('sha256').update(formatted).digest('hex');
      hashedRecoveryCodes.push(hash);
    }

    // Encrypt secret for permanent storage if not already encrypted
    const encryptedSecret = encryptAesGcm(plainSecret, config.mfa.encKey);

    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `UPDATE users
           SET mfa_enabled = true, mfa_secret_enc = $1, mfa_recovery_hashes = $2
           WHERE user_id = $3 AND tenant_id = $4`,
          [encryptedSecret, hashedRecoveryCodes, user.user_id, user.tenant_id]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database error enabling MFA: ${err.message}`,
          context: 'MfaService',
        });
      }
    }

    user.mfa_enabled = true;
    user.mfa_secret_enc = encryptedSecret;
    user.mfa_recovery_hashes = hashedRecoveryCodes;
    AuthService.updateInMemoryUser(user);

    this.pendingEnrollments.delete(user.user_id);

    Logger.info({
      message: `MFA successfully enabled for user ${user.user_id}`,
      context: 'MfaService',
      data: { userId: user.user_id, tenantId: user.tenant_id },
    });

    return {
      success: true,
      message: 'MFA successfully enabled. Store these one-time recovery codes securely.',
      recoveryCodes: plainRecoveryCodes,
    };
  }

  /**
   * Disables MFA for the user. Requires valid current TOTP code or recovery code.
   * Revokes all active sessions upon disablement.
   */
  static async disableMfa(user: UserRecord, code: string): Promise<{ success: boolean; message: string }> {
    if (!user.mfa_enabled) {
      const err: any = new Error('MFA is not enabled on this account.');
      err.statusCode = 400;
      throw err;
    }

    const verification = await this.verifyTotpOrRecoveryCode(user, code);
    if (!verification.valid) {
      const err: any = new Error('Invalid TOTP verification code or recovery code.');
      err.statusCode = 400;
      throw err;
    }

    // Disable MFA in database and in-memory
    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `UPDATE users
           SET mfa_enabled = false, mfa_secret_enc = NULL, mfa_recovery_hashes = '{}'
           WHERE user_id = $1 AND tenant_id = $2`,
          [user.user_id, user.tenant_id]
        );
      } catch (err: any) {
        Logger.error({ message: `Database error disabling MFA: ${err.message}`, context: 'MfaService' });
      }
    }

    user.mfa_enabled = false;
    user.mfa_secret_enc = null;
    user.mfa_recovery_hashes = [];
    AuthService.updateInMemoryUser(user);

    // Revoke all auth_sessions for this user
    await AuthService.revokeUserSessions(user.user_id);

    Logger.info({
      message: `MFA disabled and all sessions revoked for user ${user.user_id}`,
      context: 'MfaService',
      data: { userId: user.user_id, tenantId: user.tenant_id },
    });

    return {
      success: true,
      message: 'MFA has been disabled and all active sessions have been revoked.',
    };
  }

  /**
   * Verifies either a valid 6-digit TOTP code OR an unused single-use recovery code.
   * If a recovery code is used, it is atomically invalidated.
   */
  static async verifyTotpOrRecoveryCode(
    user: UserRecord,
    code: string
  ): Promise<{ valid: boolean; usedRecoveryCode?: boolean; reason?: string }> {
    if (!code || typeof code !== 'string') {
      return { valid: false, reason: 'MFA code is required.' };
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Try TOTP code verification if user has an encrypted secret
    if (user.mfa_secret_enc) {
      try {
        const plainSecret = decryptAesGcm(user.mfa_secret_enc, config.mfa.encKey);
        const verifyRes = verifySync({ token: cleanCode, secret: plainSecret });
        if (verifyRes && verifyRes.valid) {
          return { valid: true, usedRecoveryCode: false };
        }
      } catch (err: any) {
        Logger.warn({ message: `TOTP decrypt/verify error: ${err.message}`, context: 'MfaService' });
      }
    }

    // 2. Try Recovery code verification
    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    const hashes = user.mfa_recovery_hashes || [];
    const hashIndex = hashes.indexOf(codeHash);

    if (hashIndex !== -1) {
      // Invalidate the used recovery code
      const remainingHashes = hashes.filter((_, idx) => idx !== hashIndex);

      if (AuthService.isDatabaseMode()) {
        try {
          await dbPool.query(
            `UPDATE users
             SET mfa_recovery_hashes = $1
             WHERE user_id = $2 AND tenant_id = $3`,
            [remainingHashes, user.user_id, user.tenant_id]
          );
        } catch {}
      }

      user.mfa_recovery_hashes = remainingHashes;
      AuthService.updateInMemoryUser(user);

      Logger.warn({
        message: `Recovery code used for authentication by user ${user.user_id}. ${remainingHashes.length} recovery codes remain.`,
        context: 'MfaService',
        data: { userId: user.user_id, tenantId: user.tenant_id, remainingCodes: remainingHashes.length },
      });

      return { valid: true, usedRecoveryCode: true };
    }

    return { valid: false, reason: 'Invalid TOTP code or recovery code.' };
  }
}
