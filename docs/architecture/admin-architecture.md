# Admin Architecture & Multi-Tenant Governance

## Administrative Subsystems
The Admin Studio provides centralized operational control across tenants, policies, and system reliability:

```mermaid
mindmap
  root((Admin Studio))
    Tenant Management
      Organization Profiles
      Resource Quotas
      Custom Domain Routing
    Role-Based Access
      6 Pre-built Roles
      Granular Permissions
      Maker-Checker SoD
    Lifecycle Governance
      Retention Policies
      Litigation Legal Holds
      Cryptographic Purge
    Security & Observability
      Tamper-Evident Audit Logs
      API Key Management
      Webhook Subscriptions
```

---

## Multi-Tenancy Isolation Model
* **Shared Process, Isolated Data**: All tenants share compute clusters while database rows are strictly isolated using `tenant_id` foreign keys combined with PostgreSQL Row-Level Security (RLS) policies.
* **Storage Isolation**: Object storage keys are structured as `s3://{bucket}/{tenant_id}/{document_id}/{filename}` with pre-signed URL validation.
