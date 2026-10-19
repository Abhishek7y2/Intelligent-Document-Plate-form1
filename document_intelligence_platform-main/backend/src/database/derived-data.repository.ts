import { Collection, Document } from 'mongodb';
import { getMongoDb } from './mongo.client.js';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';

export interface DerivedRecord {
  tenant_id: string; // MANDATORY - queries without tenant filter are prohibited
  document_id: string;
  source_version_id?: string;
  analysis_version: string;
  model_version: string;
  created_at: Date;
  [key: string]: unknown;
}

export class TenantBoundaryViolationError extends Error {
  constructor(message: string = 'Tenant boundary violation: tenantId is strictly required on all derived repository operations.') {
    super(message);
    this.name = 'TenantBoundaryViolationError';
  }
}

export class MongoUnavailableError extends Error {
  constructor(message: string = 'MongoDB derived store is unreachable. In-memory fallback is strictly forbidden outside NODE_ENV=test.') {
    super(message);
    this.name = 'MongoUnavailableError';
  }
}

export const DerivedStoreMetrics = {
  mongoWriteFailures: 0,
  incrementMongoWriteFailure(): void {
    this.mongoWriteFailures++;
  },
  reset(): void {
    this.mongoWriteFailures = 0;
  },
};

export class DerivedDataRepository<T extends DerivedRecord> {
  // In-memory fallback map: collectionName -> list of records (for offline unit tests only)
  private static inMemoryStore: Map<string, DerivedRecord[]> = new Map();

  constructor(public readonly collectionName: string) {}

  private getCollection(): Collection<Document> | null {
    const db = getMongoDb();
    return db ? db.collection(this.collectionName) : null;
  }

