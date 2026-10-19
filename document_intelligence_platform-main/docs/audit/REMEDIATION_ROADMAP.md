# DocuNexa — Master Remediation Roadmap & Implementation Plan

**Audit Date:** 2026-10-13T13:13:00+05:30  
**Phase:** Post-Audit Production Remediation & Release Alignment  
**Standard:** Prioritized by Business Risk, Security Impact, and Operational Feasibility  

---

## 1. Prioritized Remediation Phases

```mermaid
graph TD
    subgraph "Phase 1: High Priority (Integration & DevOps)"
        P1A[REM-01: Wire Angular app.config.ts with HttpClient & Auth Interceptor]
        P1B[REM-02: Infrastructure Owner Provisions GitLab CI Secrets]
    end

    subgraph "Phase 2: Medium Priority (Cloud Deployment & Mobile)"
        P2A[REM-03: Trigger Remote Cloud Staging Pipeline & Run Live Smoke Tests]
        P2B[REM-04: Initialize Native iOS Project on macOS Runner]
    end

    subgraph "Phase 3: Lower Priority (Enterprise Connectors & Telemetry)"
        P3A[REM-05: Configure Live IMAP Polling Daemon]
        P3B[REM-06: Enterprise SAML 2.0 / IdP Federation Setup]
        P3C[REM-07: Synthetic Uptime Monitoring Calibration]
    end

    P1A --> P2A
    P1B --> P2A
    P2A --> P2B
    P2B --> P3A
    P3A --> P3B
    P3B --> P3C
```

---

## 2. Remediation Task Breakdown

### Phase 1: High Priority (Immediate Execution)

#### REM-01: Wire Angular Frontend to Live Backend APIs
- **Target Component:** [`document-intelligence-ui/src/app/app.config.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/app.config.ts)
- **Objective:** Bind `provideHttpClient(withInterceptors([authInterceptor, correlationInterceptor]))` in `appConfig.providers`. Provide the concrete `Http*Service` classes (`HttpReviewService`, `HttpApprovalService`, `HttpSearchService`, `HttpCompareService`, `HttpQaService`, `HttpReportService`, `HttpRetentionService`) for each `InjectionToken`.
- **Business Impact:** Unlocks real end-to-end browser-to-backend workflows across all 14 screens, eliminating reliance on dev mock fixtures.
- **Dependencies:** None (all `Http*Service` classes and tests are already implemented and passing).
- **Owner:** Frontend Lead.
- **Estimated Effort:** 1 Engineering Day.

#### REM-02: Infrastructure Owner Provisions GitLab CI/CD Variables
- **Target Component:** GitLab Project Settings (`Settings > CI/CD > Variables` for `root/abhishekyadav-docunexa-project`)
- **Objective:** Provision the required staging environment variables:
  - `KUBECONFIG` (or `STAGING_SSH_HOST` / `STAGING_SSH_KEY`)
  - `POSTGRES_HOST_STAGING`, `POSTGRES_PORT_STAGING`, `POSTGRES_DB_STAGING` (`docunexa_staging`)
  - `POSTGRES_USER_STAGING`, `POSTGRES_PASSWORD_STAGING`
  - `JWT_SECRET_STAGING`, `AUDIT_HMAC_SECRET_STAGING`
- **Business Impact:** Unblocks automated container deployment to the cloud staging cluster (`https://staging.docunexa.enterprise`).
- **Dependencies:** Access to Kubernetes cluster / cloud database instance.
- **Owner:** Infrastructure Owner / Lead DevOps Engineer.
- **Estimated Effort:** 0.5 Engineering Day.

---

### Phase 2: Medium Priority (Cloud Deployment & Mobile Track)

#### REM-03: Execute Cloud Staging Deployment & Live Cloud UAT
- **Target Component:** GitLab Pipeline `deploy-to-staging` & `https://staging.docunexa.enterprise`
- **Objective:** Trigger the manual deployment pipeline, verify container rollout and database migration `001` through `014`, and execute the 12 UAT scenarios against the live cloud domain.
- **Business Impact:** Confirms production-like cloud readiness with actual TLS termination, DNS ingress, and persistent cloud database.
- **Dependencies:** REM-02 completion.
- **Owner:** Release Engineer & QA Lead.
- **Estimated Effort:** 1-2 Engineering Days.

#### REM-04: Initialize Native iOS Xcode Workspace on macOS CI
- **Target Component:** `document_intelligence_ios/` & `.github/workflows/ci.yml`
- **Objective:** Generate the Xcode project scaffold on a macOS workstation or through the configured macOS-14 GitHub Actions runner (`ios-ci`), binding SwiftUI views to the `/api/v1/approvals` endpoints.
- **Business Impact:** Fulfills mobile approval requirements for executive sign-offs.
- **Dependencies:** macOS workstation or active GitHub Actions runner.
- **Owner:** iOS Engineer.
- **Estimated Effort:** 3-5 Engineering Days.

---

### Phase 3: Lower Priority (Enterprise Adapters & Telemetry)

#### REM-05: Deploy Live Inbound Email Polling Daemon
- **Target Component:** `backend/src/services/connector.service.ts`
- **Objective:** Implement a dedicated worker daemon using Node.js `node-imap` or AWS SES inbound listener to parse incoming MIME emails and route attachments to `/documents/upload`.
- **Business Impact:** Automates intake from monitored shared mailboxes (`invoices@company.com`).
- **Dependencies:** Mail server credentials (IMAP/POP3).
- **Owner:** Backend Engineer.
- **Estimated Effort:** 2 Engineering Days.

#### REM-06: Configure Enterprise SAML 2.0 / IdP Federation
- **Target Component:** `backend/src/services/auth.service.ts`
- **Objective:** Add Passport-SAML or OpenID Connect middleware to federate authentication with corporate Okta, Azure AD, or PingFederate instances.
- **Business Impact:** Streamlines enterprise customer onboarding with corporate SSO and MFA.
- **Dependencies:** Customer IdP metadata XML / client secrets.
- **Owner:** Security Engineer.
- **Estimated Effort:** 2 Engineering Days.

#### REM-07: Synthetic Uptime & SLA Monitoring Calibration
- **Target Component:** Datadog / Prometheus / CloudWatch Synthetics
- **Objective:** Deploy synthetic probes against `/api/v1/health` and `/api/v1/ready` to record monthly availability toward the 99.5% BRD SLA.
- **Business Impact:** Provides audit-ready uptime compliance reports.
- **Dependencies:** REM-03 cloud staging deployment.
- **Owner:** SRE / DevOps.
- **Estimated Effort:** 1 Engineering Day.

---

## 3. Executive Verdict & Release Gate Recommendation

### Master Verdict: **CONDITIONAL PASS**

1. **Backend & Architecture Engine:** **100% PRODUCTION READY** (440 passing tests, 14 safe migrations, 39 tables, strict tenant isolation, RFC 7807 problem details, zero critical vulnerabilities).
2. **Web Frontend UI:** **COMPREHENSIVE (14 screens built, 35 unit tests passing)**; pending global `app.config.ts` HttpClient wiring.
3. **Cloud Staging:** **BLOCKED ON CLUSTER CREDENTIALS** (Safe governance maintained; local sandbox not mislabeled as cloud staging).
4. **Immediate First Task:** Execute **REM-01** ([`app.config.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/document-intelligence-ui/src/app/app.config.ts) HttpClient wiring) followed by **REM-02** (GitLab secret provisioning).
