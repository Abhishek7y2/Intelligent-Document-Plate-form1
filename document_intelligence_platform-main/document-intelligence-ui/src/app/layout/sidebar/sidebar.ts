import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UiStateService } from '../../core/services/ui-state';
import { AuthService } from '../../core/services/auth.service';
import { hasRoleAccess } from '../../core/models/permissions';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
  ],
  host: {
    '[class.pinned]': 'uiState.sidebarPinned()',
  },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly uiState = inject(UiStateService);
  readonly authService = inject(AuthService);

  canAccess(routePath: string): boolean {
    const role = this.authService.currentUser()?.role;
    return hasRoleAccess(role, routePath);
  }

  closeMobileSidebar(): void {
    this.uiState.closeSidebar(true);
    if (this.uiState.isMobile()) {
      this.uiState.sidebarPinned.set(false);
    }
  }

  toggleSidebar(): void {
    this.uiState.toggleSidebar();
  }

  togglePin(): void {
    this.uiState.togglePin();
  }

  onSidebarMouseEnter(): void {
    this.uiState.cancelScheduledClose();
  }

  onSidebarMouseLeave(): void {
    this.uiState.scheduleCloseSidebar();
  }
}