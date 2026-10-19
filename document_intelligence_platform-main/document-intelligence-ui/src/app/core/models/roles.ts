export type Role =
  | 'platform_operator'
  | 'org_admin'
  | 'contributor'
  | 'reviewer'
  | 'approver'
  | 'auditor';

export interface RoleInfo {
  id: Role;
  name: string;
  badgeClass: string;
  description: string;
  demoEmail: string;
  avatarInitials: string;
  organization: string;
}

export const DEMO_ROLES: RoleInfo[] = [
  {
    id: 'org_admin',
    name: 'Org Admin',
    badgeClass: 'badge-admin',
    description: 'Full system & tenant governance access',
    demoEmail: 'admin@docnexa.io',
    avatarInitials: 'AY',
    organization: 'Acme Enterprise',
  },
  {
    id: 'contributor',
    name: 'Contributor',
    badgeClass: 'badge-contributor',
    description: 'Uploads and ingests documents into queues',
    demoEmail: 'contributor@docnexa.io',
    avatarInitials: 'CN',
    organization: 'Acme Enterprise',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    badgeClass: 'badge-reviewer',
    description: 'HITL 50/50 extraction review & verification',
    demoEmail: 'reviewer@docnexa.io',
    avatarInitials: 'RV',
    organization: 'Acme Enterprise',
  },
  {
    id: 'approver',
    name: 'Approver',
    badgeClass: 'badge-approver',
    description: 'Multi-stage approval workflow sign-offs',
    demoEmail: 'approver@docnexa.io',
    avatarInitials: 'AP',
    organization: 'Acme Enterprise',
  },
  {
    id: 'auditor',
    name: 'Auditor',
    badgeClass: 'badge-auditor',
    description: 'Read-only audit log & compliance review',
    demoEmail: 'auditor@docnexa.io',
    avatarInitials: 'AU',
    organization: 'Acme Enterprise',
  },
  {
    id: 'platform_operator',
    name: 'Platform Operator',
    badgeClass: 'badge-operator',
    description: 'Infrastructure health & operations management',
    demoEmail: 'operator@docnexa.io',
    avatarInitials: 'PO',
    organization: 'DocNexa Cloud Platform',
  },
];
