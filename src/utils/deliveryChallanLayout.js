/** Shared Delivery Challan print line building. */

import {
  getProductBatches,
  getProductQty,
  getProductDrums,
  getMRMaterialValue,
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
      const displayProdQty = prodQty > 0 ? prodQty : batchQtySum;

      batches.forEach((b) => {
        if (b.isEmptyDrums || /^empty\s*drums$/i.test(String(b.batchNo || '').trim())) return;
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
    } else if (prodQty > 0 || prodDrums > 0) {
      lines.push({
        kind: 'batch',
        text: 'Received Qty',
        drums: prodDrums > 0 ? prodDrums : '',
        qty: prodQty > 0 ? prodQty.toFixed(2) : ''
      });
    }
  });

  const isMrEmptyDrumsEntry = (b) =>
    !!b?.isEmptyDrums
    || (
      /^empty\s*drums$/i.test(String(b?.batchNo || '').trim())
      && !String(b?.productName || '').trim()
    );
  const emptyDrumsCount = (mr?.batches || [])
    .filter(isMrEmptyDrumsEntry)
    .reduce((sum, b) => sum + (parseInt(b.drums, 10) || 0), 0);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const l = lines[i];
    if (
      l.kind === 'batch'
      && /^empty\s*drums$/i.test(String(l.text || '').replace(/^BATCH NO:?\s*/i, '').trim())
    ) {
      lines.splice(i, 1);
    }
  }
  if (emptyDrumsCount > 0) {
    lines.push({
      kind: 'batch',
      text: 'Empty Drums',
      drums: emptyDrumsCount,
      qty: ''
    });
  }

  if (!lines.length && dc.productName) {
    lines.push({ kind: 'product', text: dc.productName, drums: '', qty: '' });
  }

  const mrValue = getMRMaterialValue(mr);
  const dcValue = parseFloat(dc.value);
  const value = mrValue > 0
    ? mrValue
    : (Number.isFinite(dcValue) && dcValue > 0 ? dcValue : 0);
  if (value > 0) {
    lines.push({
      kind: 'value',
      text: `Total goods value Rs : ${fmtMoney(value)}`,
      drums: '',
      qty: ''
    });
  }

  const formQty = parseFloat(dc.qty) || 0;
  const formDrums = parseInt(dc.totalDrums, 10) || 0;
  const linesQty = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0);
  const linesDrums = lines.reduce((s, l) => s + (parseInt(l.drums, 10) || 0), 0);

  const totalQty = formQty > 0
    ? formQty
    : (receivedQtyTotal > 0 ? receivedQtyTotal : linesQty);
  const printedDrums = receivedDrumsTotal + emptyDrumsCount;
  const totalDrums = printedDrums > 0
    ? printedDrums
    : (formDrums > 0 ? formDrums : linesDrums);

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
