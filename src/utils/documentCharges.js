import { findDedicatedReceiptDoc, findReceiptDoc, getProductBatches, getProductQty, getReceiptProductNames, getReceiptProductSummaries, getReceiptProductLabel, receiptProductOptions, resolveReceiptProductName, findAnyPackingList, buildPLProductSummaries } from './receiptProducts';

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
  Object.fromEntries([...CHARGE_KEYS, ...extraKeys].map(k => [k, 1]));

export const emptyChargeRates = (extraKeys = []) =>
  Object.fromEntries([...CHARGE_KEYS, ...extraKeys].map(k => [k, 0]));

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
      if (saved == null || saved === '') {
        qtys[k] = materialQty || qtys[k];
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
  parseChargeNumber(qtys?.[key], 1);

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
  const key = Object.keys(map).find(k => normProduct(k) === normProduct(name));
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
    if (activeNorms.size && !activeNorms.has(normProduct(key))) continue;
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
      qty: cc.qty || 1
    }))
  };
};

/** Read saved charge settings for one product on a Material Receipt. */
export const getMRProductChargeSettings = (mr, party, prodName) => {
  const block = readMRProductChargeBlock(mr, party, prodName);
  if (block) return block;

  const hasProductSettings = Object.keys(mr?.productSettings || {}).length > 0;
  if (!hasProductSettings && (mr?.charges || mr?.rates || mr?.qtys)) {
    return {
      rates: { ...emptyChargeRates(), ...(mr.rates || {}) },
      charges: { ...emptyChargeFlagsOnly(), ...(mr.charges || {}) },
      qtys: { ...emptyChargeQtys(), ...(mr.qtys || {}) },
      customCharges: mr.customCharges || []
    };
  }

  const prodConfig = (party?.products || []).find(p => normProduct(p.name) === normProduct(prodName));
  return buildProductChargeSettingsFromParty(prodConfig);
};

