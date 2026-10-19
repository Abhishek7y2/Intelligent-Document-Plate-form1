# System Architecture Specification — DocuNexa

## High-Level Topology
DocuNexa is architected as an enterprise-grade, distributed, cloud-native Document Intelligence Platform. It features a modern decoupled topology separating real-time user-facing gateways from asynchronous, compute-heavy AI extraction pipelines.

```mermaid
graph TD
    Client[Web Browser / iOS App / REST API Client] --> WAF[Cloudflare / AWS WAF]
    WAF --> Ingress[NGINX Ingress Gateway / TLS 1.3]
    
    subgraph CoreServices ["Core Application Plane"]
        Ingress --> WebApp[Angular 19 Standalone UI]
        Ingress --> ApiGateway[Node.js / Express API Gateway]
        ApiGateway --> AuthService[Authentication & RBAC Service]
        ApiGateway --> DocService[Document Lifecycle Service]
        ApiGateway --> AdminService[Admin & Governance Service]
        ApiGateway --> SearchService[Hybrid Search & Q&A Service]
    end

    subgraph StoragePlane ["Data & Storage Plane"]
        DocService --> S3[(Encrypted Object Storage S3 / MinIO)]
        DocService --> DB[(PostgreSQL 16 + pgvector)]
        AuthService --> DB
        SearchService --> DB
        AdminService --> DB
        ApiGateway --> Redis[(Redis 7 Cluster: Cache & Queues)]
    end

    subgraph AsyncWorkerPlane ["AI Ingestion & Worker Plane (BullMQ)"]
        Redis --> Worker1[OCR & Preprocessing Worker]
        Redis --> Worker2[LayoutLMv3 Entity Extraction Worker]
        Redis --> Worker3[Invoice Math & Rules Worker]
        Redis --> Worker4[Embedding & Indexing Worker]
        Worker1 --> S3
        Worker2 --> DB
        Worker3 --> DB
        Worker4 --> DB
    end
```

---

## Architectural Principles
1. **Decoupled Asynchronous Processing**: Time-consuming OCR and deep learning models are decoupled via Redis-backed BullMQ queues to ensure zero UI thread blocking and sub-150ms HTTP API responses.
2. **Stateless Service Layer**: All backend services are completely stateless, allowing frictionless horizontal auto-scaling based on CPU load and queue depth.
3. **Defense-in-Depth Security**: Strict multi-tenant isolation, database row-level security (RLS), signed short-lived S3 URLs, and cryptographic audit trails.
4. **Resilient Event-Driven Communication**: Services emit domain events (e.g., `DOCUMENT_UPLOADED`, `OCR_COMPLETED`, `REVIEW_SUBMITTED`, `DOCUMENT_APPROVED`) enabling modular plug-and-play integrations.
