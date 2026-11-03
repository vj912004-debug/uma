import { findDedicatedReceiptDoc, findReceiptDoc, getProductBatches, getProductQty, getReceiptProductNames, getReceiptProductSummaries, getReceiptProductLabel, receiptProductOptions, resolveReceiptProductName, findAnyPackingList, buildPLProductSummaries, getMRReceivedQty } from './receiptProducts';
import { fillPrintPartyFields } from './printTheme';

const normProdKey = (s) => (s || '').trim().toLowerCase();

export const CHARGE_KEYS = [
  'cleaning', 'filterBag', 'processing', 'sieving', 'psdReport',
  'liner', 'courier', 'fiberDrum', 'transportation', 'hdpeDrum', 'batchChangeover'
];

export const STANDARD_CHARGES_LIST = [
  { key: 'cleaning', label: 'MINIMUM CLEANING CHARGES (998842)', isQtyRate: true },
  { key: 'filterBag', label: 'FILTER BAG CHARGES (591190)', isQtyRate: false },
  { key: 'processing', label: 'PROCESSING CHARGES (998842)', isQtyRate: true },
  { key: 'sieving', label: 'SIEVING CHARGES (998842)', isQtyRate: true },
  { key: 'psdReport', label: 'PSD REPORT CHARGES (998346)', isQtyRate: false },
  { key: 'liner', label: 'LINER (39233090)', isQtyRate: false },
  { key: 'courier', label: 'COURIER (996812)', isQtyRate: false },
  { key: 'fiberDrum', label: 'FIBER DRUM (7310)', isQtyRate: false },
  { key: 'transportation', label: 'TRANSPORTATION (996511)', isQtyRate: false },
  { key: 'hdpeDrum', label: 'HDPE DRUM (39233090)', isQtyRate: false },
  { key: 'batchChangeover', label: 'BATCH CHANGEOVER (998842)', isQtyRate: false }
];

export const OTHER_CHARGE_ITEM = { key: 'other', label: 'Other Particulars', isQtyRate: true };

export const isMaterialQtyCharge = (key) => ['processing', 'sieving', 'cleaning', 'other'].includes(key);

export const emptyChargeQtys = (extraKeys = []) =>
  Object.fromEntries([...CHARGE_KEYS, ...extraKeys].map(k => [k, '']));

/** Empty qty fields show blank so the user can type; placeholder is NIL. */
export const qtyInputValue = (q) => (q === 0 || q === '' || q == null ? '' : q);

/** Empty rate fields show blank so typing 4500 does not become 45000. */
export const rateInputValue = (r) => (r === 0 || r === '' || r == null ? '' : r);

export const emptyChargeRates = (extraKeys = []) =>
  Object.fromEntries([...CHARGE_KEYS, ...extraKeys].map(k => [k, '']));

export const parseChargeNumber = (val, fallback = 0) => {
  if (val === '' || val == null) return fallback;
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
};

export const parseChargeFieldValue = (val) => {
  if (val === '') return '';
  const n = parseFloat(val);
  return Number.isNaN(n) ? val : n;
};

export const buildChargeQtys = (settings, materialQty = 0, extraKeys = []) => {
  const keys = [...CHARGE_KEYS, ...extraKeys];
  const qtys = { ...emptyChargeQtys(extraKeys), ...(settings?.qtys || {}) };
  keys.forEach(k => {
    if (isMaterialQtyCharge(k)) {
      const saved = settings?.qtys?.[k];
      const savedNum = saved === '' || saved == null ? 0 : parseFloat(saved);
      if (!savedNum) {
        qtys[k] = materialQty || '';
      }
    }
  });
  return qtys;
};

/** Copy MR / saved qtys exactly — no material-qty substitution. */
export const copyChargeQtysFromSettings = (settings, extraKeys = []) => ({
  ...emptyChargeQtys(extraKeys),
  ...(settings?.qtys || {})
});

export const getChargeLineQty = (qtys, key) =>
  parseChargeNumber(qtys?.[key], 0);

export const calcStandardChargesSubtotal = (charges, rates, qtys, materialQty = 0, keys = CHARGE_KEYS) =>
  keys.reduce((sum, key) => {
    if (!charges?.[key]) return sum;
    const rate = parseChargeNumber(rates?.[key], 0);
    const lineQty = getChargeLineQty(qtys, key);
    return sum + lineQty * rate;
  }, 0);

export const defaultChargeFlags = (overrides = {}) => ({
  cleaning: true,
  filterBag: false,
  processing: true,
  sieving: false,
  psdReport: false,
  liner: false,
  courier: false,
  fiberDrum: false,
  transportation: false,
  hdpeDrum: false,
  batchChangeover: false,
  ...overrides
});

export const defaultChargeRates = () => emptyChargeRates();

export const emptyChargeFlagsOnly = () =>
  Object.fromEntries(CHARGE_KEYS.map(k => [k, false]));

const normProduct = (s) => (s || '').trim().toLowerCase();

const pickSettingsEntry = (map, name) => {
  if (!name || !map) return null;
  if (map[name]) return map[name];
  const want = normProduct(name);
  const key = Object.keys(map).find((k) => {
    if (normProduct(k) === want) return true;
    const base = String(k).includes('|||') ? String(k).split('|||')[0] : k;
    return normProduct(base) === want;
  });
  return key ? map[key] : null;
};

