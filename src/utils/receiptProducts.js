import { numberInputValue } from './numberInput';
/** Shared helpers for multi-product Material Receipt data. */

const norm = (s) => (s || '').trim().toLowerCase();

export const isEmptyDrumsLabel = (value) =>
  /^empty\s*drums?$/i.test(String(value || '').trim());

export const isEmptyDrumsBatch = (b) =>
  !!b?.isEmptyDrums
  || isEmptyDrumsLabel(b?.batchNo)
  || isEmptyDrumsLabel(b?.productName);

const canonicalPartyName = (name, party) => {
  const n = (name || '').trim();
  if (!n) return '';
  const match = (party?.products || []).find(p => norm(p.name) === norm(n));
  return match?.name || n;
};

const plansForReceipt = (productionPlans, receiptId) =>
  (productionPlans || []).filter(p => p.receiptId === receiptId);

const planForBatch = (productionPlans, mr, batch, batchIdx) => {
  if (!mr?.id) return null;
  const plans = plansForReceipt(productionPlans, mr.id);
  if (batchIdx >= 0) {
    const byIdx = plans.find(p => p.id === `${mr.id}_batch_${batchIdx}`);
    if (byIdx) return byIdx;
  }
  if (batch?.batchNo) {
    return plans.find(p => p.batchNo && norm(p.batchNo) === norm(batch.batchNo)) || null;
  }
  return null;
};

const resolveBatchProductName = (batch, mr, party, batchIdx = -1, productionPlans = []) => {
  if (!batch || isEmptyDrumsBatch(batch)) return null;

  const partyProducts = party?.products || [];
  const settings = mr?.productSettings || {};

  if (batch.productName) {
    return canonicalPartyName(batch.productName, party) || batch.productName.trim();
  }

  if (batch.nickName) {
    for (const p of partyProducts) {
      const settingNick = settings[p.name]?.nickName || p.nickname || '';
      if (settingNick && norm(batch.nickName) === norm(settingNick)) {
        return p.name;
      }
    }
  }

  if (batch.psdReq && partyProducts.length) {
    const psdMatches = partyProducts.filter(p => norm(p.psdReq) === norm(batch.psdReq));
    if (psdMatches.length === 1) return psdMatches[0].name;
  }

  const plan = planForBatch(productionPlans, mr, batch, batchIdx);
  if (plan?.productName) {
    return canonicalPartyName(plan.productName, party) || plan.productName.trim();
  }

  return null;
};

const batchMatchesProduct = (batch, batchIdx, mr, prodName, options = {}) => {
  const { party = null, productionPlans = [] } = options;
  const resolved = resolveBatchProductName(batch, mr, party, batchIdx, productionPlans);
  if (resolved && norm(resolved) === norm(prodName)) return true;
  if (batch.productName && norm(batch.productName) === norm(prodName)) return true;

  const plan = planForBatch(productionPlans, mr, batch, batchIdx);
  if (plan?.productName && norm(plan.productName) === norm(prodName)) return true;

  return false;
};

/** Drums entered on Material Receipt → Empty Drums (All Products). */
export const getEmptyDrumsCount = (mr) =>
  (mr?.batches || [])
    .filter(isEmptyDrumsBatch)
    .reduce((sum, b) => sum + (parseInt(b.drums, 10) || 0), 0);

export const getProductBatches = (mr, prodName, options = {}) =>
  (mr.batches || []).filter((b, idx) =>
    !isEmptyDrumsBatch(b) && batchMatchesProduct(b, idx, mr, prodName, options)
  );

