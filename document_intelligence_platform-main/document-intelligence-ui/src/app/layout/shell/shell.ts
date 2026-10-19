import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { SessionWarningModal } from '../../shared/ui/session-warning-modal/session-warning-modal';
import { DevPanel } from '../../shared/ui/dev-panel/dev-panel';
import { NotificationCenter } from '../notification-center/notification-center';
import { IdleTimerService } from '../../core/services/idle-timer.service';
import { UiStateService } from '../../core/services/ui-state';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Sidebar,
    Topbar,
    SessionWarningModal,
    DevPanel,
    NotificationCenter,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit, OnDestroy {
  private readonly idleTimerService = inject(IdleTimerService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly uiState = inject(UiStateService);

  readonly isOffline = signal(false);

  private onlineListener?: () => void;
  private offlineListener?: () => void;

  ngOnInit(): void {
    this.idleTimerService.init(15);

    if (isPlatformBrowser(this.platformId)) {
      this.isOffline.set(!navigator.onLine);

      this.onlineListener = () => this.isOffline.set(false);
      this.offlineListener = () => this.isOffline.set(true);

      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    }
  }

  ngOnDestroy(): void {
    this.idleTimerService.destroy();

    if (isPlatformBrowser(this.platformId)) {
      if (this.onlineListener) window.removeEventListener('online', this.onlineListener);
      if (this.offlineListener) window.removeEventListener('offline', this.offlineListener);
    }
  }

  checkConnectivity(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isOffline.set(!navigator.onLine);
    }
  }
}