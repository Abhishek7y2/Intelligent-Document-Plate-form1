import fs from 'fs';
import path from 'path';
import { dbPool } from '../postgres.client.js';
import { Logger } from '../../utils/logger.js';
import { config } from '../../config/env.config.js';

export async function runMigrations(): Promise<void> {
  // --- Preflight Safety Guard (Safety Boundary Enforcement) ---
  const targetPort = config.postgres.port;
  const targetDb = config.postgres.database;

  // 1. Static Configuration Checks: Check environment conflict, connection string override, and sandbox parameters
  if (process.env['DB_PORT'] && process.env['POSTGRES_PORT'] && process.env['DB_PORT'] !== process.env['POSTGRES_PORT']) {
    const errorMsg = `[MIGRATION GUARD REJECTED] Conflicting environment variables: DB_PORT='${process.env['DB_PORT']}' vs POSTGRES_PORT='${process.env['POSTGRES_PORT']}'.`;
    Logger.error({ message: errorMsg });
    throw new Error(errorMsg);
  }

  if (process.env['DB_DATABASE'] && process.env['POSTGRES_DB'] && process.env['DB_DATABASE'] !== process.env['POSTGRES_DB']) {
    const errorMsg = `[MIGRATION GUARD REJECTED] Conflicting environment variables: DB_DATABASE='${process.env['DB_DATABASE']}' vs POSTGRES_DB='${process.env['POSTGRES_DB']}'.`;
    Logger.error({ message: errorMsg });
    throw new Error(errorMsg);
  }

  // Guard against unapproved DATABASE_URL / PGURI connection string overrides
  const connStr = process.env['DATABASE_URL'] || process.env['PGURI'];
  if (connStr) {
    try {
      const parsedUrl = new URL(connStr);
      const urlPort = parseInt(parsedUrl.port || '5432', 10);
      const urlDb = parsedUrl.pathname.replace(/^\//, '');
      if (urlPort !== 5434 || urlDb !== 'docunexa_sandbox') {
        const errorMsg = `[MIGRATION GUARD REJECTED] Connection string override targets port ${urlPort} and database '${urlDb}'. Migrations strictly require port 5434 and 'docunexa_sandbox'.`;
        Logger.error({ message: errorMsg });
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      if (e.message?.includes('MIGRATION GUARD REJECTED')) throw e;
      const errorMsg = `[MIGRATION GUARD REJECTED] Malformed DATABASE_URL connection string: ${e.message}`;
      Logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }
  }

  if (targetPort !== 5434) {
    const errorMsg = `[MIGRATION GUARD REJECTED] Target port is ${targetPort}. Migrations are strictly restricted to isolated sandbox port 5434. Port 5433 (PostgreSQL 12.12) and port 5432 (PostgreSQL 18) are strictly prohibited.`;
    Logger.error({ message: errorMsg });
    throw new Error(errorMsg);
  }

  if (targetDb !== 'docunexa_sandbox') {
    const errorMsg = `[MIGRATION GUARD REJECTED] Target database is '${targetDb}'. Migrations must exclusively target isolated sandbox database 'docunexa_sandbox'. Legacy database 'docunexa' is protected.`;
    Logger.error({ message: errorMsg });
    throw new Error(errorMsg);
  }

  Logger.info({
    message: '[MIGRATION GUARD] Connecting to target database for runtime preflight verification...',
    data: { host: config.postgres.host, port: targetPort, database: targetDb, user: config.postgres.user },
  });

  const client = await dbPool.connect();

  try {
    // 2. Runtime Server & Version Checks
    const preflightRes = await client.query(`
      SELECT 
        version() AS version_string,
        current_database() AS db_name,
        current_user AS user_name,
        inet_server_port() AS server_port;
    `);
    const preflight = preflightRes.rows[0];

    // Prevent connecting to PostgreSQL 12 or any non-16 engine
    if (!preflight?.version_string || !preflight.version_string.includes('PostgreSQL 16.')) {
      const errorMsg = `[MIGRATION GUARD REJECTED] Server version '${preflight?.version_string}' is not PostgreSQL 16.x. DocuNexa Sprint 9 migrations strictly require PostgreSQL 16 with pgvector.`;
      Logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    if (preflight.db_name !== 'docunexa_sandbox') {
      const errorMsg = `[MIGRATION GUARD REJECTED] Connected to database '${preflight.db_name}'. Expected isolated sandbox 'docunexa_sandbox'. Aborting.`;
      Logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    // Verify pgvector extension availability
    const extRes = await client.query(`
      SELECT name, default_version, installed_version 
      FROM pg_available_extensions 
      WHERE name = 'vector';
    `);
    if (extRes.rows.length === 0) {
      const errorMsg = '[MIGRATION GUARD REJECTED] pgvector extension is not available in the target PostgreSQL 16 installation.';
      Logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    Logger.info({
      message: '[MIGRATION GUARD PASSED] Verified PostgreSQL 16 sandbox environment.',
      data: {
        serverVersion: preflight.version_string.split(',')[0],
        database: preflight.db_name,
        user: preflight.user_name,
        pgvectorAvailable: true,
      },
    });

    // 3. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Read executed migrations
    const res = await client.query('SELECT migration_id FROM schema_migrations;');
    const appliedMigrations = new Set(res.rows.map((row) => row.migration_id));

    // 5. Scan migration files
    const migrationsDir = path.resolve(process.cwd(), 'src/database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      Logger.warn({ message: `Migration directory '${migrationsDir}' does not exist. Skipping.` });
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.toLowerCase().includes('rollback'))
      .sort();

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        Logger.info({ message: `Migration '${file}' already applied. Skipping.` });
        continue;
      }

      Logger.info({ message: `Applying migration '${file}'...` });
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN;');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (migration_id) VALUES ($1);', [file]);
      await client.query('COMMIT;');

      Logger.info({ message: `Migration '${file}' applied successfully.` });
    }
  } catch (err: any) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // Ignore rollback failure if transaction wasn't active
    }
    Logger.error({ message: `Migration process aborted: ${err.message}`, error: err });
    throw err;
  } finally {
    client.release();
  }
}

// CLI execution handler
if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      Logger.info({ message: 'Migration runner completed successfully.' });
      process.exit(0);
    })
    .catch((err) => {
      console.error('[FATAL] Migration runner failed:', err.message);
      process.exit(1);
    });
}
