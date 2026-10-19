import pg from 'pg';
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
  const res = await pool.query('SELECT * FROM schema_migrations ORDER BY 1');
  console.log('Applied migrations:', res.rows);
  const con = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'outbox_events'::regclass");
  console.log('outbox_events constraints:', con.rows);
  await pool.end();
}
main().catch(console.error);
