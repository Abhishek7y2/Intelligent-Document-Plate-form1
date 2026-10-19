# DocuNexa Architecture Decision Records (ADR)

**Status:** APPROVED Baseline  
**Auditor / Architect:** Senior Software Architect  
**Primary Stack:** Angular 19 (Web & Admin), Native iOS (Swift/SwiftUI), Node.js (TypeScript), PostgreSQL 16 (`pgvector`)

---

## ADR-001: Backend Stack Standardization — Node.js (TypeScript)

### Context & Decision
The repository documentation contains references to both Node.js (Express/NestJS) and alternative microservices. To enforce architectural consistency, zero bloat, and maintainability across the enterprise stack:

- **Approved Decision:** The official, authoritative backend technology stack for DocuNexa is **Node.js (TypeScript v5.x)** running on **Node.js 22 LTS**.
- **Rationale:**
  1. Full end-to-end TypeScript type safety shared between Angular frontend DTOs and Node.js backend controllers.
  2. High throughput asynchronous IO handling document uploads, WebSocket streams, and background event queues.
  3. Single ecosystem for team velocity and standardized linting/testing pipelines.

---

## ADR-002: Primary Database — PostgreSQL 16 with `pgvector`

### Context & Decision
DocuNexa requires relational integrity for RBAC, document lifecycle transitions, multi-level approvals, audit logs, as well as unstructured JSON storage for OCR bounding boxes and vector embeddings for semantic QA search.

- **Approved Decision:** **PostgreSQL 16** is the single, primary enterprise database engine.
- **Key Extensions:**
  - `uuid-ossp`: For primary key generation.
  - `pgcrypto`: For SHA-256 HMAC cryptographic audit log sealing.
  - `pgvector`: For storing 1536-dimensional AI text embeddings and performing fast vector similarity search ($HNSW$ indexes).
  - Native `JSONB`: For storing OCR page layouts and bounding box coordinates ($[x, y, w, h]$).
- **Rationale:** Prevents multi-database operational overhead by leveraging PostgreSQL's proven native support for relational, document (JSONB), and vector data in a single ACID-compliant engine.

---

## ADR-003: Mobile Strategy — Native iOS Application (Swift & SwiftUI)

### Context & Decision
- **Approved Decision:** The mobile solution is a native **iOS Application** written in **Swift 5.10 / SwiftUI** with Combine framework for reactive state.
- **Scope:** On-the-go review approvals, push notification alerts for SLA breaches, and secure biometric authentication (FaceID/TouchID).

---

## ADR-004: Frontend Architecture — Angular 19 Standalone Components

### Context & Decision
- **Approved Decision:** Web portal and Admin panel are unified within the Angular 19 application monorepo (`document-intelligence-ui`) utilizing **Standalone Components**, **Signals state management**, **SCSS design tokens (`#4f46e5`)**, and **Angular SSR** for fast initial load.
