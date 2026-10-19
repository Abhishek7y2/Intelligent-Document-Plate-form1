import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  name: string;
  type: 'sequential' | 'parallel';
  approverRole: 'reviewer' | 'approver' | 'org_admin' | 'finance_head';
  quorum: string;
  conditionalRule: string;
  sodRule: 'none' | 'submitter_cannot_approve' | 'reviewer_cannot_approve';
  slaHours: number;
}

@Component({
  selector: 'app-admin-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-workflow-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Approval Route & Separation of Duties Builder</h2>
          <p>Design data-driven routing policies, parallel approver quorums, SLA gates, and SoD compliance rules.</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedDocType" (change)="loadWorkflowForDocType()" class="doctype-select">
            <option value="PUR-INVOICE">Purchase Invoice (PUR-INVOICE)</option>
            <option value="SUP-CONTRACT">Supplier Contract (SUP-CONTRACT)</option>
            <option value="INT-POLICY">Internal Policy (INT-POLICY)</option>
          </select>
          <button type="button" class="btn-primary" (click)="publishWorkflowPolicy()">Publish New Policy Version</button>
        </div>
      </div>

      <!-- POLICY VERSION BANNER -->
      <div class="policy-banner">
        <span class="icon">📜</span>
        <div>
          <strong>Active Policy Version: {{ activePolicyVersion }}</strong> · Document Type: <code>{{ selectedDocType }}</code> · Separation of Duties: <span class="badge active">ENFORCED</span>
        </div>
      </div>

      <!-- VISUAL CANVAS / ROUTE PREVIEW -->
      <div class="canvas-card">
        <h3>Visual Route Preview</h3>
        <div class="canvas-nodes">
          <div class="node start-node">
            <span class="node-icon">📥</span>
            <div class="node-title">Document Ingestion</div>
            <span class="node-sub">OCR & Extraction</span>
          </div>

          <div class="connector-line">➔</div>

          @for (step of steps; track step.id; let idx = $index) {
            <div class="node step-node" [class.parallel]="step.type === 'parallel'">
              <div class="step-num">Step {{ step.stepNumber }}</div>
              <div class="node-title">{{ step.name }}</div>
              <div class="node-meta">
                <span class="badge role">{{ step.approverRole | uppercase }}</span>
                <span class="badge type">{{ step.type | uppercase }}</span>
              </div>
              <div class="node-sub">
                Quorum: <strong>{{ step.quorum }}</strong> · SLA: <strong>{{ step.slaHours }}h</strong>
              </div>
              @if (step.conditionalRule) {
                <div class="cond-tag">⚡ {{ step.conditionalRule }}</div>
              }
            </div>

            <div class="connector-line">➔</div>
          }

          <div class="node end-node">
            <span class="node-icon">✅</span>
            <div class="node-title">Published</div>
            <span class="node-sub">Repository & ERP Sign-off</span>
          </div>
        </div>
      </div>

      <!-- STEPS CONFIGURATION TABLE & BUILDER -->
      <div class="steps-card">
        <div class="card-header">
          <h3>Workflow Steps Configuration</h3>
          <button type="button" class="btn-add" (click)="addStep()">+ Add Approval Step</button>
        </div>

        <table class="steps-table">
          <thead>
            <tr>
              <th>STEP #</th>
              <th>STEP NAME</th>
              <th>EXECUTION MODE</th>
              <th>APPROVER ROLE</th>
              <th>QUORUM REQUIREMENT</th>
              <th>CONDITIONAL THRESHOLD RULE</th>
              <th>SEPARATION OF DUTIES (SoD)</th>
              <th>SLA (HOURS)</th>
              <th class="text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (step of steps; track step.id; let idx = $index) {
              <tr>
                <td><strong>#{{ step.stepNumber }}</strong></td>
                <td>
                  <input type="text" [(ngModel)]="step.name" class="table-input" />
                </td>
                <td>
                  <select [(ngModel)]="step.type" class="table-select">
                    <option value="sequential">Sequential</option>
                    <option value="parallel">Parallel</option>
                  </select>
                </td>
                <td>
                  <select [(ngModel)]="step.approverRole" class="table-select">
                    <option value="reviewer">Reviewer</option>
                    <option value="approver">Approver</option>
                    <option value="finance_head">Finance Head / VP</option>
                    <option value="org_admin">Organization Admin</option>
                  </select>
                </td>
                <td>
                  <input type="text" [(ngModel)]="step.quorum" class="table-input" placeholder="e.g. 1 of 1 or 2 of 3" />
                </td>
                <td>
                  <input type="text" [(ngModel)]="step.conditionalRule" class="table-input" placeholder="e.g. amount > $50,000" />
                </td>
                <td>
                  <select [(ngModel)]="step.sodRule" class="table-select">
                    <option value="none">No Restrictions</option>
                    <option value="submitter_cannot_approve">Submitter Cannot Approve</option>
                    <option value="reviewer_cannot_approve">Reviewer Cannot Approve</option>
                  </select>
                </td>
                <td>
                  <input type="number" [(ngModel)]="step.slaHours" class="table-input num" />
                </td>
                <td class="text-right">
                  <button type="button" class="btn-del" (click)="deleteStep(idx)" [disabled]="steps.length <= 1">✕</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-workflow-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .header-actions { display: flex; gap: 0.75rem; .doctype-select { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem; border-radius: 6px; font-size: 0.82rem; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.55rem 1.1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; } } }
    .policy-banner { display: flex; align-items: center; gap: 0.75rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; color: #334155; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; color: #4338ca; } .badge.active { background: #dcfce7; color: #15803d; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.72rem; font-weight: 800; } }
    .canvas-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); h3 { margin: 0 0 1rem 0; font-size: 1rem; color: #0f172a; } }
    .canvas-nodes { display: flex; align-items: center; gap: 0.75rem; overflow-x: auto; padding: 0.5rem 0; }
    .connector-line { color: #94a3b8; font-size: 1.2rem; font-weight: bold; }
    .node { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem 1rem; min-width: 170px; display: flex; flex-direction: column; gap: 0.35rem; &.start-node { border-color: #4f46e5; background: #eef2ff; } &.end-node { border-color: #10b981; background: #ecfdf5; } &.parallel { border-color: #f59e0b; background: #fffbeb; } .node-icon { font-size: 1.4rem; } .node-title { font-weight: 700; font-size: 0.85rem; color: #0f172a; } .node-sub { font-size: 0.72rem; color: #64748b; } .node-meta { display: flex; gap: 0.35rem; .badge { font-size: 0.65rem; font-weight: 700; padding: 0.05rem 0.35rem; border-radius: 4px; &.role { background: #e0e7ff; color: #4338ca; } &.type { background: #fef3c7; color: #b45309; } } } .cond-tag { background: #e0e7ff; color: #3730a3; font-size: 0.68rem; padding: 0.15rem 0.35rem; border-radius: 4px; } }
    .steps-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; h3 { margin: 0; font-size: 1rem; color: #0f172a; } .btn-add { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.85rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; } } }
    .steps-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; th { background: #f8fafc; color: #64748b; padding: 0.65rem; text-align: left; font-size: 0.72rem; border-bottom: 1px solid #e2e8f0; } td { padding: 0.65rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } .table-input, .table-select { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 4px; padding: 0.35rem 0.5rem; font-size: 0.8rem; width: 100%; box-sizing: border-box; &.num { width: 70px; } } .btn-del { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem; &:disabled { opacity: 0.3; cursor: not-allowed; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; }
  `]
})
export class AdminWorkflow implements OnInit {
  selectedDocType = 'PUR-INVOICE';
  activePolicyVersion = 'v1.4-Policy';
  toastMessage: string | null = null;

  steps: WorkflowStep[] = [];

  ngOnInit(): void {
    this.loadWorkflowForDocType();
  }

  loadWorkflowForDocType(): void {
    if (this.selectedDocType === 'PUR-INVOICE') {
      this.activePolicyVersion = 'v2.1-Policy';
      this.steps = [
        { id: 's1', stepNumber: 1, name: 'Extraction & Tax Validation Review', type: 'sequential', approverRole: 'reviewer', quorum: '1 of 1', conditionalRule: '', sodRule: 'submitter_cannot_approve', slaHours: 24 },
        { id: 's2', stepNumber: 2, name: 'Finance Executive Approval', type: 'parallel', approverRole: 'approver', quorum: '2 of 3', conditionalRule: 'Total Amount > $50,000', sodRule: 'reviewer_cannot_approve', slaHours: 48 },
      ];
    } else if (this.selectedDocType === 'SUP-CONTRACT') {
      this.activePolicyVersion = 'v1.8-Policy';
      this.steps = [
        { id: 's1', stepNumber: 1, name: 'Legal Clause & Risk Review', type: 'sequential', approverRole: 'reviewer', quorum: '1 of 1', conditionalRule: '', sodRule: 'submitter_cannot_approve', slaHours: 36 },
        { id: 's2', stepNumber: 2, name: 'Executive Sign-off', type: 'sequential', approverRole: 'finance_head', quorum: '1 of 1', conditionalRule: 'Contract Value > $100,000', sodRule: 'reviewer_cannot_approve', slaHours: 72 },
      ];
    } else {
      this.activePolicyVersion = 'v3.0-Policy';
      this.steps = [
        { id: 's1', stepNumber: 1, name: 'Policy Owner Approval', type: 'sequential', approverRole: 'org_admin', quorum: '1 of 1', conditionalRule: '', sodRule: 'none', slaHours: 24 },
      ];
    }
  }

  addStep(): void {
    const newStep: WorkflowStep = {
      id: `s_${Date.now()}`,
      stepNumber: this.steps.length + 1,
      name: `Step ${this.steps.length + 1} Approval`,
      type: 'sequential',
      approverRole: 'approver',
      quorum: '1 of 1',
      conditionalRule: '',
      sodRule: 'submitter_cannot_approve',
      slaHours: 24,
    };
    this.steps.push(newStep);
  }

  deleteStep(index: number): void {
    if (this.steps.length <= 1) return;
    this.steps.splice(index, 1);
    this.steps.forEach((s, idx) => s.stepNumber = idx + 1);
  }

  publishWorkflowPolicy(): void {
    const majorVer = parseInt(this.activePolicyVersion.replace('v', '').split('.')[0]) + 1;
    this.activePolicyVersion = `v${majorVer}.0-Policy`;
    this.showToast(`Published new workflow policy ${this.activePolicyVersion} for ${this.selectedDocType}!`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
