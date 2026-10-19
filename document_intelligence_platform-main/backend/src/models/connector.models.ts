export type ConnectorType = 'SAP_BAPI' | 'NETSUITE_REST' | 'SALESFORCE_CLM' | 'GENERIC_REST';

export interface FieldMappingItem {
  docField: string;
  erpField: string;
  transform?: 'uppercase' | 'trim' | 'date_iso' | 'amount_cents' | 'none';
  required: boolean;
}

export interface ConnectorMappingRecord {
  id: string;
  tenantId: string;
  connectorType: ConnectorType;
  documentType: string;
  version: string;
  fieldMappings: FieldMappingItem[];
  sandboxMode: boolean;
  isSignedOff: boolean;
  signedOffBy?: string;
  signedOffAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMappingPayload {
  connectorType: ConnectorType;
  documentType: string;
  version?: string;
  fieldMappings: FieldMappingItem[];
  sandboxMode?: boolean;
}

export interface SignOffMappingPayload {
  mappingId: string;
}

export interface ConnectorDispatchResult {
  success: boolean;
  connectorType: ConnectorType;
  documentId: string;
  externalTransactionId?: string;
  status: 'POSTED_SANDBOX' | 'POSTED_PRODUCTION' | 'REJECTED_UNAPPROVED' | 'REJECTED_UNSIGNED_MAPPING' | 'VALIDATION_FAILED';
  payloadTransformed?: Record<string, any>;
  errorMessage?: string;
  durationMs: number;
}
