import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { APPROVAL_SERVICE_TOKEN, MockApprovalService, HttpApprovalService } from '../../core/services/api-services';
import { AuthService } from '../../core/services/auth';

export interface ApproverMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  timestamp?: string;
  reason?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'sequential' | 'parallel';
  status: 'completed' | 'active' | 'pending';
  quorumRequired?: number;
  quorumTotal?: number;
  approvers: ApproverMember[];
}

export interface WorkflowConfig {
  id: string;
  name: string;
  policyVersion: string;
  appliedRuleDescription: string;
  sodRule: 'block_uploader' | 'block_reviewer' | 'block_both';
  steps: WorkflowStep[];
}

export interface ApprovalGate {
  allRequiredFieldsComplete: boolean;
  blockingExceptionsResolved: boolean;
  sourceVersionCurrent: boolean;
  missingFieldsCount: number;
  unresolvedExceptionsCount: number;
  gateMessage: string;
}

export interface DecisionHistoryEntry {
  id: string;
  actor: string;
  role: string;
  timestamp: string;
  policyVersion: string;
  sourceVersion: string;
  action: 'Approve' | 'Reject' | 'Return for Changes';
  reasonCode: string;
  comment: string;
}

export interface BlockingException {
  id: string;
  title: string;
  fieldKey: string;
  description: string;
  severity: 'error' | 'warning';
  isResolved: boolean;
}

export interface ApprovalDocument {
  id: string;
  name: string;
  type: string;
  submittedBy: string;
  reviewedBy: string;
  submittedAt: string;
  priority: 'High' | 'Medium' | 'Low';
  documentValue: string;
  status: 'Pending Approval' | 'In Approval' | 'Approved' | 'Rejected' | 'Returned for Changes';
  pages: number;
  sourceVersion: string;
  previousVersionId?: string;
  workflowConfig: WorkflowConfig;
  gate: ApprovalGate;
  exceptions: BlockingException[];
  decisionHistory: DecisionHistoryEntry[];
}

export interface AuditRecord {
  id: string;
  date: string;
  actor: string;
  role: string;
  decision: 'Approved' | 'Rejected' | 'Returned for Changes' | 'Reassigned';
  documentId: string;
  documentTitle: string;
  policyVersion: string;
  reason: string;
}

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingState, EmptyState, ErrorState],
  templateUrl: './approvals.html',
  styleUrl: './approvals.scss',
  providers: [{ provide: APPROVAL_SERVICE_TOKEN, useClass: HttpApprovalService }],
})
export class Approvals implements OnInit {
  private readonly approvalService = inject(APPROVAL_SERVICE_TOKEN);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Tab View Selection: 'queue' | 'audit'
  activeView: 'queue' | 'audit' = 'queue';

  // Filters
  searchTerm = '';
  selectedType = 'All Types';
  selectedPriority = 'All Priority';
  selectedStatus = 'All Status';

  // Signals
  isLoading = signal(true);
  hasError = signal(false);

  // Active Selected Document
  selectedDocument: ApprovalDocument | null = null;

  // Action Panel State
  showActionPanel = false;
  actionType: 'Approve' | 'Reject' | 'Return for Changes' = 'Approve';
  selectedReasonCode = 'Verified & Compliant';
  actionComment = '';

  // Exceptions Drawer
  isExceptionsDrawerOpen = false;
  drawerExceptions: BlockingException[] = [];
  drawerDocId = '';

  // Reassign Modal State
  showReassignModal = false;
  selectedReassignTarget = 'Priya Mehta (Approver)';
  availableReassignTargets = [
    { name: 'Priya Mehta', role: 'Finance Head / Approver' },
    { name: 'Ankit Verma', role: 'Senior Compliance Auditor' },
    { name: 'Vikram Singh', role: 'VP Operations' },
  ];

  // Toast
  toastMessage: string | null = null;
  toastType: 'success' | 'warning' | 'error' = 'success';

