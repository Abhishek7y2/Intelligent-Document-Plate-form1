import pg from 'pg';
import { config } from '../config/env.config.js';

const { Pool } = pg;

export const dbPool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.pass,
  database: config.postgres.database,
  max: config.postgres.maxPool,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.postgres.ssl
    ? {
        rejectUnauthorized:
          config.env === 'production' ||
          process.env['DB_SSL_REJECT_UNAUTHORIZED'] === 'true' ||
          process.env['POSTGRES_SSL_REJECT_UNAUTHORIZED'] === 'true',
      }
    : undefined,
});

dbPool.on('error', (err: Error) => {
  // Redact any potential credentials in connection strings before logging
  const safeMessage = err.message ? err.message.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@') : 'Unknown database pool error';
  console.error('[DATABASE ERROR] Unexpected error on idle PostgreSQL client:', safeMessage);
});

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await dbPool.connect();
    const result = await client.query('SELECT 1 as health_check');
    client.release();
    return result.rows[0]?.health_check === 1;
  } catch {
    return false;
  }
}

export async function validateDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  database?: string;
  user?: string;
  error?: string;
}> {
  try {
    const client = await dbPool.connect();
    const versionRes = await client.query('SELECT version(), current_database(), current_user;');
    client.release();
    return {
      connected: true,
      version: versionRes.rows[0]?.version,
      database: versionRes.rows[0]?.current_database,
      user: versionRes.rows[0]?.current_user,
    };
  } catch (err: any) {
    const safeError = err.message ? err.message.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@') : 'Connection failed';
    return {
      connected: false,
      error: safeError,
    };
  }
}
