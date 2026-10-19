import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AuditLogEntry {
  id: string;
  actor: string;
  role: string;
  event: string;
  resource: string;
  correlationId: string;
  ipAddress: string;
  timestamp: string;
  payloadJson: any;
}

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-audit-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>System Immutable Audit Logs & Event Trace</h2>
          <p>Search, inspect, and export cryptographically verifiable event logs for security compliance (BRD Section 15).</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-secondary" (click)="exportAuditLog('csv')">📥 Export Masked CSV</button>
          <button type="button" class="btn-primary" (click)="exportAuditLog('json')">📥 Export JSON Payload</button>
        </div>
      </div>

      <!-- FILTER BAR -->
      <div class="filter-card">
        <div class="search-box">
          <span>⌕</span>
          <input type="text" [(ngModel)]="searchTerm" placeholder="Search by actor, event, resource, or correlation ID..." />
        </div>

        <select [(ngModel)]="selectedEvent">
          <option value="all">All Events</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="DOCUMENT_PUBLISHED">DOCUMENT_PUBLISHED</option>
          <option value="ROLE_MODIFIED">ROLE_MODIFIED</option>
          <option value="LEGAL_HOLD_PLACED">LEGAL_HOLD_PLACED</option>
          <option value="PURGE_EXECUTED">PURGE_EXECUTED</option>
        </select>
      </div>

      <!-- AUDIT LOG TABLE -->
      <div class="table-card">
        <table class="audit-table">
          <thead>
            <tr>
              <th>EVENT LOG ID</th>
              <th>ACTOR & ROLE</th>
              <th>EVENT TYPE</th>
              <th>TARGET RESOURCE</th>
              <th>CORRELATION ID</th>
              <th>IP ADDRESS</th>
              <th>TIMESTAMP</th>
              <th class="text-right">INSPECT</th>
            </tr>
          </thead>
          <tbody>
            @for (log of filteredLogs; track log.id) {
              <tr>
                <td><code>{{ log.id }}</code></td>
                <td>
                  <strong>{{ log.actor }}</strong>
                  <span class="role-sub">{{ log.role }}</span>
                </td>
                <td><span class="event-chip {{ log.event.toLowerCase() }}">{{ log.event }}</span></td>
                <td><code>{{ log.resource }}</code></td>
                <td><code>{{ log.correlationId }}</code></td>
                <td>{{ log.ipAddress }}</td>
                <td>{{ log.timestamp }}</td>
                <td class="text-right">
                  <button type="button" class="btn-inspect" (click)="inspectPayload(log)">🔍 JSON Payload</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- JSON PAYLOAD INSPECTOR DRAWER -->
      @if (selectedLog) {
        <div class="drawer-backdrop" (click)="selectedLog = null">
          <div class="drawer-card" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <h3>Audit Event JSON Payload</h3>
              <button type="button" class="btn-close" (click)="selectedLog = null">✕</button>
            </div>
            <div class="drawer-body">
              <div class="meta-row">
                <div><strong>Event:</strong> {{ selectedLog.event }}</div>
                <div><strong>Correlation ID:</strong> {{ selectedLog.correlationId }}</div>
                <div><strong>Actor:</strong> {{ selectedLog.actor }} ({{ selectedLog.role }})</div>
              </div>

              <div class="json-code-box">
                <div class="json-header">
                  <span>SENSITIVE FIELDS MASKED (***MASKED***)</span>
                </div>
                <pre><code>{{ selectedLog.payloadJson | json }}</code></pre>
              </div>
            </div>
            <div class="drawer-footer">
              <button type="button" class="btn-secondary" (click)="selectedLog = null">Close</button>
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
    .admin-audit-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .header-actions { display: flex; gap: 0.75rem; .btn-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } } }
    .filter-card { display: flex; gap: 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .search-box { flex: 1; display: flex; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 0.65rem; span { color: #64748b; margin-right: 0.4rem; } input { width: 100%; background: transparent; border: none; color: #0f172a; padding: 0.45rem 0; font-size: 0.85rem; &:focus { outline: none; } } } select { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 6px; padding: 0.45rem; font-size: 0.85rem; } }
    .table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
    .audit-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; th { background: #f8fafc; color: #475569; padding: 0.65rem 0.75rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #e2e8f0; } .role-sub { display: block; font-size: 0.72rem; color: #64748b; } .event-chip { font-weight: 700; font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 9999px; &.login_success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } &.document_published { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; } &.legal_hold_placed { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; } } .btn-inspect { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; } }
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); z-index: 100; }
    .drawer-card { position: fixed; top: 0; right: 0; bottom: 0; width: 520px; background: #ffffff; border-left: 1px solid #e2e8f0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; z-index: 105; box-shadow: -4px 0 24px rgba(0,0,0,0.1); .drawer-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.85rem; h3 { margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; } .btn-close { background: transparent; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer; } } .drawer-body { flex: 1; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; .meta-row { font-size: 0.85rem; color: #0f172a; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0; } .json-code-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 1rem; .json-header { font-size: 0.7rem; font-weight: 700; color: #4ade80; margin-bottom: 0.5rem; } pre { margin: 0; font-family: monospace; font-size: 0.78rem; color: #a5b4fc; white-space: pre-wrap; word-break: break-all; } } } .drawer-footer { border-top: 1px solid #e2e8f0; padding-top: 1rem; display: flex; justify-content: flex-end; .btn-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminAudit implements OnInit {
  searchTerm = '';
  selectedEvent = 'all';
  selectedLog: AuditLogEntry | null = null;
  toastMessage: string | null = null;

  logs: AuditLogEntry[] = [
    {
      id: 'AUD-88901',
      actor: 'Abhishek Yadav',
      role: 'org_admin',
      event: 'DOCUMENT_PUBLISHED',
      resource: 'DOC-90412',
      correlationId: 'corr-98412-01',
      ipAddress: '203.0.113.4',
      timestamp: '06 Oct 2026 · 11:30 AM',
      payloadJson: {
        action: 'PUBLISH_SCHEMA_VERSION',
        targetDocumentType: 'Purchase Invoice',
        versionPublished: 'v2.1',
        fieldsCount: 9,
        sensitiveApiKey: '***MASKED***',
        clientIp: '203.0.113.4',
      }
    },
    {
      id: 'AUD-88902',
      actor: 'Abhishek Yadav',
      role: 'org_admin',
      event: 'LEGAL_HOLD_PLACED',
      resource: 'LIT-2026-889',
      correlationId: 'corr-98412-02',
      ipAddress: '203.0.113.4',
      timestamp: '02 Oct 2026 · 04:15 PM',
      payloadJson: {
        action: 'PLACE_LEGAL_HOLD',
        matterNumber: 'LIT-2026-889',
        reason: 'Subpoena issued for supplier agreement records',
        authorizedBy: 'Abhishek Yadav',
      }
    }
  ];

  ngOnInit(): void {}

  get filteredLogs(): AuditLogEntry[] {
    const s = this.searchTerm.trim().toLowerCase();
    return this.logs.filter(l => {
      const matchSearch = !s || l.actor.toLowerCase().includes(s) || l.event.toLowerCase().includes(s) || l.resource.toLowerCase().includes(s) || l.correlationId.toLowerCase().includes(s);
      const matchEvent = this.selectedEvent === 'all' || l.event === this.selectedEvent;
      return matchSearch && matchEvent;
    });
  }

  inspectPayload(log: AuditLogEntry): void {
    this.selectedLog = log;
  }

  exportAuditLog(format: 'csv' | 'json'): void {
    this.showToast(`Exported immutable audit logs as masked.${format}`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
