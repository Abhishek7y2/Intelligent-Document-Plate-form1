# DocuNexa Golden Evaluation Dataset (AI-008)

## 1. Overview
This directory contains the synthetic golden labeled set for automated quality regression testing of OCR, classification, and field extraction pipelines (AI-008). Zero real customer data is included.

- **Total Labeled Documents**: 15
  - **Invoices**: 10 synthetic multi-field invoices
  - **Contracts**: 5 synthetic legal agreements

## 2. Document Schema & Ground Truth Fields

### Invoices
| Field Name | Description | Example |
| :--- | :--- | :--- |
| `invoice_number` | Alphanumeric invoice identifier | `INV-2026-101` |
| `invoice_date` | ISO date of invoice | `2026-01-10` |
| `vendor_name` | Commercial billing entity | `Alpha Logistics Global` |
| `total_amount` | Final payment total | `1450.00` |
| `currency` | ISO currency code | `USD` |
| `tax_amount` | Sales tax / VAT | `145.00` |

### Contracts
| Field Name | Description | Example |
| :--- | :--- | :--- |
| `contract_title` | Formal contract title | `Master Services Agreement` |
| `effective_date` | Legal commencement date | `2026-01-01` |
| `parties` | Counterparties | `DocuNexa & Alpha Logistics` |
| `governing_law` | Jurisdiction | `Delaware` |
| `termination_notice_days` | Termination window | `30` |

## 3. Usage & CLI Evaluation
Run the automated AI Quality evaluation pipeline:
```bash
npm run ai:eval
```
Outputs precision, recall, and F1 per field and document type, plus classification accuracy.