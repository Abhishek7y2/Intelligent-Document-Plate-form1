import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockSettingsService } from '../../../core/services/mock-settings.service';

@Component({
  selector: 'app-dev-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dev-panel.html',
  styleUrls: ['./dev-panel.scss'],
})
export class DevPanel {
  mockSettings = inject(MockSettingsService);
  isOpen = false;

  togglePanel(): void {
    this.isOpen = !this.isOpen;
  }

  toggleFailNext(): void {
    this.mockSettings.toggleFailNext();
  }

  updateLatency(min: number, max: number): void {
    this.mockSettings.setLatency(min, max);
  }

  updateFailureRate(rate: number): void {
    this.mockSettings.setFailureRate(rate);
  }
}
