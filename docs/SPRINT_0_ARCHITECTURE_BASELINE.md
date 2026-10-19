# DocuNexa Sprint 0 Architecture Baseline

**Module:** Task S0-02 Architecture & Technology Standardization  
**Baseline Stack:** Node.js 22 LTS (TypeScript v5) | PostgreSQL 16 (`pgvector`) | Angular 19 | Native iOS (Swift)  

---

## 1. System Module Boundaries & Layers

```
[ Client Layer ]              Angular 19 Web Portal & Native iOS App
                                       │
                                       ▼ (HTTPS REST / Bearer JWT)
[ API Gateway Tier ]          Express / Node.js API Service (backend/src/app.ts)
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
              [ Domain Controllers ]        [ Security & Auth ]
              (Doc, Review, Reports)        (JWT, RBAC, Rate Limit)
                        │                             │
                        └──────────────┬──────────────┘
                                       ▼
[ Persistence Tier ]          PostgreSQL 16 Database Pool (pgvector, JSONB, SHA-256)
```

---

## 2. Core Operational Rules

1. **Transactional Truth:** PostgreSQL owns all workflow states, tenant boundaries, user memberships, and approved field values.
2. **Derived Data Policy:** OCR layout polygons, full-text indexes, and vector embeddings are derived, rebuildable, and cannot alter approval status autonomously.
3. **Graceful Degradation:** External AI provider outages must leave file intake, human verification, and approval workflows functional.
