import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber, nextAvailableDocNumber } from '../utils/numbering';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import { 
  FileText, Activity, UploadCloud, Package, Truck, 
  FileSpreadsheet, FileCheck, CheckCircle, Clock, X, Plus, Edit2, Download, Trash2,
  Search, ArrowRightToLine, Hand
} from 'lucide-react';
import { exportToPDF, viewPDF, padBPRBatchRows } from '../utils/pdfExport';
import { enrichPIForPrint, enrichTIForPrint, findAnyProformaInvoice, findAnyTaxInvoice, getLinkedPITermsForTI, applyProformaFinancialsToTaxInvoice, resolveReceiptChargesForDoc, resolveTIProductChargesForDoc, sanitizeProductCharges, qtyInputValue, rateInputValue } from '../utils/documentCharges';
import {
  getReceiptProductNames,
  getProductBatches,
  getProductQty,
  getProductDrums,
  getReceiptProductLabel,
  getReceiptProductSummaries,
  getProductDisplayIndex,
  resolveReceiptProductName,
  receiptProductOptions,
  findReceiptDoc,
  findDedicatedReceiptDoc,
  findAnyPackingList,
  buildBprRowsForProduct,
  getPLDisplayProductLabel,
  buildPLProductSummaries,
  getMRReceivedQty,
  buildPLBatchesFromMR,
  buildUnderProcessRows,
  buildDCFieldsFromProducts,
  getPartyProductForMR,
  enrichBPRForPrint
} from '../utils/receiptProducts';
import SearchableSelect from '../components/SearchableSelect';
import GstTaxBlock from '../components/GstTaxBlock';
import { GST_TYPE_CGST_SGST, normalizeGstType } from '../utils/taxInvoiceLayout';

const CHARGE_KEYS = [
  'cleaning', 'filterBag', 'processing', 'sieving', 'psdReport',
  'liner', 'courier', 'fiberDrum', 'transportation', 'hdpeDrum', 'batchChangeover'
];

