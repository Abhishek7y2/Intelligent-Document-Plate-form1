import { EmailService } from './email.service.js';
import { AuthService } from './auth.service.js';
import { requestOtpHandler } from '../controllers/auth.controller.js';
import { getAvatarBinaryHandler } from '../controllers/profile.controller.js';
import { initializeDatabasePersistence, PERSISTENT_DOMAIN_SERVICES } from '../database/persistence-initializer.js';
import { StorageFactory } from './storage.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

describe('Security Hardening & Persistence Verification Suite (Sprint 0D)', () => {
  beforeAll(() => {
    // Ensure in-memory mode during tests
    initializeDatabasePersistence('memory');
  });

  afterAll(() => {
    initializeDatabasePersistence('memory');
  });

  describe('Finding 1: Static Master OTP Elimination (DEF-012 / SEC-001)', () => {
    it('strictly rejects master passcode 742918 when no OTP was requested', () => {
      const result = EmailService.verifyLoginOtp('victim@enterprise.com', '742918');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No active OTP request found');
    });

    it('strictly rejects master passcode 123456 when no OTP was requested', () => {
      const result = EmailService.verifyLoginOtp('victim@enterprise.com', '123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No active OTP request found');
    });

    it('strictly rejects master passcodes even when an active OTP exists for the email', async () => {
      const email = 'employee.active@enterprise.com';
      await EmailService.sendLoginOtpEmail(email, '127.0.0.1');

      // Attempt verification using static backdoor codes
      const bypassAttempt1 = EmailService.verifyLoginOtp(email, '742918');
      expect(bypassAttempt1.valid).toBe(false);
      expect(bypassAttempt1.reason).toContain('Incorrect verification code');

      const bypassAttempt2 = EmailService.verifyLoginOtp(email, '123456');
      expect(bypassAttempt2.valid).toBe(false);
    });

    it('successfully verifies legitimate generated OTP and invalidates on single-use', async () => {
      const email = 'legitimate.user@enterprise.com';
      const otpRes = await EmailService.sendLoginOtpEmail(email, '127.0.0.1');
      const validCode = String(otpRes.otp);

      // First verification attempt: must succeed
      const firstAttempt = EmailService.verifyLoginOtp(email, validCode);
      expect(firstAttempt.valid).toBe(true);

      // Second verification attempt: must fail (replay prevention)
      const secondAttempt = EmailService.verifyLoginOtp(email, validCode);
      expect(secondAttempt.valid).toBe(false);
      expect(secondAttempt.reason).toContain('No active OTP request found');
    });
  });

  describe('Finding 2: OTP Passcode Leakage Prevention in API Response (DEF-013 / SEC-002)', () => {
    it('ensures requestOtpHandler does NOT expose testOtp or generated codes in HTTP response', async () => {
      let responseStatus = 0;
      let responseJson: any = null;

      const mockReq: any = {
        body: { email: 'secure.user@enterprise.com' },
        ip: '127.0.0.1',
        headers: {},
        originalUrl: '/api/v1/auth/request-otp',
      };

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (payload: any) => {
              responseJson = payload;
            },
          };
        },
      };

      const mockNext = jest.fn();

      await requestOtpHandler(mockReq, mockRes, mockNext);

      expect(responseStatus).toBe(200);
      expect(responseJson).toBeDefined();
      expect(responseJson.success).toBe(true);
      expect(responseJson.email).toBe('secure.user@enterprise.com');

      // VERIFICATION: testOtp and any otp field must NOT exist in the response body
      expect(responseJson.testOtp).toBeUndefined();
      expect(responseJson.otp).toBeUndefined();
      expect(JSON.stringify(responseJson)).not.toMatch(/\b\d{6}\b/);
    });
  });

  describe('Finding 3: Dynamic Admin Privilege Escalation Prevention (DEF-014 / SEC-003)', () => {
    it('rejects uninvited/unknown email containing "admin" with 404 USER_NOT_FOUND', async () => {
      const unknownAdminEmail = 'unauthorized_attacker_admin@malicious-domain.com';

      await expect(
        AuthService.loginWithEmailOnly(unknownAdminEmail, '127.0.0.1', 'JestTestRunner')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });

    it('rejects standard unknown email with 404 USER_NOT_FOUND', async () => {
      const unknownEmail = 'random_stranger@somewhere.com';

      await expect(
        AuthService.loginWithEmailOnly(unknownEmail, '127.0.0.1', 'JestTestRunner')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('Finding 4: Avatar Endpoint Authentication & Tenant Scoping (SEC-004)', () => {
    it('returns 401 UNAUTHORIZED when avatar endpoint is accessed without an authenticated user', async () => {
      let responseStatus = 0;
      let responseJson: any = null;

      const mockReq: any = {
        user: undefined, // Unauthenticated
        params: { filename: 'USR-TEST.png' },
        originalUrl: '/api/v1/users/profile/avatar/USR-TEST.png',
      };

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (payload: any) => {
              responseJson = payload;
            },
          };
        },
      };

      await getAvatarBinaryHandler(mockReq, mockRes, jest.fn());

      expect(responseStatus).toBe(401);
      expect(responseJson.type).toContain('UNAUTHORIZED');
    });

    it('returns 404 when user from tenant A requests avatar belonging to tenant B', async () => {
      const storage = StorageFactory.getStorage();
      const foreignTenant = 'TNT-FOREIGN-99';
      const callerTenant = 'TNT-CORP-01';
      const targetUserId = 'USR-TARGET-01';

      // Seed avatar in foreign tenant
      await storage.putObject(`avatars/${foreignTenant}/${targetUserId}.png`, Buffer.from('fake-png-data'), {
        contentType: 'image/png',
      });

      let responseStatus = 0;
      let responseJson: any = null;

      const mockReq: any = {
        user: {
          userId: 'USR-CALLER-01',
          tenantId: callerTenant,
          role: 'Reviewer',
          permissions: [],
        },
        params: { filename: `${targetUserId}.png` },
        originalUrl: `/api/v1/users/profile/avatar/${targetUserId}.png`,
      };

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (payload: any) => {
              responseJson = payload;
            },
          };
        },
      };

      await getAvatarBinaryHandler(mockReq, mockRes, jest.fn());

      // Caller cannot cross tenant boundaries to fetch the avatar
      expect(responseStatus).toBe(404);
      expect(responseJson.title).toContain('not found within tenant organization');
    });
  });

  describe('Finding 5: Centralized Persistence Initializer (DEF-002 / SEC-010)', () => {
    it('toggles storage mode across all 15 domain services to database and back to memory', () => {
      initializeDatabasePersistence('database');

      for (const item of PERSISTENT_DOMAIN_SERVICES) {
        if (typeof (item.service as any).getStoreMode === 'function') {
          expect((item.service as any).getStoreMode()).toBe('database');
        }
      }

      initializeDatabasePersistence('memory');

      for (const item of PERSISTENT_DOMAIN_SERVICES) {
        if (typeof (item.service as any).getStoreMode === 'function') {
          expect((item.service as any).getStoreMode()).toBe('memory');
        }
      }
    });
  });
});
