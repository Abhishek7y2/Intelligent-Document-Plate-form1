# 📄 DocIntel — Enterprise Document Intelligence Platform

> **Enterprise-grade Angular 22 Document Intelligence Platform** designed for end-to-end intelligent document intake, OCR ingestion, automated classification, key-value data extraction, human-in-the-loop review, multi-tier approvals, semantic repository search, RAG AI question-answering, version comparison, and organization governance.

---

## 📋 Table of Contents

- [🚀 Project Overview](#-project-overview)
- [🎯 Problem Statement & Solutions](#-problem-statement--solutions)
- [🏗️ End-to-End Processing Pipeline Architecture](#️-end-to-end-processing-pipeline-architecture)
- [🔑 Platform User Profiles & Credentials](#-platform-user-profiles--credentials)
- [🧩 Deep Module-by-Module Feature Breakdown](#-deep-module-by-module-feature-breakdown)
  - [1. Authentication & Security (`/login`)](#1-authentication--security-login)
  - [2. Executive Overview Dashboard (`/dashboard`)](#2-executive-overview-dashboard-dashboard)
  - [3. Document Intake & Ingestion (`/intake`)](#3-document-intake--ingestion-intake)
  - [4. Central Document Repository (`/documents`)](#4-central-document-repository-documents)
  - [5. Document Detail & Version Engine (`/documents/:id`)](#5-document-detail--version-engine-documentsid)
  - [6. Human-in-the-Loop Review Queue (`/review`)](#6-human-in-the-loop-review-queue-review)
  - [7. Multi-Tier Approvals Workflow (`/approvals`)](#7-multi-tier-approvals-workflow-approvals)
  - [8. Hybrid & Metadata Search (`/search`)](#8-hybrid--metadata-search-search)
  - [9. AI RAG Question Answering (`/qa`)](#9-ai-rag-question-answering-qa)
  - [10. User Task Board (`/tasks`)](#10-user-task-board-tasks)
  - [11. Administration & Governance (`/admin`)](#11-administration--governance-admin)
- [📁 Project Folder Hierarchy](#-project-folder-hierarchy)
- [⚙️ Technical Stack & Architecture](#️-technical-stack--architecture)
- [📦 Installation & Local Setup Guide](#-installation--local-setup-guide)
- [🚀 Running & Building the Application](#-running--building-the-application)
- [🎨 Design System & UI Aesthetics](#-design-system--ui-aesthetics)
- [🗺️ Future Production Backend Integration Roadmap](#️-future-production-backend-integration-roadmap)

---

## 🚀 Project Overview

**DocIntel** is a state-of-the-art Angular web application built to streamline document-heavy enterprise operations. In modern corporate environments, processing supplier contracts, vendor invoices, legal agreements, compliance policies, and financial reports manually is inefficient, expensive, and prone to human error.

DocIntel addresses these pain points by offering an **Intelligent Document Processing (IDP)** workflow that automates the lifecycle of documents from intake to archiving, while keeping humans in the loop for low-confidence validations and managerial approvals.

---

## 🎯 Problem Statement & Solutions

### The Challenge
Organizations handle thousands of structured, semi-structured, and unstructured business documents daily. Manual handling involves:
1. Reading documents line by line.
2. Manually keying data into ERP/CRM software.
3. Catching mismatched data (e.g. tax rates, line items, expiration dates).
4. Routing documents for review via email or physical paper trails.
5. Inability to search across unstructured PDF text or ask instant questions.

### The DocIntel Solution
DocIntel replaces fragmented manual processes with a unified platform:
- **Automated Processing:** Multi-file intake with real-time OCR, field extraction, and auto-classification.
- **Human-in-the-Loop Verification:** Highlights low-confidence extractions in red/yellow for quick human validation.
- **Audit Trails & Governance:** Full version history, side-by-side diff comparison, and approval logs.
- **AI RAG Assistant:** Ask questions directly to your repository with exact page citations.

---

## 🏗️ End-to-End Processing Pipeline Architecture

```text
 ┌────────────────────────────────────────────────────────┐
 │                   1. Document Intake                   │
 │        Drag-and-Drop Batch Upload (PDF, PNG, JPG)      │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                     2. OCR Engine                      │
 │        Optical Character Recognition & Text Layout     │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │               3. AI Classification Engine              │
 │    Categorize into Contracts, Invoices, Policies...    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                 4. Key-Value Extraction                │
 │    Extract Entities (Vendor, Amounts, Dates, Terms)    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                 5. Validation & Scoring                │
 │       Assign Confidence Score % (High / Med / Low)     │
 └─────────────┬─────────────────────────────┬────────────┘
               │                             │
    [Confidence < Threshold]       [Confidence >= Threshold]
               │                             │
               ▼                             ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │   6. Review Queue (HITL)  │ │   7. Approval Workflow    │
 │   Human Verifies & Fixes  │ │   Managerial Sign-off     │
 └─────────────┬─────────────┘ └─────────────┬─────────────┘
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │                  8. Archival Repository                │
 │          Searchable Document Database & Storage        │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                9. RAG Search & AI Q&A                  │
 │      Semantic Retrieval & Page Citation Assistant      │
 └────────────────────────────────────────────────────────┘
```

---

## 🔑 Platform User Profiles & Credentials

The platform includes simulated Enterprise Authentication with pre-configured default credentials for testing and demo evaluation:

| User Profile | Email | Password | Role | Organization |
|---|---|---|---|---|
| **Abhishek Yadav** (Default Admin) | `abhishek7y2@gmail.com` | `password123` | Organization Admin | Acme Corporation |
| **Rahul Sharma** | `rahul7y2@gmail.com` | `password123` | Senior Reviewer | Acme Corporation |
| **Priya Mehta** | `priya7y2@gmail.com` | `password123` | Compliance Approver | Acme Corporation |
| **Neha Verma** | `neha7y2@gmail.com` | `password123` | Document Viewer | Acme Corporation |
| **Arjun Kapoor** | `arjun7y2@gmail.com` | `password123` | Reader / Auditor | Acme Corporation |
| **Karan Malhotra** | `karan7y2@gmail.com` | `password123` | Contributor | Acme Corporation |

---

## 🧩 Deep Module-by-Module Feature Breakdown

### 1. Authentication & Security (`/login`)
- **Location:** `src/app/features/auth/login/`
- **Features:**
  - Responsive enterprise login form with toggleable password visibility.
  - Client-side validation for email formats and password lengths.
  - Interactive **Demo Credentials Hint Card** displayed on screen for immediate testing.
  - Persistent login token simulation stored via `localStorage`/`sessionStorage`.
  - Secured via Angular `authGuard` restricting unauthenticated navigation.

### 2. Executive Overview Dashboard (`/dashboard`)
- **Location:** `src/app/features/dashboard/`
- **Features:**
  - Personal greeting header (`Good morning, Abhishek 👋`).
  - Key Performance Indicator (KPI) metrics: Total Documents Ingested, In Review, Pending Approval, and OCR Accuracy Rate (96.4%).
  - Visual Funnel Status Bar displaying document distribution across stages (`DRAFT`, `PROCESSING`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`).
  - Quick upload trigger button leading directly to the intake pipeline.

### 3. Document Intake & Ingestion (`/intake`)
- **Location:** `src/app/features/intake/`
- **Features:**
  - Drag-and-Drop upload area supporting single or multi-file PDF, PNG, JPG uploads.
  - Document metadata pre-selection (Document Category, Reference Number, Description).
  - Live upload progress animation simulating multi-phase processing stages.
  - Recent uploads activity log with status badges and timestamps.

### 4. Central Document Repository (`/documents`)
- **Location:** `src/app/features/documents/`
- **Features:**
  - Comprehensive filterable document list with instant search and category filtering.
  - Status badges (`APPROVED`, `UNDER_REVIEW`, `DRAFT`, `REJECTED`).
  - Document metadata cards displaying file size, owner name, page count, and upload date.
  - Quick action contextual actions (View Details, Download Original, Delete).

### 5. Document Detail & Version Engine (`/documents/:id`)
- **Location:** `src/app/features/document-detail/`
- **Features:**
  - **Dual-Pane Interface:** Left side features interactive document viewer with zoom controls, page switching, and full-screen view. Right side features extracted metadata.
  - **Confidence Highlighting:** Visual color tags green ($\ge 90\%$), yellow ($70\% - 89\%$), red ($< 70\%$) for OCR extracted fields.
  - **Version History & Diff Viewer:** Side-by-side comparison of document versions (`v1.0`, `v2.0`, `v3.0`), highlighting edited fields and revision notes.
  - **Audit Log:** Complete timeline of document changes, reviewers, and approval timestamps.

### 6. Human-in-the-Loop Review Queue (`/review`)
- **Location:** `src/app/features/review/`
- **Features:**
  - List of documents requiring manual verification due to low OCR confidence or field validation flags.
  - Inline data editor allowing reviewers to override or confirm OCR-extracted field values.
  - Batch confirmation action triggering automatic routing to the approval queue.

### 7. Multi-Tier Approvals Workflow (`/approvals`)
- **Location:** `src/app/features/approvals/`
- **Features:**
  - Managerial review board for pending high-value documents (e.g. contracts, invoices above thresholds).
  - Document details overview with approval action buttons (**Approve**, **Request Revision**, **Reject**).
  - Comment box integration for audit trail logging during approval or rejection.

### 8. Hybrid & Metadata Search (`/search`)
- **Location:** `src/app/features/search/`
- **Features:**
  - Full-text search combined with structured metadata filters (Category, Status, Owner, Date Range, Confidence Score).
  - Search result previews highlighting matching text snippets within documents.
  - Fast clearing and filter resetting capabilities.

### 9. AI RAG Question Answering (`/qa`)
- **Location:** `src/app/features/qa/`
- **Features:**
  - Conversational AI Assistant for querying document repository content.
  - Pre-built suggested questions (e.g., *"What is the renewal period?"*, *"When does this contract expire?"*).
  - Rich chat interface with message bubbles, typing indicators, and exact document page citations.

### 10. User Task Board (`/tasks`)
- **Location:** `src/app/features/tasks/`
- **Features:**
  - Task management board assigned to the logged-in user (**Abhishek Yadav**).
  - Priority badges (`High`, `Medium`, `Low`), Status flags (`Pending`, `In Progress`, `Completed`, `Overdue`).
  - Side drawer detail panel displaying task requirements, linked document links, and completion actions.

### 11. Administration & Governance (`/admin`)
- **Location:** `src/app/features/admin/admin.ts`
- **Features:**
  - **User Management Tab:** Add, view, edit system users and roles.
  - **OCR & Model Configuration Tab:** Tweak confidence threshold sliders, select default LLM models (e.g. GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro).
  - **Workflow Rules Tab:** Toggle automated classification, mandatory review triggers, and auto-approval thresholds.

---

## 📁 Project Folder Hierarchy

```text
document-intelligence-ui/
├── .editorconfig
├── .gitignore
├── .prettierrc
├── README.md
├── angular.json
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.spec.json
└── src/
    ├── main.ts
    ├── main.server.ts
    ├── server.ts
    ├── styles.scss
    ├── index.html
    └── app/
        ├── app.config.ts
        ├── app.config.server.ts
        ├── app.routes.ts
        ├── app.routes.server.ts
        ├── app.ts
        ├── app.html
        ├── app.scss
        ├── core/
        │   ├── guards/
        │   │   └── auth-guard.ts
        │   ├── models/
        │   │   └── auth.model.ts
        │   └── services/
        │       ├── auth.ts
        │       ├── auth.service.ts
        │       └── ui-state.ts
        ├── layout/
        │   ├── shell/
        │   │   ├── shell.ts
        │   │   ├── shell.html
        │   │   └── shell.scss
        │   ├── sidebar/
        │   │   ├── sidebar.ts
        │   │   ├── sidebar.html
        │   │   └── sidebar.scss
        │   └── topbar/
        │       ├── topbar.ts
        │       ├── topbar.html
        │       └── topbar.scss
        └── features/
            ├── admin/
            ├── approvals/
            ├── auth/
            │   └── login/
            ├── dashboard/
            ├── document-detail/
            ├── documents/
            ├── intake/
            ├── qa/
            ├── review/
            ├── search/
            └── tasks/
```

---

## ⚙️ Technical Stack & Architecture

- **Core Framework:** Angular 22 (Standalone Components Architecture)
- **State Management:** Angular Signals & Reactive Services (`AuthService`, `UiState`)
- **Routing:** Angular Router with Lazy-Loaded Component Routes & Auth Guard Protection
- **Styling:** Modular SCSS Architecture with Custom CSS Variables & Utility Classes
- **SSR/SSG Support:** Angular Server-Side Rendering (`@angular/ssr`) with Express integration
- **Form Handling:** Reactive & Template-Driven Forms with `FormsModule`

---

## 📦 Installation & Local Setup Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher (v22.15+ recommended)
- **NPM:** v10.0.0 or higher

### Step 1: Clone or Navigate to Directory
```bash
cd "c:\Users\Mobiloitte\3D Objects\document_intelligence_platform-main\document_intelligence_platform-main\document-intelligence-ui"
```

### Step 2: Install Project Dependencies
```bash
npm install
```

---

## 🚀 Running & Building the Application

### Start Development Server
```bash
npm start
```
*The application will launch on **`http://localhost:4200/`**.*

### Build Production Bundle
```bash
npm run build
```
*Build outputs static browser and SSR server bundles inside the `dist/document-intelligence-ui` directory.*

---

## 🎨 Design System & UI Aesthetics

- **Color Palette:** Curated modern corporate palette featuring deep navy tones (`#0f172a`), royal blue accents (`#2563eb`), slate borders, and vibrant state badges.
- **Typography:** Clean sans-serif hierarchy utilizing modern web typography for maximum legibility.
- **Micro-Animations:** Hover transitions, smooth modal drawers, progress loaders, and sidebar overlays.
- **Responsive Layout:** Responsive layout grid supporting desktop, tablet, and mobile viewing with collapsible navigation drawers.

---

## 🗺️ Future Production Backend Integration Roadmap

When connecting this frontend to a production backend service, recommended integrations include:

1. **OCR & Processing Microservice:** Fast-API / Python microservice using Tesseract, AWS Textract, or Azure AI Document Intelligence.
2. **LLM RAG Pipeline:** LangChain / LlamaIndex with Pgvector or Pinecone vector database for document Q&A.
3. **Database Architecture:** PostgreSQL for relational metadata, version history, user permissions, and audit logs.
4. **File Storage:** AWS S3, Azure Blob Storage, or Google Cloud Storage for original PDF and document renditions.
5. **Real-time Notifications:** WebSockets / Server-Sent Events (SSE) for live document status updates during batch intake.

---

© 2026 **DocIntel Platform**. Developed for Enterprise Document Intelligence.