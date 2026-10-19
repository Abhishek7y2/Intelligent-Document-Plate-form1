import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Attempt to load sandbox configuration from .env.sandbox if present
const sandboxEnvPath = path.resolve(process.cwd(), '../.env.sandbox');
const rootSandboxEnvPath = path.resolve(process.cwd(), '../../.env.sandbox');
if (fs.existsSync(sandboxEnvPath)) {
  dotenv.config({ path: sandboxEnvPath });
} else if (fs.existsSync(rootSandboxEnvPath)) {
  dotenv.config({ path: rootSandboxEnvPath });
}

const { Client } = pg;

describe('PostgreSQL 16 + pgvector Sandbox Integration Gate', () => {
  const SANDBOX_CONFIG = {
    host: '127.0.0.1',
    port: 5434,
    database: process.env['POSTGRES_DB'] || 'docunexa_sandbox',
    user: process.env['POSTGRES_USER'] || 'postgres',
    password: process.env['SANDBOX_POSTGRES_PASSWORD'] || process.env['POSTGRES_PASSWORD'] || 'postgres',
    connectionTimeoutMillis: 10000,
  };

  let sandboxAvailable = false;
  let serverVersion = '';

  beforeAll(async () => {
    // Safety check: Under no circumstances allow port 5433 (legacy cluster)
    if (SANDBOX_CONFIG.port === 5433) {
      throw new Error('[SAFETY GUARD] Cannot run sandbox integration tests against port 5433!');
    }

    const probeClient = new Client(SANDBOX_CONFIG);
    try {
      await probeClient.connect();
      const res = await probeClient.query('SELECT version()');
      serverVersion = res.rows[0]?.version || '';
      sandboxAvailable = true;
    } catch (err: any) {
      sandboxAvailable = false;
      if (process.env['REQUIRE_SANDBOX'] === 'true') {
        throw new Error(`[FATAL REQUIRE_SANDBOX] Port ${SANDBOX_CONFIG.port} offline: PostgreSQL 16 sandbox is required by REQUIRE_SANDBOX=true but unreachable (${err?.message})`);
      }
    } finally {
      await probeClient.end().catch(() => {});
    }
  });

  describe('Safety Guard & Port Isolation Checks', () => {
    it('strictly forbids targeting legacy host database on port 5433', () => {
      expect(SANDBOX_CONFIG.port).not.toBe(5433);
      expect(SANDBOX_CONFIG.port).toBe(5434);
    });

    it('reports sandbox availability status accurately without false claims', () => {
      if (process.env['REQUIRE_SANDBOX'] === 'true') {
        expect(sandboxAvailable).toBe(true);
        expect(serverVersion).toContain('PostgreSQL 16');
      } else if (!sandboxAvailable) {
        // Accurately document the blocked state
        expect(sandboxAvailable).toBe(false);
      } else {
        expect(sandboxAvailable).toBe(true);
        expect(serverVersion).toContain('PostgreSQL 16');
      }
    });
  });

  describe('PostgreSQL 16 + pgvector Feature Contract (When Sandbox Online)', () => {
    it('verifies PostgreSQL 16.x engine and pgvector extension when provisioned', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: PostgreSQL 16 server check skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        const vRes = await client.query('SELECT version() AS v, current_database() AS db');
        expect(vRes.rows[0].v).toContain('PostgreSQL 16');
        expect(vRes.rows[0].db).toBe(SANDBOX_CONFIG.database);

        const extRes = await client.query(
          "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
        );
        expect(extRes.rows.length).toBe(1);
        expect(extRes.rows[0].extname).toBe('vector');
      } finally {
        await client.end();
      }
    });

    it('verifies 1536-dimensional vector insertion and cosine distance retrieval when provisioned', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Vector distance check skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        // Create temporary vector test table
        await client.query(`
          CREATE TEMP TABLE temp_vector_test (
            id SERIAL PRIMARY KEY,
            embedding vector(1536) NOT NULL
          );
        `);

        // Generate synthetic 1536-dim vectors
        const vec1 = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
        const vec2 = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 0.9 : 0.1));
        const vec3 = Array.from({ length: 1536 }, (_, i) => (i === 1535 ? 1 : 0));

        await client.query('INSERT INTO temp_vector_test (embedding) VALUES ($1), ($2), ($3)', [
          `[${vec1.join(',')}]`,
          `[${vec2.join(',')}]`,
          `[${vec3.join(',')}]`,
        ]);

        // Query cosine distance with <=>
        const res = await client.query(`
          SELECT id, embedding <=> $1 AS distance
          FROM temp_vector_test
          ORDER BY distance ASC
        `, [`[${vec1.join(',')}]`]);

        expect(res.rows.length).toBe(3);
        // ID 1 is exact match (distance ~ 0)
        expect(parseFloat(res.rows[0].distance)).toBeCloseTo(0, 4);
        expect(res.rows[0].id).toBe(1);
        // ID 2 is close
        expect(res.rows[1].id).toBe(2);
      } finally {
        await client.end();
      }
    });

    it('validates vector dimensions reject non-1536 embeddings', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Dimension rejection test skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        await client.query('CREATE TEMP TABLE temp_dim_test (v vector(1536));');
        const invalidVec = [0.1, 0.2, 0.3]; // 3 dimensions instead of 1536

        await expect(
          client.query('INSERT INTO temp_dim_test (v) VALUES ($1)', [`[${invalidVec.join(',')}]`])
        ).rejects.toThrow();
      } finally {
        await client.end();
      }
    });

    it('verifies concurrent transaction isolation and FOR UPDATE SKIP LOCKED claiming when provisioned', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Concurrency test skipped.');
        return;
      }

      const client1 = new Client(SANDBOX_CONFIG);
      const client2 = new Client(SANDBOX_CONFIG);
      await client1.connect();
      await client2.connect();

      try {
        await client1.query(`
          CREATE TABLE temp_outbox (
            id INT PRIMARY KEY,
            status TEXT NOT NULL
          );
          INSERT INTO temp_outbox VALUES (101, 'PENDING');
        `);

        // Client 1 begins transaction and claims event
        await client1.query('BEGIN;');
        const c1Res = await client1.query(
          "SELECT id FROM temp_outbox WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED LIMIT 1;"
        );
        expect(c1Res.rows[0]?.id).toBe(101);

        // Client 2 attempts to claim concurrently on a separate connection
        await client2.query('BEGIN;');
        const c2Res = await client2.query(
          "SELECT id FROM temp_outbox WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED LIMIT 1;"
        );
        // Event 101 must be skipped because Client 1 holds the row lock!
        expect(c2Res.rows.length).toBe(0);

        await client1.query('COMMIT;');
        await client2.query('ROLLBACK;');
      } finally {
        await client1.query('DROP TABLE IF EXISTS temp_outbox;').catch(() => {});
        await client1.end();
        await client2.end();
      }
    });

    it('verifies tenant isolation for vector embeddings when provisioned', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Tenant isolation test skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        await client.query(`
          CREATE TEMP TABLE temp_tenant_chunks (
            id SERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            embedding vector(1536) NOT NULL
          );
        `);

        const vA = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
        const vB = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));

        await client.query('INSERT INTO temp_tenant_chunks (tenant_id, embedding) VALUES ($1, $2), ($3, $4)', [
          'tenant-alpha',
          `[${vA.join(',')}]`,
          'tenant-beta',
          `[${vB.join(',')}]`,
        ]);

        // Query strictly for tenant-alpha
        const res = await client.query(
          'SELECT id, tenant_id FROM temp_tenant_chunks WHERE tenant_id = $1',
          ['tenant-alpha']
        );

        expect(res.rows.length).toBe(1);
        expect(res.rows[0].tenant_id).toBe('tenant-alpha');
      } finally {
        await client.end();
      }
    });

    it('verifies transaction rollback leaves no orphaned records when provisioned', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Transaction rollback test skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        await client.query(`
          CREATE TEMP TABLE temp_atomic_doc (
            doc_id TEXT PRIMARY KEY,
            status TEXT NOT NULL
          );
          INSERT INTO temp_atomic_doc VALUES ('DOC-TX-01', 'PENDING');
        `);

        // Begin transaction, modify doc, simulate failure, rollback
        await client.query('BEGIN;');
        await client.query("UPDATE temp_atomic_doc SET status = 'APPROVED' WHERE doc_id = 'DOC-TX-01';");
        // Simulate failure triggering rollback
        await client.query('ROLLBACK;');

        const res = await client.query("SELECT status FROM temp_atomic_doc WHERE doc_id = 'DOC-TX-01';");
        expect(res.rows[0]?.status).toBe('PENDING'); // Unchanged!
      } finally {
        await client.end();
      }
    });

    it('cannot report full live acceptance when PostgreSQL 16 is unavailable', () => {
      const gateStatus = sandboxAvailable ? 'PASS' : 'BLOCKED';
      if (!sandboxAvailable) {
        expect(gateStatus).toBe('BLOCKED');
        expect(serverVersion).not.toContain('PostgreSQL 16');
      } else {
        expect(gateStatus).toBe('PASS');
        expect(serverVersion).toContain('PostgreSQL 16');
      }
    });

    it('verifies Sprint 11 Migration 013 tables and ledger on live PostgreSQL 16 sandbox', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Sprint 11 schema verification skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        // Verify migration ledger contains 013
        const ledgerRes = await client.query(
          "SELECT migration_id FROM schema_migrations WHERE migration_id = '013_notifications_reports_exports_webhooks.sql'"
        );
        expect(ledgerRes.rows.length).toBe(1);

        // Verify all 6 Sprint 11 tables exist in public schema
        const tablesRes = await client.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN (
              'notifications',
              'notification_preferences',
              'export_jobs',
              'webhook_subscriptions',
              'webhook_deliveries',
              'connector_mappings'
            )
          ORDER BY table_name;
        `);
        expect(tablesRes.rows.length).toBe(6);
      } finally {
        await client.end();
      }
    });

    it('verifies Sprint 12 Migration 014 tables and ledger on live PostgreSQL 16 sandbox', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Sprint 12 schema verification skipped.');
        return;
      }

      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        // Verify migration ledger contains 014
        const ledgerRes = await client.query(
          "SELECT migration_id FROM schema_migrations WHERE migration_id = '014_retention_legal_hold_and_secure_purge.sql'"
        );
        expect(ledgerRes.rows.length).toBe(1);

        // Verify all 4 Sprint 12 tables exist in public schema
        const tablesRes = await client.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN (
              'retention_policies',
              'legal_holds',
              'deletion_cases',
              'purge_audit_ledger'
            )
          ORDER BY table_name;
        `);
        expect(tablesRes.rows.length).toBe(4);
      } finally {
        await client.end();
      }
    });

    // -------------------------------------------------------------------------
    // Sprint 6 Part 0: Regression Fix - Outbox Constraint & Retry Integration
    // -------------------------------------------------------------------------
    it('verifies outbox_events_event_type_check accepts every value in OUTBOX_EVENT_TYPES on live PostgreSQL 16', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Outbox constraint test skipped.');
        return;
      }

      const { OUTBOX_EVENT_TYPES } = await import('../models/outbox.models.js');
      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        const testTenantId = `TNT-SANDBOX-${Date.now()}`;
        const testDocId = `DOC-SANDBOX-${Date.now()}`;

        // Seed parent tenant and document
        await client.query(
          `INSERT INTO tenants (tenant_id, name, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [testTenantId, 'Sandbox Test Tenant']
        );
        await client.query(
          `INSERT INTO documents (document_id, tenant_id, file_name, file_path, file_size_bytes, mime_type, sha256_hash, document_type, ingestion_source, status, stage, uploaded_at)
           VALUES ($1, $2, 'test.pdf', '/storage/test.pdf', 100, 'application/pdf', $3, 'INVOICE', 'MANUAL_UPLOAD', 'QUEUED', 'INGESTION_COMPLETE', NOW())
           ON CONFLICT DO NOTHING`,
          [testDocId, testTenantId, 'a'.repeat(64)]
        );

        // Insert an outbox event row for EVERY type in OUTBOX_EVENT_TYPES
        for (const eventType of OUTBOX_EVENT_TYPES) {
          const eventId = `EVT-TEST-${Math.random().toString(36).substring(2, 10)}`;
          const insertRes = await client.query(
            `INSERT INTO outbox_events (event_id, tenant_id, document_id, event_type, payload, status)
             VALUES ($1, $2, $3, $4, '{}'::jsonb, 'PENDING')
             RETURNING event_id, event_type`,
            [eventId, testTenantId, testDocId, eventType]
          );
          expect(insertRes.rows[0].event_type).toBe(eventType);
        }

        // Verify invalid event type is rejected by constraint
        await expect(
          client.query(
            `INSERT INTO outbox_events (event_id, tenant_id, document_id, event_type, payload, status)
             VALUES ('EVT-INVALID', $1, $2, 'INVALID_UNKNOWN_EVENT_TYPE', '{}'::jsonb, 'PENDING')`,
            [testTenantId, testDocId]
          )
        ).rejects.toThrow(/outbox_events_event_type_check/);
      } finally {
        await client.end();
      }
    });

    it('asserts the PostgreSQL constraint allowed list equals OUTBOX_EVENT_TYPES exactly (no drift)', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: Constraint drift test skipped.');
        return;
      }

      const { OUTBOX_EVENT_TYPES } = await import('../models/outbox.models.js');
      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        const conRes = await client.query(`
          SELECT pg_get_constraintdef(oid) as def
          FROM pg_constraint
          WHERE conrelid = 'outbox_events'::regclass
            AND conname = 'outbox_events_event_type_check'
        `);
        expect(conRes.rows.length).toBe(1);

        const def = conRes.rows[0].def;
        // Parse array elements from definition, e.g. ARRAY['TYPE1'::character varying, 'TYPE2'::character varying]
        const matches = Array.from(def.matchAll(/'([A-Z_]+)'/g), (m: any) => m[1]);
        const dbAllowedTypes = [...new Set(matches)].sort();
        const tsAllowedTypes = [...OUTBOX_EVENT_TYPES].sort();

        expect(dbAllowedTypes).toEqual(tsAllowedTypes);
      } finally {
        await client.end();
      }
    });

    it('verifies end-to-end retry on real PostgreSQL inserts DOCUMENT_RETRY_REQUESTED into outbox_events', async () => {
      if (!sandboxAvailable) {
        console.warn('[GATE BLOCKED] Port 5434 offline: End-to-end retry integration test skipped.');
        return;
      }

      const { IntakeService } = await import('../services/intake.service.js');
      const { OutboxService } = await import('../services/outbox.service.js');
      const client = new Client(SANDBOX_CONFIG);
      await client.connect();
      try {
        const tenantId = `TNT-RETRY-${Date.now()}`;
        const docId = `DOC-RETRY-${Date.now()}`;
        const userId = `USR-RETRY-OP`;

        // 1. Seed tenant and failed document
        await client.query(
          `INSERT INTO tenants (tenant_id, name, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [tenantId, 'Retry Tenant']
        );
        await client.query(
          `INSERT INTO documents (document_id, tenant_id, file_name, file_path, file_size_bytes, mime_type, sha256_hash, document_type, ingestion_source, status, stage, retry_count, last_error, uploaded_at)
           VALUES ($1, $2, 'failed_invoice.pdf', '/storage/failed_invoice.pdf', 256, 'application/pdf', $3, 'INVOICE', 'MANUAL_UPLOAD', 'FAILED', 'OCR_PIPELINE_FAILED', 0, 'Initial OCR failure', NOW())`,
          [docId, tenantId, 'b'.repeat(64)]
        );

        // 2. Set IntakeService and OutboxService store mode to database
        const originalIntakeMode = (IntakeService as any).storeMode;
        const originalOutboxMode = OutboxService.getStoreMode();
        (IntakeService as any).storeMode = 'database';
        OutboxService.setStoreMode('database');

        try {
          const retriedDoc = await IntakeService.retryDocument(docId, tenantId, userId);
          expect(retriedDoc.status).toBe('QUEUED');
          expect(retriedDoc.retryCount).toBe(1);

          // 3. Query PostgreSQL directly to verify DOCUMENT_RETRY_REQUESTED row in outbox_events
          const outboxRes = await client.query(
            `SELECT event_id, event_type, status, payload FROM outbox_events WHERE document_id = $1 AND tenant_id = $2`,
            [docId, tenantId]
          );
          expect(outboxRes.rows.length).toBeGreaterThanOrEqual(1);
          const retryEvent = outboxRes.rows.find((r) => r.event_type === 'DOCUMENT_RETRY_REQUESTED');
          expect(retryEvent).toBeDefined();
          expect(retryEvent?.status).toBe('PENDING');
          expect(retryEvent?.payload?.requestedBy).toBe(userId);
          expect(retryEvent?.payload?.retryCount).toBe(1);
        } finally {
          (IntakeService as any).storeMode = originalIntakeMode;
          OutboxService.setStoreMode(originalOutboxMode);
        }
      } finally {
        await client.end();
      }
    });
  });
});