export const getReceiptProductNames = (mr, options = {}) => {
  const { party = null, productionPlans = [] } = options;
  const seen = new Set();
  const names = [];
  const add = (name) => {
    const canonical = canonicalPartyName(name, party);
    if (!canonical || isEmptyDrumsLabel(canonical)) return;
    const key = norm(canonical);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(canonical);
  };

  const activeBatches = (mr.batches || []).filter(b => !isEmptyDrumsBatch(b));
  const receiptPlans = plansForReceipt(productionPlans, mr.id);

  activeBatches.forEach((batch, idx) => {
    const resolved = resolveBatchProductName(batch, mr, party, idx, productionPlans);
    if (resolved) add(resolved);
  });

  if (mr.productName?.includes(',')) {
    mr.productName.split(',').forEach(part => add(part));
  } else if (mr.productName) {
    add(mr.productName);
  }

  receiptPlans.forEach(p => add(p.productName));

  if (party?.products?.length) {
    party.products.forEach(p => {
      const hasBatch = activeBatches.some((b, idx) =>
        batchMatchesProduct(b, idx, mr, p.name, options)
      );
      const inSummary = mr.productName?.includes(',')
        && mr.productName.split(',').some(s => norm(s) === norm(p.name));
      const inPlans = receiptPlans.some(plan => norm(plan.productName) === norm(p.name));
      if (hasBatch || inSummary || inPlans) add(p.name);
    });
  }

  activeBatches.forEach(b => {
    if (b.productName) add(b.productName);
  });

  if (!names.length && mr.productName) add(mr.productName);

  if (activeBatches.length > 0 || receiptPlans.length > 0) {
    const validated = names.filter(n =>
      getProductBatches(mr, n, options).length > 0
      || receiptPlans.some(p => norm(p.productName) === norm(n))
    );
    if (validated.length) return validated;
  }

  return names;
};

export const getProductQty = (mr, prodName, options = {}) => {
  const batches = getProductBatches(mr, prodName, options);
  const fromBatches = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0);
  if (fromBatches > 0) return fromBatches;

  const { productionPlans = [] } = options;
  const fromPlans = plansForReceipt(productionPlans, mr.id)
    .filter(p => norm(p.productName) === norm(prodName))
    .reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
  if (fromPlans > 0) return fromPlans;

  const names = getReceiptProductNames(mr, options);
  if (names.length <= 1) return parseFloat(mr.totalQty) || 0;
  return 0;
};

export const getProductDrums = (mr, prodName, options = {}) =>
  getProductBatches(mr, prodName, options).reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);

export const getReceiptProductSummaries = (mr, options = {}) => {
  const { productionPlans = [] } = options;
  const names = getReceiptProductNames(mr, options);
  const mrTotal = parseFloat(mr.totalQty) || 0;
  return names.map(prodName => {
    const batches = getProductBatches(mr, prodName, options);
    const plans = plansForReceipt(productionPlans, mr.id)
      .filter(p => norm(p.productName) === norm(prodName));

    const batchCount = batches.length || plans.length;
    const drums = batches.reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);
    const qty = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0)
      || plans.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0)
      || (names.length <= 1 ? mrTotal : 0);

    return { prodName, batchCount, drums, qty };
  });
};

export const getReceiptTotals = (mr, options = {}) => {
  const summaries = getReceiptProductSummaries(mr, options);
  const fromSummaries = {
    batchCount: summaries.reduce((s, p) => s + p.batchCount, 0),
    drums: summaries.reduce((s, p) => s + p.drums, 0),
    qty: summaries.reduce((s, p) => s + p.qty, 0)
  };
  if (fromSummaries.batchCount > 0) return fromSummaries;
  const active = (mr.batches || []).filter(b => !isEmptyDrumsBatch(b));
  return {
    batchCount: active.length,
    drums: mr.totalDrums || active.reduce((s, b) => s + (parseInt(b.drums) || 0), 0),
    qty: mr.totalQty || active.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0)
  };
};

export const getReceiptProductLabel = (mr, options = {}) =>
  getReceiptProductNames(mr, options).join(', ') || mr.productName || '';

/** Display label for saved PI/TI docs (uses productSummaries when present). */
export const getDocProductLabel = (doc, mr = null, options = {}) => {
  if (doc?.productSummaries?.length > 1) {
    return doc.productSummaries.map(p => p.prodName).filter(Boolean).join(', ');
  }
  if (doc?.productName?.includes(',')) return doc.productName;
  if (mr) {
    const label = getReceiptProductLabel(mr, options);
    if (label.includes(',')) return label;
  }
  return doc?.productName || (mr ? getReceiptProductLabel(mr, options) : '');
};

/** One PL per Material Receipt — ignores per-product duplicate records. */
export const findAnyPackingList = (packingLists, receiptId) =>
  (packingLists || []).find(pl => pl.receiptId === receiptId && !pl.isDeleted) || null;

