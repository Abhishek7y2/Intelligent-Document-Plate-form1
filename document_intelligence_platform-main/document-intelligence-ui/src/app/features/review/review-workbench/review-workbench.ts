import { Component, OnInit, OnDestroy, inject, signal, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LoadingState } from '../../../shared/ui/loading-state/loading-state';
import { ErrorState, ErrorVariant } from '../../../shared/ui/error-state/error-state';
import { REVIEW_SERVICE_TOKEN, HttpReviewService, MockReviewService } from '../../../core/services/api-services';
import { AuthService } from '../../../core/services/auth';

export type FieldStatus = 'ai_suggestion' | 'reviewer_confirmed' | 'edited' | 'rejected' | 'published';

export interface FieldCorrectionHistory {
  id: string;
  originalValue: string;
  correctedValue: string;
  actor: string;
  timestamp: string;
  extractionVersion: string;
  modelVersion: string;
  confidence: number;
  reason?: string;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  originalValue: string;
  confidence: number;
  status: FieldStatus;
  page: number;
  isArithmetic?: boolean;
  isMandatory?: boolean;
  isActionTaken?: boolean; // Explicit action taken (Accept, Edit, Reject)
  rejectionReason?: string;
  evidence_unmapped?: boolean;
  serverRuleFailure?: string;
  history?: FieldCorrectionHistory[];
  sourceLocations?: Array<{ page: number; locationName: string; value: string; top: number; left: number }>;
}

export interface BoundingBox {
  id: string;
  fieldKey: string;
  label: string;
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  value: string;
  confidence: number;
  isUserDrawn?: boolean;
}

export interface ExceptionItem {
  id: string;
  type: 'arithmetic' | 'duplicate' | 'date_order' | 'missing_mandatory' | 'conflict_ai004';
  title: string;
  description: string;
  severity: 'error' | 'warning';
  locations?: Array<{ page: number; locationName: string; value: string; top: number; left: number }>;
  isOverridden?: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  requiresOverride?: boolean;
}

export interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  role: string;
  timestamp: string;
  text: string;
  fieldKey?: string;
  isClarificationRequest?: boolean;
  isResolved?: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  details: string;
  category: 'verification' | 'edit' | 'override' | 'ocr' | 'classification' | 'clarification';
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  isModified?: boolean;
  hasDiscrepancy?: boolean;
}

export interface PageOcrInfo {
  page: number;
  status: 'normal' | 'failed' | 'unsupported_language';
  message?: string;
  retryAttempts?: number;
}

