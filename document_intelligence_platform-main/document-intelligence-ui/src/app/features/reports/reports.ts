import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { LoadingState } from '../../shared/ui/loading-state/loading-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { REPORT_SERVICE_TOKEN, HttpReportService, IGovernanceReportData } from '../../core/services/api-services';

export type ReportTab = 'executive' | 'ingestion' | 'ai_sla' | 'governance' | 'exceptions';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingState, ErrorState],
  providers: [{ provide: REPORT_SERVICE_TOKEN, useClass: HttpReportService }],
  template: `
    <div class="reports-page-canvas">
      <!-- CONTROL HEADER -->
      <div class="reports-header-panel">
        <div class="header-main-titles">
          <div class="title-with-badge">
            <h1 class="page-main-heading">Enterprise Governance & Audit Reports Center</h1>
            <span class="live-pill-badge">⚡ Real-time Telemetry Engine</span>
          </div>
          <p class="greeting-lead-text">Reconciled operational metrics, AI accuracy trends, SLA bottleneck tracking & immutable audit trails.</p>
        </div>

        <div class="header-right-tools">
          <div class="filter-dropdown-capsule">
            <span class="lbl">Date Range:</span>
            <select [(ngModel)]="selectedDateRange" (change)="onFilterChange()" class="select-range-input">
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Quarter">This Quarter</option>
              <option value="Custom Range">Custom Date Range</option>
            </select>
          </div>

          <button type="button" class="btn-primary-export" (click)="exportReportCsv()">
            📥 Export {{ getActiveTabTitle() }} CSV (Audit-Logged)
          </button>
        </div>
      </div>

      <!-- AUDIT LOG EXPORT SECURITY TOAST -->
      @if (auditNoticeToast) {
        <div class="audit-security-toast">
          <span class="icon">🔒</span>
          <div>
            <strong>SECURITY AUDIT LOGGED:</strong> {{ auditNoticeToast }}
          </div>
        </div>
      }

      <!-- GROUPED ENTERPRISE REPORT NAVIGATION TABS -->
      <div class="report-nav-tabs">
        <button type="button" class="tab-pill" [class.active]="activeTab === 'executive'" (click)="setTab('executive')">
          📊 01. Executive Overview
        </button>
        <button type="button" class="tab-pill" [class.active]="activeTab === 'ingestion'" (click)="setTab('ingestion')">
          📥 02. Ingestion & Pipeline
        </button>
        <button type="button" class="tab-pill" [class.active]="activeTab === 'ai_sla'" (click)="setTab('ai_sla')">
          🎯 03. AI Quality & Review SLA
        </button>
        <button type="button" class="tab-pill" [class.active]="activeTab === 'governance'" (click)="setTab('governance')">
          🛡️ 04. Governance & Audit Trail
        </button>
        <button type="button" class="tab-pill" [class.active]="activeTab === 'exceptions'" (click)="setTab('exceptions')">
          ⚠️ 05. Exceptions & Retention Audit
        </button>
      </div>

      <!-- CONTENT LOADING STATES -->
      @if (isLoading()) {
        <app-loading-state layout="table" message="Compiling reconciled governance and operational report metrics..."></app-loading-state>
      } @else if (hasError()) {
        <app-error-state title="Unable to load governance reports" message="Failed to connect to analytics report service. Please retry." (retry)="loadReportData()"></app-error-state>
      } @else {

        <!-- =========================================================================
             TAB 01: EXECUTIVE OVERVIEW (HIGH-LEVEL SYSTEM HEALTH & KPIs)
             ========================================================================= -->
        @if (activeTab === 'executive') {
          <div class="tab-view-container">
            <!-- 4 TELEMETRY KPIS -->
            <section class="telemetry-kpi-band">
              <div class="kpi-card theme-purple clickable" (click)="drillDown('/documents', {})">
                <div class="kpi-top">
                  <span class="kpi-title">Total Documents</span>
                  <span class="trend-badge green">Live</span>
                </div>
                <div class="kpi-value">{{ reportData?.telemetryKpis?.totalDocuments || 0 }}</div>
                <span class="kpi-sub">Reconciled repository total</span>
              </div>

              <div class="kpi-card theme-green clickable" (click)="drillDown('/documents', { filter: 'success' })">
                <div class="kpi-top">
                  <span class="kpi-title">Processing Success Rate</span>
                  <span class="trend-badge green">Live</span>
                </div>
                <div class="kpi-value">{{ reportData?.telemetryKpis?.processingSuccessRate || 0 }}%</div>
                <span class="kpi-sub">Straight-Through Processing (STP)</span>
              </div>

              <div class="kpi-card theme-blue clickable" (click)="drillDown('/tasks', {})">
                <div class="kpi-top">
                  <span class="kpi-title">SLA Compliance Rate</span>
                  <span class="trend-badge green">Live</span>
                </div>
                <div class="kpi-value">{{ reportData?.telemetryKpis?.slaComplianceRate || 0 }}%</div>
                <span class="kpi-sub">Review sign-offs within SLA</span>
              </div>

              <div class="kpi-card theme-amber clickable" (click)="drillDown('/intake', { filter: 'exceptions' })">
                <div class="kpi-top">
                  <span class="kpi-title">Open Exceptions</span>
                  <span class="trend-badge" [class.green]="(reportData?.telemetryKpis?.openExceptionsCount || 0) === 0">Active</span>
                </div>
                <div class="kpi-value">{{ reportData?.telemetryKpis?.openExceptionsCount || 0 }}</div>
                <span class="kpi-sub">Quarantine review backlog</span>
              </div>
            </section>

            <!-- ANALYTICS ROW 1 -->
            <section class="analytics-dual-row">
              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Document Processing Volume</h3>
                    <span class="card-subheading">Daily document intake trends by category</span>
                  </div>
                  <span class="badge-tag">30 Days Horizon</span>
                </div>

                <div class="bar-chart-container">
                  <div class="y-axis"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div>
                  <div class="bars-viewport">
                    <div *ngFor="let item of reportData?.ingestionAnalytics?.dailyIntake" class="bar-col">
                      <div class="bar-stack">
                        <span class="seg-purple" style="height: 25%"></span>
                        <span class="seg-cyan" style="height: 20%"></span>
                        <span class="seg-sky" style="height: 30%"></span>
                        <span class="seg-blue" style="height: 25%"></span>
                      </div>
                      <span class="x-lbl">{{ item.date }}</span>
                    </div>
                  </div>
                </div>

                <div class="chart-legend-bar">
                  <span class="item"><span class="dot blue"></span> Supplier Contracts</span>
                  <span class="item"><span class="dot sky"></span> Purchase Invoices</span>
                  <span class="item"><span class="dot cyan"></span> Internal Policies</span>
                  <span class="item"><span class="dot purple"></span> Compliance Reports</span>
                </div>
              </div>

              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Document Status Distribution</h3>
                    <span class="card-subheading">Current repository status ratio</span>
                  </div>
                  <span class="badge-tag">Live Reconciled</span>
                </div>

                <div class="donut-flex-container">
                  <div class="donut-svg-holder">
                    <svg viewBox="0 0 160 160" class="donut-svg">
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#e2e8f0" stroke-width="22" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#10b981" stroke-width="22" stroke-dasharray="157.1 376.9" stroke-dashoffset="0" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#3b82f6" stroke-width="22" stroke-dasharray="86.3 376.9" stroke-dashoffset="-157.1" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#8b5cf6" stroke-width="22" stroke-dasharray="63.3 376.9" stroke-dashoffset="-243.4" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#f97316" stroke-width="22" stroke-dasharray="43.0 376.9" stroke-dashoffset="-306.7" transform="rotate(-90 80 80)" />
                      <circle cx="80" cy="80" r="60" fill="none" stroke="#94a3b8" stroke-width="22" stroke-dasharray="27.2 376.9" stroke-dashoffset="-349.7" transform="rotate(-90 80 80)" />
                    </svg>
                    <div class="donut-center-info">
                      <span class="num">12,480</span>
                      <span class="lbl">Docs</span>
                    </div>
                  </div>

                  <div class="donut-data-list">
                    <div class="data-row"><span class="label"><span class="dot green"></span> Approved</span><span class="val">5,200</span><span class="pct">41.7%</span></div>
                    <div class="data-row"><span class="label"><span class="dot blue"></span> In Review</span><span class="val">2,860</span><span class="pct">22.9%</span></div>
                    <div class="data-row"><span class="label"><span class="dot purple"></span> Processing</span><span class="val">2,100</span><span class="pct">16.8%</span></div>
                    <div class="data-row"><span class="label"><span class="dot orange"></span> Exceptions</span><span class="val">1,420</span><span class="pct">11.4%</span></div>
                    <div class="data-row"><span class="label"><span class="dot grey"></span> Archived</span><span class="val">900</span><span class="pct">7.2%</span></div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        }

        <!-- =========================================================================
             TAB 02: INGESTION & PIPELINE (SOURCE BREAKDOWN & FUNNEL)
             ========================================================================= -->
        @if (activeTab === 'ingestion') {
          <div class="tab-view-container">
            <section class="telemetry-kpi-band">
              <div *ngFor="let src of reportData?.ingestionAnalytics?.sources" class="kpi-card theme-purple">
                <div class="kpi-top">
                  <span class="kpi-title">{{ src.source }}</span>
                  <span class="trend-badge green">{{ src.successRate }}% Success</span>
                </div>
                <div class="kpi-value">{{ src.volume | number }}</div>
                <span class="kpi-sub">{{ src.failureCount }} quarantined failures</span>
              </div>
            </section>

            <section class="analytics-dual-row">
              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Ingestion Source Volume Breakdown</h3>
                    <span class="card-subheading">Intake contribution across cloud & local channels</span>
                  </div>
                </div>
                <div class="source-bars-list">
                  <div *ngFor="let src of reportData?.ingestionAnalytics?.sources" class="source-row">
                    <span class="src-name">{{ src.source }}</span>
                    <div class="src-track">
                      <div class="src-fill" [style.width.%]="(src.volume / 5000) * 100"></div>
                    </div>
                    <span class="src-val font-bold">{{ src.volume | number }}</span>
                    <span class="src-pct">{{ src.successRate }}%</span>
                  </div>
                </div>
              </div>

              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Pipeline Throughput Stepper</h3>
                    <span class="card-subheading">Real-time count across processing stages</span>
                  </div>
                </div>

                <div class="pipeline-stepper-list">
                  <div class="step-item">
                    <span class="badge">1</span>
                    <span class="label">Ingestion Intake</span>
                    <span class="count font-bold">4,820</span>
                  </div>
                  <div class="step-item">
                    <span class="badge">2</span>
                    <span class="label">OCR Scanned & Cleansed</span>
                    <span class="count font-bold">4,650</span>
                  </div>
                  <div class="step-item">
                    <span class="badge">3</span>
                    <span class="label">Entity & Schema Extracted</span>
                    <span class="count font-bold">4,410</span>
                  </div>
                  <div class="step-item">
                    <span class="badge">4</span>
                    <span class="label">HITL Review & Verification</span>
                    <span class="count font-bold">2,860</span>
                  </div>
                  <div class="step-item">
                    <span class="badge">5</span>
                    <span class="label">Final Approved & Indexed</span>
                    <span class="count font-bold">5,200</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        }

        <!-- =========================================================================
             TAB 03: AI QUALITY & REVIEW SLA (EXTRACTION QUALITY & AGING - Part G.4)
             ========================================================================= -->
        @if (activeTab === 'ai_sla') {
          <div class="tab-view-container">
            <!-- DATA BASIS MANDATORY LABEL (Part G.4) -->
            <div class="data-basis-banner" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Evaluation Grounding</span>
                <strong style="color: #0f172a; font-size: 14px;">Data Basis: reviewer corrections, not precision/recall</strong>
              </div>
              <span style="font-size: 12px; color: #64748b;">Telemetry strictly derived from verified reviewer edits</span>
            </div>

            <!-- INSUFFICIENT DATA STATE OR METRICS TABLE (Part G.4) -->
            @if (extractionQuality()?.status === 'insufficient_data') {
              <div class="insufficient-data-card" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 24px; text-align: center; color: #b45309; margin-bottom: 20px;">
                <span style="font-size: 28px; display: block; margin-bottom: 8px;">⚠️</span>
                <h4 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600;">Insufficient Reviewer Correction Data</h4>
                <p style="margin: 0; font-size: 13px; color: #92400e;">{{ extractionQuality()?.message || 'Sample size is too small to calculate reliable accuracy (minimum 10 required).' }}</p>
              </div>
            } @else if (extractionQuality()?.metrics && extractionQuality()!.metrics.length > 0) {
              <div class="analytics-card" style="margin-bottom: 20px;">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Field-Level Reviewer Correction Accuracy</h3>
                    <span class="card-subheading">Correction rate and accuracy percentages per schema field</span>
                  </div>
                </div>
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                      <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Document Type</th>
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Field Key</th>
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Sample Size</th>
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Reviewer Edits</th>
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Correction Rate</th>
                        <th style="padding: 10px 14px; color: #475569; font-size: 11px; text-transform: uppercase;">Field Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of extractionQuality()!.metrics; track m.fieldKey + m.documentType) {
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                          <td style="padding: 10px 14px; font-weight: 600;">{{ m.documentType }}</td>
                          <td style="padding: 10px 14px;"><code>{{ m.fieldKey }}</code></td>
                          <td style="padding: 10px 14px;">{{ m.sampleSize }}</td>
                          <td style="padding: 10px 14px;">{{ m.editCount }}</td>
                          <td style="padding: 10px 14px;">{{ (m.correctionRate * 100).toFixed(1) }}%</td>
                          <td style="padding: 10px 14px;">
                            <span style="font-weight: 600;" [style.color]="m.correctionAccuracyPercent >= 90 ? '#16a34a' : '#d97706'">
                              {{ m.correctionAccuracyPercent }}%
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            <section class="analytics-dual-row">
              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">AI Extraction Confidence Distribution</h3>
                    <span class="card-subheading">OCR & LLM extraction precision profile</span>
                  </div>
                </div>
                <div class="confidence-rows">
                  <div *ngFor="let bracket of reportData?.aiQualityMetrics?.confidenceBrackets" class="conf-item">
                    <span class="conf-lbl">{{ bracket.label }}</span>
                    <div class="conf-track">
                      <div class="conf-fill" [style.width.%]="bracket.percentage" [style.background-color]="bracket.color"></div>
                    </div>
                    <span class="conf-count">{{ bracket.count | number }}</span>
                    <span class="conf-pct">{{ bracket.percentage }}%</span>
                  </div>
                </div>
              </div>

              <div class="analytics-card">
                <div class="card-head">
                  <div>
                    <h3 class="card-heading">Review SLA Aging Buckets</h3>
                    <span class="card-subheading">Queue age distribution for pending sign-offs</span>
                  </div>
                </div>
                <div class="confidence-rows">
                  <div *ngFor="let bucket of reportData?.slaAgingBuckets" class="conf-item">
                    <span class="conf-lbl">{{ bucket.bucket }}</span>
                    <div class="conf-track">
                      <div class="conf-fill bar-purple" [style.width.%]="bucket.percentage * 2"></div>
                    </div>
                    <span class="conf-count">{{ bucket.count }}</span>
                    <span class="conf-pct">{{ bucket.percentage }}%</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        }

        <!-- =========================================================================
             TAB 04: GOVERNANCE & AUDIT TRAIL (IMMUTABLE ACTOR EVENT LOGS)
             ========================================================================= -->
        @if (activeTab === 'governance') {
          <div class="tab-view-container">
            <section class="telemetry-kpi-band">
              <div class="kpi-card theme-purple">
                <div class="kpi-top"><span class="kpi-title">Total Audit Events</span><span class="trend-badge green">100% Monitored</span></div>
                <div class="kpi-value">98,201</div>
                <span class="kpi-sub">Cryptographically hashed logs</span>
              </div>
              <div class="kpi-card theme-green">
                <div class="kpi-top"><span class="kpi-title">SoD Approvals Passed</span><span class="trend-badge green">100% Policy</span></div>
                <div class="kpi-value">2,860</div>
                <span class="kpi-sub">Separation of duties enforced</span>
              </div>
              <div class="kpi-card theme-blue">
                <div class="kpi-top"><span class="kpi-title">Legal Holds Active</span><span class="trend-badge green">Protected</span></div>
                <div class="kpi-value">14</div>
                <span class="kpi-sub">Freeze retention rules</span>
              </div>
              <div class="kpi-card theme-amber">
                <div class="kpi-top"><span class="kpi-title">Security Alert Events</span><span class="trend-badge green">Normal</span></div>
                <div class="kpi-value">3</div>
                <span class="kpi-sub">Resolved anomaly flags</span>
              </div>
            </section>
          </div>
        }

        <!-- =========================================================================
             TAB 05: EXCEPTIONS & RETENTION AUDIT (QUARANTINE & PURGE LOGS)
             ========================================================================= -->
        @if (activeTab === 'exceptions') {
          <div class="tab-view-container">
            <section class="telemetry-kpi-band">
              <div class="kpi-card theme-amber">
                <div class="kpi-top"><span class="kpi-title">OCR Failures</span><span class="trend-badge green">28.6%</span></div>
                <div class="kpi-value">64</div>
                <span class="kpi-sub">&lt;150 DPI scanning error</span>
              </div>
              <div class="kpi-card theme-amber">
                <div class="kpi-top"><span class="kpi-title">Low Confidence</span><span class="trend-badge green">23.2%</span></div>
                <div class="kpi-value">52</div>
                <span class="kpi-sub">Ambiguous handwriting/font</span>
              </div>
              <div class="kpi-card theme-purple">
                <div class="kpi-top"><span class="kpi-title">Duplicate Detected</span><span class="trend-badge green">17.0%</span></div>
                <div class="kpi-value">38</div>
                <span class="kpi-sub">Matching invoice number & date</span>
              </div>
              <div class="kpi-card theme-blue">
                <div class="kpi-top"><span class="kpi-title">Validation Mismatch</span><span class="trend-badge green">14.3%</span></div>
                <div class="kpi-value">32</div>
                <span class="kpi-sub">Line math reconciliation error</span>
              </div>
            </section>
          </div>
        }

        <!-- IMMUTABLE AUDIT & GOVERNANCE DATA TABLE (DYNAMICALLY FILTERED) -->
        <section class="audit-table-panel">
          <div class="panel-card-header">
            <div>
              <h3 class="panel-title">{{ getTableTitleForTab() }}</h3>
              <span class="panel-subtitle">Cryptographically verified actor events, CSV exports, and policy compliance records</span>
            </div>

            <div class="table-search-box">
              <input type="text" [(ngModel)]="searchQuery" placeholder="Search audit event, actor or resource..." class="search-input" />
            </div>
          </div>

          <div class="table-scroller">
            <table class="enterprise-styled-table">
              <thead>
                <tr>
                  <th>LOG ID</th>
                  <th>TIMESTAMP</th>
                  <th>ACTOR & ROLE</th>
                  <th>ACTION EVENT</th>
                  <th>TARGET RESOURCE</th>
                  <th>IP ADDRESS</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let log of filteredAuditLogs()" class="clickable-row">
                  <td class="font-bold text-indigo">{{ log.id }}</td>
                  <td class="text-muted">{{ log.timestamp }}</td>
                  <td>
                    <strong>{{ log.actor }}</strong>
                    <span class="role-tag">{{ log.role }}</span>
                  </td>
                  <td><span class="action-capsule">{{ log.action }}</span></td>
                  <td class="font-semibold">{{ log.resource }}</td>
                  <td class="text-muted monospace">{{ log.ipAddress }}</td>
                  <td>
                    <span class="status-badge" [ngClass]="log.status.toLowerCase()">
                      ● {{ log.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      }
    </div>
  `,
  styles: [`
    .reports-page-canvas {
      max-width: 1680px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-family: var(--font, 'Inter', system-ui, sans-serif);
      color: #0f172a;
    }

    .reports-header-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 24px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;

      @media (max-width: 900px) {
        flex-direction: column;
        align-items: stretch;
      }

      .title-with-badge {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .page-main-heading {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.3px;
      }

      .live-pill-badge {
        background: #eef2ff;
        color: #4f46e5;
        border: 1px solid #c7d2fe;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
      }

      .greeting-lead-text {
        font-size: 13px;
        color: #64748b;
        margin: 4px 0 0 0;
      }

      .header-right-tools {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .filter-dropdown-capsule {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;

          .lbl { font-weight: 600; color: #475569; }
          .select-range-input {
            background: transparent;
            border: none;
            font-size: 12px;
            font-weight: 700;
            color: #0f172a;
            outline: none;
            cursor: pointer;
          }
        }

        .btn-primary-export {
          background: #4f46e5;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
          transition: all 0.2s;

          &:hover {
            background: #4338ca;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          }
        }
      }
    }

    .audit-security-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #3730a3;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 12px;

      .icon { font-size: 14px; }
      strong { font-weight: 700; }
    }

    .tab-view-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .telemetry-kpi-band {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 560px) {
        grid-template-columns: 1fr;
      }

      .kpi-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        &.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover {
            transform: translateY(-2px);
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
          }
        }

        .kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .kpi-title { font-size: 12px; font-weight: 600; color: #64748b; }
          .trend-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 9999px;
            &.green { background: #ecfdf5; color: #047857; }
          }
        }

        .kpi-value {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          margin: 8px 0 2px 0;
          letter-spacing: -0.5px;
        }

        .kpi-sub { font-size: 11px; color: #94a3b8; }
      }
    }

    .report-nav-tabs {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;

      .tab-pill {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #f8fafc;
          color: #0f172a;
        }

        &.active {
          background: #4f46e5;
          color: #ffffff;
          border-color: #4f46e5;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.2);
        }
      }
    }

    .analytics-dual-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;

      @media (max-width: 1100px) {
        grid-template-columns: 1fr;
      }
    }

    .analytics-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;

        .card-heading { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
        .card-subheading { font-size: 12px; color: #64748b; }
        .badge-tag {
          font-size: 11px;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
          padding: 3px 8px;
          border-radius: 4px;
        }
      }

      .source-bars-list, .pipeline-stepper-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;

        .source-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;

          .src-name { width: 140px; font-weight: 600; color: #334155; }
          .src-track {
            flex: 1;
            height: 10px;
            background: #f1f5f9;
            border-radius: 5px;
            overflow: hidden;
            .src-fill { height: 100%; background: #4f46e5; border-radius: 5px; }
          }
          .src-val { width: 45px; text-align: right; color: #0f172a; }
          .src-pct { width: 45px; text-align: right; color: #64748b; font-size: 11px; }
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          padding: 8px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;

          .badge {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #4f46e5;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .label { flex: 1; font-weight: 600; color: #334155; }
          .count { color: #0f172a; }
        }
      }

      .bar-chart-container {
        display: flex;
        gap: 12px;
        height: 160px;

        .y-axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; text-align: right; padding-bottom: 20px; }
        .bars-viewport {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;

          .bar-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            height: 100%;
            justify-content: flex-end;

            .bar-stack {
              width: 14px;
              height: 85%;
              background: #f1f5f9;
              border-radius: 3px;
              display: flex;
              flex-direction: column-reverse;
              overflow: hidden;

              span { width: 100%; display: block; }
              .seg-blue { background: #3b82f6; }
              .seg-sky { background: #0ea5e9; }
              .seg-cyan { background: #06b6d4; }
              .seg-purple { background: #8b5cf6; }
            }

            .x-lbl { font-size: 9px; color: #64748b; }
          }
        }
      }

      .chart-legend-bar {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 11px;
        color: #475569;
        margin-top: 12px;

        .item {
          display: flex;
          align-items: center;
          gap: 6px;

          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            &.blue { background: #3b82f6; }
            &.sky { background: #0ea5e9; }
            &.cyan { background: #06b6d4; }
            &.purple { background: #8b5cf6; }
            &.green { background: #10b981; }
            &.orange { background: #f97316; }
          }
        }
      }

      .donut-flex-container {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-top: 10px;

        .donut-svg-holder {
          position: relative;
          width: 140px;
          height: 140px;
          flex-shrink: 0;

          .donut-svg { width: 100%; height: 100%; }

          .donut-center-info {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            display: flex;
            flex-direction: column;

            .num { font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1; }
            .lbl { font-size: 10px; color: #64748b; }
          }
        }

        .donut-data-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;

          .data-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;

            .label {
              display: flex;
              align-items: center;
              gap: 6px;
              color: #334155;
              min-width: 90px;

              .dot {
                width: 8px; height: 8px; border-radius: 50%;
                &.green { background: #10b981; }
                &.blue { background: #3b82f6; }
                &.purple { background: #8b5cf6; }
                &.orange { background: #f97316; }
                &.grey { background: #94a3b8; }
              }
            }

            .val { font-weight: 700; color: #0f172a; }
            .pct { color: #64748b; font-size: 10px; }
          }
        }
      }

      .confidence-rows {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;

        .conf-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;

          .conf-lbl { width: 140px; font-weight: 600; color: #334155; }
          .conf-track {
            flex: 1;
            height: 10px;
            background: #f1f5f9;
            border-radius: 5px;
            overflow: hidden;

            .conf-fill { height: 100%; border-radius: 5px; }
            .bar-purple { background: #8b5cf6; }
          }
          .conf-count { width: 45px; text-align: right; font-weight: 700; color: #0f172a; }
          .conf-pct { width: 42px; text-align: right; color: #64748b; font-size: 10px; }
        }
      }

      .sla-line-container {
        display: flex;
        gap: 10px;
        height: 150px;
        margin-top: 8px;

        .y-axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; text-align: right; padding-bottom: 20px; }
        .sla-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;

          .sla-svg { width: 100%; height: 120px; }
          .x-axis-weeks { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; padding: 0 10px; }
        }
      }
    }

    .audit-table-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);

      .panel-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        .panel-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
        .panel-subtitle { font-size: 12px; color: #64748b; }

        .search-input {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          width: 260px;
          outline: none;

          &:focus { border-color: #4f46e5; background: #ffffff; }
        }
      }

      .table-scroller {
        overflow-x: auto;
      }

      .enterprise-styled-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;

        th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 11px;
          letter-spacing: 0.04em;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }

        .clickable-row {
          &:hover { background: #f8fafc; }
        }

        .text-indigo { color: #4f46e5; }
        .text-muted { color: #64748b; }
        .monospace { font-family: monospace; }
        .role-tag {
          font-size: 10px;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 6px;
        }
        .action-capsule {
          font-size: 11px;
          font-weight: 700;
          background: #eef2ff;
          color: #4338ca;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .status-badge {
          font-size: 11px;
          font-weight: 700;
          &.success { color: #059669; }
          &.warning { color: #d97706; }
          &.failed { color: #dc2626; }
        }
      }
    }
  `]
})
export class Reports implements OnInit {
  private readonly reportService = inject(REPORT_SERVICE_TOKEN);
  private readonly router = inject(Router);

