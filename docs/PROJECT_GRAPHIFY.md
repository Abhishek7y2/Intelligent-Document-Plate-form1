# DocuNexa Platform — Project Graphify & Process Diagrams

This document contains visual diagrams, state machines, architecture graphs, and execution workflows for the **DocuNexa Document Intelligence Platform**, generated using standard Mermaid graph syntax.

---

## 1. End-to-End Document Ingestion & Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Ingested: Upload / API / Email
    
    Ingested --> PreflightValidation: OCR Quality Check
    
    state PreflightValidation {
        [*] --> CheckDPI
        CheckDPI --> LowDPIDetected: DPI < 150
        CheckDPI --> ValidFormat: DPI >= 150
    }
    
    LowDPIDetected --> Quarantined: Failed Pre-Flight
    Quarantined --> PreflightValidation: Retry OCR / Deskew
    Quarantined --> HITLReviewQueue: Manual HITL Override
    
    ValidFormat --> AutomatedExtraction: OCR & Text Bounding
    
    state AutomatedExtraction {
        [*] --> FieldExtraction
        FieldExtraction --> LineItemMathCheck
        LineItemMathCheck --> ConfidenceScoring
    }
    
    ConfidenceScoring --> ReadyForReview: Needs Verification
    ConfidenceScoring --> AutoApproved: Confidence >= 95% & Math Match
    
    ReadyForReview --> HITLReviewQueue: Enqueue for Reviewer
    HITLReviewQueue --> InReview: Reviewer Claims Task
    
    state InReview {
        [*] --> BoundingBoxInspection
        BoundingBoxInspection --> ArithmeticCorrection
        ArithmeticCorrection --> FieldApproval
    }
    
    InReview --> FlaggedForRework: Discrepancy Found
    FlaggedForRework --> InReview: Re-review
    
    InReview --> PendingApproval: Review Completed
    
    state PendingApproval {
        [*] --> SoDVerification
        SoDVerification --> ApprovalBlocked: Submitter == Approver
        SoDVerification --> ApprovalAllowed: Submitter != Approver
    }
    
    ApprovalAllowed --> Approved: Approver Confirms
    ApprovalAllowed --> Rejected: Rejection Code Logged
    
    Approved --> ERPIntegration: Webhook Dispatched
    ERPIntegration --> Locked: Archived & Cryptographically Sealed
    Locked --> [*]
```

---

## 2. Frontend Routing Topology & SPA Navigation Graph

```mermaid
graph TD
    Root["/ (App Root)"] --> AuthCheck{"Authenticated?"}
    
    AuthCheck -- "No" --> Login["/login (SCR-01 Enterprise SSO & Login)"]
    Login --> VerifyEmail["/verify-email (6-Digit OTP Recovery)"]
    
    AuthCheck -- "Yes" --> Shell["App Shell (Sidebar + Topbar)"]
    
    Shell --> Dashboard["/dashboard (SCR-02 Operations Dashboard)"]
    Shell --> Intake["/intake (SCR-03 Ingestion & Quarantine Studio)"]
    Shell --> Documents["/documents (SCR-04 Document Repository)"]
    Shell --> Review["/review (SCR-06 Review Queue)"]
    Shell --> Compare["/compare (SCR-08 Version Compare Studio)"]
    Shell --> Approvals["/approvals (SCR-09 Approval Center)"]
    Shell --> Tasks["/tasks (SCR-10 Reviewer Worklist)"]
    Shell --> Search["/search (SCR-11 Semantic & Hybrid Search)"]
    Shell --> QA["/qa (SCR-12 Grounded AI Q&A Assistant)"]
    Shell --> Admin["/admin (SCR-13 & 14 RBAC & Governance)"]
    
    Documents --> DocDetail["/documents/:id (SCR-05 Multi-Page Viewer & Audit)"]
    DocDetail -.-> CompareParam["/compare/:id (Deep-linked Compare)"]
    
    Review --> ReviewWorkbench["/review/:id (SCR-06 & 07 Split-Screen Workbench)"]
    Tasks --> ReviewWorkbench
    
    Compare --> CompareParam