/** Resolve the MR productSettings block for billing (PI/TI/PO). */
export const readMRProductChargeBlock = (mr, party, hintName = '') => {
  const map = mr?.productSettings || {};
  const keys = Object.keys(map);
  if (!keys.length) return null;

  const prodOpts = { party };
  const tryNames = [];
  const addName = (n) => {
    const t = (n || '').trim();
    if (!t) return;
    if (!tryNames.some(x => normProduct(x) === normProduct(t))) tryNames.push(t);
  };

  getActiveReceiptProductNames(mr, party).forEach(addName);
  getReceiptProductNames(mr, prodOpts).forEach(addName);
  String(hintName || '').split(',').forEach(p => addName(p.trim()));
  if (mr?.productName) addName(mr.productName);
  (mr?.batches || []).forEach(b => {
    if (!b.isEmptyDrums && b.productName) addName(b.productName);
  });

  for (const name of tryNames) {
    const block = pickSettingsEntry(map, name);
    if (block) return block;
  }

  const activeNorms = new Set(tryNames.map(normProduct));
  let best = null;
  let bestScore = -1;
  for (const [key, block] of Object.entries(map)) {
    const base = String(key).includes('|||') ? String(key).split('|||')[0] : key;
    if (
      activeNorms.size
      && !activeNorms.has(normProduct(key))
      && !activeNorms.has(normProduct(base))
    ) continue;
    const score = CHARGE_KEYS.filter(k => block?.charges?.[k]).length;
    if (score > bestScore) {
      bestScore = score;
      best = block;
    }
  }
  if (best && bestScore > 0) return best;

  if (keys.length === 1) return map[keys[0]];

  best = null;
  bestScore = -1;
  for (const block of Object.values(map)) {
    const score = CHARGE_KEYS.filter(k => block?.charges?.[k]).length;
    if (score > bestScore) {
      bestScore = score;
      best = block;
    }
  }
  return bestScore > 0 ? best : map[keys[0]];
};


export const getActiveReceiptProductNames = (mr, party) => {
  const prodOpts = { party };
  const names = getReceiptProductNames(mr, prodOpts).filter(n =>
    getProductBatches(mr, n, prodOpts).length > 0
  );
  if (names.length) return names;
  const hint = mr?.productName || '';
  if (hint.includes(',')) return hint.split(',').map(s => s.trim()).filter(Boolean);
  const primary = resolvePrimaryReceiptProduct(mr, party, hint);
  return primary ? [primary] : [];
};

export const buildProductChargeSettingsFromParty = (prodConfig) => {
  if (!prodConfig) {
    return {
      rates: emptyChargeRates(),
      charges: emptyChargeFlags(),
      qtys: emptyChargeQtys(),
      customCharges: []
    };
  }
  const c = prodConfig.charges || {};
  const psdRate = prodConfig.psdMethodDefault === 'Wet'
    ? (c.psdReportWet ?? c.psdReport ?? 0)
    : (c.psdReportDry ?? c.psdReport ?? 0);
  const rates = {
    cleaning: c.cleaning || 0,
    filterBag: c.filterBag || 0,
    processing: c.processing || 0,
    sieving: c.sieving || 0,
    psdReport: psdRate,
    liner: c.liner || 0,
    courier: c.courier || 0,
    fiberDrum: c.fiberDrum || 0,
    transportation: c.transportation || 0,
    hdpeDrum: c.hdpeDrum || 0,
    batchChangeover: c.batchChangeover || 0
  };
  const charges = Object.fromEntries(
    CHARGE_KEYS.map(k => [k, (rates[k] || 0) > 0])
  );
  return {
    rates,
    charges,
    qtys: emptyChargeQtys(),
    customCharges: (prodConfig.customCharges || []).map(cc => ({
      ...cc,
      checked: cc.checked !== false,
      qty: parseChargeNumber(cc.qty, 0)
    }))
  };
};

const parseChargeSlotKey = (key) => {
  const raw = String(key || '');
  if (raw.includes('|||')) {
    const [name, ...rest] = raw.split('|||');
    return { name: String(name || '').trim(), micron: rest.join('|||').trim() };
  }
  return { name: raw.trim(), micron: '' };
};

export const formatChargeSlotLabel = (key) => {
  const { name, micron } = parseChargeSlotKey(key);
  if (!name) return key || 'Product';
  return micron ? `${name} (${micron})` : name;
};

/** Qty for a PI charge slot (supports name|||psd keys). */
export const getChargeSlotQty = (mr, slotKey, options = {}) => {
  const { name, micron } = parseChargeSlotKey(slotKey);
  if (!name) return 0;
  const productBatches = (mr?.batches || []).filter(
    (b) => !b.isEmptyDrums && normProduct(b.productName) === normProduct(name)
  );
  if (micron) {
    const matchedQty = productBatches
      .filter((b) => normProduct(b.psdReq) === normProduct(micron))
      .reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
    if (matchedQty > 0) return matchedQty;

    // Legacy batches without psdReq: use unlabeled qty only for the first micron slot of this product
    const unlabeledQty = productBatches
      .filter((b) => !String(b.psdReq || '').trim())
      .reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
    if (unlabeledQty > 0) {
      const micronKeys = Object.keys(mr?.productSettings || {})
        .map(parseChargeSlotKey)
        .filter((p) => normProduct(p.name) === normProduct(name) && p.micron);
      const firstMicron = micronKeys[0]?.micron || '';
      if (!micronKeys.length || normProduct(firstMicron) === normProduct(micron)) {
        return unlabeledQty;
      }
    }
    return 0;
  }
  return getProductQty(mr, name, options);
};

/**
 * Distinct charge slots on an MR — same product name with different PSD/rates
 * become separate slots so each processing rate is counted.
 */
