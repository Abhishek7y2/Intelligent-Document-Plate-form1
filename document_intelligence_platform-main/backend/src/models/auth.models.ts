export type CanonicalRole = 
  | 'platform_operator'
  | 'org_admin'
  | 'contributor'
  | 'reviewer'
  | 'approver'
  | 'auditor';

export type LegacyRole = 'Admin' | 'Reviewer' | 'Approver' | 'FinanceHead' | 'Analyst' | 'Auditor';

export type UserRole = CanonicalRole | LegacyRole;

export type Permission = 
  | 'DOC_VIEW'
  | 'DOC_UPLOAD'
  | 'DOC_EDIT'
  | 'DOC_VERIFY'
  | 'DOC_APPROVE'
  | 'DOC_DELETE'
  | 'REPORT_GENERATE'
  | 'EXPORT_REQUEST'
  | 'COMPARE_VIEW'
  | 'QA_QUERY'
  | 'AUDIT_VIEW'
  | 'ADMIN_ACCESS'
  | 'USER_MANAGE'
  | 'SCHEMA_VIEW'
  | 'SCHEMA_MANAGE'
  | 'POLICY_VIEW'
  | 'POLICY_MANAGE'
  | 'POLICY_EVALUATE'
  | 'SYSTEM_HEALTH_VIEW';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Canonical BRD Roles
  org_admin: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'DOC_EDIT',
    'DOC_VERIFY',
    'DOC_APPROVE',
    'DOC_DELETE',
    'REPORT_GENERATE',
    'EXPORT_REQUEST',
    'COMPARE_VIEW',
    'QA_QUERY',
    'AUDIT_VIEW',
    'ADMIN_ACCESS',
    'USER_MANAGE',
    'SCHEMA_VIEW',
    'SCHEMA_MANAGE',
    'POLICY_VIEW',
    'POLICY_MANAGE',
    'POLICY_EVALUATE',
    'SYSTEM_HEALTH_VIEW',
  ],
  contributor: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
  ],
  reviewer: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'DOC_EDIT',
    'DOC_VERIFY',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
    'POLICY_EVALUATE',
  ],
  approver: [
    'DOC_VIEW',
    'DOC_APPROVE',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
  ],
  auditor: [
    'DOC_VIEW',
    'REPORT_GENERATE',
    'EXPORT_REQUEST',
    'AUDIT_VIEW',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
  ],
  platform_operator: [
    'ADMIN_ACCESS',
    'AUDIT_VIEW',
    'SYSTEM_HEALTH_VIEW',
  ],
  // Legacy Aliases for Test Compatibility
  Admin: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'DOC_EDIT',
    'DOC_VERIFY',
    'DOC_APPROVE',
    'DOC_DELETE',
    'REPORT_GENERATE',
    'EXPORT_REQUEST',
    'COMPARE_VIEW',
    'QA_QUERY',
    'AUDIT_VIEW',
    'ADMIN_ACCESS',
    'USER_MANAGE',
    'SCHEMA_VIEW',
    'SCHEMA_MANAGE',
    'POLICY_VIEW',
    'POLICY_MANAGE',
    'POLICY_EVALUATE',
    'SYSTEM_HEALTH_VIEW',
  ],
  Approver: [
    'DOC_VIEW',
    'DOC_APPROVE',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
  ],
  FinanceHead: [
    'DOC_VIEW',
    'DOC_APPROVE',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
    'POLICY_EVALUATE',
  ],
  Reviewer: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'DOC_EDIT',
    'DOC_VERIFY',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
    'POLICY_EVALUATE',
  ],
  Analyst: [
    'DOC_VIEW',
    'DOC_UPLOAD',
    'REPORT_GENERATE',
    'COMPARE_VIEW',
    'QA_QUERY',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
    'POLICY_EVALUATE',
  ],
  Auditor: [
    'DOC_VIEW',
    'REPORT_GENERATE',
    'EXPORT_REQUEST',
    'AUDIT_VIEW',
    'SCHEMA_VIEW',
    'POLICY_VIEW',
    'COMPARE_VIEW',
    'QA_QUERY',
  ],
};

export interface UserRecord {
  user_id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  mfa_enabled?: boolean;
  mfa_secret_enc?: string | null;
  mfa_recovery_hashes?: string[];
  // Enterprise Profile fields
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  phone_number?: string | null;
  phone_country_code?: string | null;
  date_of_birth?: string | Date | null;
  employee_id?: string | null;
  designation?: string | null;
  department?: string | null;
  manager_name?: string | null;
  location?: string | null;
  employee_type?: string | null;
  employment_status?: string | null;
  date_joined?: string | Date | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  timezone?: string | null;
  language?: string | null;
  email_alerts_enabled?: boolean;
  in_app_notifications_enabled?: boolean;
  last_password_change_at?: Date | string | null;
}

export interface UserInvitationRecord {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  token_hash: string;
  invited_by: string;
  expires_at: Date;
  accepted_at?: Date | null;
  created_at: Date;
}

export interface TenantMembership {
  membership_id: string;
  user_id: string;
  tenant_id: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthSession {
  session_id: string;
  user_id: string;
  tenant_id: string;
  refresh_token_hash: string;
  family_id: string;
  is_revoked: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date;
}

export interface UserProfileResponse {
  userId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  workEmail: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  employeeId: string;
  employmentStatus: string;
  designation: string;
  department: string;
  managerName: string;
  location: string;
  employeeType: string;
  dateJoined: string | null;
  role: UserRole;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  lastPasswordChangeAt: string | null;
  timezone: string;
  language: string;
  emailAlerts: boolean;
  inAppNotifications: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
  dateOfBirth?: string;
  timezone?: string;
  language?: string;
  emailAlerts?: boolean;
  inAppNotifications?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface SessionItemDto {
  sessionId: string;
  ipAddress: string;
  browser: string;
  os: string;
  isCurrent: boolean;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  permissions: Permission[];
  sessionId?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    userId: string;
    email: string;
    fullName: string;
    role: UserRole;
    tenantId: string;
    permissions: Permission[];
  };
  mfaRequired?: boolean;
}

export interface MfaRequiredResult extends LoginResult {
  mfaRequired: true;
}