```

---

## 3. Compare Studio Architecture & Semantic Diff Flow (Task 7D BRD)

```mermaid
flowchart TB
    subgraph InputDocuments["Input Versions"]
        DocV1["Baseline Document (v1.0)<br/>Page Citations & Clauses"]
        DocV2["Amendment Document (v2.0)<br/>Page Citations & Clauses"]
    end

    subgraph DiffEngine["DocuNexa Semantic Diff Engine"]
        Alignment["Clause Alignment Engine<br/>Header & Semantic Embedding Match"]
        TokenDiff["Token & Character Redline Parser<br/>ADDED, REMOVED, MODIFIED, UNCHANGED"]
        AIRisk["AI Legal Risk Classifier<br/>High / Medium / Low Exposure"]
        AIPlainEnglish["Plain-English Translation Engine<br/>Business Impact & Counsel Advice"]
        AIFallback["Balanced Fallback Generator<br/>Enterprise Compromise Clause"]
    end

    subgraph StudioUI["Compare Studio (SCR-08 Layout)"]
        KpiStrip["Compact 46px Metric Strip<br/>Total Clauses | Added | Modified | High Risk"]
        ClauseNav["Left Column (310px)<br/>Clause Directory & Sticky Navigator"]
        Stage["Right Column Comparison Stage<br/>Row 1: Clause Identity & Risk<br/>Row 2: Stepper & Action Buttons"]
        ShiftSummary["Executive Shift Summary Box<br/>v1.0 Baseline ➔ Delta ➔ v2.0 Amendment"]
        IntelBox["AI Plain-English Impact & Action Advice"]
        FallbackBox["AI Counter-Proposal Box<br/>1-Click Clipboard Copy"]
        RedlinePanes["Synchronized Redline Panes<br/>Split View (50/50) | Unified Manuscript"]
        FooterBar["Integrity Bar<br/>SHA-256 Hash | Reading Aid Legal Disclaimer"]
    end

    InputDocuments --> Alignment
    Alignment --> TokenDiff
    Alignment --> AIRisk
    TokenDiff --> AIPlainEnglish
    AIRisk --> AIFallback
    
    TokenDiff --> KpiStrip
    Alignment --> ClauseNav
    TokenDiff --> Stage
    AIPlainEnglish --> ShiftSummary
    AIPlainEnglish --> IntelBox
    AIFallback --> FallbackBox
    TokenDiff --> RedlinePanes
    Alignment --> FooterBar
```

---

## 4. HITL Review Workbench & Coordinate Projection Graph (SCR-06 & SCR-07)

```mermaid
sequenceDiagram
    autonumber
    actor Reviewer as Human Reviewer
    participant Canvas as Left Pane: Document Canvas (SVG)
    participant Engine as Arithmetic Math Engine
    participant Form as Right Pane: Extracted Form & Line Items
    participant Audit as Audit Trail Logger

    Reviewer->>Form: Focuses Extracted Field (e.g., Grand Total)
    Form->>Canvas: Dispatches Field Coordinates [x, y, w, h]
    Canvas->>Canvas: Highlights Bounding Box with Indigo Halo & Scrolls
    
    Reviewer->>Form: Edits Line Item Qty or Unit Price
    Form->>Engine: Triggers Recalculation Event
    Engine->>Engine: Re-computes: Sum(Qty * Rate) + Tax (18%)
    
    alt Discrepancy > ₹0.01 Detected
        Engine->>Form: Displays Math Discrepancy Alert Banner
        Reviewer->>Form: Clicks 'Apply Calculated Math'
        Form->>Form: Updates Grand Total with Reconciled Value
    else Math Matches OCR Total
        Engine->>Form: Displays Green Verified Arithmetic Badge
    end

    Reviewer->>Form: Clicks 'Mark Field Verified'
    Form->>Audit: Records Verified Field with Timestamp & User ID
    Form->>Canvas: Removes Edit Indicator, Sets Status Green
```

---

## 5. Separation of Duties (SoD) & Multi-Stage Approval Decision Graph

```mermaid
flowchart TD
    StartApproval["Review Completed Document Submitted for Approval"] --> FetchUser["Fetch Authenticated User & Document Metadata"]
    
    FetchUser --> CheckSubmitter{"Is Authenticated User == Document Submitter?"}
    
    CheckSubmitter -- "YES" --> CheckRole{"Is User Super Admin?"}
    CheckRole -- "NO" --> BlockApproval["🛡️ SoD Violation Triggered<br/>'Approve' Button Disabled<br/>Display '🛡️ SoD Protected' Badge"]
    CheckRole -- "YES" --> AllowSuperAdmin["Super Admin Override Permitted<br/>Mandatory Audit Justification Required"]
    
    CheckSubmitter -- "NO" --> AllowStandard["Approver Eligible<br/>'Approve' and 'Reject' Buttons Enabled"]
    
    AllowStandard --> UserAction{"Approver Decision"}
    AllowSuperAdmin --> UserAction
    
    UserAction -- "Approve" --> AdvancePipeline["Advance Pipeline Stepper:<br/>Intake ➔ HITL Review ➔ Finance Approval ➔ ERP Lock"]
    AdvancePipeline --> DispatchERP["Trigger Outbound ERP Webhook"]
    
    UserAction -- "Reject" --> OpenRejectionModal["Open Rejection Modal<br/>Require Standardized Reason Code:<br/>ERR-MATH-01 / ERR-CONTRACT-02 / ERR-EXPIRED-PO / ERR-TAX-04"]
    OpenRejectionModal --> LogAudit["Commit Immutable Audit Event with Reason Code"]
    LogAudit --> ReopenTask["Reopen Document in Reviewer Task Queue"]
