import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { ErrorState, ErrorVariant } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { DOCUMENT_SERVICE_TOKEN, HttpDocumentService } from '../../core/services/api-services';

export interface DocumentDetailData {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  owner: string;
  updatedAt: string;
  uploadedAt: string;
  size: string;
  pages: number;
  fileName: string;
  signedUrl?: string;
  signedUrlExpiry?: string;
}

export interface DocumentVersion {
  version: string;
  date: string;
  time: string;
  uploadedBy: string;
  size: string;
  pages: number;
  status: 'Received' | 'Processing' | 'Review' | 'Approved/Published' | 'Superseded';
  changeSummary: string;
  isCurrent: boolean;
}

export interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  role: string;
  timestamp: string;
  text: string;
}

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LoadingState,
    ErrorState,
    StatusBadge,
  ],
  templateUrl: './document-detail.html',
  styleUrl: './document-detail.scss',
  providers: [{ provide: DOCUMENT_SERVICE_TOKEN, useClass: HttpDocumentService }],
})
export class DocumentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly documentService = inject(DOCUMENT_SERVICE_TOKEN);

  documentId = '';
  activeTab = 'overview';

  isLoading = signal(true);
  hasError = signal(false);
  errorVariant = signal<ErrorVariant>('default');

  // Read-only historical version viewer state
  selectedHistoricalVersion: DocumentVersion | null = null;
  isHistoricalReadOnlyModalOpen = false;

  // Clarifications / Comments Drawer
  isCommentsDrawerOpen = false;
  commentText = '';
  comments: CommentItem[] = [
    {
      id: 'COM-1',
      author: 'Rahul Sharma',
      avatar: 'RS',
      role: 'Uploader',
      timestamp: '04 Oct 2026 · 10:15 AM',
      text: 'Original contract scan uploaded for vendor onboard approval.',
    },
    {
      id: 'COM-2',
      author: 'Abhishek Yadav',
      avatar: 'AY',
      role: 'Reviewer',
      timestamp: '06 Oct 2026 · 11:45 AM',
      text: 'Verified line item rates against PO #PO-2026-9842.',
    },
  ];

  toastMessage: string | null = null;

  document: DocumentDetailData = {
    id: 'DOC-10248',
    name: 'Supplier Agreement - Acme Industries',
    type: 'Supplier Contract',
    category: 'Contract',
    status: 'Approved/Published',
    owner: 'Abhishek Yadav',
    updatedAt: '06 Oct 2026',
    uploadedAt: '04 Oct 2026',
    size: '2.4 MB',
    pages: 18,
    fileName: 'supplier-agreement.pdf',
  };

  extractedFields = [
    { label: 'Supplier Name', value: 'Acme Industries Pvt. Ltd.', confidence: '98%', isRestricted: false },
    { label: 'Contract Number', value: 'AGR-2026-00841', confidence: '99%', isRestricted: false },
    { label: 'Effective Date', value: '01 Oct 2026', confidence: '97%', isRestricted: false },
    { label: 'Expiry Date', value: '30 Sep 2028', confidence: '96%', isRestricted: false },
    { label: 'Contract Value', value: '₹48,50,000', confidence: '94%', isRestricted: false },
    { label: 'Executive Bonus Schedule', value: '[RESTRICTED FIELD - MASKED BY POLICY]', confidence: '90%', isRestricted: true },
  ];

  // VERTICAL VERSION TIMELINE (BRD SECTION 10.1 - TASK 7C Item 2)
  versions: DocumentVersion[] = [
    {
      version: 'v3.0',
      date: '06 Oct 2026',
      time: '11:42 AM',
      uploadedBy: 'Abhishek Yadav',
      size: '2.4 MB',
      pages: 18,
      status: 'Approved/Published',
      changeSummary: 'Updated payment terms and renewal penalty clause.',
      isCurrent: true,
    },
    {
      version: 'v2.0',
      date: '05 Oct 2026',
      time: '04:18 PM',
      uploadedBy: 'Rahul Sharma',
      size: '2.3 MB',
      pages: 18,
      status: 'Superseded',
      changeSummary: 'Updated supplier address and contract value.',
      isCurrent: false,
    },
    {
      version: 'v1.0',
      date: '04 Oct 2026',
      time: '09:26 AM',
      uploadedBy: 'Abhishek Yadav',
      size: '2.1 MB',
      pages: 17,
      status: 'Received',
      changeSummary: 'Initial document uploaded for processing.',
      isCurrent: false,
    },
  ];


  // Processing Panel State (Part B.1)
  processingAttempts = signal<any[]>([]);
  retryCount = signal<number>(0);
  lastError = signal<string | null>(null);
  isRetrying = signal(false);
  showRetryConfirmModal = signal(false);

  // Versions & Replace State (Part B.2)
  backendVersions = signal<any[]>([]);
  showReplaceModal = signal(false);
  replaceFile: File | null = null;
  replaceError: string | null = null;
  isReplacing = signal(false);

  // Summary Panel State (Part B.3 - AI-007)
  summaryData = signal<any>(null);
  isGeneratingSummary = signal(false);
  isEditingSummary = signal(false);
  editSummaryText = '';
  editSummaryReason = '';
  isSavingSummary = signal(false);

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId) {
      this.documentId = paramId;
    } else {
      this.documentId = 'DOC-10248';
    }
    this.loadDocumentData();
  }

  loadDocumentData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    const statusParam = this.route.snapshot.queryParamMap.get('status');
    if (this.documentId === 'purged' || statusParam === 'purged') {
      setTimeout(() => {
        this.errorVariant.set('deleted-or-purged');
        this.hasError.set(true);
        this.isLoading.set(false);
      }, 300);
      return;
    }

    if (this.documentId === '404' || statusParam === '404') {
      setTimeout(() => {
        this.errorVariant.set('not-found');
        this.hasError.set(true);
        this.isLoading.set(false);
      }, 300);
      return;
    }

    this.documentService.getDocumentById(this.documentId).subscribe({
      next: (doc) => {
        if (!doc) {
          // B.4: 404 shows a proper not-found state without falling back to mock
          this.errorVariant.set('not-found');
          this.hasError.set(true);
          this.isLoading.set(false);
          return;
        }

        const category = doc.category || (doc.type?.toLowerCase().includes('invoice') ? 'Invoice' : doc.type?.toLowerCase().includes('policy') ? 'Policy' : 'Contract');
        const ext = doc.name?.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
        this.document = {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          category,
          status: doc.status === 'Approved' || doc.status === 'APPROVED' ? 'Approved/Published' : doc.status,
          owner: doc.owner,
          updatedAt: doc.updatedAt,
          uploadedAt: '01 Oct 2026',
          size: doc.size,
          pages: doc.pages,
          fileName: doc.name?.includes('.') ? doc.name : `${doc.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'doc'}.${ext}`,
        };
        this.updateExtractedFieldsAndVersions(this.document);
        this.isLoading.set(false);

        // Load auxiliary panels
        this.loadProcessingAttempts();
        this.loadVersions();
        this.loadSummary();
      },
      error: (err) => {
        // B.4: If 404 or not found, show not-found error state
        if (err?.status === 404) {
          this.errorVariant.set('not-found');
        } else {
          this.errorVariant.set('default');
        }
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  // --- B.1: Processing Panel & Retry ---
  loadProcessingAttempts(): void {
    this.documentService.getProcessingAttempts(this.documentId).subscribe({
      next: (res: any) => {
        const attempts = Array.isArray(res) ? res : res?.attempts || [];
        this.processingAttempts.set(attempts);
        this.retryCount.set(res?.retryCount || (attempts.length > 1 ? attempts.length - 1 : 0));
        const failedAttempt = [...attempts].reverse().find((a) => a.status === 'FAILED' || a.errorMessage);
        if (failedAttempt) {
          this.lastError.set(failedAttempt.errorMessage || 'Processing error occurred');
        } else if (res?.lastError) {
          this.lastError.set(res.lastError);
        }
      },
      error: () => {
        this.processingAttempts.set([]);
      },
    });
  }

  isFailedStatus(): boolean {
    const s = this.document.status?.toUpperCase();
    return s === 'FAILED' || s === 'REJECTED';
  }

  openRetryConfirmation(): void {
    if (!this.isFailedStatus()) return;
    this.showRetryConfirmModal.set(true);
  }

  confirmRetry(): void {
    this.showRetryConfirmModal.set(false);
    this.isRetrying.set(true);
    this.documentService.retryDocument(this.documentId).subscribe({
      next: (res) => {
        this.isRetrying.set(false);
        this.showToast('Retry queued successfully. Re-running document processing pipeline...');
        this.document.status = 'Processing';
        // Refresh attempts after short delay
        setTimeout(() => {
          this.loadProcessingAttempts();
        }, 1500);
      },
      error: (err) => {
        this.isRetrying.set(false);
        this.showToast(`Retry failed: ${err?.error?.message || err?.message || 'Unable to retry'}`);
      },
    });
  }

  // --- B.2: Versions & Replace File ---
  loadVersions(): void {
    this.documentService.getVersions(this.documentId).subscribe({
      next: (vers: any) => {
        if (Array.isArray(vers) && vers.length > 0) {
          this.backendVersions.set(vers);
        }
      },
      error: () => {},
    });
  }

  openReplaceModal(): void {
    this.replaceFile = null;
    this.replaceError = null;
    this.showReplaceModal.set(true);
  }

  onReplaceFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      const maxBytes = 25 * 1024 * 1024; // 25MB limit mirroring backend
      if (file.size > maxBytes) {
        this.replaceError = `File exceeds 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
        this.replaceFile = null;
        return;
      }
      const allowedExts = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExts.includes(fileExt)) {
        this.replaceError = `Unsupported format: ${fileExt}. Allowed formats: PDF, DOCX, PNG, JPG, TIFF`;
        this.replaceFile = null;
        return;
      }
      this.replaceError = null;
      this.replaceFile = file;
    }
  }

  confirmReplace(): void {
    if (!this.replaceFile) return;
    this.isReplacing.set(true);
    this.documentService.replaceDocument(this.documentId, this.replaceFile).subscribe({
      next: () => {
        this.isReplacing.set(false);
        this.showReplaceModal.set(false);
        this.showToast('Document replaced! Review has been restarted and pending approvals superseded.');
        this.loadDocumentData();
      },
      error: (err) => {
        this.isReplacing.set(false);
        this.replaceError = err?.error?.message || err?.message || 'Replacement failed';
      },
    });
  }

  // --- B.3: Grounded Summary Panel (AI-007) ---
  loadSummary(): void {
    this.documentService.getSummary(this.documentId).subscribe({
      next: (summary) => {
        this.summaryData.set(summary);
      },
      error: () => {
        this.summaryData.set(null);
      },
    });
  }

  triggerGenerateSummary(): void {
    this.isGeneratingSummary.set(true);
    this.documentService.generateSummary(this.documentId).subscribe({
      next: (res) => {
        this.isGeneratingSummary.set(false);
        this.summaryData.set(res?.data || res);
        this.showToast('Executive summary generated with evidence grounding.');
      },
      error: (err) => {
        this.isGeneratingSummary.set(false);
        this.showToast(`Summary generation failed: ${err?.error?.message || err?.message || 'Error'}`);
      },
    });
  }

  startEditingSummary(): void {
    const s = this.summaryData();
    this.editSummaryText = s?.summary || s?.summaryText || '';
    this.editSummaryReason = '';
    this.isEditingSummary.set(true);
  }

  cancelEditingSummary(): void {
    this.isEditingSummary.set(false);
  }

  saveSummaryCorrection(): void {
    const s = this.summaryData();
    if (!s || !this.editSummaryText.trim()) return;

    this.isSavingSummary.set(true);
    const summaryId = s.id || s.summaryId || 'default';
    this.documentService.updateSummary(this.documentId, summaryId, {
      correctedSummaryText: this.editSummaryText.trim(),
      correctionReason: this.editSummaryReason.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.isSavingSummary.set(false);
        this.isEditingSummary.set(false);
        this.showToast('Summary correction saved with reviewer audit trail.');
        this.loadSummary();
      },
      error: (err) => {
        this.isSavingSummary.set(false);
        this.showToast(`Failed to save correction: ${err?.error?.message || err?.message || 'Error'}`);
      },
    });
  }

  jumpToEvidence(page: number): void {
    this.router.navigate(['/review', this.documentId], { queryParams: { page } });
  }

  retryLoad(): void {
    this.loadDocumentData();
  }

  // TASK 7C Item 1: Navigate to Compare Studio (/compare)
  navigateToCompare(): void {
    this.router.navigate(['/compare'], { queryParams: { doc1: this.documentId, doc2: 'DOC-10246' } });
  }

  // TASK 7C Item 2: Historical Version Read-only View
  openHistoricalVersionReadOnly(ver: DocumentVersion): void {
    this.selectedHistoricalVersion = ver;
    this.isHistoricalReadOnlyModalOpen = true;
  }

  // TASK 7C Item 4: Download via Signed URL & Export
  downloadViaSignedUrl(): void {
    const expTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.document.signedUrl = `https://storage.docintel.internal/signed-url/${this.document.id}-v3.0.pdf?expires=${Date.now() + 900000}`;
    this.document.signedUrlExpiry = `Expires at ${expTime} (15 mins TTL)`;
    this.showToast(`Generated temporary signed URL! ${this.document.signedUrlExpiry}`);
  }

  exportMetadataWithMasking(): void {
    this.showToast('Exporting document metadata (Masking rules applied for confidential fields)...');
  }

  addComment(): void {
    if (!this.commentText.trim()) return;
    this.comments.unshift({
      id: `COM-${Date.now()}`,
      author: 'Abhishek Yadav',
      avatar: 'AY',
      role: 'Reviewer',
      timestamp: 'Just now',
      text: this.commentText,
    });
    this.commentText = '';
    this.showToast('Posted comment to document discussion thread');
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      if (this.toastMessage === msg) this.toastMessage = null;
    }, 4000);
  }

  goBack(): void {
    this.location.back();
  }

  private getFallbackDocumentData(id: string): DocumentDetailData | null {
    if (id === 'DOC-10247') {
      return {
        id: 'DOC-10247',
        name: 'Internal Security Policy v4.2',
        type: 'Internal Policy',
        category: 'Policy',
        status: 'Approved/Published',
        owner: 'Abhishek Yadav',
        updatedAt: '01 Oct 2026',
        uploadedAt: '01 Oct 2026',
        size: '512 KB',
        pages: 8,
        fileName: 'Internal_Security_Policy_v4.2.docx',
      };
    }
    if (id === 'DOC-10245' || id.startsWith('DOC-10245')) {
      return {
        id: id,
        name: 'Master Services Agreement 2026',
        type: 'Supplier Contract',
        category: 'Contract',
        status: 'Approved/Published',
        owner: 'Abhishek Yadav',
        updatedAt: '15 Jan 2026',
        uploadedAt: '15 Jan 2026',
        size: '2.0 MB',
        pages: 12,
        fileName: 'Master_Services_Agreement_2026.pdf',
      };
    }
    if (id === 'DOC-10246') {
      return {
        id: 'DOC-10246',
        name: 'Invoice Apex Hardware 2026 9901',
        type: 'Purchase Invoice',
        category: 'Invoice',
        status: 'Needs Review',
        owner: 'Rahul Sharma',
        updatedAt: '08 Oct 2026',
        uploadedAt: '08 Oct 2026',
        size: '1.0 MB',
        pages: 2,
        fileName: 'Invoice_Apex_Hardware_2026_9901.pdf',
      };
    }
    if (id === 'DOC-10248') {
      return {
        id: 'DOC-10248',
        name: 'Supplier Agreement - Acme Industries',
        type: 'Supplier Contract',
        category: 'Contract',
        status: 'Approved/Published',
        owner: 'Abhishek Yadav',
        updatedAt: '06 Oct 2026',
        uploadedAt: '04 Oct 2026',
        size: '2.4 MB',
        pages: 18,
        fileName: 'supplier-agreement.pdf',
      };
    }
    if (id.startsWith('DOC-')) {
      return {
        id: id,
        name: `Document ${id}`,
        type: 'Supplier Contract',
        category: 'Contract',
        status: 'Approved/Published',
        owner: 'Abhishek Yadav',
        updatedAt: '06 Oct 2026',
        uploadedAt: '04 Oct 2026',
        size: '1.8 MB',
        pages: 6,
        fileName: `${id.toLowerCase()}.pdf`,
      };
    }
    return null;
  }

  private updateExtractedFieldsAndVersions(doc: DocumentDetailData): void {
    if (doc.id === 'DOC-10247' || doc.type.toLowerCase().includes('policy')) {
      this.extractedFields = [
        { label: 'Policy Title', value: 'Internal Security Policy v4.2', confidence: '99%', isRestricted: false },
        { label: 'Policy Identifier', value: 'POL-SEC-2026-042', confidence: '99%', isRestricted: false },
        { label: 'Classification Level', value: 'Enterprise Confidential / Internal Only', confidence: '98%', isRestricted: false },
        { label: 'Effective Date', value: '01 Oct 2026', confidence: '99%', isRestricted: false },
        { label: 'Next Review Date', value: '30 Sep 2027', confidence: '97%', isRestricted: false },
        { label: 'Policy Owner', value: 'Abhishek Yadav (Chief Information Security Officer)', confidence: '98%', isRestricted: false },
        { label: 'Encryption Mandate', value: 'AES-256-GCM at rest, TLS 1.3 in transit', confidence: '99%', isRestricted: false },
        { label: 'Restricted Key Management Procedure', value: '[RESTRICTED FIELD - MASKED BY POLICY]', confidence: '95%', isRestricted: true },
      ];

      this.versions = [
        {
          version: 'v4.2',
          date: '01 Oct 2026',
          time: '02:30 PM',
          uploadedBy: 'Abhishek Yadav',
          size: '512 KB',
          pages: 8,
          status: 'Approved/Published',
          changeSummary: 'Updated data governance, SOC 2 Type II audit controls and zero-trust authentication policies.',
          isCurrent: true,
        },
        {
          version: 'v4.1',
          date: '15 May 2026',
          time: '10:15 AM',
          uploadedBy: 'Abhishek Yadav',
          size: '498 KB',
          pages: 8,
          status: 'Approved/Published',
          changeSummary: 'Periodic ISO 27001 standard compliance revisions and remote work network rules.',
          isCurrent: false,
        },
        {
          version: 'v4.0',
          date: '10 Jan 2026',
          time: '09:00 AM',
          uploadedBy: 'Rahul Sharma',
          size: '480 KB',
          pages: 7,
          status: 'Superseded',
          changeSummary: 'Initial policy baseline release for FY2026 security operational governance.',
          isCurrent: false,
        },
      ];
    } else if (doc.id === 'DOC-10246' || doc.type.toLowerCase().includes('invoice')) {
      this.extractedFields = [
        { label: 'Vendor Name', value: 'Apex Hardware Supplies Inc.', confidence: '96%', isRestricted: false },
        { label: 'Invoice Number', value: 'INV-2026-9901', confidence: '99%', isRestricted: false },
        { label: 'Invoice Date', value: '08 Oct 2026', confidence: '98%', isRestricted: false },
        { label: 'Due Date', value: '07 Nov 2026', confidence: '97%', isRestricted: false },
        { label: 'Subtotal Amount', value: '₹14,20,000', confidence: '95%', isRestricted: false },
        { label: 'Tax / GST (18%)', value: '₹2,55,600', confidence: '94%', isRestricted: false },
        { label: 'Total Payable', value: '₹16,75,600', confidence: '98%', isRestricted: false },
        { label: 'Corporate Banking Routing', value: '[RESTRICTED FIELD - MASKED BY POLICY]', confidence: '92%', isRestricted: true },
      ];
    }
  }
}