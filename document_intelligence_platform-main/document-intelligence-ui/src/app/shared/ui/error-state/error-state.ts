import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ErrorVariant =
  | 'default'
  | 'permission-denied'
  | 'not-found'
  | 'deleted-or-purged'
  | 'offline'
  | 'processing'
  | 'corrupt-file'
  | 'alignment-failed'
  | 'quota-exceeded';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-state.html',
  styleUrl: './error-state.scss',
})
export class ErrorState {
  @Input() title = '';
  @Input() message = '';
  @Input() variant: ErrorVariant = 'default';
  @Input() showRetry = true;
  @Input() retryLabel = 'Try Again';

  @Output() retry = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();

  get resolvedTitle(): string {
    if (this.title) return this.title;
    switch (this.variant) {
      case 'permission-denied':
        return '403 - Permission Denied';
      case 'not-found':
        return '404 - Document Not Found';
      case 'deleted-or-purged':
        return 'Document Purged';
      case 'offline':
        return 'Network Connection Lost';
      case 'processing':
        return 'OCR Processing in Progress';
      case 'corrupt-file':
        return 'Corrupt or Unreadable File';
      case 'alignment-failed':
        return 'Alignment Failed (Uncertain Spans)';
      case 'quota-exceeded':
        return 'Processing Quota Exceeded';
      default:
        return 'Something went wrong';
    }
  }

  get resolvedMessage(): string {
    if (this.message) return this.message;
    switch (this.variant) {
      case 'permission-denied':
        return 'You do not have authorization to view this document or access this feature. Please contact your organization administrator.';
      case 'not-found':
        return 'The requested document could not be located in the repository or may have been moved.';
      case 'deleted-or-purged':
        return 'This document has been permanently deleted or purged in accordance with the enterprise data retention schedule.';
      case 'offline':
        return 'Network connection interrupted. Please check your internet connectivity and click Try Again.';
      case 'processing':
        return 'Document OCR extraction and layout analysis are currently processing in the pipeline. Please check back shortly.';
      case 'corrupt-file':
        return 'The uploaded document file is damaged or unreadable by the OCR engine. Please upload a clear PDF or TIFF file.';
      case 'alignment-failed':
        return 'Version alignment failed due to low confidence or uncertain layout spans across documents. Manual alignment review required.';
      case 'quota-exceeded':
        return 'Your organization has reached its monthly processing quota for document extractions. Please upgrade plan or contact support.';
      default:
        return 'We could not load this information. Please check your connection and try again.';
    }
  }

  get resolvedIcon(): string {
    switch (this.variant) {
      case 'permission-denied':
        return '🔒';
      case 'not-found':
        return '🔍';
      case 'deleted-or-purged':
        return '🗑️';
      case 'offline':
        return '⚡';
      case 'processing':
        return '⏳';
      case 'corrupt-file':
        return '⚠️';
      case 'alignment-failed':
        return '🔀';
      case 'quota-exceeded':
        return '📊';
      default:
        return '!';
    }
  }

  onRetry(): void {
    this.retry.emit();
  }
}