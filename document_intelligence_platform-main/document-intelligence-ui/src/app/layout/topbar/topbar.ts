import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService, AuthUser } from '../../core/services/auth';
import { UiStateService } from '../../core/services/ui-state';
import { NOTIFICATION_SERVICE_TOKEN } from '../../core/services/api-services';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: NOTIFICATION_SERVICE_TOKEN, useExisting: NotificationService }],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly uiState = inject(UiStateService);
  readonly notificationService = inject(NOTIFICATION_SERVICE_TOKEN);


  currentUser: AuthUser | null = null;

  constructor() {
    this.currentUser = this.authService.getCurrentUser();
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.uiState.toggleSidebar();
  }

  onLogoHover(): void {
    this.uiState.openSidebar();
  }

  onLogoLeave(): void {
    this.uiState.scheduleCloseSidebar();
  }

  onLogoClick(): void {
    this.uiState.toggleSidebar();
  }

  toggleNotifications(): void {
    this.notificationService.toggleDrawer();
  }
}