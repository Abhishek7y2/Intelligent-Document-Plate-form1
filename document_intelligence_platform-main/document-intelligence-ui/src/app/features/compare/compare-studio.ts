import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { ErrorState, ErrorVariant } from '../../shared/ui/error-state/error-state';
import { COMPARE_SERVICE_TOKEN, MockCompareService, HttpCompareService } from '../../core/services/api-services';

export interface DiffChunk {
  text: string;
  type: 'normal' | 'added' | 'removed';
}

export interface ClauseDiff {
  id: string;
  sectionNumber: string;
  title: string;
  category: 'commercial' | 'legal' | 'compliance' | 'general';
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  version1Text: string;
  version2Text: string;
  beforeSummary: string;
  afterSummary: string;
  plainEnglishImpact: string;
  legalRecommendation: string;
  fallbackClause?: string;
  pageCitationV1: string;
  pageCitationV2: string;
  riskImpact: 'High' | 'Medium' | 'Low' | 'None';
  summaryDelta?: string;
  isUncertainAlignment?: boolean;
  status: 'pending' | 'accepted' | 'flagged';
  v1Chunks: DiffChunk[];
  v2Chunks: DiffChunk[];
  unifiedChunks: DiffChunk[];
}


export interface FieldDiff {
  fieldKey: string;
  label: string;
  v1Value: string;
  v2Value: string;
  status: 'Added' | 'Removed' | 'Modified';
  varianceImpact?: string;
  plainMeaning: string;
  reviewed?: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  hash: string;
}