```

---

## 6. Frontend Component Architecture & Dependency Graph

```mermaid
graph LR
    subgraph CoreModule["Core Layer"]
        AuthService["AuthService<br/>(SSO & Session)"]
        DocumentService["DocumentService<br/>(Repository & Storage)"]
        NotificationService["NotificationService<br/>(Toasts & Alerts)"]
        ExportService["ExportService<br/>(CSV/JSON/PDF)"]
    end

    subgraph SharedModule["Shared UI Primitives"]
        AppHeader["HeaderComponent<br/>(User Menu & Roles)"]
        AppSidebar["SidebarComponent<br/>(Navigation Links)"]
        BadgeComponent["StatusBadgeComponent<br/>(Risk & Stage)"]
        ModalComponent["EnterpriseModalComponent<br/>(Exports & Reject)"]
    end

    subgraph FeatureComponents["Feature Views"]
        DashboardView["DashboardComponent (SCR-02)"]
        IntakeView["IntakeComponent (SCR-03)"]
        DocumentsView["DocumentsComponent (SCR-04)"]
        DocDetailView["DocumentDetailComponent (SCR-05)"]
        ReviewWorkbenchView["ReviewWorkbenchComponent (SCR-06/07)"]
        CompareStudioView["CompareStudioComponent (SCR-08)"]
        ApprovalsView["ApprovalsComponent (SCR-09)"]
        TasksView["TasksComponent (SCR-10)"]
        SearchView["SearchComponent (SCR-11)"]
        QAView["QAComponent (SCR-12)"]
        AdminView["AdminComponent (SCR-13/14)"]
    end

    AuthService --> DashboardView
    AuthService --> ApprovalsView
    DocumentService --> DocumentsView
    DocumentService --> ReviewWorkbenchView
    DocumentService --> CompareStudioView
    ExportService --> DocumentsView
    ExportService --> CompareStudioView
    
    AppHeader --> DashboardView
    AppHeader --> DocumentsView
    AppSidebar --> DashboardView
    BadgeComponent --> ReviewWorkbenchView
    BadgeComponent --> CompareStudioView
    ModalComponent --> DocumentsView
    ModalComponent --> ApprovalsView
```

---

## 7. Scoped Export & PII Masking Security Flow

```mermaid
flowchart TD
    TriggerExport["User Clicks 'Export Documents' in Repository (SCR-04)"] --> OpenModal["Open Scoped Export Studio Modal"]
    
    OpenModal --> SelectFormat["Select Export Format: CSV | JSON | Audit PDF"]
    SelectFormat --> ConfigureFilters["Select Scope: All / Selected / Filtered"]
    
    ConfigureFilters --> CheckToggles{"Compliance Masking Toggles"}
    
    CheckToggles --> PIIOption["PII Masking Toggle<br/>Redact Names, Emails, Phone Numbers"]
    CheckToggles --> FinOption["Financial Masking Toggle<br/>Obfuscate Bank Accounts, Tax IDs, Rates"]
    
    PIIOption --> SanitizerEngine["DocuNexa Data Sanitization Engine"]
    FinOption --> SanitizerEngine
    
    SanitizerEngine --> GeneratePayload["Build Sanitized File Buffer"]
    GeneratePayload --> ComputeHash["Compute SHA-256 Export Checksum"]
    ComputeHash --> DownloadFile["Trigger Browser File Download"]
    ComputeHash --> AuditLog["Append Export Event to Audit Log"]
```

---

## 8. AI Groundedness Guardrail (AI-004) Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Enterprise Operator
    participant QA as Grounded Q&A Assistant (SCR-12)
    participant VectorStore as Document Knowledge Index
    participant Guardrail as AI-004 Groundedness Validator
    participant LLM as Legal AI Reasoning Model

    User->>QA: Submits Query: "What is the penalty for delayed delivery?"
    QA->>VectorStore: Performs Semantic Chunk Retrieval
    VectorStore-->>QA: Returns Top Relevant Paragraphs with Page Citations
    
    QA->>Guardrail: Evaluates Context Relevance & Confidence
    
    alt Context Found (Confidence >= 0.85)
        Guardrail->>LLM: Dispatches Prompt with Document Context Chunks
        LLM-->>QA: Formulates Structured Answer with Page Citations
        QA-->>User: Displays Response with Clickable Anchors: [Page 2, Para 4]
    else Context Missing / Out-of-Domain
        Guardrail-->>QA: Flags AI-004 Groundedness Failure
        QA-->>User: Displays Guardrail Notice: "Information not found in indexed documents."
    end
```
