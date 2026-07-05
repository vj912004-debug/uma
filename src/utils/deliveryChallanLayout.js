/** Shared Delivery Challan print line building. */

import {
  findAnyPackingList,
  getProductBatches,
  receiptProductOptions
} from './receiptProducts';

const norm = (s) => (s || '').trim().toLowerCase();

export const formatDcDateSlash = (d) => {
  if (!d || d === 'N/A') return d === 'N/A' ? 'N/A' : '';
  try {
    const str = String(d);
    const date = str.length === 10 && str[4] === '-'
      ? new Date(`${str}T00:00:00`)
      : new Date(d);
    if (Number.isNaN(date.getTime())) return str;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  } catch {
    return String(d);
  }
};

const fmtMoney = (n) => (parseFloat(n) || 0).toFixed(2);

const groupPlBatchesByBatchNo = (pl, prodName) => {
  const groups = [];
  const map = new Map();
  (pl?.batches || [])
    .filter((r) => norm(r.productName) === norm(prodName))
    .forEach((r) => {
      const key = (r.batchNo || 'Unknown').trim();
      if (!map.has(key)) {
        map.set(key, { batchNo: key, drums: 0, qty: 0 });
        groups.push(map.get(key));
      }
      const g = map.get(key);
      g.drums += 1;
      g.qty += parseFloat(r.net) || 0;
    });
  return groups;
};

/** Build aligned description / drums / qty lines for DC PDF. */
export const buildDcPrintLines = (dc, appData = {}) => {
  const mr = (appData.materialReceipts || []).find((r) => r.id === dc.receiptId) || null;
  const pl = findAnyPackingList(appData.packingLists, dc.receiptId);
  const prodOpts = mr ? receiptProductOptions(mr, appData) : {};

  const selected = dc.selectedProducts?.length
    ? dc.selectedProducts
    : (dc.productSummaries || []).map((p) => p.prodName).filter(Boolean);

  const products = selected.length
    ? selected
    : (dc.productName ? dc.productName.split(',').map((s) => s.trim()).filter(Boolean) : ['']);

  const lines = [];

  products.forEach((prodName) => {
    if (prodName) {
      lines.push({ kind: 'product', text: prodName, drums: '', qty: '' });
    }

    const plGroups = groupPlBatchesByBatchNo(pl, prodName);
    if (plGroups.length) {
      plGroups.forEach((g) => {
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${g.batchNo}`,
          drums: g.drums || '',
          qty: g.qty > 0 ? g.qty.toFixed(2) : ''
        });
      });
    } else if (mr && prodName) {
      getProductBatches(mr, prodName, prodOpts).forEach((b) => {
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${b.batchNo || ''}`,
          drums: parseInt(b.drums, 10) || 0,
          qty: parseFloat(b.qty) > 0 ? (parseFloat(b.qty) || 0).toFixed(2) : ''
        });
      });
    }
  });

  (mr?.batches || []).filter((b) => b.isEmptyDrums).forEach((b) => {
    lines.push({
      kind: 'empty',
      text: 'EMPTY DRUM',
      drums: parseInt(b.drums, 10) || 0,
      qty: ''
    });
  });

  if (!lines.length && dc.productName) {
    lines.push({ kind: 'product', text: dc.productName, drums: '', qty: '' });
  }

  const value = parseFloat(dc.value) || 0;
  lines.push({
    kind: 'value',
    text: `Total goods value Rs : ${fmtMoney(value)}`,
    drums: '',
    qty: ''
  });

  const totalDrums = parseInt(dc.totalDrums, 10)
    || lines.reduce((s, l) => s + (parseInt(l.drums, 10) || 0), 0);
  const totalQty = parseFloat(dc.qty)
    || lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0);

  return { lines, totalDrums, totalQty };
};

export const getDcAppData = () => {
  try {
    const raw = localStorage.getItem('uma_erp_data');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
