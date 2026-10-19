#!/bin/bash
# DocNexa JMeter Smoke Test Runner
echo "=== Starting DocNexa JMeter Smoke Test ==="
if command -v jmeter &> /dev/null; then
    jmeter -n -t performance-testing/plans/smoke-test.jmx -l performance-testing/results/smoke/smoke-results.jtl -e -o performance-testing/results/smoke/dashboard
else
    echo "Apache JMeter not found in PATH; executing automated Node.js load runner for smoke profile..."
    node -e "import('./performance-testing/scripts/load-runner.mjs').then(m => m.runProfile({ name: 'smoke', description: 'Smoke Test', concurrency: 2, rampUpSeconds: 1, durationSeconds: 10, thinkTimeMs: 100, workflows: [m.Workflows.healthCheck, m.Workflows.searchMetadata, m.Workflows.getDocumentDetail], outputDir: 'performance-testing/results/smoke' }))"
fi