export const getMRChargeSlots = (mr, party, productOptions = {}) => {
  const prodOpts = { party, ...productOptions };
  const productNames = getReceiptProductNames(mr, prodOpts);
  const slots = [];
  const seen = new Set();

  const pushSlot = (name, micron = '') => {
    const n = String(name || '').trim();
    if (!n) return;
    const m = String(micron || '').trim();
    const key = m ? `${n}|||${m}` : n;
    const id = key.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    slots.push({ key, name: n, micron: m });
  };

  Object.entries(mr?.productSettings || {}).forEach(([key, block]) => {
    const parsed = parseChargeSlotKey(key);
    const micron = parsed.micron || String(block?.micronSize || '').trim();
    const base = parsed.name || key;
    if (
      productNames.some((n) => normProduct(n) === normProduct(base))
      || (mr?.batches || []).some((b) => !b.isEmptyDrums && normProduct(b.productName) === normProduct(base))
    ) {
      pushSlot(base, micron);
    }
  });

  (mr?.batches || []).forEach((b) => {
    if (b.isEmptyDrums) return;
    pushSlot(b.productName, b.psdReq || '');
  });

  if (!slots.length) {
    productNames.forEach((n) => pushSlot(n, ''));
  }

  // Drop plain-name slot when micron-specific slots exist for that name
  const hasMicronFor = (name) =>
    slots.some((s) => normProduct(s.name) === normProduct(name) && s.micron);
  return slots.filter((s) => s.micron || !hasMicronFor(s.name));
};

/** Read saved charge settings for one product on a Material Receipt. */
export const getMRProductChargeSettings = (mr, party, prodName, micronHint = '') => {
  const parsed = parseChargeSlotKey(prodName);
  const baseName = parsed.name || prodName;
  const micron = String(micronHint || parsed.micron || '').trim();
  const map = mr?.productSettings || {};

  if (micron) {
    const slotKey = `${baseName}|||${micron}`;
    if (map[slotKey]) return map[slotKey];
    const byMicron = Object.entries(map).find(([k, v]) => {
      const p = parseChargeSlotKey(k);
      return normProduct(p.name || k) === normProduct(baseName)
        && (normProduct(p.micron) === normProduct(micron) || normProduct(v?.micronSize) === normProduct(micron));
    });
    if (byMicron) return byMicron[1];
  }

  const block = readMRProductChargeBlock(mr, party, baseName);
  if (block && (!micron || !block.micronSize || normProduct(block.micronSize) === normProduct(micron))) {
    return block;
  }

  const hasProductSettings = Object.keys(map).length > 0;
  if (!hasProductSettings && (mr?.charges || mr?.rates || mr?.qtys)) {
    return {
      rates: { ...emptyChargeRates(), ...(mr.rates || {}) },
      charges: { ...emptyChargeFlagsOnly(), ...(mr.charges || {}) },
      qtys: { ...emptyChargeQtys(), ...(mr.qtys || {}) },
      customCharges: mr.customCharges || []
    };
  }

  const products = party?.products || [];
  const want = normProduct(baseName);
  const psd = micron.toLowerCase()
    || String(
      block?.micronSize
      || (mr?.batches || []).find((b) => !b.isEmptyDrums && normProduct(b.productName) === want)?.psdReq
      || ''
    ).trim().toLowerCase();
  const prodConfig = (psd
    ? products.find((p) => normProduct(p.name) === want && String(p.psdReq || '').trim().toLowerCase() === psd)
    : null)
    || products.find((p) => normProduct(p.name) === want);
  return buildProductChargeSettingsFromParty(prodConfig);
};

/** Qty keys that are per-product (sum across products). Others are receipt-level common charges. */
const PER_PRODUCT_QTY_KEYS = new Set(['processing', 'sieving']);

const mergeProductChargeSettings = (mr, party, productNames) => {
  const prodOpts = { party };
  const merged = {
    charges: emptyChargeFlagsOnly(),
    rates: emptyChargeRates(),
    qtys: emptyChargeQtys(),
    customCharges: []
  };

  // Prefer top-level MR qtys for common charges (user-entered once on the receipt)
  const topQtys = mr?.qtys || {};

  productNames.forEach((prodName) => {
    const s = getMRProductChargeSettings(mr, party, prodName);
    CHARGE_KEYS.forEach((key) => {
      if (s.charges?.[key]) {
        merged.charges[key] = true;
        if (PER_PRODUCT_QTY_KEYS.has(key) || !parseChargeNumber(merged.rates[key], 0)) {
          merged.rates[key] = parseChargeNumber(s.rates?.[key], merged.rates[key] || 0);
        }
      }
      const saved = s.qtys?.[key];
      const lineQty = saved != null && saved !== ''
        ? parseChargeNumber(saved, 0)
        : 0;
      if (PER_PRODUCT_QTY_KEYS.has(key)) {
        // Processing / sieving: sum each product's qty
        if (s.charges?.[key] || lineQty) {
          merged.qtys[key] = parseChargeNumber(merged.qtys[key], 0) + lineQty;
        }
      } else if (isMaterialQtyCharge(key) || s.charges?.[key]) {
        // Common charges (cleaning, etc.): same value is copied onto every product — keep once
        const top = topQtys[key];
        if (top !== '' && top != null && Number.isFinite(parseFloat(top))) {
          merged.qtys[key] = parseChargeNumber(top, 0);
        } else if (!parseChargeNumber(merged.qtys[key], 0) && lineQty) {
          merged.qtys[key] = lineQty;
        }
      }
    });
    (s.customCharges || []).forEach((cc) => merged.customCharges.push({ ...cc }));
  });

  return merged;
};

export const snapshotChargesFromSettings = (settings, materialQty = 0, extraKeys = [], { fromSavedReceipt = false } = {}) => ({
  charges: { ...emptyChargeFlagsOnly(), ...(settings.charges || {}) },
  rates: { ...emptyChargeRates(extraKeys), ...(settings.rates || {}) },
  qtys: fromSavedReceipt
    ? copyChargeQtysFromSettings(settings, extraKeys)
    : buildChargeQtys(settings, materialQty, extraKeys)
});

export const snapshotChargesFromSavedDoc = (doc, extraKeys = []) => ({
  charges: { ...emptyChargeFlagsOnly(), ...(doc?.charges || {}) },
  rates: { ...emptyChargeRates(extraKeys), ...(doc?.rates || {}) },
  qtys: { ...emptyChargeQtys(extraKeys), ...(doc?.qtys || {}) },
  customCharges: (doc?.customCharges || []).length
    ? JSON.parse(JSON.stringify(doc.customCharges))
    : []
});