const CHARGES_LIST = [
  { key: 'cleaning', label: 'Cleaning Charges (998842)', isQtyRate: true },
  { key: 'filterBag', label: 'Filter Bag Charges (591190)', isQtyRate: false },
  { key: 'processing', label: 'Processing Charges (998842)', isQtyRate: true },
  { key: 'sieving', label: 'Sieving Charges (998842)', isQtyRate: true },
  { key: 'psdReport', label: 'PSD Report Charges (998346)', isQtyRate: false },
  { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
  { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
  { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
  { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
  { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
  { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
];

const emptyChargeFlags = () => Object.fromEntries(CHARGE_KEYS.map(k => [k, false]));
const emptyChargeRates = () => Object.fromEntries(CHARGE_KEYS.map(k => [k, 0]));
const emptyChargeQtys = () => Object.fromEntries(CHARGE_KEYS.map(k => [k, '']));

const isMaterialQtyCharge = (key) => ['processing', 'sieving', 'cleaning'].includes(key);

const buildChargeQtys = (settings, materialQty = 0) => {
  const qtys = { ...emptyChargeQtys(), ...(settings?.qtys || {}) };
  CHARGE_KEYS.forEach(k => {
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

const parseChargeNumber = (val, fallback = 0) => {
  if (val === '' || val == null) return fallback;
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
};

const parseChargeFieldValue = (val) => {
  if (val === '') return '';
  const n = parseFloat(val);
  return Number.isNaN(n) ? val : n;
};

const formatWeightNet = (val) => (parseFloat(val) || 0).toFixed(2);

const getChargeLineQty = (pc, key, materialQty) => {
  const q = pc.qtys?.[key];
  if (isMaterialQtyCharge(key)) return parseChargeNumber(q, materialQty || 0);
  return parseChargeNumber(q, 0);
};

const normalizeProductCharges = (productCharges, legacyDoc, mr, prodOpts, fallbackProductName) => {
  if (productCharges && Object.keys(productCharges).length > 0) {
    return Object.fromEntries(
      Object.entries(productCharges).map(([prodName, pc]) => {
        const materialQty = getProductQty(mr, prodName, prodOpts);
        return [prodName, {
          charges: { ...emptyChargeFlags(), ...(pc.charges || {}) },
          rates: { ...emptyChargeRates(), ...(pc.rates || {}) },
          qtys: buildChargeQtys({ qtys: { ...(legacyDoc?.qtys || {}), ...(pc.qtys || {}) } }, materialQty)
        }];
      })
    );
  }
  const prodName = fallbackProductName || mr.productName;
  const materialQty = getProductQty(mr, prodName, prodOpts);
  return {
    [prodName]: {
      charges: { ...emptyChargeFlags(), ...(legacyDoc?.charges || {}) },
      rates: { ...emptyChargeRates(), ...(legacyDoc?.rates || {}) },
      qtys: buildChargeQtys({ qtys: legacyDoc?.qtys }, materialQty)
    }
  };
};

const buildProductSettingsFromParty = (prodConfig) => {
  if (!prodConfig) {
    return { nickName: '', rates: emptyChargeRates(), charges: emptyChargeFlags() };
  }
  const c = prodConfig.charges || {};
  const psdRate = prodConfig.psdMethodDefault === 'Wet'
    ? (c.psdReportWet ?? c.psdReport ?? 0)
    : (c.psdReportDry ?? c.psdReport ?? 0);
  return {
    nickName: prodConfig.nickname || '',
    rates: {
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
    },
    charges: emptyChargeFlags()
  };
};

const getMRProductSettings = (mr, party, prodName) => {
  const settings = mr.productSettings || {};
  const direct = settings[prodName];
  if (direct) return direct;
  const matchedKey = Object.keys(settings).find(k => (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase());
  if (matchedKey) return settings[matchedKey];
  const prodConfig = (party?.products || []).find(
    p => (p.name || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
  );
  return buildProductSettingsFromParty(prodConfig);
};

const initProductChargesFromMR = (mr, party, productOptions = {}) => {
  const productNames = getReceiptProductNames(mr, { party, ...productOptions });
  const result = {};
  productNames.forEach(prodName => {
    const settings = getMRProductSettings(mr, party, prodName);
    const materialQty = getProductQty(mr, prodName, productOptions);
    result[prodName] = {
      charges: { ...(settings.charges || emptyChargeFlags()) },
      rates: { ...(settings.rates || emptyChargeRates()) },
      qtys: buildChargeQtys(settings, materialQty)
    };
  });
  if (!productNames.length && mr.productName) {
    const materialQty = mr.totalQty || mr.receivedQty || 0;
    result[mr.productName] = {
      charges: { ...(mr.charges || emptyChargeFlags()) },
      rates: { ...(mr.rates || emptyChargeRates()) },
      qtys: buildChargeQtys({ qtys: mr.qtys }, materialQty)
    };
  }
  return result;
};

const calcProductChargesSubtotal = (productCharges, mr, qtyResolver, productOptions = {}) => {
  const names = Object.keys(productCharges || {});
  return names.reduce((sum, prodName) => {
    const pc = productCharges[prodName] || {};
    const qty = qtyResolver
      ? qtyResolver(prodName)
      : getProductQty(mr, prodName, productOptions);
    return sum + CHARGE_KEYS.reduce((s, key) => {
      if (!pc.charges?.[key]) return s;
      const rate = parseChargeNumber(pc.rates?.[key], 0);
      const lineQty = getChargeLineQty(pc, key, qty);
      return s + lineQty * rate;
    }, 0);
  }, 0);
};

const findPI = (data, mrId) => findAnyProformaInvoice(data.invoices, mrId);
const findBPR = (data, mrId, productName = '') =>
  findDedicatedReceiptDoc((data.bprs || []).filter((d) => !d.isDeleted), mrId, productName);
const findPSD = (data, mrId, productName = '') =>
  findReceiptDoc(data.psds, mrId, productName);
const findPL = (data, mrId, productName = '') => {
  const any = findAnyPackingList(data.packingLists, mrId);
  if (any) return any;
  return findReceiptDoc(data.packingLists, mrId, productName);
};
const findDC = (data, mrId, productName = '') =>
  findReceiptDoc(data.deliveryChallans, mrId, productName);
const findTI = (data, mrId, productName = '') => {
  const any = findAnyTaxInvoice(data.invoices, mrId);
  if (any) return any;
  return findReceiptDoc(data.invoices, mrId, productName, inv => inv.invoiceNo?.includes('/IN/'));
};

const UP_SHARED_DOC_TYPES = new Set(['PI', 'PL', 'TI', 'EWTI']);
const upProductKey = (productName = '') => String(productName || '_').trim() || '_';

const isMovedToProcessingSheet = (mr, productName = '') => {
  const flag = mr?.movedToProcessingSheet;
  if (flag === true) return true;
  if (!flag || typeof flag !== 'object') return false;
  return !!flag[upProductKey(productName)];
};

const getProcessManualDone = (mr, productName = '', type) => {
  const map = mr?.processManualDone;
  if (!map || typeof map !== 'object') return false;
  const key = upProductKey(productName);
  if (map[key]?.[type]) return true;
  if (UP_SHARED_DOC_TYPES.has(type)) {
    return Object.values(map).some((bucket) => bucket && bucket[type]);
  }
  return false;
};

const isUnderProcessRowComplete = (data, mr, productName = '') => {
  const pi = findPI(data, mr.id);
  const bpr = findBPR(data, mr.id, productName);
  const psd = findPSD(data, mr.id, productName);
  const pl = findPL(data, mr.id, productName);
  const dc = findDC(data, mr.id, productName);
  const ti = findTI(data, mr.id, productName);
  const m = (type) => getProcessManualDone(mr, productName, type);
  return Boolean(
    (pi || m('PI')) &&
    (bpr || m('BPR')) &&
    (psd || m('PSD')) &&
    (pl || m('PL')) &&
    (dc || m('DC')) &&
    ((dc && dc.ewayBillNo) || m('EWDC')) &&
    (ti || m('TI')) &&
    ((ti && ti.ewayBillNo) || m('EWTI'))
  );
};

const initProductChargesForScope = (mr, party, prodOpts, activeProductName) => {
  if (!activeProductName) return initProductChargesFromMR(mr, party, prodOpts);
  const canonical = resolveReceiptProductName(mr, activeProductName, { party, ...prodOpts });
  const settings = getMRProductSettings(mr, party, canonical);
  const materialQty = getProductQty(mr, canonical, prodOpts);
  return {
    [canonical]: {
      charges: { ...(settings.charges || emptyChargeFlags()) },
      rates: { ...(settings.rates || emptyChargeRates()) },
      qtys: buildChargeQtys(settings, materialQty)
    }
  };
};

const renderChargeRow = (item, pc, prodName, materialQty, toggleCharge, handleQtyChange, handleRateChange) => (
  <div key={item.key} className="charge-row">
    <label>
      <input type="checkbox" checked={pc.charges[item.key]} onChange={() => toggleCharge(prodName, item.key)} />
      {item.label}
    </label>
    {pc.charges[item.key] && (
      <div className="charge-row-fields">
        <span>Qty:</span>
        <input
          type="number"
          step={item.isQtyRate ? '0.01' : '1'}
          className="input-field input-compact"
          value={qtyInputValue(pc.qtys?.[item.key])}
          placeholder="NIL"
          onChange={e => handleQtyChange(prodName, item.key, e.target.value)}
          min="0"
        />
        <span>Rate: ₹</span>
        <input
          type="number"
          className="input-field input-compact"
          style={{ width: '110px' }}
          value={rateInputValue(pc.rates[item.key])}
          placeholder="0"
          onChange={e => handleRateChange(prodName, item.key, e.target.value)}
          min="0"
        />
      </div>
    )}
  </div>
);

const getScopedProductNames = (mr, prodOpts, activeProductName) => {
  if (!activeProductName) return getReceiptProductNames(mr, prodOpts);
  return [resolveReceiptProductName(mr, activeProductName, prodOpts)];
};

const MRProductSummary = ({ mr, party, productOptions = {}, onlyProduct = '' }) => {
  const opts = { party, ...productOptions };
  const allProductNames = getReceiptProductNames(mr, opts);
  let productNames = allProductNames;
  if (onlyProduct) {
    const resolved = resolveReceiptProductName(mr, onlyProduct, opts);
    productNames = allProductNames.filter(p => (p || '').trim().toLowerCase() === (resolved || '').trim().toLowerCase());
    if (!productNames.length && resolved) productNames = [resolved];
  }
  if (!productNames.length) {
    return (
      <div className="product-block">
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Product: {onlyProduct || mr.productName || '—'}
        </p>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {productNames.map((prodName) => {
        const displayIdx = getProductDisplayIndex(mr, prodName, opts);
        const settings = getMRProductSettings(mr, party, prodName);
        const batches = getProductBatches(mr, prodName, opts);
        const qty = getProductQty(mr, prodName, opts);
        const drums = batches.reduce((s, b) => s + (parseInt(b.drums) || 0), 0);
        const prodConfig = (party?.products || []).find(
          p => (p.name || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
        );
        return (
          <div key={prodName} className="product-block">
            <h4>
              Product {displayIdx}: {prodName}
              {settings.nickName ? ` (${settings.nickName})` : ''}
            </h4>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              PSD: {prodConfig?.psdReq || batches[0]?.psdReq || '—'} · {qty} Kg · {drums} drums · {batches.length} batch{batches.length !== 1 ? 'es' : ''}
            </p>
            {batches.length > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {batches.map((b, i) => (
                  <span key={i} style={{ display: 'inline-block', marginRight: '0.65rem' }}>
                    {b.batchNo || '—'} ({b.drums} drum{b.drums !== 1 ? 's' : ''}, {b.qty || 0} Kg)
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const UnderProcess = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [activeModal, setActiveModal] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [modalContext, setModalContext] = useState(null); // Active M.R. record
  const [editingDoc, setEditingDoc] = useState(null); // If editing an existing doc
  const [showDocPopover, setShowDocPopover] = useState(null); // { cellType, doc, mrId } for blue click
  const [showPendingPopover, setShowPendingPopover] = useState(null); // { cellType, mr, productName, x, y }
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const processRows = useMemo(
    () => buildUnderProcessRows(data.materialReceipts, data).filter(
      ({ mr, productName }) => !isMovedToProcessingSheet(mr, productName)
    ),
    [data]
  );
  const partyOptions = useMemo(() => (
    [...new Set(processRows.map((r) => r.mr?.partyName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [processRows]);
  const productOptions = useMemo(() => (
    [...new Set(processRows.map((r) => r.productName || r.mr?.productName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [processRows]);

  // ----------------------------------------------------
  // Document Search & Helper Helpers
  // ----------------------------------------------------
  const getPI = (mrId) => findPI(data, mrId);
  const getBPR = (mrId, productName = '') => findBPR(data, mrId, productName);
  const getPSD = (mrId, productName = '') => findPSD(data, mrId, productName);
  const getPL = (mrId, productName = '') => findPL(data, mrId, productName);
  const getDC = (mrId, productName = '') => findDC(data, mrId, productName);
  const getTI = (mrId, productName = '') => findTI(data, mrId, productName);

  const filteredProcessRows = useMemo(() => (
    processRows.filter(({ mr, productName }) => {
      const partyName = mr.partyName || '';
      const prodName = productName || mr.productName || '';
      if (partyFilter && partyName !== partyFilter) return false;
      if (productFilter && prodName !== productFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const hay = `${partyName} ${prodName} ${mr.receiptNo || ''} ${mr.partyDocNo || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const pi = getPI(mr.id);
      const bpr = getBPR(mr.id, productName);
      const psd = getPSD(mr.id, productName);
      const pl = getPL(mr.id, productName);
      const dc = getDC(mr.id, productName);
      const ti = getTI(mr.id, productName);
      const m = (type) => getProcessManualDone(mr, productName, type);
      const isComplete = isUnderProcessRowComplete(data, mr, productName);
      if (activeTab === 'Done') return isComplete;
      if (activeTab === 'Pending') return !isComplete;
      if (activeTab === 'PI') return !(pi || m('PI'));
      if (activeTab === 'BPR') return !(bpr || m('BPR'));
      if (activeTab === 'PSD') return !(psd || m('PSD'));
      if (activeTab === 'PL') return !(pl || m('PL'));
      if (activeTab === 'DC') return !(dc || m('DC'));
      if (activeTab === 'EWDC') return !((dc && dc.ewayBillNo) || m('EWDC'));
      if (activeTab === 'TI') return !(ti || m('TI'));
      if (activeTab === 'EWTI') return !((ti && ti.ewayBillNo) || m('EWTI'));
      return true;
    })
  ), [processRows, partyFilter, productFilter, searchTerm, activeTab, data]);

  const handlePendingClick = (mr, type, productName = '', e) => {
    if (e) {
      e.stopPropagation();
      setShowPendingPopover({
        cellType: type,
        mr,
        productName: productName || '',
        x: e.clientX,
        y: e.clientY
      });
      return;
    }
    openDocGenerator(mr, type, productName);
  };

  const openDocGenerator = (mr, type, productName = '') => {
    if (type === 'PI') {
      const existing = findPI(data, mr.id);
      if (existing) {
        setModalContext({ mr, productName });
        setEditingDoc(existing);
        setActiveModal(type);
        return;
      }
    }
    if (type === 'PL') {
      const existing = findPL(data, mr.id);
      if (existing) {
        setModalContext({ mr, productName: '' });
        setEditingDoc(existing);
        setActiveModal(type);
        return;
      }
    }
    if (type === 'TI') {
      const existing = findTI(data, mr.id);
      if (existing) {
        setModalContext({ mr, productName: '' });
        setEditingDoc(existing);
        setActiveModal(type);
        return;
      }
    }
    setModalContext({ mr, productName });
    setEditingDoc(null);
    setActiveModal(type);
  };

  const setManualDoneFlag = (mr, productName, type, value) => {
    const key = upProductKey(productName);
    const currentMap = { ...(mr.processManualDone || {}) };
    const bucket = { ...(currentMap[key] || {}) };
    if (value) bucket[type] = true;
    else delete bucket[type];
    if (Object.keys(bucket).length) currentMap[key] = bucket;
    else delete currentMap[key];
    updateItem('materialReceipts', mr.id, {
      ...mr,
      processManualDone: currentMap
    });
  };

  const handleMarkDoneManually = () => {
    if (!showPendingPopover) return;
    const { mr, productName, cellType } = showPendingPopover;
    setManualDoneFlag(mr, productName, cellType, true);
    setShowPendingPopover(null);
  };

  const handleClearManualDone = (mr, productName, type) => {
    setManualDoneFlag(mr, productName, type, false);
  };

  const handleGenerateFromPending = () => {
    if (!showPendingPopover) return;
    const { mr, productName, cellType } = showPendingPopover;
    setShowPendingPopover(null);
    openDocGenerator(mr, cellType, productName);
  };

  const handleMoveToProcessingSheet = (mr, productName = '') => {
    if (!window.confirm('Move this material from Under Process to Processing Sheet?')) return;
    const key = upProductKey(productName);
    const current = mr.movedToProcessingSheet;
    let next;
    if (current === true) return;
    if (current && typeof current === 'object') {
      next = { ...current, [key]: true };
    } else {
      next = { [key]: true };
    }
    updateItem('materialReceipts', mr.id, {
      ...mr,
      movedToProcessingSheet: next,
      movedToProcessingSheetAt: new Date().toISOString()
    });
  };

  const handleBlueClick = (mrId, cellType, doc, productName, e) => {
    e.stopPropagation();
    setShowDocPopover({ cellType, doc, mrId, productName, x: e.clientX, y: e.clientY });
  };

  const handleEditDoc = () => {
    const { cellType, doc, mrId, productName } = showDocPopover;
    const mr = data.materialReceipts.find(r => r.id === mrId);
    setModalContext({ mr, productName: productName || '' });
    setEditingDoc(doc);
    setShowDocPopover(null);
    setActiveModal(cellType);
  };

  const handleDeleteDoc = () => {
    const { cellType, doc, mrId, productName } = showDocPopover;
    if (window.confirm(`Are you sure you want to delete this ${cellType} document?`)) {
      if (cellType === 'PI' || cellType === 'TI') {
        deleteItemSoftly('invoices', doc.id);
      } else if (cellType === 'BPR') {
        deleteItemSoftly('bprs', doc.id);
      } else if (cellType === 'PSD') {
        deleteItemSoftly('psds', doc.id);
      } else if (cellType === 'PL') {
        deleteItemSoftly('packingLists', doc.id);
      } else if (cellType === 'DC') {
        deleteItemSoftly('deliveryChallans', doc.id);
      } else if (cellType === 'EWDC') {
        const dc = getDC(mrId, productName);
        if (dc) {
          updateItem('deliveryChallans', dc.id, { ...dc, ewayBillNo: '', ewayBillDate: '' });
        }
      } else if (cellType === 'EWTI') {
        const ti = getTI(mrId, productName);
        if (ti) {
          updateItem('invoices', ti.id, { ...ti, ewayBillNo: '', ewayBillDate: '' });
        }
      }
      setShowDocPopover(null);
    }
  };

  const handleDownloadPDF = () => {
    const { cellType, doc } = showDocPopover;
    const payload = cellType === 'PI' ? enrichPIForPrint(doc, data) : doc;
    exportToPDF(cellType, payload);
    setShowDocPopover(null);
  };

  const handleViewPDF = () => {
    const { cellType, doc } = showDocPopover;
    const payload = cellType === 'PI' ? enrichPIForPrint(doc, data) : doc;
    viewPDF(cellType, payload);
    setShowDocPopover(null);
  };

  const renderDocCell = (mr, productName, type, doc, { printDoc, disabled = false, eway = false } = {}) => {
    const manual = getProcessManualDone(mr, productName, type);
    const generatedDone = eway ? !!(doc && doc.ewayBillNo) : !!doc;

    if (generatedDone) {
      return (
        <td className="center">
          {printDoc ? (
            <div className="doc-done-group">
              <button onClick={() => printDoc()} className="doc-icon-btn" title="View / Print">
                <FileText size={14} />
              </button>
              <button onClick={(e) => handleBlueClick(mr.id, type, doc, productName, e)} className="doc-done">
                <CheckCircle size={12} /> Done
              </button>
            </div>
          ) : (
            <button onClick={(e) => handleBlueClick(mr.id, type, doc, productName, e)} className="doc-done">
              <CheckCircle size={12} /> Done
            </button>
          )}
        </td>
      );
    }

    if (manual) {
      return (
        <td className="center">
          <button
            type="button"
            onClick={() => handleClearManualDone(mr, productName, type)}
            className="doc-done doc-done-manual"
            title="Marked done manually — click to undo"
          >
            <Hand size={12} /> Done Manually
          </button>
        </td>
      );
    }

    return (
      <td className="center">
        <button
          type="button"
          onClick={(e) => handlePendingClick(mr, type, productName, e)}
          className="doc-pending"
          disabled={disabled}
        >
          <Clock size={12} /> Pending
        </button>
      </td>
    );
  };

  return (
    <div className="under-process-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Under Process</h1>
          <p className="page-subtitle">Track document generation status for materials in process</p>
        </div>
      </header>

      <div className="tab-bar">
        {[
          { id: 'All', label: 'All' },
          { id: 'Pending', label: 'Pending' },
          { id: 'PI', label: 'PI' },
          { id: 'BPR', label: 'BPR' },
          { id: 'PSD', label: 'PSD' },
          { id: 'PL', label: 'PL' },
          { id: 'DC', label: 'DC' },
          { id: 'EWDC', label: 'E-Way DC' },
          { id: 'TI', label: 'Tax Inv' },
          { id: 'EWTI', label: 'E-Way TI' },
          { id: 'Done', label: 'Done' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <Search size={16} color="#94a3b8" />
        <input
          type="text"
          className="input-field"
          placeholder="Search party, product or receipt…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ minWidth: 200, maxWidth: 280, flex: '1 1 220px' }}>
          <SearchableSelect
            className="input-field"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
          >
            <option value="">All Parties</option>
            {partyOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </SearchableSelect>
        </div>
        <div style={{ minWidth: 200, maxWidth: 280, flex: '1 1 220px' }}>
          <SearchableSelect
            className="input-field"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="">All Products</option>
            {productOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </SearchableSelect>
        </div>
      </div>

      <div className="premium-card data-table-container under-process-table-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
        <div style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#5b1c85', margin: 0 }}>Material Processing Status</h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>View and manage document generation for each material</p>
        </div>
        <div className="under-process-table-scroll">
        <table className="workflow-table">
          <thead>
            <tr>
              <th>Material Received Date</th>
              <th>Party Name</th>
              <th>Product</th>
              <th>Qty (kg)</th>
              <th className="center">PI</th>
              <th className="center">BPR</th>
              <th className="center">PSD</th>
              <th className="center">Packing List</th>
              <th className="center">DC</th>
              <th className="center">E-Way DC</th>
              <th className="center">Tax Inv</th>
              <th className="center">E-Way TI</th>
              <th className="center">Action</th>
            </tr>
          </thead>
          <tbody>
            {(data.materialReceipts || []).length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No material receipts yet. Add one from Material Receipt.
                </td>
              </tr>
            ) : filteredProcessRows.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No materials match this search or filter.
                </td>
              </tr>
            ) : (
              filteredProcessRows.map(({ mr, productName, prodOpts }) => {
                const party = data.parties.find(p => p.id === mr.partyId);
                const settings = productName ? getMRProductSettings(mr, party, productName) : null;
                const pi = getPI(mr.id);
                const bpr = getBPR(mr.id, productName);
                const psd = getPSD(mr.id, productName);
                const pl = getPL(mr.id, productName);
                const dc = getDC(mr.id, productName);
                const ti = getTI(mr.id, productName);
                const rowComplete = isUnderProcessRowComplete(data, mr, productName);
                const rowQty = productName
                  ? (getProductQty(mr, productName, prodOpts)
                    || (getReceiptProductNames(mr, prodOpts).length <= 1
                      ? (parseFloat(mr.totalQty) || parseFloat(mr.receivedQty) || 0)
                      : 0))
                  : (parseFloat(mr.totalQty) || parseFloat(mr.receivedQty) || 0);

                return (
                  <tr key={`${mr.id}_${productName || 'default'}`}>
                    <td style={{ fontWeight: 500 }}>{formatDate(mr.date)}</td>
                    <td style={{ fontWeight: 600 }}>{mr.partyName}</td>
                    <td>
                      <span>{productName || mr.productName || '—'}</span>
                      {(settings?.nickName || (productName ? '' : mr.nickName)) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                          ({settings?.nickName || mr.nickName})
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{rowQty}</td>

                    {renderDocCell(mr, productName, 'PI', pi, {
                      printDoc: () => viewPDF('PI', enrichPIForPrint(pi, data))
                    })}
                    {renderDocCell(mr, productName, 'BPR', bpr, {
                      printDoc: () => viewPDF('BPR', enrichBPRForPrint(bpr, data))
                    })}
                    {renderDocCell(mr, productName, 'PSD', psd, {
                      printDoc: () => viewPDF('PSD', psd)
                    })}
                    {renderDocCell(mr, productName, 'PL', pl, {
                      printDoc: () => viewPDF('PL', pl),
                      disabled: !(bpr || getProcessManualDone(mr, productName, 'BPR'))
                    })}
                    {renderDocCell(mr, productName, 'DC', dc, {
                      printDoc: () => viewPDF('DC', dc),
                      disabled: !(pl || getProcessManualDone(mr, productName, 'PL'))
                    })}
                    {renderDocCell(mr, productName, 'EWDC', dc, {
                      eway: true,
                      disabled: !(dc || getProcessManualDone(mr, productName, 'DC'))
                    })}
                    {renderDocCell(mr, productName, 'TI', ti, {
                      printDoc: () => viewPDF('TI', enrichTIForPrint(ti, data)),
                      disabled: !(pl || getProcessManualDone(mr, productName, 'PL'))
                    })}
                    {renderDocCell(mr, productName, 'EWTI', ti, {
                      eway: true,
                      disabled: !(ti || getProcessManualDone(mr, productName, 'TI'))
                    })}

                    <td className="center">
                      {rowComplete ? (
                        <button
                          type="button"
                          className="btn-move-sheet"
                          onClick={() => handleMoveToProcessingSheet(mr, productName)}
                          title="Move to Processing Sheet"
                        >
                          <ArrowRightToLine size={14} /> Move to Sheet
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot done"></span>
            <span>Done — click to view, edit, or delete</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot pending"></span>
            <span>Pending — click for Generate or Done Manually</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot done"></span>
            <span>When all steps are done — Move to Processing Sheet</span>
          </div>
        </div>
      </div>

      {showPendingPopover && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setShowPendingPopover(null)}>
          <div
            className="context-menu"
            style={{ left: `${showPendingPopover.x}px`, top: `${Math.max(12, showPendingPopover.y - 100)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="context-menu-title">{showPendingPopover.cellType} Actions</p>
            <button className="context-menu-item" onClick={handleGenerateFromPending}>
              <Plus size={14} /> Generate
            </button>
            <button className="context-menu-item" onClick={handleMarkDoneManually}>
              <Hand size={14} /> Done Manually
            </button>
          </div>
        </div>
      )}

      {showDocPopover && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setShowDocPopover(null)}>
          <div
            className="context-menu"
            style={{ left: `${showDocPopover.x}px`, top: `${showDocPopover.y - 120}px` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="context-menu-title">{showDocPopover.cellType} Actions</p>
            <button className="context-menu-item" onClick={handleViewPDF}><FileText size={14} /> View / Print</button>
            <button className="context-menu-item" onClick={handleDownloadPDF}><Download size={14} /> Download PDF</button>
            <button className="context-menu-item" onClick={handleEditDoc}><Edit2 size={14} /> Edit</button>
            <button className="context-menu-item danger" onClick={handleDeleteDoc}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          EMBEDDED DOCUMENT GENERATION MODALS
      ---------------------------------------------------- */}
      {activeModal && (
        <ModalWrapper 
          title={`${editingDoc ? 'Edit' : 'Create'} ${activeModal}${(modalContext?.productName ? ` — ${modalContext.productName}` : '')}`} 
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'PI' && (
            <PerformaInvoiceGenerator 
              key={`PI-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'BPR' && (
            <BPRGenerator 
              key={`BPR-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'PSD' && (
            <PSDGenerator 
              key={`PSD-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'PL' && (
            <PLGenerator 
              key={`PL-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'DC' && (
            <DCGenerator 
              key={`DC-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'EWDC' && (
            <EWayDCGenerator 
              key={`EWDC-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'TI' && (
            <TaxInvoiceGenerator 
              key={`TI-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'EWTI' && (
            <EWayTIGenerator 
              key={`EWTI-${modalContext?.mr?.id || modalContext?.id}-${modalContext?.productName || 'all'}`}
              mr={modalContext?.mr ?? modalContext} 
              activeProductName={modalContext?.productName || ''}
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
        </ModalWrapper>
      )}
    </div>
  );
};

// Modal Wrapper Component
const ModalWrapper = ({ title, children, onClose }) => (
  <div className="page-form-overlay">
    <div className="premium-card modal-panel">
      <button onClick={onClose} className="modal-close" aria-label="Close">
        <X size={20} />
      </button>
      <h2 className="modal-title">{title}</h2>
      {children}
    </div>
  </div>
);

// ----------------------------------------------------
// 1. PERFORMA INVOICE GENERATOR FORM (Slide 7 Set A)
// ----------------------------------------------------
const PerformaInvoiceGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, ensureSerialAtLeast } = useAppContext();
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodOpts = useMemo(() => receiptProductOptions(mr, data), [mr, data]);
  const productNames = getReceiptProductNames(mr, prodOpts);
  const formInitKey = `${mr.id}-combined-${editing?.id || 'new'}`;

  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
    productCharges: initProductChargesFromMR(mr, party, prodOpts),
    discount: 0,
    taxRate: 18,
    gstType: GST_TYPE_CGST_SGST,
    terms: 'Payment 100% advance against PI.'
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        partyDocNo: editing.partyDocNo || editing.poNo || mr.partyDocNo || '',
        partyDocDate: editing.partyDocDate || editing.poDate || mr.partyDocDate || '',
        productCharges: normalizeProductCharges(
          editing.productCharges,
          editing,
          mr,
          prodOpts,
          productNames[0] || mr.productName
        ),
        discount: editing.discount || 0,
        taxRate: editing.taxRate ?? 18,
        gstType: normalizeGstType(editing.gstType),
        terms: editing.terms || 'Payment 100% advance against PI.'
      });
    } else {
      setForm(prev => ({
        ...prev,
        partyDocNo: mr.partyDocNo || '',
        partyDocDate: mr.partyDocDate || '',
        productCharges: initProductChargesFromMR(mr, party, prodOpts)
      }));
    }
  }, [formInitKey]);

  useEffect(() => {
    if (editing) return;
    const piSerial = data.settings?.serials?.PI || 1;
    const docNo = generateDocNumber('PI', piSerial, new Date(form.date));
    setForm(prev => (prev.invoiceNo === docNo ? prev : { ...prev, invoiceNo: docNo }));
  }, [form.date, editing, data.settings?.serials?.PI]);

  const toggleCharge = (prodName, key) => {
    setForm(prev => {
      const pc = prev.productCharges[prodName] || {
        charges: emptyChargeFlags(),
        rates: emptyChargeRates(),
        qtys: emptyChargeQtys()
      };
      const turningOn = !pc.charges[key];
      const materialQty = getProductQty(mr, prodName, prodOpts);
      const qtys = { ...(pc.qtys || emptyChargeQtys()) };
      if (turningOn && (qtys[key] == null || qtys[key] === '' || qtys[key] === 0)) {
        qtys[key] = isMaterialQtyCharge(key) && materialQty ? materialQty : '';
      }
      return {
        ...prev,
        productCharges: {
          ...prev.productCharges,
          [prodName]: {
            ...pc,
            charges: { ...pc.charges, [key]: turningOn },
            qtys
          }
        }
      };
    });
  };

  const handleRateChange = (prodName, key, val) => {
    setForm(prev => ({
      ...prev,
      productCharges: {
        ...prev.productCharges,
        [prodName]: {
          ...prev.productCharges[prodName],
          rates: { ...prev.productCharges[prodName].rates, [key]: parseChargeFieldValue(val) }
        }
      }
    }));
  };

  const handleQtyChange = (prodName, key, val) => {
    setForm(prev => ({
      ...prev,
      productCharges: {
        ...prev.productCharges,
        [prodName]: {
          ...prev.productCharges[prodName],
          qtys: { ...(prev.productCharges[prodName].qtys || emptyChargeQtys()), [key]: parseChargeFieldValue(val) }
        }
      }
    }));
  };

  const getSubtotal = () => calcProductChargesSubtotal(form.productCharges, mr, null, prodOpts);

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = getSubtotal();
    const discountAmount = parseFloat(form.discount) || 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxable * (form.taxRate / 100);
    const total = taxable + taxAmount;
    const sanitizedCharges = sanitizeProductCharges(form.productCharges);
    const productLabel = getReceiptProductLabel(mr, prodOpts);
    const productSummaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
    const materialQty = getMRReceivedQty(mr, prodOpts)
      || productSummaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0)
      || 0;
    const chargeSnapshot = resolveReceiptChargesForDoc(mr, party, {
      productName: productLabel,
      materialQty
    });
    const piPool = (data.invoices || []).filter(inv =>
      !inv.isDeleted && (inv.type === 'Proforma Invoice' || inv.invoiceNo?.includes('/PI/'))
    );
    const { docNo, nextSerial } = nextAvailableDocNumber(
      'PI',
      data.settings?.serials?.PI || 1,
      form.date,
      piPool,
      { excludeId: editing?.id }
    );

    const finalDoc = {
      ...form,
      invoiceNo: editing ? form.invoiceNo : docNo,
      productCharges: sanitizedCharges,
      charges: chargeSnapshot.charges,
      rates: chargeSnapshot.rates,
      qtys: buildChargeQtys(chargeSnapshot, materialQty),
      customCharges: chargeSnapshot.customCharges || [],
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: productLabel,
      productSummaries,
      qty: materialQty,
      subtotal,
      taxAmount,
      total,
      type: 'Proforma Invoice'
    };

    if (editing) {
      updateItem('invoices', editing.id, finalDoc);
    } else {
      if (findAnyProformaInvoice(data.invoices, mr.id)) {
        alert('A Proforma Invoice already exists for this Material Receipt.');
        return;
      }
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      ensureSerialAtLeast('PI', nextSerial);
    }
    onClose();
  };

  const totalMaterialQty = getReceiptProductSummaries(mr, prodOpts)
    .filter(p => p.batchCount > 0 || p.qty > 0)
    .reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0) || (mr.totalQty || mr.receivedQty || 0);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>PI Number</label>
          <input type="text" className="input-field" readOnly value={form.invoiceNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>PI Date *</label>
          <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>GSTIN</label>
          <input type="text" className="input-field" readOnly value={mr.gstinBill} />
        </div>
        <div>
          <label>Supplier Doc No</label>
          <input type="text" className="input-field" value={form.partyDocNo} onChange={e => setForm({...form, partyDocNo: e.target.value})} />
        </div>
        <div>
          <label>Supplier Doc Date</label>
          <DateField className="input-field" value={form.partyDocDate} onChange={e => setForm({...form, partyDocDate: e.target.value})} />
        </div>
        <div>
          <label>Total Material Quantity</label>
          <input type="text" className="input-field" readOnly value={`${totalMaterialQty} Kg`} />
        </div>
      </div>

      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} />

      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>Auto-Charges Configuration Panel</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Configure charges per product. Toggle standard charges to add them as line items with HSN codes.</p>
          {productNames.map((prodName) => {
            const displayIdx = getProductDisplayIndex(mr, prodName, prodOpts);
            const materialQty = getProductQty(mr, prodName, prodOpts);
            const pc = form.productCharges[prodName] || form.productCharges[Object.keys(form.productCharges || {}).find(k =>
              (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
            )] || {
              charges: emptyChargeFlags(),
              rates: emptyChargeRates(),
              qtys: buildChargeQtys({}, materialQty)
            };
            return (
              <div key={prodName} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  Product {displayIdx}: {prodName} ({materialQty} Kg)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {CHARGES_LIST.map(item => renderChargeRow(
                    item, pc, prodName, materialQty, toggleCharge, handleQtyChange, handleRateChange
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Calculation Summary */}
        <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>Calculation Invoice Summary</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>Subtotal:</span>
            <span style={{ fontWeight: 600 }}>₹{getSubtotal().toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span>Discount (₹):</span>
            <input type="number" className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.discount} onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
          </div>
          <GstTaxBlock
            compact
            taxable={Math.max(0, getSubtotal() - form.discount)}
            taxRate={form.taxRate}
            gstType={form.gstType}
            showDiscountInput={false}
            showSubtotal={false}
            onTaxRateChange={(taxRate) => setForm({ ...form, taxRate })}
            onGstTypeChange={(gstType) => setForm({ ...form, gstType })}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem' }}>Terms & Conditions</label>
            <input type="text" className="input-field" value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Proforma Invoice</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 2. BPR WEIGHTStwin TABLES FORM (Slide 8 Set A)
// ----------------------------------------------------
const BPRGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = (data.parties || []).find(p => p.id === mr.partyId);
  const prodOpts = receiptProductOptions(mr, data);
  const allProductNames = getReceiptProductNames(mr, prodOpts);
  const productNames = getScopedProductNames(mr, prodOpts, activeProductName);
  const lockedProduct = activeProductName
    ? resolveReceiptProductName(mr, activeProductName, prodOpts)
    : '';
  const defaultProduct = (() => {
    if (lockedProduct) return lockedProduct;
    if (editing?.productName && !String(editing.productName).includes(',')) {
      return resolveReceiptProductName(mr, editing.productName, prodOpts) || editing.productName;
    }
    const pending = allProductNames.find((n) => !findBPR(data, mr.id, n));
    return pending || allProductNames[0] || mr.productName || '';
  })();
  const primaryProduct = resolveReceiptProductName(mr, defaultProduct, prodOpts) || defaultProduct;
  const firstProdConfig = getPartyProductForMR(mr, data, primaryProduct);
  const scopedQty = getProductQty(mr, primaryProduct, prodOpts);
  const scopedDrums = getProductDrums(mr, primaryProduct, prodOpts);

  const bprSectionStyle = {
    marginBottom: '1.5rem',
    padding: '1.25rem',
    background: 'var(--input-bg)',
    borderRadius: '10px',
    border: '1px solid var(--border-color)'
  };

  const [form, setForm] = useState({
    bprNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: mr.partyName,
    productName: primaryProduct,
    totalInputQty: scopedQty,
    batchNo: '',
    totalNoBatch: 0,
    psdRequirement: firstProdConfig?.psdReq || '90% < 10M',
    psdNote: firstProdConfig?.psdNote || '',
    totalDrums: scopedDrums,
    doubleDispatch: false,
    receivedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    dispatchedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    committedBy: '',
    processingStartDate: new Date().toISOString().split('T')[0],
    processingStartTime: '09:00',
    processingSupervisor: '',
    sizingReportRequired: 'Yes',
    particleSizeResult: '',
    isMicronizerCleaned: false,
    isAreaCleaned: false,
    isFilterBagPackedLabeled: false,
    isBagCleanBlackSpotFree: false,
    pressures: [
      { sp: '', dp: '', tp: '', fp: '', fip: '' },
      { sp: '', dp: '', tp: '', fp: '', fip: '' },
      { sp: '', dp: '', tp: '', fp: '', fip: '' }
    ],
    packingMaterials: { whiteLdBags: '', blackLdBags: '', brownTapes: '', drumUsed: '', otherDetails: '' },
    dispatchQty: { micronizedNet: '', lumpsNet: '', floorDustNet: '', sampleNet: '', netProcessLoss: '', remark: '' },
    processCompletionDate: new Date().toISOString().split('T')[0],
    processCompletionTime: '17:00',
    isFilterBagPackedStoredAfter: false,
    remarks: '',
    operatorSignature: '',
    plantSupervisorSignature: ''
  });

  const scopeBprToProduct = (prev, prodName, extraWeightRows = []) => {
    const name = resolveReceiptProductName(mr, prodName, prodOpts) || prodName;
    const prodConfig = getPartyProductForMR(mr, data, name);
    const built = buildBprRowsForProduct(mr, name, prodOpts, extraWeightRows);
    const drumTotal = built.drums || 0;
    return {
      ...prev,
      productName: built.productName || name,
      totalInputQty: built.qty,
      totalDrums: drumTotal,
      batchNo: built.batchNo,
      totalNoBatch: built.totalNoBatch,
      psdRequirement: prodConfig?.psdReq || prev.psdRequirement || '90% < 10M',
      psdNote: prodConfig?.psdNote || '',
      receivedBatches: padBPRBatchRows(built.receivedRows),
      dispatchedBatches: padBPRBatchRows(built.dispatchedRows),
      packingMaterials: {
        ...(prev.packingMaterials || {}),
        drumUsed: drumTotal ? String(drumTotal) : (prev.packingMaterials?.drumUsed || '')
      }
    };
  };

  useEffect(() => {
    if (editing) {
      const name = primaryProduct || resolveReceiptProductName(mr, editing.productName, prodOpts) || editing.productName;
      const prodConfig = getPartyProductForMR(mr, data, name);
      const extraReceived = editing.receivedBatches || [];
      const extraDispatched = editing.dispatchedBatches || [];
      const builtReceived = buildBprRowsForProduct(mr, name, prodOpts, extraReceived);
      const builtDispatched = buildBprRowsForProduct(
        mr,
        name,
        prodOpts,
        extraDispatched.length ? extraDispatched : extraReceived
      );
      const receivedBatches = padBPRBatchRows(builtReceived.receivedRows);
      const dispatchedBatches = padBPRBatchRows(builtDispatched.dispatchedRows);
      const filledReceived = receivedBatches.filter((r) => r.batchNo || r.drumNo);
      const filledDispatched = dispatchedBatches.filter((r) => r.batchNo || r.drumNo);
      const drumTotal =
        filledDispatched.length ||
        filledReceived.length ||
        builtReceived.drums ||
        editing.totalDrums ||
        0;
      setForm({
        ...editing,
        productName: name,
        totalInputQty: builtReceived.qty || editing.totalInputQty,
        batchNo: builtReceived.batchNo || editing.batchNo,
        totalNoBatch: builtReceived.totalNoBatch || editing.totalNoBatch,
        psdNote: editing.psdNote || prodConfig?.psdNote || '',
        psdRequirement: editing.psdRequirement || prodConfig?.psdReq || '90% < 10M',
        totalDrums: drumTotal,
        receivedBatches,
        dispatchedBatches,
        packingMaterials: {
          whiteLdBags: '',
          blackLdBags: '',
          brownTapes: '',
          drumUsed: '',
          otherDetails: '',
          ...(editing.packingConsumables || {}),
          ...(editing.packingMaterials || {}),
          drumUsed:
            editing.packingMaterials?.drumUsed ||
            editing.packingConsumables?.drumUsed ||
            (drumTotal ? String(drumTotal) : '')
        }
      });
    } else {
      const bprSerial = data.settings?.serials?.BPR || 1;
      const docNo = generateDocNumber('BPR', bprSerial, new Date());
      setForm((prev) => ({
        ...scopeBprToProduct(prev, primaryProduct),
        bprNo: docNo,
        customerName: mr.partyName
      }));
    }
  }, [editing, mr, activeProductName, primaryProduct, data.settings?.serials?.BPR]);

  // Handle double dispatch drums expansion
  const toggleDoubleDispatch = () => {
    const nextVal = !form.doubleDispatch;
    setForm(prev => {
      const dataRows = prev.receivedBatches.filter(r => r.batchNo);
      let nextDispatch = [];
      if (nextVal) {
        dataRows.forEach(r => {
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}A` });
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}B` });
        });
      } else {
        nextDispatch = dataRows.map(r => ({ ...r }));
      }
      return {
        ...prev,
        doubleDispatch: nextVal,
        dispatchedBatches: padBPRBatchRows(nextDispatch)
      };
    });
  };

  const handleCellChange = (tableKey, idx, field, val) => {
    setForm(prev => {
      const list = [...prev[tableKey]];
      const item = { ...list[idx] };
      if (field === 'batchNo' || field === 'drumNo' || field === 'productName') {
        item[field] = val;
      } else {
        item[field] = val === '' ? '' : (parseFloat(val) || 0);
        const g = parseFloat(item.gross);
        const t = parseFloat(item.tare);
        if (item.gross === '' || item.tare === '' || isNaN(g) || isNaN(t)) {
          item.net = '';
        } else {
          item.net = Math.max(0, g - t);
        }
      }
      list[idx] = item;
      return { ...prev, [tableKey]: list };
    });
  };

  const addCustomRow = (tableKey, productName = '') => {
    setForm(prev => ({
      ...prev,
      [tableKey]: [...prev[tableKey], { batchNo: 'Custom', drumNo: (prev[tableKey].length + 1).toString(), productName: productName || productNames[0] || '', gross: 0, tare: 0, net: 0 }]
    }));
  };

  const buildBatchGroups = (prodRows) => {
    const batchGroups = [];
    const map = {};
    const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);
    prodRows.forEach(({ r, idx }) => {
      const key = String(r.batchNo ?? '').trim() || '—';
      if (!map[key]) {
        map[key] = { batchNo: key, rows: [], gross: 0, tare: 0, net: 0 };
        batchGroups.push(map[key]);
      }
      const net = r.net !== '' && r.net !== undefined && r.net !== null
        ? parseWt(r.net)
        : Math.max(0, parseWt(r.gross) - parseWt(r.tare));
      map[key].rows.push({ r, idx, netVal: net });
      map[key].gross += parseWt(r.gross);
      map[key].tare += parseWt(r.tare);
      map[key].net += net;
    });
    return batchGroups;
  };

  const renderBatchGroupRows = (tableKey, batchGroups) => batchGroups.map(group => (
    <React.Fragment key={`${tableKey}-batch-${group.batchNo}`}>
      {group.rows.map(({ r, idx, netVal }) => (
        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
          <td style={{ padding: '0.25rem' }}>
            <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.batchNo || ''} onChange={e => handleCellChange(tableKey, idx, 'batchNo', e.target.value)} />
          </td>
          <td style={{ padding: '0.25rem' }}>
            <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem', width: '60px' }} value={r.drumNo || ''} onChange={e => handleCellChange(tableKey, idx, 'drumNo', e.target.value)} />
          </td>
          <td style={{ padding: '0.25rem' }}>
            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross === 0 || r.gross === '' || r.gross == null ? '' : r.gross} onChange={e => handleCellChange(tableKey, idx, 'gross', e.target.value)} />
          </td>
          <td style={{ padding: '0.25rem' }}>
            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare === 0 || r.tare === '' || r.tare == null ? '' : r.tare} onChange={e => handleCellChange(tableKey, idx, 'tare', e.target.value)} />
          </td>
          <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{netVal > 0 ? netVal.toFixed(2) : formatWeightNet(r.net)}</td>
        </tr>
      ))}
      <tr style={{ background: 'rgba(91, 28, 133, 0.1)', borderBottom: '2px solid var(--accent-primary)' }}>
        <td colSpan={2} style={{ padding: '0.45rem 0.35rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
          TOTAL — Batch {group.batchNo}
        </td>
        <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>{group.gross.toFixed(2)}</td>
        <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>{group.tare.toFixed(2)}</td>
        <td style={{ padding: '0.45rem 0.35rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{group.net.toFixed(2)}</td>
      </tr>
    </React.Fragment>
  ));

  const renderWeightTable = (tableKey, title, totalNet) => {
    const rows = form[tableKey] || [];
    const groupedProducts = productNames.length
      ? productNames
      : [...new Set(rows.map(r => r.productName).filter(Boolean))];
    const totalGross = tableKey === 'receivedBatches' ? totalReceivedGross : totalDispatchedGross;

    return (
      <div style={{ background: 'var(--input-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h4>
          <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow(tableKey)}>+ Add Row</button>
        </div>
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {groupedProducts.length <= 1 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.35rem' }}>Batch No</th>
                  <th style={{ padding: '0.35rem' }}>Drum No</th>
                  <th style={{ padding: '0.35rem' }}>Gross</th>
                  <th style={{ padding: '0.35rem' }}>Tare</th>
                  <th style={{ padding: '0.35rem' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {renderBatchGroupRows(tableKey, buildBatchGroups(rows.map((r, idx) => ({ r, idx }))))}
              </tbody>
            </table>
          ) : (
            groupedProducts.map((prodName, pIdx) => {
              const prodRows = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => (r.productName || productNames[0]) === prodName);
              if (!prodRows.length) return null;
              return (
                <div key={prodName} style={{ marginBottom: '1rem' }}>
                  <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    Product {pIdx + 1}: {prodName}
                  </h5>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.35rem' }}>Batch No</th>
                        <th style={{ padding: '0.35rem' }}>Drum No</th>
                        <th style={{ padding: '0.35rem' }}>Gross</th>
                        <th style={{ padding: '0.35rem' }}>Tare</th>
                        <th style={{ padding: '0.35rem' }}>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderBatchGroupRows(tableKey, buildBatchGroups(prodRows))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
          <span>GRAND TOTAL {tableKey === 'receivedBatches' ? 'Received' : 'Dispatched'}:</span>
          <span style={{ display: 'flex', gap: '1rem', color: 'var(--accent-primary)' }}>
            <span>Gross: {totalGross.toFixed(2)} Kg</span>
            <span>Net: {totalNet.toFixed(2)} Kg</span>
          </span>
        </div>
      </div>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const sumRows = (rows, key) => (rows || []).reduce((s, r) => {
      const n = parseFloat(r[key]);
      return s + (!isNaN(n) && r[key] !== '' && r[key] != null ? n : 0);
    }, 0);
    const countDrums = (rows) => (rows || []).filter((r) => r.batchNo || r.drumNo).length;
    const totalReceivedNet = sumRows(form.receivedBatches, 'net');
    const totalDispatchedNet = sumRows(form.dispatchedBatches, 'net');
    const totalReceivedGross = sumRows(form.receivedBatches, 'gross');
    const totalDispatchedGross = sumRows(form.dispatchedBatches, 'gross');
    const filledDrums = Math.max(
      countDrums(form.dispatchedBatches),
      countDrums(form.receivedBatches),
      parseInt(form.totalDrums, 10) || 0
    );
    const packingMaterials = { ...(form.packingMaterials || {}) };
    if (!packingMaterials.drumUsed && filledDrums) packingMaterials.drumUsed = String(filledDrums);
    const packingConsumables = {
      ...(form.packingConsumables || {}),
      whiteLdBags: packingMaterials.whiteLdBags || form.packingConsumables?.whiteLdBags || '',
      blackLdBags: packingMaterials.blackLdBags || form.packingConsumables?.blackLdBags || '',
      brownTapes: packingMaterials.brownTapes || form.packingConsumables?.brownTapes || '',
      drumUsed: packingMaterials.drumUsed || form.packingConsumables?.drumUsed || '',
      otherDetails: packingMaterials.otherDetails || form.packingConsumables?.otherDetails || ''
    };
    const finalDoc = {
      ...form,
      productName: resolveReceiptProductName(mr, form.productName || lockedProduct || primaryProduct, prodOpts)
        || form.productName,
      partyName: form.partyName || form.customerName || mr.partyName,
      receiptId: mr.id,
      totalDrums: filledDrums || form.totalDrums || 0,
      packingMaterials,
      packingConsumables,
      totalReceivedNet,
      totalDispatchedNet,
      totalReceivedGross,
      totalDispatchedGross,
      lumpsNetWeight: form.lumpsNetWeight || form.dispatchQty?.lumpsNet || '',
      sampleNetWeight: form.sampleNetWeight || form.dispatchQty?.sampleNet || '',
      floorDustNetWeight: form.floorDustNetWeight || form.dispatchQty?.floorDustNet || '',
      irrecoverableLoss: form.irrecoverableLoss || form.dispatchQty?.netProcessLoss || form.processLoss || '',
      processLoss: form.processLoss || form.irrecoverableLoss || form.dispatchQty?.netProcessLoss || '',
      remark: form.remark || form.dispatchQty?.remark || '',
      dispatchRemark: form.dispatchRemark || form.remark || form.dispatchQty?.remark || ''
    };

    if (editing) {
      updateItem('bprs', editing.id, finalDoc);
    } else {
      updateData('bprs', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('BPR');
    }
    onClose();
  };

  const totalReceivedNet = (form.receivedBatches || []).reduce((s, r) => s + (parseFloat(r.net) || 0), 0);
  const totalDispatchedNet = (form.dispatchedBatches || []).reduce((s, r) => s + (parseFloat(r.net) || 0), 0);
  const totalReceivedGross = (form.receivedBatches || []).reduce((s, r) => s + (parseFloat(r.gross) || 0), 0);
  const totalDispatchedGross = (form.dispatchedBatches || []).reduce((s, r) => s + (parseFloat(r.gross) || 0), 0);
  const formatNet = formatWeightNet;

  return (
    <form onSubmit={handleSubmit}>
      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} onlyProduct={activeProductName} />

      <section style={bprSectionStyle}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Basic Info</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label>BPR Number</label>
            <input type="text" className="input-field" readOnly value={form.bprNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
          </div>
          <div>
            <label>BPR Date *</label>
            <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <label>Customer Name</label>
            <SearchableSelect
              className="input-field"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            >
              <option value="">Select party</option>
              {form.customerName && !(data.parties || []).some((p) => p.name === form.customerName) && (
                <option value={form.customerName}>{form.customerName}</option>
              )}
              {(data.parties || []).map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </SearchableSelect>
          </div>
          <div>
            <label>Product Name</label>
            <SearchableSelect
              className="input-field"
              value={form.productName}
              disabled={!!lockedProduct}
              onChange={(e) => {
                const next = e.target.value;
                setForm((prev) => scopeBprToProduct(prev, next));
              }}
            >
              <option value="">Select product</option>
              {form.productName && !(lockedProduct ? productNames : allProductNames).includes(form.productName) && (
                <option value={form.productName}>{form.productName}</option>
              )}
              {(lockedProduct ? productNames : allProductNames).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </SearchableSelect>
          </div>
          <div>
            <label>Total Quantity (kg)</label>
            <input type="number" className="input-field" min="0" step="any" value={form.totalInputQty} onChange={e => setForm({ ...form, totalInputQty: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })} />
          </div>
          <div>
            <label>Batch No.</label>
            <input type="text" className="input-field" value={form.batchNo} onChange={e => setForm({ ...form, batchNo: e.target.value })} />
          </div>
          <div>
            <label>Total No. Batch</label>
            <input type="number" className="input-field" value={form.totalNoBatch} onChange={e => setForm({ ...form, totalNoBatch: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label>Total Drum</label>
            <input type="number" className="input-field" value={form.totalDrums} onChange={e => setForm({ ...form, totalDrums: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label>PSD Requirement *</label>
            <input type="text" className="input-field" required value={form.psdRequirement} onChange={e => setForm({...form, psdRequirement: e.target.value})} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>PSD Note</label>
            <input type="text" className="input-field" value={form.psdNote || ''} onChange={e => setForm({...form, psdNote: e.target.value})} placeholder="From party product master" />
          </div>
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Process Header</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label>Committed</label>
            <input type="text" className="input-field" value={form.committedBy} onChange={e => setForm({ ...form, committedBy: e.target.value })} />
          </div>
          <div>
            <label>Processing Start (Date)</label>
            <DateField className="input-field" value={form.processingStartDate} onChange={e => setForm({ ...form, processingStartDate: e.target.value })} />
          </div>
          <div>
            <label>Processing Start (Time)</label>
            <TimeField className="input-field" value={form.processingStartTime} onChange={e => setForm({ ...form, processingStartTime: e.target.value })} />
          </div>
          <div>
            <label>Processing Supervisor</label>
            <SearchableSelect
              className="input-field"
              value={form.processingSupervisor}
              onChange={(e) => setForm({ ...form, processingSupervisor: e.target.value })}
            >
              <option value="">Select supervisor</option>
              {form.processingSupervisor && !(data.users || []).some((u) => u.name === form.processingSupervisor) && (
                <option value={form.processingSupervisor}>{form.processingSupervisor}</option>
              )}
              {(data.users || []).filter((u) => u.active !== false).map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </SearchableSelect>
          </div>
          <div>
            <label>Sizing report require</label>
            <SearchableSelect className="input-field" value={form.sizingReportRequired} onChange={e => setForm({ ...form, sizingReportRequired: e.target.value })}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </SearchableSelect>
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <label>Particle size result</label>
            <input type="text" className="input-field" value={form.particleSizeResult} onChange={e => setForm({ ...form, particleSizeResult: e.target.value })} />
          </div>
        </div>
      </section>

      <section style={bprSectionStyle}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Pressures & Checklist</h3>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Cleaning Checklist</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { key: 'isMicronizerCleaned', label: 'Is the Micronizar cleaned?' },
            { key: 'isAreaCleaned', label: 'Is the processing Area Cleaned?' },
            { key: 'isFilterBagPackedLabeled', label: 'Is the filter Bag before process packed and labeled in LDPE Bag ?' },
            { key: 'isBagCleanBlackSpotFree', label: 'Is the bag is clean and black spot free?' }
          ].map(item => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(form[item.key])}
                onChange={e => setForm({ ...form, [item.key]: e.target.checked })}
              />
              {item.label}
            </label>
          ))}
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Pressure Log</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.4rem' }}>S.P.</th>
                <th style={{ padding: '0.4rem' }}>D.P.</th>
                <th style={{ padding: '0.4rem' }}>T.P.</th>
                <th style={{ padding: '0.4rem' }}>F.P.</th>
                <th style={{ padding: '0.4rem' }}>Fi.P.</th>
              </tr>
            </thead>
            <tbody>
              {(form.pressures || []).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['sp', 'dp', 'tp', 'fp', 'fip'].map(k => (
                    <td key={k} style={{ padding: '0.3rem' }}>
                      <input
                        className="input-field"
                        style={{ padding: '0.25rem', fontSize: '0.8rem' }}
                        value={row[k]}
                        onChange={e => {
                          const next = [...(form.pressures || [])];
                          next[idx] = { ...next[idx], [k]: e.target.value };
                          setForm({ ...form, pressures: next });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={bprSectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-primary)' }}>Batches & Weights</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}>
            <input type="checkbox" checked={form.doubleDispatch} onChange={toggleDoubleDispatch} />
            Double Dispatch Drums Count (e.g. split micronised batches)
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {renderWeightTable('receivedBatches', 'Received Raw Material Weight', totalReceivedNet)}
          {renderWeightTable('dispatchedBatches', 'Dispatched (Micronised) Material Weight', totalDispatchedNet)}
        </div>
      </section>

      <section style={bprSectionStyle}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Quality & Dispatch</h3>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Packing Materials Used</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <label>White LD Bags</label>
            <input className="input-field" value={form.packingMaterials?.whiteLdBags || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, whiteLdBags: e.target.value } })} />
          </div>
          <div>
            <label>Black LD Bags</label>
            <input className="input-field" value={form.packingMaterials?.blackLdBags || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, blackLdBags: e.target.value } })} />
          </div>
          <div>
            <label>Brow Tapes</label>
            <input className="input-field" value={form.packingMaterials?.brownTapes || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, brownTapes: e.target.value } })} />
          </div>
          <div>
            <label>Drum Used</label>
            <input className="input-field" value={form.packingMaterials?.drumUsed || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, drumUsed: e.target.value } })} />
          </div>
          <div>
            <label>Other Details</label>
            <input className="input-field" value={form.packingMaterials?.otherDetails || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, otherDetails: e.target.value } })} />
          </div>
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Dispatch Material Quantity Details</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <label>Micronized Material Net Weight</label>
            <input className="input-field" value={form.dispatchQty?.micronizedNet || (totalDispatchedNet > 0 ? totalDispatchedNet.toFixed(2) : '')} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, micronizedNet: e.target.value } })} />
          </div>
          <div>
            <label>Lumps Net Weight</label>
            <input className="input-field" value={form.dispatchQty?.lumpsNet || form.lumpsNetWeight || ''} onChange={e => setForm({ ...form, lumpsNetWeight: e.target.value, dispatchQty: { ...form.dispatchQty, lumpsNet: e.target.value } })} />
          </div>
          <div>
            <label>Sample Net Weight</label>
            <input className="input-field" value={form.sampleNetWeight || form.dispatchQty?.sampleNet || ''} onChange={e => setForm({ ...form, sampleNetWeight: e.target.value, dispatchQty: { ...form.dispatchQty, sampleNet: e.target.value } })} />
          </div>
          <div>
            <label>Irrecoverable loss</label>
            <input className="input-field" value={form.irrecoverableLoss || form.dispatchQty?.netProcessLoss || ''} onChange={e => setForm({ ...form, irrecoverableLoss: e.target.value, processLoss: e.target.value, dispatchQty: { ...form.dispatchQty, netProcessLoss: e.target.value } })} />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <label>Remark</label>
            <input className="input-field" value={form.dispatchQty?.remark || form.remark || ''} onChange={e => setForm({ ...form, remark: e.target.value, dispatchRemark: e.target.value, dispatchQty: { ...form.dispatchQty, remark: e.target.value } })} />
          </div>
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Process Completion</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label>Process Completion Date</label>
            <DateField className="input-field" value={form.processCompletionDate} onChange={e => setForm({ ...form, processCompletionDate: e.target.value })} />
          </div>
          <div>
            <label>Process Completion Time</label>
            <TimeField className="input-field" value={form.processCompletionTime} onChange={e => setForm({ ...form, processCompletionTime: e.target.value })} />
          </div>
          <div>
            <label>Remarks</label>
            <input type="text" className="input-field" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <input type="checkbox" checked={form.isFilterBagPackedStoredAfter} onChange={e => setForm({ ...form, isFilterBagPackedStoredAfter: e.target.checked })} />
          Is the filter bag after process packed and labeled and stored safely?
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label>Operator Signature Name</label>
            <input type="text" className="input-field" value={form.operatorSignature} onChange={e => setForm({ ...form, operatorSignature: e.target.value })} />
          </div>
          <div>
            <label>Plant Supervisor Signature Name</label>
            <input type="text" className="input-field" value={form.plantSupervisorSignature} onChange={e => setForm({ ...form, plantSupervisorSignature: e.target.value })} />
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save BPR Document</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 3. PSD UPLOADER & RESULTS FORM (Slide 9 Set A)
// ----------------------------------------------------
const PSDGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodOpts = receiptProductOptions(mr, data);
  const productNames = getScopedProductNames(mr, prodOpts, activeProductName);

  const makeDefaultReport = (prodName, batchNo = '') => {
    const prodConfig = (party?.products || []).find(p => p.name === prodName);
    const batches = getProductBatches(mr, prodName, prodOpts);
    const batch = batches.find(b => b.batchNo === batchNo) || batches[0];
    return {
      productName: prodName,
      batchNo: batchNo || batch?.batchNo || '',
      method: batch?.psdMethod || prodConfig?.psdMethodDefault || 'Dry',
      requirement: batch?.psdReq || prodConfig?.psdReq || '90% < 10M',
      result: '',
      fileName: '',
      fileSize: ''
    };
  };

  const buildInitialReports = () => {
    const reports = [];
    productNames.forEach(prodName => {
      const batches = getProductBatches(mr, prodName, prodOpts).filter(b => b.batchNo);
      if (batches.length) {
        batches.forEach(b => reports.push(makeDefaultReport(prodName, b.batchNo)));
      } else {
        reports.push(makeDefaultReport(prodName));
      }
    });
    return reports.length ? reports : [makeDefaultReport(mr.productName || '')];
  };

  const [form, setForm] = useState({
    psdNo: '',
    date: new Date().toISOString().split('T')[0],
    reports: buildInitialReports(),
    notes: ''
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        reports: (editing.reports || []).map(r => ({
          ...r,
          productName: r.productName || productNames[0] || mr.productName || ''
        })),
        notes: editing.notes || ''
      });
    } else {
      const psdSerial = data.settings?.serials?.PSD || 1;
      const docNo = generateDocNumber('PSD', psdSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        psdNo: docNo,
        reports: buildInitialReports()
      }));
    }
  }, [form.date, editing, data.settings?.serials?.PSD]);

  const handleFileUpload = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({
        ...prev,
        reports: (prev.reports || []).map((r, idx) => idx === index ? ({
          ...r,
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`
        }) : r)
      }));
    }
  };

  const addReportForProduct = (prodName) => {
    setForm(prev => ({
      ...prev,
      reports: [...(prev.reports || []), makeDefaultReport(prodName)]
    }));
  };

  const removeReport = (idx) => {
    setForm(prev => ({ ...prev, reports: (prev.reports || []).filter((_, i) => i !== idx) }));
  };

  const updateReport = (idx, patch) => {
    setForm(prev => {
      const next = [...(prev.reports || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, reports: next };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const counts = (form.reports || []).reduce((acc, r) => {
      const k = `${r.productName || ''}::${r.batchNo || ''}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const tooMany = Object.entries(counts).find(([batch, c]) => batch && c > 3);
    if (tooMany) {
      alert(`Max 3 PSD reports allowed for batch "${tooMany[0].split('::')[1]}".`);
      return;
    }

    const finalDoc = {
      ...form,
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: activeProductName || getReceiptProductLabel(mr, prodOpts),
      uploadedAt: new Date().toLocaleString()
    };

    if (editing) {
      updateItem('psds', editing.id, finalDoc);
    } else {
      updateData('psds', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PSD');
    }
    onClose();
  };

  const displayProducts = productNames.length ? productNames : [mr.productName].filter(Boolean);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>PSD Document No</label>
          <input type="text" className="input-field" readOnly value={form.psdNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>PSD Date</label>
          <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Customer Party</label>
          <input type="text" className="input-field" readOnly value={mr.partyName} />
        </div>
        <div>
          <label>Products</label>
          <input type="text" className="input-field" readOnly value={getReceiptProductLabel(mr, prodOpts)} />
        </div>
      </div>

      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} onlyProduct={activeProductName} />

      <div style={{ marginBottom: '1.5rem' }}>
        {displayProducts.map((prodName, pIdx) => {
          const prodReports = (form.reports || []).map((r, idx) => ({ r, idx })).filter(({ r }) => (r.productName || displayProducts[0]) === prodName);
          const prodBatches = getProductBatches(mr, prodName, prodOpts).filter(b => b.batchNo);
          return (
            <div key={prodName} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', background: 'var(--input-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Product {pIdx + 1}: {prodName}</h3>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addReportForProduct(prodName)}>+ Add Report</button>
              </div>
              {prodReports.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No reports yet for this product.</p>
              ) : (
                prodReports.map(({ r, idx }, repIdx) => (
                  <div key={idx} style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0 }}>Report {repIdx + 1}</h4>
                      {(form.reports || []).length > 1 && (
                        <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none' }} onClick={() => removeReport(idx)}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label>Batch No *</label>
                        <SearchableSelect className="input-field" required value={r.batchNo} onChange={e => updateReport(idx, { batchNo: e.target.value })}>
                          <option value="">-- Select Batch --</option>
                          {prodBatches.map((b, bIdx) => (
                            <option key={bIdx} value={b.batchNo}>{b.batchNo}</option>
                          ))}
                        </SearchableSelect>
                      </div>
                      <div>
                        <label>Method</label>
                        <SearchableSelect className="input-field" value={r.method} onChange={e => updateReport(idx, { method: e.target.value })}>
                          <option value="Dry">Dry</option>
                          <option value="Wet">Wet</option>
                          <option value="N/A">N/A</option>
                        </SearchableSelect>
                      </div>
                      <div>
                        <label>PSD Requirement *</label>
                        <input className="input-field" required value={r.requirement} onChange={e => updateReport(idx, { requirement: e.target.value })} />
                      </div>
                      <div>
                        <label>PSD Result *</label>
                        <input className="input-field" required value={r.result} onChange={e => updateReport(idx, { result: e.target.value })} />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label>Upload PDF</label>
                        <div style={{ background: 'var(--input-bg)', border: '2px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                          <UploadCloud size={28} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
                          <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, idx)} style={{ fontSize: '0.8rem' }} />
                          {r.fileName && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {r.fileName} ({r.fileSize})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label>Note</label>
        <textarea className="input-field" rows="3" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save PSD Report(s)</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 4. PACKING LIST GENERATOR FORM (Slide 10 Set A)
// ----------------------------------------------------
const PLGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodOpts = receiptProductOptions(mr, data);
  const productNames = getReceiptProductNames(mr, prodOpts);
  const plFormInitKey = `${mr.id}-${editing?.id || 'new'}`;

  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    productName: getReceiptProductLabel(mr, prodOpts),
    productSummaries: [],
    totalWeight: 0,
    totalDrums: 0,
    sievingLumps: '',
    batches: []
  });

  const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);
  const normProd = (s) => (s || '').trim().toLowerCase();

  const displayProducts = useMemo(() => {
    const fromRows = [...new Set((form.batches || []).map(r => r.productName).filter(Boolean))];
    if (productNames.length) {
      const merged = [...productNames];
      fromRows.forEach((name) => {
        if (!merged.some(p => normProd(p) === normProd(name))) merged.push(name);
      });
      return merged;
    }
    return fromRows.length ? fromRows : [mr.productName].filter(Boolean);
  }, [form.batches, productNames, mr.productName]);

  const grandTotal = useMemo(() => {
    const fromBatches = (form.batches || []).reduce((acc, b) => {
      const net = b.net !== '' && b.net !== undefined && b.net !== null
        ? parseWt(b.net)
        : Math.max(0, parseWt(b.gross) - parseWt(b.tare));
      return {
        gross: acc.gross + parseWt(b.gross),
        tare: acc.tare + parseWt(b.tare),
        net: acc.net + net
      };
    }, { gross: 0, tare: 0, net: 0 });
    const lumps = parseWt(form.sievingLumps);
    return { ...fromBatches, lumps, net: fromBatches.net + lumps };
  }, [form.batches, form.sievingLumps]);

  useEffect(() => {
    if (editing) {
      const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const mergedBatches = buildPLBatchesFromMR(data, mr, prodOpts, editing.batches || []);
      setForm({
        ...editing,
        partyName: editing.partyName || mr.partyName || '',
        receiptNo: editing.receiptNo || mr.receiptNo || '',
        productName: editing.productName?.includes(',')
          ? editing.productName
          : getReceiptProductLabel(mr, prodOpts),
        productSummaries: editing.productSummaries?.length ? editing.productSummaries : summaries,
        sievingLumps: editing.sievingLumps ?? editing.sievingLumpsNet ?? '',
        batches: mergedBatches
      });
    } else {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date());
      const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const plRows = buildPLBatchesFromMR(data, mr, prodOpts);
      const linkedBpr = findBPR(data, mr.id, activeProductName);

      setForm({
        plNo: docNo,
        date: new Date().toISOString().split('T')[0],
        partyName: mr.partyName || '',
        receiptNo: mr.receiptNo || '',
        productName: getReceiptProductLabel(mr, prodOpts),
        productSummaries: summaries,
        totalWeight: 0,
        totalDrums: plRows.length,
        sievingLumps: linkedBpr?.lumpsNetWeight || linkedBpr?.lumpsNet || '',
        batches: plRows
      });
    }
  }, [plFormInitKey]);

  useEffect(() => {
    const drumsNet = form.batches.reduce((s, r) => {
      const net = r.net !== '' && r.net !== undefined ? parseWt(r.net) : Math.max(0, parseWt(r.gross) - parseWt(r.tare));
      return s + net;
    }, 0);
    const lumps = parseWt(form.sievingLumps);
    setForm(prev => ({
      ...prev,
      totalDrums: prev.batches.length,
      totalWeight: drumsNet + lumps
    }));
  }, [form.batches, form.sievingLumps]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      if (field === 'batchNo' || field === 'drumNo' || field === 'productName') {
        item[field] = val;
      } else {
        item[field] = val === '' ? '' : (parseFloat(val) || '');
        const g = parseWt(item.gross);
        const t = parseWt(item.tare);
        item.net = (item.gross === '' || item.tare === '') ? '' : Math.max(0, g - t);
      }
      list[idx] = item;
      return { ...prev, batches: list };
    });
  };

  const addCustomRow = (productName = '') => {
    const prod = productName || productNames[0] || mr.productName || '';
    setForm(prev => {
      const prodRows = prev.batches.filter(b => normProd(b.productName || prod) === normProd(prod));
      const mrBatchNo = getProductBatches(mr, prod, prodOpts)[0]?.batchNo || '';
      const batchNo = prodRows.find(b => b.batchNo)?.batchNo || mrBatchNo || '';
      return {
        ...prev,
        batches: [...prev.batches, {
          batchNo,
          drumNo: (prodRows.length + 1).toString(),
          productName: prod,
          gross: '',
          tare: '',
          net: ''
        }]
      };
    });
  };

  const removeRow = (idx) => {
    setForm(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== idx)
    }));
  };

  const rowMatchesProduct = (row, prodName) => {
    const target = (prodName || '').trim().toLowerCase();
    const rowProd = (row.productName || '').trim().toLowerCase();
    if (!target) return !rowProd;
    return rowProd === target;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
    const finalDoc = {
      ...form,
      receiptId: mr.id,
      partyName: form.partyName || mr.partyName || '',
      receiptNo: form.receiptNo || mr.receiptNo || '',
      productName: getReceiptProductLabel(mr, prodOpts),
      productSummaries: summaries.length ? summaries : (form.productSummaries || []),
      sievingLumps: form.sievingLumps === '' || form.sievingLumps == null ? '' : parseWt(form.sievingLumps)
    };

    if (editing) {
      updateItem('packingLists', editing.id, finalDoc);
    } else {
      if (findAnyPackingList(data.packingLists, mr.id)) {
        alert('A Packing List already exists for this Material Receipt. Please edit the existing PL.');
        return;
      }
      updateData('packingLists', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PL');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Packing List No</label>
          <input type="text" className="input-field" readOnly value={form.plNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>Packing List Date</label>
          <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Party Name</label>
          <input type="text" className="input-field" readOnly value={form.partyName || mr.partyName || ''} />
        </div>
        <div>
          <label>MR No</label>
          <input type="text" className="input-field" readOnly value={form.receiptNo || mr.receiptNo || '—'} />
        </div>
        <div>
          <label>Product(s)</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
        </div>
        <div>
          <label>Sieving Lumps (Kg)</label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="0.00"
            value={form.sievingLumps === 0 || form.sievingLumps === '' || form.sievingLumps == null ? '' : form.sievingLumps}
            onChange={e => setForm({ ...form, sievingLumps: e.target.value === '' ? '' : (parseFloat(e.target.value) || '') })}
          />
        </div>
        <div>
          <label>Total Quantity (Calculated)</label>
          <input type="text" className="input-field" readOnly value={`${form.totalWeight.toFixed(2)} Kg`} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>Total Number of Drums</label>
          <input type="text" className="input-field" readOnly value={`${form.totalDrums} Drums`} style={{ fontWeight: 600 }} />
        </div>
      </div>

      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} />

      <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem' }}>Batch-Wise Packing Weight Details</h3>

        {displayProducts.map((prodName, pIdx) => {
          const prodRows = form.batches.map((r, idx) => ({ r, idx })).filter(({ r }) =>
            rowMatchesProduct(r, prodName)
          );
          const sectionLabel = prodName || form.productName || `Product ${pIdx + 1}`;
          const batchGroups = [];
          const map = {};
          prodRows.forEach(({ r, idx }) => {
            const key = String(r.batchNo ?? '').trim() || '—';
            if (!map[key]) {
              map[key] = { batchNo: key, rows: [], gross: 0, tare: 0, net: 0 };
              batchGroups.push(map[key]);
            }
            const net = r.net !== '' && r.net !== undefined && r.net !== null
              ? parseWt(r.net)
              : Math.max(0, parseWt(r.gross) - parseWt(r.tare));
            map[key].rows.push({ ...r, idx, netVal: net });
            map[key].gross += parseWt(r.gross);
            map[key].tare += parseWt(r.tare);
            map[key].net += net;
          });
          return (
            <div key={`${sectionLabel}-${pIdx}`} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Product {pIdx + 1}: {sectionLabel}</h4>
                <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow(prodName)}>+ Add Row</button>
              </div>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.35rem' }}>Sr No</th>
                      <th style={{ padding: '0.35rem' }}>Batch No</th>
                      <th style={{ padding: '0.35rem' }}>Drum No</th>
                      <th style={{ padding: '0.35rem' }}>Gross Wt (Manual)</th>
                      <th style={{ padding: '0.35rem' }}>Tare Wt (Manual)</th>
                      <th style={{ padding: '0.35rem' }}>Net Wt (Auto)</th>
                      <th style={{ padding: '0.35rem', width: '44px' }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No rows yet — click &quot;+ Add Row&quot; to add drum weights for this product.
                        </td>
                      </tr>
                    ) : batchGroups.map(group => (
                      <React.Fragment key={`${sectionLabel}-batch-${group.batchNo}`}>
                        {group.rows.map((r) => (
                          <tr key={r.idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.idx + 1}</td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.batchNo || ''} onChange={e => handleCellChange(r.idx, 'batchNo', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="text" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem', width: '60px' }} value={r.drumNo || ''} onChange={e => handleCellChange(r.idx, 'drumNo', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.gross === 0 ? '' : r.gross} onChange={e => handleCellChange(r.idx, 'gross', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.tare === 0 ? '' : r.tare} onChange={e => handleCellChange(r.idx, 'tare', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                              {r.netVal > 0 ? r.netVal.toFixed(2) : '0.00'}
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <button
                                type="button"
                                title="Delete row"
                                onClick={() => removeRow(r.idx)}
                                style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: 'rgba(91, 28, 133, 0.1)', borderBottom: '2px solid var(--accent-primary)' }}>
                          <td colSpan={3} style={{ padding: '0.45rem 0.35rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
                            TOTAL — Batch {group.batchNo}
                          </td>
                          <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>
                            {group.gross.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>
                            {group.tare.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.45rem 0.35rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {group.net.toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {form.batches.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '0.25rem', border: '1px solid var(--border-color)' }}>
            <tbody>
              {grandTotal.lumps > 0 && (
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td colSpan={3} style={{ padding: '0.5rem' }} />
                  <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>Sieving Lumps</td>
                  <td style={{ padding: '0.5rem' }} />
                  <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'center' }}>{grandTotal.lumps.toFixed(2)}</td>
                </tr>
              )}
              <tr style={{ background: 'rgba(91, 28, 133, 0.1)', borderTop: '2px solid var(--accent-primary)' }}>
                <td colSpan={3} style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                  GRAND TOTAL
                </td>
                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center' }}>
                  {grandTotal.gross.toFixed(2)}
                </td>
                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center' }}>
                  {grandTotal.tare.toFixed(2)}
                </td>
                <td style={{ padding: '0.65rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)', textAlign: 'center', minWidth: '90px' }}>
                  {grandTotal.net.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Packing List</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 5. DELIVERY CHALLAN GENERATOR FORM (Slide 11)
// ----------------------------------------------------
const DCGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const prodOpts = receiptProductOptions(mr, data);
  const pl = findPL(data, mr.id, activeProductName);
  const availableProducts = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
  const dcFormInitKey = `${mr.id}-${editing?.id || 'new'}-${activeProductName || 'all'}`;

  const initialSelected = activeProductName
    ? [resolveReceiptProductName(mr, activeProductName, prodOpts)]
    : getReceiptProductNames(mr, prodOpts);
  const initialComputed = buildDCFieldsFromProducts(mr, pl, prodOpts, initialSelected);

  const [form, setForm] = useState({
    dcNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
    partyName: mr.partyName || '',
    billAddress: mr.billAddress || '',
    shipAddress: mr.shipAddress || '',
    gstinBill: mr.gstinBill || '',
    gstinShip: mr.gstinShip || '',
    selectedProducts: initialSelected,
    productName: initialComputed.productName,
    productSummaries: initialComputed.productSummaries,
    qty: initialComputed.qty,
    totalDrums: initialComputed.totalDrums,
    emptyDrums: initialComputed.emptyDrums || 0,
    value: initialComputed.value === 0 || initialComputed.value == null ? '' : initialComputed.value,
    vehicleNo: mr.vehicleNo || '',
    transporterName: '',
    driverName: '',
    driverContact: '',
    termsAndConditions: (mr.deliveryNotes || '').trim(),
    deliveryNotes: (mr.deliveryNotes || '').trim()
  });

  useEffect(() => {
    if (editing) {
      const selected = editing.selectedProducts?.length
        ? editing.selectedProducts
        : (editing.productSummaries || []).map(p => p.prodName).filter(Boolean);
      const computed = buildDCFieldsFromProducts(mr, pl, prodOpts, selected);
      setForm({
        ...editing,
        selectedProducts: selected,
        ...computed,
        qty: editing.qty,
        totalDrums: editing.totalDrums,
        value: parseFloat(editing.value) > 0 ? editing.value : (computed.value || ''),
        transporterName: editing.transporterName || '',
        driverContact: editing.driverContact || ''
      });
      return;
    }
    const dcSerial = data.settings?.serials?.DC || 1;
    const docNo = generateDocNumber('DC', dcSerial, new Date());
    const selected = activeProductName
      ? [resolveReceiptProductName(mr, activeProductName, prodOpts)]
      : getReceiptProductNames(mr, prodOpts);
    const computed = buildDCFieldsFromProducts(mr, pl, prodOpts, selected);
    setForm(prev => ({
      ...prev,
      dcNo: docNo,
      partyDocNo: mr.partyDocNo || '',
      partyDocDate: mr.partyDocDate || '',
      partyName: mr.partyName || '',
      selectedProducts: selected,
      ...computed,
      value: computed.value === 0 || computed.value == null ? '' : computed.value,
      vehicleNo: mr.vehicleNo || prev.vehicleNo,
      termsAndConditions: (mr.deliveryNotes || '').trim() || prev.termsAndConditions,
      deliveryNotes: (mr.deliveryNotes || '').trim() || prev.deliveryNotes || prev.termsAndConditions
    }));
  }, [dcFormInitKey]);

  const toggleProductSelection = (prodName) => {
    setForm(prev => {
      const current = prev.selectedProducts || [];
      const isSelected = current.some(p => p.trim().toLowerCase() === prodName.trim().toLowerCase());
      const next = isSelected
        ? current.filter(p => p.trim().toLowerCase() !== prodName.trim().toLowerCase())
        : [...current, prodName];
      if (next.length === 0) return prev;
      const computed = buildDCFieldsFromProducts(mr, pl, prodOpts, next);
      return {
        ...prev,
        selectedProducts: next,
        ...computed,
        value: parseFloat(prev.value) > 0 ? prev.value : (computed.value || '')
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const computed = buildDCFieldsFromProducts(mr, pl, prodOpts, form.selectedProducts);
    const mrNotes = (mr.deliveryNotes || '').trim();
    const dcNotes = (form.deliveryNotes || form.termsAndConditions || '').trim();
    const finalDoc = {
      ...form,
      productSummaries: computed.productSummaries,
      productName: computed.productName || form.productName,
      qty: form.qty,
      totalDrums: form.totalDrums,
      emptyDrums: computed.emptyDrums || form.emptyDrums || 0,
      value: form.value === '' || form.value == null ? '' : form.value,
      receiptId: mr.id,
      termsAndConditions: dcNotes || mrNotes || form.termsAndConditions,
      deliveryNotes: dcNotes || mrNotes
    };

    if (editing) {
      updateItem('deliveryChallans', editing.id, finalDoc);
    } else {
      updateData('deliveryChallans', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('DC');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Delivery Challan No</label>
          <input type="text" className="input-field" value={form.dcNo} onChange={e => setForm({...form, dcNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>DC Date</label>
          <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Supplier Document No</label>
          <input type="text" className="input-field" value={form.partyDocNo} onChange={e => setForm({...form, partyDocNo: e.target.value})} />
        </div>
        <div>
          <label>Supplier Doc Date</label>
          <DateField className="input-field" value={form.partyDocDate} onChange={e => setForm({...form, partyDocDate: e.target.value})} />
        </div>

        <div style={{ gridColumn: 'span 4', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>

        {availableProducts.length > 1 && (
          <div style={{ gridColumn: 'span 4', marginBottom: '0.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Product(s) for Dispatch</label>
            <SearchableSelect
              className="input-field"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleProductSelection(e.target.value);
              }}
            >
              <option value="">Search and add / remove a product…</option>
              {availableProducts.map((p) => {
                const checked = (form.selectedProducts || []).some((n) => n.trim().toLowerCase() === p.prodName.trim().toLowerCase());
                return (
                  <option key={p.prodName} value={p.prodName}>
                    {checked ? '✓ ' : ''}{p.prodName} ({parseFloat(p.qty || 0).toFixed(2)} Kg)
                  </option>
                );
              })}
            </SearchableSelect>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.65rem' }}>
              {(form.selectedProducts || []).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn"
                  onClick={() => toggleProductSelection(name)}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                >
                  {name} ×
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label>Party Name</label>
          <SearchableSelect
            allowCustom
            className="input-field"
            placeholder="Select or type party name"
            value={form.partyName}
            onChange={(e) => setForm({ ...form, partyName: e.target.value })}
          >
            <option value="">Select or type party name</option>
            {(data.parties || []).filter((p) => !p.isDeleted).map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </SearchableSelect>
        </div>
        <div>
          <label>Product Name</label>
          <SearchableSelect
            className="input-field"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
          >
            <option value="">Select product</option>
            {form.productName && !availableProducts.some((p) => p.prodName === form.productName) && (
              <option value={form.productName}>{form.productName}</option>
            )}
            {availableProducts.map((p) => (
              <option key={p.prodName} value={p.prodName}>{p.prodName}</option>
            ))}
          </SearchableSelect>
        </div>
        <div>
          <label>Received Qty (Kg)</label>
          <input type="number" className="input-field" required value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
        </div>
        <div>
          <label>Total Drums *</label>
          <input type="number" className="input-field" required value={form.totalDrums} onChange={e => setForm({...form, totalDrums: parseInt(e.target.value, 10) || 0})} />
          {(parseInt(form.emptyDrums, 10) || 0) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Includes {form.emptyDrums} empty drum{(parseInt(form.emptyDrums, 10) || 0) !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div>
          <label>Value of Goods (₹)</label>
          <input type="number" className="input-field" min="0" step="0.01" placeholder="Taken from Material Receipt" value={form.value} onChange={e => setForm({...form, value: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0)})} />
        </div>
        <div>
          <label>Vehicle No</label>
          <input type="text" className="input-field" placeholder="e.g. GJ-01-XX-0000" value={form.vehicleNo} onChange={e => setForm({...form, vehicleNo: e.target.value})} />
        </div>
        <div>
          <label>Transporter Name</label>
          <input type="text" className="input-field" placeholder="e.g. ABC Logistics" value={form.transporterName || ''} onChange={e => setForm({...form, transporterName: e.target.value})} />
        </div>
        <div>
          <label>Driver Name</label>
          <input type="text" className="input-field" placeholder="e.g. Ramesh Kumar" value={form.driverName || ''} onChange={e => setForm({...form, driverName: e.target.value})} />
        </div>
        <div>
          <label>Driver's Contact</label>
          <input type="text" className="input-field" placeholder="e.g. 98765 43210" value={form.driverContact || ''} onChange={e => setForm({...form, driverContact: e.target.value})} />
        </div>

        <div style={{ gridColumn: 'span 4' }}>
          <label>Delivery Notes</label>
          <textarea
            className="input-field"
            rows="2"
            placeholder="This text prints on the Delivery Challan"
            value={form.deliveryNotes ?? form.termsAndConditions ?? ''}
            onChange={e => setForm({
              ...form,
              deliveryNotes: e.target.value,
              termsAndConditions: e.target.value
            })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Delivery Challan</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 6. E-WAY BILL FROM DC GENERATOR FORM (Slide 12)
// ----------------------------------------------------
const EWayDCGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateItem } = useAppContext();
  const dc = findDC(data, mr.id, activeProductName);

  const [form, setForm] = useState({
    ewayBillNo: dc?.ewayBillNo || '',
    ewayBillDate: dc?.ewayBillDate || new Date().toISOString().split('T')[0],
    ewayBillPurpose: 'Others - Job Work'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dc) {
      alert("No Delivery Challan exists for this receipt!");
      return;
    }
    updateItem('deliveryChallans', dc.id, {
      ...dc,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate,
      ewayBillPurpose: form.ewayBillPurpose
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Delivery Challan Associated</label>
          <input type="text" className="input-field" readOnly value={dc?.dcNo || 'None'} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>E-Way Bill Purpose *</label>
          <SearchableSelect className="input-field" value={form.ewayBillPurpose} onChange={e => setForm({...form, ewayBillPurpose: e.target.value})}>
            <option value="Others - Job Work">Others - Job Work</option>
            <option value="Supply">Supply</option>
            <option value="Export">Export</option>
          </SearchableSelect>
        </div>
        <div>
          <label>E-Way Bill Number *</label>
          <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
        </div>
        <div>
          <label>E-Way Bill Date *</label>
          <DateField className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save E-Way Bill details</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 7. TAX INVOICE GENERATOR FORM (Slide 13)
// ----------------------------------------------------
const TaxInvoiceGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = (data.parties || []).find(p => p.id === mr.partyId);
  const prodOpts = useMemo(() => receiptProductOptions(mr, data), [mr, data]);
  const dc = findDC(data, mr.id, activeProductName);
  const pl = findPL(data, mr.id);
  const productNames = getReceiptProductNames(mr, prodOpts);
  const formInitKey = `${mr.id}-${editing?.id || 'new'}`;

  const resolveProductQty = (prodName) => getProductQty(mr, prodName, prodOpts);

  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dcNo: dc?.dcNo || 'N/A',
    dcDate: dc?.date || 'N/A',
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
    productName: getReceiptProductLabel(mr, prodOpts),
    productSummaries: [],
    productCharges: normalizeProductCharges(
      resolveTIProductChargesForDoc(mr, party, data.invoices, prodOpts),
      null,
      mr,
      prodOpts
    ),
    customCharges: getLinkedPITermsForTI(data.invoices, mr.id)?.customCharges || [],
    discount: getLinkedPITermsForTI(data.invoices, mr.id)?.discount ?? 0,
    taxRate: getLinkedPITermsForTI(data.invoices, mr.id)?.taxRate ?? 18,
    gstType: normalizeGstType(getLinkedPITermsForTI(data.invoices, mr.id)?.gstType),
    terms: 'Payment against delivery.'
  });

  useEffect(() => {
    if (editing) {
      const summaries = buildPLProductSummaries(pl, mr, prodOpts);
      const piTerms = getLinkedPITermsForTI(data.invoices, mr.id);
      setForm({
        ...editing,
        productName: editing.productName?.includes(',')
          ? editing.productName
          : getReceiptProductLabel(mr, prodOpts),
        productSummaries: editing.productSummaries?.length ? editing.productSummaries : summaries,
        productCharges: piTerms?.productCharges
          || (editing.productCharges && Object.keys(editing.productCharges).length
            ? sanitizeProductCharges(editing.productCharges)
            : normalizeProductCharges(
              editing.productCharges,
              editing,
              mr,
              prodOpts,
              party
            )),
        customCharges: piTerms?.customCharges?.length
          ? piTerms.customCharges
          : (editing.customCharges || []),
        discount: piTerms ? piTerms.discount : (editing.discount || 0),
        taxRate: piTerms ? piTerms.taxRate : (editing.taxRate ?? 18),
        gstType: normalizeGstType(piTerms?.gstType || editing.gstType),
        terms: editing.terms || 'Payment against delivery.'
      });
    } else {
      const summaries = buildPLProductSummaries(pl, mr, prodOpts);
      const piTerms = getLinkedPITermsForTI(data.invoices, mr.id);
      setForm(prev => ({
        ...prev,
        productName: getReceiptProductLabel(mr, prodOpts),
        productSummaries: summaries,
        productCharges: normalizeProductCharges(
          piTerms?.productCharges || resolveTIProductChargesForDoc(mr, party, data.invoices, prodOpts),
          piTerms,
          mr,
          prodOpts
        ),
        customCharges: piTerms?.customCharges || [],
        discount: piTerms?.discount ?? 0,
        taxRate: piTerms?.taxRate ?? 18,
        gstType: normalizeGstType(piTerms?.gstType),
        dcNo: dc?.dcNo || 'N/A',
        dcDate: dc?.date || 'N/A'
      }));
    }
  }, [formInitKey, pl?.id, data.invoices]);

  useEffect(() => {
    if (editing) return;
    const tiSerial = data.settings?.serials?.TI || 1;
    const docNo = generateDocNumber('IN', tiSerial, new Date(form.date));
    setForm(prev => (prev.invoiceNo === docNo ? prev : { ...prev, invoiceNo: docNo }));
  }, [form.date, editing, data.settings?.serials?.TI]);

  const toggleCharge = (prodName, key) => {
    setForm(prev => {
      const pc = prev.productCharges[prodName] || {
        charges: emptyChargeFlags(),
        rates: emptyChargeRates(),
        qtys: emptyChargeQtys()
      };
      const turningOn = !pc.charges[key];
      const materialQty = resolveProductQty(prodName);
      const qtys = { ...(pc.qtys || emptyChargeQtys()) };
      if (turningOn && (qtys[key] == null || qtys[key] === '' || qtys[key] === 0)) {
        qtys[key] = isMaterialQtyCharge(key) && materialQty ? materialQty : '';
      }
      return {
        ...prev,
        productCharges: {
          ...prev.productCharges,
          [prodName]: {
            ...pc,
            charges: { ...pc.charges, [key]: turningOn },
            qtys
          }
        }
      };
    });
  };

  const handleRateChange = (prodName, key, val) => {
    setForm(prev => ({
      ...prev,
      productCharges: {
        ...prev.productCharges,
        [prodName]: {
          ...prev.productCharges[prodName],
          rates: { ...prev.productCharges[prodName].rates, [key]: parseChargeFieldValue(val) }
        }
      }
    }));
  };

  const handleQtyChange = (prodName, key, val) => {
    setForm(prev => ({
      ...prev,
      productCharges: {
        ...prev.productCharges,
        [prodName]: {
          ...prev.productCharges[prodName],
          qtys: { ...(prev.productCharges[prodName].qtys || emptyChargeQtys()), [key]: parseChargeFieldValue(val) }
        }
      }
    }));
  };

  const getSubtotal = () => {
    const productSum = calcProductChargesSubtotal(form.productCharges, mr, resolveProductQty, prodOpts);
    const customSum = (form.customCharges || []).reduce((sum, charge) => {
      if (charge.checked === false) return sum;
      return sum + ((parseFloat(charge.qty) || 0) * (parseFloat(charge.rate) || 0));
    }, 0);
    return productSum + customSum;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = getSubtotal();
    const discountAmount = parseFloat(form.discount) || 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxable * (form.taxRate / 100);
    const total = taxable + taxAmount;
    const summaries = buildPLProductSummaries(pl, mr, prodOpts);
    const firstProd = productNames[0] || mr.productName;
    const sanitizedCharges = sanitizeProductCharges(form.productCharges);
    const legacyCharges = sanitizedCharges[firstProd]?.charges || emptyChargeFlags();
    const legacyRates = sanitizedCharges[firstProd]?.rates || emptyChargeRates();
    const legacyQtys = sanitizedCharges[firstProd]?.qtys || emptyChargeQtys();
    const totalQty = getMRReceivedQty(mr, prodOpts) || 0;

    let finalDoc = {
      ...form,
      productCharges: sanitizedCharges,
      productSummaries: summaries.length ? summaries : (form.productSummaries || []),
      charges: legacyCharges,
      rates: legacyRates,
      qtys: legacyQtys,
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: getReceiptProductLabel(mr, prodOpts),
      qty: totalQty,
      subtotal,
      taxAmount,
      total,
      type: 'Tax Invoice',
      ewayBillNo: editing?.ewayBillNo || '',
      ewayBillDate: editing?.ewayBillDate || ''
    };

    const linkedPI = findAnyProformaInvoice(data.invoices, mr.id);
    if (linkedPI && typeof linkedPI.total === 'number') {
      finalDoc = applyProformaFinancialsToTaxInvoice(finalDoc, linkedPI);
    }

    if (editing) {
      updateItem('invoices', editing.id, finalDoc);
    } else {
      if (findAnyTaxInvoice(data.invoices, mr.id)) {
        alert('A Tax Invoice already exists for this Material Receipt. Please edit the existing TI.');
        return;
      }
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('TI');
    }
    onClose();
  };

  const chargeProductNames = productNames.length ? productNames : [mr.productName].filter(Boolean);
  const scopedReceivedQty = getMRReceivedQty(mr, prodOpts) || 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-4">
        <div>
          <label>Invoice Number</label>
          <input type="text" className="input-field" readOnly value={form.invoiceNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>Invoice Date *</label>
          <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Delivery Challan No</label>
          <input type="text" className="input-field" readOnly value={form.dcNo} />
        </div>
        <div>
          <label>Delivery Challan Date</label>
          <input type="text" className="input-field" readOnly value={form.dcDate} />
        </div>
        <div>
          <label>Supplier Doc No</label>
          <input type="text" className="input-field" readOnly value={form.partyDocNo} />
        </div>
        <div>
          <label>Supplier Doc Date</label>
          <input type="text" className="input-field" readOnly value={form.partyDocDate} />
        </div>
        <div>
          <label>GSTIN</label>
          <input type="text" className="input-field" readOnly value={mr.gstinBill} />
        </div>
        <div>
          <label>Received Qty (Kg)</label>
          <input type="text" className="input-field" readOnly value={`${scopedReceivedQty.toFixed(2)} Kg`} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>Product(s)</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
        </div>
      </div>

      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} />

      <h3 className="form-section-title">Tax Invoice Charges</h3>
      
      <div className="form-grid-2">
        <div>
          {chargeProductNames.map((prodName) => {
            const displayIdx = getProductDisplayIndex(mr, prodName, prodOpts);
            const materialQty = resolveProductQty(prodName);
            const pc = form.productCharges[prodName] || form.productCharges[Object.keys(form.productCharges || {}).find(k =>
              (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
            )] || {
              charges: emptyChargeFlags(),
              rates: emptyChargeRates(),
              qtys: buildChargeQtys({}, materialQty)
            };
            return (
              <div key={prodName} className="product-block">
                <h4>
                  Product {displayIdx}: {prodName} ({materialQty} Kg)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {CHARGES_LIST.map(item => renderChargeRow(
                    item, pc, prodName, materialQty, toggleCharge, handleQtyChange, handleRateChange
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="summary-box">
          <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--accent-primary)' }}>Billing Summary</h4>
          <div className="summary-row">
            <span>Subtotal</span>
            <span style={{ fontWeight: 600 }}>₹{getSubtotal().toFixed(2)}</span>
          </div>
          <div className="summary-row" style={{ alignItems: 'center' }}>
            <span>Discount (₹)</span>
            <input type="number" className="input-field input-compact" style={{ width: '100px' }} value={form.discount} onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
          </div>
          <GstTaxBlock
            compact
            taxable={Math.max(0, getSubtotal() - form.discount)}
            taxRate={form.taxRate}
            gstType={form.gstType}
            showDiscountInput={false}
            showSubtotal={false}
            onTaxRateChange={(taxRate) => setForm({ ...form, taxRate })}
            onGstTypeChange={(gstType) => setForm({ ...form, gstType })}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Tax Invoice</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 8. E-WAY BILL FROM TAX INVOICE GENERATOR FORM (Slide 14)
// ----------------------------------------------------
const EWayTIGenerator = ({ mr, activeProductName = '', editing, onClose }) => {
  const { data, updateItem } = useAppContext();
  const ti = findTI(data, mr.id, activeProductName);

  const [form, setForm] = useState({
    ewayBillNo: ti?.ewayBillNo || '',
    ewayBillDate: ti?.ewayBillDate || new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ti) {
      alert("No Tax Invoice exists for this receipt!");
      return;
    }
    updateItem('invoices', ti.id, {
      ...ti,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Tax Invoice Associated</label>
          <input type="text" className="input-field" readOnly value={ti?.invoiceNo || 'None'} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>Material Qty</label>
          <input type="text" className="input-field" readOnly value={`${ti?.qty || mr.totalQty} Kg`} />
        </div>
        <div>
          <label>E-Way Bill Number *</label>
          <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
        </div>
        <div>
          <label>E-Way Bill Date *</label>
          <DateField className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save E-Way Bill details</button>
      </div>
    </form>
  );
};

export default UnderProcess;
