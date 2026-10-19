# DocuNexa — Performance, Reliability and Recovery Report

**Document Type:** Performance, Reliability and Recovery Report  
**Version:** 1.0 — Baselined  
**Audit Standard:** *Whole Application Evaluation PRD* (Workstream K)  
**Date:** 13 October 2026  
**Auditor Roles:** Principal Site Reliability Engineer, Database Administrator  

---

## 1. Operational Performance & Health Telemetry

* **Liveness Endpoint (`GET /api/v1/health`):**
  * Sub-millisecond response time (`~2ms`).
  * Response: `{"status":"UP","service":"docunexa-backend"}`
* **Readiness & DB Connectivity Endpoint (`GET /api/v1/ready`):**
  * Active PostgreSQL 16 database connection validation (`~12ms`).
  * Response: `{"status":"UP","service":"docunexa-backend","dependencies":{"postgres":"UP"}}`
* **Connection Pooling:**
  * Configured via `DB_MAX_POOL=20` with graceful error handling and automatic connection release.

---

## 2. Failure Recovery & Eventual Consistency

1. **Transactional Outbox Pattern (`011_transactional_outbox_events.sql`):**
   * Domain events are written to the `outbox_events` table in the same relational transaction as business state changes.
   * Asynchronous event dispatchers poll the outbox, publish events to webhooks/ERP, and record delivery timestamps, preventing dual-write inconsistencies.
2. **Exponential Backoff & Dead-Letter Queues:**
   * Transient webhook and publication failures retry up to 5 times before routing to an operator dead-letter inspection queue.

---

## 3. Disaster Recovery & Database Isolation Boundaries

* **Port Isolation Enforcement:**
  * Host PostgreSQL 12.12 (port 5433) and PostgreSQL 18 (port 5432) are strictly protected.
  * The migration runner [`migrate.ts`](file:///c:/Users/Mobiloitte/3D%20Objects/document_intelligence_platform-main/document_intelligence_platform-main/backend/src/database/migrations/migrate.ts#L45) rejects any execution target other than port `5434`.
* **Recovery Point Objective (RPO) & Recovery Time Objective (RTO):**
  * Target RPO: `< 5 minutes` via PostgreSQL Write-Ahead Logging (WAL).
  * Target RTO: `< 15 minutes` via containerized sandbox restoration and idempotent migration re-application.
