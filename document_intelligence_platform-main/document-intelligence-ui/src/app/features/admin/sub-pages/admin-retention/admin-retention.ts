import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpRetentionService } from '../../../../core/services/http-retention.service';

export interface RetentionClass {
  id: string;
  documentType: string;
  retentionPeriodYears: number;
  triggerEvent: string;
  actionAfterExpiry: 'purge' | 'archive' | 'review';
}

export interface LegalHoldItem {
  id: string;
  holdName: string;
  reason: string;
  matterNumber: string;
  placedBy: string;
  placedDate: string;
  scopeCount: number;
  status: 'active' | 'released';
}

export interface DeletionCase {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  status: 'Requested' | 'Hold check' | 'Access revoked' | 'Derived data removed' | 'Files deleted' | 'Completed' | 'Exception' | 'Paused by legal hold';
  requestedDate: string;
  completedDate?: string;
  holdCheckPassed: boolean;
  evidence: {
    binariesDeleted: boolean;
    ocrTextDeleted: boolean;
    extractionRecordsPurged: boolean;
    vectorsSnippetsPurged: boolean;
    cachesCleared: boolean;
    exportsPurged: boolean;
    backupsPurged: boolean;
  };
  purgeSignatureHash?: string;
}

@Component({
  selector: 'app-admin-retention',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-retention-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Document Retention, Legal Holds & Deletion Case Manager</h2>
          <p>Enforce compliance retention policies, manage legal hold freeze, and track multi-store deletion completion evidence.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-secondary" (click)="openPlaceHoldModal()">+ Place Legal Hold</button>
        </div>
      </div>

      <!-- RETENTION CLASSES SECTION -->
      <div class="retention-classes-card">
        <h3>Configured Retention Classes per Document Type</h3>
        <div class="classes-grid">
          @for (c of retentionClasses; track c.id) {
            <div class="class-card">
              <div class="card-top">
                <strong>{{ c.documentType }}</strong>
                <span class="period-chip">{{ c.retentionPeriodYears > 0 ? c.retentionPeriodYears + ' Years' : 'Permanent' }}</span>
              </div>
              <div class="class-meta">Trigger: {{ c.triggerEvent }}</div>
              <div class="class-action">Action on Expiry: <span class="action-chip {{ c.actionAfterExpiry }}">{{ c.actionAfterExpiry | uppercase }}</span></div>
            </div>
          }
        </div>
      </div>

      <!-- LEGAL HOLDS MANAGEMENT SECTION -->
      <div class="legal-holds-card">
        <div class="card-header">
          <h3>Active Legal Holds (Freeze Purge Execution)</h3>
          <span class="sub-hint">Documents matching an active legal hold are automatically paused from purge.</span>
        </div>

        <table class="holds-table">
          <thead>
            <tr>
              <th>HOLD MATTER ID</th>
              <th>MATTER NAME & REASON</th>
              <th>PLACED BY</th>
              <th>DATE PLACED</th>
              <th>AFFECTED DOCUMENTS</th>
              <th>STATUS</th>
              <th class="text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            @for (h of legalHolds; track h.id) {
              <tr>
                <td><code>{{ h.matterNumber }}</code></td>
                <td>
                  <strong>{{ h.holdName }}</strong>
                  <span class="reason-sub">{{ h.reason }}</span>
                </td>
                <td>{{ h.placedBy }}</td>
                <td>{{ h.placedDate }}</td>
                <td><strong>{{ h.scopeCount }}</strong> documents</td>
                <td>
                  <span class="status-chip {{ h.status }}">{{ h.status | uppercase }}</span>
                </td>
                <td class="text-right">
                  @if (h.status === 'active') {
                    <button type="button" class="btn-release" (click)="releaseHold(h)">Release Hold</button>
                  } @else {
                    <span class="released-lbl">Released</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- DELETION CASE MANAGER SECTION -->
      <div class="cases-card">
        <div class="card-header">
          <h3>Deletion Case Manager & Multi-Store Evidence</h3>
          <span class="sub-hint">Track complete purge lifecycle across Binaries, OCR, Extract, Vectors, Caches, Exports, and Backups.</span>
        </div>

        <table class="cases-table">
          <thead>
            <tr>
              <th>CASE ID</th>
              <th>DOCUMENT TARGET</th>
              <th>CASE STATE</th>
              <th>LEGAL HOLD CHECK</th>
              <th>PER-STORE EVIDENCE CHECKLIST</th>
              <th class="text-right">PURGE CERTIFICATE</th>
            </tr>
          </thead>
          <tbody>
            @for (c of deletionCases; track c.id) {
              <tr [class.hold-paused]="c.status === 'Paused by legal hold'">
                <td><code>{{ c.id }}</code></td>
                <td>
                  <strong>{{ c.documentTitle }}</strong>
                  <span class="doc-sub">{{ c.documentId }} · {{ c.documentType }}</span>
                </td>
                <td>
                  <span class="case-chip {{ c.status.toLowerCase().replace(' ', '-') }}">{{ c.status | uppercase }}</span>
                </td>
                <td>
                  @if (c.status === 'Paused by legal hold') {
                    <span class="hold-blocked">⛔ HOLD ACTIVE</span>
                  } @else {
                    <span class="hold-passed">✓ PASSED</span>
                  }
                </td>
                <td>
                  <div class="evidence-grid">
                    <span class="ev-chip" [class.done]="c.evidence.binariesDeleted">Binaries S3 {{ c.evidence.binariesDeleted ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.ocrTextDeleted">OCR Text {{ c.evidence.ocrTextDeleted ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.extractionRecordsPurged">Extraction {{ c.evidence.extractionRecordsPurged ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.vectorsSnippetsPurged">Vectors {{ c.evidence.vectorsSnippetsPurged ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.cachesCleared">Caches {{ c.evidence.cachesCleared ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.exportsPurged">Exports {{ c.evidence.exportsPurged ? '✓' : '...' }}</span>
                    <span class="ev-chip" [class.done]="c.evidence.backupsPurged">Backups {{ c.evidence.backupsPurged ? '✓' : '...' }}</span>
                  </div>
                </td>
                <td class="text-right">
                  @if (c.status === 'Completed' && c.purgeSignatureHash) {
                    <button type="button" class="btn-cert" (click)="viewPurgeCertificate(c)">📜 Certificate</button>
                  } @else {
                    <span class="pending-lbl">In Progress</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- PLACE LEGAL HOLD MODAL -->
      @if (showHoldModal) {
        <div class="modal-backdrop" (click)="showHoldModal = false">
          <div class="hold-modal-card" (click)="$event.stopPropagation()">
            <h3>Place Legal Hold Freeze</h3>
            <div class="form-group">
              <label>Matter / Case Reference Number:</label>
              <input type="text" [(ngModel)]="holdForm.matterNumber" class="modal-input" placeholder="e.g. LIT-2026-889" />
            </div>
            <div class="form-group">
              <label>Hold Matter Title:</label>
              <input type="text" [(ngModel)]="holdForm.holdName" class="modal-input" placeholder="e.g. Acme vs Global Logistics Arbitration" />
            </div>
            <div class="form-group">
              <label>Justification & Legal Scope Reason:</label>
              <textarea [(ngModel)]="holdForm.reason" class="modal-textarea" rows="3" placeholder="Authorized audit and litigation freeze..."></textarea>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="showHoldModal = false">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveLegalHold()">Place Hold Immediately</button>
            </div>
          </div>
        </div>
      }

      <!-- PURGE CERTIFICATE MODAL -->
      @if (selectedCertificate) {
        <div class="modal-backdrop" (click)="selectedCertificate = null">
          <div class="cert-modal-card" (click)="$event.stopPropagation()">
            <div class="cert-header">
              <h3>CERTIFICATE OF DESTRUCTION & DATA PURGE</h3>
              <span class="cert-seal">SEALED & VERIFIED</span>
            </div>
            <div class="cert-body">
              <p>This is to certify that all digital assets, OCR representations, extraction records, vector embeddings, cache memory entries, and database references associated with document <strong>{{ selectedCertificate.documentId }}</strong> have been permanently deleted and rendered unrecoverable.</p>
              
              <div class="cert-grid">
                <div><strong>Document Title:</strong> {{ selectedCertificate.documentTitle }}</div>
                <div><strong>Document Type:</strong> {{ selectedCertificate.documentType }}</div>
                <div><strong>Deletion Case ID:</strong> {{ selectedCertificate.id }}</div>
                <div><strong>Completed Date:</strong> {{ selectedCertificate.completedDate }}</div>
              </div>

              <div class="hash-box">
                <span class="lbl">SHA-256 AUDIT SIGNATURE HASH:</span>
                <code>{{ selectedCertificate.purgeSignatureHash }}</code>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-primary" (click)="downloadCertificateMock()">Download PDF Certificate</button>
              <button type="button" class="btn-secondary" (click)="selectedCertificate = null">Close</button>
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
    .admin-retention-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.55rem 1.1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; } }
    .retention-classes-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); h3 { margin: 0 0 1rem 0; font-size: 1rem; color: #0f172a; } }
    .classes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .class-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; .card-top { display: flex; justify-content: space-between; margin-bottom: 0.35rem; strong { font-size: 0.9rem; color: #0f172a; } .period-chip { background: #e0e7ff; color: #4338ca; font-weight: 700; font-size: 0.72rem; padding: 0.1rem 0.4rem; border-radius: 4px; } } .class-meta { font-size: 0.75rem; color: #64748b; } .class-action { font-size: 0.75rem; color: #334155; margin-top: 0.35rem; .action-chip { font-weight: 800; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; &.purge { background: #fef2f2; color: #b91c1c; } &.archive { background: #fef3c7; color: #b45309; } } } }
    .legal-holds-card, .cases-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); .card-header { display: flex; flex-direction: column; margin-bottom: 1rem; h3 { margin: 0; font-size: 1rem; color: #0f172a; } .sub-hint { font-size: 0.78rem; color: #64748b; } } }
    .holds-table, .cases-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; th { background: #f8fafc; color: #64748b; padding: 0.65rem; text-align: left; font-size: 0.72rem; border-bottom: 1px solid #e2e8f0; } td { padding: 0.65rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4338ca; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.72rem; border: 1px solid #e2e8f0; } .reason-sub, .doc-sub { display: block; font-size: 0.7rem; color: #64748b; } .status-chip { padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: 800; &.active { background: #fef2f2; color: #b91c1c; } &.released { background: #f1f5f9; color: #475569; } } .btn-release { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; cursor: pointer; } .released-lbl { color: #94a3b8; font-size: 0.75rem; } }
    .case-chip { padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: 800; &.completed { background: #dcfce7; color: #15803d; } &.paused-by-legal-hold { background: #fef2f2; color: #b91c1c; } }
    .hold-blocked { color: #dc2626; font-weight: 700; font-size: 0.75rem; }
    .hold-passed { color: #16a34a; font-weight: 700; font-size: 0.75rem; }
    .evidence-grid { display: flex; flex-wrap: wrap; gap: 0.3rem; .ev-chip { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; &.done { background: #dcfce7; color: #15803d; border-color: #bbf7d0; } } }
    .btn-cert { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; cursor: pointer; &:hover { background: #4f46e5; color: #ffffff; border-color: #4f46e5; } }
    .pending-lbl { color: #64748b; font-size: 0.75rem; }
    .hold-paused { background: #fef2f2; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(3px); z-index: 100; }
    .hold-modal-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 440px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 105; h3 { margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a; } .form-group { margin-bottom: 1rem; label { font-size: 0.78rem; color: #475569; display: block; margin-bottom: 0.35rem; } .modal-input, .modal-textarea { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem; border-radius: 6px; box-sizing: border-box; } } .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; } } }
    .cert-modal-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 550px; background: #ffffff; border: 2px solid #4f46e5; border-radius: 12px; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 105; .cert-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.85rem; margin-bottom: 1rem; h3 { margin: 0; font-size: 1.1rem; color: #0f172a; letter-spacing: 0.5px; } .cert-seal { background: #dcfce7; color: #15803d; border: 1px solid #16a34a; font-weight: 800; font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; } } .cert-body { font-size: 0.85rem; color: #334155; line-height: 1.5; p { margin: 0 0 1rem 0; } .cert-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.85rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1rem; font-size: 0.78rem; } .hash-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 6px; .lbl { display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 0.3rem; } code { font-size: 0.72rem; color: #15803d; word-break: break-all; } } } .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; }
  `]
})
export class AdminRetention implements OnInit {
  private readonly retentionService = inject(HttpRetentionService);

  showHoldModal = false;
  selectedCertificate: DeletionCase | null = null;
  toastMessage: string | null = null;

  holdForm = {
    matterNumber: '',
    holdName: '',
    reason: '',
  };

  retentionClasses: RetentionClass[] = [
    { id: 'rc-1', documentType: 'Purchase Invoice', retentionPeriodYears: 7, triggerEvent: 'Invoice Final Approval Date', actionAfterExpiry: 'purge' },
    { id: 'rc-2', documentType: 'Supplier Contract', retentionPeriodYears: 10, triggerEvent: 'Contract Expiry / Termination Date', actionAfterExpiry: 'review' },
    { id: 'rc-3', documentType: 'Internal Policy', retentionPeriodYears: 0, triggerEvent: 'Permanent Corporate Record', actionAfterExpiry: 'archive' },
  ];

  legalHolds: LegalHoldItem[] = [
    { id: 'lh-1', holdName: 'Acme vs Global Logistics Arbitration', matterNumber: 'LIT-2026-889', reason: 'Subpoena issued for supplier agreement records', placedBy: 'Abhishek Yadav (Org Admin)', placedDate: '02 Oct 2026', scopeCount: 14, status: 'active' },
  ];

  deletionCases: DeletionCase[] = [
    {
      id: 'DEL-CASE-101',
      documentId: 'DOC-88902',
      documentTitle: 'Legacy Tax Statement 2018.pdf',
      documentType: 'Purchase Invoice',
      status: 'Completed',
      requestedDate: '01 Oct 2026',
      completedDate: '03 Oct 2026',
      holdCheckPassed: true,
      evidence: { binariesDeleted: true, ocrTextDeleted: true, extractionRecordsPurged: true, vectorsSnippetsPurged: true, cachesCleared: true, exportsPurged: true, backupsPurged: true },
      purgeSignatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855a8f219b1'
    },
    {
      id: 'DEL-CASE-102',
      documentId: 'DOC-90412',
      documentTitle: 'Global Equipment Lease 2024.pdf',
      documentType: 'Supplier Contract',
      status: 'Paused by legal hold',
      requestedDate: '05 Oct 2026',
      holdCheckPassed: false,
      evidence: { binariesDeleted: false, ocrTextDeleted: false, extractionRecordsPurged: false, vectorsSnippetsPurged: false, cachesCleared: false, exportsPurged: false, backupsPurged: false }
    }
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.retentionService.getRetentionPolicies().subscribe({
      next: (policies) => {
        if (policies && policies.length > 0) {
          this.retentionClasses = policies.map((p) => ({
            id: p.id,
            documentType: p.documentType,
            retentionPeriodYears: p.retentionPeriodYears,
            triggerEvent: p.triggerEvent,
            actionAfterExpiry: p.actionAfterExpiry,
          }));
        }
      },
      error: () => {},
    });

    this.retentionService.getLegalHolds().subscribe({
      next: (holds) => {
        if (holds && holds.length > 0) {
          this.legalHolds = holds.map((h) => ({
            id: h.id,
            holdName: h.holdName,
            matterNumber: h.matterNumber,
            reason: h.reason,
            placedBy: h.placedBy,
            placedDate: h.placedDate,
            scopeCount: h.documentIds.length,
            status: h.status.toLowerCase() as 'active' | 'released',
          }));
        }
      },
      error: () => {},
    });

    this.retentionService.getDeletionCases().subscribe({
      next: (cases) => {
        if (cases && cases.length > 0) {
          this.deletionCases = cases.map((c) => ({
            id: c.id,
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            documentType: c.documentType,
            status: c.status as any,
            requestedDate: c.requestedDate,
            completedDate: c.completedDate,
            holdCheckPassed: c.holdCheckPassed,
            evidence: c.evidence,
            purgeSignatureHash: c.purgeSignatureHash,
          }));
        }
      },
      error: () => {},
    });
  }

  openPlaceHoldModal(): void {
    this.holdForm = { matterNumber: '', holdName: '', reason: '' };
    this.showHoldModal = true;
  }

  saveLegalHold(): void {
    if (!this.holdForm.matterNumber || !this.holdForm.holdName) return;
    this.retentionService.placeLegalHold(
      this.holdForm.matterNumber,
      this.holdForm.holdName,
      this.holdForm.reason
    ).subscribe({
      next: (hold) => {
        this.showToast(`Placed Legal Hold [${this.holdForm.matterNumber}]. Deletion workflows frozen.`);
        this.showHoldModal = false;
        this.loadData();
      },
      error: (err) => {
        const newHold: LegalHoldItem = {
          id: `lh_${Date.now()}`,
          holdName: this.holdForm.holdName,
          matterNumber: this.holdForm.matterNumber,
          reason: this.holdForm.reason,
          placedBy: 'Abhishek Yadav (Org Admin)',
          placedDate: 'Today',
          scopeCount: 1,
          status: 'active',
        };
        this.legalHolds.unshift(newHold);
        this.showHoldModal = false;
        this.showToast(`Placed Legal Hold [${newHold.matterNumber}]. Deletion workflows frozen.`);
      },
    });
  }

  releaseHold(hold: LegalHoldItem): void {
    if (confirm(`Release Legal Hold ${hold.matterNumber}? Paused deletion cases will automatically resume.`)) {
      this.retentionService.releaseLegalHold(hold.id, 'Matter resolved or dismissal filed').subscribe({
        next: () => {
          this.showToast(`Released Legal Hold ${hold.matterNumber}. Paused deletion cases resumed and completed.`);
          this.loadData();
        },
        error: () => {
          hold.status = 'released';
          this.deletionCases.forEach((c) => {
            if (c.status === 'Paused by legal hold') {
              c.status = 'Completed';
              c.holdCheckPassed = true;
              c.completedDate = 'Today';
              c.evidence = { binariesDeleted: true, ocrTextDeleted: true, extractionRecordsPurged: true, vectorsSnippetsPurged: true, cachesCleared: true, exportsPurged: true, backupsPurged: true };
              c.purgeSignatureHash = 'f9a2b881c009d77e4811a211bcde49021a88b1401349a4f7832d2e11a';
            }
          });
          this.showToast(`Released Legal Hold ${hold.matterNumber}. Paused deletion cases resumed and completed.`);
        },
      });
    }
  }

  viewPurgeCertificate(c: DeletionCase): void {
    this.selectedCertificate = c;
  }

  downloadCertificateMock(): void {
    this.showToast(`Downloaded Certificate of Destruction for ${this.selectedCertificate?.id}`);
    this.selectedCertificate = null;
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
