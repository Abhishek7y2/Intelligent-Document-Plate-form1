import { Role } from './roles';

export type UserRole = Role | 'organization-admin' | 'platform-operator' | 'reader';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  avatarInitials: string;
  status?: 'active' | 'deactivated';
  token?: string;
  tenantId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface UserProfileDto {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  preferredName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  managerName?: string;
  location?: string;
  employmentStatus?: string;
  employeeType?: string;
  avatarUrl?: string;
  coverUrl?: string;
  timezone?: string;
  language?: string;
  emailAlerts?: boolean;
  inAppNotifications?: boolean;
  role: string;
  accessScope?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  lastPasswordChangeAt?: string;
  activeSessionsCount: number;
  dateJoined?: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  timezone?: string;
  language?: string;
  emailAlerts?: boolean;
  inAppNotifications?: boolean;
  designation?: string;
  department?: string;
  managerName?: string;
  location?: string;
}

export interface SessionItemDto {
  id: string;
  isCurrent: boolean;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}