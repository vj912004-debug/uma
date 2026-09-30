/** Shared Tax Invoice charge rows and amount calculations. */

export const TI_CHARGES_LIST = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges(998842)' },
  { key: 'processing', label: 'Processing Charges(998842)' },
  { key: 'psdReport', label: 'PSD Report Charges(998346)' },
  { key: 'filterBag', label: 'Filter Bag Charges(591190)' },
  { key: 'sieving', label: 'Sieving Charges(998842)' },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)' },
  { key: 'fiberDrum', label: 'Fiber Drum (7310)' },
  { key: 'liner', label: 'Liner (39233090)' },
  { key: 'courier', label: 'Courier Charges(996812)' },
  { key: 'transportation', label: 'Transportation (996511)' },
  { key: 'batchChangeover', label: 'Batch change over charges(998842)' }
];

export const TI_EMPTY_ROWS = 2;

/**
 * Resolve invoice GST from form taxRate (e.g. 18) and gstType.
 * - cgst_sgst (default, within Gujarat): half rate each on CGST + SGST
 * - igst (out of Gujarat / interstate): full rate on IGST only
 */
export const GST_TYPE_CGST_SGST = 'cgst_sgst';
export const GST_TYPE_IGST = 'igst';

export const normalizeGstType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return GST_TYPE_CGST_SGST;
  const lower = raw.toLowerCase();
  if (lower === GST_TYPE_IGST || lower.includes('igst')) return GST_TYPE_IGST;
  if (lower === GST_TYPE_CGST_SGST || lower.includes('cgst')) return GST_TYPE_CGST_SGST;
  return raw;
};

export const getSplitGstRates = (data) => {
  const parsed = parseFloat(data?.taxRate);
  const taxRate = Number.isFinite(parsed) && parsed >= 0 ? parsed : 18;
  const gstType = normalizeGstType(data?.gstType);
  if (gstType === GST_TYPE_IGST) {
    return {
      taxRate,
      gstType,
      displayRate: taxRate,
      sgst: 0,
      cgst: 0,
      igst: taxRate
    };
  }
  const half = taxRate / 2;
  return {
    taxRate,
    gstType,
    displayRate: half,
    sgst: half,
    cgst: half,
    igst: 0
  };
};

/** Print a GST percent, including 0, without a trailing decimal on whole numbers. */
export const formatGstPercent = (percent) => {
  const n = Number(percent);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

/** Split a taxable amount into CGST/SGST/IGST rupees for form summaries. */
export const splitTaxableGstAmount = (taxable, taxRate, gstType) => {
  const base = Math.max(0, parseFloat(taxable) || 0);
  const rate = Number.isFinite(parseFloat(taxRate)) ? parseFloat(taxRate) : 18;
  const taxAmount = base * (rate / 100);
  if (normalizeGstType(gstType) === GST_TYPE_IGST) {
    return { taxAmount, cgst: 0, sgst: 0, igst: taxAmount };
  }
  const half = taxAmount / 2;
  return { taxAmount, cgst: half, sgst: half, igst: 0 };
};

const ADDRESS_WORDS = [
  'industrial', 'technical', 'rajasthan', 'patanwala', 'ghatkopar', 'apartment',
  'opposite', 'shreyas', 'society', 'mumbai', 'centre', 'center', 'cinema',
  'estate', 'nagar', 'floor', 'north', 'south', 'marg', 'road', 'plot', 'near',
  'west', 'east', 'lbs', 'opp', 'ind'
].sort((a, b) => b.length - a.length);

const ADDRESS_ABBR = { lbs: 'LBS', opp: 'Opp' };

const titleAddressWord = (dict, source) => {
  if (ADDRESS_ABBR[dict]) return ADDRESS_ABBR[dict];
  const sliced = String(source || '').slice(0, dict.length);
  if (sliced && sliced === sliced.toUpperCase()) return dict.toUpperCase();
  return dict.charAt(0).toUpperCase() + dict.slice(1);
};

/** Split a glued token only when every letter belongs to a known address word. */
const segmentGluedAddress = (word) => {
  const raw = String(word || '');
  const lower = raw.toLowerCase();
  if (!lower || lower.length < 4) return null;
  const parts = [];
  let i = 0;
  while (i < lower.length) {
    const hit = ADDRESS_WORDS.find((token) => lower.startsWith(token, i));
    if (!hit) return null;
    parts.push(titleAddressWord(hit, raw.slice(i)));
    i += hit.length;
  }
  return parts.length > 1 ? parts.join(' ') : null;
};

const spaceAddressToken = (token) => {
  const match = String(token || '').match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);
  if (!match) return token;
  const spaced = segmentGluedAddress(match[2]);
  return spaced ? `${match[1]}${spaced}${match[3]}` : token;
};

