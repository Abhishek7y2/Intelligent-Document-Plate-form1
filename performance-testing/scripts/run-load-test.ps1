# DocNexa JMeter Load Test PowerShell Runner
Write-Host "=== Starting DocNexa Load Test ===" -ForegroundColor Cyan
if (Get-Command jmeter -ErrorAction SilentlyContinue) {
    jmeter -n -t performance-testing/plans/api-load-test.jmx -l performance-testing/results/load/load-results.jtl -e -o performance-testing/results/load/dashboard
} else {
    Write-Host "Apache JMeter CLI not found in PATH; executing automated load runner for load profile..." -ForegroundColor Yellow
    node -e "import('./performance-testing/scripts/load-runner.mjs').then(m => m.runProfile({ name: 'normal-load', description: 'Normal Load Test', concurrency: 15, rampUpSeconds: 5, durationSeconds: 30, thinkTimeMs: 150, workflows: [m.Workflows.searchMetadata, m.Workflows.getDocumentDetail, m.Workflows.compareStudio, m.Workflows.groundedQA, m.Workflows.documentIntakeAck], outputDir: 'performance-testing/results/load' }))"
}
