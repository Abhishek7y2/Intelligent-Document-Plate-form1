import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export interface AdminNavItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  private authService = inject(AuthService);
  private router = inject(Router);

  navItems: AdminNavItem[] = [
    { label: 'Overview', route: '/admin/overview', icon: '📊', roles: ['org_admin', 'platform_operator'] },
    { label: 'Users & Roles', route: '/admin/users', icon: '👥', roles: ['org_admin'] },
    { label: 'Document Types', route: '/admin/document-types', icon: '📋', roles: ['org_admin'] },
    { label: 'Workflow Route Builder', route: '/admin/workflow', icon: '🔀', roles: ['org_admin'] },
    { label: 'Retention & Deletion', route: '/admin/retention', icon: '🛡️', roles: ['org_admin'] },
    { label: 'Security & Compliance', route: '/admin/security', icon: '🔒', roles: ['org_admin'] },
    { label: 'Integrations & Webhooks', route: '/admin/integrations', icon: '🔌', roles: ['org_admin'] },
    { label: 'Notification Delivery', route: '/admin/notifications', icon: '🔔', roles: ['org_admin', 'platform_operator'] },
    { label: 'AI Quality Benchmarks', route: '/admin/ai-quality', icon: '🎯', roles: ['org_admin'] },
    { label: 'Audit Logs', route: '/admin/audit', icon: '📜', roles: ['org_admin', 'platform_operator'] },
    { label: 'Reports & Analytics', route: '/admin/reports', icon: '📈', roles: ['org_admin'] },
    { label: 'Operations Center', route: '/admin/operations', icon: '⚙️', roles: ['platform_operator'] },
  ];

  get currentRole(): string {
    return this.authService.currentUser()?.role || 'org_admin';
  }

  get visibleNavItems(): AdminNavItem[] {
    const role = this.currentRole;
    return this.navItems.filter(item => item.roles.includes(role));
  }

  get currentBreadcrumb(): string {
    const url = this.router.url;
    const item = this.navItems.find(i => url.startsWith(i.route));
    if (url.includes('/document-types/')) {
      return 'Document Types / Schema Builder';
    }
    return item ? item.label : 'Overview';
  }
}