export type DocumentTypeStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE';

export interface DocumentTypeRecord {
  typeId: string;
  tenantId: string | null; // null for global default types
  code: string;
  name: string;
  description: string;
  status: DocumentTypeStatus;
  activeVersion: string;
  workflow: string;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FieldDataType = 'text' | 'number' | 'date' | 'currency' | 'enum' | 'table' | 'boolean';
export type FieldCardinality = 'single' | 'array';
export type FieldMasking = 'none' | 'full' | 'partial';
export type FieldReviewerRole = 'reviewer' | 'approver' | 'org_admin';

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  type: FieldDataType;
  cardinality: FieldCardinality;
  required: boolean;
  acceptedValues?: string | string[];
  regexPattern?: string;
  arithmeticRule?: string;
  masking: FieldMasking;
  reviewerRole: FieldReviewerRole;
  exportable: boolean;
  confidenceThreshold: number; // 0.0 to 1.0
  displayOrder?: number;
}

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ExtractionTemplateRecord {
  templateId: string;
  documentTypeId: string;
  tenantId: string | null;
  version: string;
  name: string;
  description?: string;
  status: TemplateStatus;
  fields: TemplateField[];
  publishedAt?: Date | null;
  publishedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PolicyOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in'
  | 'regex_match'
  | 'is_not_empty';

export type PolicyAction = 'FLAG_REVIEW' | 'REJECT' | 'APPROVE' | 'REQUIRE_APPROVAL';
export type PolicyType = 'VALIDATION' | 'APPROVAL_ROUTING' | 'CONFIDENCE_THRESHOLD' | 'SLA_GATE';
export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface PolicyRule {
  ruleId: string;
  name: string;
  field: string;
  operator: PolicyOperator;
  value?: any;
  action: PolicyAction;
  message: string;
}

export interface ProcessingPolicyRecord {
  policyId: string;
  documentTypeId: string;
  tenantId: string | null;
  name: string;
  policyType: PolicyType;
  version: string;
  status: PolicyStatus;
  rules: PolicyRule[];
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleEvaluationItem {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  action: PolicyAction;
  message: string;
  error?: string;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  status: 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW' | 'NOT_APPLICABLE';
  ruleEvaluations: RuleEvaluationItem[];
  summary: string;
  evaluatedAt: Date;
}