/** Ordered drum slots from MR (one slot per drum per product). */
export const buildMRDrumSlots = (mr, prodOpts = {}) => {
  if (!mr) return [];
  const opts = {
    ...prodOpts,
    productionPlans: prodOpts.productionPlans || []
  };
  const productNames = getReceiptProductNames(mr, opts);
  const slots = [];

  productNames.forEach(prodName => {
    getProductBatches(mr, prodName, opts).forEach(b => {
      const drumCount = parseInt(b.drums, 10) || 1;
      for (let d = 1; d <= drumCount; d += 1) {
        slots.push({
          batchNo: b.batchNo || '',
          drumNo: String(d),
          productName: prodName
        });
      }
    });
  });

  if (!slots.length) {
    (mr.batches || []).filter(b => !isEmptyDrumsBatch(b)).forEach((b, idx) => {
      const drumCount = parseInt(b.drums, 10) || 1;
      const pName = b.productName || productNames[0] || mr.productName || '';
      for (let d = 1; d <= drumCount; d += 1) {
        slots.push({
          batchNo: b.batchNo || '',
          drumNo: String(d),
          productName: pName
        });
      }
    });
  }

  return slots;
};

const formatPlDrumRow = (row, slot = {}) => {
  const productName = slot.productName || row?.productName || '';
  const batchNo = (row?.batchNo && String(row.batchNo).trim())
    ? row.batchNo
    : (slot.batchNo || '');
  const drumNo =
    row?.drumNo != null && String(row.drumNo).trim() !== ''
      ? String(row.drumNo)
      : (slot.drumNo != null ? String(slot.drumNo) : '');
  return {
    batchNo,
    drumNo,
    productName,
    gross: numberInputValue(row?.gross ?? ''),
    tare: numberInputValue(row?.tare ?? ''),
    net: numberInputValue(row?.net ?? '')
  };
};

const isMeaningfulPlRow = (r) => {
  if (!r) return false;
  const hasWeight = [r.gross, r.tare, r.net].some((v) => {
    if (v === '' || v === undefined || v === null) return false;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return !Number.isNaN(n) && n !== 0;
  });
  const hasId = String(r.batchNo || '').trim() || String(r.drumNo ?? '').trim();
  return hasWeight || !!hasId;
};

/** Map BPR/PL weight rows onto MR product drum slots (fixes multi-product PL). */
export const alignDrumRowsToProducts = (rows, mr, prodOpts = {}) => {
  const slots = buildMRDrumSlots(mr, prodOpts);
  const pool = [...(rows || [])].filter(isMeaningfulPlRow);
  if (!slots.length) {
    return pool.map((r) => formatPlDrumRow(r, { productName: r.productName, batchNo: r.batchNo, drumNo: r.drumNo }));
  }

  const used = new Set();
  const mapped = slots.map((slot) => {
    let pi = pool.findIndex((r, i) => !used.has(i)
      && norm(r.batchNo) === norm(slot.batchNo)
      && norm(String(r.drumNo)) === norm(String(slot.drumNo))
      && r.productName
      && norm(r.productName) === norm(slot.productName));

    if (pi < 0) {
      pi = pool.findIndex((r, i) => !used.has(i)
        && norm(r.batchNo) === norm(slot.batchNo)
        && norm(String(r.drumNo)) === norm(String(slot.drumNo)));
    }

    // Prefer weight-filled rows for positional fallback so empty pads don't steal slots
    if (pi < 0) {
      pi = pool.findIndex((r, i) => {
        if (used.has(i)) return false;
        const hasWeight = [r.gross, r.tare, r.net].some((v) => {
          if (v === '' || v == null) return false;
          const n = parseFloat(v);
          return !Number.isNaN(n) && n !== 0;
        });
        return hasWeight;
      });
    }

    if (pi < 0) {
      pi = pool.findIndex((r, i) => !used.has(i));
    }

    if (pi < 0) {
      return formatPlDrumRow(null, slot);
    }

    used.add(pi);
    return formatPlDrumRow(pool[pi], slot);
  });
  const extras = pool
    .filter((_, i) => !used.has(i))
    .map((r) => formatPlDrumRow(r, {
      productName: r.productName,
      batchNo: r.batchNo,
      drumNo: r.drumNo
    }));
  return extras.length ? [...mapped, ...extras] : mapped;
};

