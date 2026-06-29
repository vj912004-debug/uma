import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber, nextAvailableDocNumber } from '../utils/numbering';
import { 
  FileText, Activity, UploadCloud, Package, Truck, 
  FileSpreadsheet, FileCheck, CheckCircle, Clock, X, Plus, Edit2, Download, Trash2 
} from 'lucide-react';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import { copyChargeQtysFromSettings, enrichPIForPrint, enrichTIForPrint, findAnyProformaInvoice, findAnyTaxInvoice, resolveReceiptChargesForDoc, resolveTIProductChargesForDoc, sanitizeProductCharges } from '../utils/documentCharges';
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
  findAnyPackingList,
  getBPRDispatchedRowsForPL,
  getPLDisplayProductLabel,
  buildPLProductSummaries,
  alignDrumRowsToProducts,
  buildUnderProcessRows
} from '../utils/receiptProducts';

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
const emptyChargeQtys = () => Object.fromEntries(CHARGE_KEYS.map(k => [k, 1]));

const isMaterialQtyCharge = (key) => ['processing', 'sieving', 'cleaning'].includes(key);

const buildChargeQtys = (settings, materialQty = 0) => {
  const qtys = { ...emptyChargeQtys(), ...(settings?.qtys || {}) };
  CHARGE_KEYS.forEach(k => {
    if (isMaterialQtyCharge(k)) {
      const saved = settings?.qtys?.[k];
      if (saved == null || saved === '') {
        qtys[k] = materialQty || qtys[k];
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
  if (isMaterialQtyCharge(key)) return parseChargeNumber(q, materialQty || 1);
  return parseChargeNumber(q, 1);
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
      qtys: copyChargeQtysFromSettings(settings)
    };
  });
  if (!productNames.length && mr.productName) {
    const materialQty = mr.totalQty || mr.receivedQty || 0;
    result[mr.productName] = {
      charges: { ...(mr.charges || emptyChargeFlags()) },
      rates: { ...(mr.rates || emptyChargeRates()) },
      qtys: copyChargeQtysFromSettings({ qtys: mr.qtys })
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
  findReceiptDoc(data.bprs, mrId, productName);
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

const initProductChargesForScope = (mr, party, prodOpts, activeProductName) => {
  if (!activeProductName) return initProductChargesFromMR(mr, party, prodOpts);
  const canonical = resolveReceiptProductName(mr, activeProductName, { party, ...prodOpts });
  const settings = getMRProductSettings(mr, party, canonical);
  const materialQty = getProductQty(mr, canonical, prodOpts);
  return {
    [canonical]: {
      charges: { ...(settings.charges || emptyChargeFlags()) },
      rates: { ...(settings.rates || emptyChargeRates()) },
      qtys: copyChargeQtysFromSettings(settings)
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
          value={pc.qtys?.[item.key] ?? (item.isQtyRate ? materialQty : 1)}
          onChange={e => handleQtyChange(prodName, item.key, e.target.value)}
          min="0"
        />
        <span>Rate: ₹</span>
        <input
          type="number"
          className="input-field input-compact"
          style={{ width: '72px' }}
          value={pc.rates[item.key] ?? 0}
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

  // ----------------------------------------------------
  // Document Search & Helper Helpers
  // ----------------------------------------------------
  const getPI = (mrId) => findPI(data, mrId);
  const getBPR = (mrId, productName = '') => findBPR(data, mrId, productName);
  const getPSD = (mrId, productName = '') => findPSD(data, mrId, productName);
  const getPL = (mrId, productName = '') => findPL(data, mrId, productName);
  const getDC = (mrId, productName = '') => findDC(data, mrId, productName);
  const getTI = (mrId, productName = '') => findTI(data, mrId, productName);

  const handlePendingClick = (mr, type, productName = '') => {
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

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Under Process</h1>
        <p className="page-subtitle">Track material receipts and generate documents step by step.</p>
      </header>

      <div className="tab-bar">
        {[
          { id: 'All', label: 'All' },
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

      <div className="premium-card data-table-container" style={{ padding: '0.75rem' }}>
        <table className="workflow-table">
          <thead>
            <tr>
              <th>M.R. Date</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Qty (Kg)</th>
              <th className="center">PI</th>
              <th className="center">BPR</th>
              <th className="center">PSD</th>
              <th className="center">PL</th>
              <th className="center">DC</th>
              <th className="center">E-Way DC</th>
              <th className="center">Tax Inv</th>
              <th className="center">E-Way TI</th>
            </tr>
          </thead>
          <tbody>
            {(data.materialReceipts || []).length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No material receipts yet. Add one from Material Receipt.
                </td>
              </tr>
            ) : (
              buildUnderProcessRows(data.materialReceipts, data).filter(({ mr, productName }) => {
                  const pi = getPI(mr.id);
                  const bpr = getBPR(mr.id, productName);
                  const psd = getPSD(mr.id, productName);
                  const pl = getPL(mr.id, productName);
                  const dc = getDC(mr.id, productName);
                  const ti = getTI(mr.id, productName);
                  const isComplete = pi && bpr && psd && pl && dc && ti;
                  if (activeTab === 'Done') return isComplete;
                  if (activeTab === 'PI') return !pi;
                  if (activeTab === 'BPR') return !bpr;
                  if (activeTab === 'PSD') return !psd;
                  if (activeTab === 'PL') return !pl;
                  if (activeTab === 'DC') return !dc;
                  if (activeTab === 'EWDC') return !(dc && dc.ewayBillNo);
                  if (activeTab === 'TI') return !ti;
                  if (activeTab === 'EWTI') return !(ti && ti.ewayBillNo);
                  return true;
                }).map(({ mr, productName, prodOpts }) => {
                const party = data.parties.find(p => p.id === mr.partyId);
                const settings = productName ? getMRProductSettings(mr, party, productName) : null;
                const pi = getPI(mr.id);
                const bpr = getBPR(mr.id, productName);
                const psd = getPSD(mr.id, productName);
                const pl = getPL(mr.id, productName);
                const dc = getDC(mr.id, productName);
                const ti = getTI(mr.id, productName);
                const rowQty = productName
                  ? getProductQty(mr, productName, prodOpts)
                  : (mr.totalQty || mr.receivedQty || 0);

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

                    <td className="center">
                      {pi ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('PI', enrichPIForPrint(pi, data))} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PI', pi, productName, e)} className="doc-done">
                            {pi.invoiceNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PI', productName)} className="doc-pending">Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {bpr ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('BPR', bpr)} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'BPR', bpr, productName, e)} className="doc-done">
                            {bpr.bprNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'BPR', productName)} className="doc-pending">Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {psd ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('PSD', psd)} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PSD', psd, productName, e)} className="doc-done">
                            {psd.psdNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PSD', productName)} className="doc-pending">Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {pl ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('PL', pl)} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PL', pl, productName, e)} className="doc-done">
                            {pl.plNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PL', productName)} className="doc-pending" disabled={!bpr}>Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {dc ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('DC', dc)} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'DC', dc, productName, e)} className="doc-done">
                            {dc.dcNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'DC', productName)} className="doc-pending" disabled={!pl}>Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {dc && dc.ewayBillNo ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'EWDC', dc, productName, e)} className="doc-done">
                          {dc.ewayBillNo}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'EWDC', productName)} className="doc-pending" disabled={!dc}>Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {ti ? (
                        <div className="doc-done-group">
                          <button onClick={() => viewPDF('TI', enrichTIForPrint(ti, data))} className="doc-icon-btn" title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'TI', ti, productName, e)} className="doc-done">
                            {ti.invoiceNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'TI', productName)} className="doc-pending" disabled={!pl}>Pending</button>
                      )}
                    </td>

                    <td className="center">
                      {ti && ti.ewayBillNo ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'EWTI', ti, productName, e)} className="doc-done">
                          {ti.ewayBillNo}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'EWTI', productName)} className="doc-pending" disabled={!ti}>Pending</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot done"></span>
            <span>Done — click to view, edit, or delete</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot pending"></span>
            <span>Pending — click to generate</span>
          </div>
        </div>
      </div>

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
  <div className="modal-overlay">
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
    poNo: '',
    poDate: new Date().toISOString().split('T')[0],
    productCharges: initProductChargesFromMR(mr, party, prodOpts),
    discount: 0,
    taxRate: 18,
    terms: 'Payment 100% advance against PI.'
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        productCharges: normalizeProductCharges(
          editing.productCharges,
          editing,
          mr,
          prodOpts,
          productNames[0] || mr.productName
        ),
        discount: editing.discount || 0,
        taxRate: editing.taxRate ?? 18,
        terms: editing.terms || 'Payment 100% advance against PI.'
      });
    } else {
      setForm(prev => ({
        ...prev,
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
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = isMaterialQtyCharge(key) ? materialQty : 1;
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
    const materialQty = productSummaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0)
      || parseFloat(mr.totalQty)
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
      qtys: chargeSnapshot.qtys,
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
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>GSTIN</label>
          <input type="text" className="input-field" readOnly value={mr.gstinBill} />
        </div>
        <div>
          <label>PO Number</label>
          <input type="text" className="input-field" value={form.poNo} onChange={e => setForm({...form, poNo: e.target.value})} />
        </div>
        <div>
          <label>PO Date</label>
          <input type="date" className="input-field" value={form.poDate} onChange={e => setForm({...form, poDate: e.target.value})} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span>GST Rate (%):</span>
            <select className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.taxRate} onChange={e => setForm({...form, taxRate: parseInt(e.target.value) || 0})}>
              <option value="18">18%</option>
              <option value="12">12%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span>GST Amount:</span>
            <span>₹{(Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            <span>Grand Total:</span>
            <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem' }}>Terms & Conditions</label>
            <input type="text" className="input-field" value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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
  const productNames = getScopedProductNames(mr, prodOpts, activeProductName);
  const firstProdConfig = (party?.products || []).find(p => p.name === (productNames[0] || mr.productName));
  const scopedQty = activeProductName ? getProductQty(mr, activeProductName, prodOpts) : (mr.totalQty || mr.receivedQty || 0);
  const scopedDrums = activeProductName ? getProductDrums(mr, activeProductName, prodOpts) : (mr.totalDrums || 1);

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
    productName: activeProductName || getReceiptProductLabel(mr, prodOpts),
    totalInputQty: scopedQty,
    batchNo: '',
    totalNoBatch: 0,
    psdRequirement: firstProdConfig?.psdReq || '90% < 10M',
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
    dispatchQty: { micronizedNet: '', lumpsNet: '', floorDustNet: '', netProcessLoss: '', remark: '' },
    processCompletionDate: new Date().toISOString().split('T')[0],
    processCompletionTime: '17:00',
    isFilterBagPackedStoredAfter: false,
    remarks: '',
    operatorSignature: '',
    plantSupervisorSignature: ''
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        receivedBatches: editing.receivedBatches || [],
        dispatchedBatches: editing.dispatchedBatches || []
      });
    } else {
      const bprSerial = data.settings?.serials?.BPR || 1;
      const docNo = generateDocNumber('BPR', bprSerial, new Date(form.date));

      // Construct rows from MR batches (with legacy fallback for old single-batch structure)
      const activeMRBatches = activeProductName
        ? getProductBatches(mr, activeProductName, prodOpts)
        : (() => {
            const all = getReceiptProductNames(mr, prodOpts).flatMap(prodName =>
              getProductBatches(mr, prodName, prodOpts).map(b => ({ ...b, productName: prodName }))
            );
            if (all.length) return all;
            return (mr.batches || [
              { batchNo: mr.batchNo || 'N/A', drums: 1, qty: parseFloat(mr.receivedQty || mr.totalQty || 0), isEmptyDrums: false }
            ]).filter(b => !b.isEmptyDrums);
          })();
      const receivedRows = [];
      
      activeMRBatches.forEach(b => {
        const drumCount = parseInt(b.drums) || 1;
        const pName = b.productName || productNames[0] || mr.productName?.split(',')[0]?.trim() || '';
        for (let d = 1; d <= drumCount; d++) {
          receivedRows.push({
            batchNo: b.batchNo,
            drumNo: d.toString(),
            productName: pName,
            gross: 0,
            tare: 0,
            net: 0
          });
        }
      });

      setForm(prev => ({
        ...prev,
        bprNo: docNo,
        customerName: mr.partyName,
        productName: activeProductName || getReceiptProductLabel(mr, prodOpts),
        totalInputQty: scopedQty,
        totalDrums: scopedDrums,
        receivedBatches: receivedRows,
        dispatchedBatches: receivedRows.map(r => ({ ...r })),
        batchNo: activeMRBatches.map(b => b.batchNo).filter(Boolean).join(', '),
        totalNoBatch: activeMRBatches.length
      }));
    }
  }, [form.date, editing, mr, activeProductName, scopedQty, scopedDrums, data.settings?.serials?.BPR]);

  // Handle double dispatch drums expansion
  const toggleDoubleDispatch = () => {
    const nextVal = !form.doubleDispatch;
    setForm(prev => {
      let nextDispatch = [];
      if (nextVal) {
        // Double each drum row in dispatched weight!
        prev.receivedBatches.forEach(r => {
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}A` });
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}B` });
        });
      } else {
        nextDispatch = prev.receivedBatches.map(r => ({ ...r }));
      }
      return {
        ...prev,
        doubleDispatch: nextVal,
        dispatchedBatches: nextDispatch
      };
    });
  };

  const handleCellChange = (tableKey, idx, field, val) => {
    setForm(prev => {
      const list = [...prev[tableKey]];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
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

  const renderWeightTable = (tableKey, title, totalNet) => {
    const rows = form[tableKey] || [];
    const groupedProducts = productNames.length
      ? productNames
      : [...new Set(rows.map(r => r.productName).filter(Boolean))];

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
                  {groupedProducts.length === 0 && productNames.length > 1 && <th style={{ padding: '0.35rem' }}>Product</th>}
                  <th style={{ padding: '0.35rem' }}>Batch No</th>
                  <th style={{ padding: '0.35rem' }}>Drum No</th>
                  <th style={{ padding: '0.35rem' }}>Gross</th>
                  <th style={{ padding: '0.35rem' }}>Tare</th>
                  <th style={{ padding: '0.35rem' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                    <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange(tableKey, idx, 'gross', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange(tableKey, idx, 'tare', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{formatNet(r.net)}</td>
                  </tr>
                ))}
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
                      {prodRows.map(({ r, idx }) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                          <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                          <td style={{ padding: '0.25rem' }}>
                            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange(tableKey, idx, 'gross', e.target.value)} />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange(tableKey, idx, 'tare', e.target.value)} />
                          </td>
                          <td style={{ padding: '0.25rem', fontWeight: 600 }}>{formatNet(r.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
          <span>Total {tableKey === 'receivedBatches' ? 'Received' : 'Dispatched'}:</span>
          <span>{totalNet.toFixed(2)} Kg</span>
        </div>
      </div>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id
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
            <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <label>Customer Name</label>
            <input type="text" className="input-field" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <label>Product Name</label>
            <input type="text" className="input-field" readOnly value={form.productName} />
          </div>
          <div>
            <label>Total Quantity (kg)</label>
            <input type="text" className="input-field" readOnly value={String(form.totalInputQty)} />
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
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Process Header</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label>Committed</label>
            <input type="text" className="input-field" value={form.committedBy} onChange={e => setForm({ ...form, committedBy: e.target.value })} />
          </div>
          <div>
            <label>Processing Start (Date)</label>
            <input type="date" className="input-field" value={form.processingStartDate} onChange={e => setForm({ ...form, processingStartDate: e.target.value })} />
          </div>
          <div>
            <label>Processing Start (Time)</label>
            <input type="time" className="input-field" value={form.processingStartTime} onChange={e => setForm({ ...form, processingStartTime: e.target.value })} />
          </div>
          <div>
            <label>Processing Supervisor</label>
            <input type="text" className="input-field" value={form.processingSupervisor} onChange={e => setForm({ ...form, processingSupervisor: e.target.value })} />
          </div>
          <div>
            <label>Sizing report require</label>
            <select className="input-field" value={form.sizingReportRequired} onChange={e => setForm({ ...form, sizingReportRequired: e.target.value })}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
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
            <label>Micronized Material net weight</label>
            <input className="input-field" value={form.dispatchQty?.micronizedNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, micronizedNet: e.target.value } })} />
          </div>
          <div>
            <label>Lumps Net weight</label>
            <input className="input-field" value={form.dispatchQty?.lumpsNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, lumpsNet: e.target.value } })} />
          </div>
          <div>
            <label>Floor Dust Net weight</label>
            <input className="input-field" value={form.dispatchQty?.floorDustNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, floorDustNet: e.target.value } })} />
          </div>
          <div>
            <label>Net Process Loss</label>
            <input className="input-field" value={form.dispatchQty?.netProcessLoss || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, netProcessLoss: e.target.value } })} />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <label>Remark</label>
            <input className="input-field" value={form.dispatchQty?.remark || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, remark: e.target.value } })} />
          </div>
        </div>

        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem' }}>Process Completion</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label>Process Completion Date</label>
            <input type="date" className="input-field" value={form.processCompletionDate} onChange={e => setForm({ ...form, processCompletionDate: e.target.value })} />
          </div>
          <div>
            <label>Process Completion Time</label>
            <input type="time" className="input-field" value={form.processCompletionTime} onChange={e => setForm({ ...form, processCompletionTime: e.target.value })} />
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
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
                        <select className="input-field" required value={r.batchNo} onChange={e => updateReport(idx, { batchNo: e.target.value })}>
                          <option value="">-- Select Batch --</option>
                          {prodBatches.map((b, bIdx) => (
                            <option key={bIdx} value={b.batchNo}>{b.batchNo}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Method</label>
                        <select className="input-field" value={r.method} onChange={e => updateReport(idx, { method: e.target.value })}>
                          <option value="Dry">Dry</option>
                          <option value="Wet">Wet</option>
                        </select>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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

  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    productName: getReceiptProductLabel(mr, prodOpts),
    productSummaries: [],
    totalWeight: 0,
    totalDrums: 0,
    batches: []
  });

  useEffect(() => {
    if (editing) {
      const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const fromBpr = getBPRDispatchedRowsForPL(data, mr, prodOpts);
      const sourceRows = (editing.batches || []).length ? editing.batches : fromBpr;
      const mergedBatches = alignDrumRowsToProducts(sourceRows, mr, prodOpts);
      setForm({
        ...editing,
        productName: editing.productName?.includes(',')
          ? editing.productName
          : getReceiptProductLabel(mr, prodOpts),
        productSummaries: editing.productSummaries?.length ? editing.productSummaries : summaries,
        batches: mergedBatches
      });
    } else {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date(form.date));
      const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const plRows = getBPRDispatchedRowsForPL(data, mr, prodOpts);

      setForm(prev => ({
        ...prev,
        plNo: docNo,
        productName: getReceiptProductLabel(mr, prodOpts),
        productSummaries: summaries,
        batches: plRows
      }));
    }
  }, [form.date, editing, mr, prodOpts, data.bprs, data.settings?.serials?.PL]);

  useEffect(() => {
    const totalDrums = form.batches.length;
    const totalWeight = form.batches.reduce((s, r) => s + r.net, 0);
    setForm(prev => ({ ...prev, totalDrums, totalWeight }));
  }, [form.batches]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
      list[idx] = item;
      return { ...prev, batches: list };
    });
  };

  const addCustomRow = () => {
    setForm(prev => ({
      ...prev,
      batches: [...prev.batches, {
        batchNo: prev.batches[0]?.batchNo || 'Custom',
        drumNo: (prev.batches.length + 1).toString(),
        productName: productNames[0] || mr.productName || '',
        gross: 0,
        tare: 0,
        net: 0
      }]
    }));
  };

  const displayProducts = (() => {
    const fromRows = [...new Set((form.batches || []).map(r => r.productName).filter(Boolean))];
    if (productNames.length) return productNames;
    return fromRows.length ? fromRows : [mr.productName].filter(Boolean);
  })();

  const handleSubmit = (e) => {
    e.preventDefault();
    const summaries = getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
    const finalDoc = {
      ...form,
      receiptId: mr.id,
      productName: getReceiptProductLabel(mr, prodOpts),
      productSummaries: summaries.length ? summaries : (form.productSummaries || [])
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
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Product(s)</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Batch-Wise Packing Weight Details</h3>
          <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={addCustomRow}>+ Add Row</button>
        </div>

        {displayProducts.map((prodName, pIdx) => {
          const prodRows = form.batches.map((r, idx) => ({ r, idx })).filter(({ r }) =>
            (r.productName || displayProducts[0] || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
          );
          if (!prodRows.length) return null;
          const subtotal = prodRows.reduce((s, { r }) => s + r.net, 0);
          return (
            <div key={prodName} style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Product {pIdx + 1}: {prodName}</h4>
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
                    </tr>
                  </thead>
                  <tbody>
                    {prodRows.map(({ r, idx }, rowIdx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem', fontWeight: 600 }}>{rowIdx + 1}</td>
                        <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                        <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                        <td style={{ padding: '0.25rem' }}>
                          <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.gross} onChange={e => handleCellChange(idx, 'gross', e.target.value)} />
                        </td>
                        <td style={{ padding: '0.25rem' }}>
                          <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.tare} onChange={e => handleCellChange(idx, 'tare', e.target.value)} />
                        </td>
                        <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{formatWeightNet(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', borderTop: '1px solid var(--border-color)' }}>
                      <td colSpan="5" style={{ padding: '0.35rem', textAlign: 'right' }}>Product Subtotal:</td>
                      <td style={{ padding: '0.35rem', color: 'var(--accent-primary)' }}>{subtotal.toFixed(2)} Kg</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
          <span>Grand Total:</span>
          <span style={{ color: 'var(--accent-primary)' }}>{form.totalWeight.toFixed(2)} Kg · {form.totalDrums} Drums</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodOpts = receiptProductOptions(mr, data);
  const pl = findPL(data, mr.id, activeProductName);
  const pi = findPI(data, mr.id, activeProductName);
  const scopedQty = activeProductName ? getProductQty(mr, activeProductName, prodOpts) : (mr.totalQty || mr.receivedQty || 0);
  const scopedDrums = activeProductName ? getProductDrums(mr, activeProductName, prodOpts) : (mr.totalDrums || 1);

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
    productName: activeProductName || getReceiptProductLabel(mr, prodOpts),
    qty: pl?.totalWeight || scopedQty,
    totalDrums: pl?.totalDrums || scopedDrums,
    value: pi?.total || mr.value || 0,
    vehicleNo: mr.vehicleNo || '',
    driverName: '',
    termsAndConditions: 'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
  });

  useEffect(() => {
    if (editing) {
      setForm(editing);
    } else {
      const dcSerial = data.settings?.serials?.DC || 1;
      const docNo = generateDocNumber('DC', dcSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        dcNo: docNo
      }));
    }
  }, [form.date, editing, data.settings?.serials?.DC]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id
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
          <input type="text" className="input-field" readOnly value={form.dcNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>DC Date</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Supplier Document No</label>
          <input type="text" className="input-field" readOnly value={form.partyDocNo} />
        </div>
        <div>
          <label>Supplier Doc Date</label>
          <input type="text" className="input-field" readOnly value={form.partyDocDate} />
        </div>

        <div style={{ gridColumn: 'span 4', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

        <div>
          <label>Product Name</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
        </div>
        <div>
          <label>Micronised Qty (Kg)</label>
          <input type="number" className="input-field" required value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
        </div>
        <div>
          <label>Total Drums *</label>
          <input type="number" className="input-field" required value={form.totalDrums} onChange={e => setForm({...form, totalDrums: parseInt(e.target.value) || 0})} />
        </div>
        <div>
          <label>Value of Goods (₹)</label>
          <input type="number" className="input-field" required value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} />
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label>Vehicle No *</label>
          <input type="text" className="input-field" required placeholder="e.g. GJ-01-XX-0000" value={form.vehicleNo} onChange={e => setForm({...form, vehicleNo: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>Driver Name</label>
          <input type="text" className="input-field" placeholder="e.g. Ramesh Kumar" value={form.driverName} onChange={e => setForm({...form, driverName: e.target.value})} />
        </div>

        <div style={{ gridColumn: 'span 4' }}>
          <label>Terms & Conditions / Dispatch Description</label>
          <textarea className="input-field" rows="2" value={form.termsAndConditions} onChange={e => setForm({...form, termsAndConditions: e.target.value})} />
        </div>
      </div>

      <MRProductSummary mr={mr} party={party} productOptions={prodOpts} onlyProduct={activeProductName} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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
          <select className="input-field" value={form.ewayBillPurpose} onChange={e => setForm({...form, ewayBillPurpose: e.target.value})}>
            <option value="Others - Job Work">Others - Job Work</option>
            <option value="Supply">Supply</option>
            <option value="Export">Export</option>
          </select>
        </div>
        <div>
          <label>E-Way Bill Number *</label>
          <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
        </div>
        <div>
          <label>E-Way Bill Date *</label>
          <input type="date" className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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

  const resolveProductQty = (prodName) => {
    const prodRows = (pl?.batches || []).filter(r => {
      const rowProd = r.productName || productNames[0];
      return (rowProd || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase();
    });
    if (prodRows.length) return prodRows.reduce((s, r) => s + (parseFloat(r.net) || 0), 0);
    return getProductQty(mr, prodName, prodOpts);
  };

  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dcNo: dc?.dcNo || 'N/A',
    dcDate: dc?.date || 'N/A',
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
    productName: getReceiptProductLabel(mr, prodOpts),
    productSummaries: [],
    productCharges: resolveTIProductChargesForDoc(mr, party, data.invoices, prodOpts),
    discount: 0,
    taxRate: 18,
    terms: 'Payment against delivery.'
  });

  useEffect(() => {
    if (editing) {
      const summaries = buildPLProductSummaries(pl, mr, prodOpts);
      setForm({
        ...editing,
        productName: editing.productName?.includes(',')
          ? editing.productName
          : getReceiptProductLabel(mr, prodOpts),
        productSummaries: editing.productSummaries?.length ? editing.productSummaries : summaries,
        productCharges: normalizeProductCharges(
          editing.productCharges,
          editing,
          mr,
          prodOpts,
          party
        ),
        discount: editing.discount || 0,
        taxRate: editing.taxRate ?? 18,
        terms: editing.terms || 'Payment against delivery.'
      });
    } else {
      const summaries = buildPLProductSummaries(pl, mr, prodOpts);
      setForm(prev => ({
        ...prev,
        productName: getReceiptProductLabel(mr, prodOpts),
        productSummaries: summaries,
        productCharges: resolveTIProductChargesForDoc(mr, party, data.invoices, prodOpts),
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
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = isMaterialQtyCharge(key) ? materialQty : 1;
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

  const getSubtotal = () => calcProductChargesSubtotal(form.productCharges, mr, resolveProductQty, prodOpts);

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
    const totalQty = pl?.totalWeight
      || productNames.reduce((sum, name) => sum + resolveProductQty(name), 0)
      || mr.totalQty
      || 0;

    const finalDoc = {
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
  const scopedMicronisedQty = pl?.totalWeight
    || productNames.reduce((sum, name) => sum + resolveProductQty(name), 0)
    || mr.totalQty
    || 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-4">
        <div>
          <label>Invoice Number</label>
          <input type="text" className="input-field" readOnly value={form.invoiceNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>Invoice Date *</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
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
          <label>Material Micronised Qty</label>
          <input type="text" className="input-field" readOnly value={`${scopedMicronisedQty.toFixed(2)} Kg`} />
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
          <div className="summary-row" style={{ alignItems: 'center' }}>
            <span>GST Rate</span>
            <select className="input-field input-compact" style={{ width: '100px' }} value={form.taxRate} onChange={e => setForm({...form, taxRate: parseInt(e.target.value) || 0})}>
              <option value="18">18%</option>
              <option value="12">12%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <div className="summary-row">
            <span>CGST @{(form.taxRate / 2)}%</span>
            <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>SGST @{(form.taxRate / 2)}%</span>
            <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Grand Total</span>
            <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
          </div>
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
          <input type="date" className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save E-Way Bill details</button>
      </div>
    </form>
  );
};

export default UnderProcess;
