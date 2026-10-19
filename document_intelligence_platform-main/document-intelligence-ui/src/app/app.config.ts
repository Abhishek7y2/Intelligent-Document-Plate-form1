import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { authHttpInterceptor, correlationHttpInterceptor } from './core/api/http-interceptor';
import {
  DOCUMENT_SERVICE_TOKEN,
  EXTRACTION_SERVICE_TOKEN,
  REVIEW_SERVICE_TOKEN,
  APPROVAL_SERVICE_TOKEN,
  SEARCH_SERVICE_TOKEN,
  QA_SERVICE_TOKEN,
  COMPARE_SERVICE_TOKEN,
  REPORT_SERVICE_TOKEN,
  NOTIFICATION_SERVICE_TOKEN,
} from './core/services/api-services';
import { HttpDocumentService } from './core/services/http-document.service';
import { HttpExtractionService } from './core/services/http-extraction.service';
import { HttpReviewService } from './core/services/http-review.service';
import { HttpApprovalService } from './core/services/http-approval.service';
import { HttpSearchService } from './core/services/http-search.service';
import { HttpQaService } from './core/services/http-qa.service';
import { HttpCompareService } from './core/services/http-compare.service';
import { HttpReportService } from './core/services/http-report.service';
import { NotificationService } from './core/services/notification.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([correlationHttpInterceptor, authHttpInterceptor])
    ),
    { provide: DOCUMENT_SERVICE_TOKEN, useClass: HttpDocumentService },
    { provide: EXTRACTION_SERVICE_TOKEN, useClass: HttpExtractionService },
    { provide: REVIEW_SERVICE_TOKEN, useClass: HttpReviewService },
    { provide: APPROVAL_SERVICE_TOKEN, useClass: HttpApprovalService },
    { provide: SEARCH_SERVICE_TOKEN, useClass: HttpSearchService },
    { provide: QA_SERVICE_TOKEN, useClass: HttpQaService },
    { provide: COMPARE_SERVICE_TOKEN, useClass: HttpCompareService },
    { provide: REPORT_SERVICE_TOKEN, useClass: HttpReportService },
    { provide: NOTIFICATION_SERVICE_TOKEN, useExisting: NotificationService },
  ],
};