/** Build PL batch rows from Material Receipt drums, overlaying BPR/existing weights. */
export const buildPLBatchesFromMR = (data, mr, prodOpts = {}, existingRows = null) => {
  if (!mr?.id) return [];
  const opts = {
    ...prodOpts,
    productionPlans: prodOpts.productionPlans || data?.productionPlans || []
  };
  const allBprs = (data?.bprs || []).filter((b) => b.receiptId === mr.id && !b.isDeleted);
  const dispatchedRows = allBprs.flatMap((bpr) => bpr.dispatchedBatches || []).filter(isMeaningfulPlRow);
  const receivedRows = allBprs.flatMap((bpr) => bpr.receivedBatches || []).filter(isMeaningfulPlRow);
  // Prefer dispatched weights; fall back to received when dispatch side is still empty
  const bprRows = dispatchedRows.some((r) => {
    const g = parseFloat(r.gross);
    const t = parseFloat(r.tare);
    const n = parseFloat(r.net);
    return (!Number.isNaN(g) && g !== 0) || (!Number.isNaN(t) && t !== 0) || (!Number.isNaN(n) && n !== 0);
  })
    ? dispatchedRows
    : (receivedRows.length ? receivedRows : dispatchedRows);
  const source = Array.isArray(existingRows) && existingRows.length
    ? existingRows.filter(isMeaningfulPlRow)
    : bprRows;
  return alignDrumRowsToProducts(source, mr, opts);
};

/** All dispatched BPR drum rows for a receipt (multi-product combined PL). */
export const getBPRDispatchedRowsForPL = (data, mr, prodOpts = {}) =>
  buildPLBatchesFromMR(data, mr, prodOpts, null);

/** One received/dispatch slot per drum for a single MR product. */
export const buildProductDrumSlots = (mr, prodName, options = {}) => {
  const name = resolveReceiptProductName(mr, prodName, options) || String(prodName || '').trim();
  const batches = name ? getProductBatches(mr, name, options) : [];
  const rows = [];
  batches.forEach((b) => {
    const count = Math.max(1, parseInt(b.drums, 10) || 1);
    for (let d = 1; d <= count; d++) {
      rows.push({
        batchNo: b.batchNo || '',
        drumNo: String(d),
        productName: name,
        gross: '',
        tare: '',
        net: ''
      });
    }
  });
  return { name, batches, rows };
};

/** Overlay PL/BPR weights onto product drum slots without mixing other products. */
export const overlayWeightsOnDrumSlots = (slots, weightRows = [], productName = '') => {
  const wantProd = norm(productName);
  const pool = [...(weightRows || [])].filter((r) => {
    if (!r) return false;
    if (!isMeaningfulPlRow(r)) return false;
    if (!wantProd || !r.productName) return true;
    return norm(r.productName) === wantProd;
  });
  const used = new Set();
  const mapped = (slots || []).map((slot) => {
    let pi = pool.findIndex((r, i) => !used.has(i)
      && norm(r.batchNo) === norm(slot.batchNo)
      && norm(String(r.drumNo)) === norm(String(slot.drumNo))
      && (!wantProd || !r.productName || norm(r.productName) === wantProd));

    if (pi < 0) {
      pi = pool.findIndex((r, i) => !used.has(i)
        && norm(r.batchNo) === norm(slot.batchNo)
        && (!wantProd || !r.productName || norm(r.productName) === wantProd));
    }

    if (pi < 0) {
      return { ...slot };
    }

    used.add(pi);
    const src = pool[pi];
    return {
      ...slot,
      batchNo: slot.batchNo || src.batchNo || '',
      drumNo: slot.drumNo || (src.drumNo != null && src.drumNo !== '' ? String(src.drumNo) : ''),
      productName: slot.productName || productName || src.productName || '',
      gross: src.gross ?? '',
      tare: src.tare ?? '',
      net: src.net ?? ''
    };
  });
  const extras = pool.filter((_, i) => !used.has(i)).map((src) => ({
    batchNo: src.batchNo || '',
    drumNo: src.drumNo != null && src.drumNo !== '' ? String(src.drumNo) : '',
    productName: src.productName || productName || '',
    gross: src.gross ?? '',
    tare: src.tare ?? '',
    net: src.net ?? ''
  }));
  return extras.length ? [...mapped, ...extras] : mapped;
};

