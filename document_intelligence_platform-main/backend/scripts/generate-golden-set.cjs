const fs = require('fs');
const path = require('path');

function generatePdfBuffer(title, type, fields) {
  const lines = [
    `============================================================`,
    `DOCUNEXA ENTERPRISE GOLDEN DATASET: ${type.toUpperCase()}`,
    `DOCUMENT TITLE: ${title}`,
    `============================================================`,
    ``,
    ...Object.entries(fields).map(([k, v]) => `${k.toUpperCase().replace(/_/g, ' ')}: ${v}`),
    ``,
    `------------------------------------------------------------`,
    `Standard Legal and Commercial Terms Apply.`,
    `Verified synthetic benchmark fixture for AI Quality Evaluation (AI-008).`,
  ];

  const streamBody =
    `BT\n/F1 12 Tf\n50 720 Td\n` +
    lines.map((line, idx) => `(${line.replace(/[()\\]/g, '')}) ${idx === 0 ? 'Tj' : '0 -20 Td Tj'}`).join('\n') +
    `\nET\n`;

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf8')} >>\nstream\n${streamBody}endstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
  ];

  let pdf = `%PDF-1.4\n`;
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function main() {
  const goldenDirs = [
    path.resolve(process.cwd(), '..', 'tests', 'golden'),
    path.resolve(process.cwd(), 'tests', 'golden'),
  ];

  for (const goldenDir of goldenDirs) {
    if (!fs.existsSync(goldenDir)) {
      fs.mkdirSync(goldenDir, { recursive: true });
    }
  }

  const primaryDir = goldenDirs[0];

  const goldenInvoices = [
    {
      id: 'golden-inv-01',
      title: 'Commercial Supply Invoice #101',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-101',
        invoice_date: '2026-01-10',
        vendor_name: 'Alpha Logistics Global',
        total_amount: '1450.00',
        currency: 'USD',
        tax_amount: '145.00',
      },
    },
    {
      id: 'golden-inv-02',
      title: 'Cloud Infrastructure Invoice #102',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-102',
        invoice_date: '2026-01-15',
        vendor_name: 'Apex Cloud Solutions Inc',
        total_amount: '3890.50',
        currency: 'USD',
        tax_amount: '389.05',
      },
    },
    {
      id: 'golden-inv-03',
      title: 'Hardware Procurement Invoice #103',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-103',
        invoice_date: '2026-01-20',
        vendor_name: 'Quantum Chipset Systems',
        total_amount: '12400.00',
        currency: 'USD',
        tax_amount: '1240.00',
      },
    },
    {
      id: 'golden-inv-04',
      title: 'Facility Maintenance Invoice #104',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-104',
        invoice_date: '2026-01-25',
        vendor_name: 'CleanFacility Facility Mgmt',
        total_amount: '750.00',
        currency: 'USD',
        tax_amount: '75.00',
      },
    },
    {
      id: 'golden-inv-05',
      title: 'Consulting Services Invoice #105',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-105',
        invoice_date: '2026-02-01',
        vendor_name: 'Summit Advisory Partners',
        total_amount: '9500.00',
        currency: 'USD',
        tax_amount: '950.00',
      },
    },
    {
      id: 'golden-inv-06',
      title: 'Office Supplies Bulk Invoice #106',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-106',
        invoice_date: '2026-02-05',
        vendor_name: 'Metro Stationery Depot',
        total_amount: '420.75',
        currency: 'USD',
        tax_amount: '42.08',
      },
    },
    {
      id: 'golden-inv-07',
      title: 'Network Bandwidth Invoice #107',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-107',
        invoice_date: '2026-02-10',
        vendor_name: 'Global Fiber Telecom Corp',
        total_amount: '2150.00',
        currency: 'USD',
        tax_amount: '215.00',
      },
    },
    {
      id: 'golden-inv-08',
      title: 'Security Software License #108',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-108',
        invoice_date: '2026-02-15',
        vendor_name: 'CyberShield Defenses Ltd',
        total_amount: '5600.00',
        currency: 'USD',
        tax_amount: '560.00',
      },
    },
    {
      id: 'golden-inv-09',
      title: 'Freight Shipping Invoice #109',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-109',
        invoice_date: '2026-02-20',
        vendor_name: 'Pacific Freight Express',
        total_amount: '3100.25',
        currency: 'USD',
        tax_amount: '310.03',
      },
    },
    {
      id: 'golden-inv-10',
      title: 'Annual Audit Services Invoice #110',
      type: 'invoice',
      fields: {
        invoice_number: 'INV-2026-110',
        invoice_date: '2026-02-28',
        vendor_name: 'Pinnacle Accounting CPA',
        total_amount: '8400.00',
        currency: 'USD',
        tax_amount: '840.00',
      },
    },
  ];

  const goldenContracts = [
    {
      id: 'golden-ctr-01',
      title: 'Master Services Agreement',
      type: 'contract',
      fields: {
        contract_title: 'Master Services Agreement',
        effective_date: '2026-01-01',
        parties: 'DocuNexa Enterprise & Alpha Logistics',
        governing_law: 'Delaware',
        termination_notice_days: '30',
      },
    },
    {
      id: 'golden-ctr-02',
      title: 'Non-Disclosure Agreement',
      type: 'contract',
      fields: {
        contract_title: 'Mutual Non-Disclosure Agreement',
        effective_date: '2026-01-15',
        parties: 'DocuNexa Inc & Apex Cloud Solutions',
        governing_law: 'New York',
        termination_notice_days: '60',
      },
    },
    {
      id: 'golden-ctr-03',
      title: 'Software Licensing Agreement',
      type: 'contract',
      fields: {
        contract_title: 'Enterprise Software License Agreement',
        effective_date: '2026-02-01',
        parties: 'DocuNexa Inc & CyberShield Defenses',
        governing_law: 'California',
        termination_notice_days: '90',
      },
    },
    {
      id: 'golden-ctr-04',
      title: 'Data Processing Addendum',
      type: 'contract',
      fields: {
        contract_title: 'Standard Data Processing Addendum',
        effective_date: '2026-02-15',
        parties: 'DocuNexa Inc & Global Telecom',
        governing_law: 'Ireland',
        termination_notice_days: '30',
      },
    },
    {
      id: 'golden-ctr-05',
      title: 'Hardware Procurement Contract',
      type: 'contract',
      fields: {
        contract_title: 'Hardware Procurement & Supply Agreement',
        effective_date: '2026-03-01',
        parties: 'DocuNexa Inc & Quantum Chipset Systems',
        governing_law: 'Texas',
        termination_notice_days: '45',
      },
    },
  ];

  const allDocs = [...goldenInvoices, ...goldenContracts];

  for (const doc of allDocs) {
    const pdfBuf = generatePdfBuffer(doc.title, doc.type, doc.fields);
    for (const d of goldenDirs) {
      fs.writeFileSync(path.join(d, `${doc.id}.pdf`), pdfBuf);
    }
  }

  const manifest = {
    version: '1.0.0',
    datasetName: 'DocuNexa Golden Evaluation Set (AI-008)',
    totalDocuments: allDocs.length,
    distribution: {
      invoices: goldenInvoices.length,
      contracts: goldenContracts.length,
    },
    documents: allDocs.map((doc) => ({
      id: doc.id,
      fileName: `${doc.id}.pdf`,
      documentType: doc.type,
      title: doc.title,
      expectedFields: doc.fields,
    })),
  };

  const readmeContent = `
# DocuNexa Golden Evaluation Dataset (AI-008)

## 1. Overview
This directory contains the synthetic golden labeled set for automated quality regression testing of OCR, classification, and field extraction pipelines (AI-008). Zero real customer data is included.

- **Total Labeled Documents**: ${allDocs.length}
  - **Invoices**: ${goldenInvoices.length} synthetic multi-field invoices
  - **Contracts**: ${goldenContracts.length} synthetic legal agreements

## 2. Document Schema & Ground Truth Fields

### Invoices
| Field Name | Description | Example |
| :--- | :--- | :--- |
| \`invoice_number\` | Alphanumeric invoice identifier | \`INV-2026-101\` |
| \`invoice_date\` | ISO date of invoice | \`2026-01-10\` |
| \`vendor_name\` | Commercial billing entity | \`Alpha Logistics Global\` |
| \`total_amount\` | Final payment total | \`1450.00\` |
| \`currency\` | ISO currency code | \`USD\` |
| \`tax_amount\` | Sales tax / VAT | \`145.00\` |

### Contracts
| Field Name | Description | Example |
| :--- | :--- | :--- |
| \`contract_title\` | Formal contract title | \`Master Services Agreement\` |
| \`effective_date\` | Legal commencement date | \`2026-01-01\` |
| \`parties\` | Counterparties | \`DocuNexa & Alpha Logistics\` |
| \`governing_law\` | Jurisdiction | \`Delaware\` |
| \`termination_notice_days\` | Termination window | \`30\` |

## 3. Usage & CLI Evaluation
Run the automated AI Quality evaluation pipeline:
\`\`\`bash
npm run ai:eval
\`\`\`
Outputs precision, recall, and F1 per field and document type, plus classification accuracy.
`;

  for (const d of goldenDirs) {
    fs.writeFileSync(path.join(d, 'ground_truth.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(d, 'README.md'), readmeContent.trim(), 'utf8');
  }

  console.log(`[Golden Set] Successfully generated ${allDocs.length} golden documents in tests/golden.`);
}

main();
