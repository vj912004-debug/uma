import { getFYOfDate } from './financialYear';

/** Merge material-receipt sheet fields with per-invoice payment fields. */
export const getMergedSheetOverrides = (mr, invoiceId) => {
  const o = mr?.sheetOverrides || {};
  if (!invoiceId) return o;
  const per = o.byInvoice?.[invoiceId] || o.byInvoice?.[String(invoiceId)];
  if (!per || typeof per !== 'object') return o;
  const rest = { ...o };
  delete rest.byInvoice;
  delete rest.outstanding;
  delete rest.manualPaid;
  delete rest.tdsDeduction;
  delete rest.totalBill;
  delete rest.dueStatus;
  return { ...rest, ...per };
};

/** Total received against a material receipt (cheque amount + TDS). */
export const getReceiptPaymentTotal = (payments, receiptId, invoiceId) =>
  (payments || [])
    .filter((p) => matchPayment(p, receiptId, invoiceId))
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.tds) || 0), 0);

/** Cheque/cash portion only (excludes TDS). */
export const getReceiptChequeTotal = (payments, receiptId, invoiceId) =>
  (payments || [])
    .filter((p) => matchPayment(p, receiptId, invoiceId))
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

/** TDS portion of payments for a material receipt. */
export const getReceiptTdsTotal = (payments, receiptId, invoiceId) =>
  (payments || [])
    .filter((p) => matchPayment(p, receiptId, invoiceId))
    .reduce((sum, p) => sum + (parseFloat(p.tds) || 0), 0);

export const getReceiptPayments = (payments, receiptId, invoiceId) =>
  (payments || [])
    .filter((p) => matchPayment(p, receiptId, invoiceId))
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

const matchPayment = (p, receiptId, invoiceId) => {
  if (!p) return false;
  if (invoiceId && p.invoiceId && String(p.invoiceId) === String(invoiceId)) return true;
  if (receiptId && p.receiptId && String(p.receiptId) === String(receiptId)) return true;
  return false;
};

/** True when a sheet/due override was explicitly saved (non-empty). */
export const hasSheetOverride = (overrides, key) =>
  overrides?.[key] !== undefined && overrides[key] !== '';

/** Bill amount for a receipt: Processing Sheet override wins over Tax Invoice total. */
export const getReceiptBillAmount = (mr, ti) => {
  const o = getMergedSheetOverrides(mr, ti?.id);
  if (hasSheetOverride(o, 'totalBill')) return parseFloat(o.totalBill) || 0;
  const fromTi = parseFloat(ti?.total);
  if (Number.isFinite(fromTi) && fromTi > 0) return fromTi;
  // Fallback if total missing but subtotal/tax present
  const sub = parseFloat(ti?.subtotal) || 0;
  const tax = parseFloat(ti?.taxAmount) || 0;
  if (sub + tax > 0) return sub + tax;
  return 0;
};

/**
 * Cheque/cash received (excludes TDS).
 * Processing Sheet "Total Recd (Manual)" overrides payment cheque totals.
 */
export const getReceiptEffectivePaid = (mr, payments, invoiceId) => {
  const o = getMergedSheetOverrides(mr, invoiceId);
  if (hasSheetOverride(o, 'manualPaid')) return parseFloat(o.manualPaid) || 0;
  return getReceiptChequeTotal(payments, mr?.id, invoiceId);
};

/** TDS deducted: Processing Sheet override wins over payment TDS. */
export const getReceiptEffectiveTds = (mr, payments, invoiceId) => {
  const o = getMergedSheetOverrides(mr, invoiceId);
  if (hasSheetOverride(o, 'tdsDeduction')) return parseFloat(o.tdsDeduction) || 0;
  return getReceiptTdsTotal(payments, mr?.id, invoiceId);
};

/**
 * Outstanding = Bill − Received − TDS.
 * Used by Processing Sheet + Party Due + Payment Follow-Up.
 */
