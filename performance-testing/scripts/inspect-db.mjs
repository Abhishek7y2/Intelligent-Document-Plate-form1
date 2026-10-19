import pg from 'pg';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5434,
  user: 'postgres',
  password: '',
  database: 'docunexa_sandbox'
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
