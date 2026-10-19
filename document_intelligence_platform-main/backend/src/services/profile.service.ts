import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { StorageFactory } from './storage.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { AuthService } from './auth.service.js';
import {
  UserProfileResponse,
  UpdateProfileDto,
  UserRecord,
} from '../models/auth.models.js';
import { Logger } from '../utils/logger.js';

export class ProfileService {
  /**
   * Validates binary buffer magic bytes against supported image formats.
   */
  static validateImageBuffer(buffer: Buffer): { valid: boolean; format?: 'jpeg' | 'png' | 'webp'; error?: string } {
    if (!buffer || buffer.length < 12) {
      return { valid: false, error: 'File buffer is empty or corrupted.' };
    }

    // JPEG check: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, format: 'jpeg' };
    }

    // PNG check: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { valid: true, format: 'png' };
    }

    // WebP check: RIFF....WEBP (52 49 46 46 at 0, 57 45 42 50 at 8)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, format: 'webp' };
    }

    return { valid: false, error: 'Invalid file signature. File is not a valid JPEG, PNG, or WebP image.' };
  }

  /**
   * Retrieves full profile data for a user within tenant boundary.
   */
  static async getProfile(userId: string, tenantId: string): Promise<UserProfileResponse> {
    const anyUser = await AuthService.getUserById(userId);
    if (!anyUser) {
      const err: any = new Error('User profile not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (anyUser.tenant_id !== tenantId) {
      const err: any = new Error('Access denied: User does not belong to the requested organization.');
      err.statusCode = 403;
      err.code = 'TENANT_ACCESS_DENIED';
      throw err;
    }

    return this.mapUserToProfile(anyUser);
  }

  /**
   * Updates permitted personal identity and preference fields.
   * Enforces strict field whitelisting (prevents privilege escalation or IDOR).
   */
  static async updateProfile(
    userId: string,
    tenantId: string,
    dto: UpdateProfileDto,
    meta?: { ip?: string; correlationId?: string }
  ): Promise<UserProfileResponse> {
    const anyUser = await AuthService.getUserById(userId);
    if (!anyUser) {
      const err: any = new Error('User profile not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (anyUser.tenant_id !== tenantId) {
      const err: any = new Error('Access denied: User does not belong to the requested organization.');
      err.statusCode = 403;
      err.code = 'TENANT_ACCESS_DENIED';
      throw err;
    }

    const user = anyUser;

    // Strict validation
    const validationErrors: { field: string; message: string }[] = [];

    if (dto.firstName !== undefined) {
      const trimmed = dto.firstName.trim();
      if (!/^[a-zA-ZÀ-ÿ\s'-]{1,50}$/.test(trimmed)) {
        validationErrors.push({
          field: 'firstName',
          message: 'First name must contain 1-50 alphabetic characters, hyphens, or spaces.',
        });
      }
    }

    if (dto.lastName !== undefined) {
      const trimmed = dto.lastName.trim();
      if (!/^[a-zA-ZÀ-ÿ\s'-]{1,50}$/.test(trimmed)) {
        validationErrors.push({
          field: 'lastName',
          message: 'Last name must contain 1-50 alphabetic characters, hyphens, or spaces.',
        });
      }
    }

    if (dto.phoneNumber !== undefined && dto.phoneNumber.trim() !== '') {
      const cleanPhone = dto.phoneNumber.trim();
      const normalizedPhone = cleanPhone.replace(/[\s\(\)\-]/g, '');
      // E.164 compliance
      if (!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
        validationErrors.push({
          field: 'phoneNumber',
          message: 'Phone number must follow international E.164 format (e.g. +15550142280).',
        });
      }
    }

    if (dto.dateOfBirth !== undefined && dto.dateOfBirth.trim() !== '') {
      const dob = new Date(dto.dateOfBirth);
      if (isNaN(dob.getTime())) {
        validationErrors.push({ field: 'dateOfBirth', message: 'Date of birth is not a valid date.' });
      } else {
        const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (ageYears < 18 || ageYears > 100) {
          validationErrors.push({ field: 'dateOfBirth', message: 'Date of birth must indicate age between 18 and 100.' });
        }
      }
    }

    if (validationErrors.length > 0) {
      const err: any = new Error('Validation failed for profile update.');
      err.statusCode = 400;
      err.code = 'VALIDATION_FAILED';
      err.validationErrors = validationErrors;
      throw err;
    }

    // Sanitized updates
    const sanitizedFirstName = dto.firstName ? dto.firstName.trim() : (user.first_name || user.full_name.split(' ')[0] || '');
    const sanitizedLastName = dto.lastName ? dto.lastName.trim() : (user.last_name || user.full_name.split(' ').slice(1).join(' ') || '');
    const sanitizedPreferred = dto.preferredName ? dto.preferredName.trim() : (user.preferred_name || sanitizedFirstName);
    const sanitizedPhone = dto.phoneNumber !== undefined ? dto.phoneNumber.trim() : (user.phone_number || '');
    const sanitizedDob = dto.dateOfBirth !== undefined ? (dto.dateOfBirth ? dto.dateOfBirth : null) : (user.date_of_birth ? String(user.date_of_birth) : null);
    const sanitizedTimezone = dto.timezone !== undefined ? dto.timezone.trim() : (user.timezone || 'America/New_York');
    const sanitizedLanguage = dto.language !== undefined ? dto.language.trim() : (user.language || 'English (US)');
    const emailAlerts = dto.emailAlerts !== undefined ? Boolean(dto.emailAlerts) : (user.email_alerts_enabled ?? true);
    const inAppAlerts = dto.inAppNotifications !== undefined ? Boolean(dto.inAppNotifications) : (user.in_app_notifications_enabled ?? true);
    const updatedFullName = `${sanitizedFirstName} ${sanitizedLastName}`.trim();

    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `UPDATE users
           SET first_name = $1,
               last_name = $2,
               preferred_name = $3,
               full_name = $4,
               phone_number = $5,
               date_of_birth = $6,
               timezone = $7,
               language = $8,
               email_alerts_enabled = $9,
               in_app_notifications_enabled = $10
           WHERE user_id = $11 AND tenant_id = $12`,
          [
            sanitizedFirstName,
            sanitizedLastName,
            sanitizedPreferred,
            updatedFullName,
            sanitizedPhone,
            sanitizedDob,
            sanitizedTimezone,
            sanitizedLanguage,
            emailAlerts,
            inAppAlerts,
            userId,
            tenantId,
          ]
        );
      } catch (dbErr: any) {
        Logger.error({
          message: `Database update failed in ProfileService.updateProfile: ${dbErr.message}`,
          context: 'ProfileService',
        });
      }
    }

    // Update in-memory cache representation
    user.first_name = sanitizedFirstName;
    user.last_name = sanitizedLastName;
    user.preferred_name = sanitizedPreferred;
    user.full_name = updatedFullName;
    user.phone_number = sanitizedPhone;
    user.date_of_birth = sanitizedDob;
    user.timezone = sanitizedTimezone;
    user.language = sanitizedLanguage;
    user.email_alerts_enabled = emailAlerts;
    user.in_app_notifications_enabled = inAppAlerts;
    AuthService.updateInMemoryUser(user);

    // Record audit event
    await AuditTrailService.recordEvent({
      tenantId,
      userId,
      action: 'PROFILE_UPDATED',
      details: {
        updatedFields: Object.keys(dto),
      },
      ipAddress: meta?.ip,
      correlationId: meta?.correlationId,
    }).catch(() => {});

    return this.mapUserToProfile(user);
  }

  /**
   * Uploads and secures user avatar image.
   * Performs magic-byte inspection, size checks, and isolated object storage.
   */
  static async uploadAvatar(
    userId: string,
    tenantId: string,
    fileBuffer: Buffer,
    _mimeType: string,
    _originalName: string,
    meta?: { ip?: string; correlationId?: string }
  ): Promise<{ avatarUrl: string; size: number }> {
    const anyUser = await AuthService.getUserById(userId);
    if (!anyUser) {
      const err: any = new Error('User profile not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    if (anyUser.tenant_id !== tenantId) {
      const err: any = new Error('Access denied: User does not belong to the requested organization.');
      err.statusCode = 403;
      err.code = 'TENANT_ACCESS_DENIED';
      throw err;
    }

    const user = anyUser;

    // File size limit: 2 MB
    const MAX_SIZE = 2 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      const err: any = new Error('Avatar file size exceeds 2 MB limit.');
      err.statusCode = 400;
      err.code = 'FILE_TOO_LARGE';
      throw err;
    }

    // Magic-byte signature verification
    const sigCheck = this.validateImageBuffer(fileBuffer);
    if (!sigCheck.valid) {
      const err: any = new Error(sigCheck.error || 'Invalid image file.');
      err.statusCode = 400;
      err.code = 'INVALID_FILE_SIGNATURE';
      throw err;
    }

    // Generate safe, isolated storage key
    const ext = sigCheck.format || 'png';
    const storageKey = `avatars/${tenantId}/${userId}.${ext}`;
    const storage = StorageFactory.getStorage();

    await storage.putObject(storageKey, fileBuffer, {
      userId,
      tenantId,
      contentType: `image/${ext}`,
    });

    const publicAvatarUrl = `/api/v1/users/profile/avatar/${userId}.${ext}`;

    if (AuthService.isDatabaseMode()) {
      try {
        await dbPool.query(
          `UPDATE users SET avatar_url = $1 WHERE user_id = $2 AND tenant_id = $3`,
          [publicAvatarUrl, userId, tenantId]
        );
      } catch (err: any) {
        Logger.warn({
          message: `Failed to persist avatar_url in DB: ${err.message}`,
          context: 'ProfileService',
        });
      }
    }

    user.avatar_url = publicAvatarUrl;
    AuthService.updateInMemoryUser(user);

    await AuditTrailService.recordEvent({
      tenantId,
      userId,
      action: 'AVATAR_UPLOADED',
      details: { storageKey, size: fileBuffer.length, format: ext },
      ipAddress: meta?.ip,
      correlationId: meta?.correlationId,
    }).catch(() => {});

    return {
      avatarUrl: publicAvatarUrl,
      size: fileBuffer.length,
    };
  }

  /**
   * Helper to project UserRecord into UserProfileResponse.
   */
  private static mapUserToProfile(user: UserRecord): UserProfileResponse {
    const fullNameParts = (user.full_name || '').trim().split(' ');
    const fName = user.first_name || fullNameParts[0] || 'User';
    const lName = user.last_name || (fullNameParts.length > 1 ? fullNameParts.slice(1).join(' ') : 'Member');

    return {
      userId: user.user_id,
      tenantId: user.tenant_id,
      firstName: fName,
      lastName: lName,
      preferredName: user.preferred_name || fName,
      workEmail: user.email,
      phoneNumber: user.phone_number || '',
      dateOfBirth: user.date_of_birth ? String(user.date_of_birth).split('T')[0] : null,
      employeeId: user.employee_id || `DOC-EMP-${user.user_id.replace(/^USR-/, '')}`,
      employmentStatus: user.employment_status || (user.is_active ? 'Active' : 'Inactive'),
      designation: user.designation || 'Document Operations Specialist',
      department: user.department || 'Document Intelligence',
      managerName: user.manager_name || 'Ethan Brooks',
      location: user.location || 'New York HQ',
      employeeType: user.employee_type || 'Full-time',
      dateJoined: user.date_joined ? String(user.date_joined).split('T')[0] : '2022-02-12',
      role: user.role,
      mfaEnabled: Boolean(user.mfa_enabled),
      lastLoginAt: user.created_at ? new Date(user.created_at).toISOString() : null,
      lastPasswordChangeAt: user.last_password_change_at ? new Date(user.last_password_change_at).toISOString() : null,
      timezone: user.timezone || 'America/New_York',
      language: user.language || 'English (US)',
      emailAlerts: user.email_alerts_enabled ?? true,
      inAppNotifications: user.in_app_notifications_enabled ?? true,
      avatarUrl: user.avatar_url || null,
      coverUrl: user.cover_url || null,
    };
  }
}
