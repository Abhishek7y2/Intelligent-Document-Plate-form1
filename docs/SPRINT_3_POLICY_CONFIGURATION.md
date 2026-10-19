# DocuNexa Sprint 3 — Policy Configuration & Deterministic Evaluator

## 1. Overview and BRD Alignment

The **Policy Configuration Engine** governs automated document decisioning, validation gates, routing to human review, and compliance verification.

- **BRD Reference:** Section 4.3 (Processing Policies & Validation Rules), Section 7 (Human-in-the-Loop & Approval Routing).
- **Core Entities:** `processing_policies` table, `PolicyRule`, `PolicyEvaluator`, `PolicyEvaluationResult`.

---

## 2. Deterministic Rule Evaluator (Zero-Eval Architecture)

Security regulations forbid arbitrary code execution (such as `eval()`, `new Function()`, or dynamic scripting). DocuNexa implements an enterprise deterministic rule evaluator with typed operators and safe operand parsing.

### Supported Operators

| Operator | Operands | Description |
|---|---|---|
| `eq` | Field, Target | Exact equality (case-sensitive or numeric equivalence) |
| `neq` | Field, Target | Inequality |
| `gt` | Field, Target Number | Numeric strictly greater than |
| `gte` | Field, Target Number | Numeric greater than or equal to |
| `lt` | Field, Target Number | Numeric strictly less than |
| `lte` | Field, Target Number | Numeric less than or equal to |
| `contains` | Field, Substring | String contains substring (case-insensitive) |
| `in` | Field, Array | Field value exists within the allowed array |
| `regex_match` | Field, Pattern | String matches validated regular expression |
| `is_not_empty` | Field | Field value is present and non-blank/non-null |

### Rule Actions
When a rule condition evaluates to `true`, it triggers an action:
- `require_review`: Document cannot be auto-published; routed to human review queue.
- `flag_warning`: Informational warning attached to extraction payload; auto-publish permitted if no errors exist.
- `reject`: Document is rejected immediately due to critical policy violation.
- `approve`: Document passes validation gate.

---

## 3. Seeded MVP Policies

DocuNexa seeds default policies corresponding to the three MVP document types:

1. **Purchase Invoice Policy (`POL-INVOICE-001`):**
   - Rule 1: High Total Review Gate — Invoices with `total_amount > 10000` trigger `require_review` (Segregation of Duties threshold).
   - Rule 2: Mandatory Invoice Number — `invoice_number` must satisfy `is_not_empty`, or trigger `reject`.
2. **Supplier Contract Policy (`POL-CONTRACT-001`):**
   - Rule 1: Mandatory Parties — `contract_title` must satisfy `is_not_empty`, or trigger `require_review`.
3. **Internal Policy Governance (`POL-INTERNAL-001`):**
   - Rule 1: Classification Check — Requires valid classification level.

---

## 4. Policy Evaluation API

DocuNexa provides an offline evaluation endpoint to simulate and test policy rules against synthetic payloads before activation:

```http
POST /api/v1/policies/:id/evaluate
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "documentData": {
    "invoice_number": "INV-2026-001",
    "total_amount": 15420.50,
    "vendor_name": "Acme Industrial Supplies"
  }
}
```

### Response Schema:
```json
{
  "success": true,
  "data": {
    "policyId": "pol_inv_default",
    "policyKey": "POL-INVOICE-001",
    "version": "1.0.0",
    "passed": false,
    "requiresReview": true,
    "ruleResults": [
      {
        "ruleId": "rule_high_value",
        "ruleName": "High Value Review Required",
        "passed": false,
        "action": "require_review",
        "severity": "high",
        "message": "Invoices exceeding 10,000 require manual review",
        "field": "total_amount",
        "actualValue": 15420.5
      },
      {
        "ruleId": "rule_req_inv_num",
        "ruleName": "Invoice Number Required",
        "passed": true,
        "action": "reject",
        "severity": "critical",
        "message": "Invoice number must be present",
        "field": "invoice_number",
        "actualValue": "INV-2026-001"
      }
    ],
    "evaluatedAt": "2026-10-09T14:40:00.000Z"
  }
}
```
