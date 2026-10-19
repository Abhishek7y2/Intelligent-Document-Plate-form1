import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpAdminService, TraceTimelineEvent } from '../../../../core/services/http-admin.service';

@Component({
  selector: 'app-admin-trace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-trace-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Correlation ID Trace & Distributed Timeline (Part G.3)</h2>
          <p>Inspect end-to-end processing across audit records, transactional outbox events, and pipeline worker attempts.</p>
        </div>
      </div>

      <!-- SEARCH INPUT CARD -->
      <div class="search-card">
        <label for="trace-input" class="search-label">Correlation ID</label>
        <div class="search-row">
          <input
            id="trace-input"
            type="text"
            [(ngModel)]="correlationId"
            placeholder="e.g. corr-98412-01 or REQ-1738491-992"
            (keydown.enter)="searchTrace()"
            class="trace-input"
            aria-label="Correlation ID to trace"
          />
          <button
            type="button"
            class="btn-search"
            [disabled]="isLoading() || !correlationId.trim()"
            (click)="searchTrace()"
          >
            {{ isLoading() ? 'Tracing...' : 'Trace Timeline' }}
          </button>
        </div>
      </div>

      <!-- TIMELINE RESULTS -->
      @if (isLoading()) {
        <div class="loading-box">
          <span class="spinner"></span>
          <span>Aggregating audit logs, outbox events, and worker attempts...</span>
        </div>
      } @else if (searched() && timeline().length === 0) {
        <div class="empty-card">
          <span class="empty-icon">🔍</span>
          <h3>No events found for correlation ID</h3>
          <p>No audit trail records, outbox queue events, or processing attempts match "<code>{{ correlationId }}</code>".</p>
        </div>
      } @else if (timeline().length > 0) {
        <div class="results-card">
          <div class="results-header">
            <div>
              <h3>Timeline for <code>{{ correlationId }}</code></h3>
              <span class="count-badge">{{ timeline().length }} Combined Events</span>
            </div>
            <div class="counts-summary">
              <span class="tag audit">Audit: {{ auditCount() }}</span>
              <span class="tag outbox">Outbox: {{ outboxCount() }}</span>
              <span class="tag attempt">Attempts: {{ attemptCount() }}</span>
            </div>
          </div>

          <div class="timeline-container">
            @for (event of timeline(); track event.id) {
              <div class="timeline-item">
                <div class="timeline-indicator" [ngClass]="event.source.toLowerCase()">
                  @if (event.source === 'AUDIT') { 🛡️ }
                  @else if (event.source === 'OUTBOX') { ✉️ }
                  @else { ⚙️ }
                </div>

                <div class="timeline-content">
                  <div class="event-header">
                    <div class="event-title-group">
                      <span class="source-badge" [ngClass]="event.source.toLowerCase()">{{ event.source }}</span>
                      <strong class="event-type">{{ event.type }}</strong>
                      <span class="status-pill" [ngClass]="event.status.toLowerCase()">{{ event.status }}</span>
                    </div>
                    <span class="event-time">{{ event.timestamp | date:'medium' }}</span>
                  </div>

                  <div class="event-details">
                    <pre>{{ event.details | json }}</pre>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-trace-page { display: flex; flex-direction: column; gap: 1.25rem; font-family: inherit; }
    .header-bar { h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .search-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .search-label { display: block; font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.35rem; } .search-row { display: flex; gap: 0.75rem; } .trace-input { flex: 1; padding: 0.6rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; font-family: monospace; outline: none; &:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); } } .btn-search { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.6rem 1.25rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; &:hover:not(:disabled) { background: #4338ca; } &:disabled { opacity: 0.5; cursor: not-allowed; } } }
    .loading-box { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 3rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #64748b; font-size: 0.9rem; .spinner { width: 1.2rem; height: 1.2rem; border: 2px solid #cbd5e1; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 3rem; text-align: center; color: #64748b; .empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; } h3 { margin: 0 0 0.25rem 0; color: #0f172a; font-size: 1.1rem; } p { margin: 0; font-size: 0.85rem; } }
    .results-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9; h3 { margin: 0 0 0.25rem 0; font-size: 1.1rem; color: #0f172a; } .count-badge { font-size: 0.75rem; color: #64748b; } .counts-summary { display: flex; gap: 0.5rem; .tag { font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; &.audit { background: #eff6ff; color: #1d4ed8; } &.outbox { background: #fdf4ff; color: #9333ea; } &.attempt { background: #f0fdf4; color: #15803d; } } } } }
    .timeline-container { position: relative; padding-left: 2rem; display: flex; flex-direction: column; gap: 1.5rem; &::before { content: ''; position: absolute; left: 0.95rem; top: 0.5rem; bottom: 0.5rem; width: 2px; background: #e2e8f0; } }
    .timeline-item { position: relative; display: flex; gap: 1rem; align-items: flex-start; }
    .timeline-indicator { position: absolute; left: -2rem; top: 0.1rem; width: 1.9rem; height: 1.9rem; border-radius: 50%; background: #ffffff; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; z-index: 2; &.audit { border-color: #3b82f6; background: #eff6ff; } &.outbox { border-color: #a855f7; background: #faf5ff; } &.attempt { border-color: #22c55e; background: #f0fdf4; } }
    .timeline-content { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; .event-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem; .event-title-group { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; .source-badge { font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; text-transform: uppercase; &.audit { background: #dbeafe; color: #1e40af; } &.outbox { background: #f3e8ff; color: #6b21a8; } &.attempt { background: #dcfce7; color: #166534; } } .event-type { font-size: 0.9rem; color: #0f172a; font-family: monospace; } .status-pill { font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 9999px; background: #e2e8f0; color: #475569; &.succeeded, &.completed, &.recorded { background: #dcfce7; color: #15803d; } &.failed { background: #fee2e2; color: #b91c1c; } } } .event-time { font-size: 0.75rem; color: #64748b; } } .event-details pre { margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.6rem; font-size: 0.75rem; color: #334155; max-height: 200px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; word-break: break-all; } }
  `]
})
export class AdminTrace implements OnInit {
  private readonly adminService = inject(HttpAdminService);
  private readonly route = inject(ActivatedRoute);

  correlationId = '';
  isLoading = signal(false);
  searched = signal(false);
  timeline = signal<TraceTimelineEvent[]>([]);
  auditCount = signal(0);
  outboxCount = signal(0);
  attemptCount = signal(0);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const q = params['correlationId'];
      if (q) {
        this.correlationId = q;
        this.searchTrace();
      }
    });
  }

  searchTrace(): void {
    const id = this.correlationId.trim();
    if (!id) return;

    this.isLoading.set(true);
    this.searched.set(true);

    this.adminService.getTraceTimeline(id).subscribe({
      next: (res) => {
        const events = res?.timeline || [];
        this.timeline.set(events);
        this.auditCount.set(res?.auditEvents?.length || events.filter(e => e.source === 'AUDIT').length);
        this.outboxCount.set(res?.outboxEvents?.length || events.filter(e => e.source === 'OUTBOX').length);
        this.attemptCount.set(res?.processingAttempts?.length || events.filter(e => e.source === 'ATTEMPT').length);
        this.isLoading.set(false);
      },
      error: () => {
        this.timeline.set([]);
        this.isLoading.set(false);
      },
    });
  }
}
