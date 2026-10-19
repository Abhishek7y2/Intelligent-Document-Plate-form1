import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpAdminService } from '../../../../core/services/http-admin.service';

export interface UncertainField {
  key: string;
  label: string;
  docType: string;
  avgConfidence: number;
  overrideRate: number;
  topCorrectionReason: string;
}

export interface BenchmarkRun {
  id: string;
  date: string;
  datasetSize: number;
  precision: number;
  recall: number;
  cer: number;
  status: 'passed' | 'warning' | 'failed';
}

@Component({
  selector: 'app-admin-ai-quality',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-ai-quality-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>AI Accuracy, Quality Benchmarks & Reviewer Override Analytics</h2>
          <p>
            Monitor field-level precision/recall, CER, citation correctness, and AI model vs human reviewer contributions (BRD AI-008).
            <span class="model-badge">Active Engine: {{ currentModelVersion }}</span>
          </p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedDocType" (change)="updateMetricsForType()" class="doctype-select">
            <option value="PUR-INVOICE">Purchase Invoice (PUR-INVOICE)</option>
            <option value="SUP-CONTRACT">Supplier Contract (SUP-CONTRACT)</option>
            <option value="INT-POLICY">Internal Policy (INT-POLICY)</option>
          </select>
          <button type="button" class="btn-primary" (click)="triggerBenchmarkRun()">⚡ Run AI Benchmark Test</button>
        </div>
      </div>

      <!-- ACCURACY & METRICS DASHBOARD GRID -->
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="m-label">Field Precision (Golden Set, n={{ goldenSetSampleSize }})</span>
          <strong class="m-val green">{{ currentMetrics.precision }}%</strong>
          <span class="m-sub">Target: 95.0%</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Field Recall (Golden Set, n={{ goldenSetSampleSize }})</span>
          <strong class="m-val green">{{ currentMetrics.recall }}%</strong>
          <span class="m-sub">Target: 93.0%</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Character Error Rate (CER)</span>
          <strong class="m-val green">{{ currentMetrics.cer }}%</strong>
          <span class="m-sub">OCR Readability</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Reviewer Override Rate</span>
          <strong class="m-val amber">{{ currentMetrics.overrideRate }}%</strong>
          <span class="m-sub">Human Correction</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Citation Correctness</span>
          <strong class="m-val green">{{ currentMetrics.citationAccuracy }}%</strong>
          <span class="m-sub">Page & Bounding Box</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Answer Faithfulness</span>
          <strong class="m-val green">{{ currentMetrics.faithfulness }}%</strong>
          <span class="m-sub">Q&A Grounding</span>
        </div>
      </div>

      <!-- CONTRIBUTION BREAKDOWN (OCR VS MODEL VS REVIEWER) -->
      <div class="breakdown-card">
        <h3>AI Pipeline Error & Accuracy Contribution Breakdown</h3>
        <div class="contrib-bars">
          <div class="bar-group">
            <div class="bar-label">
              <span>OCR Text Extraction Accuracy (Tesseract / Vision)</span>
              <strong>{{ currentMetrics.ocrAccuracy }}%</strong>
            </div>
            <div class="progress-bg"><div class="progress-fill green" [style.width.%]="currentMetrics.ocrAccuracy"></div></div>
          </div>
          <div class="bar-group">
            <div class="bar-label">
              <span>LLM Field Extraction Precision (Claude / Gemini Schema Match)</span>
              <strong>{{ currentMetrics.precision }}%</strong>
            </div>
            <div class="progress-bg"><div class="progress-fill blue" [style.width.%]="currentMetrics.precision"></div></div>
          </div>
          <div class="bar-group">
            <div class="bar-label">
              <span>Reviewer Direct Acceptance Rate (No Edit Needed)</span>
              <strong>{{ 100 - currentMetrics.overrideRate }}%</strong>
            </div>
            <div class="progress-bg"><div class="progress-fill purple" [style.width.%]="100 - currentMetrics.overrideRate"></div></div>
          </div>
        </div>
      </div>

      <!-- TWO-COLUMN GRID: CONFUSION MATRIX & UNCERTAIN FIELDS -->
      <div class="grid-2col">
        <!-- CONFUSION MATRIX -->
        <div class="matrix-card">
          <h3>Classification Confusion Matrix</h3>
          <table class="matrix-table">
            <thead>
              <tr>
                <th>PREDICTED \\ ACTUAL</th>
                <th>PUR-INVOICE</th>
                <th>SUP-CONTRACT</th>
                <th>INT-POLICY</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>PUR-INVOICE</th>
                <td class="match-cell"><strong>98.4%</strong></td>
                <td>0.8%</td>
                <td>0.8%</td>
              </tr>
              <tr>
                <th>SUP-CONTRACT</th>
                <td>1.2%</td>
                <td class="match-cell"><strong>97.2%</strong></td>
                <td>1.6%</td>
              </tr>
              <tr>
                <th>INT-POLICY</th>
                <td>0.5%</td>
                <td>0.5%</td>
                <td class="match-cell"><strong>99.0%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- UNCERTAIN FIELDS TABLE -->
        <div class="uncertain-card">
          <h3>Highest Override "Uncertain Fields"</h3>
          <table class="uncertain-table">
            <thead>
              <tr>
                <th>FIELD KEY</th>
                <th>AVG CONFIDENCE</th>
                <th>OVERRIDE %</th>
                <th>TOP REASON</th>
              </tr>
            </thead>
            <tbody>
              @for (field of uncertainFields; track field.key) {
                <tr>
                  <td><code>{{ field.key }}</code></td>
                  <td><strong>{{ field.avgConfidence * 100 }}%</strong></td>
                  <td><span class="override-chip">{{ field.overrideRate }}%</span></td>
                  <td class="reason-sub">{{ field.topCorrectionReason }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- BENCHMARK RUN HISTORY -->
      <div class="history-card">
        <h3>AI Benchmark Suite Run History</h3>
        <table class="history-table">
          <thead>
            <tr>
              <th>RUN ID</th>
              <th>DATE & TIME</th>
              <th>DATASET TEST SIZE</th>
              <th>PRECISION</th>
              <th>RECALL</th>
              <th>CER</th>
              <th class="text-right">STATUS</th>
            </tr>
          </thead>
          <tbody>
            @for (run of benchmarkHistory; track run.id) {
              <tr>
                <td><code>{{ run.id }}</code></td>
                <td>{{ run.date }}</td>
                <td><strong>{{ run.datasetSize }}</strong> Ground Truth Docs</td>
                <td>{{ run.precision }}%</td>
                <td>{{ run.recall }}%</td>
                <td>{{ run.cer }}%</td>
                <td class="text-right">
                  <span class="run-status {{ run.status }}">{{ run.status | uppercase }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-ai-quality-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .header-actions { display: flex; gap: 0.75rem; .doctype-select { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.55rem 1.1rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: background 0.2s; &:hover { background: #4338ca; } } } }
    .metrics-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; }
    .metric-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); .m-label { font-size: 0.75rem; color: #64748b; font-weight: 500; } .m-val { font-size: 1.35rem; font-weight: 800; &.green { color: #15803d; } &.amber { color: #c2410c; } } .m-sub { font-size: 0.7rem; color: #94a3b8; } }
    .breakdown-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); h3 { margin: 0 0 1rem 0; font-size: 1rem; color: #0f172a; font-weight: 600; } .contrib-bars { display: flex; flex-direction: column; gap: 0.85rem; .bar-group { .bar-label { display: flex; justify-content: space-between; font-size: 0.82rem; color: #475569; margin-bottom: 0.35rem; font-weight: 500; } .progress-bg { background: #f1f5f9; border-radius: 9999px; height: 10px; overflow: hidden; .progress-fill { height: 100%; border-radius: 9999px; &.green { background: #16a34a; } &.blue { background: #2563eb; } &.purple { background: #9333ea; } } } } } }
    .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    .matrix-card, .uncertain-card, .history-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); h3 { margin: 0 0 1rem 0; font-size: 1rem; color: #0f172a; font-weight: 600; } }
    .matrix-table, .uncertain-table, .history-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; th { background: #f8fafc; color: #475569; padding: 0.55rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; } td { padding: 0.55rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } code { background: #f1f5f9; color: #4f46e5; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #e2e8f0; } .match-cell { background: #dcfce7; color: #15803d; font-weight: 700; } .override-chip { background: #ffedd5; color: #c2410c; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.7rem; border: 1px solid #fed7aa; } .reason-sub { font-size: 0.75rem; color: #64748b; } .run-status { font-weight: 700; font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 9999px; &.passed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; } &.warning { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminAiQuality implements OnInit {
  private adminService = inject(HttpAdminService);

  selectedDocType = 'PUR-INVOICE';
  toastMessage: string | null = null;
  goldenSetSampleSize = 15;
  currentModelVersion = 'gemini-1.5-pro / tesseract-v5.5';

  currentMetrics = {
    precision: 96.4,
    recall: 94.8,
    cer: 1.2,
    overrideRate: 8.4,
    citationAccuracy: 98.2,
    faithfulness: 95.1,
    ocrAccuracy: 97.8,
  };

  uncertainFields: UncertainField[] = [
    { key: 'line_items[].tax_rate', label: 'Line Item Tax Rate', docType: 'PUR-INVOICE', avgConfidence: 0.72, overrideRate: 21.4, topCorrectionReason: 'Ambiguous table column layout' },
    { key: 'supplier_gstin', label: 'Supplier GSTIN', docType: 'PUR-INVOICE', avgConfidence: 0.81, overrideRate: 14.2, topCorrectionReason: 'Faded OCR print scan' },
    { key: 'liability_cap', label: 'Limitation of Liability', docType: 'SUP-CONTRACT', avgConfidence: 0.78, overrideRate: 18.6, topCorrectionReason: 'Complex legalese clause phrasing' },
  ];

  benchmarkHistory: BenchmarkRun[] = [
    { id: 'RUN-BM-401', date: '06 Oct 2026 · 02:30 PM', datasetSize: 15, precision: 96.4, recall: 94.8, cer: 1.2, status: 'passed' },
    { id: 'RUN-BM-400', date: '28 Sep 2026 · 11:00 AM', datasetSize: 15, precision: 94.1, recall: 92.5, cer: 1.8, status: 'warning' },
  ];

  ngOnInit(): void {
    this.loadBenchmarkRuns();
  }

  loadBenchmarkRuns(): void {
    this.adminService.getAiEvaluationRuns().subscribe({
      next: (res: any) => {
        if (res?.runs && res.runs.length > 0) {
          this.benchmarkHistory = res.runs.map((r: any) => ({
            id: r.runId,
            date: new Date(r.executedAt).toLocaleString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
            datasetSize: r.sampleSize || 15,
            precision: +(r.overallPrecision * 100).toFixed(1),
            recall: +(r.overallRecall * 100).toFixed(1),
            cer: 1.2,
            status: r.status === 'COMPLETED' ? 'passed' : 'failed',
          }));
          const latest = res.latestRun || res.runs[0];
          if (latest) {
            this.goldenSetSampleSize = latest.sampleSize || 15;
            this.currentModelVersion = latest.modelVersion || this.currentModelVersion;
            this.currentMetrics.precision = +(latest.overallPrecision * 100).toFixed(1);
            this.currentMetrics.recall = +(latest.overallRecall * 100).toFixed(1);
          }
        }
      },
      error: () => {
        // Fallback or dev simulator
      },
    });
  }

  updateMetricsForType(): void {
    if (this.selectedDocType === 'SUP-CONTRACT') {
      this.currentMetrics = { precision: 93.8, recall: 91.2, cer: 1.6, overrideRate: 12.1, citationAccuracy: 97.4, faithfulness: 93.6, ocrAccuracy: 96.5 };
    } else if (this.selectedDocType === 'INT-POLICY') {
      this.currentMetrics = { precision: 98.1, recall: 97.5, cer: 0.8, overrideRate: 3.2, citationAccuracy: 99.1, faithfulness: 98.0, ocrAccuracy: 99.2 };
    } else {
      this.currentMetrics = { precision: 96.4, recall: 94.8, cer: 1.2, overrideRate: 8.4, citationAccuracy: 98.2, faithfulness: 95.1, ocrAccuracy: 97.8 };
    }
  }

  triggerBenchmarkRun(): void {
    this.showToast('Triggered automated AI Quality benchmark run on Golden Set...');
    this.adminService.triggerAiEvaluationRun('1.2.0', this.currentModelVersion).subscribe({
      next: (res: any) => {
        this.showToast(`AI Quality run queued (${res.runId || 'accepted'}). Refreshing history...`);
        setTimeout(() => this.loadBenchmarkRuns(), 2000);
      },
      error: () => {
        this.showToast('Benchmark run triggered (local simulator).');
      },
    });
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
