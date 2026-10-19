import bcrypt from 'bcryptjs';
import { ProfileService } from './profile.service.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { UserRecord, AuthSession } from '../models/auth.models.js';

describe('Profile Management & Authentication Enterprise Regression Suite', () => {
  const tenantId = 'TNT-CORP-01';
  const userId = 'USR-PROFILE-TEST-01';
  const initialPassword = 'InitialSecurePassword123!';
  let passwordHash: string;

  const mockUser: UserRecord = {
    user_id: userId,
    tenant_id: tenantId,
    email: 'alex.morgan@acme-enterprise.example',
    full_name: 'Alex Morgan',
    role: 'Reviewer',
    password_hash: '',
    is_active: true,
    first_name: 'Alex',
    last_name: 'Morgan',
    preferred_name: 'Alex',
    phone_number: '+1 (555) 234-5678',
    employee_id: 'EMP-9921',
    designation: 'Senior Document Analyst',
    department: 'Operations',
    manager_name: 'Sarah Connor',
    location: 'Chicago HQ',
    employment_status: 'Active',
    employee_type: 'Full-time',
    avatar_url: '/profile-avatar.jpg',
    cover_url: '/profile-cover.jpg',
    timezone: 'America/Chicago',
    language: 'en-US',
    email_alerts_enabled: true,
    in_app_notifications_enabled: true,
    created_at: new Date('2024-01-15T00:00:00Z'),
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(initialPassword, 10);
    mockUser.password_hash = passwordHash;
  });

  beforeEach(() => {
    jest.spyOn(AuthService, 'isDatabaseMode').mockReturnValue(false);
    jest.spyOn(AuditTrailService, 'recordEvent').mockResolvedValue(undefined as any);
    AuthService.clearInMemoryUsers();
    AuthService.setInMemoryUser({ ...mockUser });
  });

  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/users/profile
  // ---------------------------------------------------------------------------
  describe('ProfileService.getProfile', () => {
    it('should return sanitized user profile and strictly omit sensitive fields', async () => {
      const profile = await ProfileService.getProfile(userId, tenantId);

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(userId);
      expect(profile.tenantId).toBe(tenantId);
      expect(profile.workEmail).toBe(mockUser.email);
      expect(profile.firstName).toBe('Alex');
      expect(profile.lastName).toBe('Morgan');
      expect(profile.designation).toBe('Senior Document Analyst');
      expect(profile.department).toBe('Operations');
      expect(profile.employeeId).toBe('EMP-9921');

      // Security check: Never expose password hashes or internal secrets
      expect((profile as any).password_hash).toBeUndefined();
      expect((profile as any).passwordHash).toBeUndefined();
      expect((profile as any).mfa_secret).toBeUndefined();
      expect((profile as any).mfa_secret_enc).toBeUndefined();
      expect((profile as any).recovery_codes).toBeUndefined();
    });

    it('should reject profile request with 404 if user does not exist', async () => {
      await expect(
        ProfileService.getProfile('USR-NON-EXISTENT', tenantId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });

    it('should enforce tenant isolation and reject cross-tenant profile access', async () => {
      await expect(
        ProfileService.getProfile(userId, 'TNT-ROGUE-99')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'TENANT_ACCESS_DENIED',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PATCH /api/v1/users/profile
  // ---------------------------------------------------------------------------
  describe('ProfileService.updateProfile', () => {
    it('should update whitelisted profile fields successfully', async () => {
      const updateDto = {
        firstName: 'Alexander',
        lastName: 'Morgan-Smith',
        preferredName: 'Alex M.',
        phoneNumber: '+1 (555) 888-9999',
        timezone: 'America/New_York',
        language: 'en-GB',
        emailAlerts: false,
        inAppNotifications: true,
      };

      const updated = await ProfileService.updateProfile(userId, tenantId, updateDto);

      expect(updated.firstName).toBe('Alexander');
      expect(updated.lastName).toBe('Morgan-Smith');
      expect(updated.preferredName).toBe('Alex M.');
      expect(updated.phoneNumber).toBe('+1 (555) 888-9999');
      expect(updated.timezone).toBe('America/New_York');
      expect(updated.emailAlerts).toBe(false);
      expect(updated.inAppNotifications).toBe(true);
    });

    it('should prevent privilege escalation: ignore and reject attempts to alter role, tenant, or user ID', async () => {
      const maliciousDto: any = {
        firstName: 'Alex',
        role: 'Admin',
        tenantId: 'TNT-FOREIGN-02',
        user_id: 'USR-ROOT',
        permissions: ['ADMIN_ALL', 'SYSTEM_PURGE'],
      };

      const updated = await ProfileService.updateProfile(userId, tenantId, maliciousDto);

      // Verify the role remains untouched
      expect(updated.role).toBe('Reviewer');
      expect(updated.tenantId).toBe(tenantId);
      expect(updated.userId).toBe(userId);
    });

    it('should reject invalid first/last names containing numeric or malicious characters', async () => {
      await expect(
        ProfileService.updateProfile(userId, tenantId, {
          firstName: 'Alex123<script>',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('should reject invalid phone numbers', async () => {
      await expect(
        ProfileService.updateProfile(userId, tenantId, {
          phoneNumber: 'abc-def-invalid',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('should reject date of birth for age under 18 years (minority safeguard)', async () => {
      const underAgeDate = new Date();
      underAgeDate.setFullYear(underAgeDate.getFullYear() - 15);
      const dobStr = underAgeDate.toISOString().split('T')[0]!;

      await expect(
        ProfileService.updateProfile(userId, tenantId, {
          dateOfBirth: dobStr,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/users/profile/avatar
  // ---------------------------------------------------------------------------
  describe('ProfileService.uploadAvatar', () => {
    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    // Valid JPEG signature: FF D8 FF E0
    const validJpgBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);

    // Valid WebP signature: RIFF....WEBP
    const validWebpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    ]);

    it('should accept valid PNG buffer with legitimate magic bytes', async () => {
      const res = await ProfileService.uploadAvatar(
        userId,
        tenantId,
        validPngBuffer,
        'image/png',
        'avatar.png'
      );

      expect(res.avatarUrl).toContain('/api/v1/users/profile/avatar/');
      expect(res.avatarUrl).toContain('.png');

      // Verify the user record has been updated
      const profile = await ProfileService.getProfile(userId, tenantId);
      expect(profile.avatarUrl).toBe(res.avatarUrl);
    });

    it('should accept valid JPEG buffer with legitimate magic bytes', async () => {
      const res = await ProfileService.uploadAvatar(
        userId,
        tenantId,
        validJpgBuffer,
        'image/jpeg',
        'avatar.jpg'
      );

      expect(res.avatarUrl).toMatch(/\.(jpe?g)$/);
    });

    it('should accept valid WebP buffer with legitimate magic bytes', async () => {
      const res = await ProfileService.uploadAvatar(
        userId,
        tenantId,
        validWebpBuffer,
        'image/webp',
        'avatar.webp'
      );

      expect(res.avatarUrl).toContain('.webp');
    });

    it('should reject file disguised with image extension but containing non-image bytes (file-signature spoofing prevention)', async () => {
      // Disguised script/text payload disguised as avatar.png
      const fakePngBuffer = Buffer.from('<?php echo "malicious script"; ?>');

      await expect(
        ProfileService.uploadAvatar(
          userId,
          tenantId,
          fakePngBuffer,
          'image/png',
          'innocent-looking.png'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_FILE_SIGNATURE',
      });
    });

    it('should reject files exceeding 2MB size ceiling', async () => {
      // 2.5MB oversized buffer
      const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024);
      // Write valid PNG header so magic byte check would pass if not for size check
      validPngBuffer.copy(oversizedBuffer, 0, 0, validPngBuffer.length);

      await expect(
        ProfileService.uploadAvatar(
          userId,
          tenantId,
          oversizedBuffer,
          'image/png',
          'huge-avatar.png'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'FILE_TOO_LARGE',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/auth/change-password
  // ---------------------------------------------------------------------------
  describe('AuthService.changePassword', () => {
    it('should successfully change password when current password matches bcrypt hash', async () => {
      const emailSpy = jest.spyOn(EmailService, 'sendPasswordChangeAlertEmail').mockResolvedValue(undefined as any);
      const auditSpy = jest.spyOn(AuditTrailService, 'recordEvent').mockResolvedValue(undefined as any);

      const newPassword = 'BrandNewSecurePassword2026!';
      const res = await AuthService.changePassword(
        userId,
        tenantId,
        initialPassword,
        newPassword
      );

      expect(res.success).toBe(true);

      // Verify the password hash was updated
      const user = await AuthService.getUserById(userId, tenantId);
      expect(user).toBeDefined();
      const isNewPasswordValid = await bcrypt.compare(newPassword, user!.password_hash);
      expect(isNewPasswordValid).toBe(true);

      // Verify password change alert email was triggered
      expect(emailSpy).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({ time: expect.any(String) })
      );

      // Verify tamper-evident audit logging
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId,
          action: 'PASSWORD_CHANGED',
        })
      );
    });

    it('should reject password change when current password is wrong with 401 INVALID_CURRENT_PASSWORD', async () => {
      await expect(
        AuthService.changePassword(
          userId,
          tenantId,
          'WrongCurrentPassword999!',
          'BrandNewSecurePassword2026!'
        )
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CURRENT_PASSWORD',
      });
    });

    it('should reject weak new password failing enterprise complexity rules (minimum 12 chars, upper, lower, number, symbol)', async () => {
      // Missing special character and number
      await expect(
        AuthService.changePassword(
          userId,
          tenantId,
          initialPassword,
          'weakpasswordonlylowercase'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'PASSWORD_COMPLEXITY_FAILED',
      });
    });

    it('should reject reusing identical password as new password', async () => {
      await expect(
        AuthService.changePassword(
          userId,
          tenantId,
          initialPassword,
          initialPassword
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'PASSWORD_REUSE_PROHIBITED',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. GET /api/v1/auth/sessions & DELETE /api/v1/auth/sessions/:id
  // ---------------------------------------------------------------------------
  describe('AuthService Session Management & Revocation', () => {
    const currentSessionId = '00000000-0000-4000-8000-000000000001';
    const otherSessionId = '00000000-0000-4000-8000-000000000002';

    beforeEach(() => {
      AuthService.clearInMemoryUsers();
      AuthService.setInMemoryUser({ ...mockUser });

      const session1: AuthSession = {
        session_id: currentSessionId,
        user_id: userId,
        tenant_id: tenantId,
        refresh_token_hash: 'hash1',
        family_id: 'fam-01',
        is_revoked: false,
        ip_address: '198.51.100.24',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        created_at: new Date(),
        last_used_at: new Date(),
        expires_at: new Date(Date.now() + 86400000),
      };

      const session2: AuthSession = {
        session_id: otherSessionId,
        user_id: userId,
        tenant_id: tenantId,
        refresh_token_hash: 'hash2',
        family_id: 'fam-02',
        is_revoked: false,
        ip_address: '198.51.100.82',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        created_at: new Date(Date.now() - 3600000),
        last_used_at: new Date(Date.now() - 900000),
        expires_at: new Date(Date.now() + 86400000),
      };

      AuthService.setInMemorySession(session1);
      AuthService.setInMemorySession(session2);
    });

    it('should list active sessions with clean browser, OS, and current session indicator', async () => {
      const sessions = await AuthService.listUserSessions(userId, tenantId, currentSessionId);

      expect(sessions.length).toBe(2);

      const current = sessions.find((s) => s.sessionId === currentSessionId);
      expect(current).toBeDefined();
      expect(current!.isCurrent).toBe(true);
      expect(current!.browser).toContain('Chrome');
      expect(current!.os).toBe('Windows');

      const mobile = sessions.find((s) => s.sessionId === otherSessionId);
      expect(mobile).toBeDefined();
      expect(mobile!.isCurrent).toBe(false);
      expect(mobile!.browser).toContain('Safari');
      expect(mobile!.os).toBe('iOS');
    });

    it('should revoke a specific session owned by the user', async () => {
      const auditSpy = jest.spyOn(AuditTrailService, 'recordEvent').mockResolvedValue(undefined as any);

      const res = await AuthService.revokeUserSession(userId, tenantId, otherSessionId);

      expect(res.success).toBe(true);

      const active = await AuthService.listUserSessions(userId, tenantId, currentSessionId);
      expect(active.length).toBe(1);
      expect(active[0]!.sessionId).toBe(currentSessionId);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_REVOKED',
          tenantId,
          userId,
        })
      );
    });

    it('should revoke all other sessions when target id is "other"', async () => {
      const res = await AuthService.revokeUserSession(userId, tenantId, 'other', currentSessionId);

      expect(res.success).toBe(true);

      const active = await AuthService.listUserSessions(userId, tenantId, currentSessionId);
      expect(active.length).toBe(1);
      expect(active[0]!.sessionId).toBe(currentSessionId);
    });

    it('should reject revocation of a non-existent or unowned session with 404 (anti-IDOR protection)', async () => {
      await expect(
        AuthService.revokeUserSession(userId, tenantId, '00000000-0000-4000-8000-999999999999')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
      });
    });
  });
});
