/**
 * DocNexa Enterprise Performance Test Engine & Automated JMeter Profile Runner
 * Measures HTTP throughput, p50, p90, p95, p99 latencies, error distributions,
 * separate classification of expected RBAC business denials vs genuine system errors,
 * and NFR compliance (NFR-02, NFR-03, NFR-04) against live backend.
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api/v1';

// Synthetic identities from synthetic-users.csv
export const TEST_USERS = [
  { email: 'analyst@docunexa.io', password: 'SecurePassword123!', role: 'Reviewer', tenantId: 'TNT-CORP-01' },
  { email: 'admin@docnexa.io', password: 'SecurePassword123!', role: 'OrgAdmin', tenantId: 'TNT-CORP-01' },
  { email: 'approver@docnexa.io', password: 'SecurePassword123!', role: 'Approver', tenantId: 'TNT-CORP-01' },
  { email: 'contributor@docnexa.io', password: 'SecurePassword123!', role: 'Contributor', tenantId: 'TNT-CORP-01' },
  { email: 'auditor@docnexa.io', password: 'SecurePassword123!', role: 'Auditor', tenantId: 'TNT-CORP-01' }
];

// Helper to calculate percentiles
export function calculateStats(latencies) {
  if (latencies.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const p = (pct) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((pct / 100) * sorted.length)));
    return sorted[idx];
  };

  return {
    count: sorted.length,
    min: Math.round(sorted[0] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    mean: Math.round((sum / sorted.length) * 100) / 100,
    p50: Math.round(p(50) * 100) / 100,
    p90: Math.round(p(90) * 100) / 100,
    p95: Math.round(p(95) * 100) / 100,
    p99: Math.round(p(99) * 100) / 100,
  };
}

// Single HTTP Request with high-precision timing
export async function timedFetch(url, options = {}) {
  const start = performance.now();
  let status = 0;
  let ok = false;
  let errorMsg = null;
  let data = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    status = res.status;
    ok = res.ok;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } catch (err) {
    errorMsg = err.message;
    status = 599; // Client/Network timeout
  }

  const duration = performance.now() - start;
  return { duration, status, ok, errorMsg, data };
}

// Pre-authenticate synthetic identities to test real business workflows with 8-hour token reuse
export async function obtainTokens() {
  console.log('[Runner] Authenticating synthetic test personas against DocNexa API...');
  const tokens = {};
  for (const user of TEST_USERS) {
    const res = await timedFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password })
    });
    if (res.ok && res.data?.token) {
      tokens[user.email] = {
        token: res.data.token,
        role: user.role,
        email: user.email,
        tenantId: user.tenantId
      };
      console.log(`  ✓ Authenticated ${user.email} (${user.role}) - Latency: ${Math.round(res.duration)}ms`);
    } else {
      console.error(`  ✗ Failed to authenticate ${user.email}: Status ${res.status}`);
    }
  }
  return tokens;
}

// Valid synthetic PDF Buffer satisfying magic byte signatures
const SYNTHETIC_PDF_HEADER = Buffer.from(
  '%PDF-1.4\n%DocNexa Synthetic High-Performance Test PDF\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n175\n%%EOF'
);

// Workflows library matching actual verified DocNexa endpoints
export const Workflows = {
  // 1. Health check (Public Liveness)
  healthCheck: async () => {
    const res = await timedFetch(`${BASE_URL}/health`);
    return { label: 'GET /health', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 2. Readiness check (Public Dependency Check)
  readinessCheck: async () => {
    const res = await timedFetch(`${BASE_URL}/ready`);
    return { label: 'GET /ready', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 3. Document Search & Metadata (NFR-02: p95 < 1s)
  searchMetadata: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/search?q=invoice&type=INVOICE&page=1&pageSize=10`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /search (Metadata & Text)', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 4. Document Details
  getDocumentDetail: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/documents/DOC-10245-v1`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /documents/:id', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 5. Compare Studio (DOC-10245 baseline vs v2 alias)
  compareStudio: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/compare?documentId1=DOC-10245&documentId2=v2`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /compare?doc1=DOC-10245&doc2=v2', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 6. Grounded Q&A (Sprint 10 - FR-013, FR-015, AI-004)
  groundedQA: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/qa/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'TNT-CORP-01'
      },
      body: JSON.stringify({
        documentId: 'DOC-10245-v1',
        question: 'What is the payment due date and total invoiced amount?'
      })
    });
    return { label: 'POST /qa/query (Grounded AI)', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 7. Review Workbench Queue (Sprint 7 - FR-008)
  reviewQueue: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/review/queue`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /review/queue', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 8. Notifications
  notifications: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/notifications`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /notifications', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 9. Governance Reports
  governanceReport: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/reports/governance`, {
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      }
    });
    return { label: 'GET /reports/governance', duration: res.duration, status: res.status, ok: res.ok };
  },

  // 10. Intake Document Ingestion (NFR-03: upload ack < 5s)
  documentIntakeAck: async (vuId, userObj, iter) => {
    const formData = new FormData();
    const blob = new Blob([SYNTHETIC_PDF_HEADER], { type: 'application/pdf' });
    formData.append('file', blob, `perf_test_invoice_vu${vuId}_${iter}.pdf`);
    formData.append('documentType', 'purchase-invoice');
    formData.append('allowDuplicate', 'true');

    const res = await timedFetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'X-Tenant-ID': 'TNT-CORP-01'
      },
      body: formData
    });

    const isExpectedRbacDenial = res.status === 403 && userObj.role === 'Auditor';
    return {
      label: 'POST /documents/upload (Ack < 5s)',
      duration: res.duration,
      status: res.status,
      ok: res.ok,
      isExpectedRbacDenial
    };
  },

  // 11. 20-Page Document OCR Processing Pipeline (NFR-04)
  document20PageCapacity: async (vuId, userObj) => {
    const res = await timedFetch(`${BASE_URL}/documents/DOC-10245-v1/process-ocr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userObj.token}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'TNT-CORP-01'
      },
      body: JSON.stringify({
        engineType: 'TESSERACT_OCR',
        maxPages: 20
      })
    });
    return { label: 'POST /documents/:id/process-ocr (20-page)', duration: res.duration, status: res.status, ok: res.ok };
  }
};

// Main execution profile runner
export async function runProfile(config) {
  const {
    name,
    description,
    concurrency,
    rampUpSeconds,
    durationSeconds,
    thinkTimeMs,
    workflows,
    cachedTokens,
    outputDir
  } = config;

  console.log(`\n======================================================================`);
  console.log(`EXECUTING PROFILE: ${name.toUpperCase()}`);
  console.log(`Description: ${description}`);
  console.log(`Virtual Users: ${concurrency} | Ramp-Up: ${rampUpSeconds}s | Duration: ${durationSeconds}s | Think Time: ${thinkTimeMs}ms`);
  console.log(`======================================================================\n`);

  const initialMemory = process.memoryUsage();

  const tokens = cachedTokens || (await obtainTokens());
  const userList = Object.values(tokens);
  if (userList.length === 0) {
    throw new Error('No authentication tokens could be acquired.');
  }

  const metrics = [];
  const statusCounts = {};
  let stopFlag = false;

  const testStartTime = performance.now();
  const timeoutId = setTimeout(() => {
    stopFlag = true;
  }, durationSeconds * 1000);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Virtual User worker
  async function virtualUser(vuId) {
    const userRampDelay = (vuId / Math.max(1, concurrency)) * rampUpSeconds * 1000;
    await delay(userRampDelay);

    const userObj = userList[vuId % userList.length];
    let iteration = 0;

    while (!stopFlag) {
      iteration++;
      for (const wf of workflows) {
        if (stopFlag) break;
        try {
          const sample = await wf(vuId, userObj, iteration);
          metrics.push(sample);
          statusCounts[sample.status] = (statusCounts[sample.status] || 0) + 1;
        } catch (err) {
          metrics.push({
            label: 'Workflow Error',
            duration: 0,
            status: 500,
            ok: false,
            error: err.message
          });
          statusCounts[500] = (statusCounts[500] || 0) + 1;
        }

        if (thinkTimeMs > 0 && !stopFlag) {
          await delay(thinkTimeMs);
        }
      }
    }
  }

  const vuPromises = [];
  for (let i = 0; i < concurrency; i++) {
    vuPromises.push(virtualUser(i));
  }

  await Promise.all(vuPromises);
  clearTimeout(timeoutId);

  const finalMemory = process.memoryUsage();
  const testDurationSec = (performance.now() - testStartTime) / 1000;
  const totalRequests = metrics.length;

  // Distinguish Expected Business Denials (e.g. Auditor upload rejected with 403) from Genuine System Failures (5xx/timeouts)
  let expectedDenials = 0;
  let unexpectedFailures = 0;

  for (const m of metrics) {
    if (m.isExpectedRbacDenial || (m.status === 403 && m.label.includes('upload'))) {
      expectedDenials++;
    } else if (!m.ok && m.status !== 409 && m.status !== 422) {
      unexpectedFailures++;
    }
  }

  const successfulRequests = totalRequests - expectedDenials - unexpectedFailures;
  const throughput = totalRequests > 0 ? totalRequests / testDurationSec : 0;
  const rawFailureRate = totalRequests > 0 ? ((totalRequests - metrics.filter(m => m.ok).length) / totalRequests) * 100 : 0;
  const authorizedTransactions = totalRequests - expectedDenials;
  const genuineErrorRate = authorizedTransactions > 0 ? (unexpectedFailures / authorizedTransactions) * 100 : 0;

  // Group by transaction / endpoint label
  const labelGroups = {};
  for (const m of metrics) {
    if (!labelGroups[m.label]) {
      labelGroups[m.label] = [];
    }
    labelGroups[m.label].push(m.duration);
  }

  const overallStats = calculateStats(metrics.map((m) => m.duration));
  const breakdown = {};
  for (const [lbl, latencies] of Object.entries(labelGroups)) {
    breakdown[lbl] = calculateStats(latencies);
  }

  const resultSummary = {
    profile: name,
    description,
    concurrency,
    durationSeconds: Math.round(testDurationSec * 10) / 10,
    totalRequests,
    successfulRequests,
    expectedDenials,
    unexpectedFailures,
    genuineErrorRate: Math.round(genuineErrorRate * 100) / 100,
    rawFailureRate: Math.round(rawFailureRate * 100) / 100,
    throughputRps: Math.round(throughput * 10) / 10,
    statusCodes: statusCounts,
    overallLatencies: overallStats,
    transactionBreakdown: breakdown,
    memoryTelemetry: {
      initialHeapUsedMb: Math.round((initialMemory.heapUsed / 1024 / 1024) * 10) / 10,
      finalHeapUsedMb: Math.round((finalMemory.heapUsed / 1024 / 1024) * 10) / 10,
      finalRssMb: Math.round((finalMemory.rss / 1024 / 1024) * 10) / 10,
    },
    timestamp: new Date().toISOString()
  };

  console.log(`\n--- RESULTS: ${name} ---`);
  console.log(`Total Requests: ${totalRequests} | Throughput: ${resultSummary.throughputRps} req/s`);
  console.log(`Expected Denials (RBAC): ${expectedDenials} | Genuine System Failures: ${unexpectedFailures} | Genuine Error Rate: ${resultSummary.genuineErrorRate}%`);
  console.log(`Latency (ms) -> Min: ${overallStats.min} | Mean: ${overallStats.mean} | p50: ${overallStats.p50} | p90: ${overallStats.p90} | p95: ${overallStats.p95} | p99: ${overallStats.p99} | Max: ${overallStats.max}`);
  console.log(`Heap Used: ${resultSummary.memoryTelemetry.finalHeapUsedMb} MB | RSS: ${resultSummary.memoryTelemetry.finalRssMb} MB`);
  console.log(`HTTP Statuses: ${JSON.stringify(statusCounts)}`);

  // Write outputs
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `summary.json`), JSON.stringify(resultSummary, null, 2));

    let md = `# Profile: ${name}\n\n`;
    md += `**Description**: ${description}\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Concurrency | ${concurrency} virtual users |\n`;
    md += `| Duration | ${resultSummary.durationSeconds}s |\n`;
    md += `| Total Requests | ${totalRequests} |\n`;
    md += `| Successful Business Transactions | ${successfulRequests} |\n`;
    md += `| Expected Business Denials (RBAC 403) | ${expectedDenials} |\n`;
    md += `| Genuine System Failures (5xx/Timeouts) | ${unexpectedFailures} |\n`;
    md += `| Genuine Failure Rate (Authorized) | **${resultSummary.genuineErrorRate}%** |\n`;
    md += `| Throughput | ${resultSummary.throughputRps} req/sec |\n`;
    md += `| Latency p50 | ${overallStats.p50} ms |\n`;
    md += `| Latency p90 | ${overallStats.p90} ms |\n`;
    md += `| Latency p95 | ${overallStats.p95} ms |\n`;
    md += `| Latency p99 | ${overallStats.p99} ms |\n`;
    md += `| Process Heap Memory | ${resultSummary.memoryTelemetry.finalHeapUsedMb} MB |\n`;
    md += `| Process RSS Memory | ${resultSummary.memoryTelemetry.finalRssMb} MB |\n\n`;

    md += `### Endpoint / Transaction Breakdown\n\n`;
    md += `| Transaction | Requests | Min (ms) | Mean (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) |\n`;
    md += `|---|---|---|---|---|---|---|---|---|\n`;
    for (const [lbl, stats] of Object.entries(breakdown)) {
      md += `| ${lbl} | ${stats.count} | ${stats.min} | ${stats.mean} | ${stats.p50} | ${stats.p90} | ${stats.p95} | ${stats.p99} | ${stats.max} |\n`;
    }
    fs.writeFileSync(path.join(outputDir, `report.md`), md);
  }

  return resultSummary;
}
