import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb+srv://sou_db_user:Icz3JvSnEIqw4qtK@cluster0.l4rdehi.mongodb.net/?appName=Cluster0';
const TARGET_DB = process.env.MONGO_DB || 'docunexa';

async function main() {
  console.log('=====================================================');
  console.log(`Connecting to MongoDB Atlas at: ${URI.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log(`Target Database: ${TARGET_DB}`);
  console.log('=====================================================');

  const client = new MongoClient(URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas successfully.');

    // -----------------------------------------------------------------
    // STEP 1: Erase old stale data from databases on this cluster
    // -----------------------------------------------------------------
    console.log('\n--- STEP 1: Erasing stale data from server ---');

    // 1a. Drop all collections in "test" if it exists (contains stale legacy collections)
    const testDb = client.db('test');
    const testCollections = await testDb.listCollections().toArray();
    console.log(`Found ${testCollections.length} collections in 'test' database to erase.`);
    for (const col of testCollections) {
      await testDb.collection(col.name).drop();
      console.log(`  - Dropped test.${col.name}`);
    }

    // 1b. Drop all collections in target database (TARGET_DB) to start fresh
    const targetDb = client.db(TARGET_DB);
    const existingTargetCols = await targetDb.listCollections().toArray();
    console.log(`Found ${existingTargetCols.length} existing collections in '${TARGET_DB}' to erase.`);
    for (const col of existingTargetCols) {
      await targetDb.collection(col.name).drop();
      console.log(`  - Dropped ${TARGET_DB}.${col.name}`);
    }

    // -----------------------------------------------------------------
    // STEP 2: Create schemas and collections as per BRD & Sprint 5
    // -----------------------------------------------------------------
    console.log('\n--- STEP 2: Creating collections with BRD JSON Schema validation ---');

    // 1. ocr_pages schema
    const ocrPagesSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'source_version_id', 'analysis_version', 'model_version', 'created_at'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant isolation identifier (mandatory)' },
          document_id: { bsonType: 'string', description: 'Document identifier' },
          source_version_id: { bsonType: 'string', description: 'Source document version ID' },
          analysis_version: { bsonType: 'string', description: 'Version of pipeline used' },
          model_version: { bsonType: 'string', description: 'AI/OCR model version identifier' },
          created_at: { bsonType: 'date', description: 'Creation timestamp' },
          page_number: { bsonType: ['int', 'long', 'double'], description: '1-indexed page number' },
          width: { bsonType: ['int', 'long', 'double'], description: 'Page width in pixels/points' },
          height: { bsonType: ['int', 'long', 'double'], description: 'Page height in pixels/points' },
          dpi: { bsonType: ['int', 'long', 'double'], description: 'Rasterization DPI' },
          confidence: { bsonType: ['int', 'long', 'double'], description: 'Confidence score (0.0 to 1.0)' },
          page_text: { bsonType: 'string', description: 'Extracted raw OCR text for page' },
          tokens: { bsonType: 'array', description: 'Array of spatial token bounding boxes' },
        },
      },
    };

    // 2. extraction_runs schema
    const extractionRunsSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'source_version_id', 'analysis_version', 'model_version', 'created_at'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant isolation identifier (mandatory)' },
          document_id: { bsonType: 'string', description: 'Document identifier' },
          source_version_id: { bsonType: 'string', description: 'Source document version ID' },
          analysis_version: { bsonType: 'string', description: 'Version of pipeline used' },
          model_version: { bsonType: 'string', description: 'AI model version identifier' },
          created_at: { bsonType: 'date', description: 'Creation timestamp' },
          run_id: { bsonType: 'string', description: 'Extraction run identifier' },
          template_id: { bsonType: 'string', description: 'Associated document schema template' },
          status: { bsonType: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], description: 'Run status' },
          entities: { bsonType: 'object', description: 'Extracted key-value entities dictionary' },
          confidence: { bsonType: ['int', 'long', 'double'], description: 'Overall extraction confidence' },
        },
      },
    };

    // 3. clause_diffs schema
    const clauseDiffsSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'source_version_id', 'analysis_version', 'model_version', 'created_at'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant isolation identifier (mandatory)' },
          document_id: { bsonType: 'string', description: 'Source document identifier' },
          source_version_id: { bsonType: 'string', description: 'Source document version ID' },
          analysis_version: { bsonType: 'string', description: 'Version of pipeline used' },
          model_version: { bsonType: 'string', description: 'AI model version identifier' },
          created_at: { bsonType: 'date', description: 'Creation timestamp' },
          compare_document_id: { bsonType: 'string', description: 'Target document identifier for diff' },
          diff_type: { bsonType: 'string', description: 'Semantic or syntactic diff classification' },
          changes: { bsonType: 'array', description: 'List of detected clause changes/additions/deletions' },
        },
      },
    };

    // 4. qa_traces schema
    const qaTracesSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'source_version_id', 'analysis_version', 'model_version', 'created_at'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant isolation identifier (mandatory)' },
          document_id: { bsonType: 'string', description: 'Document identifier' },
          source_version_id: { bsonType: 'string', description: 'Source document version ID' },
          analysis_version: { bsonType: 'string', description: 'Version of pipeline used' },
          model_version: { bsonType: 'string', description: 'AI model version identifier' },
          created_at: { bsonType: 'date', description: 'Creation timestamp' },
          query: { bsonType: 'string', description: 'User Q&A query text' },
          response: { bsonType: 'string', description: 'AI model generated answer' },
          evidence: { bsonType: 'array', description: 'Grounded citation snippets and page coordinates' },
          latency_ms: { bsonType: ['int', 'long', 'double'], description: 'Query execution latency in milliseconds' },
        },
      },
    };

    // 5. evaluation_runs schema
    const evaluationRunsSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'source_version_id', 'analysis_version', 'model_version', 'created_at'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant isolation identifier (mandatory)' },
          document_id: { bsonType: 'string', description: 'Document identifier' },
          source_version_id: { bsonType: 'string', description: 'Source document version ID' },
          analysis_version: { bsonType: 'string', description: 'Version of pipeline used' },
          model_version: { bsonType: 'string', description: 'AI model version identifier' },
          created_at: { bsonType: 'date', description: 'Creation timestamp' },
          benchmark_id: { bsonType: 'string', description: 'Evaluation benchmark test suite ID' },
          accuracy_score: { bsonType: ['int', 'long', 'double'], description: 'Accuracy rating (0.0 to 1.0)' },
          metrics: { bsonType: 'object', description: 'Precision, recall, and F1 performance metrics' },
        },
      },
    };

    // 6. unstructured_payloads schema (from docs/DATABASE_SCHEMA_MONGODB.json)
    const unstructuredPayloadsSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenant_id', 'document_id', 'version', 'rawJson'],
        properties: {
          tenant_id: { bsonType: 'string', description: 'Tenant identifier' },
          document_id: { bsonType: 'string', description: 'Document identifier' },
          version: { bsonType: ['int', 'long', 'double'], description: 'Document revision version' },
          rawJson: { bsonType: 'object', description: 'Raw document payload structure' },
          extractedEntities: { bsonType: 'object', description: 'Extracted business entities' },
          clauseVectors: { bsonType: 'array', description: 'Embedded clause vectors' },
          createdAt: { bsonType: 'date', description: 'Timestamp' },
        },
      },
    };

    const collectionsToCreate = [
      { name: 'ocr_pages', validator: ocrPagesSchema },
      { name: 'extraction_runs', validator: extractionRunsSchema },
      { name: 'clause_diffs', validator: clauseDiffsSchema },
      { name: 'qa_traces', validator: qaTracesSchema },
      { name: 'evaluation_runs', validator: evaluationRunsSchema },
      { name: 'unstructured_payloads', validator: unstructuredPayloadsSchema },
    ];

    for (const colDef of collectionsToCreate) {
      await targetDb.createCollection(colDef.name, {
        validator: colDef.validator,
        validationLevel: 'moderate',
        validationAction: 'error',
      });
      console.log(`  + Created collection '${colDef.name}' with strict BRD JSON Schema validation.`);
    }

    // -----------------------------------------------------------------
    // STEP 3: Create compound indexes on target database
    // -----------------------------------------------------------------
    console.log('\n--- STEP 3: Creating compound indexes as per BRD & Sprint 5 ---');

    await targetDb.collection('ocr_pages').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_ocr_pages_tenant_doc_time' }
    );
    await targetDb.collection('ocr_pages').createIndex(
      { tenant_id: 1, document_id: 1, page_number: 1 },
      { name: 'idx_ocr_pages_tenant_doc_page' }
    );
    console.log('  + Indexes created for ocr_pages');

    await targetDb.collection('extraction_runs').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_extraction_runs_tenant_doc_time' }
    );
    console.log('  + Indexes created for extraction_runs');

    await targetDb.collection('clause_diffs').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_clause_diffs_tenant_doc_time' }
    );
    console.log('  + Indexes created for clause_diffs');

    await targetDb.collection('qa_traces').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_qa_traces_tenant_doc_time' }
    );
    console.log('  + Indexes created for qa_traces');

    await targetDb.collection('evaluation_runs').createIndex(
      { tenant_id: 1, created_at: -1 },
      { name: 'idx_evaluation_runs_tenant_time' }
    );
    await targetDb.collection('evaluation_runs').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_evaluation_runs_tenant_doc_time' }
    );
    console.log('  + Indexes created for evaluation_runs');

    await targetDb.collection('unstructured_payloads').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_unstructured_tenant_doc_time' }
    );
    console.log('  + Indexes created for unstructured_payloads');

    // -----------------------------------------------------------------
    // STEP 4: Store standard BRD-compliant data records
    // -----------------------------------------------------------------
    console.log('\n--- STEP 4: Storing verified BRD documents in MongoDB ---');

    const sampleTenant = 'tenant-docunexa-enterprise-001';
    const sampleDocId = 'doc-inv-2026-98421';
    const sampleVersionId = 'ver-v1-initial-upload';
    const now = new Date();

    // 4a. OCR Page sample
    const sampleOcrPage = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      source_version_id: sampleVersionId,
      analysis_version: '1.2.0',
      model_version: 'tesseract-5.5.0-poppler',
      created_at: now,
      page_number: 1,
      width: 2480,
      height: 3508,
      dpi: 300,
      confidence: 0.985,
      page_text: 'TAX INVOICE\nDocuNexa Enterprise Technologies Inc.\nInvoice Number: INV-2026-98421\nTotal Amount: $14,250.00\nPayment Terms: Net 30\nDue Date: 2026-11-15',
      tokens: [
        { id: 'w-1-1', text: 'TAX', confidence: 0.99, bbox: [120, 150, 80, 30] },
        { id: 'w-1-2', text: 'INVOICE', confidence: 0.99, bbox: [210, 150, 160, 30] },
        { id: 'w-1-3', text: 'DocuNexa', confidence: 0.98, bbox: [120, 200, 190, 28] },
        { id: 'w-1-4', text: 'Enterprise', confidence: 0.98, bbox: [320, 200, 210, 28] },
        { id: 'w-1-5', text: 'INV-2026-98421', confidence: 0.99, bbox: [450, 300, 260, 28] },
        { id: 'w-1-6', text: '$14,250.00', confidence: 0.99, bbox: [450, 350, 180, 28] },
      ],
    };
    await targetDb.collection('ocr_pages').insertOne(sampleOcrPage);
    console.log(`  + Inserted document into 'ocr_pages' (page 1)`);

    // 4b. Extraction Run sample
    const sampleExtractionRun = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      source_version_id: sampleVersionId,
      analysis_version: '1.2.0',
      model_version: 'gemini-1.5-flash-docunexa-tuned',
      created_at: now,
      run_id: 'run-ext-77312',
      template_id: 'tmpl-commercial-invoice-v2',
      status: 'COMPLETED',
      entities: {
        invoice_number: 'INV-2026-98421',
        vendor_name: 'DocuNexa Enterprise Technologies Inc.',
        total_amount: 14250.0,
        currency: 'USD',
        due_date: '2026-11-15',
        payment_terms: 'Net 30',
        line_items_count: 5,
      },
      confidence: 0.978,
    };
    await targetDb.collection('extraction_runs').insertOne(sampleExtractionRun);
    console.log(`  + Inserted document into 'extraction_runs' (run-ext-77312)`);

    // 4c. Clause Diff sample
    const sampleClauseDiff = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      source_version_id: sampleVersionId,
      analysis_version: '1.2.0',
      model_version: 'semantic-diff-bert-v2',
      created_at: now,
      compare_document_id: 'doc-inv-standard-template-v1',
      diff_type: 'SEMANTIC_RISK_DIFF',
      changes: [
        {
          clause_type: 'LIMITATION_OF_LIABILITY',
          severity: 'MEDIUM',
          original_text: 'Standard liability cap equal to 12 months fees paid.',
          revised_text: 'Liability cap capped at 3x aggregate fees paid under this Order.',
          deviation_score: 0.42,
        },
        {
          clause_type: 'GOVERNING_LAW',
          severity: 'LOW',
          original_text: 'State of Delaware',
          revised_text: 'State of New York',
          deviation_score: 0.15,
        },
      ],
    };
    await targetDb.collection('clause_diffs').insertOne(sampleClauseDiff);
    console.log(`  + Inserted document into 'clause_diffs'`);

    // 4d. Q&A Trace sample
    const sampleQaTrace = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      source_version_id: sampleVersionId,
      analysis_version: '1.2.0',
      model_version: 'rag-gemini-pro-retrieval-v3',
      created_at: now,
      query: 'What is the total invoice amount and when is it due?',
      response: 'The total invoice amount is $14,250.00 USD, and the payment is due on November 15, 2026 under Net 30 terms.',
      evidence: [
        { page_number: 1, quote: 'Total Amount: $14,250.00', confidence: 0.99 },
        { page_number: 1, quote: 'Due Date: 2026-11-15', confidence: 0.98 },
      ],
      latency_ms: 385,
    };
    await targetDb.collection('qa_traces').insertOne(sampleQaTrace);
    console.log(`  + Inserted document into 'qa_traces'`);

    // 4e. Evaluation Run sample
    const sampleEvaluationRun = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      source_version_id: sampleVersionId,
      analysis_version: '1.2.0',
      model_version: 'docunexa-eval-suite-v1',
      created_at: now,
      benchmark_id: 'bench-invoice-extraction-q4',
      accuracy_score: 0.982,
      metrics: {
        f1_score: 0.981,
        precision: 0.988,
        recall: 0.975,
        field_level_accuracy: {
          invoice_number: 1.0,
          total_amount: 1.0,
          due_date: 0.96,
        },
      },
    };
    await targetDb.collection('evaluation_runs').insertOne(sampleEvaluationRun);
    console.log(`  + Inserted document into 'evaluation_runs'`);

    // 4f. Unstructured Payload sample
    const sampleUnstructured = {
      tenant_id: sampleTenant,
      document_id: sampleDocId,
      version: 1,
      rawJson: {
        header: { docType: 'INVOICE', language: 'en' },
        lineItems: [
          { item: 'Enterprise License - Tier 1', qty: 10, unitPrice: 1200.0, total: 12000.0 },
          { item: 'Dedicated Cloud Support Package', qty: 1, unitPrice: 2250.0, total: 2250.0 },
        ],
      },
      extractedEntities: {
        vendor: 'DocuNexa Enterprise Technologies Inc.',
        total: 14250.0,
      },
      clauseVectors: [],
      createdAt: now,
    };
    await targetDb.collection('unstructured_payloads').insertOne(sampleUnstructured);
    console.log(`  + Inserted document into 'unstructured_payloads'`);

    // -----------------------------------------------------------------
    // STEP 5: Verification & Inspection
    // -----------------------------------------------------------------
    console.log('\n--- STEP 5: Verification and Final Inspection ---');
    const cols = await targetDb.listCollections().toArray();
    console.log(`Collections in database '${TARGET_DB}':`);
    for (const c of cols) {
      const count = await targetDb.collection(c.name).countDocuments();
      const indexes = await targetDb.collection(c.name).indexes();
      console.log(`  - [Collection] ${c.name.padEnd(24)} Documents: ${count} | Indexes: ${indexes.map(i => i.name).join(', ')}`);
    }

    console.log('\n=====================================================');
    console.log('SUCCESS: MongoDB database initialized, clean schemas verified, data stored.');
    console.log('=====================================================');
  } catch (err) {
    console.error('ERROR in MongoDB setup:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
