/** Shared helpers for multi-product Material Receipt data. */

const norm = (s) => (s || '').trim().toLowerCase();

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
  if (!batch || batch.isEmptyDrums) return null;

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

export const getProductBatches = (mr, prodName, options = {}) =>
  (mr.batches || []).filter((b, idx) =>
    !b.isEmptyDrums && batchMatchesProduct(b, idx, mr, prodName, options)
  );

export const getReceiptProductNames = (mr, options = {}) => {
  const { party = null, productionPlans = [] } = options;
  const seen = new Set();
  const names = [];
  const add = (name) => {
    const canonical = canonicalPartyName(name, party);
    if (!canonical) return;
    const key = norm(canonical);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(canonical);
  };

  const activeBatches = (mr.batches || []).filter(b => !b.isEmptyDrums);
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
  if (fromBatches > 0 || batches.length > 0) return fromBatches;

  const { productionPlans = [] } = options;
  return plansForReceipt(productionPlans, mr.id)
    .filter(p => norm(p.productName) === norm(prodName))
    .reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
};

export const getProductDrums = (mr, prodName, options = {}) =>
  getProductBatches(mr, prodName, options).reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);

export const getReceiptProductSummaries = (mr, options = {}) => {
  const { productionPlans = [] } = options;
  return getReceiptProductNames(mr, options).map(prodName => {
    const batches = getProductBatches(mr, prodName, options);
    const plans = plansForReceipt(productionPlans, mr.id)
      .filter(p => norm(p.productName) === norm(prodName));

    const batchCount = batches.length || plans.length;
    const drums = batches.reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);
    const qty = batches.reduce((sum, b) => sum + (parseFloat(b.qty) || 0), 0)
      || plans.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);

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
  const active = (mr.batches || []).filter(b => !b.isEmptyDrums);
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
    (mr.batches || []).filter(b => !b.isEmptyDrums).forEach((b, idx) => {
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

const formatPlDrumRow = (row, productName) => ({
  batchNo: row?.batchNo || '',
  drumNo: row?.drumNo != null ? String(row.drumNo) : '',
  productName,
  gross: row?.gross === 0 ? '' : (row?.gross ?? ''),
  tare: row?.tare === 0 ? '' : (row?.tare ?? ''),
  net: row?.net === 0 ? '' : (row?.net ?? '')
});

/** Map BPR/PL weight rows onto MR product drum slots (fixes multi-product PL). */
export const alignDrumRowsToProducts = (rows, mr, prodOpts = {}) => {
  const slots = buildMRDrumSlots(mr, prodOpts);
  const pool = [...(rows || [])];
  if (!slots.length) return pool;

  if (pool.length === slots.length) {
    return slots.map((slot, i) => formatPlDrumRow(pool[i], slot.productName));
  }

  const used = new Set();
  return slots.map(slot => {
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

    if (pi < 0) {
      pi = pool.findIndex((r, i) => !used.has(i));
    }

    if (pi < 0) {
      return formatPlDrumRow(null, slot.productName);
    }

    used.add(pi);
    return formatPlDrumRow(pool[pi], slot.productName);
  });
};

/** All dispatched BPR drum rows for a receipt (multi-product combined PL). */
export const getBPRDispatchedRowsForPL = (data, mr, prodOpts = {}) => {
  if (!mr?.id) return [];
  const opts = {
    ...prodOpts,
    productionPlans: prodOpts.productionPlans || data?.productionPlans || []
  };
  const allBprs = (data?.bprs || []).filter(b => b.receiptId === mr.id);
  const bprRows = allBprs.flatMap(bpr => bpr.dispatchedBatches || []);
  return alignDrumRowsToProducts(bprRows, mr, opts);
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

export const buildPLProductSummaries = (pl, mr, prodOpts = {}) => {
  const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
  if (!summaries.length) return [];
  return summaries.map(p => ({
    ...p,
    qty: pl ? getPLProductNetQty(pl, p.prodName, mr, prodOpts) : p.qty
  }));
};

export const syncReceiptProductSummary = (batches, party = null, mr = null, productionPlans = []) => {
  const active = (batches || []).filter(b => !b.isEmptyDrums);
  const seen = new Set();
  const names = [];
  const add = (name) => {
    const canonical = canonicalPartyName(name, party);
    if (!canonical) return;
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