const pickProductChargeBlock = (productCharges, mr, party, productName) => {
  if (!productCharges || !Object.keys(productCharges).length) return null;
  const canonical = resolvePrimaryReceiptProduct(mr, party, productName);
  if (productCharges[canonical]) return productCharges[canonical];
  const matchedKey = Object.keys(productCharges).find(k => normProduct(k) === normProduct(canonical));
  if (matchedKey) return productCharges[matchedKey];
  return Object.values(productCharges)[0] || null;
};

/** Read charges from a saved PI/TI (flat fields or Under Process productCharges). */
export const extractChargeSettingsFromDoc = (doc, mr, party, productName) => {
  if (!doc) return null;
  const pc = pickProductChargeBlock(doc.productCharges, mr, party, productName);
  if (pc) {
    return snapshotChargesFromSettings(pc, 0, [], { fromSavedReceipt: true });
  }
  if (doc.charges || doc.rates || doc.qtys || doc.customCharges?.length) {
    return snapshotChargesFromSavedDoc(doc);
  }
  return null;
};

/** One PI per Material Receipt — ignores per-product duplicate records. */
export const findAnyProformaInvoice = (invoices, receiptId) =>
  (invoices || []).find(inv =>
    inv.receiptId === receiptId &&
    !inv.isDeleted &&
    (inv.type === 'Proforma Invoice' || inv.invoiceNo?.includes('/PI/'))
  ) || null;

/** One TI per Material Receipt — ignores per-product duplicate records. */
/** Separate (per-receipt) Tax Invoice only — monthly consolidated TIs are ignored. */
export const findAnyTaxInvoice = (invoices, receiptId) =>
  (invoices || []).find(inv =>
    inv.receiptId === receiptId &&
    !inv.isDeleted &&
    !inv.monthlyBilling &&
    (inv.type === 'Tax Invoice' || inv.invoiceNo?.includes('/IN/'))
  ) || null;

export const findProformaInvoice = (invoices, receiptId, productName = '') => {
  const any = findAnyProformaInvoice(invoices, receiptId);
  if (!any) return null;
  if (!productName) return any;
  return any;
};

/** One PI per product — ignores old combined PIs with comma-separated product names. */
export const findDedicatedProformaInvoice = (invoices, receiptId, productName = '') =>
  findDedicatedReceiptDoc(
    (invoices || []).filter(inv =>
      !inv.isDeleted &&
      (inv.type === 'Proforma Invoice' || inv.invoiceNo?.includes('/PI/'))
    ),
    receiptId,
    productName
  );

const preferTopLevelCommonQtys = (block, mr) => {
  if (!block) return block;
  const qtys = { ...emptyChargeQtys(), ...(block.qtys || {}) };
  CHARGE_KEYS.forEach((key) => {
    if (PER_PRODUCT_QTY_KEYS.has(key)) return;
    const top = mr?.qtys?.[key];
    if (top !== '' && top != null) qtys[key] = top;
  });
  return { ...block, qtys };
};

/** Flatten MR productSettings (or legacy top-level fields) for downstream PI/TI/PO. */
export const flattenMRChargeSnapshot = (mr, party) => {
  const productNames = getActiveReceiptProductNames(mr, party);
  if (productNames.length > 1) {
    return preferTopLevelCommonQtys(mergeProductChargeSettings(mr, party, productNames), mr);
  }

  const block = readMRProductChargeBlock(
    mr,
    party,
    productNames[0] || mr?.productName || ''
  );
  if (block) return preferTopLevelCommonQtys(block, mr);

  const hasProductSettings = Object.keys(mr?.productSettings || {}).length > 0;
  if (!hasProductSettings && (mr?.charges || mr?.rates || mr?.qtys)) {
    return {
      rates: { ...emptyChargeRates(), ...(mr.rates || {}) },
      charges: { ...emptyChargeFlagsOnly(), ...(mr.charges || {}) },
      qtys: { ...emptyChargeQtys(), ...(mr.qtys || {}) },
      customCharges: mr.customCharges || []
    };
  }
  return null;
};

export const resolvePrimaryReceiptProduct = (mr, party, hintProductName) => {
  const prodOpts = { party };
  if (hintProductName && !String(hintProductName).includes(',')) {
    return resolveReceiptProductName(mr, hintProductName, prodOpts);
  }
  const names = getReceiptProductNames(mr, prodOpts);
  return names[0] || String(hintProductName || '').split(',')[0]?.trim() || mr?.productName || '';
};

/** Pull charges, rates, qtys, and custom charges from MR for PI/TI/PO forms. */
export const resolveReceiptChargesForDoc = (mr, party, options = {}) => {
  const { productName: hint, materialQty: qtyOverride } = options;
  const prodOpts = { party };
  const productNames = getActiveReceiptProductNames(mr, party);
  const primaryProduct = productNames[0]
    || resolvePrimaryReceiptProduct(mr, party, hint || mr?.productName || '');

  const settings = flattenMRChargeSnapshot(mr, party)
    || getMRProductChargeSettings(mr, party, primaryProduct);

  const materialQty = qtyOverride ?? (
    (productNames.length > 1
      ? (parseFloat(mr?.totalQty) || 0)
      : (primaryProduct ? getProductQty(mr, primaryProduct, prodOpts) : (parseFloat(mr?.totalQty) || 0)))
    || parseFloat(mr?.totalQty)
    || 0
  );

  const customSource = settings.customCharges?.length
    ? settings.customCharges
    : (mr?.customCharges || []);

  const snapshot = snapshotChargesFromSettings(settings, materialQty, [], { fromSavedReceipt: true });

  return {
    ...snapshot,
    customCharges: customSource.length ? JSON.parse(JSON.stringify(customSource)) : []
  };
};

/**
 * Commercial + financial terms from linked PI for a Tax Invoice.
 * Clones PI charges/discount/tax/totals as-is so TI matches PI exactly.
 */
