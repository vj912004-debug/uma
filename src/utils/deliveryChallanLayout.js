/** Shared Delivery Challan print line building. */

import {
  getProductBatches,
  getProductQty,
  getProductDrums,
  receiptProductOptions
} from './receiptProducts';

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

/** Build aligned description / drums / qty lines for DC PDF.
 * Quantities always come from Material Receipt (received qty), never packing list. */
export const buildDcPrintLines = (dc, appData = {}) => {
  const mr = (appData.materialReceipts || []).find((r) => r.id === dc.receiptId) || null;
  const prodOpts = mr ? receiptProductOptions(mr, appData) : {};

  const selected = dc.selectedProducts?.length
    ? dc.selectedProducts
    : (dc.productSummaries || []).map((p) => p.prodName).filter(Boolean);

  const products = selected.length
    ? selected
    : (dc.productName ? dc.productName.split(',').map((s) => s.trim()).filter(Boolean) : []);

  const lines = [];
  let receivedQtyTotal = 0;
  let receivedDrumsTotal = 0;

  products.forEach((prodName) => {
    if (prodName) {
      lines.push({ kind: 'product', text: prodName, drums: '', qty: '' });
    }

    if (!mr || !prodName) return;

    const batches = getProductBatches(mr, prodName, prodOpts);
    const prodQty = getProductQty(mr, prodName, prodOpts);
    const prodDrums = getProductDrums(mr, prodName, prodOpts);
    receivedQtyTotal += prodQty || 0;
    receivedDrumsTotal += prodDrums || 0;

    if (batches.length) {
      const batchQtySum = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
      // Prefer MR totalQty when this DC has a single product (authoritative received qty)
      const displayProdQty = (products.length === 1 && (parseFloat(mr.totalQty) || 0) > 0)
        ? parseFloat(mr.totalQty)
        : (prodQty > 0 ? prodQty : batchQtySum);

      batches.forEach((b) => {
        const d = parseInt(b.drums, 10) || 0;
        let q = parseFloat(b.qty) || 0;
        if (batches.length === 1 && displayProdQty > 0) q = displayProdQty;
        else if (q <= 0 && batches.length === 1 && prodQty > 0) q = prodQty;
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${b.batchNo || ''}`,
          drums: d > 0 ? d : '',
          qty: q > 0 ? q.toFixed(2) : ''
        });
      });
      if (batchQtySum <= 0 && displayProdQty > 0 && batches.length > 1) {
        lines.push({
          kind: 'batch',
          text: 'Received Qty',
          drums: prodDrums > 0 ? prodDrums : '',
          qty: displayProdQty.toFixed(2)
        });
      }
    } else if (prodQty > 0 || prodDrums > 0 || ((parseFloat(mr.totalQty) || 0) > 0 && products.length === 1)) {
      const q = (products.length === 1 && (parseFloat(mr.totalQty) || 0) > 0)
        ? parseFloat(mr.totalQty)
        : prodQty;
      lines.push({
        kind: 'batch',
        text: 'Received Qty',
        drums: prodDrums > 0 ? prodDrums : '',
        qty: q > 0 ? q.toFixed(2) : ''
      });
    }
  });

  (mr?.batches || []).filter((b) => b.isEmptyDrums).forEach((b) => {
    const d = parseInt(b.drums, 10) || 0;
    lines.push({
      kind: 'empty',
      text: 'EMPTY DRUM',
      drums: d > 0 ? d : '',
      qty: ''
    });
  });

  if (!lines.length && dc.productName) {
    lines.push({ kind: 'product', text: dc.productName, drums: '', qty: '' });
  }

  const value = parseFloat(dc.value);
  if (!Number.isNaN(value) && value > 0) {
    lines.push({
      kind: 'value',
      text: `Total goods value Rs : ${fmtMoney(value)}`,
      drums: '',
      qty: ''
    });
  }

  // Prefer MR received totalQty (e.g. 50) over packing-list / stale dc.qty (e.g. 49.57)
  const mrTotalQty = parseFloat(mr?.totalQty) || 0;
  const mrTotalDrums = parseInt(mr?.totalDrums, 10) || 0;
  const linesQty = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0);
  const linesDrums = lines.reduce((s, l) => s + (parseInt(l.drums, 10) || 0), 0);

  const totalQty = mrTotalQty > 0
    ? mrTotalQty
    : (receivedQtyTotal > 0 ? receivedQtyTotal : (linesQty > 0 ? linesQty : (parseFloat(dc.qty) || 0)));
  const totalDrums = mrTotalDrums > 0
    ? mrTotalDrums
    : (receivedDrumsTotal > 0 ? receivedDrumsTotal : (linesDrums > 0 ? linesDrums : (parseInt(dc.totalDrums, 10) || 0)));

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
