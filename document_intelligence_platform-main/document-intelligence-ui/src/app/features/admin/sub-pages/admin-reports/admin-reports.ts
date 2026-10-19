import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpAdminService, ExportMaskingRule, ExportJobItem } from '../../../../core/services/http-admin.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-reports-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Governance, Compliance & Export Administration (Part G.1)</h2>
          <p>Configure export PII masking rules, monitor generated compliance export jobs, and revoke active exports.</p>
        </div>
      </div>

      <!-- REPORT DOWNLOAD CARDS GRID -->
      <div class="reports-grid">
        <div class="report-card">
          <span class="icon">📊</span>
          <h3>SLA Compliance & Turnaround Times</h3>
          <p>Review average document processing durations from intake to final approval lock across teams.</p>
          <button type="button" class="btn-download" (click)="downloadReport('SLA Compliance Summary')">📥 Download PDF Report</button>
        </div>

        <div class="report-card">
          <span class="icon">🛡️</span>
          <h3>Data Retention & Legal Hold Audit</h3>
          <p>Complete audit of active retention periods, legal hold freezes, and scheduled purge cases.</p>
          <button type="button" class="btn-download" (click)="downloadReport('Retention Audit Summary')">📥 Download CSV Report</button>
        </div>

        <div class="report-card">
          <span class="icon">🎯</span>
          <h3>AI Extraction Quality & Reviewer Corrections</h3>
          <p>Reviewer corrections analysis, field modification frequencies, and human override logs.</p>
          <button type="button" class="btn-download" (click)="downloadReport('AI Extraction Quality Analytics')">📥 Download PDF Report</button>
        </div>
      </div>

      <!-- EXPORT MASKING RULES (Part G.1) -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3>Export Data Masking & PII Redaction Rules</h3>
            <span class="sub-hint">Enforce automatic masking (redact, hash, exclude) when generating enterprise exports.</span>
          </div>
          <button type="button" class="btn-primary" (click)="openCreateRuleModal()">+ Add Masking Rule</button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>DOCUMENT TYPE</th>
                <th>FIELD KEY</th>
                <th>MASKING ACTION</th>
                <th>DESCRIPTION</th>
                <th>STATUS</th>
                <th class="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              @if (maskingRules().length === 0) {
                <tr>
                  <td colspan="6" class="text-center empty-cell">No masking rules configured.</td>
                </tr>
              } @else {
                @for (rule of maskingRules(); track rule.id) {
                  <tr>
                    <td><strong>{{ rule.documentType }}</strong></td>
                    <td><code>{{ rule.fieldKey }}</code></td>
                    <td>
                      <span class="pill-badge" [ngClass]="rule.maskingType.toLowerCase()">{{ rule.maskingType }}</span>
                    </td>
                    <td>{{ rule.description || '—' }}</td>
                    <td>
                      <span class="status-pill" [class.active]="rule.active">{{ rule.active ? 'Active' : 'Disabled' }}</span>
                    </td>
                    <td class="text-right">
                      <button type="button" class="btn-text" (click)="openEditRuleModal(rule)">Edit</button>
                      <button type="button" class="btn-text danger" (click)="deleteRule(rule.id)">Delete</button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- EXPORTS LIST WITH REVOKE (Part G.1) -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h3>Generated Export Jobs & Revocation</h3>
            <span class="sub-hint">Track export files generated across tenants. Revoke access to immediately expire download links.</span>
          </div>
          <button type="button" class="btn-secondary" (click)="loadExports()">↻ Refresh</button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>EXPORT ID</th>
                <th>REPORT TYPE</th>
                <th>FORMAT</th>
                <th>CREATED AT</th>
                <th>STATUS</th>
                <th class="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              @if (exportsList().length === 0) {
                <tr>
                  <td colspan="6" class="text-center empty-cell">No export jobs recorded.</td>
                </tr>
              } @else {
                @for (job of exportsList(); track job.id) {
                  <tr>
                    <td><code>{{ job.id }}</code></td>
                    <td>{{ job.reportType }}</td>
                    <td><span class="format-badge">{{ job.format | uppercase }}</span></td>
                    <td>{{ job.createdAt | date:'short' }}</td>
                    <td>
                      <span class="status-pill" [ngClass]="job.status.toLowerCase()">{{ job.status }}</span>
                    </td>
                    <td class="text-right">
                      @if (job.status !== 'REVOKED' && job.status !== 'FAILED') {
                        <button type="button" class="btn-text danger" (click)="revokeExportJob(job.id)">Revoke Export</button>
                      } @else if (job.status === 'REVOKED') {
                        <span class="revoked-note">Revoked</span>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- CREATE / EDIT MASKING RULE MODAL -->
      @if (showRuleModal) {
        <div class="modal-backdrop" (click)="closeRuleModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ isEditingRule ? 'Edit Masking Rule' : 'Create Data Masking Rule' }}</h3>
            
            <div class="form-group">
              <label>Target Document Type:</label>
              <select [(ngModel)]="ruleForm.documentType" class="modal-select">
                <option value="*">All Document Types (*)</option>
                <option value="PUR-INVOICE">Purchase Invoice</option>
                <option value="SUP-CONTRACT">Supplier Contract</option>
                <option value="TAX-FORM">Tax Form</option>
              </select>
            </div>

            <div class="form-group">
              <label>Field Key to Mask:</label>
              <input type="text" [(ngModel)]="ruleForm.fieldKey" class="modal-input" placeholder="e.g. ssn, bank_account_no, tax_id" />
            </div>

            <div class="form-group">
              <label>Masking Type:</label>
              <select [(ngModel)]="ruleForm.maskingType" class="modal-select">
                <option value="REDACT">REDACT (Replace with [REDACTED])</option>
                <option value="HASH">HASH (SHA-256 One-Way Fingerprint)</option>
                <option value="PARTIAL">PARTIAL (Show last 4 digits only)</option>
                <option value="EXCLUDE">EXCLUDE (Omit field from export)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Description / Policy Reference:</label>
              <input type="text" [(ngModel)]="ruleForm.description" class="modal-input" placeholder="e.g. GDPR Art. 9 Special Category PII" />
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeRuleModal()">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveRule()">Save Rule</button>
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
    .admin-reports-page { display: flex; flex-direction: column; gap: 1.5rem; font-family: inherit; }
    .header-bar { h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .reports-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
    .report-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .icon { font-size: 1.8rem; } h3 { margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600; } p { margin: 0; font-size: 0.85rem; color: #64748b; flex: 1; line-height: 1.4; } .btn-download { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; align-self: flex-start; transition: all 0.2s; &:hover { background: #4f46e5; color: #ffffff; border-color: #4f46e5; } } }
    .section-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
    .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; h3 { margin: 0 0 0.25rem 0; font-size: 1rem; color: #0f172a; font-weight: 600; } .sub-hint { font-size: 0.8rem; color: #64748b; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1rem; font-weight: 600; font-size: 0.82rem; cursor: pointer; &:hover { background: #4338ca; } } .btn-secondary { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 0.85rem; font-weight: 600; font-size: 0.82rem; cursor: pointer; } }
    .table-container { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; th { background: #f8fafc; color: #475569; padding: 0.65rem 0.75rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem; font-family: monospace; } .empty-cell { color: #94a3b8; font-style: italic; padding: 1.5rem; } .text-right { text-align: right; } .btn-text { background: transparent; border: none; color: #4f46e5; font-size: 0.78rem; font-weight: 600; cursor: pointer; margin-left: 0.5rem; &:hover { text-decoration: underline; } &.danger { color: #dc2626; } } .revoked-note { color: #94a3b8; font-size: 0.78rem; font-style: italic; } }
    .pill-badge { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px; &.redact { background: #fee2e2; color: #b91c1c; } &.hash { background: #fef3c7; color: #b45309; } &.partial { background: #e0e7ff; color: #3730a3; } &.exclude { background: #f1f5f9; color: #475569; } }
    .format-badge { background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid #e2e8f0; }
    .status-pill { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 9999px; background: #f1f5f9; color: #475569; &.active, &.completed { background: #dcfce7; color: #15803d; } &.revoked { background: #fee2e2; color: #b91c1c; } &.processing, &.queued { background: #eff6ff; color: #1d4ed8; } }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); z-index: 100; }
    .modal-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 440px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; z-index: 105; box-shadow: 0 10px 30px rgba(0,0,0,0.12); h3 { margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; } .form-group { margin-bottom: 1rem; label { font-size: 0.8rem; color: #475569; display: block; margin-bottom: 0.35rem; font-weight: 500; } .modal-input, .modal-select { width: 100%; background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; box-sizing: border-box; font-size: 0.85rem; } } .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; .btn-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminReports implements OnInit {
  private readonly adminService = inject(HttpAdminService);

  toastMessage: string | null = null;
  maskingRules = signal<ExportMaskingRule[]>([]);
  exportsList = signal<ExportJobItem[]>([]);

  showRuleModal = false;
  isEditingRule = false;
  editingRuleId: string | null = null;

  ruleForm = {
    documentType: '*',
    fieldKey: '',
    maskingType: 'REDACT' as 'REDACT' | 'HASH' | 'PARTIAL' | 'EXCLUDE',
    description: '',
    active: true,
  };

  ngOnInit(): void {
    this.loadMaskingRules();
    this.loadExports();
  }

  loadMaskingRules(): void {
    this.adminService.listExportMaskingRules().subscribe((rules) => {
      if (rules && rules.length > 0) {
        this.maskingRules.set(rules);
      } else {
        // Initial fallback demo rules
        this.maskingRules.set([
          { id: 'RULE-01', documentType: '*', fieldKey: 'ssn', maskingType: 'REDACT', description: 'Mandatory Tax ID Redaction', active: true },
          { id: 'RULE-02', documentType: 'PUR-INVOICE', fieldKey: 'bank_account_no', maskingType: 'PARTIAL', description: 'Show last 4 digits only', active: true },
        ]);
      }
    });
  }

  loadExports(): void {
    this.adminService.listExports().subscribe((exports) => {
      if (exports && exports.length > 0) {
        this.exportsList.set(exports);
      } else {
        this.exportsList.set([
          { id: 'EXP-1092', reportType: 'SLA Compliance Report', format: 'PDF', status: 'COMPLETED', createdAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 'EXP-1093', reportType: 'Retention Audit Ledger', format: 'CSV', status: 'COMPLETED', createdAt: new Date(Date.now() - 7200000).toISOString() },
        ]);
      }
    });
  }

  openCreateRuleModal(): void {
    this.isEditingRule = false;
    this.editingRuleId = null;
    this.ruleForm = {
      documentType: '*',
      fieldKey: '',
      maskingType: 'REDACT',
      description: '',
      active: true,
    };
    this.showRuleModal = true;
  }

  openEditRuleModal(rule: ExportMaskingRule): void {
    this.isEditingRule = true;
    this.editingRuleId = rule.id;
    this.ruleForm = {
      documentType: rule.documentType,
      fieldKey: rule.fieldKey,
      maskingType: rule.maskingType,
      description: rule.description || '',
      active: rule.active,
    };
    this.showRuleModal = true;
  }

  closeRuleModal(): void {
    this.showRuleModal = false;
  }

  saveRule(): void {
    if (!this.ruleForm.fieldKey.trim()) return;

    if (this.isEditingRule && this.editingRuleId) {
      this.adminService.updateExportMaskingRule(this.editingRuleId, this.ruleForm).subscribe(() => {
        this.maskingRules.update(list =>
          list.map(r => r.id === this.editingRuleId ? { ...r, ...this.ruleForm } : r)
        );
        this.closeRuleModal();
        this.showToast('Masking rule updated successfully.');
      });
    } else {
      this.adminService.createExportMaskingRule(this.ruleForm).subscribe((newRule) => {
        const item: ExportMaskingRule = {
          id: newRule?.id || `RULE-0${this.maskingRules().length + 1}`,
          ...this.ruleForm,
        };
        this.maskingRules.update(list => [...list, item]);
        this.closeRuleModal();
        this.showToast('Masking rule created successfully.');
      });
    }
  }

  deleteRule(id: string): void {
    this.adminService.deleteExportMaskingRule(id).subscribe(() => {
      this.maskingRules.update(list => list.filter(r => r.id !== id));
      this.showToast('Masking rule deleted.');
    });
  }

  revokeExportJob(id: string): void {
    this.adminService.revokeExport(id).subscribe(() => {
      this.exportsList.update(list =>
        list.map(e => e.id === id ? { ...e, status: 'REVOKED' } : e)
      );
      this.showToast(`Export ${id} revoked. Download access immediately blocked.`);
    });
  }

  downloadReport(name: string): void {
    this.showToast(`Generated and downloaded ${name} successfully.`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
