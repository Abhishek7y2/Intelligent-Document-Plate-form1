import { Component, OnInit, inject, signal, HostListener, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { NOTIFICATION_SERVICE_TOKEN } from '../../core/services/api-services';
import { NotificationService } from '../../core/services/notification.service';
import {
  NotificationItem,
  NotificationCategory,
  NotificationPreference,
} from '../../core/services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingState, ErrorState, EmptyState],
  providers: [{ provide: NOTIFICATION_SERVICE_TOKEN, useExisting: NotificationService }],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.scss',
})
export class NotificationCenter implements OnInit, AfterViewInit, OnDestroy {
  readonly notificationService = inject(NOTIFICATION_SERVICE_TOKEN);
  private readonly router = inject(Router);

  activeTab: 'all' | NotificationCategory = 'all';
  showPreferences = signal(false);
  pageSize = signal(5);
  currentPage = signal(1);

  private previousActiveElement: HTMLElement | null = null;
  @ViewChild('drawerContainer') drawerContainer?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.notificationService.loadNotifications();
  }

  ngAfterViewInit(): void {
    if (typeof document !== 'undefined') {
      this.previousActiveElement = document.activeElement as HTMLElement;
    }
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: any): void {
    if (this.notificationService.isDrawerOpen()) {
      event.preventDefault();
      this.closeDrawer();
    }
  }

  private restoreFocus(): void {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  get filteredNotifications(): NotificationItem[] {
    const list = this.notificationService.notifications();
    if (this.activeTab === 'all') return list;
    return list.filter((item) => item.category === this.activeTab);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredNotifications.length / this.pageSize()));
  }

  get paginatedNotifications(): NotificationItem[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredNotifications.slice(start, start + this.pageSize());
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages) {
      this.currentPage.update((p) => p + 1);
    }
  }

  setTab(tab: 'all' | NotificationCategory): void {
    this.activeTab = tab;
    this.currentPage.set(1);
  }

  togglePreferences(): void {
    this.showPreferences.set(!this.showPreferences());
  }

  closeDrawer(): void {
    this.notificationService.closeDrawer();
    this.restoreFocus();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  handleItemClick(item: NotificationItem): void {
    this.notificationService.markAsRead(item.id);
    this.closeDrawer();
    this.router.navigateByUrl(item.targetUrl);
  }

  toggleItemRead(event: Event, item: NotificationItem): void {
    event.stopPropagation();
    this.notificationService.toggleRead(item.id);
  }

  toggleEmailPref(pref: NotificationPreference): void {
    this.notificationService.toggleEmailPref(pref.type);
  }

  toggleInAppPref(pref: NotificationPreference): void {
    this.notificationService.toggleInAppPref(pref.type);
  }

  retryLoad(): void {
    this.notificationService.loadNotifications();
  }
}

