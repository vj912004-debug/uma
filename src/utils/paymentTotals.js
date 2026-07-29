/** Total received against a material receipt (cheque amount + TDS). */
export const getReceiptPaymentTotal = (payments, receiptId) =>
  (payments || [])
    .filter(p => p.receiptId === receiptId)
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.tds) || 0), 0);

/** Cheque/cash portion only (excludes TDS). */
export const getReceiptChequeTotal = (payments, receiptId) =>
  (payments || [])
    .filter(p => p.receiptId === receiptId)
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

/** TDS portion of payments for a material receipt. */
export const getReceiptTdsTotal = (payments, receiptId) =>
  (payments || [])
    .filter(p => p.receiptId === receiptId)
    .reduce((sum, p) => sum + (parseFloat(p.tds) || 0), 0);

export const getReceiptPayments = (payments, receiptId) =>
  (payments || [])
    .filter(p => p.receiptId === receiptId)
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

/** True when a sheet/due override was explicitly saved (non-empty). */
export const hasSheetOverride = (overrides, key) =>
  overrides?.[key] !== undefined && overrides[key] !== '';

/** Bill amount for a receipt: Processing Sheet override wins over Tax Invoice total. */
export const getReceiptBillAmount = (mr, ti) => {
  const o = mr?.sheetOverrides || {};
  if (hasSheetOverride(o, 'totalBill')) return parseFloat(o.totalBill) || 0;
  return parseFloat(ti?.total) || 0;
};

/**
 * Cheque/cash received (excludes TDS).
 * Processing Sheet "Total Recd (Manual)" overrides payment cheque totals.
 */
export const getReceiptEffectivePaid = (mr, payments) => {
  const o = mr?.sheetOverrides || {};
  if (hasSheetOverride(o, 'manualPaid')) return parseFloat(o.manualPaid) || 0;
  return getReceiptChequeTotal(payments, mr?.id);
};

/** TDS deducted: Processing Sheet override wins over payment TDS. */
export const getReceiptEffectiveTds = (mr, payments) => {
  const o = mr?.sheetOverrides || {};
  if (hasSheetOverride(o, 'tdsDeduction')) return parseFloat(o.tdsDeduction) || 0;
  return getReceiptTdsTotal(payments, mr?.id);
};

/**
 * Outstanding = Bill − Received − TDS.
 * Used by Processing Sheet + Party Due.
 */
export const getReceiptOutstanding = (mr, ti, payments) => {
  if (!ti && !hasSheetOverride(mr?.sheetOverrides || {}, 'totalBill')) return 0;
  let outstanding =
    getReceiptBillAmount(mr, ti) -
    getReceiptEffectivePaid(mr, payments) -
    getReceiptEffectiveTds(mr, payments);
  if (outstanding < 0.01) outstanding = 0;
  return outstanding;
};
