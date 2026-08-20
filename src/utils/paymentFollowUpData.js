import {
  getReceiptOutstanding,
  getReceiptBillAmount,
  getReceiptEffectivePaid,
  getReceiptEffectiveTds,
  hasSheetOverride,
  isTaxInvoiceDoc
} from './paymentTotals';

export const money = (n) =>
  (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moneyINR = (n) => `₹ ${money(n)}`;

export const daysBetween = (fromIso, asOnIso) => {
  if (!fromIso) return null;
  const from = new Date(fromIso.includes('T') ? fromIso : `${fromIso}T12:00:00`);
  const to = asOnIso
    ? new Date(asOnIso.includes('T') ? asOnIso : `${asOnIso}T12:00:00`)
    : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  from.setHours(12, 0, 0, 0);
  to.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((to - from) / 86400000));
};

export const todayISO = () => new Date().toISOString().split('T')[0];

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const resolveParty = (data, partyId, partyName) => {
  const parties = (data.parties || []).filter((p) => !p.isDeleted);
  if (partyId) {
    const byId = parties.find((p) => String(p.id) === String(partyId));
    if (byId) return byId;
  }
  const name = (partyName || '').trim().toLowerCase();
  if (!name) return null;
  return parties.find((p) => (p.name || '').trim().toLowerCase() === name) || null;
};

const partyDueOverrideTotal = (party) => {
  const o = party?.dueOverrides || {};
  return Object.values(o).reduce((sum, v) => {
    if (v === undefined || v === '') return sum;
    return sum + (parseFloat(v) || 0);
  }, 0);
};

/** Build invoice-level outstanding rows (aligned with Processing Sheet). */
export const buildOutstandingInvoices = (data, asOnDate = todayISO()) => {
  const rows = [];
  const payments = data.payments || [];
  const mrsCovered = new Set();

  // 1) One row per Tax Invoice (same as Processing Sheet)
  (data.invoices || []).filter(isTaxInvoiceDoc).forEach((ti) => {
    const mr = (data.materialReceipts || []).find(
      (m) => !m.isDeleted && String(m.id) === String(ti.receiptId)
    );
    const baseMr = mr || {
      id: ti.receiptId || `orphan-${ti.id}`,
      partyId: '',
      partyName: ti.partyName || '',
      date: ti.date || '',
      totalQty: ti.qty || 0,
      sheetOverrides: {}
    };

    const party = resolveParty(data, baseMr.partyId, ti.partyName || baseMr.partyName);
    const outstanding = getReceiptOutstanding(baseMr, ti, payments);
    if (outstanding < 0.01) return;

    if (mr) mrsCovered.add(mr.id);

    const invoiceDate = ti.date || baseMr.date || '';
    const ageDays = daysBetween(invoiceDate, asOnDate);

    rows.push({
      id: ti.id || `${baseMr.id}-${ti.invoiceNo}`,
      invoiceId: ti.id,
      receiptId: baseMr.id,
      partyId: party?.id || baseMr.partyId || '',
      partyName: party?.name || ti.partyName || baseMr.partyName || 'Unknown',
      phone: party?.phone1 || party?.mobile || '',
      email: party?.email1 || party?.email || '',
      address: party?.billAddress || baseMr.billAddress || '',
      gstin: party?.gstinBill || baseMr.gstinBill || '',
      invoiceNo: ti.invoiceNo || '—',
      invoiceDate,
      invoiceAmount: getReceiptBillAmount(baseMr, ti),
      paidAmount: getReceiptEffectivePaid(baseMr, payments, ti.id),
      tdsAmount: getReceiptEffectiveTds(baseMr, payments, ti.id),
      outstanding,
      ageDays,
      overdue: (ageDays ?? 0) >= 30
    });
  });

  // 2) Material receipts with Processing Sheet bill but no TI yet
  (data.materialReceipts || [])
    .filter((mr) => !mr.isDeleted && !mrsCovered.has(mr.id))
    .forEach((mr) => {
      if (!hasSheetOverride(mr.sheetOverrides || {}, 'totalBill')
        && !hasSheetOverride(mr.sheetOverrides || {}, 'outstanding')) {
        return;
      }
      const outstanding = getReceiptOutstanding(mr, null, payments);
      if (outstanding < 0.01) return;

      const party = resolveParty(data, mr.partyId, mr.partyName);
      const invoiceDate = mr.sheetOverrides?.invoiceDate || mr.date || '';
      const ageDays = daysBetween(invoiceDate, asOnDate);

      rows.push({
        id: `mr-${mr.id}`,
        invoiceId: null,
        receiptId: mr.id,
        partyId: party?.id || mr.partyId || '',
        partyName: party?.name || mr.partyName || 'Unknown',
        phone: party?.phone1 || party?.mobile || '',
        email: party?.email1 || party?.email || '',
        address: party?.billAddress || mr.billAddress || '',
        gstin: party?.gstinBill || mr.gstinBill || '',
        invoiceNo: mr.sheetOverrides?.tiNo || mr.sheetOverrides?.invoiceNo || 'Pending TI',
        invoiceDate,
        invoiceAmount: getReceiptBillAmount(mr, null),
        paidAmount: getReceiptEffectivePaid(mr, payments),
        tdsAmount: getReceiptEffectiveTds(mr, payments),
        outstanding,
        ageDays,
        overdue: (ageDays ?? 0) >= 30
      });
    });

  return rows.sort((a, b) => b.outstanding - a.outstanding);
};

