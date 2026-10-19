import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function main() {
  console.log('[MIGRATION & ROLLBACK DRILL] Starting automated verification...');

  const config = {
    host: process.env['POSTGRES_HOST'] || '127.0.0.1',
    port: parseInt(process.env['POSTGRES_PORT'] || '5434', 10),
    database: process.env['POSTGRES_DB'] || 'docunexa_sandbox',
    user: process.env['POSTGRES_USER'] || 'postgres',
    password: process.env['POSTGRES_PASSWORD'] || 'postgres',
    connectionTimeoutMillis: 10000,
  };

  const client = new Client(config);
  await client.connect();

  try {
    const migrationsDir = path.resolve(process.cwd(), 'src/database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const allFiles = fs.readdirSync(migrationsDir);
    const forwardFiles = allFiles
      .filter((f) => f.endsWith('.sql') && !f.toLowerCase().includes('rollback'))
      .sort();
    const rollbackFiles = allFiles
      .filter((f) => f.endsWith('.sql') && f.toLowerCase().includes('rollback'))
      .sort()
      .reverse(); // Reverse order for rollbacks!

    console.log(`Found ${forwardFiles.length} forward migrations and ${rollbackFiles.length} rollback migrations.`);

    // 1. Ensure schema_migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Execute forward migrations
    console.log('\n--- PHASE 1: Applying all forward migrations ---');
    for (const file of forwardFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying forward migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_id) VALUES ($1) ON CONFLICT (migration_id) DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed applying forward migration ${file}: ${(err as any).message}`);
      }
    }
    console.log('Phase 1 completed successfully.');

    // 3. Execute rollback migrations in reverse order
    console.log('\n--- PHASE 2: Applying rollback migrations in reverse order ---');
    for (const file of rollbackFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying rollback migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        // Find corresponding forward migration id to remove from schema_migrations
        const baseNum = file.match(/^\d+/)?.[0];
        if (baseNum) {
          await client.query(
            "DELETE FROM schema_migrations WHERE migration_id LIKE $1",
            [`${baseNum}%`]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed applying rollback migration ${file}: ${(err as any).message}`);
      }
    }
    console.log('Phase 2 rollback completed successfully.');

    // 4. Re-apply forward migrations
    console.log('\n--- PHASE 3: Re-applying forward migrations to restore full schema ---');
    const appliedRes = await client.query('SELECT migration_id FROM schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r: any) => r.migration_id));

    for (const file of forwardFiles) {
      if (appliedSet.has(file)) {
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Re-applying forward migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_id) VALUES ($1) ON CONFLICT (migration_id) DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed re-applying forward migration ${file}: ${(err as any).message}`);
      }
    }
    console.log('Phase 3 forward restoration completed successfully.');

    // 5. Final integrity check
    const tablesRes = await client.query(`
      SELECT count(*) as total_tables 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`\n[SUCCESS] Migration and Rollback verification completed. Total public tables/views: ${tablesRes.rows[0].total_tables}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[FATAL] Migration & Rollback verification failed:', err);
  process.exit(1);
});