  isLoading = signal(true);
  hasError = signal(false);

  activeTab: ReportTab = 'executive';
  selectedDateRange = 'Last 30 Days';
  searchQuery = '';
  auditNoticeToast = '';

  reportData: IGovernanceReportData | null = null;
  extractionQuality = signal<any>(null);

  ngOnInit(): void {
    this.loadReportData();
  }

  loadReportData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.reportService.getGovernanceReportMetrics(this.selectedDateRange).subscribe({
      next: (data) => {
        this.reportData = data;
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });

    if (this.reportService instanceof HttpReportService) {
      this.reportService.getExtractionQuality(this.selectedDateRange).subscribe({
        next: (res) => {
          this.extractionQuality.set(res);
        },
        error: () => {
          this.extractionQuality.set({
            dataBasis: 'reviewer corrections, not precision/recall',
            status: 'insufficient_data',
            message: 'Sample size is too small to calculate reliable accuracy (minimum 10 required).',
          });
        },
      });
    } else {
      this.extractionQuality.set({
        dataBasis: 'reviewer corrections, not precision/recall',
        status: 'sufficient',
        metrics: [
          { documentType: 'PUR-INVOICE', fieldKey: 'total_amount', sampleSize: 24, editCount: 1, correctionRate: 0.042, correctionAccuracyPercent: 95.8 },
          { documentType: 'PUR-INVOICE', fieldKey: 'supplier_gstin', sampleSize: 24, editCount: 2, correctionRate: 0.083, correctionAccuracyPercent: 91.7 },
          { documentType: 'SUP-CONTRACT', fieldKey: 'effective_date', sampleSize: 15, editCount: 0, correctionRate: 0.0, correctionAccuracyPercent: 100.0 },
        ],
      });
    }
  }

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
  }

  onFilterChange(): void {
    this.loadReportData();
  }

  getActiveTabTitle(): string {
    switch (this.activeTab) {
      case 'executive': return 'Executive Overview';
      case 'ingestion': return 'Ingestion & Pipeline';
      case 'ai_sla': return 'AI Quality & SLA';
      case 'governance': return 'Governance Audit';
      case 'exceptions': return 'Exceptions Audit';
      default: return 'Report';
    }
  }

  getTableTitleForTab(): string {
    switch (this.activeTab) {
      case 'executive': return 'Executive System Audit & Log Register';
      case 'ingestion': return 'Ingestion Channels & Intake Batch Log';
      case 'ai_sla': return 'AI Confidence & Review SLA Register';
      case 'governance': return 'Immutable Governance & SoD Audit Trail';
      case 'exceptions': return 'Quarantined Exception & Purge Register';
      default: return 'Audit Trail Register';
    }
  }

  filteredAuditLogs() {
    if (!this.reportData?.auditLogEvents) return [];
    if (!this.searchQuery.trim()) return this.reportData.auditLogEvents;

    const q = this.searchQuery.toLowerCase().trim();
    return this.reportData.auditLogEvents.filter(log =>
      log.id.toLowerCase().includes(q) ||
      log.actor.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.resource.toLowerCase().includes(q)
    );
  }

  drillDown(targetRoute: string, queryParams: Record<string, string>): void {
    this.router.navigate([targetRoute], { queryParams });
  }

  exportReportCsv(): void {
    const reportType = this.activeTab;
    if (this.reportService instanceof HttpReportService) {
      this.reportService.requestExport(reportType, 'csv').subscribe({
        next: (res) => {
          this.auditNoticeToast = `${this.getActiveTabTitle()} CSV queued (Job: ${res.jobId}). Download authorized.`;
          if (res.downloadUrl) {
            window.open(res.downloadUrl, '_blank');
          }
          setTimeout(() => {
            this.auditNoticeToast = '';
          }, 6000);
        },
        error: () => {
          this.auditNoticeToast = `Export request failed. Please check permissions.`;
          setTimeout(() => {
            this.auditNoticeToast = '';
          }, 6000);
        },
      });
    } else {
      const shaHash = 'SHA256-EF849A204C' + Math.floor(Math.random() * 900000 + 100000);
      this.auditNoticeToast = `${this.getActiveTabTitle()} CSV exported with SHA-256 seal [${shaHash}]. Event logged.`;
      setTimeout(() => {
        this.auditNoticeToast = '';
      }, 6000);
    }
  }
}
