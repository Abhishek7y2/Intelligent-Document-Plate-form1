# 05. Non-Functional Requirements (NFRs)

## Overview
This document specifies the enterprise quality attributes, architectural constraints, security benchmarks, performance SLAs, and regulatory compliance standards for the DocuNexa platform.

---

## 1. Performance & Latency SLAs

| Metric | Target SLA | 95th Percentile (P95) | 99th Percentile (P99) | Measurement Method |
| :--- | :--- | :--- | :--- | :--- |
| **API Response Time** (Read/Metadata) | $le 120$ ms | $le 250$ ms | $le 500$ ms | Prometheus HTTP duration metric |
| **Document Upload Pre-flight** (50MB) | $le 2.5$ s | $le 4.0$ s | $le 6.0$ s | Ingestion gateway ingress clock |
| **OCR & Extraction Pipeline** (Per Page) | $le 1.4$ s | $le 2.2$ s | $le 3.5$ s | BullMQ task start to finish |
| **Full Document Processing** (10-Page Invoice) | $le 12$ s | $le 18$ s | $le 25$ s | End-to-end async job completion |
| **Full-Text & Vector Search Query** | $le 200$ ms | $le 350$ ms | $le 750$ ms | PostgreSQL pgvector index benchmark |
| **UI Initial Paint (FCP)** | $le 0.8$ s | $le 1.2$ s | $le 1.8$ s | Lighthouse Web Vitals |

---

## 2. Scalability & Throughput
* **Ingestion Concurrency**: System must sustain 50 concurrent file uploads per tenant node without degradation.
* **Throughput Capacity**: Capable of processing 250,000 document pages per 24-hour window across a standard 4-worker cluster.
* **Horizontal Autoscaling**: Worker pods autoscale based on queue depth ($>50$ pending jobs triggers worker pod scaling).
* **Database Volume**: Designed to handle 50 million document records and 500 million extracted entities with table partitioning.

---

## 3. High Availability & Resilience
* **Uptime Guarantee**: $99.9%$ uptime excluding scheduled maintenance (under 43.8 minutes downtime/month).
* **Recovery Time Objective (RTO)**: $le 1$ hour in the event of primary zone failure.
* **Recovery Point Objective (RPO)**: $le 15$ minutes with asynchronous PostgreSQL replication and WAL streaming.
* **Fault Isolation**: Pipeline worker failures do not crash the REST API gateway; failed document jobs automatically retry up to 3 times before dead-letter routing.

---

## 4. Security & Cryptographic Controls
* **Data in Transit**: Mandatory TLS 1.3 encryption across all public and internal service communications; HSTS enforced with 1-year max-age.
* **Data at Rest**: AES-256 encryption on all object storage buckets; transparent data encryption (TDE) on PostgreSQL database volumes.
* **Authentication**: JWT tokens signed with RS256; short-lived access tokens (15 minutes) with rotating refresh tokens stored in HttpOnly secure cookies.
* **Access Control**: Strict multi-tenant isolation enforced via PostgreSQL Row-Level Security (RLS) and organization context middleware.
* **Separation of Duties (SoD)**: Enforced via cryptographic validation—no user may approve a document they uploaded or reviewed.

---

## 5. Regulatory Compliance & Data Governance
* **SOC 2 Type II**: Immutable audit logs capturing every record view, export, modification, and approval.
* **GDPR & CCPA**: Right-to-be-forgotten handled via Cryptographic Secure Purge with downloadable deletion certificates.
* **HIPAA**: Automatic PII/PHI redaction capabilities for sensitive health and identity fields.
* **Litigation Readiness**: Legal Hold mechanism overrides automated purge rules and prevents record modification or destruction.

---

## 6. Accessibility & Usability (WCAG 2.1 AA)
* Color contrast ratio $ge 4.5:1$ for normal text and $ge 3:1$ for large text across light and dark themes.
* Full keyboard navigability in the HITL Review Workbench: `Tab` for next field, `Enter` to confirm, `Esc` to cancel.
* Accessible ARIA landmarks, screen-reader status alerts, and focus trap management on all modals.