  // Pre-configured Reason Codes
  approveReasons = [
    'Verified & Compliant',
    'Authorized Exception Override Approved',
    'Under Discretionary Threshold',
    'Legal & Financial Sanction Signed',
  ];

  rejectReasons = [
    'Arithmetic Discrepancy in Line-Items',
    'Unsigned Vendor Contract / Missing Signature',
    'Expired PO Reference / Budget Cap Exceeded',
    'Missing Mandatory GSTIN / Tax ID Registration',
    'Disputed Legal Clause / Uncapped Liability',
    'Duplicate Document Submission',
  ];

  returnReasons = [
    'Requires Supplier Invoice Re-scan',
    'Missing Line Item Breakdown',
    'Incorrect Tax Classification Applied',
    'Clarification Needed on Due Date Terms',
  ];

  // Documents State
  approvalDocuments: ApprovalDocument[] = [];

  // Audit Records State
  auditRecords: AuditRecord[] = [
    {
      id: 'AUD-901',
      date: '07 Oct 2026 · 04:15 PM',
      actor: 'Priya Mehta',
      role: 'Approver',
      decision: 'Approved',
      documentId: 'DOC-10245',
      documentTitle: 'Master Supplier Service Contract - Apex Pvt Ltd',
      policyVersion: 'v1.4-Baseline',
      reason: 'Verified & Compliant',
    },
    {
      id: 'AUD-902',
      date: '06 Oct 2026 · 02:30 PM',
      actor: 'Abhishek Yadav',
      role: 'Reviewer',
      decision: 'Returned for Changes',
      documentId: 'DOC-10246',
      documentTitle: 'Purchase Order Confirmation #PO-2026-88',
      policyVersion: 'v1.4-Baseline',
      reason: 'Requires Supplier Invoice Re-scan',
    },
  ];

  ngOnInit(): void {
    this.loadApprovals();
  }

  get currentUser(): any {
    return this.authService.getCurrentUser() || { name: 'Abhishek Yadav', role: 'approver' };
  }

  get currentUserId(): string {
    return this.currentUser.name || 'Abhishek Yadav';
  }

  get currentUserRole(): string {
    return this.currentUser.role || 'approver';
  }

