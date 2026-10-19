# Security Architecture Specification — Zero Trust

## Security Core Principles
DocuNexa implements a Defense-in-Depth, Zero-Trust security model across every layer of the technology stack:

```mermaid
graph TD
    Perimeter[Perimeter: Cloudflare WAF + DDoS Shield] --> Ingress[Ingress: TLS 1.3 / HSTS Strict]
    Ingress --> AppLayer[App Layer: JWT + RBAC + SoD Enforcement]
    AppLayer --> DataIsolation[Data Layer: PostgreSQL RLS + Tenant Isolation]
    DataIsolation --> StorageSecurity[Storage: AES-256 S3 Encryption + KMS]
    AppLayer --> AuditLayer[Compliance: Immutable SHA-256 Audit Trail]
```

---

## Cryptographic Controls
* **Separation of Duties (SoD)**: Cryptographically verified maker-checker controls prevent transaction fraud.
* **Legal Hold Lock**: Immutable flag preventing data deletion or modification across all APIs.
* **Secure Purge**: Department of Defense (DoD 5220.22-M) compliant cryptographic data sanitization producing verifiable audit certificates.
