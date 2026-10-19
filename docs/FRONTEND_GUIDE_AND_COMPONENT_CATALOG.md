# 🅰️ DocuNexa Frontend Architecture & Component Catalog

**Framework:** Angular 19 (Standalone Components, Signals State Management, SCSS, RxJS)  
**Design System:** Enterprise Indigo Theme (`#4f46e5`, Slate Surface cards, Tailwind CSS utilities)  
**Location:** `document-intelligence-ui/`

---

## 1. 🏗 Architecture Principles & Design System

### Standalone Component Pattern
DocuNexa strictly uses Angular Standalone components (no `@NgModule` modules). Every feature component explicitly declares its required imports (`CommonModule`, `RouterModule`, `FormsModule`, `SharedUiComponents`).

### State Management & Signals
- Real-time reactivity is driven by Angular `signal()` and `computed()`.
- Telemetry metrics update dynamically via RxJS BehaviorSubjects linked to SSE/WebSocket streams.

### Theme & Palette Guidelines
- **Primary Color:** `#4f46e5` (Indigo-600)
- **Secondary Accent:** `#8b5cf6` (Purple-500)
- **Surface Background:** `#f8fafc` (Light Slate-50)
- **Card Background:** `#ffffff` (White with subtle border `rgba(226, 232, 240, 0.8)`)
- **Success / STP Badge:** `#10b981` (Emerald-500)
- **SLA Breach / Exception Badge:** `#ef4444` (Rose-500)

---

## 2. 🧩 Feature Component Map

### 📊 1. Executive Dashboard (`src/app/features/dashboard/`)
- **Files:** `dashboard.ts`, `dashboard.html`, `dashboard.scss`
- **Key Features:**
  - 4 Telemetry Header KPI Cards (Total Documents, STP Rate, Avg Confidence, Active Exceptions)
  - Processing & Quality Analytics Stacked Bar Chart (Volume by document type)
  - SLA Compliance Dual-Line Trend (Target SLA vs Actual turn-around)
  - Donut Status Breakdown & Exception Matrix

### 📈 2. Governance & Operations Reports Center (`src/app/features/reports/`)
- **Files:** `reports.ts`, `reports.html`, `reports.scss`
- **Key Features:**
  - 4 Telemetry Executive KPIs (Total Processed, STP Rate %, Cost Savings $, SLA Breach Count)
  - 5 Enterprise Tab Clusters:
    1. `EXECUTIVE_SUMMARY`: Operations & SLA metrics
    2. `STP_ANALYSIS`: Straight-Through-Processing performance by document schema
    3. `EXCEPTION_AUDIT`: Verification override logs with reviewer IDs
    4. `AUDIT_LOGS`: Cryptographically sealed event trails
    5. `SECURITY_COMPLIANCE`: Role permission access logs
  - Real-time Search & Multi-filter bar
  - Cryptographically Sealed CSV Export (`SHA-256` signature included in report headers)

### 🔬 3. Review Workbench (`src/app/features/review/review-workbench/`)
- **Files:** `review-workbench.ts`, `review-workbench.html`, `review-workbench.scss`
- **Key Features:**
  - Dual-pane layout: Interactive PDF Viewer Canvas (Left) + Extraction Panel (Right)
  - Highlighting OCR Bounding Boxes ($[x, y, width, height]$) synchronized on hover
  - Human-in-the-Loop field correction with override reason logging
  - Approval action bar: `Approve`, `Reject`, `Escalate to Manager`

---

## 3. 🔄 Mock Service vs. Live Backend API Switching

DocuNexa frontend is built with a **Pluggable Adapter Architecture**. 

- **Mock Mode (Default for UI Dev):** Driven by `DOCUMENT_SERVICE_TOKEN` mapped to `MockDocumentService`.
- **Live Backend Mode:** Set `environment.production = true` or switch provider token to `HttpDocumentService` in `src/app/app.config.ts`:

```typescript
// src/app/app.config.ts
import { DOCUMENT_SERVICE_TOKEN } from './core/tokens/document-service.token';
import { HttpDocumentService } from './core/services/http-document.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: DOCUMENT_SERVICE_TOKEN, useClass: HttpDocumentService } // Switch to Live REST API
  ]
};
```
