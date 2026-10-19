import { Request, Response, NextFunction } from 'express';
import { dbPool } from '../database/postgres.client.js';

interface MetricHistogram {
  buckets: number[];
  counts: Map<string, number[]>; // labelKey -> bucket counts
  sums: Map<string, number>;
  totals: Map<string, number>;
}

export class MetricsService {
  private static requestDuration: MetricHistogram = {
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    counts: new Map(),
    sums: new Map(),
    totals: new Map(),
  };

  private static dualWriteFailures = 0;

  static recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labelKey = `method="${method}",route="${route}",status="${statusCode}"`;

    const hist = this.requestDuration;
    if (!hist.counts.has(labelKey)) {
      hist.counts.set(labelKey, new Array(hist.buckets.length).fill(0));
      hist.sums.set(labelKey, 0);
      hist.totals.set(labelKey, 0);
    }

    const counts = hist.counts.get(labelKey)!;
    for (let i = 0; i < hist.buckets.length; i++) {
      if (durationSeconds <= hist.buckets[i]) {
        counts[i]++;
      }
    }

    hist.sums.set(labelKey, (hist.sums.get(labelKey) || 0) + durationSeconds);
    hist.totals.set(labelKey, (hist.totals.get(labelKey) || 0) + 1);
  }

  static incrementDualWriteFailure(): void {
    this.dualWriteFailures++;
  }

  static async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];

    // 1. HTTP Request Latency Histogram
    lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');

    for (const [labels, counts] of this.requestDuration.counts.entries()) {
      for (let i = 0; i < this.requestDuration.buckets.length; i++) {
        lines.push(`http_request_duration_seconds_bucket{${labels},le="${this.requestDuration.buckets[i]}"} ${counts[i]}`);
      }
      lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${this.requestDuration.totals.get(labels) || 0}`);
      lines.push(`http_request_duration_seconds_sum{${labels}} ${(this.requestDuration.sums.get(labels) || 0).toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{${labels}} ${this.requestDuration.totals.get(labels) || 0}`);
    }

    // 2. Outbox Lag (Age in seconds of oldest pending event)
    let outboxLagSeconds = 0;
    let pendingOutboxCount = 0;
    try {
      const outboxRes = await dbPool.query(`
        SELECT 
          COUNT(*) as pending_count,
          COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0) as oldest_age_seconds
        FROM outbox_events 
        WHERE status = 'PENDING'
      `);
      if (outboxRes.rows.length > 0) {
        pendingOutboxCount = parseInt(outboxRes.rows[0].pending_count, 10) || 0;
        outboxLagSeconds = Math.round(parseFloat(outboxRes.rows[0].oldest_age_seconds) || 0);
      }
    } catch {
      // In-memory or fallback mode
    }

    lines.push('# HELP docunexa_outbox_lag_seconds Age in seconds of oldest pending transactional outbox event');
    lines.push('# TYPE docunexa_outbox_lag_seconds gauge');
    lines.push(`docunexa_outbox_lag_seconds ${outboxLagSeconds}`);

    lines.push('# HELP docunexa_outbox_pending_events Current count of pending outbox events');
    lines.push('# TYPE docunexa_outbox_pending_events gauge');
    lines.push(`docunexa_outbox_pending_events ${pendingOutboxCount}`);

    // 3. Queue Depth & Failed Jobs
    let queueDepth = 0;
    let failedJobs = 0;
    try {
      const queueRes = await dbPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING')) as depth,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed
        FROM retry_tracking
      `);
      if (queueRes.rows.length > 0) {
        queueDepth = parseInt(queueRes.rows[0].depth, 10) || 0;
        failedJobs = parseInt(queueRes.rows[0].failed, 10) || 0;
      }
    } catch {
      // Fallback
    }

    lines.push('# HELP docunexa_queue_depth Total number of jobs currently pending or active in queue');
    lines.push('# TYPE docunexa_queue_depth gauge');
    lines.push(`docunexa_queue_depth{queue="document-processing"} ${queueDepth}`);

    lines.push('# HELP docunexa_queue_failed_jobs_total Cumulative number of failed background jobs');
    lines.push('# TYPE docunexa_queue_failed_jobs_total counter');
    lines.push(`docunexa_queue_failed_jobs_total{queue="document-processing"} ${failedJobs}`);

    // 4. Dual-Write Failures Counter
    lines.push('# HELP docunexa_derived_store_dual_write_failures_total Total count of derived-store dual write errors');
    lines.push('# TYPE docunexa_derived_store_dual_write_failures_total counter');
    lines.push(`docunexa_derived_store_dual_write_failures_total ${this.dualWriteFailures}`);

    return lines.join('\n') + '\n';
  }
}

/**
 * Middleware tracking HTTP request durations into Prometheus histograms
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    MetricsService.recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
  });

  next();
}
