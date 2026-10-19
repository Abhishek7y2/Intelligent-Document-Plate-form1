import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbPass = process.env['POSTGRES_PASSWORD'] || process.env['DB_PASSWORD'];
if (!dbPass) throw new Error('Set POSTGRES_PASSWORD or DB_PASSWORD before running this script.');
const dbPort = process.env['POSTGRES_PORT'] || process.env['DB_PORT'] || '5434';
const dbUser = process.env['POSTGRES_USER'] || process.env['DB_USER'] || 'postgres';
const dbHost = process.env['POSTGRES_HOST'] || process.env['DB_HOST'] || '127.0.0.1';
const dbName = process.env['POSTGRES_DB'] || process.env['DB_DATABASE'] || 'docunexa_sandbox';

const DATABASE_URL =
  process.env['DATABASE_URL'] ||
  process.env['POSTGRES_URL'] ||
  `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}?sslmode=disable`;

const TARGET_DOC_COUNT = parseInt(process.env['SEED_COUNT'] || '5000', 10);
const TENANT_ID = process.env['SEED_TENANT_ID'] || 'tenant-perf-benchmark';
const BATCH_SIZE = 500;

export async function seedTenantData(
  docCount = TARGET_DOC_COUNT,
  tenantId = TENANT_ID
): Promise<{ tenantId: string; totalDocumentsSeeded: number; durationMs: number }> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const startTime = Date.now();

  try {
    const client = await pool.connect();
    try {
      console.log(`[Seed] Starting seed of ${docCount} documents for tenant '${tenantId}'...`);

      // 1. Ensure Tenant Exists
      await client.query(
        `INSERT INTO tenants (tenant_id, name, plan_tier)
         VALUES ($1, 'Performance Loadtest Benchmark Tenant', 'ENTERPRISE')
         ON CONFLICT (tenant_id) DO NOTHING;`,
        [tenantId]
      );

      // 2. Ensure Test User Exists
      await client.query(
        `INSERT INTO users (user_id, tenant_id, email, full_name, role, password_hash)
         VALUES ('user-perf-admin', $1, 'admin@perf-benchmark.local', 'Perf Test Admin', 'Admin', '$2a$10$abcdefghijklmnopqrstuv')
         ON CONFLICT (email) DO NOTHING;`,
        [tenantId]
      );

      // 3. Batch Insert Documents
      const docTypes = ['invoice', 'contract', 'purchase_order', 'receipt', 'financial_statement'];
      const statuses = ['STP_PROCESSED', 'NEEDS_REVIEW', 'APPROVED', 'QUEUED', 'PROCESSING'];
      const slaStatuses = ['ON_TRACK', 'WARNING', 'BREACHED'];

      let seededCount = 0;
      for (let batchStart = 0; batchStart < docCount; batchStart += BATCH_SIZE) {
        const currentBatchSize = Math.min(BATCH_SIZE, docCount - batchStart);
        const values: any[] = [];
        const placeholders: string[] = [];

        for (let i = 0; i < currentBatchSize; i++) {
          const docNum = batchStart + i + 1;
          const docId = `doc-perf-${docNum}-${crypto.randomBytes(4).toString('hex')}`;
          const type = docTypes[docNum % docTypes.length];
          const status = statuses[docNum % statuses.length];
          const sla = slaStatuses[docNum % slaStatuses.length];
          const sha256 = crypto.createHash('sha256').update(`${tenantId}-${docNum}-${Date.now()}-${Math.random()}`).digest('hex');
          const fileName = `${type}_2026_${docNum}.pdf`;
          const filePath = `s3://docunexa-documents/${tenantId}/${docId}/${fileName}`;
          const fileSize = 15000 + (docNum % 250000);
          const pageCount = (docNum % 20) + 1;
          const confidence = Number((0.85 + (docNum % 15) * 0.01).toFixed(4));
          const daysAgo = docNum % 60;
          const uploadedAt = new Date(Date.now() - daysAgo * 86400000 - (docNum % 86400) * 1000);

          const paramOffset = i * 14;
          placeholders.push(
            `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8}, $${paramOffset + 9}, $${paramOffset + 10}, $${paramOffset + 11}, $${paramOffset + 12}, $${paramOffset + 13}, $${paramOffset + 14})`
          );

          values.push(
            docId,
            tenantId,
            fileName,
            filePath,
            fileSize,
            'application/pdf',
            sha256,
            type,
            status,
            'COMPLETED',
            confidence,
            sla,
            'BATCH_SEED',
            pageCount
          );
        }

        const insertQuery = `
          INSERT INTO documents (
            document_id, tenant_id, file_name, file_path, file_size_bytes,
            mime_type, sha256_hash, document_type, status, stage,
            confidence_score, sla_status, ingestion_source, page_count
          )
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (document_id) DO NOTHING;
        `;

        await client.query(insertQuery, values);
        seededCount += currentBatchSize;
        if (seededCount % 1000 === 0 || seededCount === docCount) {
          console.log(`[Seed] Progress: ${seededCount} / ${docCount} documents inserted.`);
        }
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Seed] Successfully seeded ${seededCount} documents in ${durationMs}ms.`);
      return { tenantId, totalDocumentsSeeded: seededCount, durationMs };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

seedTenantData()
  .then((res) => {
    console.log('[Seed] Done:', res);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
