import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: string;
  channel: string;
  responseStatus: string;
  responseMessage: string;
  status: 'Success' | 'Failure';
}

export interface NotificationDeliveryLog {
  id: string;
  recipient: string;
  templateName: string;
  templateVersion: string;
  channel: 'Email' | 'In-App' | 'SMS';
  state: 'Queued' | 'Sent' | 'Failed' | 'Retrying';
  attempts: number;
  maxAttempts?: number;
  isRetrying?: boolean;
  lastError: string;
  timestamp: string;
  attemptHistory: DeliveryAttempt[];
}

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-notifications-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Notification & Alert Delivery Management</h2>
          <p>Inspect deliverability metrics, retry failed SMTP/In-App notifications, and review attempt histories.</p>
        </div>
      </div>

      <!-- FILTER BAR -->
      <div class="filter-card">
        <div class="filter-group">
          <label>Delivery Status:</label>
          <select [(ngModel)]="deliveryFilterState" class="filter-select">
            <option value="All">All States</option>
            <option value="Queued">Queued</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Retrying">Retrying</option>
          </select>
        </div>
      </div>

      <!-- LOGS TABLE -->
      <div class="table-card">
        <table class="delivery-table">
          <thead>
            <tr>
              <th>LOG ID</th>
              <th>RECIPIENT</th>
              <th>TEMPLATE & VERSION</th>
              <th>CHANNEL</th>
              <th>DELIVERY STATE</th>
              <th>ATTEMPTS</th>
              <th>LAST ERROR REASON</th>
              <th>TIMESTAMP</th>
              <th class="text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (log of filteredLogs; track log.id) {
              <tr>
                <td><code>{{ log.id }}</code></td>
                <td><strong>{{ log.recipient }}</strong></td>
                <td>{{ log.templateName }} <span class="ver-tag">{{ log.templateVersion }}</span></td>
                <td><span class="channel-chip">{{ log.channel }}</span></td>
                <td>
                  <span class="state-badge {{ log.state.toLowerCase() }}">{{ log.state | uppercase }}</span>
                </td>
                <td>{{ log.attempts }} / {{ log.maxAttempts || 5 }}</td>
                <td class="error-cell">{{ log.lastError }}</td>
                <td>{{ log.timestamp }}</td>
                <td class="text-right">
                  <button type="button" class="btn-history" (click)="openAttemptHistory(log)">📜 History</button>
                  <button type="button" class="btn-retry" (click)="retryNotificationDelivery(log)" [disabled]="log.state === 'Sent' || log.isRetrying || log.attempts >= (log.maxAttempts || 5)">
                    {{ log.isRetrying ? 'Retrying...' : '🔁 Retry' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- ATTEMPT HISTORY MODAL -->
      @if (showAttemptHistoryModal && selectedDeliveryLog) {
        <div class="modal-backdrop" (click)="closeAttemptHistory()" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
          <div class="history-modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 id="history-modal-title">Delivery Attempt History: {{ selectedDeliveryLog.id }}</h3>
              <button type="button" class="btn-close" (click)="closeAttemptHistory()" aria-label="Close modal">✕</button>
            </div>
            <div class="modal-body">
              <p>Recipient: <strong>{{ selectedDeliveryLog.recipient }}</strong> · Template: <code>{{ selectedDeliveryLog.templateName }}</code></p>
              
              <table class="attempts-table">
                <thead>
                  <tr>
                    <th>ATTEMPT #</th>
                    <th>TIMESTAMP</th>
                    <th>CHANNEL</th>
                    <th>RESPONSE STATUS</th>
                    <th>RESPONSE MESSAGE</th>
                    <th>RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  @for (att of selectedDeliveryLog.attemptHistory; track att.attemptNumber) {
                    <tr>
                      <td>#{{ att.attemptNumber }}</td>
                      <td>{{ att.timestamp }}</td>
                      <td>{{ att.channel }}</td>
                      <td><code>{{ att.responseStatus }}</code></td>
                      <td>{{ att.responseMessage }}</td>
                      <td>
                        <span class="res-chip {{ att.status.toLowerCase() }}">{{ att.status }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-notifications-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .filter-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .filter-group { display: flex; align-items: center; gap: 0.5rem; label { font-size: 0.82rem; color: #475569; font-weight: 500; } .filter-select { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.4rem 0.65rem; border-radius: 6px; font-size: 0.85rem; } } }
    .table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
    .delivery-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; th { background: #f8fafc; color: #475569; padding: 0.65rem 0.75rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #e2e8f0; } .ver-tag { font-size: 0.72rem; color: #64748b; } .channel-chip { background: #f1f5f9; color: #475569; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0; } .state-badge { font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 9999px; &.sent { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } &.failed { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; } &.retrying { background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; } } .error-cell { font-size: 0.78rem; color: #b91c1c; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .btn-history { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; margin-right: 0.35rem; } .btn-retry { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; } } }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); z-index: 100; }
    .history-modal-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 680px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; z-index: 105; box-shadow: 0 10px 30px rgba(0,0,0,0.12); .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.85rem; h3 { margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; } .btn-close { background: transparent; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer; } } .modal-body { font-size: 0.85rem; color: #475569; margin-top: 1rem; .attempts-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 1rem; th { background: #f8fafc; color: #475569; padding: 0.5rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.5rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } .res-chip { font-weight: 700; font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 9999px; &.success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } &.failure { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; } } } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminNotifications {
  private authService = inject(AuthService);
  deliveryFilterState: 'All' | 'Queued' | 'Sent' | 'Failed' | 'Retrying' = 'All';
  selectedDeliveryLog: NotificationDeliveryLog | null = null;
  showAttemptHistoryModal = false;
  toastMessage: string | null = null;

  notificationLogs: NotificationDeliveryLog[] = [
    {
      id: 'DEL-901',
      recipient: 'reviewer@docnexa.io',
      templateName: 'tpl_review_assignment',
      templateVersion: 'v2.1',
      channel: 'Email',
      state: 'Failed',
      attempts: 3,
      maxAttempts: 5,
      lastError: '550 5.1.1 SMTP relay timeout: MX host unreachable',
      timestamp: '11:32 AM',
      attemptHistory: [
        { attemptNumber: 1, timestamp: '11:28 AM', channel: 'SMTP Email', responseStatus: '504 Gateway Timeout', responseMessage: 'Connection timed out', status: 'Failure' },
        { attemptNumber: 2, timestamp: '11:30 AM', channel: 'SMTP Email', responseStatus: '550 5.1.1', responseMessage: 'MX host unreachable', status: 'Failure' },
        { attemptNumber: 3, timestamp: '11:32 AM', channel: 'SMTP Email', responseStatus: '550 5.1.1', responseMessage: 'MX host unreachable', status: 'Failure' },
      ],
    },
    {
      id: 'DEL-902',
      recipient: 'approver@docnexa.io',
      templateName: 'tpl_approval_requested',
      templateVersion: 'v1.4',
      channel: 'Email',
      state: 'Sent',
      attempts: 1,
      maxAttempts: 5,
      lastError: '—',
      timestamp: '11:15 AM',
      attemptHistory: [
        { attemptNumber: 1, timestamp: '11:15 AM', channel: 'SMTP Email', responseStatus: '250 2.0.0 OK', responseMessage: 'Queued for delivery msg-id 98412', status: 'Success' },
      ],
    },
  ];

  get filteredLogs(): NotificationDeliveryLog[] {
    if (this.deliveryFilterState === 'All') return this.notificationLogs;
    return this.notificationLogs.filter(l => l.state === this.deliveryFilterState);
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(e: any): void {
    if (this.showAttemptHistoryModal) {
      this.closeAttemptHistory();
    }
  }

  openAttemptHistory(log: NotificationDeliveryLog): void {
    this.selectedDeliveryLog = log;
    this.showAttemptHistoryModal = true;
  }

  closeAttemptHistory(): void {
    this.showAttemptHistoryModal = false;
    this.selectedDeliveryLog = null;
  }

  retryNotificationDelivery(log: NotificationDeliveryLog): void {
    if (log.state === 'Sent' || log.isRetrying || log.attempts >= (log.maxAttempts || 5)) return;

    log.isRetrying = true;
    log.state = 'Retrying';
    log.attempts++;

    setTimeout(() => {
      log.isRetrying = false;
      log.state = 'Sent';
      log.lastError = '—';
      log.attemptHistory.push({
        attemptNumber: log.attempts,
        timestamp: 'Just now',
        channel: log.channel,
        responseStatus: '250 2.0.0 OK',
        responseMessage: 'Manual retry succeeded via SMTP relay',
        status: 'Success',
      });
      this.showToast(`Notification ${log.id} successfully retried & delivered!`);
    }, 1000);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
