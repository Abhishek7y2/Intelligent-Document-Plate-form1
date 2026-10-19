import { MongoClient, Db } from 'mongodb';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;

export async function connectMongo(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  // If in test mode and no explicit MONGO_URL is provided, allow graceful offline/mock fallback
  try {
    const mongoUrl = config.mongo.url;
    const dbName = config.mongo.database;

    client = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: config.env === 'test' ? 1000 : 5000,
      connectTimeoutMS: config.env === 'test' ? 1000 : 5000,
    });

    await client.connect();
    dbInstance = client.db(dbName);
    isConnected = true;

    Logger.info({
      message: `MongoDB connected successfully to database: ${dbName}`,
      context: 'MongoClient',
      data: { url: mongoUrl.replace(/\/\/[^@]+@/, '//***@'), database: dbName },
    });

    // Create required indexes across derived collections
    await initializeMongoIndexes(dbInstance);

    return dbInstance;
  } catch (err: any) {
    isConnected = false;
    dbInstance = null;
    Logger.warn({
      message: `MongoDB connection unavailable (${err.message}). Derived repository will use resilient fallback.`,
      context: 'MongoClient',
    });
    return null;
  }
}

export async function initializeMongoIndexes(db: Db): Promise<void> {
  try {
    // 1. ocr_pages: compound lookup by tenant, doc, and page
    await db.collection('ocr_pages').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_ocr_pages_tenant_doc_time' }
    );
    await db.collection('ocr_pages').createIndex(
      { tenant_id: 1, document_id: 1, page_number: 1 },
      { name: 'idx_ocr_pages_tenant_doc_page' }
    );

    // 2. extraction_runs: compound lookup by tenant, doc, and run timestamp
    await db.collection('extraction_runs').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_extraction_runs_tenant_doc_time' }
    );

    // 3. clause_diffs: compound lookup by tenant and document pair
    await db.collection('clause_diffs').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_clause_diffs_tenant_doc_time' }
    );

    // 4. qa_traces: compound lookup by tenant and document
    await db.collection('qa_traces').createIndex(
      { tenant_id: 1, document_id: 1, created_at: -1 },
      { name: 'idx_qa_traces_tenant_doc_time' }
    );

    // 5. evaluation_runs: lookup by tenant and benchmark date
    await db.collection('evaluation_runs').createIndex(
      { tenant_id: 1, created_at: -1 },
      { name: 'idx_evaluation_runs_tenant_time' }
    );
  } catch (err: any) {
    Logger.warn({
      message: `Failed to create MongoDB indexes: ${err.message}`,
      context: 'MongoClient',
    });
  }
}

export function getMongoDb(): Db | null {
  return dbInstance;
}

export function setMongoDb(customDb: Db | null): void {
  dbInstance = customDb;
  isConnected = customDb !== null;
}

export async function checkMongoHealth(): Promise<'UP' | 'DOWN' | 'DISABLED'> {
  if (config.mongo.derivedStoreMode === 'postgres') {
    return 'DISABLED';
  }
  if (!dbInstance) {
    return 'DOWN';
  }
  try {
    await dbInstance.command({ ping: 1 });
    return 'UP';
  } catch {
    return 'DOWN';
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {}
    client = null;
    dbInstance = null;
    isConnected = false;
  }
}
