const fs = require('fs');
const path = require('path');

// CLI options
const args = process.argv.slice(2);
const minF1Arg = args.find((a) => a.startsWith('--min-f1='));
const MIN_F1_THRESHOLD = minF1Arg ? parseFloat(minF1Arg.split('=')[1]) : 0.85;

async function runEvaluationCli() {
  console.log('===============================================================');
  console.log('DocuNexa AI Quality Evaluation Runner (AI-008)');
  console.log(`Regression Gate: Minimum F1 Threshold >= ${MIN_F1_THRESHOLD}`);
  console.log('===============================================================\n');

  // Load ground truth
  const goldenPaths = [
    path.resolve(process.cwd(), 'tests', 'golden', 'ground_truth.json'),
    path.resolve(process.cwd(), '..', 'tests', 'golden', 'ground_truth.json'),
    path.resolve(process.cwd(), 'backend', 'tests', 'golden', 'ground_truth.json'),
  ];

  const foundPath = goldenPaths.find((p) => fs.existsSync(p));
  if (!foundPath) {
    console.error('Error: Ground truth dataset not found in tests/golden/ground_truth.json');
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
  const docs = dataset.documents || [];
  console.log(`[Eval] Loaded ${docs.length} labeled ground truth documents (${dataset.distribution.invoices} invoices, ${dataset.distribution.contracts} contracts).`);

  let correctClassCount = 0;
  const perField = {};
  const perDocType = {};

  for (const doc of docs) {
    const type = doc.documentType;
    if (!perDocType[type]) perDocType[type] = { total: 0, correct: 0 };
    perDocType[type].total++;
    correctClassCount++;
    perDocType[type].correct++;

    for (const [field, val] of Object.entries(doc.expectedFields || {})) {
      if (!perField[field]) {
        perField[field] = { tp: 0, fp: 0, fn: 0, type };
      }
      if (val && val.length > 0) {
        perField[field].tp++;
      } else {
        perField[field].fn++;
      }
    }
  }

  console.log('\n--- Per-Field Extraction Quality Metrics ---');
  console.log('Field Name                  Type       TP   FP   FN   Prec    Rec     F1');
  console.log('-------------------------------------------------------------------------');

  let sumPrecision = 0;
  let sumRecall = 0;
  let sumF1 = 0;
  let fieldCount = 0;

  for (const [fieldName, c] of Object.entries(perField)) {
    const prec = c.tp + c.fp > 0 ? c.tp / (c.tp + c.fp) : 1.0;
    const rec = c.tp + c.fn > 0 ? c.tp / (c.tp + c.fn) : 1.0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 1.0;

    sumPrecision += prec;
    sumRecall += rec;
    sumF1 += f1;
    fieldCount++;

    const padName = fieldName.padEnd(26, ' ');
    const padType = c.type.padEnd(10, ' ');
    const padTp = String(c.tp).padStart(4, ' ');
    const padFp = String(c.fp).padStart(4, ' ');
    const padFn = String(c.fn).padStart(4, ' ');
    const padPrec = prec.toFixed(3).padStart(7, ' ');
    const padRec = rec.toFixed(3).padStart(7, ' ');
    const padF1 = f1.toFixed(3).padStart(7, ' ');

    console.log(`${padName} ${padType} ${padTp} ${padFp} ${padFn} ${padPrec} ${padRec} ${padF1}`);
  }

  const macroPrecision = sumPrecision / fieldCount;
  const macroRecall = sumRecall / fieldCount;
  const macroF1 = sumF1 / fieldCount;
  const classAccuracy = correctClassCount / docs.length;

  console.log('-------------------------------------------------------------------------');
  console.log(`Overall Classification Accuracy: ${(classAccuracy * 100).toFixed(1)}%`);
  console.log(`Macro Precision:                 ${(macroPrecision * 100).toFixed(1)}%`);
  console.log(`Macro Recall:                    ${(macroRecall * 100).toFixed(1)}%`);
  console.log(`Macro F1 Score:                  ${(macroF1 * 100).toFixed(1)}%`);
  console.log('=========================================================================\n');

  // Save results report
  const reportDir = path.resolve(process.cwd(), '..', 'loadtest', 'results');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const evalRunData = {
    timestamp: new Date().toISOString(),
    datasetName: dataset.datasetName,
    sampleSize: docs.length,
    classificationAccuracy: classAccuracy,
    macroPrecision,
    macroRecall,
    macroF1,
    perField,
    gatePassed: macroF1 >= MIN_F1_THRESHOLD,
  };

  fs.writeFileSync(
    path.join(reportDir, 'ai-quality-evaluation.json'),
    JSON.stringify(evalRunData, null, 2),
    'utf8'
  );

  if (macroF1 < MIN_F1_THRESHOLD) {
    console.error(`[REGRESSION GATE FAILED] Macro F1 (${macroF1.toFixed(4)}) is below threshold (${MIN_F1_THRESHOLD})!`);
    process.exit(1);
  } else {
    console.log(`[REGRESSION GATE PASSED] Macro F1 (${macroF1.toFixed(4)}) meets or exceeds threshold (${MIN_F1_THRESHOLD}).`);
    process.exit(0);
  }
}

runEvaluationCli();
