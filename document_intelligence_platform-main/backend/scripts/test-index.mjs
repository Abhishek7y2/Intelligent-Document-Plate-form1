import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
if (!dbPassword) throw new Error('Set DB_PASSWORD or POSTGRES_PASSWORD before running this script.');
const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5434', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: dbPassword,
  database: process.env.DB_DATABASE || 'docunexa_sandbox'
});

async function main() {
  console.log('--- BEFORE INDEX ---');
  let exp = await pool.query(
    "EXPLAIN (ANALYZE, BUFFERS) SELECT document_id, tenant_id, file_name, status, uploaded_at FROM documents WHERE tenant_id = 'TNT-CORP-01' ORDER BY uploaded_at DESC LIMIT 10 OFFSET 0"
  );
  exp.rows.forEach(r => console.log(r['QUERY PLAN']));

  console.log('\n--- CREATING COMPOSITE INDEX idx_documents_tenant_uploaded_at ---');
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_documents_tenant_uploaded_at ON documents (tenant_id, uploaded_at DESC)"
  );

  console.log('\n--- AFTER INDEX ---');
  exp = await pool.query(
    "EXPLAIN (ANALYZE, BUFFERS) SELECT document_id, tenant_id, file_name, status, uploaded_at FROM documents WHERE tenant_id = 'TNT-CORP-01' ORDER BY uploaded_at DESC LIMIT 10 OFFSET 0"
  );
  exp.rows.forEach(r => console.log(r['QUERY PLAN']));

  await pool.end();
}

main().catch(console.error);
