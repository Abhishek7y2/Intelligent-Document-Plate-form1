import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class IdleTimerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);

  readonly isWarningVisible = signal(false);
  readonly secondsRemaining = signal(60);

  private timeoutMinutes = 15; // default 15 mins
  private idleTimer: any = null;
  private warningTimer: any = null;
  private countdownTimer: any = null;

  init(timeoutMinutes = 15): void {
    this.timeoutMinutes = timeoutMinutes;

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((evt) => {
      window.addEventListener(evt, this.resetIdleTimer, { passive: true });
    });

    this.startTimers();
  }

  destroy(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((evt) => {
      window.removeEventListener(evt, this.resetIdleTimer);
    });

    this.clearAllTimers();
  }

  resetIdleTimer = (): void => {
    if (this.isWarningVisible()) {
      // Don't auto-reset while warning dialog is active
      return;
    }
    this.startTimers();
  };

  staySignedIn(): void {
    this.isWarningVisible.set(false);
    this.startTimers();
  }

  signOut(): void {
    this.isWarningVisible.set(false);
    this.clearAllTimers();
    this.authService.logout();
  }

  private startTimers(): void {
    this.clearAllTimers();

    if (!this.authService.isAuthenticated()) {
      return;
    }

    const warningDelayMs = Math.max((this.timeoutMinutes * 60 - 60) * 1000, 10000);

    this.warningTimer = setTimeout(() => {
      this.triggerWarning();
    }, warningDelayMs);
  }

  private triggerWarning(): void {
    this.secondsRemaining.set(60);
    this.isWarningVisible.set(true);

    this.countdownTimer = setInterval(() => {
      const remaining = this.secondsRemaining() - 1;
      this.secondsRemaining.set(remaining);

      if (remaining <= 0) {
        this.signOut();
      }
    }, 1000);
  }

  private clearAllTimers(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }
}
