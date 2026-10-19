import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { SEARCH_SERVICE_TOKEN, MockSearchService, HttpSearchService } from '../../core/services/api-services';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  type: string;
  status: string;
  supplier: string;
  startDate: string;
  endDate: string;
  minAmount: number | null;
  maxAmount: number | null;
  selectedTags: string[];
  isDefault?: boolean;
}

export interface SearchDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  owner: string;
  supplier: string;
  updatedAt: string;
  pages: number;
  size: string;
  amount: number;
  confidence: number;
  pageSpan: string;
  snippet: string;
  isRestricted?: boolean;
  tags: string[];
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingState, EmptyState, ErrorState, StatusBadge],
  templateUrl: './search.html',
  styleUrl: './search.scss',
  providers: [{ provide: SEARCH_SERVICE_TOKEN, useClass: HttpSearchService }],
})
export class Search implements OnInit {
  private readonly searchService = inject(SEARCH_SERVICE_TOKEN);
  private readonly platformId = inject(PLATFORM_ID);

  searchTerm = '';
  selectedType = 'All Types';
  selectedStatus = 'All Status';
  supplierQuery = '';
  startDate = '';
  endDate = '';
  minAmount: number | null = null;
  maxAmount: number | null = null;
  selectedTags: string[] = [];

  availableTags = ['High Priority', 'Verified', 'Audit Alert', 'IGST 18%', 'Penalty Clause', 'Confidential'];

  // Saved Searches Drawer
  isSavedSearchDrawerOpen = false;
  savedSearchName = '';
  savedSearches: SavedSearch[] = [];

  hasSearched = false;
  isLoading = signal(false);
  hasError = signal(false);

  toastMessage: string | null = null;

  documents: SearchDocument[] = [];

  ngOnInit(): void {
    this.loadSavedSearchesFromStorage();
    this.executeSearch('contract');
  }

  loadSavedSearchesFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem('docintel_saved_searches');
      if (stored) {
        this.savedSearches = JSON.parse(stored);
      } else {
        // Default initial saved search
        this.savedSearches = [
          {
            id: 'SAV-1',
            name: 'High-Value Supplier Invoices',
            query: 'invoice',
            type: 'Purchase Invoice',
            status: 'Approved/Published',
            supplier: 'Apex',
            startDate: '',
            endDate: '',
            minAmount: 100000,
            maxAmount: null,
            selectedTags: ['IGST 18%'],
            isDefault: true,
          },
        ];
      }
    } catch {
      // Ignore
    }
  }

  saveSavedSearchesToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem('docintel_saved_searches', JSON.stringify(this.savedSearches));
    } catch {
      // Ignore
    }
  }

  toggleTag(tag: string): void {
    const idx = this.selectedTags.indexOf(tag);
    if (idx >= 0) {
      this.selectedTags.splice(idx, 1);
    } else {
      this.selectedTags.push(tag);
    }
    this.search();
  }

  executeSearch(query = this.searchTerm): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.hasSearched = true;

    this.searchService.semanticSearch(query || 'invoice').subscribe({
      next: (results) => {
        this.documents = [
          {
            id: 'DOC-10247',
            name: 'Purchase Invoice - INV-78421 (Apex Industrial)',
            type: 'Purchase Invoice',
            category: 'Purchase Invoice',
            status: 'Approved/Published',
            owner: 'Abhishek Yadav',
            supplier: 'Apex Industrial Solutions Pvt Ltd',
            updatedAt: '06 Oct 2026',
            pages: 4,
            size: '2.4 MB',
            amount: 145140,
            confidence: 96,
            pageSpan: 'Page 1, Header Box',
            snippet: 'Grand Invoice Total ₹ 1,45,140.00 including 18% IGST tax reconciliation.',
            tags: ['Purchase Invoice', 'IGST 18%', 'Verified'],
          },
          {
            id: 'DOC-10248',
            name: 'Master Equipment Supplier Agreement - Acme Corp',
            type: 'Supplier Contract',
            category: 'Supplier Contract',
            status: 'Review',
            owner: 'Rahul Sharma',
            supplier: 'Acme Corporation Global Pvt Ltd',
            updatedAt: '07 Oct 2026',
            pages: 18,
            size: '5.1 MB',
            amount: 5000000,
            confidence: 94,
            pageSpan: 'Page 3, Clause 2',
            snippet: 'Maximum Liability & Penalty Cap is limited to 100% of Total Contract Value (₹ 50,00,000).',
            tags: ['Supplier Contract', 'Penalty Clause', 'High Priority'],
          },
          {
            id: 'DOC-10249',
            name: 'Executive Board Payroll & Compensation Schedule 2026',
            type: 'Internal Policy',
            category: 'Internal Policy',
            status: 'Approved/Published',
            owner: 'Priya Mehta',
            supplier: 'Internal HR',
            updatedAt: '05 Oct 2026',
            pages: 8,
            size: '1.8 MB',
            amount: 12000000,
            confidence: 91,
            pageSpan: 'Page 5, Annexure B',
            snippet: '[RESTRICTED FIELD - CONFIDENTIAL MASKING APPLIED BY SECURITY POLICY]',
            isRestricted: true,
            tags: ['Confidential', 'Audit Alert'],
          },
        ];
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  retryLoad(): void {
    this.executeSearch();
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.selectedType !== 'All Types') count++;
    if (this.selectedStatus !== 'All Status') count++;
    if (this.supplierQuery.trim()) count++;
    if (this.startDate || this.endDate) count++;
    if (this.minAmount !== null || this.maxAmount !== null) count++;
    count += this.selectedTags.length;
    return count;
  }

  get filteredDocuments(): SearchDocument[] {
    const search = this.searchTerm.trim().toLowerCase();
    const supp = this.supplierQuery.trim().toLowerCase();

    return this.documents.filter((doc) => {
      const matchesSearch =
        !search ||
        doc.name.toLowerCase().includes(search) ||
        doc.id.toLowerCase().includes(search) ||
        doc.snippet.toLowerCase().includes(search) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(search));

      const matchesType = this.selectedType === 'All Types' || doc.type === this.selectedType;
      const matchesStatus = this.selectedStatus === 'All Status' || doc.status === this.selectedStatus;
      const matchesSupplier = !supp || doc.supplier.toLowerCase().includes(supp);

      let matchesAmount = true;
      if (this.minAmount !== null && doc.amount < this.minAmount) matchesAmount = false;
      if (this.maxAmount !== null && doc.amount > this.maxAmount) matchesAmount = false;

      let matchesTags = true;
      if (this.selectedTags.length > 0) {
        matchesTags = this.selectedTags.every((t) => doc.tags.includes(t));
      }

      return matchesSearch && matchesType && matchesStatus && matchesSupplier && matchesAmount && matchesTags;
    });
  }

  search(): void {
    this.executeSearch();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.selectedType = 'All Types';
    this.selectedStatus = 'All Status';
    this.supplierQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.minAmount = null;
    this.maxAmount = null;
    this.selectedTags = [];
    this.hasSearched = false;
    this.executeSearch('all');
  }

  // --- SAVED SEARCHES ACTIONS (TASK 7A Item 1) ---

  openSaveSearchModal(): void {
    if (!this.searchTerm && this.activeFiltersCount === 0) {
      this.showToastNotification('Enter a search query or filter before saving');
      return;
    }
    this.savedSearchName = `Search: ${this.searchTerm || 'Custom Filter'} (${new Date().toLocaleDateString()})`;
    this.isSavedSearchDrawerOpen = true;
  }

  saveCurrentSearch(): void {
    if (!this.savedSearchName.trim()) return;
    const newSaved: SavedSearch = {
      id: `SAV-${Date.now()}`,
      name: this.savedSearchName,
      query: this.searchTerm,
      type: this.selectedType,
      status: this.selectedStatus,
      supplier: this.supplierQuery,
      startDate: this.startDate,
      endDate: this.endDate,
      minAmount: this.minAmount,
      maxAmount: this.maxAmount,
      selectedTags: [...this.selectedTags],
    };
    this.savedSearches.unshift(newSaved);
    this.saveSavedSearchesToStorage();
    this.showToastNotification(`Saved search "${newSaved.name}"!`);
  }

  runSavedSearch(saved: SavedSearch): void {
    this.searchTerm = saved.query;
    this.selectedType = saved.type;
    this.selectedStatus = saved.status;
    this.supplierQuery = saved.supplier;
    this.startDate = saved.startDate;
    this.endDate = saved.endDate;
    this.minAmount = saved.minAmount;
    this.maxAmount = saved.maxAmount;
    this.selectedTags = [...saved.selectedTags];
    this.isSavedSearchDrawerOpen = false;
    this.executeSearch();
    this.showToastNotification(`Executed saved search "${saved.name}"`);
  }

  deleteSavedSearch(id: string): void {
    this.savedSearches = this.savedSearches.filter((s) => s.id !== id);
    this.saveSavedSearchesToStorage();
    this.showToastNotification('Deleted saved search');
  }

  setAsDefaultSearch(saved: SavedSearch): void {
    this.savedSearches.forEach((s) => (s.isDefault = s.id === saved.id));
    this.saveSavedSearchesToStorage();
    this.showToastNotification(`Set "${saved.name}" as default search`);
  }

  showToastNotification(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      if (this.toastMessage === msg) this.toastMessage = null;
    }, 3500);
  }
}