export const getLinkedPITermsForTI = (invoices, receiptId) => {
  const pi = findAnyProformaInvoice(invoices, receiptId);
  if (!pi) return null;

  let productCharges = null;
  if (pi.productCharges && Object.keys(pi.productCharges).length > 0) {
    productCharges = sanitizeProductCharges(pi.productCharges);
  } else if (pi.charges || pi.rates || pi.qtys) {
    const target = pi.productName?.includes(',')
      ? String(pi.productName).split(',')[0].trim()
      : (pi.productName || 'Product');
    productCharges = sanitizeProductCharges({
      [target]: {
        charges: pi.charges || {},
        rates: pi.rates || {},
        qtys: pi.qtys || {}
      }
    });
  }

  return {
    pi,
    productCharges,
    discount: parseFloat(pi.discount) || 0,
    taxRate: pi.taxRate ?? 18,
    gstType: pi.gstType === 'igst' ? 'igst' : 'cgst_sgst',
    customCharges: Array.isArray(pi.customCharges)
      ? JSON.parse(JSON.stringify(pi.customCharges))
      : [],
    qty: parseFloat(pi.qty) || 0,
    subtotal: pi.subtotal,
    taxAmount: pi.taxAmount,
    total: pi.total
  };
};

/** Copy PI money fields onto a TI so both documents show the same total. */
export const applyProformaFinancialsToTaxInvoice = (ti, piOrTerms) => {
  if (!ti || !piOrTerms) return ti;
  const pi = piOrTerms.pi || piOrTerms;
  const terms = piOrTerms.productCharges !== undefined || piOrTerms.pi
    ? piOrTerms
    : getLinkedPITermsForTI([pi, ti], pi.receiptId || ti.receiptId);
  if (!terms && typeof pi.total !== 'number') return ti;

  const productCharges = terms?.productCharges
    || (pi.productCharges ? sanitizeProductCharges(pi.productCharges) : ti.productCharges);
  const discount = terms ? terms.discount : (parseFloat(pi.discount) || 0);
  const taxRate = terms ? terms.taxRate : (pi.taxRate ?? ti.taxRate ?? 18);
  const gstType = (terms?.gstType || pi.gstType || ti.gstType) === 'igst' ? 'igst' : 'cgst_sgst';
  const customCharges = terms?.customCharges?.length
    ? terms.customCharges
    : (Array.isArray(pi.customCharges) ? JSON.parse(JSON.stringify(pi.customCharges)) : (ti.customCharges || []));
  const qty = (terms?.qty > 0 ? terms.qty : null)
    ?? (parseFloat(pi.qty) > 0 ? parseFloat(pi.qty) : null)
    ?? ti.qty;
  const subtotal = typeof pi.subtotal === 'number' ? pi.subtotal : ti.subtotal;
  const taxAmount = typeof pi.taxAmount === 'number' ? pi.taxAmount : ti.taxAmount;
  const total = typeof pi.total === 'number' ? pi.total : ti.total;

  return {
    ...ti,
    productCharges: productCharges || ti.productCharges,
    customCharges,
    discount,
    taxRate,
    gstType,
    qty,
    subtotal,
    taxAmount,
    total,
    charges: productCharges
      ? (Object.values(productCharges)[0]?.charges || ti.charges)
      : ti.charges,
    rates: productCharges
      ? (Object.values(productCharges)[0]?.rates || ti.rates)
      : ti.rates,
    qtys: productCharges
      ? (Object.values(productCharges)[0]?.qtys || ti.qtys)
      : ti.qtys
  };
};

/**
 * Previously forced every TI to match its linked PI total.
 * Disabled so direct TI edits persist in the list and print.
 * New TIs still seed from PI in the create form.
 */
export const syncAllTaxInvoicesWithProformas = (invoices = []) => ({
  invoices,
  changed: false
});

/** TI charges: prefer exact PI product blocks, fall back to MR settings. */
export const resolveTIProductChargesForDoc = (mr, party, invoices, prodOpts = {}) => {
  const terms = getLinkedPITermsForTI(invoices, mr?.id);
  if (terms?.productCharges && Object.keys(terms.productCharges).length > 0) {
    return terms.productCharges;
  }
  return initProductChargesFromMR(mr, party, prodOpts);
};

/** TI charges: prefer saved PI, fall back to Material Receipt product settings. */
export const resolveTIChargesForDoc = (mr, party, invoices, options = {}) => {
  const { productName: hint, materialQty: qtyOverride } = options;
  const hintStr = hint || mr?.productName || '';
  const scopedProduct = String(hintStr).includes(',')
    ? hintStr.split(',')[0]?.trim()
    : resolvePrimaryReceiptProduct(mr, party, hintStr);

  const pi = findProformaInvoice(invoices, mr?.id, scopedProduct);
  const fromPI = extractChargeSettingsFromDoc(pi, mr, party, scopedProduct);
  if (fromPI) {
    return fromPI;
  }
  return resolveReceiptChargesForDoc(mr, party, options);
};

export const mergeSavedDocCharges = (doc, _materialQty = 0) => ({
  charges: { ...emptyChargeFlagsOnly(), ...(doc?.charges || {}) },
  rates: { ...emptyChargeRates(), ...(doc?.rates || {}) },
  qtys: { ...emptyChargeQtys(), ...(doc?.qtys || {}) },
  customCharges: doc?.customCharges || []
});

export const getFreshMaterialReceipt = (materialReceipts, mrOrId) => {
  const id = typeof mrOrId === 'object' ? mrOrId?.id : mrOrId;
  return (materialReceipts || []).find(mr => mr.id === id) || (typeof mrOrId === 'object' ? mrOrId : null);
};

