import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { HttpReportService } from './http-report.service';
import { ApiClient } from '../api/api-client';

describe('HttpReportService (DocuNexa Sprint 11 Angular Integration)', () => {
  let service: HttpReportService;
  let apiClientSpy: any;

  beforeEach(() => {
    apiClientSpy = {
      get: (_path: string, _params?: any) => of({}),
      post: (_path: string, _body?: any) => of({}),
    };
    service = new HttpReportService(apiClientSpy as ApiClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch governance metrics from /reports/governance and map to IGovernanceReportData', () => {
    const mockBackendReport = {
      tenantId: 'TNT-TEST',
      executive: {
        totalProcessed: 1250,
        stpRatePercent: 88,
        complianceScorePercent: 99.5,
        volumeTrend: [{ date: 'Day -1', volume: 140, approved: 130, rejected: 2 }],
      },
      ingestion: {
        channels: [{ channel: 'API Connector', count: 500, failureRate: 0.02 }],
      },
      aiSla: {
        slaBuckets: [{ bucket: '< 4h', count: 120, percentage: 80 }],
      },
      governance: {
        recentAuditLogs: [
          { id: 'AUD-1', timestamp: '12 Oct 2026', actor: 'Admin', role: 'Admin', action: 'APPROVE', resource: 'DOC-1', status: 'SUCCESS' },
        ],
      },
      exceptions: {
        totalExceptions: 15,
      },
    };

    apiClientSpy.get = (path: string, params: any) => {
      expect(path).toBe('/reports/governance');
      expect(params.dateRange).toBe('Last 30 Days');
      return of(mockBackendReport);
    };

    let data: any;
    service.getGovernanceReportMetrics('Last 30 Days').subscribe((res) => {
      data = res;
    });

    expect(data).toBeDefined();
    expect(data.telemetryKpis.totalDocuments).toBe(1250);
    expect(data.telemetryKpis.processingSuccessRate).toBe(88);
    expect(data.telemetryKpis.slaComplianceRate).toBe(99.5);
    expect(data.telemetryKpis.openExceptionsCount).toBe(15);
    expect(data.ingestionAnalytics.sources.length).toBe(1);
    expect(data.auditLogEvents.length).toBe(1);
  });

  it('should request asynchronous export via /exports/request', () => {
    apiClientSpy.post = (path: string, body: any) => {
      expect(path).toBe('/exports/request');
      expect(body.reportType).toBe('governance');
      expect(body.format).toBe('csv');
      expect(body.maskPii).toBe(true);
      return of({ id: 'EXP-12345', downloadUrl: '/api/v1/exports/EXP-12345/download?token=DLT-999' });
    };

    let result: any;
    service.requestExport('governance', 'csv').subscribe((res) => {
      result = res;
    });

    expect(result).toBeDefined();
    expect(result.jobId).toBe('EXP-12345');
    expect(result.downloadUrl).toContain('DLT-999');
  });
});
