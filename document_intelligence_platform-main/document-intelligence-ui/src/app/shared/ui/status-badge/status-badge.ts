import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LifecycleStatus =
  | 'Received'
  | 'Quarantined'
  | 'Validated'
  | 'Processing'
  | 'Review'
  | 'Pending approval'
  | 'Approved/Published'
  | 'Approved'
  | 'Published'
  | 'Rejected'
  | 'Superseded'
  | 'Held'
  | 'Expired'
  | 'Purged';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge" [class]="normalizedClass">
      <span class="dot"></span>
      <span>{{ displayLabel }}</span>
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      &.received { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      &.quarantined { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      &.validated { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
      &.processing { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }
      &.review { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
      &.pending-approval { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
      &.approved-published, &.approved, &.published { background: #ecfdf5; color: #16a34a; border: 1px solid #a7f3d0; }
      &.rejected { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      &.superseded { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
      &.held { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
      &.expired { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
      &.purged { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; text-decoration: line-through; }
    }
  `]
})
export class StatusBadge {
  @Input({ required: true }) status: string = 'Received';

  get normalizedClass(): string {
    const raw = (this.status || '').toLowerCase().trim();
    if (raw.includes('approved') || raw.includes('published')) return 'approved-published';
    if (raw.includes('pending')) return 'pending-approval';
    if (raw.includes('quarantine')) return 'quarantined';
    if (raw.includes('process')) return 'processing';
    if (raw.includes('review')) return 'review';
    if (raw.includes('supersede')) return 'superseded';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('held')) return 'held';
    if (raw.includes('expire')) return 'expired';
    if (raw.includes('purge')) return 'purged';
    if (raw.includes('validate')) return 'validated';
    return 'received';
  }

  get displayLabel(): string {
    const raw = (this.status || '').trim();
    if (raw.toLowerCase() === 'approved' || raw.toLowerCase() === 'published') return 'Approved/Published';
    return raw;
  }
}