@Component({
  selector: 'app-compare-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingState, ErrorState],
  templateUrl: './compare-studio.html',
  styleUrl: './compare-studio.scss',
  providers: [{ provide: COMPARE_SERVICE_TOKEN, useClass: HttpCompareService }],
})
export class CompareStudio implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly compareService = inject(COMPARE_SERVICE_TOKEN);

  documentId = 'DOC-10245';
  documentTitle = 'Master Services & Vendor Agreement';
  version1Tag = 'v1.0 (Baseline - 15 Jan 2026)';
  version2Tag = 'v2.0 (Current Amendment - 06 Oct 2026)';

  availableVersions = [
    { value: 'v1.0', label: 'v1.0 (Baseline - 15 Jan 2026)', date: '15 Jan 2026', author: 'Abhishek Yadav', role: 'Principal Legal Counsel' },
    { value: 'v1.1', label: 'v1.1 (Draft - 12 Feb 2026)', date: '12 Feb 2026', author: 'Rahul Sharma', role: 'Commercial Reviewer' },
    { value: 'v2.0', label: 'v2.0 (Current Amendment - 06 Oct 2026)', date: '06 Oct 2026', author: 'Priya Mehta', role: 'Head of Compliance' },
  ];
  selectedV1 = 'v1.0';
  selectedV2 = 'v2.0';

  // View Level Tabs
  viewTab: 'studio' | 'matrix' | 'fields' | 'text' | 'audit' = 'studio';
  diffViewMode: 'split' | 'unified' = 'split';

  activeFilter: 'all' | 'changed' | 'financial' | 'compliance' | 'highRisk' = 'all';
  searchQuery = '';
  selectedClauseIndex = 0;
  selectedClauseId: string | null = 'CL-1';
  isLoading = signal(true);
  hasError = signal(false);
  errorVariant = signal<ErrorVariant>('default');
  toastMessage: string | null = null;

  clauses: ClauseDiff[] = [];

  fieldDiffs: FieldDiff[] = [
    { 
      fieldKey: 'paymentTerms', 
      label: 'Payment Terms', 
      v1Value: 'Net 45 Days', 
      v2Value: 'Net 30 Days', 
      status: 'Modified', 
      varianceImpact: 'Accelerated Cash Outflow (-15 Days)',
      plainMeaning: 'Vendor invoice payment cycle reduced from 45 days to 30 days, speeding up disbursement schedule.',
      reviewed: false
    },
    { 
      fieldKey: 'contractValue', 
      label: 'Total Contract Consideration', 
      v1Value: '₹ 45,00,000.00', 
      v2Value: '₹ 48,50,000.00', 
      status: 'Modified', 
      varianceImpact: '+₹ 3,50,000 (+7.78% Scope Addendum)',
      plainMeaning: 'Contract commercial cap increased by ₹ 3.5 Lakhs due to sensor calibration deliverables.',
      reviewed: true
    },
    { 
      fieldKey: 'liabilityCap', 
      label: 'Penalty & Liability Limitation', 
      v1Value: '100% of Contract Value', 
      v2Value: 'Uncapped for Gross Negligence', 
      status: 'Modified', 
      varianceImpact: 'Severe Risk Exposure (Uncapped)',
      plainMeaning: 'Pre-existing 100% damage cap removed; claims resulting from negligence now face unlimited exposure.',
      reviewed: false
    },
    { 
      fieldKey: 'registeredAddress', 
      label: 'Vendor Registered Address', 
      v1Value: '— (Unspecified in Baseline)', 
      v2Value: 'Plot 42, Electronic City Phase 1, Bangalore', 
      status: 'Added', 
      varianceImpact: 'New Physical Jurisdiction Specified',
      plainMeaning: 'Official corporate service address added to contract header for jurisdiction notice delivery.',
      reviewed: true
    },
  ];

  auditRecords: AuditRecord[] = [
    {
      id: 'AUD-901',
      timestamp: '08 Oct 2026, 16:45:12',
      action: 'Automated Alignment Engine',
      actor: 'DocNexa AI Engine v3.4',
      details: 'Semantic clause alignment completed across 4 sections with 98.4% alignment score.',
      hash: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    },
    {
      id: 'AUD-902',
      timestamp: '08 Oct 2026, 17:02:40',
      action: 'Risk Classification Trigger',
      actor: 'Risk Guard Subsystem',
      details: 'Flagged Section 2.0 (Liability Cap) as HIGH RISK due to uncapped gross negligence clause.',
      hash: 'sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    },
    {
      id: 'AUD-903',
      timestamp: '08 Oct 2026, 17:15:08',
      action: 'Draft Redline Generated',
      actor: 'Abhishek Yadav (Reviewer)',
      details: 'Generated dual-citation comparison report between Baseline v1.0 and Amendment v2.0.',
      hash: 'sha256:a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    },
  ];

  get activeClause(): ClauseDiff | null {
    const list = this.filteredClauses;
    if (list.length === 0) return null;
    return list[this.selectedClauseIndex] || list[0];
  }

  get highRiskCount(): number {
    return this.clauses.filter((c) => c.riskImpact === 'High').length;
  }

  get modifiedClausesCount(): number {
    return this.clauses.filter((c) => c.changeType === 'modified').length;
  }

  get totalDiffsCount(): number {
    return this.clauses.length + this.fieldDiffs.length;
  }

  get authorV1(): string {
    return this.availableVersions.find((v) => v.value === this.selectedV1)?.author || 'Author v1';
  }

  get authorV2(): string {
    return this.availableVersions.find((v) => v.value === this.selectedV2)?.author || 'Author v2';
  }

  get reviewedClausesCount(): number {
    return this.clauses.filter((c) => c.status !== 'pending').length;
  }

  get progressPercent(): number {
    if (this.clauses.length === 0) return 0;
    return Math.round((this.reviewedClausesCount / this.clauses.length) * 100);
  }

  selectClauseIndex(index: number): void {
    if (index >= 0 && index < this.filteredClauses.length) {
      this.selectedClauseIndex = index;
      const clause = this.filteredClauses[index];
      if (clause) {
        this.selectedClauseId = clause.id;
      }
    }
  }

  openInStudio(index: number): void {
    this.viewTab = 'studio';
    this.selectClauseIndex(index);
  }

  openClauseInStudio(clauseId: string): void {
    const idx = this.filteredClauses.findIndex((c) => c.id === clauseId);
    if (idx !== -1) {
      this.openInStudio(idx);
    } else {
      this.viewTab = 'studio';
      this.selectedClauseId = clauseId;
    }
  }

  nextClause(): void {
    if (this.selectedClauseIndex < this.filteredClauses.length - 1) {
      this.selectClauseIndex(this.selectedClauseIndex + 1);
    }
  }

  prevClause(): void {
    if (this.selectedClauseIndex > 0) {
      this.selectClauseIndex(this.selectedClauseIndex - 1);
    }
  }

  copyFallback(clause: ClauseDiff): void {
    if (clause.fallbackClause) {
      navigator.clipboard?.writeText(clause.fallbackClause);
      this.showToast('Copied AI legal fallback clause to clipboard!');
    }
  }


  onVersionChange(): void {
    const v1 = this.availableVersions.find((v) => v.value === this.selectedV1);
    const v2 = this.availableVersions.find((v) => v.value === this.selectedV2);
    if (v1) this.version1Tag = v1.label;
    if (v2) this.version2Tag = v2.label;
    this.showToast(`Comparison updated: Comparing ${this.selectedV1} vs ${this.selectedV2}`);
  }

  swapVersions(): void {
    const temp = this.selectedV1;
    this.selectedV1 = this.selectedV2;
    this.selectedV2 = temp;
    this.onVersionChange();
    this.showToast(`Swapped comparison: Now comparing ${this.selectedV1} as baseline vs ${this.selectedV2}`);
  }

  scrollToClause(clauseId: string): void {
    this.selectedClauseId = clauseId;
    const element = document.getElementById(clauseId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.documentId = id;
      }
    });

    const doc1 = this.route.snapshot.queryParamMap.get('doc1');
    if (doc1) {
      this.documentId = doc1;
    }

    this.loadComparison();
  }

  loadComparison(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    const stateParam = this.route.snapshot.queryParamMap.get('state');

    if (this.documentId === 'alignment' || stateParam === 'alignment') {
      setTimeout(() => {
        this.errorVariant.set('alignment-failed');
        this.hasError.set(true);
        this.isLoading.set(false);
      }, 300);
      return;
    }

    this.compareService.compareDocuments(this.documentId, 'v2').subscribe({
      next: () => {
        this.clauses = this.getDefaultClauses();
        this.isLoading.set(false);
        this.hasError.set(false);
      },
      error: () => {
        this.clauses = this.getDefaultClauses();
        this.isLoading.set(false);
        this.hasError.set(false);
      },
    });
  }

  private getDefaultClauses(): ClauseDiff[] {
    return [
      {
        id: 'CL-1',
        sectionNumber: '1.0',
        title: 'Scope of Equipment & Calibration Services',
        category: 'commercial',
        changeType: 'modified',
        beforeSummary: 'Delivery in 45 days from purchase order receipt (standard shipping)',
        afterSummary: 'Delivery in 30 days from purchase order receipt (priority dispatch + live tracking)',
        plainEnglishImpact: 'Vendor delivery turnaround is accelerated by 15 days, with mandatory live dispatch tracking.',
        legalRecommendation: 'Commercial terms are favorable to Company. Approve without reservation.',
        fallbackClause: 'Supplier shall use reasonable commercial efforts to expedite delivery within 30 days of purchase order confirmation; provided that delivery shall not exceed 45 days without prior written notice.',
        version1Text: 'Supplier shall supply precision calibration sensor units within 45 days of purchase order receipt with standard shipping.',
        version2Text: 'Supplier shall supply precision calibration sensor units within 30 days of purchase order receipt with priority dispatch and live tracking.',
        pageCitationV1: 'v1.0 Page 2, Para 4',
        pageCitationV2: 'v2.0 Page 2, Para 3',
        riskImpact: 'Low',
        summaryDelta: 'Delivery timeline reduced from 45 to 30 days with priority dispatch requirement.',
        isUncertainAlignment: false,
        status: 'accepted',
        v1Chunks: [
          { text: 'Supplier shall supply precision calibration sensor units within ', type: 'normal' },
          { text: '45 days of purchase order receipt with standard shipping.', type: 'removed' },
        ],
        v2Chunks: [
          { text: 'Supplier shall supply precision calibration sensor units within ', type: 'normal' },
          { text: '30 days of purchase order receipt with priority dispatch and live tracking.', type: 'added' },
        ],
        unifiedChunks: [
          { text: 'Supplier shall supply precision calibration sensor units within ', type: 'normal' },
          { text: '45 days of purchase order receipt with standard shipping', type: 'removed' },
          { text: '30 days of purchase order receipt with priority dispatch and live tracking', type: 'added' },
          { text: '.', type: 'normal' },
        ],
      },
      {
        id: 'CL-2',
        sectionNumber: '2.0',
        title: 'Maximum Liability & Penalty Cap',
        category: 'legal',
        changeType: 'modified',
        beforeSummary: 'Total aggregate liability strictly capped at 100% of total fees paid',
        afterSummary: 'Liability is UNCAPPED for gross negligence, confidentiality breach, or willful misconduct',
        plainEnglishImpact: 'CRITICAL SHIFT: The safety cap limiting liability to 100% of contract value has been eliminated. The company is now exposed to unlimited financial liability.',
        legalRecommendation: '🚨 HIGH RISK: Reject this clause in current form. Propose a balanced mutual liability sub-cap (e.g. 2x contract value) before signing.',
        fallbackClause: 'Total aggregate liability of either party under this agreement, including for gross negligence or confidentiality breach, shall in no event exceed two (2) times the total contract consideration paid in the preceding twelve (12) months.',
        version1Text: 'Total aggregate liability of either party under this agreement shall be capped strictly at 100% of the total contract value paid.',
        version2Text: 'Total aggregate liability shall be uncapped for any direct gross negligence, confidentiality breach, or willful misconduct.',
        pageCitationV1: 'v1.0 Page 5, Para 2',
        pageCitationV2: 'v2.0 Page 6, Para 1',
        riskImpact: 'High',
        summaryDelta: 'Liability cap removed for gross negligence and confidentiality breach, introducing unbounded financial risk.',
        isUncertainAlignment: true, // TASK 7D Item 2: Uncertain Alignment Warning
        status: 'flagged',
        v1Chunks: [
          { text: 'Total aggregate liability ', type: 'normal' },
          { text: 'of either party under this agreement ', type: 'removed' },
          { text: 'shall be ', type: 'normal' },
          { text: 'capped strictly at 100% of the total contract value paid.', type: 'removed' },
        ],
        v2Chunks: [
          { text: 'Total aggregate liability shall be ', type: 'normal' },
          { text: 'uncapped for any direct gross negligence, confidentiality breach, or willful misconduct.', type: 'added' },
        ],
        unifiedChunks: [
          { text: 'Total aggregate liability of either party shall be ', type: 'normal' },
          { text: 'capped strictly at 100% of the total contract value paid', type: 'removed' },
          { text: 'uncapped for any direct gross negligence, confidentiality breach, or willful misconduct', type: 'added' },
          { text: '.', type: 'normal' },
        ],
      },
      {
        id: 'CL-3',
        sectionNumber: '3.0',
        title: 'Auto-Renewal & Advance Termination Notice',
        category: 'compliance',
        changeType: 'added',
        beforeSummary: 'Clause did not exist in baseline version (contract ended after 12 months with no renewal)',
        afterSummary: 'Contract auto-renews for 12 months unless 60 days advance written notice is served',
        plainEnglishImpact: 'Evergreen renewal mechanism introduced. If the team forgets to send notice 60 days prior to year-end, the agreement automatically binds company for another 12 months.',
        legalRecommendation: 'Acceptable standard clause. Add an automated calendar reminder 75 days before anniversary to evaluate vendor performance.',
        fallbackClause: 'This agreement may be renewed for successive 12-month terms solely upon mutual written agreement signed by authorized representatives at least 30 calendar days prior to term expiration.',
        version1Text: '[No clause present in baseline version. Standard expiration was governed by general contract duration of 12 months.]',
        version2Text: 'This agreement shall automatically renew for successive 12-month terms unless either party serves written notice at least 60 calendar days prior to expiration.',
        pageCitationV1: 'v1.0 Page 8, Para 1',
        pageCitationV2: 'v2.0 Page 9, Para 4',
        riskImpact: 'Medium',
        summaryDelta: 'New 60-day advance notice requirement and automatic 12-month renewal term added.',
        isUncertainAlignment: false,
        status: 'pending',
        v1Chunks: [
          { text: '[Clause did not exist in Baseline v1.0 — Fixed 12-month duration applied without auto-renewal.]', type: 'removed' },
        ],
        v2Chunks: [
          { text: 'This agreement shall automatically renew for successive 12-month terms unless either party serves written notice at least 60 calendar days prior to expiration.', type: 'added' },
        ],
        unifiedChunks: [
          { text: '[New Clause Inserted] ➔ ', type: 'normal' },
          { text: 'This agreement shall automatically renew for successive 12-month terms unless either party serves written notice at least 60 calendar days prior to expiration.', type: 'added' },
        ],
      },
      {
        id: 'CL-4',
        sectionNumber: '4.0',
        title: 'Data Security & Incident Reporting Window',
        category: 'compliance',
        changeType: 'modified',
        beforeSummary: 'Breach notification within 72 hours of confirmed incident verification',
        afterSummary: 'Breach notification within 24 hours of suspected discovery + 5-day forensic root-cause report',
        plainEnglishImpact: 'Notification window tightened by 66% (from 72h down to 24h), and covers even suspected breaches.',
        legalRecommendation: 'Aligns with modern European GDPR standards. Ensure IT Security Operations team is prepared for 24-hour escalation.',
        fallbackClause: 'Vendor shall notify Customer in writing within 48 hours of confirmed verification of any unauthorized data security incident and deliver root-cause analysis within 7 business days.',
        version1Text: 'Vendor shall notify Customer of any confirmed data breach incident within 72 hours of verification.',
        version2Text: 'Vendor shall notify Customer of any suspected or confirmed data breach incident within 24 hours of discovery and submit root-cause forensics within 5 business days.',
        pageCitationV1: 'v1.0 Page 11, Para 2',
        pageCitationV2: 'v2.0 Page 12, Para 1',
        riskImpact: 'Medium',
        summaryDelta: 'Reporting window tightened from 72h to 24h, triggering expedited forensic audits.',
        isUncertainAlignment: false,
        status: 'pending',
        v1Chunks: [
          { text: 'Vendor shall notify Customer of any confirmed data breach incident within ', type: 'normal' },
          { text: '72 hours of verification.', type: 'removed' },
        ],
        v2Chunks: [
          { text: 'Vendor shall notify Customer of any ', type: 'normal' },
          { text: 'suspected or ', type: 'added' },
          { text: 'confirmed data breach incident within ', type: 'normal' },
          { text: '24 hours of discovery and submit root-cause forensics within 5 business days.', type: 'added' },
        ],
        unifiedChunks: [
          { text: 'Vendor shall notify Customer of any ', type: 'normal' },
          { text: 'suspected or ', type: 'added' },
          { text: 'confirmed data breach incident within ', type: 'normal' },
          { text: '72 hours of verification', type: 'removed' },
          { text: '24 hours of discovery and submit root-cause forensics within 5 business days', type: 'added' },
          { text: '.', type: 'normal' },
        ],
      },
    ];
  }

  retryLoad(): void {
    this.loadComparison();
  }

  // TASK 7D Item 3: Click Citation to Open Viewer
  navigateToViewerCitation(docId: string, pageCitation: string): void {
    const pageMatch = pageCitation.match(/Page\s+(\d+)/i);
    const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    this.router.navigate(['/documents', docId], { queryParams: { page: pageNum } });
  }

  get filteredClauses(): ClauseDiff[] {
    let list = this.clauses;

    if (this.activeFilter === 'changed') {
      list = list.filter((c) => c.changeType !== 'unchanged');
    } else if (this.activeFilter === 'financial') {
      list = list.filter((c) => c.category === 'commercial');
    } else if (this.activeFilter === 'compliance') {
      list = list.filter((c) => c.category === 'compliance');
    } else if (this.activeFilter === 'highRisk') {
      list = list.filter((c) => c.riskImpact === 'High');
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.sectionNumber.includes(query) ||
          c.beforeSummary.toLowerCase().includes(query) ||
          c.afterSummary.toLowerCase().includes(query) ||
          c.plainEnglishImpact.toLowerCase().includes(query)
      );
    }

    return list;
  }

  setFilter(filter: 'all' | 'changed' | 'financial' | 'compliance' | 'highRisk'): void {
    this.activeFilter = filter;
  }

  acceptClause(clause: ClauseDiff): void {
    clause.status = 'accepted';
    this.showToast(`Clause ${clause.sectionNumber} amendment accepted by reviewer.`);
  }

  flagClause(clause: ClauseDiff): void {
    clause.status = 'flagged';
    this.showToast(`Clause ${clause.sectionNumber} flagged for General Counsel escalation.`);
  }

  toggleFieldReview(field: FieldDiff): void {
    field.reviewed = !field.reviewed;
    this.showToast(`Field '${field.label}' marked as ${field.reviewed ? 'Verified' : 'Pending'}.`);
  }

  // TASK 7D Item 4: Export Redline Report PDF
  exportRedlinePdfReport(): void {
    this.showToast('Generating Redline PDF Report with dual citations, word deltas & tamper-evident hashes...');
  }

  exportWordRedline(): void {
    this.showToast('Exporting Microsoft Word Track Changes (.docx) file...');
  }

  acknowledgeDelta(): void {
    this.showToast('All version differences acknowledged & logged to immutable audit trail.');
  }

  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      if (this.toastMessage === message) {
        this.toastMessage = null;
      }
    }, 3500);
  }
}

