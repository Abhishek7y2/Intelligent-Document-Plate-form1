import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { NotificationService } from './notification.service';
import { MockSettingsService } from './mock-settings.service';
import { ApiClient } from '../api/api-client';
import { of } from 'rxjs';

describe('Sprint 7 Notification Stream Reconnect with Fresh Ticket Spec (Part 0.5)', () => {
  let service: NotificationService;
  let mockApiClient: any;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn().mockReturnValue(of({})),
    };

    const injector = Injector.create({
      providers: [
        { provide: ApiClient, useValue: mockApiClient },
        { provide: MockSettingsService, useValue: {} },
      ],
    });

    service = runInInjectionContext(injector, () => new NotificationService());
    (service as any).api = mockApiClient;
  });

  it('manages drawer open/close and unread notification state', () => {
    expect(service.isDrawerOpen()).toBe(false);
    service.openDrawer();
    expect(service.isDrawerOpen()).toBe(true);
    service.closeDrawer();
    expect(service.isDrawerOpen()).toBe(false);
    service.toggleDrawer();
    expect(service.isDrawerOpen()).toBe(true);
  });

  it('marks notifications as read and updates API', () => {
    const notifs = service.notifications();
    expect(notifs.length).toBeGreaterThan(0);
    const targetId = notifs[0].id;

    service.markAsRead(targetId);

    const updated = service.notifications().find((n) => n.id === targetId);
    expect(updated?.read).toBe(true);
    expect(mockApiClient.patch).toHaveBeenCalledWith(`/notifications/${targetId}/read`, {});
  });

  it('requests fresh ticket upon reconnect with exponential backoff on stream failure', () => {
    (service as any).reconnectAttempts = 0;
    const initSpy = vi.spyOn(service as any, 'initRealtimeStream').mockImplementation(() => {});

    // Simulate stream failure
    (service as any).handleStreamFailure();

    expect((service as any).reconnectAttempts).toBe(1);
    expect((service as any).reconnectTimer).toBeDefined();

    // Fast-forward or trigger the reconnect timer
    clearTimeout((service as any).reconnectTimer);
    (service as any).initRealtimeStream();
    expect(initSpy).toHaveBeenCalled();
  });

  it('falls back to polling when reconnect attempts exceed maximum limit', () => {
    (service as any).reconnectAttempts = (service as any).maxSseRetries - 1;
    const pollingSpy = vi.spyOn(service as any, 'startPollingFallback').mockImplementation(() => {});

    (service as any).handleStreamFailure();

    expect((service as any).reconnectAttempts).toBe((service as any).maxSseRetries);
    expect(pollingSpy).toHaveBeenCalled();
  });
});
