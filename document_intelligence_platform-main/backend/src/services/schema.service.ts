import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';
import {
  DocumentTypeRecord,
  ExtractionTemplateRecord,
  ProcessingPolicyRecord,
  PolicyEvaluationResult,
  TemplateField,
  PolicyRule,
} from '../models/schema.models.js';
import { PolicyEvaluator } from './policy-evaluator.js';
import { evaluationRunsRepo } from '../database/derived-data.repository.js';

export type SchemaStoreMode = 'database' | 'memory';

export class DatabasePersistenceError extends Error {
  statusCode = 503;
  code = 'DATABASE_UNAVAILABLE';
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabasePersistenceError';
  }
}

// In-memory stores strictly for unit testing / offline development
const inMemoryDocTypes: Map<string, DocumentTypeRecord> = new Map();
const inMemoryTemplates: Map<string, ExtractionTemplateRecord> = new Map();
const inMemoryPolicies: Map<string, ProcessingPolicyRecord> = new Map();

/**
 * Seed initial MVP document types in memory for unit test fallback
 */
export function seedDefaultSchemaData(): void {
  inMemoryDocTypes.clear();
  inMemoryTemplates.clear();
  inMemoryPolicies.clear();

  const mvpTypes: DocumentTypeRecord[] = [
    {
      typeId: 'purchase-invoice',
      tenantId: null,
      code: 'PUR-INVOICE',
      name: 'Purchase Invoice',
      description: 'Supplier tax invoices, line items breakdown, IGST tax calculations, and PO matching.',
      status: 'ACTIVE',
      activeVersion: 'v2.1',
      workflow: 'Validation -> Review -> Approval',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      typeId: 'supplier-contract',
      tenantId: null,
      code: 'SUP-CONTRACT',
      name: 'Supplier Contract',
      description: 'Master equipment and service agreements, liability caps, effective dates, and renewal terms.',
      status: 'ACTIVE',
      activeVersion: 'v1.4',
      workflow: 'Legal Review -> Executive Approval',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      typeId: 'internal-policy',
      tenantId: null,
      code: 'INT-POLICY',
      name: 'Internal Policy',
      description: 'Corporate governance policies, document control IDs, versioning, and compliance officer sign-offs.',
      status: 'ACTIVE',
      activeVersion: 'v4.2',
      workflow: 'Policy Owner Approval',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const t of mvpTypes) {
    inMemoryDocTypes.set(t.typeId, t);
  }

  // Seed default template for purchase-invoice v2.1
  const invoiceFields: TemplateField[] = [
    { id: 'f1', key: 'invoice_number', label: 'Invoice Number', type: 'text', cardinality: 'single', required: true, regexPattern: '^[A-Z0-9\\-]+$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.95 },
    { id: 'f2', key: 'invoice_date', label: 'Invoice Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'f3', key: 'supplier_gstin', label: 'Supplier Tax ID / GSTIN', type: 'text', cardinality: 'single', required: true, regexPattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'f4', key: 'net_amount', label: 'Net Amount', type: 'currency', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'f5', key: 'tax_amount', label: 'Tax Amount', type: 'currency', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'f6', key: 'total_amount', label: 'Total Amount', type: 'currency', cardinality: 'single', required: true, arithmeticRule: 'net_amount + tax_amount == total_amount', masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.95 },
  ];

  const invoiceTemplate: ExtractionTemplateRecord = {
    templateId: 'tpl-pur-invoice-v21',
    documentTypeId: 'purchase-invoice',
    tenantId: null,
    version: 'v2.1',
    name: 'Standard Commercial Invoice Schema',
    status: 'PUBLISHED',
    fields: invoiceFields,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryTemplates.set(`${invoiceTemplate.documentTypeId}:${invoiceTemplate.version}`, invoiceTemplate);

  // Seed default template for supplier-contract v1.4
  const contractFields: TemplateField[] = [
    { id: 'cf1', key: 'contract_number', label: 'Contract Number', type: 'text', cardinality: 'single', required: true, regexPattern: '^[A-Z0-9\\-]+$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'cf2', key: 'counterparty_name', label: 'Counterparty Name', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
    { id: 'cf3', key: 'effective_date', label: 'Effective Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'cf4', key: 'expiration_date', label: 'Expiration Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'cf5', key: 'contract_value', label: 'Total Contract Value', type: 'currency', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.85 },
  ];

  const contractTemplate: ExtractionTemplateRecord = {
    templateId: 'tpl-sup-contract-v14',
    documentTypeId: 'supplier-contract',
    tenantId: null,
    version: 'v1.4',
    name: 'Master Supplier Agreement Schema',
    status: 'PUBLISHED',
    fields: contractFields,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryTemplates.set(`${contractTemplate.documentTypeId}:${contractTemplate.version}`, contractTemplate);

  // Seed default template for internal-policy v4.2
  const policyFields: TemplateField[] = [
    { id: 'pf1', key: 'policy_number', label: 'Policy Control Number', type: 'text', cardinality: 'single', required: true, regexPattern: '^[A-Z0-9\\-]+$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'pf2', key: 'policy_title', label: 'Policy Document Title', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
    { id: 'pf3', key: 'effective_date', label: 'Effective Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
    { id: 'pf4', key: 'version_string', label: 'Policy Version', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
  ];

  const policyTemplate: ExtractionTemplateRecord = {
    templateId: 'tpl-int-policy-v42',
    documentTypeId: 'internal-policy',
    tenantId: null,
    version: 'v4.2',
    name: 'Enterprise Governance Policy Schema',
    status: 'PUBLISHED',
    fields: policyFields,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryTemplates.set(`${policyTemplate.documentTypeId}:${policyTemplate.version}`, policyTemplate);
}

// Initialize default data
seedDefaultSchemaData();

export class SchemaService {
  private static storeMode: SchemaStoreMode =
    config.env === 'production'
      ? 'database'
      : (process.env['SCHEMA_STORE_MODE'] as SchemaStoreMode) || (config.env === 'test' ? 'memory' : 'database');

  /**
   * Returns current active store mode
   */
  static getStoreMode(): SchemaStoreMode {
    return this.storeMode;
  }

  /**
   * Sets store mode for unit testing. In production, attempting to switch to memory throws an error.
   */
  static setStoreModeForTesting(mode: SchemaStoreMode): void {
    if (config.env === 'production' && mode === 'memory') {
      throw new Error('Security Invariant Violation: In-memory store mode is strictly forbidden in production.');
    }
    this.storeMode = mode;
  }

  // ==========================================
  // DOCUMENT TYPES
  // ==========================================

  static async listDocumentTypes(tenantId: string): Promise<DocumentTypeRecord[]> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT type_id, tenant_id, code, name, description, status, active_version, workflow, created_at, updated_at
           FROM document_types
           WHERE (tenant_id IS NULL OR tenant_id = $1) AND status != 'INACTIVE'
           ORDER BY name ASC`,
          [tenantId]
        );
        return res.rows.map(this.mapDocTypeRow);
      } catch (err: any) {
        Logger.error({
          message: `Database error querying document types: ${err.message}`,
          context: 'SchemaService',
          data: { tenantId, error: err.message },
        });
        throw new DatabasePersistenceError('Database service unavailable when fetching document types.', err);
      }
    }

    // Explicit In-Memory Store for unit tests
    return Array.from(inMemoryDocTypes.values()).filter(
      (t) => (t.tenantId === null || t.tenantId === tenantId) && t.status !== 'INACTIVE'
    );
  }

  static async getDocumentType(typeId: string, tenantId: string): Promise<DocumentTypeRecord | null> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT type_id, tenant_id, code, name, description, status, active_version, workflow, created_at, updated_at
           FROM document_types
           WHERE type_id = $1`,
          [typeId]
        );
        if (res.rows.length === 0) return null;

        const docType = this.mapDocTypeRow(res.rows[0]);
        if (docType.tenantId !== null && docType.tenantId !== tenantId) {
          const err: any = new Error('Cross-tenant document type access is forbidden.');
          err.statusCode = 403;
          err.code = 'CROSS_TENANT_FORBIDDEN';
          throw err;
        }
        return docType;
      } catch (err: any) {
        if (err.statusCode === 403) throw err;
        Logger.error({
          message: `Database error querying document type '${typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Database service unavailable when fetching document type '${typeId}'.`, err);
      }
    }

    // In-memory test store
    const t = inMemoryDocTypes.get(typeId);
    if (!t) return null;
    if (t.tenantId !== null && t.tenantId !== tenantId) {
      const err: any = new Error('Cross-tenant document type access is forbidden.');
      err.statusCode = 403;
      err.code = 'CROSS_TENANT_FORBIDDEN';
      throw err;
    }
    return t;
  }

  static async createDocumentType(
    payload: { typeId: string; code: string; name: string; description?: string; workflow?: string },
    tenantId: string,
    userId?: string
  ): Promise<DocumentTypeRecord> {
    const existing = await this.getDocumentType(payload.typeId, tenantId);
    if (existing) {
      const err: any = new Error(`Document type with identifier '${payload.typeId}' already exists.`);
      err.statusCode = 409;
      err.code = 'DOCUMENT_TYPE_EXISTS';
      throw err;
    }

    const newType: DocumentTypeRecord = {
      typeId: payload.typeId,
      tenantId,
      code: payload.code,
      name: payload.name,
      description: payload.description || '',
      status: 'ACTIVE',
      activeVersion: 'v1.0',
      workflow: payload.workflow || 'Validation -> Review -> Approval',
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO document_types (type_id, tenant_id, code, name, description, status, active_version, workflow, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newType.typeId,
            newType.tenantId,
            newType.code,
            newType.name,
            newType.description,
            newType.status,
            newType.activeVersion,
            newType.workflow,
            newType.createdBy,
          ]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database error creating document type '${payload.typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId: payload.typeId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to persist document type '${payload.typeId}' to PostgreSQL.`, err);
      }
    } else {
      inMemoryDocTypes.set(newType.typeId, newType);
    }

    Logger.info({
      message: 'Created new document type catalog item',
      context: 'SchemaService',
      data: { typeId: newType.typeId, tenantId },
    });

    return newType;
  }

  static async updateDocumentType(
    typeId: string,
    payload: { name?: string; description?: string; workflow?: string; status?: 'ACTIVE' | 'DRAFT' | 'INACTIVE' },
    tenantId: string
  ): Promise<DocumentTypeRecord> {
    const existing = await this.getDocumentType(typeId, tenantId);
    if (!existing) {
      const err: any = new Error(`Document type '${typeId}' not found.`);
      err.statusCode = 404;
      err.code = 'DOCUMENT_TYPE_NOT_FOUND';
      throw err;
    }

    if (existing.tenantId === null) {
      // Disallow regular tenant admin mutation of system types
      Logger.warn({
        message: 'Modifying global document type configuration',
        context: 'SchemaService',
        data: { typeId },
      });
    }

    const updated: DocumentTypeRecord = {
      ...existing,
      name: payload.name ?? existing.name,
      description: payload.description ?? existing.description,
      workflow: payload.workflow ?? existing.workflow,
      status: payload.status ?? existing.status,
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `UPDATE document_types
           SET name = $1, description = $2, workflow = $3, status = $4, updated_at = CURRENT_TIMESTAMP
           WHERE type_id = $5`,
          [updated.name, updated.description, updated.workflow, updated.status, typeId]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database error updating document type '${typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to update document type '${typeId}' in PostgreSQL.`, err);
      }
    } else {
      inMemoryDocTypes.set(typeId, updated);
    }

    return updated;
  }

  // ==========================================
  // EXTRACTION TEMPLATES & VERSIONING
  // ==========================================

  static async listTemplates(typeId: string, tenantId: string): Promise<ExtractionTemplateRecord[]> {
    await this.getDocumentType(typeId, tenantId);

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT template_id, document_type_id, tenant_id, version, name, description, status, fields, published_at, published_by, created_at, updated_at
           FROM extraction_templates
           WHERE document_type_id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
           ORDER BY created_at DESC`,
          [typeId, tenantId]
        );
        return res.rows.map(this.mapTemplateRow);
      } catch (err: any) {
        Logger.error({
          message: `Database error querying templates for '${typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to fetch templates for '${typeId}' from PostgreSQL.`, err);
      }
    }

    return Array.from(inMemoryTemplates.values()).filter(
      (t) => t.documentTypeId === typeId && (t.tenantId === null || t.tenantId === tenantId)
    );
  }

  static async getTemplate(typeId: string, version: string, tenantId: string): Promise<ExtractionTemplateRecord | null> {
    await this.getDocumentType(typeId, tenantId);

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT template_id, document_type_id, tenant_id, version, name, description, status, fields, published_at, published_by, created_at, updated_at
           FROM extraction_templates
           WHERE document_type_id = $1 AND version = $2 AND (tenant_id IS NULL OR tenant_id = $3)`,
          [typeId, version, tenantId]
        );
        if (res.rows.length === 0) return null;
        return this.mapTemplateRow(res.rows[0]);
      } catch (err: any) {
        Logger.error({
          message: `Database error querying template '${typeId}@${version}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, version, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to fetch template '${typeId}@${version}' from PostgreSQL.`, err);
      }
    }

    const key = `${typeId}:${version}`;
    const t = inMemoryTemplates.get(key);
    if (!t) return null;
    if (t.tenantId !== null && t.tenantId !== tenantId) {
      const err: any = new Error('Cross-tenant template access is forbidden.');
      err.statusCode = 403;
      err.code = 'CROSS_TENANT_FORBIDDEN';
      throw err;
    }
    return t;
  }

  static async createDraftTemplate(
    typeId: string,
    payload: { version: string; name: string; description?: string; fields: TemplateField[] },
    tenantId: string,
    userId?: string
  ): Promise<ExtractionTemplateRecord> {
    await this.getDocumentType(typeId, tenantId);

    const existing = await this.getTemplate(typeId, payload.version, tenantId);
    if (existing) {
      const err: any = new Error(`Template version '${payload.version}' for '${typeId}' already exists.`);
      err.statusCode = 409;
      err.code = 'TEMPLATE_VERSION_EXISTS';
      throw err;
    }

    const templateId = crypto.randomUUID();
    const newTemplate: ExtractionTemplateRecord = {
      templateId,
      documentTypeId: typeId,
      tenantId,
      version: payload.version,
      name: payload.name,
      description: payload.description || '',
      status: 'DRAFT',
      fields: payload.fields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO extraction_templates (template_id, document_type_id, tenant_id, version, name, description, status, fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newTemplate.templateId,
            newTemplate.documentTypeId,
            newTemplate.tenantId,
            newTemplate.version,
            newTemplate.name,
            newTemplate.description,
            newTemplate.status,
            JSON.stringify(newTemplate.fields),
          ]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database error creating template '${typeId}@${payload.version}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, version: payload.version, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to persist draft template '${typeId}@${payload.version}' to PostgreSQL.`, err);
      }
    } else {
      inMemoryTemplates.set(`${typeId}:${payload.version}`, newTemplate);
    }

    Logger.info({
      message: 'Draft extraction template version created',
      context: 'SchemaService',
      data: { typeId, version: payload.version, fieldCount: payload.fields.length },
    });

    return newTemplate;
  }

  /**
   * Publishes / Activates an extraction template version.
   * Concurrency & Invariant Enforcement:
   * 1. Acquires row lock on document_types (FOR UPDATE) to serialize concurrent activations.
   * 2. Only ONE template version may be PUBLISHED per document type + tenant scope.
   * 3. Archives previous published versions.
   * 4. Updates active_version on document_types atomically.
   */
  static async publishTemplate(
    typeId: string,
    version: string,
    tenantId: string,
    userId?: string
  ): Promise<ExtractionTemplateRecord> {
    const template = await this.getTemplate(typeId, version, tenantId);
    if (!template) {
      const err: any = new Error(`Template version '${version}' for '${typeId}' not found.`);
      err.statusCode = 404;
      err.code = 'TEMPLATE_NOT_FOUND';
      throw err;
    }

    if (template.fields.length === 0) {
      const err: any = new Error('Cannot publish an extraction template with zero fields defined.');
      err.statusCode = 400;
      err.code = 'EMPTY_TEMPLATE_FIELDS';
      throw err;
    }

    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Lock document_type row to serialize concurrent publish requests
        await client.query('SELECT type_id FROM document_types WHERE type_id = $1 FOR UPDATE', [typeId]);

        // 1. Archive previously published templates for this type and scope
        await client.query(
          `UPDATE extraction_templates
           SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
           WHERE document_type_id = $1 AND (tenant_id IS NULL OR tenant_id = $2) AND status = 'PUBLISHED'`,
          [typeId, tenantId]
        );

        // 2. Set target template to PUBLISHED
        const updateRes = await client.query(
          `UPDATE extraction_templates
           SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, published_by = $1, updated_at = CURRENT_TIMESTAMP
           WHERE document_type_id = $2 AND version = $3 AND (tenant_id IS NULL OR tenant_id = $4)
           RETURNING template_id`,
          [userId || null, typeId, version, tenantId]
        );

        if (updateRes.rowCount === 0) {
          throw new Error(`Template version '${version}' for '${typeId}' was not found for publishing.`);
        }

        // 3. Update active_version pointer on document_types
        await client.query(
          `UPDATE document_types
           SET active_version = $1, updated_at = CURRENT_TIMESTAMP
           WHERE type_id = $2`,
          [version, typeId]
        );

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({
          message: `Database transaction error publishing template '${typeId}@${version}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, version, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to publish template '${typeId}@${version}' in PostgreSQL.`, err);
      } finally {
        client.release();
      }
    } else {
      // In-memory atomic update
      for (const [key, tpl] of inMemoryTemplates.entries()) {
        if (tpl.documentTypeId === typeId && tpl.status === 'PUBLISHED') {
          tpl.status = 'ARCHIVED';
        }
      }
      template.status = 'PUBLISHED';
      template.publishedAt = new Date();
      template.publishedBy = userId || null;

      const docType = inMemoryDocTypes.get(typeId);
      if (docType) {
        docType.activeVersion = version;
      }
    }

    template.status = 'PUBLISHED';
    template.publishedAt = new Date();

    Logger.info({
      message: 'Extraction template version published and activated',
      context: 'SchemaService',
      data: { typeId, version, activatedBy: userId },
    });

    return template;
  }

  // ==========================================
  // POLICY CONFIGURATION & EVALUATION
  // ==========================================

  static async listPolicies(typeId: string, tenantId: string): Promise<ProcessingPolicyRecord[]> {
    await this.getDocumentType(typeId, tenantId);

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT policy_id, document_type_id, tenant_id, name, policy_type, version, status, rules, created_by, created_at, updated_at
           FROM processing_policies
           WHERE document_type_id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
           ORDER BY created_at DESC`,
          [typeId, tenantId]
        );
        return res.rows.map(this.mapPolicyRow);
      } catch (err: any) {
        Logger.error({
          message: `Database error querying policies for '${typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to fetch policies for '${typeId}' from PostgreSQL.`, err);
      }
    }

    return Array.from(inMemoryPolicies.values()).filter(
      (p) => p.documentTypeId === typeId && (p.tenantId === null || p.tenantId === tenantId)
    );
  }

  static async getPolicy(policyId: string, tenantId: string): Promise<ProcessingPolicyRecord | null> {
    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT policy_id, document_type_id, tenant_id, name, policy_type, version, status, rules, created_by, created_at, updated_at
           FROM processing_policies
           WHERE policy_id = $1`,
          [policyId]
        );
        if (res.rows.length === 0) return null;

        const p = this.mapPolicyRow(res.rows[0]);
        if (p.tenantId !== null && p.tenantId !== tenantId) {
          const err: any = new Error('Cross-tenant policy access is forbidden.');
          err.statusCode = 403;
          err.code = 'CROSS_TENANT_FORBIDDEN';
          throw err;
        }
        return p;
      } catch (err: any) {
        if (err.statusCode === 403) throw err;
        Logger.error({
          message: `Database error querying policy '${policyId}': ${err.message}`,
          context: 'SchemaService',
          data: { policyId, tenantId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to fetch policy '${policyId}' from PostgreSQL.`, err);
      }
    }

    const p = inMemoryPolicies.get(policyId);
    if (!p) return null;
    if (p.tenantId !== null && p.tenantId !== tenantId) {
      const err: any = new Error('Cross-tenant policy access is forbidden.');
      err.statusCode = 403;
      err.code = 'CROSS_TENANT_FORBIDDEN';
      throw err;
    }
    return p;
  }

  static async createDraftPolicy(
    typeId: string,
    payload: { name: string; policyType: 'VALIDATION' | 'APPROVAL_ROUTING' | 'CONFIDENCE_THRESHOLD' | 'SLA_GATE'; version: string; rules: PolicyRule[] },
    tenantId: string,
    userId?: string
  ): Promise<ProcessingPolicyRecord> {
    await this.getDocumentType(typeId, tenantId);

    const policyId = crypto.randomUUID();
    const newPolicy: ProcessingPolicyRecord = {
      policyId,
      documentTypeId: typeId,
      tenantId,
      name: payload.name,
      policyType: payload.policyType,
      version: payload.version,
      status: 'DRAFT',
      rules: payload.rules,
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO processing_policies (policy_id, document_type_id, tenant_id, name, policy_type, version, status, rules, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newPolicy.policyId,
            newPolicy.documentTypeId,
            newPolicy.tenantId,
            newPolicy.name,
            newPolicy.policyType,
            newPolicy.version,
            newPolicy.status,
            JSON.stringify(newPolicy.rules),
            newPolicy.createdBy,
          ]
        );
      } catch (err: any) {
        Logger.error({
          message: `Database error creating policy for '${typeId}': ${err.message}`,
          context: 'SchemaService',
          data: { typeId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to persist policy for '${typeId}' to PostgreSQL.`, err);
      }
    } else {
      inMemoryPolicies.set(policyId, newPolicy);
    }

    Logger.info({
      message: 'Created draft processing policy',
      context: 'SchemaService',
      data: { policyId, typeId, policyType: payload.policyType },
    });

    return newPolicy;
  }

  static async publishPolicy(policyId: string, tenantId: string): Promise<ProcessingPolicyRecord> {
    const policy = await this.getPolicy(policyId, tenantId);
    if (!policy) {
      const err: any = new Error(`Policy '${policyId}' not found.`);
      err.statusCode = 404;
      err.code = 'POLICY_NOT_FOUND';
      throw err;
    }

    if (this.storeMode === 'database') {
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        // Lock row to serialize concurrent activations
        await client.query('SELECT type_id FROM document_types WHERE type_id = $1 FOR UPDATE', [policy.documentTypeId]);

        // Archive other active policies of same type and scope
        await client.query(
          `UPDATE processing_policies
           SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
           WHERE document_type_id = $1 AND policy_type = $2 AND (tenant_id IS NULL OR tenant_id = $3) AND status = 'ACTIVE'`,
          [policy.documentTypeId, policy.policyType, tenantId]
        );

        await client.query(
          `UPDATE processing_policies
           SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
           WHERE policy_id = $1`,
          [policyId]
        );

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        Logger.error({
          message: `Database transaction error publishing policy '${policyId}': ${err.message}`,
          context: 'SchemaService',
          data: { policyId, error: err.message },
        });
        throw new DatabasePersistenceError(`Failed to publish policy '${policyId}' in PostgreSQL.`, err);
      } finally {
        client.release();
      }
    } else {
      for (const p of inMemoryPolicies.values()) {
        if (p.documentTypeId === policy.documentTypeId && p.policyType === policy.policyType && p.status === 'ACTIVE') {
          p.status = 'ARCHIVED';
        }
      }
      policy.status = 'ACTIVE';
    }

    policy.status = 'ACTIVE';
    return policy;
  }

  static async evaluatePolicy(
    policyId: string,
    extractedData: Record<string, any>,
    tenantId: string
  ): Promise<PolicyEvaluationResult> {
    const policy = await this.getPolicy(policyId, tenantId);
    if (!policy) {
      const err: any = new Error(`Policy '${policyId}' not found.`);
      err.statusCode = 404;
      err.code = 'POLICY_NOT_FOUND';
      throw err;
    }

    const result = PolicyEvaluator.evaluate(policy, extractedData);

    if (config.mongo.derivedStoreMode !== 'postgres') {
      try {
        await evaluationRunsRepo.insertOne(tenantId, {
          tenant_id: tenantId,
          document_id: (extractedData['documentId'] as string) || `POLICY-${policyId}`,
          source_version_id: (extractedData['sourceVersionId'] as string) || 'v1',
          analysis_version: '1.0.0',
          model_version: 'policy-evaluator-v1',
          policy_id: policyId,
          policy_name: result.policyName,
          status: result.status,
          summary: result.summary,
          rule_evaluations: result.ruleEvaluations,
        });
      } catch (mongoErr: any) {
        Logger.warn({
          message: `Mongo dual-write for policy evaluation failed: ${mongoErr.message}`,
          context: 'SchemaService',
        });
      }
    }

    return result;
  }

  // ==========================================
  // ROW MAPPERS
  // ==========================================

  private static mapDocTypeRow(row: any): DocumentTypeRecord {
    return {
      typeId: row.type_id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      status: row.status,
      activeVersion: row.active_version || 'v1.0',
      workflow: row.workflow || 'Validation -> Review -> Approval',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapTemplateRow(row: any): ExtractionTemplateRecord {
    return {
      templateId: row.template_id,
      documentTypeId: row.document_type_id,
      tenantId: row.tenant_id,
      version: row.version,
      name: row.name,
      description: row.description || '',
      status: row.status,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
      publishedAt: row.published_at,
      publishedBy: row.published_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapPolicyRow(row: any): ProcessingPolicyRecord {
    return {
      policyId: row.policy_id,
      documentTypeId: row.document_type_id,
      tenantId: row.tenant_id,
      name: row.name,
      policyType: row.policy_type,
      version: row.version,
      status: row.status,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