/** Per-product charge blocks from MR productSettings (for multi-product PI). */
export const initProductChargesFromMR = (mr, party, productOptions = {}) => {
  const prodOpts = { party, ...productOptions };
  const slots = getMRChargeSlots(mr, party, prodOpts);
  const result = {};
  const baseSeen = new Set();

  slots.forEach((slot, index) => {
    const settings = getMRProductChargeSettings(mr, party, slot.name, slot.micron);
    const materialQty = getChargeSlotQty(mr, slot.key, prodOpts);
    const baseId = normProduct(slot.name);
    baseSeen.add(baseId);

    // First slot keeps receipt-level common charges; every later slot is processing-only
    // so cleaning qty is not counted once per product (e.g. 2 → 4).
    if (index > 0) {
      const processingOn = !!settings.charges?.processing
        || (parseChargeNumber(settings.rates?.processing, 0) > 0);
      result[slot.key] = {
        charges: {
          ...emptyChargeFlagsOnly(),
          processing: processingOn
        },
        rates: {
          ...emptyChargeRates(),
          processing: parseChargeNumber(settings.rates?.processing, 0)
        },
        qtys: {
          ...emptyChargeQtys(),
          processing: materialQty || ''
        }
      };
      return;
    }

    const qtys = buildChargeQtys(settings, materialQty);
    // Prefer top-level MR common qtys when present (single source of truth)
    CHARGE_KEYS.forEach((key) => {
      if (PER_PRODUCT_QTY_KEYS.has(key)) return;
      const top = mr?.qtys?.[key];
      if (top !== '' && top != null) qtys[key] = top;
    });

    result[slot.key] = {
      charges: { ...emptyChargeFlagsOnly(), ...(settings.charges || {}) },
      rates: { ...emptyChargeRates(), ...(settings.rates || {}) },
      qtys
    };
  });

  if (!slots.length && mr?.productName) {
    const settings = getMRProductChargeSettings(mr, party, mr.productName);
    const materialQty = parseFloat(mr.totalQty) || parseFloat(mr.receivedQty) || 0;
    result[mr.productName] = {
      charges: { ...emptyChargeFlagsOnly(), ...(settings.charges || {}) },
      rates: { ...emptyChargeRates(), ...(settings.rates || {}) },
      qtys: buildChargeQtys(settings, materialQty)
    };
  }
  return result;
};

export const normalizeProductChargesFromDoc = (productCharges, legacyDoc, mr, prodOpts, party) => {
  const fromMR = initProductChargesFromMR(mr, party, prodOpts);
  if (productCharges && Object.keys(productCharges).length > 0) {
    const merged = { ...fromMR };
    Object.entries(productCharges).forEach(([name, pc]) => {
      const matchKey = Object.keys(merged).find(k => normProdKey(k) === normProdKey(name)) || name;
      merged[matchKey] = {
        charges: { ...emptyChargeFlagsOnly(), ...(merged[matchKey]?.charges || {}), ...(pc.charges || {}) },
        rates: { ...emptyChargeRates(), ...(merged[matchKey]?.rates || {}), ...(pc.rates || {}) },
        qtys: { ...emptyChargeQtys(), ...(merged[matchKey]?.qtys || {}), ...(pc.qtys || {}) }
      };
    });
    return merged;
  }
  if (legacyDoc?.charges || legacyDoc?.rates) {
    const names = getReceiptProductNames(mr, prodOpts);
    const target = names[0] || mr?.productName || 'Product';
    const matchKey = Object.keys(fromMR).find(k => normProdKey(k) === normProdKey(target)) || target;
    return {
      ...fromMR,
      [matchKey]: {
        charges: { ...emptyChargeFlagsOnly(), ...(fromMR[matchKey]?.charges || {}), ...(legacyDoc.charges || {}) },
        rates: { ...emptyChargeRates(), ...(fromMR[matchKey]?.rates || {}), ...(legacyDoc.rates || {}) },
        qtys: { ...emptyChargeQtys(), ...(fromMR[matchKey]?.qtys || {}), ...(legacyDoc.qtys || {}) }
      }
    };
  }
  return fromMR;
};

const chargeSlotBaseName = (key) => {
  const raw = String(key || '');
  return (raw.includes('|||') ? raw.split('|||')[0] : raw).trim();
};

export const isUmaNewDrumRow = (row) => {
  if (!row) return false;
  if (row.umaNewDrum) return true;
  const name = String(row.batchNo || '').trim().toLowerCase();
  return name === 'new uma drum' || name === 'uma new drum';
};

/** Charge block the TI form should read for a product (plain name or name|||PSD). */
export const resolveProductChargeKey = (productCharges, prodName) => {
  const keys = Object.keys(productCharges || {});
  if (!prodName) return keys[0] || '';
  const exact = keys.find((k) => normProduct(k) === normProduct(prodName));
  if (exact) return exact;
  const base = keys.find((k) => normProduct(chargeSlotBaseName(k)) === normProduct(chargeSlotBaseName(prodName)));
  return base || prodName;
};

const umaDrumBillRate = (party, productName, stockItems) => {
  const want = normProduct(chargeSlotBaseName(productName));
  const products = (party?.products || []).filter((p) => normProduct(p.name) === want);
  const priced = products.find((p) => parseChargeNumber(p?.charges?.hdpeDrum, 0) > 0);
  const partyRate = parseChargeNumber((priced || products[0])?.charges?.hdpeDrum, 0);
  if (partyRate > 0) return partyRate;
  const stock = (stockItems || []).find((item) => item && !item.isDeleted && (
    item.tracksUmaDrums || /^hdpe drum$/i.test(String(item.name || '').trim())
  ));
  return parseChargeNumber(stock?.rate, 0);
};

export const sumHdpeDrumQty = (productCharges) =>
  Object.values(productCharges || {}).reduce(
    (sum, pc) => sum + parseChargeNumber(pc?.qtys?.hdpeDrum, 0),
    0
  );

/**
 * Put each packing-list New Uma Drum on the TI as an HDPE Drum line.
 * Qty is the drum count. Rate stays if already set, otherwise the party HDPE rate
 * (then the stock HDPE rate).
 */
