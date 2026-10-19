import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-overview-page">
      <div class="overview-header">
        <div>
          <h2>Organization Governance & Platform Overview</h2>
          <p>Tenant: <strong>Acme Corporation Global</strong> · Enterprise Plan · Status: <span class="badge active">ACTIVE</span></p>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <span class="icon">👥</span>
          <div>
            <span class="lbl">Active Tenant Users</span>
            <strong class="val">28 Users</strong>
          </div>
        </div>
        <div class="metric-card">
          <span class="icon">📋</span>
          <div>
            <span class="lbl">Document Type Schemas</span>
            <strong class="val">3 Configured</strong>
          </div>
        </div>
        <div class="metric-card">
          <span class="icon">⚡</span>
          <div>
            <span class="lbl">Active Workflows</span>
            <strong class="val">v1.4-Policy</strong>
          </div>
        </div>
        <div class="metric-card">
          <span class="icon">🎯</span>
          <div>
            <span class="lbl">Extraction Accuracy</span>
            <strong class="val green">94.2% AI</strong>
          </div>
        </div>
      </div>

      <div class="quick-nav-grid">
        <a routerLink="/admin/users" class="nav-card">
          <span class="icon">👥</span>
          <h3>Users & Roles</h3>
          <p>Invite team members, assign workspace scopes, manage MFA rules, and deactivate access.</p>
        </a>
        <a routerLink="/admin/document-types" class="nav-card">
          <span class="icon">📋</span>
          <h3>Document Type Schemas</h3>
          <p>Configure field schemas, confidence thresholds, PII masking, and versioned templates.</p>
        </a>
        <a routerLink="/admin/workflow" class="nav-card">
          <span class="icon">🔀</span>
          <h3>Approval Route Builder</h3>
          <p>Design sequential & parallel routes, quorum rules, threshold gates, and SoD policies.</p>
        </a>
        <a routerLink="/admin/retention" class="nav-card">
          <span class="icon">🛡️</span>
          <h3>Retention & Deletion Cases</h3>
          <p>Manage legal holds, deletion cases, per-store completion evidence, and purge certificates.</p>
        </a>
        <a routerLink="/admin/integrations" class="nav-card">
          <span class="icon">🔌</span>
          <h3>Integrations & Webhooks</h3>
          <p>Configure ERP/CLM export mappings, SAML/OIDC SSO, email intake, and signed webhooks.</p>
        </a>
        <a routerLink="/admin/ai-quality" class="nav-card">
          <span class="icon">🎯</span>
          <h3>AI Quality Benchmarks</h3>
          <p>Monitor field precision/recall, CER, citation accuracy, and reviewer override rates.</p>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .admin-overview-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .overview-header { h2 { margin: 0; font-size: 1.25rem; color: #0f172a; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .badge.active { background: #dcfce7; color: #15803d; padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 800; } }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .metric-card { display: flex; align-items: center; gap: 0.75rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); .icon { font-size: 1.4rem; } .lbl { font-size: 0.75rem; color: #64748b; display: block; } .val { font-size: 1.2rem; color: #0f172a; &.green { color: #16a34a; } } }
    .quick-nav-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
    .nav-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); transition: all 0.2s ease; &:hover { border-color: #4f46e5; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(79, 70, 229, 0.1); } .icon { font-size: 1.5rem; } h3 { margin: 0.5rem 0 0.35rem 0; font-size: 1rem; color: #0f172a; font-weight: 700; } p { margin: 0; font-size: 0.82rem; color: #64748b; line-height: 1.4; } }
  `]
})
export class AdminOverview {}