  private validateTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new TenantBoundaryViolationError(
        `DerivedDataRepository.${this.collectionName}: tenantId is strictly required. Operations without a tenant filter are forbidden.`
      );
    }
  }

  /**
   * Insert a derived data record into the collection.
   * Requires tenantId as first parameter to enforce tenant isolation.
   */
  async insert(tenantId: string, record: Omit<T, 'tenant_id' | 'created_at'>): Promise<T> {
    this.validateTenantId(tenantId);

    const docToSave = {
      ...record,
      tenant_id: tenantId.trim(),
      created_at: new Date(),
    } as unknown as T;

    const isTest = (process.env['NODE_ENV'] || 'development') === 'test';
    const storeMode = config?.mongo?.derivedStoreMode || 'dual';
    const col = this.getCollection();

    if (col) {
      try {
        await col.insertOne(docToSave as Document);
      } catch (err: any) {
        if (!isTest) {
          if (storeMode === 'dual') {
            DerivedStoreMetrics.incrementMongoWriteFailure();
            Logger.error({
              message: `Mongo dual-write failed for ${this.collectionName}: ${err.message}. Retaining PostgreSQL write.`,
              context: 'DerivedDataRepository',
              error: err,
              data: { metric: 'derived_store.mongo_write_failure', collection: this.collectionName, tenantId },
            });
            return docToSave;
          }
          throw new MongoUnavailableError(
            `MongoDB insert failed for collection '${this.collectionName}': ${err.message}. In-memory fallback is strictly forbidden outside NODE_ENV=test.`
          );
        }
        Logger.warn({
          message: `Mongo insert failed for ${this.collectionName}: ${err.message}. Retaining in fallback store.`,
          context: 'DerivedDataRepository',
        });
      }
    } else {
      if (!isTest) {
        if (storeMode === 'dual') {
          DerivedStoreMetrics.incrementMongoWriteFailure();
          Logger.error({
            message: `MongoDB connection unavailable for collection '${this.collectionName}'. Retaining PostgreSQL write in dual mode.`,
            context: 'DerivedDataRepository',
            data: { metric: 'derived_store.mongo_write_failure', collection: this.collectionName, tenantId },
          });
          return docToSave;
        }
        throw new MongoUnavailableError(
          `MongoDB is unreachable for collection '${this.collectionName}'. In-memory fallback is strictly forbidden outside NODE_ENV=test.`
        );
      }
    }

    // In test environment, maintain in fallback store for resilience and offline unit tests
    const list = DerivedDataRepository.inMemoryStore.get(this.collectionName) || [];
    list.push(docToSave);
    DerivedDataRepository.inMemoryStore.set(this.collectionName, list);

    return docToSave;
  }

  /**
   * Alias for insert.
   */
  async insertOne(tenantId: string, record: Omit<T, 'tenant_id' | 'created_at'>): Promise<T> {
    return this.insert(tenantId, record);
  }

  /**
   * Find records by document within the mandatory tenant boundary.
   */
  async findByDocument(
    tenantId: string,
    documentId: string,
    options?: { sourceVersionId?: string; limit?: number }
  ): Promise<T[]> {
    this.validateTenantId(tenantId);

    if (!documentId || typeof documentId !== 'string') {
      return [];
    }

    const isTest = (process.env['NODE_ENV'] || 'development') === 'test';
    const col = this.getCollection();
    if (col) {
      try {
        const filter: Record<string, unknown> = {
          tenant_id: tenantId.trim(),
          document_id: documentId.trim(),
        };
        if (options?.sourceVersionId) {
          filter['source_version_id'] = options.sourceVersionId;
        }

        let cursor = col.find(filter).sort({ created_at: -1 });
        if (options?.limit) {
          cursor = cursor.limit(options.limit);
        }
        const docs = await cursor.toArray();
        return docs as unknown as T[];
      } catch (err: any) {
        if (!isTest) {
          throw new MongoUnavailableError(
            `MongoDB find failed for ${this.collectionName}: ${err.message}. In-memory fallback is strictly forbidden outside NODE_ENV=test.`
          );
        }
        Logger.warn({
          message: `Mongo find failed for ${this.collectionName}: ${err.message}. Using fallback store.`,
          context: 'DerivedDataRepository',
        });
      }
    } else if (!isTest) {
      throw new MongoUnavailableError(
        `MongoDB is unreachable for collection '${this.collectionName}'. In-memory fallback is strictly forbidden outside NODE_ENV=test.`
      );
    }

    // Fallback store (test environment only)
    const list = (DerivedDataRepository.inMemoryStore.get(this.collectionName) || []) as T[];
    let filtered = list.filter(
      (r) => r.tenant_id === tenantId.trim() && r.document_id === documentId.trim()
    );

    if (options?.sourceVersionId) {
      filtered = filtered.filter((r) => r.source_version_id === options.sourceVersionId);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Delete all records for a document within the tenant boundary.
   */
  async deleteByDocument(tenantId: string, documentId: string): Promise<number> {
    this.validateTenantId(tenantId);

    const isTest = (process.env['NODE_ENV'] || 'development') === 'test';
    let deletedCount = 0;
    const col = this.getCollection();
    if (col) {
      try {
        const res = await col.deleteMany({
          tenant_id: tenantId.trim(),
          document_id: documentId.trim(),
        });
        deletedCount = res.deletedCount;
      } catch (err: any) {
        Logger.error({
          message: `Mongo deleteByDocument failed for ${this.collectionName}: ${err.message}`,
          context: 'DerivedDataRepository',
        });
        throw err;
      }
    } else if (!isTest) {
      throw new MongoUnavailableError(
        `MongoDB is unreachable for collection '${this.collectionName}'. In-memory fallback is strictly forbidden outside NODE_ENV=test.`
      );
    }

    if (isTest) {
      // Delete from fallback store
      const list = (DerivedDataRepository.inMemoryStore.get(this.collectionName) || []) as T[];
      const beforeCount = list.length;
      const remaining = list.filter(
        (r) => !(r.tenant_id === tenantId.trim() && r.document_id === documentId.trim())
      );
      DerivedDataRepository.inMemoryStore.set(this.collectionName, remaining);
      deletedCount = Math.max(deletedCount, beforeCount - remaining.length);
    }

    return deletedCount;
  }

  /**
   * Purge all derived data for a document across ALL 5 collections.
   */
  static async purgeAllByDocument(tenantId: string, documentId: string): Promise<number> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new TenantBoundaryViolationError('tenantId is required for purgeAllByDocument');
    }

    let totalDeleted = 0;
    for (const repo of ALL_DERIVED_REPOS) {
      const count = await repo.deleteByDocument(tenantId, documentId);
      totalDeleted += count;
    }
    return totalDeleted;
  }

  /**
   * Clear all in-memory collections (for test tear-down).
   */
  static clearInMemory(): void {
    DerivedDataRepository.inMemoryStore.clear();
  }
}

// 5 Canonical Collections as specified in Sprint 5
export const ocrPagesRepo = new DerivedDataRepository<DerivedRecord>('ocr_pages');
export const extractionRunsRepo = new DerivedDataRepository<DerivedRecord>('extraction_runs');
export const clauseDiffsRepo = new DerivedDataRepository<DerivedRecord>('clause_diffs');
export const qaTracesRepo = new DerivedDataRepository<DerivedRecord>('qa_traces');
export const evaluationRunsRepo = new DerivedDataRepository<DerivedRecord>('evaluation_runs');

export const ALL_DERIVED_REPOS = [
  ocrPagesRepo,
  extractionRunsRepo,
  clauseDiffsRepo,
  qaTracesRepo,
  evaluationRunsRepo,
];
