import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdleTimerService } from '../../../core/services/idle-timer.service';

@Component({
  selector: 'app-session-warning-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-warning-modal.html',
  styleUrls: ['./session-warning-modal.scss'],
})
export class SessionWarningModal {
  idleTimerService = inject(IdleTimerService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.idleTimerService.isWarningVisible()) {
      this.staySignedIn();
    }
  }

  staySignedIn(): void {
    this.idleTimerService.staySignedIn();
  }

  signOut(): void {
    this.idleTimerService.signOut();
  }
}