const mergeProductChargeSettings = (mr, party, productNames) => {
  const prodOpts = { party };
  const merged = {
    charges: emptyChargeFlagsOnly(),
    rates: emptyChargeRates(),
    qtys: emptyChargeQtys(),
    customCharges: []
  };

  productNames.forEach(prodName => {
    const s = getMRProductChargeSettings(mr, party, prodName);
    const prodQty = getProductQty(mr, prodName, prodOpts);
    CHARGE_KEYS.forEach(key => {
      if (s.charges?.[key]) {
        merged.charges[key] = true;
        merged.rates[key] = parseChargeNumber(s.rates?.[key], merged.rates[key] || 0);
      }
      if (isMaterialQtyCharge(key)) {
        const saved = s.qtys?.[key];
        const lineQty = saved != null && saved !== ''
          ? parseChargeNumber(saved, 0)
          : 1;
        merged.qtys[key] = parseChargeNumber(merged.qtys[key], 0) + lineQty;
      } else if (s.charges?.[key]) {
        merged.qtys[key] = parseChargeNumber(s.qtys?.[key], merged.qtys[key] || 1);
      }
    });
    (s.customCharges || []).forEach(cc => merged.customCharges.push({ ...cc }));
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
export const findAnyTaxInvoice = (invoices, receiptId) =>
  (invoices || []).find(inv =>
    inv.receiptId === receiptId &&
    !inv.isDeleted &&
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

/** Flatten MR productSettings (or legacy top-level fields) for downstream PI/TI/PO. */
export const flattenMRChargeSnapshot = (mr, party) => {
  const productNames = getActiveReceiptProductNames(mr, party);
  if (productNames.length > 1) {
    return mergeProductChargeSettings(mr, party, productNames);
  }

  const block = readMRProductChargeBlock(
    mr,
    party,
    productNames[0] || mr?.productName || ''
  );
  if (block) return block;

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

/** TI charges: prefer saved PI product blocks, fall back to MR settings. */
export const resolveTIProductChargesForDoc = (mr, party, invoices, prodOpts = {}) => {
  const pi = findAnyProformaInvoice(invoices, mr?.id);
  if (pi?.productCharges && Object.keys(pi.productCharges).length > 0) {
    return normalizeProductChargesFromDoc(pi.productCharges, pi, mr, prodOpts, party);
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
  const productNames = getReceiptProductNames(mr, prodOpts);
  const result = {};
  productNames.forEach(prodName => {
    const settings = getMRProductChargeSettings(mr, party, prodName);
    result[prodName] = {
      charges: { ...emptyChargeFlagsOnly(), ...(settings.charges || {}) },
      rates: { ...emptyChargeRates(), ...(settings.rates || {}) },
      qtys: copyChargeQtysFromSettings(settings)
    };
  });
  if (!productNames.length && mr?.productName) {
    const settings = getMRProductChargeSettings(mr, party, mr.productName);
    result[mr.productName] = {
      charges: { ...emptyChargeFlagsOnly(), ...(settings.charges || {}) },
      rates: { ...emptyChargeRates(), ...(settings.rates || {}) },
      qtys: copyChargeQtysFromSettings(settings)
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

export const sanitizeProductCharges = (productCharges) => {
  if (!productCharges) return {};
  return Object.fromEntries(
    Object.entries(productCharges).map(([prodName, pc]) => [prodName, {
      charges: { ...emptyChargeFlagsOnly(), ...(pc.charges || {}) },
      rates: Object.fromEntries(CHARGE_KEYS.map(k => [k, parseChargeNumber(pc.rates?.[k], 0)])),
      qtys: Object.fromEntries(CHARGE_KEYS.map(k => [k, parseChargeNumber(pc.qtys?.[k], 1)]))
    }])
  );
};

export const calcProductChargesSubtotal = (productCharges, mr, prodOpts) =>
  Object.entries(productCharges || {}).reduce((sum, [prodName, pc]) => {
    const materialQty = getProductQty(mr, prodName, prodOpts);
    return sum + CHARGE_KEYS.reduce((lineSum, key) => {
      if (!pc.charges?.[key]) return lineSum;
      const rate = parseChargeNumber(pc.rates?.[key], 0);
      const lineQty = key === 'processing'
        ? materialQty
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

/** Merge MR product breakdown + per-product charges before PI PDF export. */
export const enrichPIForPrint = (pi, appData = {}) => {
  if (!pi?.receiptId) return pi;
  const mr = getFreshMaterialReceipt(appData.materialReceipts, pi.receiptId);
  if (!mr) return pi;

  const prodOpts = receiptProductOptions(mr, appData);
  const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
  const fromMR = initProductChargesFromMR(mr, prodOpts.party, prodOpts);
  const saved = pi.productCharges || {};
  const mergedCharges = { ...fromMR };

  Object.entries(saved).forEach(([name, pc]) => {
    const matchKey = Object.keys(mergedCharges).find(k => normProdKey(k) === normProdKey(name)) || name;
    const base = mergedCharges[matchKey] || {
      charges: emptyChargeFlagsOnly(),
      rates: emptyChargeRates(),
      qtys: emptyChargeQtys()
    };
    mergedCharges[matchKey] = {
      charges: { ...base.charges, ...(pc.charges || {}) },
      rates: { ...base.rates, ...(pc.rates || {}) },
      qtys: { ...base.qtys, ...(pc.qtys || {}) }
    };
  });

  const totalQty = summaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);

  return {
    ...pi,
    partyDocNo: pi.partyDocNo || mr.partyDocNo || '',
    partyDocDate: pi.partyDocDate || mr.partyDocDate || '',
    productName: summaries.length ? getReceiptProductLabel(mr, prodOpts) : pi.productName,
    productSummaries: summaries.length ? summaries : (pi.productSummaries || []),
    productCharges: mergedCharges,
    qty: totalQty || pi.qty
  };
};

/** Merge MR/PI/PL data into a TI before PDF export (one bill, all products). */
export const enrichTIForPrint = (ti, appData = {}) => {
  if (!ti?.receiptId) return ti;
  const mr = getFreshMaterialReceipt(appData.materialReceipts, ti.receiptId);
  if (!mr) return ti;

  const prodOpts = receiptProductOptions(mr, appData);
  const pl = findAnyPackingList(appData.packingLists, ti.receiptId);
  const summaries = buildPLProductSummaries(pl, mr, prodOpts);
  const pi = findAnyProformaInvoice(appData.invoices, ti.receiptId);
  const baseCharges = (pi?.productCharges && Object.keys(pi.productCharges).length > 0)
    ? normalizeProductChargesFromDoc(pi.productCharges, pi, mr, prodOpts, prodOpts.party)
    : initProductChargesFromMR(mr, prodOpts.party, prodOpts);
  const saved = ti.productCharges || {};
  const mergedCharges = { ...baseCharges };

  Object.entries(saved).forEach(([name, pc]) => {
    const matchKey = Object.keys(mergedCharges).find(k => normProdKey(k) === normProdKey(name)) || name;
    const base = mergedCharges[matchKey] || {
      charges: emptyChargeFlagsOnly(),
      rates: emptyChargeRates(),
      qtys: emptyChargeQtys()
    };
    mergedCharges[matchKey] = {
      charges: { ...base.charges, ...(pc.charges || {}) },
      rates: { ...base.rates, ...(pc.rates || {}) },
      qtys: { ...base.qtys, ...(pc.qtys || {}) }
    };
  });

  const plWeight = pl?.totalWeight || ti.qty;

  return {
    ...ti,
    productName: summaries.length ? getReceiptProductLabel(mr, prodOpts) : ti.productName,
    productSummaries: summaries.length ? summaries : (ti.productSummaries || []),
    productCharges: mergedCharges,
    qty: plWeight || ti.qty
  };
};
