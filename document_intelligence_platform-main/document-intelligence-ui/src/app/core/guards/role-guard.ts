import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/roles';

export function normalizeRole(role: string | undefined | null): Role {
  if (!role) return 'org_admin';
  const r = role.toLowerCase().replace(/[- ]/g, '_');
  if (r === 'admin' || r === 'organization_admin') return 'org_admin';
  if (r === 'operator') return 'platform_operator';
  return r as Role;
}

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  if (!currentUser) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Deactivated users land on access-denied
  if (currentUser.status === 'deactivated') {
    return router.createUrlTree(['/access-denied'], {
      queryParams: { reason: 'deactivated' },
    });
  }

  // Dashboard is universally accessible to all active authenticated users
  if (state.url.startsWith('/dashboard') || state.url === '/') {
    return true;
  }

  const allowedRoles = (route.data?.['roles'] as Role[]) || [];
  const normalizedUserRole = normalizeRole(currentUser.role);

  if (
    allowedRoles.length === 0 ||
    allowedRoles.includes(normalizedUserRole) ||
    allowedRoles.includes(currentUser.role) ||
    allowedRoles.map((r) => r.toLowerCase()).includes(currentUser.role?.toLowerCase() as any)
  ) {
    return true;
  }

  return router.createUrlTree(['/access-denied'], {
    queryParams: { attemptedUrl: state.url },
  });
};
