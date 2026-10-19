import { Injectable, signal, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  /** Responsive breakpoint (matches IndiHire: >= 1024px is desktop side panel) */
  readonly BREAKPOINT = 1024;

  /**
   * Whether the slidebar panel is currently visible/expanded.
   * Default is initialized based on window width (true on desktop, false on mobile).
   */
  readonly sidebarOpen = signal<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  /**
   * Whether the slidebar is pinned/docked to the side.
   * Default is true on desktop (>= 1024px), false on mobile/tablet.
   */
  readonly sidebarPinned = signal<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  /**
   * Reactive signal indicating whether viewport is currently desktop width (>= 1024px).
   */
  readonly isDesktopView = signal<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  private closeTimer?: any;
  private resizeListener?: () => void;
  private lastWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

  constructor(private ngZone: NgZone) {
    if (typeof window !== 'undefined') {
      const isWide = window.innerWidth >= this.BREAKPOINT;
      this.isDesktopView.set(isWide);
      this.lastWidth = window.innerWidth;

      if (isWide) {
        // Desktop by default: docked to the side
        this.sidebarPinned.set(true);
        this.sidebarOpen.set(true);
      } else {
        // Compact/mobile: collapsed by default
        this.sidebarPinned.set(false);
        this.sidebarOpen.set(false);
      }

      this.initResizeListener();
    }
  }

  private initResizeListener(): void {
    this.ngZone.runOutsideAngular(() => {
      let rafId: number | null = null;
      this.resizeListener = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          this.handleWindowResize();
        });
      };
      window.addEventListener('resize', this.resizeListener, { passive: true });
    });
  }

  private handleWindowResize(): void {
    if (typeof window === 'undefined') return;
    const currentWidth = window.innerWidth;
    const wasDesktop = this.lastWidth >= this.BREAKPOINT;
    const isDesktopNow = currentWidth >= this.BREAKPOINT;
    this.lastWidth = currentWidth;

    if (wasDesktop !== isDesktopNow) {
      this.ngZone.run(() => {
        this.isDesktopView.set(isDesktopNow);
        if (isDesktopNow) {
          // Window enlarged to desktop: auto-dock to side (IndiHire behavior)
          this.sidebarPinned.set(true);
          this.sidebarOpen.set(true);
        } else {
          // Window shrunk to mobile/tablet: auto-collapse into slide drawer
          this.sidebarPinned.set(false);
          this.sidebarOpen.set(false);
        }
      });
    } else {
      if (this.isDesktopView() !== isDesktopNow) {
        this.ngZone.run(() => {
          this.isDesktopView.set(isDesktopNow);
        });
      }
    }
  }

  /**
   * Helper to check if current viewport is mobile/tablet (< 1024px).
   */
  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < this.BREAKPOINT;
  }

  /**
   * Helper to check if current viewport is desktop (>= 1024px).
   */
  isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= this.BREAKPOINT;
  }

  /**
   * Immediately opens the slidebar panel (on logo hover, touch, or click).
   */
  openSidebar(): void {
    this.cancelScheduledClose();
    this.sidebarOpen.set(true);
  }

  /**
   * Closes the slidebar panel unless pinned on desktop. Always closes on mobile.
   */
  closeSidebar(force = false): void {
    this.cancelScheduledClose();
    if (force || this.isMobile() || !this.sidebarPinned()) {
      this.sidebarOpen.set(false);
    }
  }

  /**
   * Smoothly closes the slidebar panel after a short delay when mouse leaves,
   * allowing comfortable navigation without abrupt closing.
   */
  scheduleCloseSidebar(delayMs = 280): void {
    if (this.sidebarPinned() && !this.isMobile()) return;
    this.cancelScheduledClose();
    this.closeTimer = setTimeout(() => {
      if (!this.sidebarPinned() || this.isMobile()) {
        this.sidebarOpen.set(false);
      }
    }, delayMs);
  }

  /**
   * Cancels any pending close timer and keeps the slidebar open.
   */
  cancelScheduledClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
  }

  /**
   * Toggles the slidebar panel (on click).
   */
  toggleSidebar(): void {
    this.cancelScheduledClose();
    if (this.isDesktop()) {
      const nextPin = !this.sidebarPinned();
      this.sidebarPinned.set(nextPin);
      this.sidebarOpen.set(nextPin);
    } else {
      this.sidebarPinned.set(false);
      this.sidebarOpen.set(!this.sidebarOpen());
    }
  }

  /**
   * Toggles pinned mode. On mobile, pinning is ignored to prevent squashing mobile layouts.
   */
  togglePin(): void {
    if (this.isMobile()) {
      this.sidebarPinned.set(false);
      this.sidebarOpen.set(false);
      return;
    }
    this.cancelScheduledClose();
    const nextPin = !this.sidebarPinned();
    this.sidebarPinned.set(nextPin);
    this.sidebarOpen.set(nextPin);
  }
}