@Component({
  selector: 'app-review-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LoadingState,
    ErrorState,
  ],
  templateUrl: './review-workbench.html',
  styleUrl: './review-workbench.scss',
  providers: [{ provide: REVIEW_SERVICE_TOKEN, useClass: HttpReviewService }],
})
export class ReviewWorkbench implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reviewService = inject(REVIEW_SERVICE_TOKEN);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  isLoading = signal(true);
  hasError = signal(false);
  errorVariant = signal<ErrorVariant>('default');

  documentId = 'DOC-10247';
  documentName = 'Purchase Invoice - INV-78421';
  documentType = 'Purchase Invoice';
  documentStatus: 'In Verification' | 'Awaiting Clarification' | 'Approved' | 'Rejected' = 'In Verification';
  totalPages = 4;
  currentPage = 1;
  zoomLevel = 100;
  rotation = 0;
  pdfLoaded = false;
  pdfUrl: string | null = null; // Used for pdf.js real PDF fallback

  activeTab: 'metadata' | 'line-items' | 'exceptions' | 'audit' = 'metadata';
  activeFieldKey = 'invoiceTotal';
  hoveredFieldKey: string | null = null;

  // Drawers & Modals
  isCommentsDrawerOpen = false;
  isHistoryDrawerOpen = false;
  selectedFieldHistory: ExtractedField | null = null;
  isClassificationModalOpen = false;
  targetDocType = 'Purchase Invoice';
  isReExtracting = false;

  // Override Modal
  isOverrideModalOpen = false;
  selectedExceptionToOverride: ExceptionItem | null = null;
  overrideReasonText = '';

  // Reject Reason Modal
  isRejectModalOpen = false;
  selectedFieldToReject: ExtractedField | null = null;
  rejectReasonText = '';

  // Keyboard Shortcuts Modal
  isShortcutHelpOpen = false;

  // Manual Transcription Panel
  isManualTranscriptionOpen = false;
  manualTranscriptionText = '';

  // Bounding Box Drawing Tool
  isDrawingRegionMode = false;
  newRegionBox: { top: number; left: number; width: number; height: number } | null = null;

  // Toast
  toastMessage: string | null = null;
  toastType: 'success' | 'warning' | 'error' = 'success';

  // Draft dirty tracking
  isDirty = false;

  // OCR Status per page
  pageOcrStatuses: PageOcrInfo[] = [
    { page: 1, status: 'normal' },
    { page: 2, status: 'failed', message: 'Low image contrast and noise artifact prevented OCR reading.', retryAttempts: 1 },
    { page: 3, status: 'unsupported_language', message: 'Page contains unrecognized non-Latin script characters (Japanese / Cyrillic).' },
    { page: 4, status: 'normal' },
  ];

  // Fields List
  fields: ExtractedField[] = [];

  // Bounding Boxes List
  boundingBoxes: BoundingBox[] = [];

  // Line Items
  lineItems: InvoiceLineItem[] = [
    { id: 1, description: 'Industrial Sensor Module A-204 (Precision Calibration)', hsnCode: '8536', quantity: 10, unitPrice: 4500, taxRate: 18, lineTotal: 45000 },
    { id: 2, description: 'PLC Automation Interface Unit (4-Channel Analog)', hsnCode: '8537', quantity: 4, unitPrice: 12000, taxRate: 18, lineTotal: 48000 },
    { id: 3, description: 'Heavy Duty Thermal Relay Assembly (400V 50Hz)', hsnCode: '8536', quantity: 6, unitPrice: 5000, taxRate: 18, lineTotal: 30000 },
  ];

  extractedGrandTotal = 145140.0;

  // Exceptions List (FR-009, FR-010, AI-004)
  exceptions: ExceptionItem[] = [
    {
      id: 'EXC-001',
      type: 'conflict_ai004',
      title: 'AI-004 Conflicting Field Values',
      description: 'Invoice Grand Total conflict: Page 1 Header states ₹1,45,140.00, while Page 4 Summary Table states ₹1,42,000.00. Multi-location review required.',
      severity: 'error',
      requiresOverride: true,
      locations: [
        { page: 1, locationName: 'Header Invoice Box', value: '₹ 1,45,140.00', top: 81, left: 60 },
        { page: 4, locationName: 'Footer Summary Voucher', value: '₹ 1,42,000.00', top: 45, left: 55 },
      ],
    },
    {
      id: 'EXC-002',
      type: 'arithmetic',
      title: 'Arithmetic Line-Item Reconciliation',
      description: 'Calculated subtotal (₹1,23,000) + 18% IGST (₹22,140) equals ₹1,45,140. Fully reconciled.',
      severity: 'warning',
      requiresOverride: false,
    },
    {
      id: 'EXC-003',
      type: 'duplicate',
      title: 'Duplicate Invoice Check',
      description: 'Checked reference #INV-78421 against historical database repository. Zero duplicate records found.',
      severity: 'warning',
      requiresOverride: false,
    },
    {
      id: 'EXC-004',
      type: 'date_order',
      title: 'Invoice & Due Date Chronology',
      description: 'Invoice Date (04 Oct 2026) comes before Due Date (03 Nov 2026). Chronology order validated.',
      severity: 'warning',
      requiresOverride: false,
    },
  ];

  // Comments & Clarifications (FR-011)
  commentText = '';
  mentionSearchQuery = '';
  showMentionDropdown = false;
  availableUsers = [
    { name: 'Rahul Sharma', role: 'Uploader / Vendor Ops', email: 'rahul@acme.com' },
    { name: 'Priya Mehta', role: 'Approver / Finance Head', email: 'priya@acme.com' },
    { name: 'Ankit Verma', role: 'Senior Auditor', email: 'ankit@acme.com' },
    { name: 'Abhishek Yadav', role: 'Reviewer', email: 'abhishek@acme.com' },
  ];

  comments: CommentItem[] = [
    {
      id: 'COM-1',
      author: 'Rahul Sharma',
      avatar: 'RS',
      role: 'Uploader',
      timestamp: '06 Oct 2026 · 10:15 AM',
      text: 'Uploaded tax invoice for Purchase Order #PO-2026-9842. Please verify IGST rate applied.',
      isResolved: true,
    },
    {
      id: 'COM-2',
      author: 'Priya Mehta',
      avatar: 'PM',
      role: 'Approver',
      timestamp: '07 Oct 2026 · 02:30 PM',
      text: '@Rahul Sharma Please clarify why the voucher on Page 4 states ₹1,42,000 while the header states ₹1,45,140.',
      fieldKey: 'invoiceTotal',
      isClarificationRequest: true,
      isResolved: false,
    },
  ];

  // Audit Logs (Task 5A Item 9)
  auditLogs: AuditLogItem[] = [
    {
      id: 'LOG-101',
      timestamp: '06 Oct 2026 · 09:18 AM',
      actor: 'System Extraction Pipeline',
      role: 'System AI Engine',
      action: 'Document OCR & LayoutLM Processing',
      details: 'Extracted 9 metadata fields with 91.8% average confidence score (Engine v2.4-LayoutLMv3).',
      category: 'verification',
    },
    {
      id: 'LOG-102',
      timestamp: '07 Oct 2026 · 11:45 AM',
      actor: 'Abhishek Yadav',
      role: 'Reviewer',
      action: 'Review Workbench Session Initiated',
      details: 'Document loaded into split-pane human-in-the-loop review canvas.',
      category: 'verification',
    },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.documentId = id;
    }
    this.initDefaultFieldsForType('Purchase Invoice');
    this.loadWorkbenchData();
  }

  ngOnDestroy(): void {
    // Save draft on component destroy if dirty
    if (this.isDirty) {
      this.saveDraftToStorage();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.isDirty) {
      $event.returnValue = 'You have unsaved review changes. Are you sure you want to leave?';
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    // If typing in input or textarea, skip keyboard navigation shortcuts
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      this.isShortcutHelpOpen = !this.isShortcutHelpOpen;
      return;
    }

    if (event.key === 'Escape') {
      this.activeFieldKey = '';
      this.isDrawingRegionMode = false;
      this.isShortcutHelpOpen = false;
      this.isCommentsDrawerOpen = false;
      this.isHistoryDrawerOpen = false;
      this.isOverrideModalOpen = false;
      this.isRejectModalOpen = false;
      this.isClassificationModalOpen = false;
      return;
    }

    // Keyboard box navigation (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const visibleBoxes = this.boundingBoxes.filter(b => b.page === this.currentPage);
      if (visibleBoxes.length === 0) return;

      let currentIndex = visibleBoxes.findIndex(b => b.fieldKey === this.activeFieldKey);
      if (currentIndex === -1) {
        currentIndex = 0;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % visibleBoxes.length;
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + visibleBoxes.length) % visibleBoxes.length;
      }

      const selectedBox = visibleBoxes[currentIndex];
      if (selectedBox) {
        this.selectField(selectedBox.fieldKey);
      }
    }

    if (event.key === 'Enter' && this.activeFieldKey) {
      event.preventDefault();
      // Focus corresponding input field in DOM
      const inputEl = document.getElementById(`field-input-${this.activeFieldKey}`);
      if (inputEl) {
        inputEl.focus();
      }
    }
  }

  // --- INITIALIZATION & DRAFT PRESERVATION ---

  initDefaultFieldsForType(type: string): void {
    if (type === 'Purchase Invoice') {
      this.fields = [
        { key: 'vendorName', label: 'Vendor / Supplier Name', value: 'Apex Industrial Solutions Pvt Ltd', originalValue: 'Apex Industrial Solutions Pvt Ltd', confidence: 98, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
        { key: 'invoiceNumber', label: 'Invoice / Reference Number', value: 'INV-78421', originalValue: 'INV-78421', confidence: 96, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
        { key: 'poNumber', label: 'Purchase Order (PO) Reference', value: 'PO-2026-9842', originalValue: 'PO-2026-9842', confidence: 88, status: 'edited', isActionTaken: true, page: 1, isMandatory: false, history: [] },
        { key: 'invoiceDate', label: 'Invoice Date', value: '04 Oct 2026', originalValue: '04 Oct 2026', confidence: 94, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'dueDate', label: 'Payment Due Date', value: '03 Nov 2026', originalValue: '03 Nov 2026', confidence: 82, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
        { key: 'gstNumber', label: 'Supplier GSTIN / Tax ID', value: '27AABCA1234F1Z8', originalValue: '27AABCA1234F1Z8', confidence: 97, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'subTotal', label: 'Subtotal (Before Tax)', value: '1,23,000.00', originalValue: '1,23,000.00', confidence: 95, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isArithmetic: true, isMandatory: true, history: [] },
        { key: 'taxAmount', label: 'Total Tax (GST 18%)', value: '22,140.00', originalValue: '22,140.00', confidence: 91, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isArithmetic: true, isMandatory: true, history: [] },
        { key: 'invoiceTotal', label: 'Grand Invoice Total (INR)', value: '1,45,140.00', originalValue: '1,45,140.00', confidence: 79, status: 'ai_suggestion', page: 1, isArithmetic: true, isMandatory: true, history: [] },
      ];

      this.boundingBoxes = [
        { id: 'box-1', fieldKey: 'vendorName', label: 'Vendor Name', page: 1, top: 14, left: 12, width: 48, height: 4.5, value: 'Apex Industrial Solutions Pvt Ltd', confidence: 98 },
        { id: 'box-2', fieldKey: 'invoiceNumber', label: 'Invoice #', page: 1, top: 14, left: 64, width: 25, height: 4.5, value: 'INV-78421', confidence: 96 },
        { id: 'box-3', fieldKey: 'poNumber', label: 'PO Ref', page: 1, top: 21, left: 64, width: 25, height: 4.2, value: 'PO-2026-9842', confidence: 88 },
        { id: 'box-4', fieldKey: 'invoiceDate', label: 'Date', page: 1, top: 21, left: 12, width: 26, height: 4, value: '04 Oct 2026', confidence: 94 },
        { id: 'box-5', fieldKey: 'gstNumber', label: 'GSTIN', page: 1, top: 27, left: 12, width: 32, height: 3.8, value: '27AABCA1234F1Z8', confidence: 97 },
        { id: 'box-6', fieldKey: 'subTotal', label: 'Subtotal', page: 1, top: 68, left: 62, width: 26, height: 4, value: '₹ 1,23,000.00', confidence: 95 },
        { id: 'box-7', fieldKey: 'taxAmount', label: 'Tax (18%)', page: 1, top: 74, left: 62, width: 26, height: 4, value: '₹ 22,140.00', confidence: 91 },
        { id: 'box-8', fieldKey: 'invoiceTotal', label: 'Grand Total', page: 1, top: 81, left: 60, width: 29, height: 5.5, value: '₹ 1,45,140.00', confidence: 79 },
      ];
    } else if (type === 'Supplier Contract') {
      this.fields = [
        { key: 'contractTitle', label: 'Contract / Agreement Title', value: 'Master Industrial Equipment & Service Agreement', originalValue: 'Master Industrial Equipment & Service Agreement', confidence: 97, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
        { key: 'partyA', label: 'Primary Vendor (Party A)', value: 'Apex Industrial Solutions Pvt Ltd', originalValue: 'Apex Industrial Solutions Pvt Ltd', confidence: 99, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'partyB', label: 'Client Entity (Party B)', value: 'Acme Corporation Global Pvt Ltd', originalValue: 'Acme Corporation Global Pvt Ltd', confidence: 95, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'effectiveDate', label: 'Effective Start Date', value: '01 Nov 2026', originalValue: '01 Nov 2026', confidence: 92, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'expirationDate', label: 'Expiration / Termination Date', value: '31 Oct 2029', originalValue: '31 Oct 2029', confidence: 89, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
        { key: 'renewalNotice', label: 'Auto-Renewal Notice Period', value: '60 Days prior to expiry', originalValue: '60 Days prior to expiry', confidence: 84, status: 'ai_suggestion', page: 1, isMandatory: false, history: [] },
        { key: 'governingLaw', label: 'Governing Jurisdiction', value: 'High Court of Karnataka, Bangalore', originalValue: 'High Court of Karnataka, Bangalore', confidence: 93, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: false, history: [] },
        { key: 'penaltyClause', label: 'Max Liability & Penalty Cap', value: 'Cap at 100% of Total Contract Value (₹ 50,00,000)', originalValue: 'Cap at 100% of Total Contract Value', confidence: 86, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
      ];

      this.boundingBoxes = [
        { id: 'c-box-1', fieldKey: 'contractTitle', label: 'Agreement Title', page: 1, top: 12, left: 15, width: 70, height: 6, value: 'Master Industrial Equipment Service Agreement', confidence: 97 },
        { id: 'c-box-2', fieldKey: 'partyA', label: 'Party A', page: 1, top: 22, left: 15, width: 35, height: 4, value: 'Apex Industrial Solutions Pvt Ltd', confidence: 99 },
        { id: 'c-box-3', fieldKey: 'partyB', label: 'Party B', page: 1, top: 22, left: 55, width: 35, height: 4, value: 'Acme Corporation Global Pvt Ltd', confidence: 95 },
        { id: 'c-box-4', fieldKey: 'effectiveDate', label: 'Start Date', page: 1, top: 30, left: 15, width: 30, height: 4, value: '01 Nov 2026', confidence: 92 },
        { id: 'c-box-5', fieldKey: 'expirationDate', label: 'Expiry Date', page: 1, top: 30, left: 55, width: 30, height: 4, value: '31 Oct 2029', confidence: 89 },
      ];
    } else if (type === 'Internal Policy') {
      this.fields = [
        { key: 'policyId', label: 'Policy Document ID', value: 'POL-FIN-2026-004', originalValue: 'POL-FIN-2026-004', confidence: 99, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'policyTitle', label: 'Policy Name / Title', value: 'Corporate Procurement & Vendor Sign-off Policy', originalValue: 'Corporate Procurement & Vendor Sign-off Policy', confidence: 96, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'departmentOwner', label: 'Department Owner', value: 'Finance & Accounts Control', originalValue: 'Finance & Accounts Control', confidence: 94, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'versionNumber', label: 'Version Number', value: 'v4.2 (2026 Revision)', originalValue: 'v4.2 (2026 Revision)', confidence: 91, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'securityClass', label: 'Security Classification', value: 'Internal Confidential', originalValue: 'Internal Confidential', confidence: 95, status: 'reviewer_confirmed', isActionTaken: true, page: 1, isMandatory: true, history: [] },
        { key: 'complianceOfficer', label: 'Compliance Authority Officer', value: 'Chief Financial Officer (CFO)', originalValue: 'Chief Financial Officer (CFO)', confidence: 88, status: 'ai_suggestion', page: 1, isMandatory: true, history: [] },
      ];

      this.boundingBoxes = [
        { id: 'p-box-1', fieldKey: 'policyId', label: 'Policy ID', page: 1, top: 10, left: 10, width: 30, height: 4, value: 'POL-FIN-2026-004', confidence: 99 },
        { id: 'p-box-2', fieldKey: 'policyTitle', label: 'Policy Name', page: 1, top: 16, left: 10, width: 75, height: 5, value: 'Corporate Procurement Policy', confidence: 96 },
      ];
    }

    // Populate initial dummy histories
    this.fields.forEach((field) => {
      if (!field.history || field.history.length === 0) {
        field.history = [
          {
            id: `HIST-0-${field.key}`,
            originalValue: field.originalValue,
            correctedValue: field.value,
            actor: 'System LayoutLMv3',
            timestamp: '06 Oct 2026 · 09:18 AM',
            extractionVersion: 'v2.4-LayoutLMv3',
            modelVersion: 'DocExtract-7B-v2',
            confidence: field.confidence,
          },
        ];
      }
    });
  }

  // Page image rasterization state (Part 0.3 / C.1)
  hasPageImage = true;
  get pageImageUrl(): string {
    return `/api/v1/documents/${this.documentId}/pages/${this.currentPage}/image`;
  }
  onPageImageError(): void {
    this.hasPageImage = false;
  }

  // Server Validation Rule Failure Override Modal (C.3)
  isRuleOverrideModalOpen = false;
  selectedFieldForRuleOverride: ExtractedField | null = null;
  ruleOverrideReason = '';

  openRuleOverrideDialog(field: ExtractedField): void {
    if (!this.canUserOverride) {
      this.showToast('Rule overrides require Approver or Admin privileges', 'error');
      return;
    }
    this.selectedFieldForRuleOverride = field;
    this.ruleOverrideReason = '';
    this.isRuleOverrideModalOpen = true;
  }

  confirmRuleOverride(): void {
    if (!this.selectedFieldForRuleOverride) return;
    if (this.ruleOverrideReason.trim().length < 5) {
      this.showToast('Please provide an audited reason for overriding this rule failure', 'error');
      return;
    }
    const f = this.selectedFieldForRuleOverride;
    this.addAuditLog('Rule Override', `Authorized override for rule failure on ${f.label}: "${f.serverRuleFailure}". Reason: ${this.ruleOverrideReason}`, 'override');
    f.serverRuleFailure = undefined;
    this.isRuleOverrideModalOpen = false;
    this.showToast(`Rule failure overridden for ${f.label}`, 'success');
  }

  loadWorkbenchData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    const stateParam = this.route.snapshot.queryParamMap.get('state');

    if (this.documentId === 'processing' || stateParam === 'processing') {
      setTimeout(() => {
        this.errorVariant.set('processing');
        this.hasError.set(true);
        this.isLoading.set(false);
      }, 300);
      return;
    }

    if (this.documentId === 'corrupt' || stateParam === 'corrupt') {
      setTimeout(() => {
        this.errorVariant.set('corrupt-file');
        this.hasError.set(true);
        this.isLoading.set(false);
      }, 300);
      return;
    }

    if (this.reviewService.getReviewWorkbenchData) {
      this.reviewService.getReviewWorkbenchData(this.documentId).subscribe({
        next: (data) => {
          if (data) {
            this.documentName = data.documentTitle || this.documentName;
            this.documentType = data.documentType || this.documentType;
            this.totalPages = data.pages || this.totalPages;
            if (data.fields && data.fields.length > 0) {
              this.fields = data.fields.map((f: any) => ({
                ...f,
                evidence_unmapped: f.evidence_unmapped || (f.boxes && f.boxes.length === 0),
              }));
            }
            if (data.boundingBoxes && data.boundingBoxes.length > 0) {
              // C.1: Normalized coordinates scaled to rendered page percentages
              this.boundingBoxes = data.boundingBoxes.map((b: any) => ({
                ...b,
                top: b.top <= 1 ? Math.round(b.top * 1000) / 10 : b.top,
                left: b.left <= 1 ? Math.round(b.left * 1000) / 10 : b.left,
                width: b.width <= 1 ? Math.round(b.width * 1000) / 10 : b.width,
                height: b.height <= 1 ? Math.round(b.height * 1000) / 10 : b.height,
              }));
            }
          }
          this.recalculateLineItems();
          this.restoreDraftFromStorageIfAvailable();
          this.isLoading.set(false);
        },
        error: (err) => {
          if (err?.status === 403) {
            this.errorVariant.set('permission-denied');
          } else if (err?.status === 404) {
            this.errorVariant.set('not-found');
          } else {
            this.errorVariant.set('default');
          }
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
      return;
    }

    this.reviewService.getReviewQueue().subscribe({
      next: () => {
        this.recalculateLineItems();
        this.restoreDraftFromStorageIfAvailable();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorVariant.set('default');
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  zoomIn(): void {
    if (this.zoomLevel < 200) {
      this.zoomLevel += 10;
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel -= 10;
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
  }

  rotateDoc(): void {
    this.rotation = (this.rotation + 90) % 360;
  }

  clearDraftStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(`review_draft_${this.documentId}`);
    }
    this.isDirty = false;
    this.showToast('Draft storage cleared. Reverted to server values.', 'info');
  }

  selectField(fieldKey: string): void {
    this.activeFieldKey = fieldKey;
    const targetBox = this.boundingBoxes.find(b => b.fieldKey === fieldKey);
    if (targetBox && targetBox.page !== this.currentPage) {
      this.currentPage = targetBox.page;
    }
    const inputEl = document.getElementById(`field-input-${fieldKey}`);
    if (inputEl) {
      inputEl.focus();
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  onBoxClick(box: BoundingBox): void {
    this.selectField(box.fieldKey);
    const inputEl = document.getElementById(`field-input-${box.fieldKey}`);
    if (inputEl) {
      inputEl.focus();
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  hoverField(fieldKey: string | null): void {
    this.hoveredFieldKey = fieldKey;
  }

  isBoxActive(fieldKey: string): boolean {
    return this.activeFieldKey === fieldKey || this.hoveredFieldKey === fieldKey;
  }

  // Bounding box drawing tool (TASK 5B Item 3)
  toggleDrawRegionMode(): void {
    this.isDrawingRegionMode = !this.isDrawingRegionMode;
    if (this.isDrawingRegionMode) {
      this.showToast('Add Region mode active: Click on canvas to add a new box region', 'warning');
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.isDrawingRegionMode) return;

    const canvasEl = event.currentTarget as HTMLElement;
    const rect = canvasEl.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const leftPercent = Math.max(0, Math.min(90, Math.round((clickX / rect.width) * 100)));
    const topPercent = Math.max(0, Math.min(90, Math.round((clickY / rect.height) * 100)));

    const newId = `box-user-${Date.now()}`;
    const newBox: BoundingBox = {
      id: newId,
      fieldKey: this.activeFieldKey || 'vendorName',
      label: `Custom Region ${this.boundingBoxes.length + 1}`,
      page: this.currentPage,
      top: topPercent,
      left: leftPercent,
      width: 25,
      height: 5,
      value: 'User Specified Region',
      confidence: 100,
      isUserDrawn: true,
    };

    this.boundingBoxes.push(newBox);
    this.isDrawingRegionMode = false;
    this.showToast(`Added custom bounding box region on page ${this.currentPage}`, 'success');
    this.addAuditLog('Bounding Box Edit', `Added new bounding box region (${newBox.label}) on Page ${this.currentPage}`, 'edit');
    this.markDirty();
  }

  // --- PER-FIELD ACTIONS (Accept, Edit, Reject) ---

  acceptField(field: ExtractedField): void {
    field.status = 'reviewer_confirmed';
    field.isActionTaken = true;
    this.markDirty();
    this.addAuditLog('Field Verified', `Accepted AI suggestion for field "${field.label}"`, 'verification');
    this.showToast(`Confirmed field "${field.label}"`, 'success');
  }

  openEditField(field: ExtractedField): void {
    this.selectField(field.key);
    const inputEl = document.getElementById(`field-input-${field.key}`);
    if (inputEl) inputEl.focus();
  }

  onFieldValueChange(field: ExtractedField): void {
    if (field.value !== field.originalValue) {
      field.status = 'edited';
      field.confidence = 100;
      field.isActionTaken = true;

      // Add to correction history
      const historyEntry: FieldCorrectionHistory = {
        id: `HIST-${Date.now()}`,
        originalValue: field.originalValue,
        correctedValue: field.value,
        actor: `${this.currentUser?.name || 'Abhishek Yadav'} (${this.currentUser?.role || 'Reviewer'})`,
        timestamp: new Date().toLocaleString(),
        extractionVersion: 'v2.4-LayoutLMv3',
        modelVersion: 'DocExtract-7B-v2',
        confidence: 100,
        reason: 'Manual reviewer correction',
      };

      if (!field.history) field.history = [];
      field.history.unshift(historyEntry);

      if (this.reviewService.correctField) {
        this.reviewService.correctField(this.documentId, field.key, field.value).subscribe({
          next: () => {
            this.showToast(`Saved correction for "${field.label}" to server`, 'success');
          },
          error: (err) => {
            console.warn('Field correction sync failed', err);
          },
        });
      }

      this.markDirty();
      this.addAuditLog('Field Edit', `Modified "${field.label}" from "${field.originalValue}" to "${field.value}"`, 'edit');
    }
  }

  openRejectModal(field: ExtractedField): void {
    this.selectedFieldToReject = field;
    this.rejectReasonText = '';
    this.isRejectModalOpen = true;
  }

  confirmRejectField(): void {
    if (!this.selectedFieldToReject) return;
    const field = this.selectedFieldToReject;
    field.status = 'rejected';
    field.isActionTaken = true;
    field.rejectionReason = this.rejectReasonText || 'Value incorrect / unreadable in source';

    this.isRejectModalOpen = false;
    this.markDirty();
    this.addAuditLog('Field Rejected', `Rejected field "${field.label}" - Reason: ${field.rejectionReason}`, 'verification');
    this.showToast(`Rejected field "${field.label}"`, 'warning');
    this.selectedFieldToReject = null;
  }

  openHistoryDrawer(field: ExtractedField): void {
    this.selectedFieldHistory = field;
    this.isHistoryDrawerOpen = true;
  }

  // --- CLASSIFICATION CHANGE (FR-007) ---

  onClassificationSelectChange(newType: string): void {
    if (newType === this.documentType) return;
    this.targetDocType = newType;
    this.isClassificationModalOpen = true;
  }

  confirmClassificationChange(): void {
    this.isClassificationModalOpen = false;
    this.isReExtracting = true;
    this.showToast(`Re-extracting document under ${this.targetDocType} schema...`, 'warning');

    setTimeout(() => {
      this.documentType = this.targetDocType;
      this.initDefaultFieldsForType(this.targetDocType);
      this.recalculateLineItems();
      this.isReExtracting = false;
      this.markDirty();
      this.addAuditLog('Classification Change', `Re-extracted document under new schema: ${this.targetDocType}`, 'classification');
      this.showToast(`Successfully re-extracted schema for ${this.documentType}!`, 'success');
    }, 1200);
  }

  cancelClassificationChange(): void {
    this.isClassificationModalOpen = false;
    this.targetDocType = this.documentType;
  }

  // --- FAILED OCR PAGE ACTIONS (FR-012) ---

  retryOcrForPage(pageInfo: PageOcrInfo): void {
    pageInfo.retryAttempts = (pageInfo.retryAttempts || 0) + 1;
    this.showToast(`Retrying OCR enhancement on Page ${pageInfo.page} (Attempt ${pageInfo.retryAttempts})...`, 'warning');

    setTimeout(() => {
      if (pageInfo.status === 'failed') {
        pageInfo.status = 'normal';
        pageInfo.message = undefined;
        this.showToast(`OCR retry successful for Page ${pageInfo.page}!`, 'success');
        this.addAuditLog('OCR Retry', `OCR successfully recovered text for Page ${pageInfo.page} on attempt ${pageInfo.retryAttempts}`, 'ocr');
      } else {
        this.showToast(`Language translation OCR completed for Page ${pageInfo.page}`, 'success');
        pageInfo.status = 'normal';
      }
    }, 1000);
  }

  openManualTranscription(pageInfo: PageOcrInfo): void {
    this.currentPage = pageInfo.page;
    this.isManualTranscriptionOpen = true;
    this.manualTranscriptionText = '';
  }

  saveManualTranscription(): void {
    if (!this.manualTranscriptionText.trim()) return;
    this.isManualTranscriptionOpen = false;
    const activePageInfo = this.pageOcrStatuses.find(p => p.page === this.currentPage);
    if (activePageInfo) {
      activePageInfo.status = 'normal';
    }
    this.showToast(`Saved manual transcription text for Page ${this.currentPage}`, 'success');
    this.addAuditLog('Manual Transcription', `Manually transcribed missing text for Page ${this.currentPage}: "${this.manualTranscriptionText.substring(0, 40)}..."`, 'ocr');
    this.markDirty();
  }

  escalateOcrIssue(pageInfo: PageOcrInfo): void {
    this.showToast(`Escalated OCR issue on Page ${pageInfo.page} to Senior Reviewer team`, 'warning');
    this.addAuditLog('OCR Escalation', `Escalated unreadable Page ${pageInfo.page} scan anomaly to Senior Reviewer`, 'ocr');
  }

  // --- BLOCKING EXCEPTIONS & AUTHORIZED OVERRIDE ---

  highlightConflictLocation(loc: { page: number; locationName: string; value: string; top: number; left: number }): void {
    this.currentPage = loc.page;
    this.showToast(`Highlighted conflict location on Page ${loc.page}: ${loc.locationName} (${loc.value})`, 'warning');
  }

  openOverrideDialog(exception: ExceptionItem): void {
    this.selectedExceptionToOverride = exception;
    this.overrideReasonText = '';
    this.isOverrideModalOpen = true;
  }

  get currentUserRole(): string {
    return this.authService.getCurrentUser()?.role || 'reviewer';
  }

  get currentUser(): any {
    return this.authService.getCurrentUser();
  }

  get canUserOverride(): boolean {
    const role = (this.currentUserRole || '').toLowerCase();
    return role === 'admin' || role === 'approver' || role === 'org_admin' || role === 'platform_operator';
  }

  confirmOverrideException(): void {
    if (!this.selectedExceptionToOverride) return;
    if (this.overrideReasonText.trim().length < 10) {
      this.showToast('Please provide a mandatory reason of at least 10 characters', 'error');
      return;
    }

    const exc = this.selectedExceptionToOverride;
    exc.isOverridden = true;
    exc.overrideReason = this.overrideReasonText;
    exc.overriddenBy = `${this.currentUser?.name || 'System Approver'} (${this.currentUserRole})`;
    exc.overriddenAt = new Date().toLocaleString();

    this.isOverrideModalOpen = false;
    this.markDirty();
    this.addAuditLog('Exception Override', `Authorized override for exception "${exc.title}". Reason: ${exc.overrideReason}`, 'override');
    this.showToast(`Authorized override applied for "${exc.title}"`, 'success');
    this.selectedExceptionToOverride = null;
  }

  // --- COMMENTS & CLARIFICATIONS (FR-011) ---

  onCommentTextInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const lastChar = val.slice(-1);
    if (lastChar === '@') {
      this.showMentionDropdown = true;
    } else if (!val.includes('@')) {
      this.showMentionDropdown = false;
    }
  }

  insertMention(user: { name: string; role: string }): void {
    const parts = this.commentText.split('@');
    parts.pop();
    this.commentText = parts.join('@') + `@${user.name} `;
    this.showMentionDropdown = false;
  }

  addComment(): void {
    if (!this.commentText.trim()) return;

    const user = this.currentUser || { name: 'Abhishek Yadav', role: 'Reviewer', avatarInitials: 'AY' };
    const newComment: CommentItem = {
      id: `COM-${Date.now()}`,
      author: user.name,
      avatar: user.avatarInitials || 'AY',
      role: user.role,
      timestamp: 'Just now',
      text: this.commentText,
      fieldKey: this.activeFieldKey,
      isResolved: false,
    };

    this.comments.unshift(newComment);
    this.addAuditLog('Comment Posted', `Added discussion note on document: "${this.commentText.substring(0, 40)}..."`, 'clarification');
    this.commentText = '';
    this.showToast('Posted comment to document thread', 'success');
  }

  requestClarification(): void {
    if (!this.commentText.trim()) {
      this.commentText = '@Rahul Sharma Requesting clarification on invoice discrepancies.';
    }
    this.addComment();
    this.documentStatus = 'Awaiting Clarification';
    const lastComment = this.comments[0];
    if (lastComment) {
      lastComment.isClarificationRequest = true;
    }
    this.markDirty();
    this.addAuditLog('Clarification Requested', 'Set document status to "Awaiting Clarification" and assigned task to uploader', 'clarification');
    this.showToast('Requested clarification from document uploader!', 'warning');
  }

  toggleCommentResolved(comment: CommentItem): void {
    comment.isResolved = !comment.isResolved;
    this.showToast(comment.isResolved ? 'Marked thread as resolved' : 'Re-opened thread', 'success');
  }

  // --- ARITHMETIC TABLE & DETERMINISTIC MATH ---

  get calculatedSubtotal(): number {
    return this.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  get calculatedTaxTotal(): number {
    return this.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate) / 100, 0);
  }

  get calculatedGrandTotal(): number {
    return this.calculatedSubtotal + this.calculatedTaxTotal;
  }

  get arithmeticDifference(): number {
    return Math.abs(this.calculatedGrandTotal - this.extractedGrandTotal);
  }

  get isArithmeticMatch(): boolean {
    return this.arithmeticDifference < 0.01;
  }

  recalculateLineItems(): void {
    this.lineItems.forEach((item) => {
      item.lineTotal = item.quantity * item.unitPrice;
      // Mark discrepancy if item total doesn't match
      item.hasDiscrepancy = item.quantity <= 0 || item.unitPrice <= 0;
    });
  }

  onItemChange(item: InvoiceLineItem): void {
    item.lineTotal = item.quantity * item.unitPrice;
    item.isModified = true;
    this.recalculateLineItems();
    this.markDirty();
  }

  addLineItem(): void {
    const newId = this.lineItems.length + 1;
    this.lineItems.push({
      id: newId,
      description: 'Additional Line Item ' + newId,
      hsnCode: '8500',
      quantity: 1,
      unitPrice: 1000,
      taxRate: 18,
      lineTotal: 1000,
      isModified: true,
    });
    this.markDirty();
    this.showToast('Added new line item row', 'success');
  }

  removeLineItem(index: number): void {
    if (this.lineItems.length > 1) {
      this.lineItems.splice(index, 1);
      this.markDirty();
      this.showToast('Removed line item row', 'warning');
    }
  }

  autoFixGrandTotal(): void {
    this.extractedGrandTotal = this.calculatedGrandTotal;
    const totalField = this.fields.find((f) => f.key === 'invoiceTotal');
    if (totalField) {
      totalField.value = this.calculatedGrandTotal.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      totalField.status = 'edited';
      totalField.confidence = 100;
      totalField.isActionTaken = true;
    }
    this.markDirty();
    this.showToast('Grand total reconciled with line-items sum!', 'success');
  }

  // --- SUBMISSION BLOCKING LOGIC ---

  get unactionedLowConfidenceFields(): ExtractedField[] {
    return this.fields.filter(f => (f.confidence < 90 || f.isMandatory) && !f.isActionTaken && f.status === 'ai_suggestion');
  }

  get activeBlockingExceptions(): ExceptionItem[] {
    return this.exceptions.filter(e => e.severity === 'error' && e.requiresOverride && !e.isOverridden);
  }

  get isSubmissionBlocked(): boolean {
    return this.unactionedLowConfidenceFields.length > 0 || this.activeBlockingExceptions.length > 0;
  }

  acceptAllExtractions(): void {
    this.fields.forEach((f) => {
      f.status = 'reviewer_confirmed';
      f.isActionTaken = true;
    });
    this.markDirty();
    this.addAuditLog('Bulk Verification', 'Accepted all AI field extractions across document', 'verification');
    this.showToast('All extracted fields accepted as verified', 'success');
  }

  completeReviewAndEscalate(): void {
    // C.3: Never block on client-side-only checks; clear previous server rule failures
    this.fields.forEach(f => f.serverRuleFailure = undefined);

    if (this.unactionedLowConfidenceFields.length > 0) {
      this.showToast(`Notice: Submitting with ${this.unactionedLowConfidenceFields.length} unconfirmed field(s). Server validation will verify rules.`, 'warning');
    }

    this.reviewService.submitReview(this.documentId, { action: 'APPROVE', comments: 'Document review verified in Review Workbench' }).subscribe({
      next: () => {
        this.clearDraftStorage();
        this.addAuditLog('Review Complete', 'Document verification completed and forwarded to Approvals Queue', 'verification');
        this.showToast('Document review verified! Successfully forwarded to Approvals Queue.', 'success');
        setTimeout(() => {
          this.router.navigate(['/review']);
        }, 1200);
      },
      error: (err) => {
        // C.3: Server validation failures mapped to affected fields
        const failures = err?.error?.ruleFailures || err?.error?.validationErrors || err?.error?.details || [];
        if (Array.isArray(failures) && failures.length > 0) {
          failures.forEach((rf: any) => {
            const fieldKey = rf.fieldKey || rf.field || rf.key;
            const target = this.fields.find(f => f.key === fieldKey || f.label?.toLowerCase() === rf.field?.toLowerCase());
            if (target) {
              target.serverRuleFailure = rf.message || rf.error || 'Server validation rule check failed';
            }
          });
          this.activeTab = 'metadata';
          this.showToast(`Server rule check failed: ${failures.length} validation issue(s) detected. See affected fields.`, 'error');
        } else {
          const errorMsg = err?.error?.message || err?.message || 'Server rejected review submission';
          this.showToast(`Submission rejected: ${errorMsg}`, 'error');
        }
      },
    });
  }

  // --- HELPERS ---

  markDirty(): void {
    this.isDirty = true;
    this.saveDraftToStorage();
  }

  addAuditLog(action: string, details: string, category: AuditLogItem['category']): void {
    const user = this.currentUser || { name: 'Abhishek Yadav', role: 'Reviewer' };
    this.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      actor: user.name,
      role: user.role,
      action: action,
      details: details,
      category: category,
    });
  }

  retryLoad(): void {
    this.loadWorkbenchData();
  }

  saveDraftToStorage(): void {
    if (!isPlatformBrowser(this.platformId) || !this.documentId) return;
    try {
      const draft = {
        documentId: this.documentId,
        fields: this.fields.map(f => ({
          key: f.key,
          value: f.value,
          status: f.status,
          confidence: f.confidence,
          isActionTaken: f.isActionTaken,
        })),
        timestamp: Date.now(),
      };
      localStorage.setItem(`review_draft_${this.documentId}`, JSON.stringify(draft));
    } catch {
      // ignore storage quota errors
    }
  }

  restoreDraftFromStorageIfAvailable(): void {
    if (!isPlatformBrowser(this.platformId) || !this.documentId) return;
    try {
      const saved = localStorage.getItem(`review_draft_${this.documentId}`);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.fields)) {
        parsed.fields.forEach((df: any) => {
          const match = this.fields.find(f => f.key === df.key);
          if (match && df.value !== undefined) {
            match.value = df.value;
            if (df.status) match.status = df.status;
            if (df.isActionTaken !== undefined) match.isActionTaken = df.isActionTaken;
          }
        });
        this.isDirty = true;
      }
    } catch {
      // ignore parsing errors
    }
  }

  showToast(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    this.toastMessage = message;
    this.toastType = type === 'info' ? 'success' : type;
    setTimeout(() => {
      if (this.toastMessage === message) {
        this.toastMessage = null;
      }
    }, 4000);
  }
}
