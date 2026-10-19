import crypto from 'crypto';
import { dbPool } from '../database/postgres.client.js';
import { Logger } from '../utils/logger.js';

export type MaskStyle = 'full' | 'partial';

export interface ExportMaskingRuleRecord {
  id: string;
  tenantId: string;
  documentType?: string | null;
  fieldKey: string;
  maskedForRoles: string[];
  maskStyle: MaskStyle;
  createdAt: Date;
  updatedAt: Date;
}

export class ExportMaskingService {
  private static inMemoryRules = new Map<string, ExportMaskingRuleRecord>();

  static clearInMemory(): void {
    this.inMemoryRules.clear();
  }

  static async createRule(
    tenantId: string,
    payload: {
      documentType?: string | null;
      fieldKey: string;
      maskedForRoles: string[];
      maskStyle?: MaskStyle;
    }
  ): Promise<ExportMaskingRuleRecord> {
    if (!payload.fieldKey || typeof payload.fieldKey !== 'string' || payload.fieldKey.trim().length === 0) {
      const err: any = new Error('fieldKey is required for export masking rule.');
      err.statusCode = 400;
      throw err;
    }

    const id = `EMR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const cleanRoles = (payload.maskedForRoles || []).map((r) => r.trim()).filter(Boolean);
    const maskStyle: MaskStyle = payload.maskStyle === 'partial' ? 'partial' : 'full';

    const record: ExportMaskingRuleRecord = {
      id,
      tenantId,
      documentType: payload.documentType ? payload.documentType.trim() : null,
      fieldKey: payload.fieldKey.trim(),
      maskedForRoles: cleanRoles,
      maskStyle,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await dbPool.query(
        `INSERT INTO export_masking_rules (
          id, tenant_id, document_type, field_key, masked_for_roles, mask_style, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.id,
          record.tenantId,
          record.documentType,
          record.fieldKey,
          record.maskedForRoles,
          record.maskStyle,
          record.createdAt,
          record.updatedAt,
        ]
      );
    } catch {}

    this.inMemoryRules.set(id, record);

    Logger.info({
      message: `Export masking rule created for field '${record.fieldKey}' (Tenant: ${tenantId})`,
      context: 'ExportMaskingService',
      data: { ruleId: id, tenantId, fieldKey: record.fieldKey, roles: cleanRoles, style: maskStyle },
    });

    return record;
  }

  static async listRules(tenantId: string): Promise<ExportMaskingRuleRecord[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id as "tenantId", document_type as "documentType",
                field_key as "fieldKey", masked_for_roles as "maskedForRoles",
                mask_style as "maskStyle", created_at as "createdAt", updated_at as "updatedAt"
         FROM export_masking_rules
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {}

    return Array.from(this.inMemoryRules.values()).filter((r) => r.tenantId === tenantId);
  }

  static async getRule(tenantId: string, ruleId: string): Promise<ExportMaskingRuleRecord | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id as "tenantId", document_type as "documentType",
                field_key as "fieldKey", masked_for_roles as "maskedForRoles",
                mask_style as "maskStyle", created_at as "createdAt", updated_at as "updatedAt"
         FROM export_masking_rules
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, ruleId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {}

    const rule = this.inMemoryRules.get(ruleId);
    if (!rule || rule.tenantId !== tenantId) return null;
    return rule;
  }

  static async updateRule(
    tenantId: string,
    ruleId: string,
    updates: {
      documentType?: string | null;
      fieldKey?: string;
      maskedForRoles?: string[];
      maskStyle?: MaskStyle;
    }
  ): Promise<ExportMaskingRuleRecord | null> {
    const existing = await this.getRule(tenantId, ruleId);
    if (!existing) return null;

    const updated: ExportMaskingRuleRecord = {
      ...existing,
      documentType: updates.documentType !== undefined ? updates.documentType : existing.documentType,
      fieldKey: updates.fieldKey !== undefined ? updates.fieldKey.trim() : existing.fieldKey,
      maskedForRoles: updates.maskedForRoles !== undefined ? updates.maskedForRoles : existing.maskedForRoles,
      maskStyle: updates.maskStyle !== undefined ? updates.maskStyle : existing.maskStyle,
      updatedAt: new Date(),
    };

    try {
      await dbPool.query(
        `UPDATE export_masking_rules
         SET document_type = $1, field_key = $2, masked_for_roles = $3, mask_style = $4, updated_at = NOW()
         WHERE tenant_id = $5 AND id = $6`,
        [
          updated.documentType,
          updated.fieldKey,
          updated.maskedForRoles,
          updated.maskStyle,
          tenantId,
          ruleId,
        ]
      );
    } catch {}

    this.inMemoryRules.set(ruleId, updated);
    return updated;
  }

  static async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    try {
      const res = await dbPool.query(
        `DELETE FROM export_masking_rules WHERE tenant_id = $1 AND id = $2`,
        [tenantId, ruleId]
      );
      if ((res.rowCount ?? 0) > 0) {
        this.inMemoryRules.delete(ruleId);
        return true;
      }
    } catch {}

    const rule = this.inMemoryRules.get(ruleId);
    if (!rule || rule.tenantId !== tenantId) return false;
    this.inMemoryRules.delete(ruleId);
    return true;
  }

  /**
   * Applies server-side role masking to exported documents or payloads.
   * Returns the masked data along with the set of fields that were masked.
   */
  static async applyRoleMasking(
    tenantId: string,
    userRole: string,
    items: any[],
    documentType?: string | null
  ): Promise<{ maskedItems: any[]; maskedFields: string[] }> {
    const rules = await this.listRules(tenantId);
    if (rules.length === 0 || !items || items.length === 0) {
      return { maskedItems: items, maskedFields: [] };
    }

    const applicableRules = rules.filter((r) => {
      const roleMatches = r.maskedForRoles.some((role) => role.toLowerCase() === userRole.toLowerCase());
      const docTypeMatches = !r.documentType || !documentType || r.documentType.toLowerCase() === documentType.toLowerCase();
      return roleMatches && docTypeMatches;
    });

    if (applicableRules.length === 0) {
      return { maskedItems: items, maskedFields: [] };
    }

    const maskedFieldSet = new Set<string>();

    const maskedItems = items.map((item) => {
      const clone = typeof item === 'object' && item !== null ? JSON.parse(JSON.stringify(item)) : item;

      for (const rule of applicableRules) {
        const key = rule.fieldKey;
        // Check direct property or camelCase / snake_case variations
        const candidates = [key, key.toLowerCase(), key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
        for (const cand of candidates) {
          if (clone[cand] !== undefined && clone[cand] !== null) {
            maskedFieldSet.add(rule.fieldKey);
            const strVal = String(clone[cand]);
            if (rule.maskStyle === 'partial') {
              clone[cand] = strVal.length > 4 ? '***' + strVal.slice(-4) : '***';
            } else {
              clone[cand] = '[REDACTED]';
            }
          }
        }
      }
      return clone;
    });

    return {
      maskedItems,
      maskedFields: Array.from(maskedFieldSet),
    };
  }
}