const tidyAddressText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\r\n/g, '\n')
  .replace(/\n+/g, ' ')
  .replace(/^(\d+)(?=[A-Za-z])/, '$1 ')
  .replace(/([^\s(])\(/g, '$1 (')
  .replace(/\)(?=[A-Za-z0-9])/g, ') ')
  .replace(/([A-Za-z])(\d{6})\b/g, '$1-$2')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .map(spaceAddressToken)
  .join(' ')
  .replace(/\s*,\s*/g, ', ')
  .replace(/\bCenter Patanwala\b/g, 'Center, Patanwala')
  .replace(/\bMarg\s+(?=[A-Za-z])/g, 'Marg, ')
  .replace(/[,\s]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const ADDRESS_LINE_LIMIT = 60;
const ROAD_MARK = String.raw`\b(\S+)\s+((?:LBS\s+)?(?:Marg|Road|Street|Lane|Avenue|Plot))\b`;

const packAddressLines = (text, limit = ADDRESS_LINE_LIMIT) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cur = '';
  words.forEach((word) => {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && next.length > limit) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  });
  if (cur) lines.push(cur);
  const joined = [];
  lines.forEach((line) => {
    if (joined.length && line.split(/\s+/).length === 1) {
      joined[joined.length - 1] = `${joined[joined.length - 1]} ${line}`;
      return;
    }
    if (line.split(/\s+/).length === 1 && joined.length === 0) {
      joined.push(line);
      return;
    }
    joined.push(line);
  });
  for (let i = 0; i < joined.length - 1; i += 1) {
    if (joined[i + 1].split(/\s+/).length === 1) {
      joined[i + 1] = `${joined[i].split(/\s+/).pop()} ${joined[i + 1]}`;
      joined[i] = joined[i].replace(/\s+\S+$/, '').trim();
    }
  }
  return joined.map((line) => line.trim()).filter(Boolean);
};

/**
 * Space a party address and place the road line on its own row
 * so a word like Cinema stays with Marg / Road instead of sitting alone.
 */
const toTwoAddressLines = (text) => {
  if (!text) return [];
  const road = text.match(new RegExp(ROAD_MARK, 'i'));
  if (road && road.index > 12) {
    const left = text.slice(0, road.index).replace(/[,\s]+$/g, '').trim();
    const right = text.slice(road.index).trim();
    if (left && right && right.length <= 72) return [left, right];
  }
  return packAddressLines(text);
};

/** Party address as two spaced lines, whatever line breaks were typed in Master Data. */
export const splitPartyAddressLines = (address) => toTwoAddressLines(tidyAddressText(address));

const escAddress = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const partyAddressHtml = (lines) => (
  (lines || [])
    .filter((line) => String(line || '').trim())
    .map((line) => `<div class="addr">${escAddress(line)}</div>`)
    .join('')
);

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
  const materialQty = parseFloat(data.qty) || 0;
  if (data.productSummaries?.length) {
    const lines = data.productSummaries.map(p => ({
      name: p.prodName || '',
      qty: parseFloat(p.qty) || 0
    })).filter(p => p.name);
    const sum = lines.reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
    if (sum <= 0 && materialQty > 0 && lines.length === 1) {
      lines[0].qty = materialQty;
    }
    return lines;
  }
  if (data.productName?.includes(',')) {
    const names = data.productName.split(',').map((name) => name.trim()).filter(Boolean);
    return names.map((name) => ({
      name,
      qty: names.length === 1 ? materialQty : 0
    }));
  }
  if (data.productName) {
    return [{ name: data.productName, qty: materialQty }];
  }
  return [];
};

