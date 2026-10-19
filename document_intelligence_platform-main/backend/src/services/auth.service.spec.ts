import { AuthService, seedTestUsers } from './auth.service.js';

describe('Sprint 2: AuthService Identity & Session Management', () => {
  beforeAll(async () => {
    jest.setTimeout(15000);
    await seedTestUsers();
  });

  describe('User Login & Password Verification', () => {
    it('should successfully log in with valid credentials and return JWT & refresh token', async () => {
      const result = await AuthService.login('analyst@docunexa.io', 'SecurePassword123!');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('analyst@docunexa.io');
      expect(result.user.tenantId).toBe('TNT-CORP-01');
      expect(result.user.role).toBe('Reviewer');
      expect(result.user.permissions).toContain('DOC_VIEW');
      expect(result.user.permissions).toContain('DOC_VERIFY');
    });

    it('should reject login with incorrect password with 401 INVALID_CREDENTIALS', async () => {
      await expect(
        AuthService.login('analyst@docunexa.io', 'WrongPassword!')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should reject login with non-existent user with 401 INVALID_CREDENTIALS', async () => {
      await expect(
        AuthService.login('nonexistent@docunexa.io', 'Password123!')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should reject cross-tenant login if user does not belong to requested tenant', async () => {
      await expect(
        AuthService.login('analyst@docunexa.io', 'SecurePassword123!', 'TNT-FOREIGN-99')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'TENANT_ACCESS_DENIED',
      });
    });
  });

  describe('Refresh Token Rotation & Reuse Detection', () => {
    it('should rotate refresh token and issue new access token on valid refresh request', async () => {
      const loginRes = await AuthService.login('analyst@docunexa.io', 'SecurePassword123!');
      const refreshRes = await AuthService.refresh(loginRes.refreshToken);

      expect(refreshRes).toBeDefined();
      expect(refreshRes.accessToken).toBeDefined();
      expect(refreshRes.refreshToken).toBeDefined();
      expect(refreshRes.refreshToken).not.toBe(loginRes.refreshToken); // Must be a new rotated token!
    });

    it('should detect reuse of already rotated refresh token and revoke family with 401 REFRESH_TOKEN_REUSE', async () => {
      const loginRes = await AuthService.login('analyst@docunexa.io', 'SecurePassword123!');
      
      // First refresh: consumes old token, issues new token
      await AuthService.refresh(loginRes.refreshToken);

      // Second refresh with SAME old token: reuse attempt!
      await expect(
        AuthService.refresh(loginRes.refreshToken)
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_REUSE',
      });
    });

    it('should reject invalid or non-existent refresh token with 401', async () => {
      await expect(
        AuthService.refresh('completely_fake_refresh_token_value_999')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('should handle concurrent refresh attempts safely without creating duplicate valid successors', async () => {
      const loginRes = await AuthService.login('analyst@docunexa.io', 'SecurePassword123!');
      
      // Dispatch two concurrent refresh attempts using the exact same refresh token
      const results = await Promise.allSettled([
        AuthService.refresh(loginRes.refreshToken),
        AuthService.refresh(loginRes.refreshToken),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Crucial security invariant: At most ONE rotation can succeed.
      // If one succeeds, the other must be rejected due to token rotation / reuse detection.
      expect(fulfilled.length).toBeLessThanOrEqual(1);
      expect(rejected.length).toBeGreaterThanOrEqual(1);

      if (rejected.length > 0) {
        const rejReason = (rejected[0] as PromiseRejectedResult).reason;
        expect([401, 400]).toContain(rejReason.statusCode);
      }

      // Concurrency Grace Defense: The winning successor token MUST remain valid!
      // The losing request must NOT have accidentally revoked the winner's new session in the family.
      if (fulfilled.length === 1) {
        const winnerResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
        const subsequentRefresh = await AuthService.refresh(winnerResult.refreshToken);
        expect(subsequentRefresh).toBeDefined();
        expect(subsequentRefresh.accessToken).toBeDefined();
      }
    });

    it('should execute PostgreSQL transaction with FOR UPDATE row-level locking when database is connected', async () => {
      const mockQueries: string[] = [];
      const mockClient = {
        query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
          mockQueries.push(sql);
          if (sql.includes('SELECT session_id') && sql.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  session_id: 'sess-uuid-1',
                  user_id: 'USR-88210',
                  tenant_id: 'TNT-CORP-01',
                  refresh_token_hash: 'somehash',
                  family_id: 'fam-uuid-1',
                  is_revoked: false,
                  expires_at: new Date(Date.now() + 86400000),
                  created_at: new Date(),
                  last_used_at: new Date(),
                },
              ],
            };
          }
          if (sql.includes('SELECT user_id, email, full_name, role, is_active FROM users')) {
            return {
              rows: [
                {
                  user_id: 'USR-88210',
                  email: 'analyst@docunexa.io',
                  full_name: 'Risk Analyst',
                  role: 'Reviewer',
                  is_active: true,
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      const { dbPool } = await import('../database/postgres.client.js');
      const originalConnect = dbPool.connect;
      dbPool.connect = jest.fn().mockResolvedValue(mockClient as any);

      try {
        const refreshRes = await AuthService.refresh('valid_token_for_db_test_999');
        expect(refreshRes).toBeDefined();
        expect(mockQueries).toContain('BEGIN');
        expect(mockQueries.some((q) => q.includes('FOR UPDATE'))).toBe(true);
        expect(mockQueries.some((q) => q.includes('UPDATE auth_sessions SET is_revoked = TRUE'))).toBe(true);
        expect(mockQueries.some((q) => q.includes('INSERT INTO auth_sessions'))).toBe(true);
        expect(mockQueries).toContain('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
      } finally {
        dbPool.connect = originalConnect;
      }
    });
  });

  describe('Logout & Session Revocation', () => {
    it('should revoke session on logout so refresh token cannot be used again', async () => {
      const loginRes = await AuthService.login('analyst@docunexa.io', 'SecurePassword123!');
      
      // Perform logout
      await AuthService.logout(loginRes.refreshToken);

      // Attempting to refresh after logout must fail
      await expect(
        AuthService.refresh(loginRes.refreshToken)
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
