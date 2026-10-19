import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type EmptyVariant =
  | 'default'
  | 'search'
  | 'queue'
  | 'tasks'
  | 'documents';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  @Input() title = '';
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() variant: EmptyVariant = 'default';

  @Output() action = new EventEmitter<void>();

  get resolvedTitle(): string {
    if (this.title) return this.title;
    switch (this.variant) {
      case 'search':
        return 'No search results found';
      case 'queue':
        return 'Queue is completely empty';
      case 'tasks':
        return 'No tasks assigned';
      case 'documents':
        return 'No documents match filter criteria';
      default:
        return 'Nothing here yet';
    }
  }

  get resolvedMessage(): string {
    if (this.message) return this.message;
    switch (this.variant) {
      case 'search':
        return 'Try adjusting your search query or clear active filters.';
      case 'queue':
        return 'Great job! All pending items in this queue have been processed.';
      case 'tasks':
        return 'You have no open tasks requiring action at this time.';
      case 'documents':
        return 'Try clearing search filters or uploading new documents.';
      default:
        return 'There are no records to display at this time.';
    }
  }

  get resolvedIcon(): string {
    switch (this.variant) {
      case 'search':
        return '🔍';
      case 'queue':
        return '✨';
      case 'tasks':
        return '📋';
      case 'documents':
        return '📁';
      default:
        return '📭';
    }
  }

  onAction(): void {
    this.action.emit();
  }
}