const getPdfChargeLineQty = (data, key, materialQty) => {
  const saved = data.qtys?.[key];
  if (saved != null && saved !== '') return parseFloat(saved) || 0;
  if (MATERIAL_QTY_CHARGE_KEYS.includes(key)) return materialQty || 0;
  return 0;
};

export { getPdfChargeLineQty };

const addAggLine = (amounts, key, qty, rate, amt) => {
  if (!amounts[key]) amounts[key] = { qty: 0, rate: 0, amt: 0 };
  const lineQty = parseFloat(qty) || 0;
  const lineRate = parseFloat(rate) || 0;
  const lineAmt = parseFloat(amt) || 0;
  amounts[key].qty += lineQty;
  amounts[key].amt += lineAmt;
  if (lineRate) amounts[key].rate = lineRate;
};

const pushProcessingLine = (lines, qty, rate) => {
  const lineQty = parseFloat(qty) || 0;
  const lineRate = parseFloat(rate) || 0;
  const amt = lineQty * lineRate;
  if (lineQty <= 0 && lineRate <= 0) return;
  lines.push({ qty: lineQty, rate: lineRate, amt });
};

/** Collect aggregated charges plus one processing line per product. */
const collectTiChargeLines = (data) => {
  const aggregated = {};
  const processingLines = [];
  const materialQty = parseFloat(data.qty) || 0;
  const productLines = getPdfProductLines(data);
  const normName = (s) => (s || '').trim().toLowerCase();

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
        pushProcessingLine(processingLines, lineQty, rate);
      }
      TI_CHARGES_LIST.forEach((c) => {
        if (c.key === 'processing') return;
        if (pc.charges?.[c.key]) {
          const rowQty = pc.qtys?.[c.key] != null && pc.qtys?.[c.key] !== ''
            ? (parseFloat(pc.qtys[c.key]) || 0)
            : 0;
          const rate = parseFloat(pc.rates?.[c.key] || 0);
          const amt = rowQty * rate;
          addAggLine(aggregated, c.key, rowQty, rate, amt);
        }
      });
    });
  } else {
    if (data.charges?.processing) {
      const procRate = parseFloat(data.rates?.processing || 0);
      if (productLines.length) {
        productLines.forEach(({ qty: lineQtyVal }) => {
          const lineQty = lineQtyVal || (productLines.length === 1 ? materialQty : 0);
          pushProcessingLine(processingLines, lineQty, procRate);
        });
      } else {
        pushProcessingLine(processingLines, getPdfChargeLineQty(data, 'processing', materialQty), procRate);
      }
    }
    TI_CHARGES_LIST.forEach((c) => {
      if (c.key === 'processing') return;
      if (data.charges?.[c.key]) {
        const rowQty = getPdfChargeLineQty(data, c.key, materialQty);
        const rate = parseFloat(data.rates?.[c.key] || 0);
        addAggLine(aggregated, c.key, rowQty, rate, rowQty * rate);
      }
    });
  }

  return { aggregated, processingLines };
};

/** Print rows: one processing line per product (qty/rate kept separate). */
export const buildTiPrintChargeRows = (data) => {
  const { aggregated, processingLines } = collectTiChargeLines(data);
  const rows = [];
  TI_CHARGES_LIST.forEach((charge) => {
    if (charge.key === 'processing') {
      processingLines.forEach((line) => {
        rows.push({ key: charge.key, label: charge.label, ...line });
      });
      return;
    }
    const line = aggregated[charge.key];
    if (line && (line.amt > 0 || line.rate > 0 || line.qty > 0)) {
      rows.push({ key: charge.key, label: charge.label, qty: line.qty, rate: line.rate, amt: line.amt });
    }
  });
  return rows;
};

export const buildTiChargeAmounts = (data) => {
  const amounts = {};
  buildTiPrintChargeRows(data).forEach((row) => {
    addAggLine(amounts, row.key, row.qty, row.rate, row.amt);
  });
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
    if (amt <= 0) return;
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
      if (cc.checked === false) return;
      const ccQty = parseFloat(cc.qty) || 0;
      const rate = parseFloat(cc.rate) || 0;
      const amt = (ccQty * rate) || parseFloat(cc.amount) || 0;
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
