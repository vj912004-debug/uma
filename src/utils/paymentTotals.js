/** Total received against a material receipt (cheque amount + TDS). */
export const getReceiptPaymentTotal = (payments, receiptId) =>
  (payments || [])
    .filter(p => p.receiptId === receiptId)
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.tds) || 0), 0);

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