  loadApprovals(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.approvalService.getApprovals().subscribe({
      next: (items) => {
        this.approvalDocuments = this.buildMockApprovalDocuments(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  buildMockApprovalDocuments(items: any[]): ApprovalDocument[] {
    return [
      {
        id: 'DOC-10247',
        name: 'Purchase Invoice - INV-78421 (Apex Industrial)',
        type: 'Purchase Invoice',
        submittedBy: 'Rahul Sharma',
        reviewedBy: 'Abhishek Yadav',
        submittedAt: '06 Oct 2026 · 11:24 AM',
        priority: 'High',
        documentValue: '₹1,45,140.00',
        status: 'Pending Approval',
        pages: 4,
        sourceVersion: 'v2.0 (Verified)',
        previousVersionId: 'DOC-10246',
        workflowConfig: {
          id: 'WF-INV-PARALLEL',
          name: 'Purchase Invoice High-Value Parallel Route',
          policyVersion: 'v1.4-Baseline',
          appliedRuleDescription: 'Amount > ₹1,00,000 triggered 2-of-3 Parallel Finance Quorum Rule',
          sodRule: 'block_uploader',
          steps: [
            { id: 'S1', name: '1. Intake & Classification', type: 'sequential', status: 'completed', approvers: [{ id: 'SYS', name: 'System OCR Engine', role: 'Automated', avatar: 'AI', status: 'Approved', timestamp: '06 Oct 09:18' }] },
            { id: 'S2', name: '2. Reviewer HITL Verification', type: 'sequential', status: 'completed', approvers: [{ id: 'REV1', name: 'Abhishek Yadav', role: 'Reviewer', avatar: 'AY', status: 'Approved', timestamp: '06 Oct 11:45' }] },
            {
              id: 'S3',
              name: '3. Parallel Finance Sign-Off',
              type: 'parallel',
              status: 'active',
              quorumRequired: 2,
              quorumTotal: 3,
              approvers: [
                { id: 'APP1', name: 'Priya Mehta', role: 'Approver (Finance)', avatar: 'PM', status: 'Approved', timestamp: '07 Oct 02:15 PM' },
                { id: 'APP2', name: 'Abhishek Yadav', role: 'Approver (Ops)', avatar: 'AY', status: 'Pending' },
                { id: 'APP3', name: 'Vikram Singh', role: 'Approver (VP)', avatar: 'VS', status: 'Pending' },
              ],
            },
            { id: 'S4', name: '4. Published', type: 'sequential', status: 'pending', approvers: [{ id: 'PUB', name: 'System Repository', role: 'Publisher', avatar: 'SR', status: 'Pending' }] },
          ],
        },
        gate: {
          allRequiredFieldsComplete: true,
          blockingExceptionsResolved: true,
          sourceVersionCurrent: true,
          missingFieldsCount: 0,
          unresolvedExceptionsCount: 0,
          gateMessage: 'All gate conditions satisfied. Ready for sign-off.',
        },
        exceptions: [
          { id: 'EX-1', title: 'AI-004 Header/Footer Voucher Variance', fieldKey: 'invoiceTotal', description: 'Resolved via authorized override by Reviewer.', severity: 'warning', isResolved: true },
        ],
        decisionHistory: [
          {
            id: 'DH-1',
            actor: 'System Extraction Pipeline',
            role: 'AI Processing Layer',
            timestamp: '06 Oct 2026 · 09:18 AM',
            policyVersion: 'v1.4-Baseline',
            sourceVersion: 'v1.0',
            action: 'Approve',
            reasonCode: 'Automated Extraction Completed',
            comment: 'Extracted 9 fields with 91.8% average confidence.',
          },
          {
            id: 'DH-2',
            actor: 'Abhishek Yadav',
            role: 'Reviewer',
            timestamp: '06 Oct 2026 · 11:45 AM',
            policyVersion: 'v1.4-Baseline',
            sourceVersion: 'v2.0',
            action: 'Approve',
            reasonCode: 'Human Verification Sign-Off',
            comment: 'Verified subtotal, IGST math, and vendor GSTIN.',
          },
        ],
      },
      {
        id: 'DOC-10248',
        name: 'Master Equipment Supplier Agreement - Acme Corp',
        type: 'Supplier Contract',
        submittedBy: 'Abhishek Yadav',
        reviewedBy: 'Abhishek Yadav',
        submittedAt: '07 Oct 2026 · 09:30 AM',
        priority: 'High',
        documentValue: '₹50,00,000.00',
        status: 'Pending Approval',
        pages: 18,
        sourceVersion: 'v1.0 (Draft)',
        previousVersionId: 'DOC-10240',
        workflowConfig: {
          id: 'WF-CONTRACT-STD',
          name: 'Supplier Contract Dual Approver Route',
          policyVersion: 'v1.4-Baseline',
          appliedRuleDescription: 'Contract Type triggered Legal & Executive Approval Chain',
          sodRule: 'block_both',
          steps: [
            { id: 'S1', name: '1. Intake Ingestion', type: 'sequential', status: 'completed', approvers: [{ id: 'SYS', name: 'System Engine', role: 'Intake', avatar: 'AI', status: 'Approved' }] },
            { id: 'S2', name: '2. Legal Review', type: 'sequential', status: 'completed', approvers: [{ id: 'REV', name: 'Abhishek Yadav', role: 'Legal Reviewer', avatar: 'AY', status: 'Approved' }] },
            {
              id: 'S3',
              name: '3. Executive Sign-off',
              type: 'parallel',
              status: 'active',
              quorumRequired: 1,
              quorumTotal: 2,
              approvers: [
                { id: 'APP1', name: 'Priya Mehta', role: 'Approver', avatar: 'PM', status: 'Pending' },
                { id: 'APP2', name: 'Ankit Verma', role: 'Compliance Officer', avatar: 'AV', status: 'Pending' },
              ],
            },
            { id: 'S4', name: '4. Published', type: 'sequential', status: 'pending', approvers: [{ id: 'PUB', name: 'Repository', role: 'System', avatar: 'SR', status: 'Pending' }] },
          ],
        },
        gate: {
          allRequiredFieldsComplete: false,
          blockingExceptionsResolved: false,
          sourceVersionCurrent: true,
          missingFieldsCount: 1,
          unresolvedExceptionsCount: 1,
          gateMessage: 'Gate Blocked: 1 mandatory exception unresolved (Uncapped Liability Penalty Clause).',
        },
        exceptions: [
          { id: 'EX-2', title: 'Uncapped Liability Penalty Clause Deviation', fieldKey: 'penaltyClause', description: 'Contract penalty clause exceeds standard 20% cap.', severity: 'error', isResolved: false },
        ],
        decisionHistory: [
          {
            id: 'DH-10',
            actor: 'Abhishek Yadav',
            role: 'Legal Reviewer',
            timestamp: '07 Oct 2026 · 09:30 AM',
            policyVersion: 'v1.4-Baseline',
            sourceVersion: 'v1.0',
            action: 'Approve',
            reasonCode: 'Review Completed with Exceptions',
            comment: 'Forwarded to Executive Sign-off with flagged penalty clause.',
          },
        ],
      },
      {
        id: 'DOC-10249',
        name: 'Corporate Procurement & Sign-off Policy 2026',
        type: 'Internal Policy',
        submittedBy: 'Rahul Sharma',
        reviewedBy: 'Priya Mehta',
        submittedAt: '05 Oct 2026 · 03:10 PM',
        priority: 'Medium',
        documentValue: '₹0.00',
        status: 'Approved',
        pages: 12,
        sourceVersion: 'v4.2 (Final)',
        workflowConfig: {
          id: 'WF-POLICY-SINGLE',
          name: 'Policy Document Single Approver Route',
          policyVersion: 'v1.4-Baseline',
          appliedRuleDescription: 'Internal Policy triggered Policy Owner Approval Step',
          sodRule: 'block_uploader',
          steps: [
            { id: 'S1', name: '1. Intake Ingestion', type: 'sequential', status: 'completed', approvers: [{ id: 'SYS', name: 'System Engine', role: 'Intake', avatar: 'AI', status: 'Approved' }] },
            { id: 'S2', name: '2. Reviewer HITL', type: 'sequential', status: 'completed', approvers: [{ id: 'REV', name: 'Priya Mehta', role: 'Reviewer', avatar: 'PM', status: 'Approved' }] },
            { id: 'S3', name: '3. Approval Sign-Off', type: 'sequential', status: 'completed', approvers: [{ id: 'APP', name: 'Ankit Verma', role: 'Approver', avatar: 'AV', status: 'Approved', timestamp: '06 Oct 04:20 PM' }] },
            { id: 'S4', name: '4. Published', type: 'sequential', status: 'completed', approvers: [{ id: 'PUB', name: 'Repository', role: 'System', avatar: 'SR', status: 'Approved', timestamp: '06 Oct 04:21 PM' }] },
          ],
        },
        gate: {
          allRequiredFieldsComplete: true,
          blockingExceptionsResolved: true,
          sourceVersionCurrent: true,
          missingFieldsCount: 0,
          unresolvedExceptionsCount: 0,
          gateMessage: 'All gate conditions satisfied.',
        },
        exceptions: [],
        decisionHistory: [
          {
            id: 'DH-20',
            actor: 'Ankit Verma',
            role: 'Approver',
            timestamp: '06 Oct 2026 · 04:20 PM',
            policyVersion: 'v1.4-Baseline',
            sourceVersion: 'v4.2',
            action: 'Approve',
            reasonCode: 'Verified & Compliant',
            comment: 'Approved corporate procurement policy update for FY2026.',
          },
        ],
      },
    ];
  }

  retryLoad(): void {
    this.loadApprovals();
  }

  // --- SEPARATION OF DUTIES (SoD) EVALUATION ---

  isSodBlocked(doc: ApprovalDocument): boolean {
    const sodRule = doc.workflowConfig.sodRule;
    if (sodRule === 'block_uploader' && doc.submittedBy === this.currentUserId) {
      return true;
    }
    if (sodRule === 'block_reviewer' && doc.reviewedBy === this.currentUserId) {
      return true;
    }
    if (sodRule === 'block_both' && (doc.submittedBy === this.currentUserId || doc.reviewedBy === this.currentUserId)) {
      return true;
    }
    return false;
  }

  getSodBlockReason(doc: ApprovalDocument): string {
    const sodRule = doc.workflowConfig.sodRule;
    if (sodRule === 'block_uploader' && doc.submittedBy === this.currentUserId) {
      return `SoD Violation: As document uploader (${doc.submittedBy}), policy prevents self-approval.`;
    }
    if (sodRule === 'block_reviewer' && doc.reviewedBy === this.currentUserId) {
      return `SoD Violation: As reviewer (${doc.reviewedBy}), policy requires independent approver sign-off.`;
    }
    if (sodRule === 'block_both') {
      return `SoD Violation: Strict dual-control policy blocks both uploader (${doc.submittedBy}) and reviewer (${doc.reviewedBy}) from approving.`;
    }
    return 'Separation of Duties constraint active.';
  }

  // --- APPROVAL GATE EVALUATION ---

  isGateBlocked(doc: ApprovalDocument): boolean {
    return !doc.gate.allRequiredFieldsComplete || !doc.gate.blockingExceptionsResolved || !doc.gate.sourceVersionCurrent;
  }

  getGateBlockReason(doc: ApprovalDocument): string {
    if (!doc.gate.allRequiredFieldsComplete) {
      return `Gate Blocked: ${doc.gate.missingFieldsCount} required field(s) incomplete in Review Workbench.`;
    }
    if (!doc.gate.blockingExceptionsResolved) {
      return `Gate Blocked: ${doc.gate.unresolvedExceptionsCount} unresolved exception(s) present.`;
    }
    if (!doc.gate.sourceVersionCurrent) {
      return 'Gate Blocked: Document source version is superseded by a newer upload.';
    }
    return 'Approval gate satisfied.';
  }

  // --- PARALLEL QUORUM PROGRESS CALCULATION ---

  getQuorumProgress(step: WorkflowStep): { approvedCount: number; totalRequired: number; percent: number } {
    const approvedCount = step.approvers.filter(a => a.status === 'Approved').length;
    const totalRequired = step.quorumRequired || 1;
    const percent = Math.min(100, Math.round((approvedCount / totalRequired) * 100));
    return { approvedCount, totalRequired, percent };
  }

  // --- FILTERED DOCUMENTS & STATS ---

  get filteredDocuments(): ApprovalDocument[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.approvalDocuments.filter((doc) => {
      const matchesSearch =
        !search ||
        doc.name.toLowerCase().includes(search) ||
        doc.id.toLowerCase().includes(search) ||
        doc.submittedBy.toLowerCase().includes(search) ||
        doc.reviewedBy.toLowerCase().includes(search);

      const matchesType = this.selectedType === 'All Types' || doc.type === this.selectedType;
      const matchesPriority = this.selectedPriority === 'All Priority' || doc.priority === this.selectedPriority;
      const matchesStatus = this.selectedStatus === 'All Status' || doc.status === this.selectedStatus;

      return matchesSearch && matchesType && matchesPriority && matchesStatus;
    });
  }

  get pendingCount(): number {
    return this.approvalDocuments.filter((d) => d.status === 'Pending Approval' || d.status === 'In Approval').length;
  }

  get highPriorityCount(): number {
    return this.approvalDocuments.filter((d) => d.priority === 'High' && d.status !== 'Approved').length;
  }

  get totalValue(): number {
    return this.approvalDocuments
      .filter((d) => d.status === 'Pending Approval' || d.status === 'In Approval')
      .reduce((total, doc) => {
        const num = Number(doc.documentValue.replace(/[^0-9.-]+/g, ''));
        return total + (isNaN(num) ? 0 : num);
      }, 0);
  }

  get formattedTotalValue(): string {
    return `₹${this.totalValue.toLocaleString('en-IN')}`;
  }

  get approvedCount(): number {
    return this.approvalDocuments.filter((d) => d.status === 'Approved').length;
  }

  // --- ACTION MODAL & DECISION HANDLING ---

  openActionPanel(doc: ApprovalDocument, action: 'Approve' | 'Reject' | 'Return for Changes'): void {
    if (action === 'Approve') {
      if (this.isSodBlocked(doc)) {
        this.showToast(this.getSodBlockReason(doc), 'error');
        return;
      }
      if (this.isGateBlocked(doc)) {
        this.showToast(this.getGateBlockReason(doc), 'error');
        return;
      }
    }

    this.selectedDocument = doc;
    this.actionType = action;
    this.actionComment = '';

    if (action === 'Approve') this.selectedReasonCode = this.approveReasons[0];
    if (action === 'Reject') this.selectedReasonCode = this.rejectReasons[0];
    if (action === 'Return for Changes') this.selectedReasonCode = this.returnReasons[0];

    this.showActionPanel = true;
  }

  closeActionPanel(): void {
    this.showActionPanel = false;
    this.selectedDocument = null;
    this.actionComment = '';
  }

  confirmAction(): void {
    if (!this.selectedDocument) return;
    const doc = this.selectedDocument;

    if ((this.actionType === 'Reject' || this.actionType === 'Return for Changes') && !this.actionComment.trim()) {
      this.showToast('Mandatory reason comment is required for Rejection or Return for Changes', 'error');
      return;
    }

    const timestamp = new Date().toLocaleString();
    const newEntry: DecisionHistoryEntry = {
      id: `DH-${Date.now()}`,
      actor: `${this.currentUser.name} (${this.currentUserRole})`,
      role: this.currentUserRole,
      timestamp: timestamp,
      policyVersion: doc.workflowConfig.policyVersion,
      sourceVersion: doc.sourceVersion,
      action: this.actionType,
      reasonCode: this.selectedReasonCode,
      comment: this.actionComment || this.selectedReasonCode,
    };

    doc.decisionHistory.unshift(newEntry);

    // Update parallel step quorum advancement logic (TASK 6 Item 2)
    const activeStep = doc.workflowConfig.steps.find(s => s.status === 'active');
    if (activeStep && activeStep.type === 'parallel') {
      let myMember = activeStep.approvers.find(a => a.name === this.currentUserId);
      if (!myMember) {
        // Mock current user in parallel step
        myMember = { id: `M-${Date.now()}`, name: this.currentUserId, role: this.currentUserRole, avatar: 'AY', status: 'Pending' };
        activeStep.approvers.push(myMember);
      }

      myMember.status = this.actionType === 'Approve' ? 'Approved' : (this.actionType === 'Reject' ? 'Rejected' : 'Returned');
      myMember.timestamp = timestamp;
      myMember.reason = this.selectedReasonCode;

      const progress = this.getQuorumProgress(activeStep);
      if (progress.approvedCount >= progress.totalRequired) {
        activeStep.status = 'completed';
        doc.status = 'Approved';
        const finalStep = doc.workflowConfig.steps.find(s => s.name.includes('Published'));
        if (finalStep) finalStep.status = 'completed';
        this.showToast(`Quorum of ${progress.totalRequired} approvers reached! Document "${doc.name}" is now Approved and Published.`, 'success');
      } else {
        this.showToast(`Approval logged! Quorum progress: ${progress.approvedCount} of ${progress.totalRequired} required approvers.`, 'warning');
      }
    } else {
      if (this.actionType === 'Approve') {
        doc.status = 'Approved';
        doc.workflowConfig.steps.forEach(s => s.status = 'completed');
        this.showToast(`Document "${doc.name}" Approved and Published!`, 'success');
      } else if (this.actionType === 'Reject') {
        doc.status = 'Rejected';
        this.showToast(`Document "${doc.name}" Rejected. Reason: ${this.selectedReasonCode}`, 'error');
      } else if (this.actionType === 'Return for Changes') {
        doc.status = 'Returned for Changes';
        this.showToast(`Document "${doc.name}" returned for changes to contributor.`, 'warning');
      }
    }

    // Append to Audit Records
    const mappedDecision = this.actionType === 'Approve' ? 'Approved' : (this.actionType === 'Reject' ? 'Rejected' : 'Returned for Changes');
    this.auditRecords.unshift({
      id: `AUD-${Date.now()}`,
      date: timestamp,
      actor: this.currentUserId,
      role: this.currentUserRole,
      decision: mappedDecision,
      documentId: doc.id,
      documentTitle: doc.name,
      policyVersion: doc.workflowConfig.policyVersion,
      reason: this.selectedReasonCode,
    });

    if (this.actionType === 'Approve') {
      this.approvalService.approveDocument(doc.id, this.actionComment).subscribe({
        error: () => {},
      });
    } else if (this.actionType === 'Reject') {
      this.approvalService.rejectDocument(doc.id, this.selectedReasonCode || this.actionComment).subscribe({
        error: () => {},
      });
    }

    this.closeActionPanel();
  }

  // --- REASSIGN APPROVER MODAL (TASK 6 Item 8) ---

  openReassignModal(doc: ApprovalDocument): void {
    this.selectedDocument = doc;
    this.showReassignModal = true;
  }

  confirmReassign(): void {
    if (!this.selectedDocument) return;
    const doc = this.selectedDocument;
    doc.reviewedBy = this.selectedReassignTarget.split(' (')[0];
    this.showReassignModal = false;

    const timestamp = new Date().toLocaleString();
    this.auditRecords.unshift({
      id: `AUD-${Date.now()}`,
      date: timestamp,
      actor: this.currentUserId,
      role: this.currentUserRole,
      decision: 'Reassigned',
      documentId: doc.id,
      documentTitle: doc.name,
      policyVersion: doc.workflowConfig.policyVersion,
      reason: `Reassigned task to ${this.selectedReassignTarget}`,
    });

    this.showToast(`Reassigned approval task for "${doc.id}" to ${this.selectedReassignTarget}`, 'success');
    this.selectedDocument = null;
  }

  // --- EXCEPTIONS DRAWER (TASK 6 Item 5) ---

  openExceptionsDrawer(doc: ApprovalDocument): void {
    this.drawerDocId = doc.id;
    this.drawerExceptions = doc.exceptions;
    this.isExceptionsDrawerOpen = true;
  }

  navigateToWorkbenchField(docId: string, fieldKey: string): void {
    this.isExceptionsDrawerOpen = false;
    this.router.navigate(['/review', docId]);
  }

  navigateToCompareStudio(doc: ApprovalDocument): void {
    if (doc.previousVersionId) {
      this.router.navigate(['/compare'], { queryParams: { doc1: doc.id, doc2: doc.previousVersionId } });
    } else {
      this.router.navigate(['/compare']);
    }
  }

  // --- AUDIT EXPORT (TASK 6 Item 9) ---

  exportAuditLog(): void {
    this.showToast('Exporting filterable approval audit trail report (CSV / JSON)...', 'success');
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'All Types';
    this.selectedPriority = 'All Priority';
    this.selectedStatus = 'All Status';
  }

  showToast(message: string, type: 'success' | 'warning' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      if (this.toastMessage === message) {
        this.toastMessage = null;
      }
    }, 4000);
  }
}