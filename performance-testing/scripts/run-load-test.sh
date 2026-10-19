#!/bin/bash
# DocNexa JMeter Load Test Runner
echo "=== Starting DocNexa JMeter Load Test ==="
if command -v jmeter &> /dev/null; then
    jmeter -n -t performance-testing/plans/api-load-test.jmx -l performance-testing/results/load/load-results.jtl -e -o performance-testing/results/load/dashboard
else
    echo "Apache JMeter not found in PATH; executing automated Node.js load runner for load profile..."
    node -e "import('./performance-testing/scripts/load-runner.mjs').then(m => m.runProfile({ name: 'normal-load', description: 'Normal Load Test', concurrency: 15, rampUpSeconds: 5, durationSeconds: 30, thinkTimeMs: 150, workflows: [m.Workflows.searchMetadata, m.Workflows.getDocumentDetail, m.Workflows.compareStudio, m.Workflows.groundedQA, m.Workflows.documentIntakeAck], outputDir: 'performance-testing/results/load' }))"
fi
