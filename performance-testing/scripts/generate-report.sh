#!/bin/bash
# DocNexa JMeter Report Generator
echo "=== Generating Consolidated Performance Dashboard ==="
node -e "
const fs = require('fs');
const summaryPath = 'performance-testing/results/all-profiles-summary.json';
if (fs.existsSync(summaryPath)) {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log('Profiles evaluated:', data.length);
    data.forEach(p => console.log(\`  - \${p.profile}: \${p.totalRequests} reqs, \${p.throughputRps} rps, p95 \${p.overallLatencies.p95}ms, error \${p.errorRate}%\`));
} else {
    console.log('No results found. Run execute-all.mjs first.');
}
"
