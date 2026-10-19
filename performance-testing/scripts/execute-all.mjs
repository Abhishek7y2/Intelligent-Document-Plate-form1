import path from 'path';
import fs from 'fs';
import { runProfile, Workflows, obtainTokens } from './load-runner.mjs';

const RESULTS_DIR = path.resolve('performance-testing/results');

async function main() {
  console.log('========================================================================');
  console.log('DOCNEXA — COMPLETE PERFORMANCE, LOAD, STRESS & ENDURANCE TEST SUITE');
  console.log('Post-Optimization Benchmark with Real PostgreSQL 16.3 & Index 015');
  console.log('========================================================================\n');

  // Authenticate personas once with 8-hour bearer token reuse
  const cachedTokens = await obtainTokens();

  const allResults = [];

  // 1. Smoke Test (2 VUs)
  const smokeRes = await runProfile({
    name: 'smoke',
    description: '1-2 Virtual Users, validating connectivity, authentication, health checks, and assertions',
    concurrency: 2,
    rampUpSeconds: 1,
    durationSeconds: 10,
    thinkTimeMs: 100,
    cachedTokens,
    workflows: [
      Workflows.healthCheck,
      Workflows.readinessCheck,
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.reviewQueue
    ],
    outputDir: path.join(RESULTS_DIR, 'smoke')
  });
  allResults.push(smokeRes);

  // 2. Baseline Test (5 VUs)
  const baselineRes = await runProfile({
    name: 'baseline',
    description: 'Low concurrency (5 VUs) establishing normal response times, throughput, and error rate',
    concurrency: 5,
    rampUpSeconds: 2,
    durationSeconds: 15,
    thinkTimeMs: 150,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.groundedQA,
      Workflows.reviewQueue,
      Workflows.notifications,
      Workflows.governanceReport
    ],
    outputDir: path.join(RESULTS_DIR, 'baseline')
  });
  allResults.push(baselineRes);

  // 3. Normal Load Test (15 VUs)
  const loadRes = await runProfile({
    name: 'normal-load',
    description: 'Expected normal concurrent load (15 VUs) with realistic think time and full read/write workflow mix',
    concurrency: 15,
    rampUpSeconds: 3,
    durationSeconds: 20,
    thinkTimeMs: 150,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.groundedQA,
      Workflows.documentIntakeAck,
      Workflows.reviewQueue,
      Workflows.notifications
    ],
    outputDir: path.join(RESULTS_DIR, 'load')
  });
  allResults.push(loadRes);

  // 4. Peak Load Test (30 VUs)
  const peakRes = await runProfile({
    name: 'peak-load',
    description: 'Simulated peak workload (30 VUs) measuring queue capacity, p95 latency, and worker throughput',
    concurrency: 30,
    rampUpSeconds: 4,
    durationSeconds: 20,
    thinkTimeMs: 100,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.groundedQA,
      Workflows.documentIntakeAck
    ],
    outputDir: path.join(RESULTS_DIR, 'peak')
  });
  allResults.push(peakRes);

  // 5. Stress Test (50 VUs)
  const stressRes = await runProfile({
    name: 'stress',
    description: 'Above-peak stress workload (50 VUs) determining degradation points and service recovery',
    concurrency: 50,
    rampUpSeconds: 5,
    durationSeconds: 20,
    thinkTimeMs: 50,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.groundedQA,
      Workflows.documentIntakeAck
    ],
    outputDir: path.join(RESULTS_DIR, 'stress')
  });
  allResults.push(stressRes);

  // 6. Spike Test (60 VUs)
  const spikeRes = await runProfile({
    name: 'spike',
    description: 'Sudden spike of 60 VUs with rapid 1s ramp-up to evaluate surge handling and queue draining',
    concurrency: 60,
    rampUpSeconds: 1,
    durationSeconds: 15,
    thinkTimeMs: 50,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio
    ],
    outputDir: path.join(RESULTS_DIR, 'spike')
  });
  allResults.push(spikeRes);

  // 7. Endurance Soak Test (Extended 60s soak test)
  const enduranceRes = await runProfile({
    name: 'endurance',
    description: 'Sustained steady load (10 VUs) over 60 seconds to verify memory stability, connection pool health, and latency drift absence',
    concurrency: 10,
    rampUpSeconds: 2,
    durationSeconds: 60,
    thinkTimeMs: 100,
    cachedTokens,
    workflows: [
      Workflows.searchMetadata,
      Workflows.getDocumentDetail,
      Workflows.compareStudio,
      Workflows.groundedQA,
      Workflows.documentIntakeAck
    ],
    outputDir: path.join(RESULTS_DIR, 'endurance')
  });
  allResults.push(enduranceRes);

  // 8. Document Processing Capacity Test (NFR-03 & NFR-04)
  const capacityRes = await runProfile({
    name: 'document-capacity',
    description: '20-page document batch ingestion and async processing capacity (NFR-03 upload ack < 5s, NFR-04 processing within 5 mins)',
    concurrency: 10,
    rampUpSeconds: 2,
    durationSeconds: 20,
    thinkTimeMs: 100,
    cachedTokens,
    workflows: [
      Workflows.documentIntakeAck,
      Workflows.document20PageCapacity,
      Workflows.searchMetadata
    ],
    outputDir: path.join(RESULTS_DIR, 'capacity')
  });
  allResults.push(capacityRes);

  // Write master consolidated summary
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'all-profiles-summary.json'),
    JSON.stringify(allResults, null, 2)
  );

  console.log('\n========================================================================');
  console.log('ALL 8 POST-OPTIMIZATION PERFORMANCE PROFILES COMPLETED SUCCESSFULLY!');
  console.log(`Master summary written to: ${path.join(RESULTS_DIR, 'all-profiles-summary.json')}`);
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
