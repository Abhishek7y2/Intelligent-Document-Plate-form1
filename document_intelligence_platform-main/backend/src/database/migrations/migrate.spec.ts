import { runMigrations } from './migrate.js';
import { config } from '../../config/env.config.js';
import { dbPool } from '../postgres.client.js';

describe('Database Migration Runner Safety Boundary Guard', () => {
  const originalPort = config.postgres.port;
  const originalDatabase = config.postgres.database;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env['DB_PORT'];
    delete process.env['POSTGRES_PORT'];
    delete process.env['DB_DATABASE'];
    delete process.env['POSTGRES_DB'];
    delete process.env['DATABASE_URL'];
    delete process.env['PGURI'];
  });

  afterEach(() => {
    config.postgres.port = originalPort;
    config.postgres.database = originalDatabase;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('Static Configuration Preflight Checks (Before Connection / DDL)', () => {
    it('1. rejects port 5432 (PostgreSQL 18 Windows Service) immediately before any connection', async () => {
      config.postgres.port = 5432;
      config.postgres.database = 'docunexa_sandbox';

      const connectSpy = jest.spyOn(dbPool, 'connect');

      await expect(runMigrations()).rejects.toThrow(
        /Target port is 5432.*Port 5433.*and port 5432.*are strictly prohibited/i
      );

      // Verify no network connection was attempted
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('2. rejects port 5433 (PostgreSQL 12.12 Legacy Cluster) immediately before any connection', async () => {
      config.postgres.port = 5433;
      config.postgres.database = 'docunexa_sandbox';

      const connectSpy = jest.spyOn(dbPool, 'connect');

      await expect(runMigrations()).rejects.toThrow(
        /Target port is 5433.*Port 5433.*and port 5432.*are strictly prohibited/i
      );

      // Verify no network connection was attempted
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('3. rejects any port other than 5434 (e.g., port 5435)', async () => {
      config.postgres.port = 5435;
      config.postgres.database = 'docunexa_sandbox';

      const connectSpy = jest.spyOn(dbPool, 'connect');

      await expect(runMigrations()).rejects.toThrow(
        /Target port is 5435.*strictly restricted to isolated sandbox port 5434/i
      );

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('4. rejects any database other than docunexa_sandbox (e.g., docunexa, postgres)', async () => {
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa'; // legacy DB name

      const connectSpy = jest.spyOn(dbPool, 'connect');

      await expect(runMigrations()).rejects.toThrow(
        /Target database is 'docunexa'.*exclusively target isolated sandbox database 'docunexa_sandbox'/i
      );

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('rejects conflicting DB_PORT vs POSTGRES_PORT environment variables', async () => {
      process.env['DB_PORT'] = '5434';
      process.env['POSTGRES_PORT'] = '5433';
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      try {
        await expect(runMigrations()).rejects.toThrow(
          /Conflicting environment variables: DB_PORT='5434' vs POSTGRES_PORT='5433'/i
        );
      } finally {
        delete process.env['DB_PORT'];
        delete process.env['POSTGRES_PORT'];
      }
    });

    it('rejects conflicting DB_DATABASE vs POSTGRES_DB environment variables', async () => {
      process.env['DB_DATABASE'] = 'docunexa_sandbox';
      process.env['POSTGRES_DB'] = 'docunexa';
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      try {
        await expect(runMigrations()).rejects.toThrow(
          /Conflicting environment variables: DB_DATABASE='docunexa_sandbox' vs POSTGRES_DB='docunexa'/i
        );
      } finally {
        delete process.env['DB_DATABASE'];
        delete process.env['POSTGRES_DB'];
      }
    });

    it('rejects unapproved connection string overrides in DATABASE_URL', async () => {
      process.env['DATABASE_URL'] = 'postgresql://postgres:pass@127.0.0.1:5433/docunexa';
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      try {
        await expect(runMigrations()).rejects.toThrow(
          /Connection string override targets port 5433 and database 'docunexa'/i
        );
      } finally {
        delete process.env['DATABASE_URL'];
      }
    });
  });

  describe('Runtime Server Preflight Checks (Before Any DDL Execution)', () => {
    it('5. rejects any connected server that is not PostgreSQL 16.x (e.g., PostgreSQL 12 or 18)', async () => {
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      const mockClient = {
        query: jest.fn().mockImplementation((queryText: string) => {
          if (typeof queryText === 'string' && queryText.includes('version()')) {
            return Promise.resolve({
              rows: [
                {
                  version_string: 'PostgreSQL 12.12 on x86_64-pc-windows-msvc',
                  db_name: 'docunexa_sandbox',
                  user_name: 'postgres',
                  server_port: 5434,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      };

      (jest.spyOn(dbPool, 'connect') as any).mockResolvedValue(mockClient as any);

      await expect(runMigrations()).rejects.toThrow(
        /Server version '.*' is not PostgreSQL 16\.x/i
      );

      // Verify no DDL (CREATE TABLE, schema_migrations, BEGIN) was executed
      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(calls.some((sql: string) => sql.includes('CREATE TABLE'))).toBe(false);
      expect(calls.some((sql: string) => sql.includes('schema_migrations'))).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('6. rejects any connection whose verified database identity does not match docunexa_sandbox', async () => {
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      const mockClient = {
        query: jest.fn().mockImplementation((queryText: string) => {
          if (typeof queryText === 'string' && queryText.includes('version()')) {
            return Promise.resolve({
              rows: [
                {
                  version_string: 'PostgreSQL 16.3 on x86_64-pc-linux-gnu',
                  db_name: 'production_main', // Connected to wrong DB
                  user_name: 'postgres',
                  server_port: 5434,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      };

      (jest.spyOn(dbPool, 'connect') as any).mockResolvedValue(mockClient as any);

      await expect(runMigrations()).rejects.toThrow(
        /Connected to database 'production_main'\. Expected isolated sandbox 'docunexa_sandbox'/i
      );

      // Verify no DDL was executed
      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(calls.some((sql: string) => sql.includes('CREATE TABLE'))).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rejects execution when pgvector extension is missing on target server', async () => {
      config.postgres.port = 5434;
      config.postgres.database = 'docunexa_sandbox';

      const mockClient = {
        query: jest.fn().mockImplementation((queryText: string) => {
          if (typeof queryText === 'string' && queryText.includes('version()')) {
            return Promise.resolve({
              rows: [
                {
                  version_string: 'PostgreSQL 16.3 on x86_64-pc-linux-gnu',
                  db_name: 'docunexa_sandbox',
                  user_name: 'postgres',
                  server_port: 5434,
                },
              ],
            });
          }
          if (typeof queryText === 'string' && queryText.includes('pg_available_extensions')) {
            return Promise.resolve({ rows: [] }); // pgvector not available
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      };

      (jest.spyOn(dbPool, 'connect') as any).mockResolvedValue(mockClient as any);

      await expect(runMigrations()).rejects.toThrow(
        /pgvector extension is not available/i
      );

      // Verify no DDL was executed
      const calls = mockClient.query.mock.calls.map((c) => c[0]);
      expect(calls.some((sql: string) => sql.includes('CREATE TABLE'))).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
