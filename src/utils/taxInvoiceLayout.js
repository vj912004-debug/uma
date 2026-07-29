/** Shared Tax Invoice charge rows and amount calculations. */

export const TI_CHARGES_LIST = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges(998842)' },
  { key: 'processing', label: 'Processing Charges(998842)' },
  { key: 'psdReport', label: 'PSD Report Charges(998346)' },
  { key: 'filterBag', label: 'Filter Bag Charges(591190)' },
  { key: 'sieving', label: 'Sieving Charges(998842)' },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)' },
  { key: 'liner', label: 'Liner (39233090)' },
  { key: 'courier', label: 'Courier Charges(996812)' },
  { key: 'transportation', label: 'Transportation (996511)' },
  { key: 'batchChangeover', label: 'Batch change over charges(998842)' }
];

export const TI_EMPTY_ROWS = 2;

/**
 * Resolve invoice GST from form taxRate (e.g. 18).
 * CGST/SGST Rate columns and amounts each use half (e.g. 9% + 9% = 18% total).
 */
export const getSplitGstRates = (data) => {
  const parsed = parseFloat(data?.taxRate);
  const taxRate = Number.isFinite(parsed) && parsed >= 0 ? parsed : 18;
  const half = taxRate / 2;
  return {
    taxRate,
    displayRate: half,
    sgst: half,
    cgst: half,
    igst: 0
  };
};

/** Split party address into display lines (explicit newlines or word-wrap). */
export const splitPartyAddressLines = (address, charsPerLine = 48) => {
  const text = (address || '').trim();
  if (!text) return [];
  const explicit = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  const raw = explicit[0] || text;
  if (raw.length <= charsPerLine) return [raw];
  const words = raw.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [raw];
};

/** Aligned bill/ship address rows; extra rows only when address needs multiple lines. */
export const getPartyAddressRows = (billAddress, shipAddress, charsPerLine = 48) => {
  const billLines = splitPartyAddressLines(billAddress, charsPerLine);
  const shipLines = splitPartyAddressLines(shipAddress, charsPerLine);
  const count = Math.max(billLines.length, shipLines.length, 1);
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({ bill: billLines[i] || '', ship: shipLines[i] || '' });
  }
  return rows;
};

const MATERIAL_QTY_CHARGE_KEYS = ['cleaning', 'processing', 'sieving', 'other'];

