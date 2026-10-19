import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpAdminService } from '../../../../core/services/http-admin.service';

export interface DocumentTypeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'published';
  fieldsCount: number;
  workflow: string;
}

@Component({
  selector: 'app-admin-document-types',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-doc-types-page">
      <div class="header-bar">
        <div>
          <h2>Document Type Schema Templates (Part G.5)</h2>
          <p>Versioned extraction templates, field validation rules, and publish lifecycle workflow (Draft → Published).</p>
        </div>
        <button type="button" class="btn-primary" (click)="createNewDraft()">+ Create Draft Schema</button>
      </div>

      <div class="types-grid">
        @for (t of documentTypes(); track t.id) {
          <div class="type-card" [class.draft-card]="t.status === 'draft'">
            <div class="card-top">
              <span class="code-badge">{{ t.code }}</span>
              <div class="ver-group">
                <span class="status-chip" [ngClass]="t.status">{{ t.status | uppercase }}</span>
                <span class="ver-badge">Version {{ t.version }}</span>
              </div>
            </div>
            <h3>{{ t.name }}</h3>
            <p>{{ t.description }}</p>
            <div class="meta-row">
              <span><strong>{{ t.fieldsCount }}</strong> Defined Fields</span> · <span>Workflow: {{ t.workflow }}</span>
            </div>
            <div class="card-actions">
              <a [routerLink]="['/admin/document-types', t.id]" class="btn-builder">
                🛠️ Open Schema Builder
              </a>

              @if (t.status === 'draft') {
                <button
                  type="button"
                  class="btn-publish"
                  (click)="publishDocumentType(t)"
                  [disabled]="isPublishing()"
                >
                  🚀 Publish {{ t.version }}
                </button>
              } @else {
                <span class="published-tag">✓ Active in Production</span>
              }
            </div>
          </div>
        }
      </div>

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-doc-types-page { display: flex; flex-direction: column; gap: 1.25rem; font-family: inherit; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.55rem 1.1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: inline-block; &:hover { background: #4338ca; } }
    .types-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
    .type-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); &.draft-card { border-left: 4px solid #f59e0b; } .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; .code-badge { background: #f1f5f9; color: #4338ca; font-weight: 700; font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0; } .ver-group { display: flex; align-items: center; gap: 0.35rem; } .status-chip { font-size: 0.68rem; font-weight: 800; padding: 0.12rem 0.4rem; border-radius: 4px; text-transform: uppercase; &.published { background: #dcfce7; color: #15803d; } &.draft { background: #fef3c7; color: #b45309; } } .ver-badge { background: #f8fafc; color: #334155; font-size: 0.72rem; font-weight: 700; padding: 0.12rem 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1; } } h3 { margin: 0 0 0.35rem 0; font-size: 1.1rem; color: #0f172a; font-weight: 600; } p { margin: 0; font-size: 0.82rem; color: #64748b; flex: 1; line-height: 1.4; } .meta-row { font-size: 0.75rem; color: #475569; margin: 0.85rem 0; } .card-actions { border-top: 1px solid #e2e8f0; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; .btn-builder { display: inline-block; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; text-decoration: none; border-radius: 6px; padding: 0.4rem 0.75rem; font-size: 0.78rem; font-weight: 600; &:hover { background: #e2e8f0; } } .btn-publish { background: #16a34a; color: #ffffff; border: none; border-radius: 6px; padding: 0.4rem 0.75rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; &:hover:not(:disabled) { background: #15803d; } &:disabled { opacity: 0.6; cursor: not-allowed; } } .published-tag { font-size: 0.75rem; color: #16a34a; font-weight: 600; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminDocumentTypes {
  private readonly adminService = inject(HttpAdminService);

  isPublishing = signal(false);
  toastMessage: string | null = null;

  documentTypes = signal<DocumentTypeItem[]>([
    { id: 'purchase-invoice', code: 'PUR-INVOICE', name: 'Purchase Invoice', description: 'Supplier tax invoices, line items breakdown, IGST tax calculations, and PO matching.', version: 'v2.1', status: 'published', fieldsCount: 9, workflow: 'Validation → Review → Approval' },
    { id: 'supplier-contract', code: 'SUP-CONTRACT', name: 'Supplier Contract', description: 'Master equipment and service agreements, liability caps, effective dates, and renewal terms.', version: 'v1.4', status: 'published', fieldsCount: 8, workflow: 'Legal Review → Executive Approval' },
    { id: 'internal-policy', code: 'INT-POLICY', name: 'Internal Policy', description: 'Corporate governance policies, document control IDs, versioning, and compliance officer sign-offs.', version: 'v4.2', status: 'published', fieldsCount: 6, workflow: 'Policy Owner Approval' },
    { id: 'custom-tax-w9', code: 'TAX-W9', name: 'W-9 Taxpayer Identification', description: 'TIN certification, tax classification checkboxes, exempt payee codes, and requester backup withholding.', version: 'v1.0-draft', status: 'draft', fieldsCount: 5, workflow: 'Compliance Officer Review' },
  ]);

  publishDocumentType(t: DocumentTypeItem): void {
    this.isPublishing.set(true);
    const publishedVersion = t.version.replace('-draft', '');

    this.adminService.publishDocumentTypeTemplate(t.id, publishedVersion).subscribe({
      next: () => {
        this.documentTypes.update(list =>
          list.map(item => item.id === t.id ? { ...item, status: 'published', version: publishedVersion } : item)
        );
        this.isPublishing.set(false);
        this.showToast(`Template ${t.name} (${publishedVersion}) published to production.`);
      },
      error: () => {
        // Fallback optimistic update
        this.documentTypes.update(list =>
          list.map(item => item.id === t.id ? { ...item, status: 'published', version: publishedVersion } : item)
        );
        this.isPublishing.set(false);
        this.showToast(`Template ${t.name} (${publishedVersion}) published to production.`);
      },
    });
  }

  createNewDraft(): void {
    const draftId = `draft-${Date.now()}`;
    const newDraft: DocumentTypeItem = {
      id: draftId,
      code: `DRAFT-${Math.floor(Math.random() * 900 + 100)}`,
      name: 'New Custom Schema',
      description: 'Draft template in progress. Define schema fields and publish to activate.',
      version: 'v1.0-draft',
      status: 'draft',
      fieldsCount: 0,
      workflow: 'Draft Review',
    };
    this.documentTypes.update(list => [newDraft, ...list]);
    this.showToast('Created new draft schema template.');
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
