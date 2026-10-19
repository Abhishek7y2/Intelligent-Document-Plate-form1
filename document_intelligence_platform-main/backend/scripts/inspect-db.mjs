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
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('--- TABLES IN docunexa_sandbox ---');
  for (const row of tables.rows) {
    const countRes = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
    const idxRes = await pool.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1",
      [row.table_name]
    );
    console.log(`\nTable: ${row.table_name} (Row count: ${countRes.rows[0].count})`);
    for (const idx of idxRes.rows) {
      console.log(`  - Index: ${idx.indexname}`);
      console.log(`    Def:   ${idx.indexdef}`);
    }
  }

  // Also check EXPLAIN on /search query
  console.log('\n--- EXPLAIN (ANALYZE, BUFFERS) ON DOCUMENTS SEARCH ---');
  const searchExplain = await pool.query(
    "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM documents WHERE tenant_id = 'TNT-CORP-01' ORDER BY uploaded_at DESC LIMIT 10 OFFSET 0"
  );
  for (const line of searchExplain.rows) {
    console.log(line['QUERY PLAN']);
  }

  await pool.end();
}

main().catch(console.error);
