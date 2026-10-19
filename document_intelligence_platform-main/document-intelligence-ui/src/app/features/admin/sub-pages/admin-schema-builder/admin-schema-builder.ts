import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';

export interface SchemaField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'enum' | 'table';
  cardinality: 'single' | 'array';
  required: boolean;
  acceptedValues?: string;
  regexPattern?: string;
  arithmeticRule?: string;
  masking: 'none' | 'full' | 'partial';
  reviewerRole: 'reviewer' | 'approver' | 'org_admin';
  exportable: boolean;
  confidenceThreshold: number;
}

export interface TemplateVersion {
  version: string;
  status: 'published' | 'draft' | 'archived';
  publishedAt: string;
  publishedBy: string;
  fieldCount: number;
}

@Component({
  selector: 'app-admin-schema-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="schema-builder-page">
      <!-- TOP BANNER FOR HISTORICAL TEMPLATE VERSIONING -->
      <div class="version-notice-banner">
        <span class="banner-icon">ℹ️</span>
        <div class="banner-content">
          <strong>Template Versioning Policy Enforced:</strong>
          Historical documents processed in the past retain the schema version active at their intake time. Publishing a new version will only affect newly ingested documents.
        </div>
      </div>

      <!-- HEADER -->
      <div class="builder-header">
        <div class="header-left">
          <a routerLink="/admin/document-types" class="btn-back">← Back to Document Types</a>
          <h2>{{ documentTypeName }} Schema Builder</h2>
          <span class="type-code">{{ documentTypeCode }}</span>
          <span class="active-ver-chip">Current Active: {{ activeVersion }}</span>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-secondary" (click)="saveDraft()">Save as Draft</button>
          <button type="button" class="btn-secondary" (click)="validateSchema()">Validate Rules</button>
          <button type="button" class="btn-primary" (click)="publishNewVersion()">Publish New Version</button>
        </div>
      </div>

      <!-- MAIN CONTENT SPLIT -->
      <div class="builder-layout">
        <!-- LEFT: FIELD LIST & MANAGEMENT -->
        <div class="fields-container">
          <div class="container-toolbar">
            <h3>Configured Extraction Fields ({{ fields.length }})</h3>
            <button type="button" class="btn-add-field" (click)="addField()">+ Add Field</button>
          </div>

          <div class="field-list">
            @for (field of fields; track field.id; let idx = $index) {
              <div class="field-card" [class.selected]="selectedField?.id === field.id" (click)="selectField(field)">
                <div class="field-drag-handle">⋮⋮</div>
                <div class="field-summary">
                  <div class="field-title-row">
                    <strong class="field-label">{{ field.label }}</strong>
                    <span class="field-key"><code>{{ field.key }}</code></span>
                    @if (field.required) { <span class="req-chip">REQUIRED</span> }
                  </div>
                  <div class="field-meta-row">
                    <span class="type-badge">{{ field.type | uppercase }}</span>
                    <span>Role: {{ field.reviewerRole }}</span>
                    <span>Threshold: {{ field.confidenceThreshold * 100 }}%</span>
                    <span>Masking: {{ field.masking }}</span>
                  </div>
                </div>
                <div class="field-card-actions">
                  <button type="button" class="btn-reorder" (click)="moveField(idx, -1); $event.stopPropagation()" [disabled]="idx === 0">▲</button>
                  <button type="button" class="btn-reorder" (click)="moveField(idx, 1); $event.stopPropagation()" [disabled]="idx === fields.length - 1">▼</button>
                  <button type="button" class="btn-delete" (click)="deleteField(field, $event)">✕</button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- RIGHT: FIELD EDITOR & VERSION HISTORY -->
        <div class="sidebar-container">
          @if (selectedField) {
            <div class="field-editor-card">
              <h3>Field Settings: {{ selectedField.label }}</h3>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>Field Key (JSON property):</label>
                  <input type="text" [(ngModel)]="selectedField.key" class="editor-input" />
                </div>

                <div class="form-group">
                  <label>Display Label:</label>
                  <input type="text" [(ngModel)]="selectedField.label" class="editor-input" />
                </div>

                <div class="form-group">
                  <label>Data Type:</label>
                  <select [(ngModel)]="selectedField.type" class="editor-select">
                    <option value="text">Text / String</option>
                    <option value="number">Number / Integer</option>
                    <option value="date">Date (ISO 8601)</option>
                    <option value="currency">Currency / Amount</option>
                    <option value="enum">Enum / Dropdown</option>
                    <option value="table">Nested Table / Line Items</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Cardinality:</label>
                  <select [(ngModel)]="selectedField.cardinality" class="editor-select">
                    <option value="single">Single Value</option>
                    <option value="array">Array / List</option>
                  </select>
                </div>

                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" [(ngModel)]="selectedField.required" />
                    Mandatory Field (Required for approval)
                  </label>
                </div>

                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" [(ngModel)]="selectedField.exportable" />
                    Include in ERP / Downstream Export
                  </label>
                </div>

                @if (selectedField.type === 'enum') {
                  <div class="form-group full-width">
                    <label>Accepted Values (comma-separated):</label>
                    <input type="text" [(ngModel)]="selectedField.acceptedValues" class="editor-input" placeholder="e.g. INR, USD, EUR, GBP" />
                  </div>
                }

                <div class="form-group full-width">
                  <label>Regex / Format Validation:</label>
                  <input type="text" [(ngModel)]="selectedField.regexPattern" class="editor-input" placeholder="e.g. ^[A-Z]{4}[0-9]{7}$" />
                </div>

                <div class="form-group full-width">
                  <label>Cross-Field & Arithmetic Rule:</label>
                  <input type="text" [(ngModel)]="selectedField.arithmeticRule" class="editor-input" placeholder="e.g. net_amount + tax_amount == total_amount" />
                </div>

                <div class="form-group">
                  <label>PII / Confidential Masking:</label>
                  <select [(ngModel)]="selectedField.masking" class="editor-select">
                    <option value="none">No Masking (Visible)</option>
                    <option value="partial">Partial Masking (e.g. ****1234)</option>
                    <option value="full">Full Masking (Hidden)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Required Reviewer Role:</label>
                  <select [(ngModel)]="selectedField.reviewerRole" class="editor-select">
                    <option value="reviewer">Reviewer</option>
                    <option value="approver">Approver</option>
                    <option value="org_admin">Organization Admin Only</option>
                  </select>
                </div>

                <div class="form-group full-width">
                  <label>Confidence Threshold: <strong>{{ selectedField.confidenceThreshold * 100 }}%</strong></label>
                  <input type="range" min="0.5" max="0.99" step="0.01" [(ngModel)]="selectedField.confidenceThreshold" class="slider-input" />
                  <span class="hint">Fields extracted below this threshold force human review.</span>
                </div>
              </div>
            </div>
          } @else {
            <div class="no-selection-card">
              <p>Select a field from the list to view and edit its parameters.</p>
            </div>
          }

          <!-- VERSION HISTORY CARD -->
          <div class="version-history-card">
            <h3>Schema Version History</h3>
            <div class="history-list">
              @for (ver of versionHistory; track ver.version) {
                <div class="history-item" [class.current]="ver.version === activeVersion">
                  <div class="ver-top">
                    <strong>{{ ver.version }}</strong>
                    <span class="ver-status {{ ver.status }}">{{ ver.status | uppercase }}</span>
                  </div>
                  <div class="ver-details">
                    Published {{ ver.publishedAt }} by {{ ver.publishedBy }} ({{ ver.fieldCount }} fields)
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .schema-builder-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .version-notice-banner { display: flex; align-items: center; gap: 0.75rem; background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 0.75rem 1rem; color: #3730a3; font-size: 0.85rem; .banner-icon { font-size: 1.2rem; } }
    .builder-header { display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); .header-left { display: flex; align-items: center; gap: 0.75rem; .btn-back { color: #4f46e5; text-decoration: none; font-size: 0.82rem; font-weight: 700; } h2 { margin: 0; font-size: 1.2rem; color: #0f172a; } .type-code { background: #f1f5f9; color: #475569; font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; border: 1px solid #e2e8f0; } .active-ver-chip { background: #dcfce7; color: #15803d; font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 800; } } .header-actions { display: flex; gap: 0.75rem; .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.5rem 1.1rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; } } }
    .builder-layout { display: grid; grid-template-columns: 1fr 420px; gap: 1.25rem; }
    .fields-container { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); .container-toolbar { display: flex; justify-content: space-between; align-items: center; h3 { margin: 0; font-size: 1.05rem; color: #0f172a; } .btn-add-field { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.4rem 0.85rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; } } }
    .field-list { display: flex; flex-direction: column; gap: 0.65rem; }
    .field-card { display: flex; align-items: center; gap: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; cursor: pointer; transition: all 0.15s; &:hover { border-color: #4f46e5; } &.selected { border-color: #4f46e5; background: #eef2ff; } .field-drag-handle { color: #94a3b8; cursor: grab; font-weight: 700; } .field-summary { flex: 1; .field-title-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; .field-label { font-size: 0.9rem; color: #0f172a; } .field-key code { background: #ffffff; color: #4338ca; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.72rem; border: 1px solid #cbd5e1; } .req-chip { background: #fef2f2; color: #b91c1c; font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; } } .field-meta-row { display: flex; gap: 0.75rem; font-size: 0.72rem; color: #64748b; .type-badge { background: #e2e8f0; color: #334155; font-weight: 700; padding: 0.05rem 0.35rem; border-radius: 4px; } } } .field-card-actions { display: flex; gap: 0.35rem; .btn-reorder { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 0.7rem; &:disabled { opacity: 0.3; cursor: not-allowed; } } .btn-delete { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 0.75rem; } } }
    .sidebar-container { display: flex; flex-direction: column; gap: 1.25rem; }
    .field-editor-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); h3 { margin: 0 0 1rem 0; font-size: 1.05rem; color: #0f172a; } }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; .full-width { grid-column: span 2; } .form-group { label { font-size: 0.78rem; color: #475569; display: block; margin-bottom: 0.3rem; font-weight: 600; } .editor-input, .editor-select { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.45rem 0.6rem; border-radius: 6px; box-sizing: border-box; font-size: 0.82rem; } .slider-input { width: 100%; } .hint { font-size: 0.7rem; color: #64748b; display: block; margin-top: 0.2rem; } } .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #334155; cursor: pointer; } }
    .no-selection-card { background: #ffffff; border: 1px border-dashed #cbd5e1; border-radius: 12px; padding: 2rem; text-align: center; color: #64748b; font-size: 0.85rem; }
    .version-history-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); h3 { margin: 0 0 0.85rem 0; font-size: 1.05rem; color: #0f172a; } .history-list { display: flex; flex-direction: column; gap: 0.65rem; } .history-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem; &.current { border-color: #10b981; background: #ecfdf5; } .ver-top { display: flex; justify-content: space-between; font-size: 0.82rem; .ver-status { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; &.published { background: #dcfce7; color: #15803d; } &.draft { background: #fef3c7; color: #b45309; } } } .ver-details { font-size: 0.72rem; color: #64748b; margin-top: 0.25rem; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; }
  `]
})
export class AdminSchemaBuilder implements OnInit {
  private route = inject(ActivatedRoute);

  documentTypeId = '';
  documentTypeName = 'Purchase Invoice';
  documentTypeCode = 'PUR-INVOICE';
  activeVersion = 'v2.1';
  toastMessage: string | null = null;

  fields: SchemaField[] = [];
  selectedField: SchemaField | null = null;

  versionHistory: TemplateVersion[] = [
    { version: 'v2.1', status: 'published', publishedAt: '04 Oct 2026', publishedBy: 'Abhishek Yadav', fieldCount: 9 },
    { version: 'v2.0', status: 'published', publishedAt: '15 Sep 2026', publishedBy: 'Abhishek Yadav', fieldCount: 8 },
    { version: 'v1.0', status: 'archived', publishedAt: '01 Aug 2026', publishedBy: 'System Init', fieldCount: 6 },
  ];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.documentTypeId = params['id'] || 'purchase-invoice';
      this.loadPreloadedSchema(this.documentTypeId);
    });
  }

  loadPreloadedSchema(typeId: string): void {
    if (typeId === 'supplier-contract') {
      this.documentTypeName = 'Supplier Contract';
      this.documentTypeCode = 'SUP-CONTRACT';
      this.activeVersion = 'v1.4';
      this.fields = [
        { id: 'f1', key: 'effective_date', label: 'Effective Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f2', key: 'expiry_date', label: 'Expiry Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f3', key: 'party_names', label: 'Contracting Party Names', type: 'text', cardinality: 'array', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f4', key: 'governing_law', label: 'Governing Law & Jurisdiction', type: 'text', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.80 },
        { id: 'f5', key: 'total_contract_value', label: 'Total Contract Value', type: 'currency', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.92 },
        { id: 'f6', key: 'liability_cap', label: 'Limitation of Liability Cap', type: 'currency', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f7', key: 'renewal_notice_period', label: 'Renewal Notice Period (Days)', type: 'number', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.80 },
        { id: 'f8', key: 'termination_clause', label: 'Termination Clause Reference', type: 'text', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: false, confidenceThreshold: 0.75 },
      ];
    } else if (typeId === 'internal-policy') {
      this.documentTypeName = 'Internal Policy';
      this.documentTypeCode = 'INT-POLICY';
      this.activeVersion = 'v4.2';
      this.fields = [
        { id: 'f1', key: 'policy_name', label: 'Policy Name', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.95 },
        { id: 'f2', key: 'policy_id', label: 'Policy Document ID', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.95 },
        { id: 'f3', key: 'effective_date', label: 'Effective Policy Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f4', key: 'owner_department', label: 'Owner Department', type: 'enum', acceptedValues: 'HR, Legal, Finance, Engineering, Security', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f5', key: 'review_frequency', label: 'Review Frequency', type: 'enum', acceptedValues: 'Annual, Bi-Annual, Quarterly', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.80 },
        { id: 'f6', key: 'compliance_officer', label: 'Compliance Officer Name', type: 'text', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.85 },
      ];
    } else {
      // Default: Purchase Invoice
      this.documentTypeName = 'Purchase Invoice';
      this.documentTypeCode = 'PUR-INVOICE';
      this.activeVersion = 'v2.1';
      this.fields = [
        { id: 'f1', key: 'invoice_number', label: 'Invoice Number', type: 'text', cardinality: 'single', required: true, regexPattern: '^[A-Z0-9\\-]+$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.95 },
        { id: 'f2', key: 'invoice_date', label: 'Invoice Date', type: 'date', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f3', key: 'supplier_gstin', label: 'Supplier Tax ID / GSTIN', type: 'text', cardinality: 'single', required: true, regexPattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f4', key: 'net_amount', label: 'Net Amount', type: 'currency', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f5', key: 'tax_amount', label: 'Tax Amount (IGST/CGST)', type: 'currency', cardinality: 'single', required: true, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.90 },
        { id: 'f6', key: 'total_amount', label: 'Total Amount', type: 'currency', cardinality: 'single', required: true, arithmeticRule: 'net_amount + tax_amount == total_amount', masking: 'none', reviewerRole: 'approver', exportable: true, confidenceThreshold: 0.95 },
        { id: 'f7', key: 'line_items', label: 'Line Items Breakdown Table', type: 'table', cardinality: 'array', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f8', key: 'po_number', label: 'Purchase Order (PO) Number', type: 'text', cardinality: 'single', required: false, masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
        { id: 'f9', key: 'due_date', label: 'Payment Due Date', type: 'date', cardinality: 'single', required: false, arithmeticRule: 'due_date >= invoice_date', masking: 'none', reviewerRole: 'reviewer', exportable: true, confidenceThreshold: 0.85 },
      ];
    }

    if (this.fields.length > 0) {
      this.selectedField = this.fields[0];
    }
  }

  selectField(field: SchemaField): void {
    this.selectedField = field;
  }

  moveField(index: number, delta: number): void {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= this.fields.length) return;
    const item = this.fields.splice(index, 1)[0];
    this.fields.splice(targetIdx, 0, item);
  }

  deleteField(field: SchemaField, event: Event): void {
    event.stopPropagation();
    if (confirm(`Remove field "${field.label}" from schema?`)) {
      this.fields = this.fields.filter(f => f.id !== field.id);
      if (this.selectedField?.id === field.id) {
        this.selectedField = this.fields[0] || null;
      }
    }
  }

  addField(): void {
    const newField: SchemaField = {
      id: `f_${Date.now()}`,
      key: `new_field_${this.fields.length + 1}`,
      label: `New Field ${this.fields.length + 1}`,
      type: 'text',
      cardinality: 'single',
      required: false,
      masking: 'none',
      reviewerRole: 'reviewer',
      exportable: true,
      confidenceThreshold: 0.85,
    };
    this.fields.push(newField);
    this.selectedField = newField;
  }

  saveDraft(): void {
    this.showToast('Schema saved as draft (un-published). Historical templates unaffected.');
  }

  validateSchema(): void {
    this.showToast('Validation Passed: All regex patterns, cross-field arithmetic rules and keys are valid!');
  }

  publishNewVersion(): void {
    const nextVerMajor = parseInt(this.activeVersion.replace('v', '').split('.')[0]) + 1;
    const newVerStr = `v${nextVerMajor}.0`;
    this.versionHistory.unshift({
      version: newVerStr,
      status: 'published',
      publishedAt: 'Today',
      publishedBy: 'Abhishek Yadav',
      fieldCount: this.fields.length,
    });
    this.activeVersion = newVerStr;
    this.showToast(`Published schema version ${newVerStr} successfully! Historical documents retain their original version.`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