export const formatPdfDateSlash = (d) => {
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

export const getPdfProductLines = (data) => {
  if (data.productSummaries?.length) {
    return data.productSummaries.map(p => ({
      name: p.prodName || '',
      qty: parseFloat(p.qty) || 0
    })).filter(p => p.name);
  }
  if (data.productName?.includes(',')) {
    return data.productName.split(',').map(name => ({
      name: name.trim(),
      qty: 0
    })).filter(p => p.name);
  }
  if (data.productName) {
    return [{ name: data.productName, qty: parseFloat(data.qty) || 0 }];
  }
  return [];
};

const getPdfChargeLineQty = (data, key, materialQty) => {
  const saved = data.qtys?.[key];
  if (saved != null && saved !== '') return parseFloat(saved) || 0;
  if (MATERIAL_QTY_CHARGE_KEYS.includes(key)) return materialQty || 1;
  return 1;
};

export { getPdfChargeLineQty };

export const buildTiChargeAmounts = (data) => {
  const amounts = {};
  const materialQty = parseFloat(data.qty) || 0;
  const productLines = getPdfProductLines(data);
  const normName = (s) => (s || '').trim().toLowerCase();

  const addLine = (key, qty, rate, amt) => {
    if (!amounts[key]) amounts[key] = { qty: 0, rate: 0, amt: 0 };
    const lineQty = parseFloat(qty) || 0;
    const lineRate = parseFloat(rate) || 0;
    const lineAmt = parseFloat(amt) || 0;
    amounts[key].qty += lineQty;
    amounts[key].amt += lineAmt;
    if (lineRate) amounts[key].rate = lineRate;
  };

  if (data.productCharges && Object.keys(data.productCharges).length > 0) {
    const pcMap = data.productCharges;
    const chargeKeys = Object.keys(pcMap);
    const orderedNames = [];
    const seen = new Set();
    const addName = (name) => {
      if (!name) return;
      const nk = normName(name);
      if (seen.has(nk)) return;
      seen.add(nk);
      orderedNames.push(name);
    };
    productLines.forEach(p => addName(p.name));
    chargeKeys.forEach(k => addName(k));

    orderedNames.forEach((name) => {
      const chargeKey = chargeKeys.find(k => normName(k) === normName(name)) || name;
      const pc = pcMap[chargeKey];
      if (!pc) return;
      const summary = productLines.find(p => normName(p.name) === normName(name));
      const prodQty = summary?.qty || 0;
      if (pc.charges?.processing) {
        const rate = parseFloat(pc.rates?.processing || 0);
        const lineQty = prodQty || parseFloat(pc.qtys?.processing) || 0;
        addLine('processing', lineQty, rate, lineQty * rate);
      }
      TI_CHARGES_LIST.forEach((c) => {
        if (c.key === 'processing') return;
        if (pc.charges?.[c.key]) {
          const rowQty = pc.qtys?.[c.key] != null && pc.qtys?.[c.key] !== ''
            ? (parseFloat(pc.qtys[c.key]) || 0)
            : 1;
          const rate = parseFloat(pc.rates?.[c.key] || 0);
          addLine(c.key, rowQty, rate, rowQty * rate);
        }
      });
    });
  } else {
    if (data.charges?.processing) {
      if (productLines.length) {
        productLines.forEach(({ qty: lineQtyVal }) => {
          const procRate = parseFloat(data.rates?.processing || 0);
          const lineQty = lineQtyVal || materialQty;
          addLine('processing', lineQty, procRate, lineQty * procRate);
        });
      } else {
        const procQty = getPdfChargeLineQty(data, 'processing', materialQty);
        const procRate = parseFloat(data.rates?.processing || 0);
        addLine('processing', procQty, procRate, procQty * procRate);
      }
    }
    TI_CHARGES_LIST.forEach((c) => {
      if (c.key === 'processing') return;
      if (data.charges?.[c.key]) {
        const rowQty = getPdfChargeLineQty(data, c.key, materialQty);
        const rate = parseFloat(data.rates?.[c.key] || 0);
        addLine(c.key, rowQty, rate, rowQty * rate);
      }
    });
  }

  return amounts;
};

export const formatPdfDateDmy = (d) => {
  if (!d || d === 'N/A') return d === 'N/A' ? 'N/A' : '';
  try {
    const str = String(d);
    const date = str.length === 10 && str[4] === '-'
      ? new Date(`${str}T00:00:00`)
      : new Date(d);
    if (Number.isNaN(date.getTime())) return str;
    return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  } catch {
    return String(d);
  }
};

export const calcTiTotals = (data) => {
  const chargeAmounts = buildTiChargeAmounts(data);
  const { sgst: sgstRate, cgst: cgstRate } = getSplitGstRates(data);
  let totalAmt = 0;
  let totalSgst = 0;
  let totalCgst = 0;
  let totalIgst = 0;
  let totalAll = 0;
  let totalQty = 0;

  TI_CHARGES_LIST.forEach((charge) => {
    const line = chargeAmounts[charge.key] || { qty: 0, rate: 0, amt: 0 };
    const amt = line.amt || 0;
    const sgstAmt = amt * (sgstRate / 100);
    const cgstAmt = amt * (cgstRate / 100);
    const rowTotal = amt + sgstAmt + cgstAmt;
    totalAmt += amt;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
    totalAll += rowTotal;
    if (line.qty) totalQty += line.qty;
  });

  if (data.customCharges?.length) {
    data.customCharges.forEach((cc) => {
      if (!cc.checked) return;
      const ccQty = parseFloat(cc.qty) || 1;
      const rate = parseFloat(cc.rate) || 0;
      const amt = ccQty * rate;
      if (amt <= 0) return;
      const sgstAmt = amt * (sgstRate / 100);
      const cgstAmt = amt * (cgstRate / 100);
      totalAmt += amt;
      totalSgst += sgstAmt;
      totalCgst += cgstAmt;
      totalAll += amt + sgstAmt + cgstAmt;
    });
  }

  const discount = parseFloat(data.discount) || 0;
  if (discount > 0) {
    const grossAmt = totalAmt;
    totalAmt = Math.max(0, grossAmt - discount);
    const ratio = grossAmt > 0 ? totalAmt / grossAmt : 0;
    totalSgst *= ratio;
    totalCgst *= ratio;
    totalAll = totalAmt + totalSgst + totalCgst + totalIgst;
  }

  return { chargeAmounts, totalAmt, totalSgst, totalCgst, totalIgst, totalAll, totalQty, sgstRate, cgstRate };
};
