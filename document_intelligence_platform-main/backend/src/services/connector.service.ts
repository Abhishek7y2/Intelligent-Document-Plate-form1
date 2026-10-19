import crypto from 'crypto';
import {
  ConnectorMappingRecord,
  CreateMappingPayload,
  ConnectorType,
  ConnectorDispatchResult,
} from '../models/connector.models.js';
import { IntakeService } from './intake.service.js';
import { ExtractionService } from './extraction.service.js';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export class ConnectorValidationError extends Error {
  statusCode = 400;
  code = 'CONNECTOR_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorValidationError';
  }
}

export class ConnectorService {
  private static storeMode: 'memory' | 'database' = 'memory';
  private static inMemoryMappings = new Map<string, ConnectorMappingRecord>();

  static setStoreMode(mode: 'memory' | 'database'): void {
    this.storeMode = mode;
  }

  static getStoreMode(): 'memory' | 'database' {
    return this.storeMode;
  }

  static clearInMemory(): void {
    this.inMemoryMappings.clear();
  }

  /**
   * Registers or updates a source-to-target connector field mapping.
   * Any mapping update resets isSignedOff to false until re-reviewed.
   */
  static async upsertMapping(
    tenantId: string,
    payload: CreateMappingPayload
  ): Promise<ConnectorMappingRecord> {
    if (!payload.connectorType || !payload.documentType || !payload.fieldMappings) {
      throw new ConnectorValidationError('Missing required mapping parameters: connectorType, documentType, fieldMappings.');
    }

    const version = payload.version || 'v1.0';
    const key = `${tenantId}:${payload.connectorType}:${payload.documentType}:${version}`;
    const existing = this.inMemoryMappings.get(key);
    const id = existing?.id || `MAP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const record: ConnectorMappingRecord = {
      id,
      tenantId,
      connectorType: payload.connectorType,
      documentType: payload.documentType,
      version,
      fieldMappings: payload.fieldMappings,
      sandboxMode: payload.sandboxMode !== false,
      isSignedOff: false, // Reset sign-off on change
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (this.storeMode === 'database') {
      try {
        await dbPool.query(
          `INSERT INTO connector_mappings (
            id, tenant_id, connector_type, document_type, version, field_mappings,
            sandbox_mode, is_signed_off, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (tenant_id, connector_type, document_type, version)
          DO UPDATE SET field_mappings = $6, sandbox_mode = $7, is_signed_off = FALSE, updated_at = $10`,
          [
            record.id,
            record.tenantId,
            record.connectorType,
            record.documentType,
            record.version,
            JSON.stringify(record.fieldMappings),
            record.sandboxMode,
            record.isSignedOff,
            record.createdAt,
            record.updatedAt,
          ]
        );
      } catch (err: any) {
        Logger.warn({ message: `Database insert for connector_mappings failed: ${err.message}` });
        this.inMemoryMappings.set(key, record);
      }
    } else {
      this.inMemoryMappings.set(key, record);
    }

    Logger.info({
      message: `Connector mapping upserted: ${record.id} (${record.connectorType} -> ${record.documentType})`,
      context: 'ConnectorService',
      data: { mappingId: record.id, tenantId, connector: record.connectorType, fields: record.fieldMappings.length },
    });

    return record;
  }

  /**
   * Retrieves connector mapping
   */
  static async getMapping(
    tenantId: string,
    connectorType: ConnectorType,
    documentType: string,
    version = 'v1.0'
  ): Promise<ConnectorMappingRecord | undefined> {
    const key = `${tenantId}:${connectorType}:${documentType}:${version}`;

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `SELECT id, tenant_id as "tenantId", connector_type as "connectorType",
                  document_type as "documentType", version, field_mappings as "fieldMappings",
                  sandbox_mode as "sandboxMode", is_signed_off as "isSignedOff",
                  signed_off_by as "signedOffBy", signed_off_at as "signedOffAt",
                  created_at as "createdAt", updated_at as "updatedAt"
           FROM connector_mappings
           WHERE tenant_id = $1 AND connector_type = $2 AND document_type = $3 AND version = $4`,
          [tenantId, connectorType, documentType, version]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch {
        // Fallback
      }
    }

    return this.inMemoryMappings.get(key);
  }

  /**
   * Signs off on a connector mapping, authorizing external transformation and posting
   */
  static async signOffMapping(
    tenantId: string,
    mappingId: string,
    userId: string
  ): Promise<ConnectorMappingRecord> {
    let mapping: ConnectorMappingRecord | undefined = undefined;

    for (const m of this.inMemoryMappings.values()) {
      if (m.id === mappingId && m.tenantId === tenantId) {
        mapping = m;
        break;
      }
    }

    if (this.storeMode === 'database') {
      try {
        const res = await dbPool.query(
          `UPDATE connector_mappings
           SET is_signed_off = TRUE, signed_off_by = $1, signed_off_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3
           RETURNING id, tenant_id as "tenantId", connector_type as "connectorType",
                     document_type as "documentType", version, field_mappings as "fieldMappings",
                     sandbox_mode as "sandboxMode", is_signed_off as "isSignedOff",
                     signed_off_by as "signedOffBy", signed_off_at as "signedOffAt"`,
          [userId, mappingId, tenantId]
        );
        if (res.rows.length > 0) mapping = res.rows[0];
      } catch {
        // Fallback
      }
    }

    if (!mapping) {
      throw new ConnectorValidationError(`Connector mapping ${mappingId} not found in tenant.`);
    }

    mapping.isSignedOff = true;
    mapping.signedOffBy = userId;
    mapping.signedOffAt = new Date();

    Logger.info({
      message: `Connector mapping ${mappingId} signed off by ${userId}`,
      context: 'ConnectorService',
      data: { mappingId, tenantId, signedOffBy: userId },
    });

    return mapping;
  }

  /**
   * Dispatches document to external connector enforcing:
   * 1. Hard Invariant 1: Document MUST be in APPROVED or PUBLISHED state.
   * 2. Hard Invariant 2: Mapping MUST be reviewed and signed off.
   * 3. Transformation & Required Fields Validation.
   */
  static async dispatchToConnector(
    tenantId: string,
    documentId: string,
    connectorType: ConnectorType
  ): Promise<ConnectorDispatchResult> {
    const startTime = Date.now();

    // 1. Fetch document and enforce approval state
    const doc = await IntakeService.getDocument(documentId, tenantId);
    if (!doc) {
      return {
        success: false,
        connectorType,
        documentId,
        status: 'VALIDATION_FAILED',
        errorMessage: 'Document does not exist or access is forbidden.',
        durationMs: Date.now() - startTime,
      };
    }

    const isApproved = doc.status === 'APPROVED' || (doc.status as string) === 'PUBLISHED';
    if (!isApproved) {
      return {
        success: false,
        connectorType,
        documentId,
        status: 'REJECTED_UNAPPROVED',
        errorMessage: `External posting rejected: Document is in '${doc.status}' status. Only APPROVED documents may be dispatched to ERP/CLM.`,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Fetch mapping and enforce sign-off gate
    const mapping = await this.getMapping(tenantId, connectorType, doc.documentType);
    if (!mapping || !mapping.isSignedOff) {
      return {
        success: false,
        connectorType,
        documentId,
        status: 'REJECTED_UNSIGNED_MAPPING',
        errorMessage: `External posting rejected: Connector mapping for '${connectorType}' -> '${doc.documentType}' has not been signed off by an authorized administrator.`,
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Extract document fields and validate required mapping fields
    const extractions = await ExtractionService.getExtraction(documentId, tenantId);
    const extractedFieldsMap = new Map<string, any>();
    if (extractions && extractions.fields) {
      for (const f of extractions.fields) {
        extractedFieldsMap.set(f.fieldName, f.extractedValue);
      }
    }

    const transformedPayload: Record<string, any> = {};
    for (const item of mapping.fieldMappings) {
      const val = extractedFieldsMap.get(item.docField);
      if (item.required && (val === undefined || val === null || val === '')) {
        return {
          success: false,
          connectorType,
          documentId,
          status: 'VALIDATION_FAILED',
          errorMessage: `Required target field '${item.erpField}' cannot be populated: missing extracted source field '${item.docField}'.`,
          durationMs: Date.now() - startTime,
        };
      }

      // Apply transformations
      let transformedVal = val;
      if (item.transform === 'uppercase' && typeof val === 'string') {
        transformedVal = val.toUpperCase();
      } else if (item.transform === 'trim' && typeof val === 'string') {
        transformedVal = val.trim();
      } else if (item.transform === 'amount_cents' && typeof val === 'number') {
        transformedVal = Math.round(val * 100);
      } else if (item.transform === 'date_iso' && val) {
        transformedVal = new Date(val).toISOString().split('T')[0];
      }

      transformedPayload[item.erpField] = transformedVal;
    }

    // 4. Dispatch (Simulated Sandbox or Production)
    const isSandbox = mapping.sandboxMode !== false;
    const externalTransactionId = isSandbox
      ? `EXT-SBX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
      : `EXT-PRD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const durationMs = Date.now() - startTime;

    Logger.info({
      message: `Document ${documentId} dispatched to ${connectorType} (${isSandbox ? 'SANDBOX' : 'PRODUCTION'})`,
      context: 'ConnectorService',
      data: { documentId, tenantId, connectorType, externalTransactionId, isSandbox, durationMs },
    });

    return {
      success: true,
      connectorType,
      documentId,
      externalTransactionId,
      status: isSandbox ? 'POSTED_SANDBOX' : 'POSTED_PRODUCTION',
      payloadTransformed: transformedPayload,
      durationMs,
    };
  }
}
