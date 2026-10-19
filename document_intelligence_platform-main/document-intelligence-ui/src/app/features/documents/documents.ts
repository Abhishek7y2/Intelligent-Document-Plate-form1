import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { DOCUMENT_SERVICE_TOKEN, HttpDocumentService, IDocumentItem } from '../../core/services/api-services';

export type DocumentItem = IDocumentItem;

export type SortField = 'name' | 'updatedAt' | 'size' | 'status';
export type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LoadingState,
    EmptyState,
    ErrorState,
    StatusBadge,
  ],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
  providers: [{ provide: DOCUMENT_SERVICE_TOKEN, useClass: HttpDocumentService }],
})
export class Documents implements OnInit {
  private readonly documentService = inject(DOCUMENT_SERVICE_TOKEN);
  private readonly route = inject(ActivatedRoute);

  searchTerm = '';
  selectedType = 'All Types';
  selectedStatus = 'All Status';
  selectedCategory = 'All Documents';
  viewMode: 'grid' | 'table' = 'grid';

  // Column Sorting (TASK 7E Item 1)
  sortField: SortField = 'updatedAt';
  sortOrder: SortOrder = 'desc';

  // Server-Style Pagination (TASK 7E Item 1)
  currentPage = 1;
  pageSize = 6;

  // Multi-Select Checkboxes & Bulk Actions (TASK 7E Item 1)
  selectedDocIds: string[] = [];

  isLoading = signal(true);
  hasError = signal(false);

  categoryTabs = [
    'All Documents',
    'Supplier Contract',
    'Purchase Invoice',
    'Internal Policy',
    'Compliance Report',
  ];

  documents: DocumentItem[] = [];

  showExportModal = false;
  exportFormat: 'CSV' | 'JSON' | 'PDF' = 'CSV';
  maskPIIData = true;
  exportSuccessToast: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      if (params['status']) {
        this.selectedStatus = params['status'];
      }
      if (params['q']) {
        this.searchTerm = params['q'];
      }
      if (params['filter'] && params['filter'] !== 'all') {
        this.searchTerm = params['filter'];
      }
    });
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.documentService.getDocuments().subscribe({
      next: (data) => {
        this.documents = data;
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  retryLoad(): void {
    this.loadDocuments();
  }

  // Column Sorting Handler
  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortOrder = 'asc';
    }
  }

  get filteredDocuments(): DocumentItem[] {
    const search = this.searchTerm.trim().toLowerCase();

    let result = this.documents.filter((doc) => {
      const matchesSearch =
        !search ||
        doc.name.toLowerCase().includes(search) ||
        doc.id.toLowerCase().includes(search) ||
        doc.owner.toLowerCase().includes(search) ||
        doc.type.toLowerCase().includes(search);

      const matchesType = this.selectedType === 'All Types' || doc.type === this.selectedType;
      const matchesStatus = this.selectedStatus === 'All Status' || doc.status === this.selectedStatus;
      const matchesCategory = this.selectedCategory === 'All Documents' || doc.type === this.selectedCategory;

      return matchesSearch && matchesType && matchesStatus && matchesCategory;
    });

    // Apply Sorting
    result.sort((a, b) => {
      let valA: any = a[this.sortField];
      let valB: any = b[this.sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }

  // Server-Style Paginated Slice
  get paginatedDocuments(): DocumentItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredDocuments.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDocuments.length / this.pageSize));
  }

  get paginatedEndCount(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredDocuments.length);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  // Multi-Select Checkboxes (TASK 7E Item 1)
  toggleSelectDoc(id: string): void {
    const idx = this.selectedDocIds.indexOf(id);
    if (idx >= 0) {
      this.selectedDocIds.splice(idx, 1);
    } else {
      this.selectedDocIds.push(id);
    }
  }

  isDocSelected(id: string): boolean {
    return this.selectedDocIds.includes(id);
  }

  get isAllPageSelected(): boolean {
    return this.paginatedDocuments.length > 0 && this.paginatedDocuments.every(d => this.selectedDocIds.includes(d.id));
  }

  toggleSelectAllPage(): void {
    if (this.isAllPageSelected) {
      this.paginatedDocuments.forEach(d => {
        const idx = this.selectedDocIds.indexOf(d.id);
        if (idx >= 0) this.selectedDocIds.splice(idx, 1);
      });
    } else {
      this.paginatedDocuments.forEach(d => {
        if (!this.selectedDocIds.includes(d.id)) this.selectedDocIds.push(d.id);
      });
    }
  }

  bulkAction(actionName: string): void {
    if (this.selectedDocIds.length === 0) return;
    this.showToastNotification(`Executed ${actionName} on ${this.selectedDocIds.length} selected documents.`);
    this.selectedDocIds = [];
  }

  setCategoryTab(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 1;
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'All Types';
    this.selectedStatus = 'All Status';
    this.selectedCategory = 'All Documents';
    this.currentPage = 1;
    this.selectedDocIds = [];
  }

  openExportModal(): void {
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  executeScopedExport(): void {
    this.showExportModal = false;
    this.showToastNotification(`Generated ${this.exportFormat} export (${this.maskPIIData ? 'PII Masked' : 'Unmasked Raw'}) for ${this.filteredDocuments.length} documents matching active filters.`);
  }

  showToastNotification(msg: string): void {
    this.exportSuccessToast = msg;
    setTimeout(() => {
      if (this.exportSuccessToast === msg) {
        this.exportSuccessToast = null;
      }
    }, 4000);
  }
}