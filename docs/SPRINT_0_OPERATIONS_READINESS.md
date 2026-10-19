# DocuNexa Sprint 0 Operations & Observability Readiness

**Module:** Task S0-08 Observability & Operational Readiness  

---

## 1. Operational Infrastructure Summary

- **Health Endpoints:**
  - `GET /api/v1/health`: Returns HTTP 200 `UP` for liveness.
  - `GET /api/v1/ready`: Performs live dependency checks against PostgreSQL.
- **Request Tracing:**
  - `X-Correlation-ID` header injected on every HTTP request and propagated to log records.
- **Graceful Shutdown:**
  - Process listens to `SIGTERM` and `SIGINT` signals, closing the PostgreSQL pool before exiting.
