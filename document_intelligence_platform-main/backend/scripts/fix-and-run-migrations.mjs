import pg from 'pg';
import fs from 'fs';
import path from 'path';

const dbPassword = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('Set POSTGRES_PASSWORD or DB_PASSWORD before running this script.');
const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5434,
  user: 'postgres',
  password: dbPassword,
  database: 'docunexa_sandbox'
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Cleaning up rollback entries from schema_migrations...');
    await client.query("DELETE FROM schema_migrations WHERE migration_id LIKE '%rollback%'");

    // Also re-apply 019 if it was reverted
    const check19 = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'document_versions'");
    if (check19.rows.length === 0) {
      console.log('Re-applying 019_user_invitations_mfa_versioning.sql...');
      const sql19 = fs.readFileSync('src/database/migrations/019_user_invitations_mfa_versioning.sql', 'utf-8');
      await client.query(sql19);
      await client.query("INSERT INTO schema_migrations (migration_id) VALUES ('019_user_invitations_mfa_versioning.sql') ON CONFLICT DO NOTHING");
    }

    // Apply 020 if needed
    const check20 = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'document_summaries'");
    if (check20.rows.length === 0) {
      console.log('Applying 020_mongodb_derived_summaries_email_intake.sql...');
      const sql20 = fs.readFileSync('src/database/migrations/020_mongodb_derived_summaries_email_intake.sql', 'utf-8');
      await client.query(sql20);
      await client.query("INSERT INTO schema_migrations (migration_id) VALUES ('020_mongodb_derived_summaries_email_intake.sql') ON CONFLICT DO NOTHING");
    }

    // Apply 021 if needed
    console.log('Applying 021_fix_outbox_event_types_constraint.sql...');
    const sql21 = fs.readFileSync('src/database/migrations/021_fix_outbox_event_types_constraint.sql', 'utf-8');
    await client.query(sql21);
    await client.query("INSERT INTO schema_migrations (migration_id) VALUES ('021_fix_outbox_event_types_constraint.sql') ON CONFLICT DO NOTHING");

    console.log('All migrations successfully applied!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