const latestFollowUp = (followUps, partyId) => {
  const list = (followUps || [])
    .filter((f) => String(f.partyId) === String(partyId))
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));
  return list[0] || null;
};

/** Aggregate customer-wise outstanding + Party Due overrides + follow-up dates. */
export const buildCustomerOutstanding = (data, asOnDate = todayISO()) => {
  const invoices = buildOutstandingInvoices(data, asOnDate);
  const byParty = new Map();

  const partyKey = (partyId, partyName, fallback) => {
    if (partyId !== undefined && partyId !== null && String(partyId) !== '') return `id:${String(partyId)}`;
    if (partyName) return `name:${String(partyName).trim().toLowerCase()}`;
    return `row:${fallback}`;
  };

  invoices.forEach((inv) => {
    const key = partyKey(inv.partyId, inv.partyName, inv.id);
    if (!byParty.has(key)) {
      byParty.set(key, {
        partyId: inv.partyId,
        partyName: inv.partyName,
        phone: inv.phone,
        email: inv.email,
        address: inv.address,
        gstin: inv.gstin,
        pendingInvoices: 0,
        invoiceOutstanding: 0,
        overdueAmount: 0,
        invoices: []
      });
    }
    const row = byParty.get(key);
    row.pendingInvoices += 1;
    row.invoiceOutstanding += inv.outstanding;
    if (inv.overdue) row.overdueAmount += inv.outstanding;
    row.invoices.push(inv);
  });

  // Merge Party Master dueOverrides — never wipe invoice dues with zeroed Party Due cells
  (data.parties || [])
    .filter((p) => !p.isDeleted)
    .forEach((party) => {
      const key = partyKey(party.id, party.name, party.id);
      const overrideTotal = partyDueOverrideTotal(party);
      const existing = byParty.get(key);

      if (existing) {
        // Prefer invoice outstanding; only replace when Party Due has a positive override total
        existing.outstandingAmount = overrideTotal > 0.01
          ? overrideTotal
          : existing.invoiceOutstanding;
        if (!existing.phone) existing.phone = party.phone1 || party.mobile || '';
        if (!existing.email) existing.email = party.email1 || party.email || '';
        if (!existing.partyId) existing.partyId = party.id;
        return;
      }

      if (overrideTotal > 0.01) {
        byParty.set(key, {
          partyId: party.id,
          partyName: party.name,
          phone: party.phone1 || party.mobile || '',
          email: party.email1 || party.email || '',
          address: party.billAddress || '',
          gstin: party.gstinBill || '',
          pendingInvoices: 0,
          invoiceOutstanding: 0,
          outstandingAmount: overrideTotal,
          overdueAmount: 0,
          invoices: [],
          fromDueOverride: true
        });
      }
    });

  byParty.forEach((row) => {
    if (row.outstandingAmount == null) {
      row.outstandingAmount = row.invoiceOutstanding || 0;
    }
  });

  return [...byParty.values()]
    .filter((row) => (row.outstandingAmount || 0) > 0.01)
    .map((row) => {
      const last = latestFollowUp(data.paymentFollowUps, row.partyId);
      return {
        ...row,
        lastFollowUp: last?.date || '',
        nextFollowUp: last?.nextFollowUpDate || '',
        lastFollowStatus: last?.status || '',
        lastFollowMethod: last?.method || '',
        lastFollowNote: last?.remarks || last?.note || ''
      };
    })
    .sort((a, b) => (b.outstandingAmount || 0) - (a.outstandingAmount || 0));
};

export const followUpsDueOn = (customers, dateISO) =>
  customers.filter((c) => c.nextFollowUp && c.nextFollowUp === dateISO && c.outstandingAmount > 0.01);

export const promisesDueOnOrBefore = (promises, dateISO) =>
  (promises || []).filter((p) => p.promiseDate && p.promiseDate <= dateISO && !p.cleared);
