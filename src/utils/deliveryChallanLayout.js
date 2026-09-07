/** Shared Delivery Challan print line building. */

import {
  getProductBatches,
  getProductQty,
  getProductDrums,
  getEmptyDrumsCount,
  getMRMaterialValue,
  receiptProductOptions,
  findAnyPackingList,
  getPLProductDrums,
  getPLBatchDrumCounts
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
export const resolveLinkedMr = (dc, appData = {}) => {
  const mrs = appData.materialReceipts || [];
  if (!dc || !mrs.length) return null;
  const id = dc.receiptId || dc.mrId || '';
  const idStr = String(id);
  return mrs.find((r) => id && r.id === id)
    || mrs.find((r) => idStr && String(r.id) === idStr)
    || mrs.find((r) => dc.receiptNo && r.receiptNo === dc.receiptNo)
    || mrs.find((r) => dc.partyDocNo && r.partyDocNo === dc.partyDocNo
      && String(r.partyName || '').trim().toLowerCase() === String(dc.partyName || '').trim().toLowerCase())
    || null;
};

export const buildDcPrintLines = (dc, appData = {}) => {
  const mr = resolveLinkedMr(dc, appData);
  const prodOpts = mr ? receiptProductOptions(mr, appData) : {};
  const pl = findAnyPackingList(appData.packingLists, mr?.id || dc.receiptId);

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
    if (/^empty\s*drums?$/i.test(String(prodName || '').trim())) return;
    if (prodName) {
      lines.push({ kind: 'product', text: prodName, drums: '', qty: '' });
    }

    if (!mr || !prodName) return;

    const batches = getProductBatches(mr, prodName, prodOpts);
    const prodQty = getProductQty(mr, prodName, prodOpts);
    const plDrumCounts = getPLBatchDrumCounts(pl, prodName, mr, prodOpts);
    const plDrums = getPLProductDrums(pl, prodName, mr, prodOpts);
    const mrDrums = getProductDrums(mr, prodName, prodOpts);
    const prodDrums = plDrums > 0 ? plDrums : mrDrums;
    receivedQtyTotal += prodQty || 0;
    receivedDrumsTotal += prodDrums || 0;

    const usedPlBatches = new Set();
    if (batches.length) {
      const batchQtySum = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
      const displayProdQty = prodQty > 0 ? prodQty : batchQtySum;

      batches.forEach((b) => {
        const batchKey = String(b.batchNo || '').trim() || '—';
        usedPlBatches.add(batchKey);
        const mrD = parseInt(b.drums, 10) || 0;
        const plD = plDrumCounts[batchKey] || 0;
        const d = plD > 0 ? plD : mrD;
        let q = parseFloat(b.qty) || 0;
        if (batches.length === 1 && displayProdQty > 0) q = displayProdQty;
        else if (q <= 0 && batches.length === 1 && prodQty > 0) q = prodQty;
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${b.batchNo || ''}`,
          drums: d > 0 ? d : '',
          qty: (q > 0 ? q : 0).toFixed(2)
        });
      });
      Object.entries(plDrumCounts).forEach(([batchNo, d]) => {
        if (usedPlBatches.has(batchNo) || !d) return;
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${batchNo === '—' ? '' : batchNo}`,
          drums: d,
          qty: ''
        });
      });
      if (batchQtySum <= 0 && displayProdQty > 0 && batches.length > 1 && !plDrums) {
        lines.push({
          kind: 'batch',
          text: 'Received Qty',
          drums: prodDrums > 0 ? prodDrums : '',
          qty: displayProdQty.toFixed(2)
        });
      }
    } else if (Object.keys(plDrumCounts).length) {
      Object.entries(plDrumCounts).forEach(([batchNo, d]) => {
        lines.push({
          kind: 'batch',
          text: `BATCH NO:${batchNo === '—' ? '' : batchNo}`,
          drums: d > 0 ? d : '',
          qty: prodQty > 0 && Object.keys(plDrumCounts).length === 1 ? prodQty.toFixed(2) : ''
        });
      });
    } else if (prodQty > 0 || prodDrums > 0) {
      lines.push({
        kind: 'batch',
        text: 'Received Qty',
        drums: prodDrums > 0 ? prodDrums : '',
        qty: prodQty > 0 ? prodQty.toFixed(2) : ''
      });
    }
  });

  const formQty = parseFloat(dc.qty) || 0;
  const formDrums = parseInt(dc.totalDrums, 10) || 0;
  let emptyDrumsCount = getEmptyDrumsCount(mr)
    || parseInt(dc.emptyDrums, 10)
    || parseInt(dc.emptyDrumsCount, 10)
    || 0;
  if (!emptyDrumsCount && mr && formDrums > receivedDrumsTotal) {
    emptyDrumsCount = formDrums - receivedDrumsTotal;
  }

  const emptyAlreadyListed = lines.some((l) =>
    /^empty\s*drums?$/i.test(String(l.text || '').replace(/^BATCH NO:?\s*/i, '').trim())
  );
  if (emptyDrumsCount > 0 && !emptyAlreadyListed) {
    lines.push({
      kind: 'batch',
      text: 'Empty Drums',
      drums: emptyDrumsCount,
      qty: ''
    });
  }

  if (!lines.length && dc.productName) {
    const printedName = String(dc.productName)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^empty\s*drums?$/i.test(s))
      .join(', ');
    if (printedName) lines.push({ kind: 'product', text: printedName, drums: '', qty: '' });
  }

  const mrValue = getMRMaterialValue(mr);
  const dcValue = parseFloat(dc.value);
  const value = mrValue > 0
    ? mrValue
    : (Number.isFinite(dcValue) && dcValue > 0 ? dcValue : 0);
  const goodsValueText = value > 0
    ? `Total goods value Rs : ${fmtMoney(value)}`
    : '';

  const linesQty = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0);
  const linesDrums = lines.reduce((s, l) => s + (parseInt(l.drums, 10) || 0), 0);

  const totalQty = formQty > 0
    ? formQty
    : (receivedQtyTotal > 0 ? receivedQtyTotal : linesQty);
  const printedDrums = receivedDrumsTotal + emptyDrumsCount;
  const totalDrums = printedDrums > 0
    ? printedDrums
    : (formDrums > 0 ? formDrums : linesDrums);

  return { lines, totalDrums, totalQty, goodsValueText };
};

export const getDcAppData = () => {
  try {
    const raw = localStorage.getItem('uma_erp_data');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
