# DocNexa JMeter Smoke Test PowerShell Runner
Write-Host "=== Starting DocNexa Smoke Test ===" -ForegroundColor Cyan
if (Get-Command jmeter -ErrorAction SilentlyContinue) {
    jmeter -n -t performance-testing/plans/smoke-test.jmx -l performance-testing/results/smoke/smoke-results.jtl -e -o performance-testing/results/smoke/dashboard
} else {
    Write-Host "Apache JMeter CLI not found in PATH; executing automated load runner for smoke profile..." -ForegroundColor Yellow
    node -e "import('./performance-testing/scripts/load-runner.mjs').then(m => m.runProfile({ name: 'smoke', description: 'Smoke Test', concurrency: 2, rampUpSeconds: 1, durationSeconds: 10, thinkTimeMs: 100, workflows: [m.Workflows.healthCheck, m.Workflows.searchMetadata, m.Workflows.getDocumentDetail], outputDir: 'performance-testing/results/smoke' }))"
}
