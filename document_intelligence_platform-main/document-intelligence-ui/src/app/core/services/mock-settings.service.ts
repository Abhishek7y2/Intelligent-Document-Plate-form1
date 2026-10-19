import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { delay, mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class MockSettingsService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly latencyMinMs = signal(300);
  readonly latencyMaxMs = signal(700);
  readonly failNext = signal(false);
  readonly failureRate = signal(0); // 0 to 100%

  get isDevMode(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return true; // Active in development mode
  }

  setLatency(min: number, max: number): void {
    this.latencyMinMs.set(min);
    this.latencyMaxMs.set(max);
  }

  toggleFailNext(): void {
    this.failNext.set(!this.failNext());
  }

  setFailureRate(rate: number): void {
    this.failureRate.set(rate);
  }

  simulateDelay<T>(data: T): Observable<T> {
    const min = this.latencyMinMs();
    const max = this.latencyMaxMs();
    const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;

    const shouldFail =
      this.failNext() ||
      (this.failureRate() > 0 && Math.random() * 100 < this.failureRate());

    if (this.failNext()) {
      this.failNext.set(false); // consume failNext one-shot
    }

    if (shouldFail) {
      return of(null).pipe(
        delay(delayTime),
        mergeMap(() =>
          throwError(
            () => new Error('Simulated API Failure triggered by MockSettings')
          )
        )
      );
    }

    return of(data).pipe(delay(delayTime));
  }
}
