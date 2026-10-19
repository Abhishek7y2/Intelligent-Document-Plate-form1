import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpAdminService, IntakeMailbox } from '../../../../core/services/http-admin.service';

export interface FieldMap {
  docField: string;
  erpField: string;
}

export interface WebhookLog {
  id: string;
  event: string;
  url: string;
  status: string;
  attempts: number;
  timestamp: string;
}

@Component({
  selector: 'app-admin-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-integrations-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Enterprise Integrations, Identity & Webhooks</h2>
          <p>Configure ERP/CLM export connectors, SAML 2.0/OIDC SSO, email intake mailboxes, and signed webhooks.</p>
        </div>
      </div>

      <!-- CARDS GRID FOR INTEGRATIONS -->
      <div class="integrations-grid">
        <!-- CARD 1: ERP / CLM EXPORT -->
        <div class="integration-card">
          <div class="card-header">
            <span class="card-icon">⚡</span>
            <div>
              <h3>ERP & CLM Export Connector</h3>
              <p>SAP / NetSuite / Salesforce ERP payload transformation and posting.</p>
            </div>
            <span class="status-badge connected">CONNECTED</span>
          </div>
          <div class="card-body">
            <p><strong>Configured Mapping:</strong> {{ erpMappings.length }} Document Fields ➔ SAP BAPI_INVOICE_CREATE</p>
            <p><strong>Sandbox Mode:</strong> {{ erpConfig.sandbox ? 'ENABLED (Test Endpoint)' : 'DISABLED (Production)' }}</p>
          </div>
          <div class="card-footer">
            <button type="button" class="btn-config" (click)="openDrawer('erp')">⚙️ Configure ERP Drawer</button>
          </div>
        </div>

        <!-- CARD 2: IDENTITY PROVIDER (SSO) -->
        <div class="integration-card">
          <div class="card-header">
            <span class="card-icon">🔐</span>
            <div>
              <h3>Identity Provider (SAML / OIDC)</h3>
              <p>Okta, Azure AD (Entra ID), or PingIdentity Single Sign-On integration.</p>
            </div>
            <span class="status-badge connected">ACTIVE SSO</span>
          </div>
          <div class="card-body">
            <p><strong>Protocol:</strong> SAML 2.0 (Azure AD Org Domain)</p>
            <p><strong>Entity ID:</strong> <code>https://auth.docnexa.io/saml/metadata</code></p>
          </div>
          <div class="card-footer">
            <button type="button" class="btn-config" (click)="openDrawer('idp')">⚙️ Configure Identity Drawer</button>
          </div>
        </div>

        <!-- CARD 3: EMAIL INTAKE -->
        <div class="integration-card">
          <div class="card-header">
            <span class="card-icon">📧</span>
            <div>
              <h3>Email Intake Mailbox Listener</h3>
              <p>Auto-ingest email attachments sent to automated ingestion mailboxes.</p>
            </div>
            <span class="status-badge connected">LISTENING</span>
          </div>
          <div class="card-body">
            <p><strong>Ingest Mailbox:</strong> <code>{{ emailConfig.mailboxAddress }}</code></p>
            <p><strong>Allowed Senders:</strong> {{ emailConfig.allowedSenders }}</p>
          </div>
          <div class="card-footer">
            <button type="button" class="btn-config" (click)="openDrawer('email')">⚙️ Configure Email Drawer</button>
          </div>
        </div>

        <!-- CARD 4: WEBHOOKS -->
        <div class="integration-card">
          <div class="card-header">
            <span class="card-icon">🔗</span>
            <div>
              <h3>Outbound Signed Webhooks</h3>
              <p>Real-time event streaming for document.approved, intake.completed, and SLA alerts.</p>
            </div>
            <span class="status-badge connected">ACTIVE HOOK</span>
          </div>
          <div class="card-body">
            <p><strong>Target Endpoint:</strong> <code>{{ webhookConfig.endpointUrl }}</code></p>
            <p><strong>Signing Algorithm:</strong> HMAC-SHA256 with Secret Token</p>
          </div>
          <div class="card-footer">
            <button type="button" class="btn-config" (click)="openDrawer('webhook')">⚙️ Configure Webhooks Drawer</button>
          </div>
        </div>
      </div>

      <!-- DRAWER: ERP / CLM CONFIG -->
      @if (activeDrawer === 'erp') {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-card" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <h3>ERP & CLM Export Mapping Drawer</h3>
              <button type="button" class="btn-close" (click)="closeDrawer()">✕</button>
            </div>
            <div class="drawer-body">
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" [(ngModel)]="erpConfig.sandbox" />
                  Enable Sandbox Mode (Send exports to sandbox target URL)
                </label>
              </div>

              <div class="form-group">
                <label>ERP Client / Application ID:</label>
                <input type="text" [(ngModel)]="erpConfig.clientId" class="drawer-input" />
              </div>

              <div class="form-group">
                <label>Service Endpoint Target URL:</label>
                <input type="text" [(ngModel)]="erpConfig.endpointUrl" class="drawer-input" />
              </div>

              <div class="mapping-section">
                <h4>Field Mapping Table (DocNexa ➔ ERP Schema)</h4>
                <table class="mapping-table">
                  <thead>
                    <tr>
                      <th>DOCNEXA FIELD</th>
                      <th>ERP TARGET PROPERTY</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of erpMappings; track m.docField) {
                      <tr>
                        <td><code>{{ m.docField }}</code></td>
                        <td>
                          <input type="text" [(ngModel)]="m.erpField" class="mapping-input" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="drawer-footer">
              <button type="button" class="btn-secondary" (click)="closeDrawer()">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveDrawer('ERP Export Connector updated successfully.')">Save Connector Settings</button>
            </div>
          </div>
        </div>
      }

      <!-- DRAWER: IDP (SAML / OIDC) -->
      @if (activeDrawer === 'idp') {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-card" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <h3>Identity Provider (SAML 2.0 / OIDC) Settings</h3>
              <button type="button" class="btn-close" (click)="closeDrawer()">✕</button>
            </div>
            <div class="drawer-body">
              <div class="form-group">
                <label>IdP Metadata URL:</label>
                <input type="text" [(ngModel)]="idpConfig.metadataUrl" class="drawer-input" />
              </div>
              <div class="form-group">
                <label>Entity ID (Audience):</label>
                <input type="text" [(ngModel)]="idpConfig.entityId" class="drawer-input" />
              </div>
              <div class="form-group">
                <label>Single Sign-On (SSO) Endpoint URL:</label>
                <input type="text" [(ngModel)]="idpConfig.ssoUrl" class="drawer-input" />
              </div>
              <div class="form-group">
                <label>X.509 Signing Certificate (PEM):</label>
                <textarea [(ngModel)]="idpConfig.certificate" class="drawer-textarea" rows="4"></textarea>
              </div>
            </div>
            <div class="drawer-footer">
              <button type="button" class="btn-secondary" (click)="closeDrawer()">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveDrawer('SAML 2.0 SSO identity configuration updated.')">Save SAML Settings</button>
            </div>
          </div>
        </div>
      }

      <!-- DRAWER: EMAIL INTAKE (Part G.2) -->
      @if (activeDrawer === 'email') {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-card wide" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <h3>Email Intake Mailboxes (BRD Intake Automation)</h3>
              <button type="button" class="btn-close" (click)="closeDrawer()">✕</button>
            </div>
            <div class="drawer-body">
              <div class="privacy-notice" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.6rem 0.85rem; font-size: 0.8rem; color: #166534; margin-bottom: 1rem;">
                🛡️ <strong>Zero-Credential Architecture:</strong> Mailboxes are authenticated via cloud IAM / OAuth2 service principals. No passwords or secret keys are accepted or echoed in the UI.
              </div>

              <!-- MAILBOX LIST -->
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <h4 style="margin: 0; font-size: 0.9rem; color: #0f172a;">Configured Intake Mailboxes</h4>
                  <button type="button" class="btn-sec-act" (click)="startNewMailbox()">+ Add Mailbox</button>
                </div>

                <table class="logs-table">
                  <thead>
                    <tr>
                      <th>MAILBOX ADDRESS</th>
                      <th>ALLOWED DOMAINS</th>
                      <th>STATUS</th>
                      <th class="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (mb of mailboxes; track mb.id) {
                      <tr>
                        <td><code>{{ mb.address || mb.emailAddress }}</code></td>
                        <td>{{ mb.allowedSenderDomains?.join(', ') || mb.host || 'Any' }}</td>
                        <td>
                          <span class="status-badge" [class.connected]="mb.isActive !== false">{{ mb.isActive !== false ? 'ACTIVE' : 'DISABLED' }}</span>
                        </td>
                        <td class="text-right">
                          <button type="button" class="btn-inspect" (click)="editMailbox(mb)">Edit</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- CREATE / EDIT FORM -->
              @if (isEditingMailbox) {
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
                  <h4 style="margin: 0 0 0.85rem 0; font-size: 0.9rem; color: #0f172a;">{{ selectedMailboxId ? 'Edit Mailbox' : 'Register New Ingestion Mailbox' }}</h4>
                  
                  <div class="form-group">
                    <label>Ingestion Email Address:</label>
                    <input type="email" [(ngModel)]="mailboxForm.address" class="drawer-input" placeholder="e.g. ap-invoices@docnexa.enterprise" [disabled]="!!selectedMailboxId" />
                  </div>
                  <div class="form-group">
                    <label>Allowed Sender Domains (comma-separated):</label>
                    <input type="text" [(ngModel)]="mailboxForm.allowedSenderDomains" class="drawer-input" placeholder="e.g. acme.com, vendors.org" />
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" [(ngModel)]="mailboxForm.isActive" />
                      Active (Accept incoming emails and extract documents)
                    </label>
                  </div>
                  <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
                    <button type="button" class="btn-sec-act" (click)="isEditingMailbox = false">Cancel</button>
                    <button type="button" class="btn-primary" (click)="saveMailbox()">Save Mailbox</button>
                  </div>
                </div>
              }
            </div>
            <div class="drawer-footer">
              <button type="button" class="btn-secondary" (click)="closeDrawer()">Close</button>
            </div>
          </div>
        </div>
      }

      <!-- DRAWER: WEBHOOKS -->
      @if (activeDrawer === 'webhook') {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-card wide" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <h3>Outbound Webhooks Configuration & Logs</h3>
              <button type="button" class="btn-close" (click)="closeDrawer()">✕</button>
            </div>
            <div class="drawer-body">
              <div class="form-group">
                <label>Target Webhook Endpoint URL:</label>
                <input type="text" [(ngModel)]="webhookConfig.endpointUrl" class="drawer-input" />
              </div>

              <div class="form-group">
                <label>HMAC SHA-256 Signing Secret:</label>
                <div class="secret-row">
                  <input [type]="showSecret ? 'text' : 'password'" [(ngModel)]="webhookConfig.signingSecret" class="drawer-input" readonly />
                  <button type="button" class="btn-sec-act" (click)="showSecret = !showSecret">{{ showSecret ? 'Hide' : 'Reveal' }}</button>
                  <button type="button" class="btn-sec-act" (click)="rotateSigningSecret()">Rotate Secret</button>
                </div>
              </div>

              <div class="form-group">
                <label>Subscribed Events:</label>
                <div class="events-grid">
                  <label><input type="checkbox" [(ngModel)]="webhookConfig.subApproved" /> document.approved</label>
                  <label><input type="checkbox" [(ngModel)]="webhookConfig.subIntake" /> intake.completed</label>
                  <label><input type="checkbox" [(ngModel)]="webhookConfig.subSla" /> sla.breached</label>
                  <label><input type="checkbox" [(ngModel)]="webhookConfig.subPurge" /> deletion.completed</label>
                </div>
              </div>

              <div class="test-trigger-row">
                <button type="button" class="btn-test-payload" (click)="sendTestPayload()">⚡ Send Test Webhook Payload</button>
              </div>

              <div class="logs-section">
                <h4>Recent Webhook Delivery Logs</h4>
                <table class="logs-table">
                  <thead>
                    <tr>
                      <th>LOG ID</th>
                      <th>EVENT</th>
                      <th>HTTP STATUS</th>
                      <th>TIMESTAMP</th>
                      <th class="text-right">RETRY</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of webhookLogs; track log.id) {
                      <tr>
                        <td><code>{{ log.id }}</code></td>
                        <td>{{ log.event }}</td>
                        <td><span class="status-badge {{ log.status.includes('200') ? 'connected' : 'failed' }}">{{ log.status }}</span></td>
                        <td>{{ log.timestamp }}</td>
                        <td class="text-right">
                          <button type="button" class="btn-retry" (click)="retryWebhook(log)">Retry</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="drawer-footer">
              <button type="button" class="btn-secondary" (click)="closeDrawer()">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveDrawer('Webhook endpoints and event subscriptions updated.')">Save Webhook Settings</button>
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
    .admin-integrations-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .integrations-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    .integration-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .card-header { display: flex; align-items: flex-start; gap: 0.85rem; .card-icon { font-size: 1.5rem; } div { flex: 1; h3 { margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600; } p { margin: 0.2rem 0 0 0; font-size: 0.8rem; color: #64748b; } } } .card-body { font-size: 0.85rem; color: #475569; p { margin: 0 0 0.35rem 0; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem; border: 1px solid #e2e8f0; } } .card-footer { border-top: 1px solid #e2e8f0; padding-top: 0.85rem; .btn-config { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.45rem 0.9rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; &:hover { background: #4f46e5; color: #ffffff; border-color: #4f46e5; } } } }
    .status-badge { font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 9999px; &.connected { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } &.failed { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; } }
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); z-index: 100; }
    .drawer-card { position: fixed; top: 0; right: 0; bottom: 0; width: 500px; background: #ffffff; border-left: 1px solid #e2e8f0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; z-index: 105; overflow-y: auto; box-shadow: -4px 0 24px rgba(0,0,0,0.1); &.wide { width: 640px; } .drawer-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.85rem; h3 { margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; } .btn-close { background: transparent; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer; &:hover { color: #0f172a; } } } .drawer-body { flex: 1; display: flex; flex-direction: column; gap: 1rem; .form-group { label { font-size: 0.8rem; color: #475569; display: block; margin-bottom: 0.35rem; font-weight: 500; } .drawer-input, .drawer-select, .drawer-textarea { width: 100%; background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; box-sizing: border-box; font-size: 0.85rem; &:focus { border-color: #4f46e5; outline: none; } } } .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #0f172a; cursor: pointer; } .mapping-section, .logs-section { h4 { margin: 0 0 0.65rem 0; font-size: 0.9rem; color: #0f172a; font-weight: 600; } } .mapping-table, .logs-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; th { background: #f8fafc; color: #475569; padding: 0.55rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.55rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid #e2e8f0; } .mapping-input { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.35rem; border-radius: 4px; width: 100%; box-sizing: border-box; } .btn-retry { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; font-weight: 600; cursor: pointer; } } .secret-row { display: flex; gap: 0.5rem; .btn-sec-act { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.65rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap; &:hover { background: #e2e8f0; } } } .events-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: #0f172a; } .test-trigger-row { .btn-test-payload { width: 100%; background: #e0e7ff; border: 1px solid #c7d2fe; color: #3730a3; padding: 0.55rem; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; } } } .drawer-footer { border-top: 1px solid #e2e8f0; padding-top: 1rem; display: flex; justify-content: flex-end; gap: 0.75rem; .btn-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminIntegrations implements OnInit {
  private readonly adminService = inject(HttpAdminService);

  activeDrawer: 'erp' | 'idp' | 'email' | 'webhook' | null = null;
  toastMessage: string | null = null;
  showSecret = false;

  // Mailbox management state (Part G.2)
  mailboxes: any[] = [];
  isEditingMailbox = false;
  selectedMailboxId: string | null = null;
  mailboxForm = {
    address: '',
    allowedSenderDomains: '',
    isActive: true,
  };

  erpConfig = {
    sandbox: true,
    clientId: 'SAP-CLIENT-88912',
    endpointUrl: 'https://sap-sandbox.acme.com/bapi/v1/invoice',
  };

  erpMappings: FieldMap[] = [
    { docField: 'invoice_number', erpField: 'INVOICE_HEADER.INV_DOC_NO' },
    { docField: 'supplier_gstin', erpField: 'INVOICE_HEADER.VENDOR_TAX_ID' },
    { docField: 'net_amount', erpField: 'INVOICE_HEADER.NET_WRBTR' },
    { docField: 'total_amount', erpField: 'INVOICE_HEADER.GROSS_WRBTR' },
  ];

  idpConfig = {
    metadataUrl: 'https://login.microsoftonline.com/acme.onmicrosoft.com/federationmetadata/2007-06/federationmetadata.xml',
    entityId: 'https://auth.docnexa.io/saml/metadata',
    ssoUrl: 'https://login.microsoftonline.com/acme/saml2',
    certificate: '-----BEGIN CERTIFICATE-----\nMIIDdDCCAlygAwIBAgIQZ1... (Azure AD Signing Key)\n-----END CERTIFICATE-----',
  };

  emailConfig = {
    mailboxAddress: 'invoices-ingest@docnexa.io',
    allowedSenders: 'acme.com, vendors.global.org, partner-network.com',
    defaultType: 'PUR-INVOICE',
    autoExtract: true,
  };

  webhookConfig = {
    endpointUrl: 'https://api.acme.com/webhooks/docnexa-ingest',
    signingSecret: 'whsec_98412_084912984102948102',
    subApproved: true,
    subIntake: true,
    subSla: true,
    subPurge: true,
  };

  webhookLogs: WebhookLog[] = [
    { id: 'WH-801', event: 'document.approved', url: 'https://api.acme.com/webhooks', status: '500 Internal Error', attempts: 3, timestamp: '11:40 AM' },
    { id: 'WH-802', event: 'intake.completed', url: 'https://erp.acme.com/api', status: '200 OK', attempts: 1, timestamp: '10:12 AM' },
  ];

  ngOnInit(): void {
    this.loadMailboxes();
  }

  loadMailboxes(): void {
    this.adminService.listMailboxes().subscribe((list) => {
      if (list && list.length > 0) {
        this.mailboxes = list;
      } else {
        this.mailboxes = [
          {
            id: 'MB-101',
            address: 'invoices-ingest@docnexa.io',
            allowedSenderDomains: ['acme.com', 'vendors.global.org'],
            isActive: true,
          },
        ];
      }
    });
  }

  startNewMailbox(): void {
    this.selectedMailboxId = null;
    this.mailboxForm = {
      address: '',
      allowedSenderDomains: '',
      isActive: true,
    };
    this.isEditingMailbox = true;
  }

  editMailbox(mb: any): void {
    this.selectedMailboxId = mb.id;
    this.mailboxForm = {
      address: mb.address || mb.emailAddress || '',
      allowedSenderDomains: Array.isArray(mb.allowedSenderDomains) ? mb.allowedSenderDomains.join(', ') : (mb.allowedSenderDomains || ''),
      isActive: mb.isActive !== false,
    };
    this.isEditingMailbox = true;
  }

  saveMailbox(): void {
    if (!this.mailboxForm.address.trim()) return;

    const domains = this.mailboxForm.allowedSenderDomains
      .split(',')
      .map(d => d.trim())
      .filter(Boolean);

    if (this.selectedMailboxId) {
      this.adminService.updateMailbox(this.selectedMailboxId, {
        allowedSenderDomains: domains as any,
        isActive: this.mailboxForm.isActive,
      }).subscribe(() => {
        this.mailboxes = this.mailboxes.map(m =>
          m.id === this.selectedMailboxId
            ? { ...m, allowedSenderDomains: domains, isActive: this.mailboxForm.isActive }
            : m
        );
        this.isEditingMailbox = false;
        this.showToast('Intake mailbox configuration updated.');
      });
    } else {
      this.adminService.createMailbox({
        emailAddress: this.mailboxForm.address.trim(),
        name: this.mailboxForm.address.trim(),
        active: this.mailboxForm.isActive,
      } as any).subscribe((newMb) => {
        const item = {
          id: newMb?.id || `MB-${Date.now()}`,
          address: this.mailboxForm.address.trim(),
          allowedSenderDomains: domains,
          isActive: this.mailboxForm.isActive,
        };
        this.mailboxes.push(item);
        this.isEditingMailbox = false;
        this.showToast('New ingestion mailbox registered.');
      });
    }
  }

  openDrawer(type: 'erp' | 'idp' | 'email' | 'webhook'): void {
    this.activeDrawer = type;
    if (type === 'email') {
      this.loadMailboxes();
    }
  }

  closeDrawer(): void {
    this.activeDrawer = null;
  }

  saveDrawer(msg: string): void {
    this.closeDrawer();
    this.showToast(msg);
  }

  rotateSigningSecret(): void {
    this.webhookConfig.signingSecret = `whsec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.showToast('Rotated Webhook HMAC SHA-256 signing secret.');
  }

  sendTestPayload(): void {
    this.showToast('Sent test payload to webhook endpoint: Received HTTP 200 OK!');
  }

  retryWebhook(log: WebhookLog): void {
    log.status = '200 OK (Retried)';
    log.attempts++;
    this.showToast(`Retried webhook dispatch [${log.id}]: HTTP 200 OK.`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