export const getReceiptOutstanding = (mr, ti, payments) => {
  const o = getMergedSheetOverrides(mr, ti?.id);
  // Manual Processing Sheet outstanding is the source of truth when typed
  if (hasSheetOverride(o, 'outstanding')) {
    const v = parseFloat(o.outstanding);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  const hasBill = !!ti || hasSheetOverride(o, 'totalBill');
  if (!hasBill) return 0;
  let outstanding =
    getReceiptBillAmount(mr, ti) -
    getReceiptEffectivePaid(mr, payments, ti?.id) -
    getReceiptEffectiveTds(mr, payments, ti?.id);
  if (outstanding < 0.01) outstanding = 0;
  return outstanding;
};

export const isTaxInvoiceDoc = (inv) => {
  if (!inv || inv.isDeleted) return false;
  if (inv.type === 'Tax Invoice') return true;
  const no = String(inv.invoiceNo || '');
  return no.includes('/IN/') || /\/TI\//i.test(no);
};

const noteMatchesParty = (note, party) => {
  if (!note || note.isDeleted) return false;
  if (party?.id && note.partyId && String(note.partyId) === String(party.id)) return true;
  const a = String(note.partyName || '').trim().toLowerCase();
  const b = String(party?.name || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
};

const noteAmount = (note) => parseFloat(note?.amount) || 0;

/** Debit notes increase dues; credit notes reduce dues. */
export const getPartyDebitCreditNet = (data, party) => {
  if (!party) return 0;
  const dn = (data?.debitNotes || []).filter((n) => noteMatchesParty(n, party)).reduce((s, n) => s + noteAmount(n), 0);
  const cn = (data?.creditNotes || []).filter((n) => noteMatchesParty(n, party)).reduce((s, n) => s + noteAmount(n), 0);
  return dn - cn;
};

const noteMatchesInvoice = (note, invoiceNo) => {
  if (!note || note.isDeleted) return false;
  const ref = String(note.refInvoice || '').trim().toLowerCase();
  const inv = String(invoiceNo || '').trim().toLowerCase();
  return Boolean(ref && inv && ref === inv);
};

/** Net DN − CN tagged to a tax invoice number. */
export const getInvoiceDebitCreditNet = (data, invoiceNo) => {
  if (!invoiceNo) return 0;
  const dn = (data?.debitNotes || []).filter((n) => noteMatchesInvoice(n, invoiceNo)).reduce((s, n) => s + noteAmount(n), 0);
  const cn = (data?.creditNotes || []).filter((n) => noteMatchesInvoice(n, invoiceNo)).reduce((s, n) => s + noteAmount(n), 0);
  return dn - cn;
};

export const samePartyRef = (party, partyId, partyName) => {
  if (!party) return false;
  const nameA = String(party.name || '').trim().toLowerCase();
  const nameB = String(partyName || '').trim().toLowerCase();
  if (nameA && nameB) return nameA === nameB;
  if (party.id != null && partyId != null && String(partyId) !== '') {
    return String(party.id) === String(partyId);
  }
  return false;
};

/**
 * One outstanding row per Processing Sheet line (each Tax Invoice + pending MRs).
 * Party Due must sum these — not first-TI-only receipts, and not extra debit notes.
 */
export const listProcessingSheetDueRows = (data) => {
  const payments = data?.payments || [];
  const rows = [];
  const mrsCovered = new Set();

  (data?.invoices || [])
    .filter((inv) => String(inv.invoiceNo || '').includes('/IN/'))
    .forEach((ti) => {
      const mr = (data.materialReceipts || []).find(
        (m) => String(m.id) === String(ti.receiptId)
      );
      const baseMr = mr || {
        id: ti.receiptId || `orphan-${ti.id}`,
        partyId: ti.partyId || '',
        partyName: ti.partyName || '',
        date: ti.date || '',
        sheetOverrides: {}
      };
      if (mr) mrsCovered.add(String(mr.id));
      const o = getMergedSheetOverrides(baseMr, ti.id);
      const partyName = hasSheetOverride(o, 'partyName')
        ? o.partyName
        : (baseMr.partyName || ti.partyName || '');
      rows.push({
        receiptId: baseMr.id,
        invoiceId: ti.id,
        partyId: baseMr.partyId || ti.partyId || '',
        partyName,
        outstanding: getReceiptOutstanding(baseMr, ti, payments),
        fyDate: hasSheetOverride(o, 'invoiceDate') ? o.invoiceDate : (ti.date || baseMr.date)
      });
    });

  (data?.materialReceipts || []).forEach((mr) => {
    if (mrsCovered.has(String(mr.id))) return;
    const o = mr.sheetOverrides || {};
    rows.push({
      receiptId: mr.id,
      invoiceId: null,
      partyId: mr.partyId || '',
      partyName: hasSheetOverride(o, 'partyName') ? o.partyName : (mr.partyName || ''),
      outstanding: getReceiptOutstanding(mr, null, payments),
      fyDate: o.invoiceDate || mr.date
    });
  });

  return rows;
};

/** FY buckets of Processing Sheet outstanding for one party. */
export const getPartyOutstandingByFY = (data, party, fyKeys, currentFY) => {
  const byFy = Object.fromEntries((fyKeys || []).map((k) => [k, 0]));
  listProcessingSheetDueRows(data).forEach((row) => {
    if (!samePartyRef(party, row.partyId, row.partyName)) return;
    const fy = getFYOfDate(row.fyDate);
    const amt = parseFloat(row.outstanding) || 0;
    if (Object.prototype.hasOwnProperty.call(byFy, fy)) byFy[fy] += amt;
    else if (currentFY && Object.prototype.hasOwnProperty.call(byFy, currentFY)) byFy[currentFY] += amt;
  });
  return byFy;
};
