import { InvoiceMathReconciliationResult } from '../models/extraction.models.js';

/**
 * Validates financial arithmetic for invoices (BRD: FR-007).
 * Tolerance formula: | netAmount + taxAmount - totalAmount | <= 0.01
 */
export function reconcileInvoiceAmounts(
  netAmount?: number,
  taxAmount?: number,
  totalAmount?: number
): InvoiceMathReconciliationResult {
  if (
    netAmount === undefined ||
    netAmount === null ||
    isNaN(netAmount) ||
    taxAmount === undefined ||
    taxAmount === null ||
    isNaN(taxAmount) ||
    totalAmount === undefined ||
    totalAmount === null ||
    isNaN(totalAmount)
  ) {
    return {
      status: 'INCOMPLETE',
      netAmount,
      taxAmount,
      totalAmount,
      delta: 0,
      isReconciled: false,
      discrepancyReason: 'One or more financial reconciliation fields (net, tax, total) are missing or non-numeric.',
    };
  }

  const expectedTotal = parseFloat((netAmount + taxAmount).toFixed(4));
  const actualTotal = parseFloat(totalAmount.toFixed(4));
  const rawDelta = Math.abs(expectedTotal - actualTotal);
  const delta = parseFloat(rawDelta.toFixed(4));

  const isMatched = delta <= 0.01;

  if (isMatched) {
    return {
      status: 'MATCHED',
      netAmount,
      taxAmount,
      totalAmount,
      expectedTotal,
      delta,
      isReconciled: true,
    };
  }

  return {
    status: 'MISMATCH',
    netAmount,
    taxAmount,
    totalAmount,
    expectedTotal,
    delta,
    isReconciled: false,
    discrepancyReason: `Sum of Net (${netAmount}) and Tax (${taxAmount}) does not match Total (${totalAmount}). Delta of ${delta} exceeds tolerance of 0.01.`,
  };
}
