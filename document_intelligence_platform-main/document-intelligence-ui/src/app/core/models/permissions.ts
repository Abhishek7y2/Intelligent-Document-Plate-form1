import { Role } from './roles';

export const ALL_ROLES: Role[] = [
  'platform_operator',
  'org_admin',
  'contributor',
  'reviewer',
  'approver',
  'auditor',
];

export const TENANT_ROLES: Role[] = [
  'org_admin',
  'contributor',
  'reviewer',
  'approver',
  'auditor',
];

export const ROLE_ROUTE_ACCESS: Record<string, Role[]> = {
  '/dashboard': ALL_ROLES,
  '/documents': TENANT_ROLES,
  '/documents/:id': TENANT_ROLES,
  '/search': TENANT_ROLES,
  '/qa': TENANT_ROLES,
  '/compare': TENANT_ROLES,
  '/compare/:id': TENANT_ROLES,
  '/intake': ['contributor', 'reviewer', 'approver', 'org_admin'],
  '/tasks': ['contributor', 'reviewer', 'approver', 'org_admin'],
  '/review': ['reviewer', 'org_admin'],
  '/review/:id': ['reviewer', 'org_admin'],
  '/approvals': ['approver', 'org_admin'],
  '/admin': ['org_admin', 'platform_operator'],
  '/admin/overview': ['org_admin', 'platform_operator'],
  '/admin/users': ['org_admin'],
  '/admin/document-types': ['org_admin'],
  '/admin/document-types/:id': ['org_admin'],
  '/admin/workflow': ['org_admin'],
  '/admin/retention': ['org_admin'],
  '/admin/security': ['org_admin'],
  '/admin/integrations': ['org_admin'],
  '/admin/notifications': ['org_admin', 'platform_operator'],
  '/admin/ai-quality': ['org_admin'],
  '/admin/audit': ['org_admin', 'platform_operator'],
  '/admin/reports': ['org_admin'],
  '/admin/operations': ['platform_operator', 'org_admin'],
  '/admin/trace': ['org_admin', 'platform_operator', 'auditor'],
  '/reports': ALL_ROLES,
  '/profile': ALL_ROLES,
};

export function hasRoleAccess(userRole: string | undefined | null, routePath: string): boolean {
  if (!userRole) return false;
  if (routePath === '/dashboard' || routePath === '/') return true;
  
  const r = userRole.toLowerCase().replace(/[- ]/g, '_');
  const normalizedRole = (r === 'admin' || r === 'organization_admin') ? 'org_admin' : (r === 'operator' ? 'platform_operator' : r) as Role;

  // Find matching route pattern
  const matchedRoute = Object.keys(ROLE_ROUTE_ACCESS).find((pattern) => {
    if (pattern === routePath) return true;
    if (pattern.includes(':id')) {
      const regex = new RegExp('^' + pattern.replace(':id', '[^/]+') + '$');
      return regex.test(routePath);
    }
    return false;
  });

  if (!matchedRoute) {
    return true; // Default allow if unspecified
  }

  const allowed = ROLE_ROUTE_ACCESS[matchedRoute];
  return allowed.includes(normalizedRole) || allowed.includes(userRole as Role);
}
