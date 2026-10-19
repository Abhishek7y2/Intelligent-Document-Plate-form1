import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { REVIEW_SERVICE_TOKEN, HttpReviewService, MockReviewService, IReviewTask } from '../../core/services/api-services';

export interface ReviewDocument {
  id: string;
  name: string;
  type: string;
  owner: string;
  submittedAt: string;
  priority: 'High' | 'Medium' | 'Low';
  confidence: number;
  status: string;
  pages: number;
}

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LoadingState, EmptyState, ErrorState],
  templateUrl: './review.html',
  styleUrl: './review.scss',
  providers: [{ provide: REVIEW_SERVICE_TOKEN, useClass: HttpReviewService }],
})
export class Review implements OnInit {
  private readonly reviewService = inject(REVIEW_SERVICE_TOKEN);

  searchTerm = '';
  selectedType = 'All Types';
  selectedPriority = 'All Priority';
  selectedStatus = 'All Status';
  activeTab: 'all' | 'pending' | 'high' | 'low-confidence' | 'approved' = 'all';

  isLoading = signal(true);
  hasError = signal(false);

  selectedDocument: ReviewDocument | null = null;
  showActionPanel = false;
  actionType = '';
  actionComment = '';
  reviewerName = 'Abhishek Yadav';
  reviewerRole = 'Senior Verification Lead';

  reviewDocuments: ReviewDocument[] = [];

  ngOnInit(): void {
    this.loadReviewQueue();
  }

  loadReviewQueue(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.reviewService.getReviewQueue().subscribe({
      next: (queue) => {
        this.reviewDocuments = queue.map((q) => ({
          id: q.id,
          name: q.documentTitle,
          type: q.type || 'Purchase Invoice',
          owner: q.assignee,
          submittedAt: q.submittedAt || 'Today',
          priority: q.priority || 'High',
          confidence: q.confidence || 88,
          status: q.status,
          pages: q.pages || 4,
        }));
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  retryLoad(): void {
    this.loadReviewQueue();
  }

  get filteredDocuments(): ReviewDocument[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.reviewDocuments.filter((document) => {
      const matchesSearch =
        !search ||
        document.name.toLowerCase().includes(search) ||
        document.id.toLowerCase().includes(search) ||
        document.owner.toLowerCase().includes(search);

      const matchesType =
        this.selectedType === 'All Types' ||
        document.type === this.selectedType;

      const matchesPriority =
        this.selectedPriority === 'All Priority' ||
        document.priority === this.selectedPriority;

      const matchesStatus =
        this.selectedStatus === 'All Status' ||
        document.status === this.selectedStatus;

      let matchesTab = true;
      if (this.activeTab === 'pending') {
        matchesTab = document.status === 'Pending Review' || document.status === 'In Review';
      } else if (this.activeTab === 'high') {
        matchesTab = document.priority === 'High';
      } else if (this.activeTab === 'low-confidence') {
        matchesTab = document.confidence < 90;
      } else if (this.activeTab === 'approved') {
        matchesTab = document.status === 'Approved';
      }

      return (
        matchesSearch &&
        matchesType &&
        matchesPriority &&
        matchesStatus &&
        matchesTab
      );
    });
  }

  get totalCount(): number {
    return this.reviewDocuments.length;
  }

  get pendingCount(): number {
    return this.reviewDocuments.filter(
      (document) =>
        document.status === 'Pending Review' || document.status === 'In Review',
    ).length;
  }

  get highPriorityCount(): number {
    return this.reviewDocuments.filter(
      (document) =>
        document.priority === 'High',
    ).length;
  }

  get lowConfidenceCount(): number {
    return this.reviewDocuments.filter(
      (document) =>
        document.confidence < 90,
    ).length;
  }

  get approvedCount(): number {
    return this.reviewDocuments.filter(
      (document) =>
        document.status === 'Approved',
    ).length;
  }

  setTab(tab: 'all' | 'pending' | 'high' | 'low-confidence' | 'approved'): void {
    this.activeTab = tab;
  }

  openActionPanel(
    document: ReviewDocument,
    action: string,
  ): void {
    this.selectedDocument = document;
    this.actionType = action;
    this.actionComment = '';
    this.showActionPanel = true;
  }

  closeActionPanel(): void {
    this.showActionPanel = false;
    this.selectedDocument = null;
    this.actionType = '';
    this.actionComment = '';
  }

  confirmAction(): void {
    if (!this.selectedDocument) {
      return;
    }

    if (
      this.actionType === 'Request Changes' &&
      !this.actionComment.trim()
    ) {
      return;
    }

    const document = this.reviewDocuments.find(
      (item) =>
        item.id === this.selectedDocument?.id,
    );

    if (!document) {
      return;
    }

    if (this.actionType === 'Approve') {
      document.status = 'Approved';
    }

    if (this.actionType === 'Reject' || this.actionType === 'Request Changes') {
      document.status = 'Changes Requested';
    }

    this.closeActionPanel();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = 'All Types';
    this.selectedPriority = 'All Priority';
    this.selectedStatus = 'All Status';
    this.activeTab = 'all';
  }
}
