const { dbPool } = require('./dist/database/postgres.client.js');

async function seed() {
  await dbPool.query(`
    INSERT INTO tenants (tenant_id, name, plan_tier, created_at, updated_at)
    VALUES 
      ('TNT-CORP-01', 'Acme Enterprise', 'ENTERPRISE', NOW(), NOW()),
      ('TNT-CORP-02', 'Beta Global Corp', 'ENTERPRISE', NOW(), NOW())
    ON CONFLICT (tenant_id) DO NOTHING;
  `);
  console.log('Seeded default enterprise tenants TNT-CORP-01 and TNT-CORP-02 successfully.');
  await dbPool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