/** Build BPR drum tables for one product only (never mixes other products on the same MR). */
export const buildBprRowsForProduct = (mr, prodName, options = {}, weightRows = []) => {
  const { name, batches, rows } = buildProductDrumSlots(mr, prodName, options);
  const overlaid = weightRows?.length
    ? overlayWeightsOnDrumSlots(rows, weightRows, name)
    : rows.map((r) => ({ ...r }));
  return {
    productName: name,
    batches,
    receivedRows: overlaid,
    dispatchedRows: overlaid.map((r) => ({ ...r })),
    qty: getProductQty(mr, name, options),
    drums: rows.length || getProductDrums(mr, name, options),
    batchNo: batches.map((b) => b.batchNo).filter((no) => no && !isEmptyDrumsLabel(no)).join(', '),
    totalNoBatch: batches.length
  };
};

export const getPLDisplayProductLabel = (pl, appData = {}) => {
  const mr = (appData.materialReceipts || []).find(r => r.id === pl?.receiptId);
  const opts = mr ? receiptProductOptions(mr, appData) : {};
  return getDocProductLabel(pl, mr, opts);
};

export const getPLProductNetQty = (pl, prodName, mr, prodOpts = {}) => {
  const nk = norm(prodName);
  const rows = (pl?.batches || []).filter(r => (r.productName || '').trim() && norm(r.productName) === nk);
  if (rows.length) {
    return rows.reduce((sum, r) => sum + (parseFloat(r.net) || 0), 0);
  }
  return getProductQty(mr, prodName, prodOpts);
};

const isSievingLumpPlRow = (r = {}) =>
  /sieving\s*lumps?/.test(`${r.batchNo || ''} ${r.drumNo || ''} ${r.productName || ''}`.toLowerCase());

const isPlDispatchDrumRow = (r) =>
  isMeaningfulPlRow(r) && !isEmptyDrumsBatch(r) && !isSievingLumpPlRow(r);