export const applyUmaNewDrumCharge = (productCharges, options = {}) => {
  const source = productCharges && typeof productCharges === 'object' ? productCharges : {};
  const next = { ...source };
  const batches = options.batches || options.packingList?.batches || [];
  const counts = new Map();
  let loose = 0;
  batches.forEach((row) => {
    if (!isUmaNewDrumRow(row)) return;
    const name = String(row.productName || '').trim();
    if (!name) {
      loose += 1;
      return;
    }
    const id = normProduct(name);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0) + loose;
  if (!total) return next;

  const write = (key, count, rateName) => {
    if (!key || count <= 0) return;
    const pc = next[key] || {
      charges: emptyChargeFlagsOnly(),
      rates: emptyChargeRates(),
      qtys: emptyChargeQtys()
    };
    const currentRate = parseChargeNumber(pc.rates?.hdpeDrum, 0);
    const rate = currentRate > 0 ? currentRate : umaDrumBillRate(options.party, rateName, options.stockItems);
    next[key] = {
      ...pc,
      charges: { ...emptyChargeFlagsOnly(), ...(pc.charges || {}), hdpeDrum: true },
      rates: { ...emptyChargeRates(), ...(pc.rates || {}), hdpeDrum: rate },
      qtys: { ...emptyChargeQtys(), ...(pc.qtys || {}), hdpeDrum: count }
    };
  };

  const keys = Object.keys(next);
  const claimed = new Set();
  keys.forEach((key) => {
    const id = normProduct(chargeSlotBaseName(key));
    if (!counts.has(id) || claimed.has(id)) return;
    claimed.add(id);
    write(key, counts.get(id), chargeSlotBaseName(key));
  });

  let extra = loose;
  counts.forEach((count, id) => {
    if (!claimed.has(id)) extra += count;
  });
  if (extra > 0) {
    const target = keys[0] || options.fallbackName || 'Product';
    const already = parseChargeNumber(next[target]?.qtys?.hdpeDrum, 0);
    write(target, already + extra, chargeSlotBaseName(target));
  }
  return next;
};

export const sanitizeProductCharges = (productCharges) => {
  if (!productCharges) return {};
  return Object.fromEntries(
    Object.entries(productCharges).map(([prodName, pc]) => [prodName, {
      charges: { ...emptyChargeFlagsOnly(), ...(pc.charges || {}) },
      rates: Object.fromEntries(CHARGE_KEYS.map(k => [k, parseChargeNumber(pc.rates?.[k], 0)])),
      qtys: Object.fromEntries(CHARGE_KEYS.map(k => [k, parseChargeNumber(pc.qtys?.[k], 0)]))
    }])
  );
};

export const calcProductChargesSubtotal = (productCharges, mr, prodOpts) =>
  Object.entries(productCharges || {}).reduce((sum, [prodName, pc]) => {
    const slotQty = getChargeSlotQty(mr, prodName, prodOpts);
    return sum + CHARGE_KEYS.reduce((lineSum, key) => {
      if (!pc.charges?.[key]) return lineSum;
      const rate = parseChargeNumber(pc.rates?.[key], 0);
      const lineQty = key === 'processing'
        ? (slotQty || getChargeLineQty(pc.qtys, key))
        : getChargeLineQty(pc.qtys, key);
      return lineSum + lineQty * rate;
    }, 0);
  }, 0);

export const calcProductChargesSubtotalWithQty = (productCharges, qtyForProduct) =>
  Object.entries(productCharges || {}).reduce((sum, [prodName, pc]) => {
    const materialQty = qtyForProduct(prodName);
    return sum + CHARGE_KEYS.reduce((lineSum, key) => {
      if (!pc.charges?.[key]) return lineSum;
      const rate = parseChargeNumber(pc.rates?.[key], 0);
      const lineQty = key === 'processing'
        ? materialQty
        : getChargeLineQty(pc.qtys, key);
      return lineSum + lineQty * rate;
    }, 0);
  }, 0);

/** Prefer saved doc charges; only fill missing products from fallback (never re-enable MR-only flags). */
const mergeSavedChargesPreferDoc = (savedCharges, fallbackCharges) => {
  const saved = sanitizeProductCharges(savedCharges);
  const fallback = fallbackCharges || {};
  if (Object.keys(saved).length > 0) {
    const merged = { ...fallback };
    Object.entries(saved).forEach(([name, pc]) => {
      const matchKey = Object.keys(merged).find(k => normProdKey(k) === normProdKey(name)) || name;
      merged[matchKey] = pc;
    });
    return merged;
  }
  return fallback;
};

/** Merge MR product breakdown + per-product charges before PI PDF export. */
export const enrichPIForPrint = (pi, appData = {}) => {
  if (!pi) return pi;
  let next = { ...pi };
  if (pi.receiptId) {
    const mr = getFreshMaterialReceipt(appData.materialReceipts, pi.receiptId);
    if (mr) {
      const prodOpts = receiptProductOptions(mr, appData);
      const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const fromMR = initProductChargesFromMR(mr, prodOpts.party, prodOpts);
      const mergedCharges = mergeSavedChargesPreferDoc(pi.productCharges, fromMR);
      const savedQty = parseFloat(pi.qty) || 0;
      const liveQty = getMRReceivedQty(mr, prodOpts);

      let hsnCode = String(pi.hsnCode || pi.hsn || '').trim();
      if (!hsnCode) {
        const names = [
          ...(summaries.length ? summaries : (pi.productSummaries || [])).map((p) => p.prodName),
          pi.productName
        ].filter(Boolean);
        for (const name of names) {
          const prod = (prodOpts.party?.products || []).find(
            (p) => String(p.name || '').trim().toLowerCase() === String(name).trim().toLowerCase()
          );
          if (prod?.hsn) {
            hsnCode = String(prod.hsn).trim();
            break;
          }
        }
      }

      next = {
        ...pi,
        partyDocNo: pi.partyDocNo || mr.partyDocNo || '',
        partyDocDate: pi.partyDocDate || mr.partyDocDate || '',
        billAddress: String(pi.billAddress || '').trim() || mr.billAddress || prodOpts.party?.billAddress || '',
        shipAddress: String(pi.shipAddress || '').trim() || mr.shipAddress || prodOpts.party?.shipAddress || '',
        gstinBill: pi.gstinBill || mr.gstinBill || prodOpts.party?.gstinBill || '',
        gstinShip: pi.gstinShip || mr.gstinShip || prodOpts.party?.gstinShip || '',
        productName: summaries.length ? getReceiptProductLabel(mr, prodOpts) : pi.productName,
        productSummaries: summaries.length ? summaries : (pi.productSummaries || []),
        productCharges: mergedCharges,
        hsnCode,
        qty: savedQty > 0 ? savedQty : (liveQty || pi.qty)
      };
    }
  }
  return fillPrintPartyFields(next, appData);
};

/** Merge MR/PI/PL data into a TI before PDF export (one bill, all products). */
export const enrichTIForPrint = (ti, appData = {}) => {
  if (!ti) return ti;

  // Monthly consolidated invoices: use the summary roll-up (charges/rates/qtys), not a single MR.
  if (ti.monthlyBilling) {
    const parties = appData.parties || [];
    const party = parties.find((p) => String(p.id) === String(ti.partyId))
      || parties.find((p) => String(p.name || '').trim().toLowerCase() === String(ti.partyName || '').trim().toLowerCase());
    const hasSummaryCharges = ti.charges && Object.keys(ti.charges).some((key) => ti.charges[key]);
    const charges = (ti.customCharges || []).map((cc, idx) => {
      const name = String(cc.name || cc.description || '').trim();
      const qty = parseFloat(cc.qty) || 0;
      const rate = parseFloat(cc.rate) || 0;
      const amount = parseFloat(cc.amount) || qty * rate;
      return {
        ...cc,
        id: cc.id || `mb-cc-${idx}`,
        name,
        description: name,
        qty,
        rate: rate || (qty > 0 ? +(amount / qty).toFixed(2) : amount),
        checked: cc.checked !== false
      };
    });
    return fillPrintPartyFields({
      ...ti,
      type: 'Tax Invoice',
      billAddress: String(ti.billAddress || '').trim() || party?.billAddress || '',
      shipAddress: String(ti.shipAddress || '').trim() || party?.shipAddress || party?.billAddress || '',
      gstinBill: ti.gstinBill || party?.gstinBill || party?.gstin || '',
      gstinShip: ti.gstinShip || party?.gstinShip || party?.gstinBill || '',
      productCharges: ti.productCharges || {},
      charges: ti.charges || {},
      rates: ti.rates || {},
      qtys: ti.qtys || {},
      // Prefer summary charge keys; fall back to older per-DC custom lines.
      customCharges: hasSummaryCharges ? [] : charges
    }, appData);
  }

  let next = { ...ti };
  if (ti.receiptId) {
    const mr = getFreshMaterialReceipt(appData.materialReceipts, ti.receiptId);
    if (mr) {
      const prodOpts = receiptProductOptions(mr, appData);
      const pl = findAnyPackingList(appData.packingLists, ti.receiptId);
      const summaries = buildPLProductSummaries(pl, mr, prodOpts);
      // Prefer saved TI charges for print; fall back to PI / MR only when TI has none
      const hasTiCharges = ti.productCharges && Object.keys(sanitizeProductCharges(ti.productCharges)).length > 0;
      const piTerms = !hasTiCharges ? getLinkedPITermsForTI(appData.invoices, ti.receiptId) : null;
      const baseCharges = hasTiCharges
        ? sanitizeProductCharges(ti.productCharges)
        : (piTerms?.productCharges || initProductChargesFromMR(mr, prodOpts.party, prodOpts));
      const savedCharges = mergeSavedChargesPreferDoc(ti.productCharges, baseCharges);
      const mergedCharges = sumHdpeDrumQty(savedCharges) > 0
        ? savedCharges
        : applyUmaNewDrumCharge(savedCharges, {
          batches: pl?.batches || [],
          party: prodOpts.party,
          stockItems: appData.stockItems,
          fallbackName: summaries[0]?.prodName || ti.productName || ''
        });
      const savedQty = parseFloat(ti.qty) || 0;
      const liveQty = getMRReceivedQty(mr, prodOpts);

      let hsnCode = String(ti.hsnCode || ti.hsn || '').trim();
      if (!hsnCode) {
        const names = [
          ...(summaries.length ? summaries : (ti.productSummaries || [])).map((p) => p.prodName),
          ti.productName
        ].filter(Boolean);
        for (const name of names) {
          const prod = (prodOpts.party?.products || []).find(
            (p) => String(p.name || '').trim().toLowerCase() === String(name).trim().toLowerCase()
          );
          if (prod?.hsn) {
            hsnCode = String(prod.hsn).trim();
            break;
          }
        }
      }

      next = {
        ...ti,
        billAddress: String(ti.billAddress || '').trim() || mr.billAddress || prodOpts.party?.billAddress || '',
        shipAddress: String(ti.shipAddress || '').trim() || mr.shipAddress || prodOpts.party?.shipAddress || '',
        gstinBill: ti.gstinBill || mr.gstinBill || prodOpts.party?.gstinBill || '',
        gstinShip: ti.gstinShip || mr.gstinShip || prodOpts.party?.gstinShip || '',
        productName: summaries.length ? getReceiptProductLabel(mr, prodOpts) : ti.productName,
        productSummaries: summaries.length ? summaries : (ti.productSummaries || []),
        productCharges: mergedCharges,
        hsnCode,
        qty: savedQty > 0 ? savedQty : (liveQty || 0)
      };
    }
  }
  return fillPrintPartyFields(next, appData);
};
