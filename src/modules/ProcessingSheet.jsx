import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useLocation } from 'react-router-dom';
import DateField from '../components/DateField';
import { 
  Search, 
  Building2, 
  Package, 
  FileText, 
  Receipt,
  FileCheck,
  Percent,
  ChevronLeft,
  Truck,
  Table
} from 'lucide-react';
import ExportButton from '../components/ExportButton';
import {
  getReceiptPaymentTotal,
  getReceiptTdsTotal,
  getReceiptPayments,
  getReceiptBillAmount,
  getReceiptOutstanding,
  getReceiptEffectivePaid,
  getReceiptEffectiveTds,
  hasSheetOverride,
  getMergedSheetOverrides
} from '../utils/paymentTotals';
import SearchableSelect from '../components/SearchableSelect';
import StatusTabBar from '../components/StatusTabBar';

const DATE_COLUMNS = new Set(['date', 'bprDate', 'dcDate', 'invoiceDate', 'paymentDates']);

const toDateInputValue = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  const first = str.split(',')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first;
  const d = new Date(first.length === 10 ? `${first}T00:00:00` : first);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const SheetField = ({ label, children }) => (
  <div className="ps-field">
    <label>{label}</label>
    {children}
  </div>
);

const StatMini = ({ title, value, icon: Icon, color, bg }) => {
  const isCurrency = typeof value === 'number' && title !== 'Due Status';
  const displayValue = isCurrency ? `₹${parseFloat(value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : value;
  
  let valColor = 'var(--text-main)';
  if (title === 'Due Status') {
     valColor = value === 'Overdue' ? '#ef4444' : value === '0' ? 'var(--status-done-text)' : '#eab308';
  } else if (title === 'Outstanding Amount') {
     valColor = value > 0 ? '#ef4444' : 'var(--text-main)';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: bg, padding: '1rem 1.25rem', borderRadius: '8px' }}>
      <div style={{ background: 'var(--bg-card)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
         <Icon size={20} color={color} />
      </div>
      <div>
         <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{title}</p>
         <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: valColor }}>{displayValue}</p>
      </div>
    </div>
  );
};

const ProcessingSheet = () => {
  const { data, updateItem } = useAppContext();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState(location.state?.partyName || '');
  const [productFilter, setProductFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [openedKey, setOpenedKey] = useState(null);

  useEffect(() => {
    if (location.state?.partyName) {
      setPartyFilter(location.state.partyName);
    }
  }, [location.state?.partyName]);

  // Table Helpers to retrieve downstream details
  const getPIs = (mrId) => (data.invoices || []).filter(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/PI/'));
  const getTIs = (mrId) => (data.invoices || []).filter(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/IN/'));
  const getBPRs = (mrId) => (data.bprs || []).filter(b => b.receiptId === mrId);
  const getDCs = (mrId) => (data.deliveryChallans || []).filter(dc => dc.receiptId === mrId);
  const getTI = (mrId) => getTIs(mrId)[0];
  const matchProduct = (doc, productName) => {
    if (!productName || !doc?.productName) return true;
    return String(doc.productName).toLowerCase().includes(String(productName).toLowerCase())
      || String(productName).toLowerCase().includes(String(doc.productName).toLowerCase());
  };
  const pickDoc = (docs, productName) => {
    if (!docs?.length) return null;
    if (!productName) return docs[0];
    return docs.find((d) => matchProduct(d, productName)) || docs[0];
  };

  const getPaymentsReceived = (mrId) => getReceiptPaymentTotal(data.payments, mrId);
  const getTdsReceived = (mrId) => getReceiptTdsTotal(data.payments, mrId);
  const getPaymentHistory = (mrId) => getReceiptPayments(data.payments, mrId);

  const handleCellChange = (mrId, field, value, invoiceId = null) => {
    const mr = data.materialReceipts.find(m => m.id === mrId);
    if (!mr) return;
    const currentOverrides = { ...(mr.sheetOverrides || {}) };
    const numericFields = new Set([
      'receivedQty', 'bprNetQty', 'dcNetQty', 'totalBill', 'manualPaid', 'tdsDeduction', 'outstanding'
    ]);
    const paymentFields = new Set(['totalBill', 'manualPaid', 'tdsDeduction', 'outstanding', 'paymentAmounts']);
    const recalcFields = new Set(['totalBill', 'tdsDeduction', 'paymentAmounts']);
    const nextVal = numericFields.has(field) && (value === '' || value === null || value === undefined)
      ? '0'
      : value;

    const fieldValue = field === 'paymentAmounts' ? value : nextVal;

    const applyChange = (bucket) => {
      bucket[field] = fieldValue;
      if (recalcFields.has(field)) {
        delete bucket.outstanding;
        delete bucket.outstandingManual;
        delete bucket.dueStatus;
      } else if (field === 'outstanding') {
        bucket.outstandingManual = true;
        bucket.dueStatus = (parseFloat(nextVal) || 0) <= 0 ? '0' : 'Due';
      }
    };

    if (invoiceId && paymentFields.has(field)) {
      const byInvoice = { ...(currentOverrides.byInvoice || {}) };
      const invO = { ...(byInvoice[invoiceId] || {}) };
      applyChange(invO);
      byInvoice[invoiceId] = invO;
      currentOverrides.byInvoice = byInvoice;
      delete currentOverrides.outstanding;
      delete currentOverrides.outstandingManual;
    } else {
      applyChange(currentOverrides);
    }

    updateItem('materialReceipts', mrId, {
      ...mr,
      sheetOverrides: currentOverrides
    });

    if (paymentFields.has(field)) {
      const party = data.parties.find(p => p.id === mr.partyId)
        || data.parties.find(p => String(p.name || '').trim().toLowerCase()
          === String((currentOverrides.partyName || mr.partyName) || '').trim().toLowerCase());
      if (party?.dueOverrides && Object.keys(party.dueOverrides).length > 0) {
        updateItem('parties', party.id, { ...party, dueOverrides: {} });
      }
    }
  };

  const buildSheetRow = (mr, ti, srNo) => {
    const productHint = ti?.productName || mr.productName || '';
    const pi = pickDoc(getPIs(mr.id), productHint);
    const bpr = pickDoc(getBPRs(mr.id), productHint);
    const dc = pickDoc(getDCs(mr.id), productHint);
    const paid = getPaymentsReceived(mr.id);
    const tdsTotal = getTdsReceived(mr.id);
    const paymentHistory = getPaymentHistory(mr.id);
    const o = getMergedSheetOverrides(mr, ti?.id);

    const finalTotalBill = getReceiptBillAmount(mr, ti);
    const compOutstanding = getReceiptOutstanding(mr, ti, data.payments);
    const overdue = compOutstanding > 0.01 && ti?.date && new Date(ti.date) < new Date();
    const finalTds = hasSheetOverride(o, 'tdsDeduction') ? parseFloat(o.tdsDeduction) || 0 : tdsTotal;

    let ewayStatus = 'Pending';
    if (dc?.ewayBillNo || ti?.ewayBillNo) ewayStatus = 'Done';

    return {
      id: mr.id,
      rowKey: `${mr.id}__${ti?.id || 'pending'}`,
      invoiceId: ti?.id || null,
      srNo,
      date: hasSheetOverride(o, 'date') ? o.date : mr.date,
      partyName: hasSheetOverride(o, 'partyName') ? o.partyName : (mr.partyName || ti?.partyName || ''),
      productName: hasSheetOverride(o, 'productName')
        ? o.productName
        : (ti?.productName || mr.productName || ''),
      receivedQty: hasSheetOverride(o, 'receivedQty')
        ? o.receivedQty
        : (parseFloat(ti?.qty) || parseFloat(mr.totalQty) || 0),
      piNo: hasSheetOverride(o, 'piNo') ? o.piNo : (pi?.invoiceNo || 'Pending'),
      bprDate: hasSheetOverride(o, 'bprDate') ? o.bprDate : (bpr?.date || ''),
      bprNetQty: hasSheetOverride(o, 'bprNetQty') ? o.bprNetQty : (bpr?.totalDispatchedNet || 0),
      dcNo: hasSheetOverride(o, 'dcNo') ? o.dcNo : (dc?.dcNo || 'Pending'),
      dcDate: hasSheetOverride(o, 'dcDate') ? o.dcDate : (dc?.date || ''),
      dcNetQty: hasSheetOverride(o, 'dcNetQty') ? o.dcNetQty : (dc?.qty || 0),
      tiNo: hasSheetOverride(o, 'tiNo') ? o.tiNo : (ti?.invoiceNo || 'Pending'),
      invoiceDate: hasSheetOverride(o, 'invoiceDate') ? o.invoiceDate : (ti?.date || ''),
      totalBill: finalTotalBill,
      paid,
      manualPaid: hasSheetOverride(o, 'manualPaid') ? o.manualPaid : '',
      tdsDeduction: finalTds,
      amountsReceivedTotal:
        getReceiptEffectivePaid(mr, data.payments, ti?.id) + getReceiptEffectiveTds(mr, data.payments, ti?.id),
      outstanding: compOutstanding,
      dueStatus: compOutstanding <= 0
        ? '0'
        : (hasSheetOverride(o, 'dueStatus') && o.dueStatus !== '0'
          ? o.dueStatus
          : (overdue ? 'Overdue' : 'Due')),
      paymentDates: hasSheetOverride(o, 'paymentDates')
        ? o.paymentDates
        : paymentHistory.map(p => p.date).filter(Boolean).join(', '),
      paymentAmounts: hasSheetOverride(o, 'paymentAmounts')
        ? o.paymentAmounts
        : paymentHistory.map(p => `₹${(parseFloat(p.amount) || 0).toFixed(2)}${p.tds ? ` (TDS ₹${(parseFloat(p.tds) || 0).toFixed(2)})` : ''}`).join(' | '),
      paymentRef: hasSheetOverride(o, 'paymentRef') ? o.paymentRef : '',
      ewayStatus: hasSheetOverride(o, 'ewayStatus') ? o.ewayStatus : ewayStatus
    };
  };

  const rows = (() => {
    const list = [];
    const mrsCoveredByInvoice = new Set();
    let sr = 0;

    (data.invoices || [])
      .filter((inv) => inv.invoiceNo?.includes('/IN/'))
      .forEach((ti) => {
        const mr = (data.materialReceipts || []).find((m) => m.id === ti.receiptId);
        if (!mr) {
          const syntheticMr = {
            id: ti.receiptId || `orphan-${ti.id}`,
            partyName: ti.partyName || '',
            productName: ti.productName || '',
            date: ti.date || '',
            totalQty: ti.qty || 0,
            sheetOverrides: {}
          };
          sr += 1;
          list.push(buildSheetRow(syntheticMr, ti, sr));
          return;
        }
        mrsCoveredByInvoice.add(mr.id);
        sr += 1;
        list.push(buildSheetRow(mr, ti, sr));
      });

    (data.materialReceipts || []).forEach((mr) => {
      if (mrsCoveredByInvoice.has(mr.id)) return;
      sr += 1;
      list.push(buildSheetRow(mr, null, sr));
    });

    return list;
  })();

  const statusCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    rows.forEach((row) => {
      if ((parseFloat(row.outstanding) || 0) > 0.01) pending += 1;
      else completed += 1;
    });
    return { pending, completed, all: rows.length };
  }, [rows]);

  const filteredRows = (() => {
    const invoiced = [];
    const awaitingTi = [];
    [...rows].reverse().forEach((row) => {
      const isPending = (parseFloat(row.outstanding) || 0) > 0.01;
      if (statusTab === 'pending' && !isPending) return;
      if (statusTab === 'completed' && isPending) return;
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch = !s ||
        (row.partyName || '').toLowerCase().includes(s) ||
        (row.productName || '').toLowerCase().includes(s) ||
        (row.tiNo || '').toLowerCase().includes(s) ||
        (row.piNo || '').toLowerCase().includes(s);
      const matchesParty = !partyFilter ||
        (row.partyName || '').trim().toLowerCase() === partyFilter.trim().toLowerCase();
      const matchesProduct = !productFilter ||
        (row.productName || '').trim().toLowerCase() === productFilter.trim().toLowerCase();
      if (!matchesSearch || !matchesParty || !matchesProduct) return;
      if (!row.invoiceId) awaitingTi.push(row);
      else invoiced.push(row);
    });
    return [...invoiced, ...awaitingTi].map((row, idx) => ({ ...row, srNo: idx + 1 }));
  })();

  const summaryTotals = filteredRows.reduce(
    (acc, row) => {
      acc.totalBill += parseFloat(row.totalBill) || 0;
      acc.totalReceived += parseFloat(row.amountsReceivedTotal) || 0;
      acc.outstanding += parseFloat(row.outstanding) || 0;
      acc.tds += parseFloat(row.tdsDeduction) || 0;
      return acc;
    },
    { totalBill: 0, totalReceived: 0, outstanding: 0, tds: 0 }
  );

  const partyOptions = Array.from(new Set(rows.map(r => r.partyName))).filter(Boolean).sort();
  const productOptions = Array.from(new Set(rows.map(r => r.productName))).filter(Boolean).sort();

  const tableCols = [
    { key: 'srNo', label: 'Sr No' },
    { key: 'date', label: 'M.R. Date' },
    { key: 'partyName', label: 'Party Name' },
    { key: 'productName', label: 'Product' },
    { key: 'receivedQty', label: 'Recd Qty' },
    { key: 'piNo', label: 'PI No' },
    { key: 'bprDate', label: 'BPR Date' },
    { key: 'dcNo', label: 'DC No' },
    { key: 'dcDate', label: 'DC Date' },
    { key: 'tiNo', label: 'Tax Inv No' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'totalBill', label: 'Bill Amount' },
    { key: 'paid', label: 'Payment Recd (Auto)' },
    { key: 'manualPaid', label: 'Total Recd (Manual)' },
    { key: 'paymentRef', label: 'Cheque / Ref Details' },
    { key: 'paymentDates', label: 'Payment Dates' },
    { key: 'paymentAmounts', label: 'Amounts Received' },
    { key: 'tdsDeduction', label: 'TDS Deduction' },
    { key: 'dueStatus', label: 'Due Status' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'ewayStatus', label: 'E-Way' }
  ];

  const renderSheetField = (row, key) => {
    const value = row[key];
    if (key !== 'paymentDates' && DATE_COLUMNS.has(key)) {
      return (
        <DateField
          className="input-field"
          value={toDateInputValue(value)}
          onChange={(e) => handleCellChange(row.id, key, e.target.value, row.invoiceId)}
        />
      );
    }
    if (key === 'paid') {
      return <input className="input-field" readOnly value={`₹${parseFloat(value || 0).toFixed(2)}`} />;
    }
    return (
      <input
        className="input-field"
        type="text"
        value={value ?? ''}
        onChange={(e) => handleCellChange(row.id, key, e.target.value, row.invoiceId)}
      />
    );
  };

  const openedRow = openedKey ? rows.find((row) => row.rowKey === openedKey) : null;

  return (
    <div className="ps-page">
      <header className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Table size={22} />
            Processing Sheet
          </h1>
          <p className="page-subtitle">Click a row to open that sheet and edit the details.</p>
        </div>
        <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
      </header>

      {!openedRow && (
      <>
      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={statusCounts.all}
        pendingCount={statusCounts.pending}
        completedCount={statusCounts.completed}
        pendingLabel="Pending Payment"
        completedLabel="Cleared"
      />

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', flex: 1, minWidth: '260px', padding: '0 1rem' }}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search by customer name, chemical or invoice number..." 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '220px' }}>
          <Building2 size={18} color="#9b62c4" />
          <SearchableSelect 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={partyFilter} onChange={e => setPartyFilter(e.target.value)}
          >
            <option value="">All Parties</option>
            {partyOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </SearchableSelect>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '220px' }}>
          <Package size={18} color="#9b62c4" />
          <SearchableSelect 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={productFilter} onChange={e => setProductFilter(e.target.value)}
          >
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </SearchableSelect>
        </div>
      </div>
      </>
      )}

      <div>
        {openedRow ? (
          <div className="premium-card ps-sheet">
            <button
              type="button"
              className="btn"
              onClick={() => setOpenedKey(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem' }}
            >
              <ChevronLeft size={16} /> Back to list
            </button>
            <div className="ps-sheet-head">
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <SheetField label="Party Name">
                  {renderSheetField(openedRow, 'partyName')}
                </SheetField>
                <SheetField label="Product">
                  {renderSheetField(openedRow, 'productName')}
                </SheetField>
              </div>
              <strong className={(parseFloat(openedRow.outstanding) || 0) <= 0.01 ? 'ps-cleared' : 'ps-due'}>
                {(parseFloat(openedRow.outstanding) || 0) <= 0.01
                  ? 'Cleared'
                  : `Outstanding ₹${parseFloat(openedRow.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </strong>
            </div>
            <div className="ps-sheet-grid">
              <section className="ps-sheet-card">
                <h3><FileText size={16} /> Receipt</h3>
                <SheetField label="M.R. Date">{renderSheetField(openedRow, 'date')}</SheetField>
                <SheetField label="Received Qty">{renderSheetField(openedRow, 'receivedQty')}</SheetField>
                <SheetField label="PI No">{renderSheetField(openedRow, 'piNo')}</SheetField>
              </section>
              <section className="ps-sheet-card">
                <h3><Truck size={16} /> Delivery</h3>
                <SheetField label="BPR Date">{renderSheetField(openedRow, 'bprDate')}</SheetField>
                <SheetField label="BPR Qty">{renderSheetField(openedRow, 'bprNetQty')}</SheetField>
                <SheetField label="DC No">{renderSheetField(openedRow, 'dcNo')}</SheetField>
                <SheetField label="DC Date">{renderSheetField(openedRow, 'dcDate')}</SheetField>
                <SheetField label="DC Qty">{renderSheetField(openedRow, 'dcNetQty')}</SheetField>
                <SheetField label="E-Way">{renderSheetField(openedRow, 'ewayStatus')}</SheetField>
              </section>
              <section className="ps-sheet-card">
                <h3><FileCheck size={16} /> Invoice</h3>
                <SheetField label="Tax Invoice">{renderSheetField(openedRow, 'tiNo')}</SheetField>
                <SheetField label="Invoice Date">{renderSheetField(openedRow, 'invoiceDate')}</SheetField>
                <SheetField label="Bill Amount">{renderSheetField(openedRow, 'totalBill')}</SheetField>
                <SheetField label="Received (Auto)">{renderSheetField(openedRow, 'paid')}</SheetField>
                <SheetField label="Received (Manual)">{renderSheetField(openedRow, 'manualPaid')}</SheetField>
              </section>
              <section className="ps-sheet-card">
                <h3><Receipt size={16} /> Payment</h3>
                <SheetField label="Cheque / Ref">{renderSheetField(openedRow, 'paymentRef')}</SheetField>
                <SheetField label="Payment Dates">{renderSheetField(openedRow, 'paymentDates')}</SheetField>
                <SheetField label="Amounts Received">{renderSheetField(openedRow, 'paymentAmounts')}</SheetField>
                <SheetField label="TDS">{renderSheetField(openedRow, 'tdsDeduction')}</SheetField>
                <SheetField label="Due Status">{renderSheetField(openedRow, 'dueStatus')}</SheetField>
                <SheetField label="Outstanding">{renderSheetField(openedRow, 'outstanding')}</SheetField>
              </section>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>No Records Yet</h3>
            <p style={{ margin: 0 }}>Create Material Receipts and Tax Invoices to see them listed here.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            No sheets match these filters.
          </div>
        ) : (
          <div className="premium-card ps-list-card">
            <div>
              <table className="ps-table">
                <colgroup>
                  <col className="ps-col-sr" />
                  <col className="ps-col-date" />
                  <col className="ps-col-party" />
                  <col className="ps-col-product" />
                  <col className="ps-col-inv" />
                  <col className="ps-col-out" />
                  <col className="ps-col-status" />
                  <col className="ps-col-open" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sr</th>
                    <th>Date</th>
                    <th>Party</th>
                    <th>Product</th>
                    <th>Invoice</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isPaidOff = (parseFloat(row.outstanding) || 0) <= 0.01;
                    const isOverdue = row.dueStatus === 'Overdue';
                    return (
                      <tr key={row.rowKey} onClick={() => setOpenedKey(row.rowKey)}>
                        <td>{row.srNo}</td>
                        <td className="ps-date">{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                        <td className="ps-party">{row.partyName || '-'}</td>
                        <td>{row.productName || '-'}</td>
                        <td className="ps-inv">{row.tiNo !== 'Pending' ? row.tiNo : row.piNo}</td>
                        <td className={isPaidOff ? 'ps-money ps-cleared' : 'ps-money ps-due'}>
                          ₹{parseFloat(row.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`ps-status ${isPaidOff ? 'is-cleared' : isOverdue ? 'is-overdue' : 'is-due'}`}>
                            {isPaidOff ? 'Cleared' : isOverdue ? 'Overdue' : 'Due'}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="btn btn-primary ps-open" onClick={(e) => { e.stopPropagation(); setOpenedKey(row.rowKey); }}>
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <StatMini title="Total Bill Amount" value={summaryTotals.totalBill} icon={FileText} color="#3b82f6" bg="#eff6ff" />
              <StatMini title="Total Received" value={summaryTotals.totalReceived} icon={FileCheck} color="#9b62c4" bg="var(--table-header-bg)" />
              <StatMini title="Outstanding Amount" value={summaryTotals.outstanding} icon={Percent} color="#ef4444" bg="#fee2e2" />
              <StatMini title="TDS Deducted" value={summaryTotals.tds} icon={Receipt} color="#8b5cf6" bg="#f3e8ff" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingSheet;