/** Packing-list drum rows for one product (falls back when PL rows have no productName). */
export const getPLRowsForProduct = (pl, prodName, mr = null, prodOpts = {}) => {
  const rows = (pl?.batches || []).filter(isPlDispatchDrumRow);
  if (!prodName) return rows;
  const nk = norm(prodName);
  const named = rows.filter((r) => (r.productName || '').trim() && norm(r.productName) === nk);
  if (named.length) return named;
  const unlabeled = rows.filter((r) => !String(r.productName || '').trim());
  if (unlabeled.length && mr) {
    const batchNos = new Set(
      getProductBatches(mr, prodName, prodOpts)
        .map((b) => String(b.batchNo || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (batchNos.size) {
      const matched = unlabeled.filter((r) => batchNos.has(String(r.batchNo || '').trim().toLowerCase()));
      if (matched.length) return matched;
    }
  }
  const plLabel = String(pl?.productName || '').trim();
  if (plLabel && !plLabel.includes(',') && norm(plLabel) === nk) return rows;
  if (plLabel.includes(',')) {
    const parts = plLabel.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1 && norm(parts[0]) === nk) return rows;
  }
  return [];
};

export const getPLProductDrums = (pl, prodName, mr = null, prodOpts = {}) =>
  getPLRowsForProduct(pl, prodName, mr, prodOpts).length;

/** Drum counts per batch number from the Packing List (one PL row = one drum). */
export const getPLBatchDrumCounts = (pl, prodName, mr = null, prodOpts = {}) => {
  const map = {};
  getPLRowsForProduct(pl, prodName, mr, prodOpts).forEach((r) => {
    const key = String(r.batchNo || '').trim() || '—';
    map[key] = (map[key] || 0) + 1;
  });
  return map;
};

/** Material value entered on the Material Receipt (₹). */
export const getMRMaterialValue = (mr) => {
  const v = parseFloat(mr?.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** Build DC qty/drums/value/labels.
 * Qty always from Material Receipt. Drums come from Packing List when present. */
export const buildDCFieldsFromProducts = (mr, pl, prodOpts, selectedProductNames = []) => {
  if (!mr) {
    return { productSummaries: [], productName: '', qty: 0, totalDrums: 0, emptyDrums: 0, value: 0 };
  }
  const allSummaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
  const selectedSet = new Set((selectedProductNames || []).map(n => norm(n)));
  const selected = selectedProductNames?.length
    ? allSummaries.filter(p => selectedSet.has(norm(p.prodName)))
    : allSummaries;

  const productSummaries = selected.map((p) => {
    const mrDrums = getProductDrums(mr, p.prodName, prodOpts) || p.drums || 0;
    const plDrums = getPLProductDrums(pl, p.prodName, mr, prodOpts);
    return {
      ...p,
      qty: getProductQty(mr, p.prodName, prodOpts) || p.qty || 0,
      drums: plDrums > 0 ? plDrums : mrDrums
    };
  });

  const qtyFromProducts = productSummaries.reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
  const drumsFromProducts = productSummaries.reduce((s, p) => s + (parseInt(p.drums, 10) || 0), 0);
  const emptyDrums = getEmptyDrumsCount(mr);
  const mrTotalQty = parseFloat(mr.totalQty) || 0;
  const mrTotalDrums = parseInt(mr.totalDrums, 10) || 0;
  const plHasDrums = selected.some((p) => getPLProductDrums(pl, p.prodName, mr, prodOpts) > 0);

  // When all MR products are selected (or none specified), use authoritative MR totalQty
  const selectingAll = !selectedProductNames?.length
    || (allSummaries.length > 0 && selected.length === allSummaries.length)
    || (allSummaries.length <= 1);

  const qty = selectingAll && mrTotalQty > 0
    ? mrTotalQty
    : (qtyFromProducts > 0 ? qtyFromProducts : mrTotalQty);
  const totalDrums = plHasDrums
    ? drumsFromProducts + emptyDrums
    : (selectingAll && mrTotalDrums > 0 ? mrTotalDrums : drumsFromProducts + emptyDrums);

  const productName = productSummaries.map(p => p.prodName).filter(Boolean).join(', ')
    || (mr.productName || '');

  return {
    productSummaries,
    productName,
    qty,
    totalDrums,
    emptyDrums,
    value: (() => {
      const v = getMRMaterialValue(mr);
      return v > 0 ? v : '';
    })()
  };
};

/**
 * Authoritative Material Receipt quantity for billing (PI/TI/DC).
 * Prefer product batch-sum (same as PI create) so PI and TI qty/totals match;
 * fall back to mr.totalQty only when batches have no qty.
 */
export const getMRReceivedQty = (mr, prodOpts = {}, selectedProductNames = null) => {
  if (!mr) return 0;
  const mrTotal = parseFloat(mr.totalQty) || 0;
  if (!selectedProductNames?.length) {
    const fromProducts = getReceiptProductSummaries(mr, prodOpts)
      .reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
    return fromProducts > 0 ? fromProducts : mrTotal;
  }

  const selectedSet = new Set(selectedProductNames.map((n) => norm(n)));
  const summaries = getReceiptProductSummaries(mr, prodOpts)
    .filter((p) => selectedSet.has(norm(p.prodName)));
  const fromProducts = summaries.reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
  return fromProducts > 0 ? fromProducts : mrTotal;
};

export const buildPLProductSummaries = (pl, mr, prodOpts = {}) => {
  // Billing docs (TI/DC) use Material Receipt qty — ignore packing-list net weight
  const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
  if (!summaries.length) return [];
  return summaries.map(p => ({
    ...p,
    qty: getProductQty(mr, p.prodName, prodOpts) || p.qty || 0
  }));
};

export const syncReceiptProductSummary = (batches, party = null, mr = null, productionPlans = []) => {
  const active = (batches || []).filter(b => !isEmptyDrumsBatch(b));
  const seen = new Set();
  const names = [];
  const add = (name) => {
    const canonical = canonicalPartyName(name, party);
    if (!canonical || isEmptyDrumsLabel(canonical)) return;
    const key = norm(canonical);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(canonical);
  };

  active.forEach((b, idx) => {
    const resolved = resolveBatchProductName(b, mr || { productSettings: {} }, party, idx, productionPlans);
    if (resolved) add(resolved);
    else if (b.productName) add(b.productName);
  });

  if (party?.products?.length) {
    party.products.forEach(p => {
      if (active.some((b, idx) => batchMatchesProduct(b, idx, mr || {}, p.name, { party, productionPlans }))) {
        add(p.name);
      }
    });
  }

  const nicks = [...new Set(active.map(b => b.nickName).filter(Boolean))];
  return {
    productName: names.length ? names.join(', ') : '',
    nickName: nicks.length ? nicks.join(', ') : ''
  };
};

export const receiptProductOptions = (mr, data) => {
  const parties = data?.parties || [];
  let party = parties.find(p => p.id === mr.partyId) || null;
  if (!party && mr.partyName) {
    party = parties.find(p => norm(p.name) === norm(mr.partyName)) || null;
  }
  return {
    party,
    productionPlans: data?.productionPlans || []
  };
};

export const normProduct = (s) => norm(s);

/** Find party product config by name or nickname (case-insensitive). */
export const findPartyProduct = (party, productName) => {
  if (!party || !productName) return null;
  const n = norm(productName);
  const products = party.products || [];
  return products.find(p => norm(p.name) === n)
    || products.find(p => p.nickname && norm(p.nickname) === n)
    || null;
};

/** Match a product name to the canonical name from the receipt's product list. */
export const resolveReceiptProductName = (mr, name, options = {}) => {
  if (!name) return '';
  const names = getReceiptProductNames(mr, options);
  const match = names.find(p => norm(p) === norm(name));
  if (match) return match;
  const party = options.party || null;
  const partyMatch = (party?.products || []).find(p => norm(p.name) === norm(name));
  return partyMatch?.name || name.trim();
};

/** Resolve party product from MR using receipt product names, batches, and settings. */
export const getPartyProductForMR = (mr, data, productNameHint = '') => {
  if (!mr) return null;
  const prodOpts = receiptProductOptions(mr, data);
  const { party } = prodOpts;
  if (!party) return null;

  const names = getReceiptProductNames(mr, prodOpts);
  const candidates = [];

  if (productNameHint) {
    const hints = String(productNameHint).includes(',')
      ? String(productNameHint).split(',').map((s) => s.trim()).filter(Boolean)
      : [productNameHint];
    hints.forEach((hint) => candidates.push(resolveReceiptProductName(mr, hint, prodOpts)));
  }
  names.forEach((n) => candidates.push(n));
  (mr.productName || '').split(',').forEach((s) => {
    const t = s.trim();
    if (t) candidates.push(t);
  });
  Object.keys(mr.productSettings || {}).forEach((k) => candidates.push(k));

  const seen = new Set();
  for (const cand of candidates) {
    const key = norm(cand);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const prod = findPartyProduct(party, cand);
    if (prod) return prod;
  }
  return null;
};

/** Fill missing BPR PSD fields from party master before PDF export. */
export const enrichBPRForPrint = (bpr, appData = {}) => {
  if (!bpr) return bpr;
  const mr = (appData.materialReceipts || []).find(r => r.id === bpr.receiptId);
  const prod = mr ? getPartyProductForMR(mr, appData, bpr.productName) : null;
  const pl = findAnyPackingList(appData.packingLists, bpr.receiptId);

  const sumKey = (rows, key) => (rows || []).reduce((s, r) => {
    const n = parseFloat(r[key]);
    return s + (!Number.isNaN(n) && r[key] !== '' && r[key] != null ? n : 0);
  }, 0);
  const countDrums = (rows) => (rows || []).filter((r) => r.batchNo || r.drumNo).length;

  const receivedBatches = [...(bpr.receivedBatches || [])];
  const dispatchedBatches = [...(bpr.dispatchedBatches || [])];

  const sievingLumps = parseFloat(
    bpr.lumpsNetWeight ?? bpr.sievingLumps ?? pl?.sievingLumps ?? pl?.sievingLumpsNet ?? ''
  );
  const lumpsVal = Number.isFinite(sievingLumps) && sievingLumps > 0 ? sievingLumps : 0;

  const totalReceivedGross = bpr.totalReceivedGross ?? sumKey(receivedBatches, 'gross');
  const totalDispatchedGross = bpr.totalDispatchedGross ?? sumKey(dispatchedBatches, 'gross');
  const totalReceivedNet = bpr.totalReceivedNet ?? sumKey(receivedBatches, 'net');
  const computedDispatchNet = sumKey(dispatchedBatches, 'net') + lumpsVal;
  const totalDispatchedNet = (bpr.totalDispatchedNet > 0 ? bpr.totalDispatchedNet : null)
    ?? (computedDispatchNet > 0 ? computedDispatchNet : 0);
  const filledDrums = Math.max(
    countDrums(dispatchedBatches),
    countDrums(receivedBatches),
    parseInt(bpr.totalDrums, 10) || 0,
    parseInt(mr?.totalDrums, 10) || 0
  );

  const packingConsumables = {
    whiteLdBags: '',
    blackLdBags: '',
    brownTapes: '',
    drumUsed: '',
    otherDetails: '',
    fiberDrumsUsed: '',
    hdpeDrumsUsed: '',
    linersUsed: '',
    ...(bpr.packingMaterials || {}),
    ...(bpr.packingConsumables || {})
  };
  packingConsumables.drumUsed = String(
    packingConsumables.drumUsed
      || packingConsumables.fiberDrumsUsed
      || packingConsumables.hdpeDrumsUsed
      || (filledDrums ? filledDrums : '')
      || ''
  ).trim();

  return {
    ...bpr,
    partyName: bpr.partyName || bpr.customerName || mr?.partyName || '',
    customerName: bpr.customerName || bpr.partyName || mr?.partyName || '',
    productName: bpr.productName || mr?.productName || '',
    psdNote: bpr.psdNote || prod?.psdNote || '',
    psdRequirement: bpr.psdRequirement || prod?.psdReq || '',
    totalDrums: filledDrums || bpr.totalDrums || '',
    receivedBatches,
    dispatchedBatches,
    totalReceivedGross,
    totalDispatchedGross,
    totalReceivedNet,
    totalDispatchedNet,
    lumpsNetWeight: bpr.lumpsNetWeight || lumpsVal || bpr.dispatchQty?.lumpsNet || '',
    sievingLumps: lumpsVal || bpr.sievingLumps || '',
    sampleNetWeight: bpr.sampleNetWeight || bpr.dispatchQty?.sampleNet || '',
    floorDustNetWeight: bpr.floorDustNetWeight || bpr.dispatchQty?.floorDustNet || '',
    irrecoverableLoss: bpr.irrecoverableLoss || bpr.processLoss || bpr.dispatchQty?.netProcessLoss || '',
    processLoss: bpr.processLoss || bpr.irrecoverableLoss || bpr.dispatchQty?.netProcessLoss || '',
    packingConsumables,
    packingMaterials: {
      ...(bpr.packingMaterials || {}),
      drumUsed: packingConsumables.drumUsed
    }
  };
};

/** 1-based index for display (Product 1, Product 2, …) in party/MR order. */
export const getProductDisplayIndex = (mr, prodName, options = {}) => {
  const names = getReceiptProductNames(mr, options);
  const idx = names.findIndex(p => norm(p) === norm(prodName));
  return idx >= 0 ? idx + 1 : 1;
};

export const docMatchesProduct = (docProductName, targetProductName) => {
  if (!targetProductName) return true;
  if (!docProductName) return false;
  if (norm(docProductName) === norm(targetProductName)) return true;
  if (docProductName.includes(',')) {
    return docProductName.split(',').some(p => norm(p) === norm(targetProductName));
  }
  return false;
};

export const findReceiptDoc = (docs, mrId, productName, extraMatch = () => true) => {
  const pool = (docs || []).filter(d => d.receiptId === mrId && extraMatch(d));
  if (!productName) return pool[0];
  const exact = pool.find(d => norm(d.productName) === norm(productName));
  if (exact) return exact;
  return pool.find(d =>
    d.productName?.includes(',') &&
    d.productName.split(',').some(p => norm(p) === norm(productName))
  );
};

/** Match only a single-product document (ignores legacy comma-combined docs). */
export const findDedicatedReceiptDoc = (docs, mrId, productName, extraMatch = () => true) => {
  const pool = (docs || []).filter(d => d.receiptId === mrId && extraMatch(d));
  if (!productName) {
    return pool.find(d => d.productName && !d.productName.includes(',')) || null;
  }
  return pool.find(d =>
    d.productName &&
    !d.productName.includes(',') &&
    norm(d.productName) === norm(productName)
  ) || null;
};

export const buildUnderProcessRows = (materialReceipts, data) =>
  (materialReceipts || []).flatMap(mr => {
    const prodOpts = receiptProductOptions(mr, data);
    const productNames = getReceiptProductNames(mr, prodOpts);
    if (productNames.length <= 1) {
      return [{ mr, productName: productNames[0] || mr.productName || '', prodOpts }];
    }
    return productNames.map(productName => ({ mr, productName, prodOpts }));
  });
