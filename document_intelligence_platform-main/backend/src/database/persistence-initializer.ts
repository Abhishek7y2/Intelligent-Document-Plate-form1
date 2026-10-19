import { IntakeService } from '../services/intake.service.js';
import { ReviewService } from '../services/review.service.js';
import { ApprovalService } from '../services/approval.service.js';
import { OcrService } from '../services/ocr.service.js';
import { ClassificationService } from '../services/classification.service.js';
import { ExtractionService } from '../services/extraction.service.js';
import { CompareService } from '../services/compare.service.js';
import { SearchService } from '../services/search.service.js';
import { QaService } from '../services/qa.service.js';
import { ReportService } from '../services/report.service.js';
import { OutboxService } from '../services/outbox.service.js';
import { NotificationService } from '../services/notification.service.js';
import { WebhookService } from '../services/webhook.service.js';
import { ExportService } from '../services/export.service.js';
import { ConnectorService } from '../services/connector.service.js';
import { SchemaService } from '../services/schema.service.js';
import { Logger } from '../utils/logger.js';

export const PERSISTENT_DOMAIN_SERVICES = [
  { name: 'IntakeService', service: IntakeService },
  { name: 'ReviewService', service: ReviewService },
  { name: 'ApprovalService', service: ApprovalService },
  { name: 'OcrService', service: OcrService },
  { name: 'ClassificationService', service: ClassificationService },
  { name: 'ExtractionService', service: ExtractionService },
  { name: 'CompareService', service: CompareService },
  { name: 'SearchService', service: SearchService },
  { name: 'QaService', service: QaService },
  { name: 'ReportService', service: ReportService },
  { name: 'OutboxService', service: OutboxService },
  { name: 'NotificationService', service: NotificationService },
  { name: 'WebhookService', service: WebhookService },
  { name: 'ExportService', service: ExportService },
  { name: 'ConnectorService', service: ConnectorService },
] as const;

/**
 * Centrally configures storage mode across all supported domain services.
 * In production/staging, ensures durable SQL persistence; in testing, permits isolated in-memory stores.
 */
export function initializeDatabasePersistence(mode: 'memory' | 'database' = 'database'): void {
  for (const item of PERSISTENT_DOMAIN_SERVICES) {
    if (typeof (item.service as any).setStoreMode === 'function') {
      (item.service as any).setStoreMode(mode);
    }
  }

  if (typeof SchemaService.setStoreModeForTesting === 'function') {
    SchemaService.setStoreModeForTesting(mode);
  }

  Logger.info({
    message: `[PERSISTENCE] Domain services storage mode set to '${mode}'.`,
    context: 'PersistenceInitializer',
    data: { serviceCount: PERSISTENT_DOMAIN_SERVICES.length, mode },
  });
}
