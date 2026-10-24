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

  const fullTextStyle = (value, minPx = 80) => {
    const len = String(value ?? '').length;
    return {
      minWidth: `${Math.max(minPx, Math.ceil(len * 8.2) + 16)}px`,
      width: 'auto',
      textAlign: 'left',
      overflow: 'visible'
    };
  };

  const renderInput = (row, field, value, extraStyle = {}) => (
    <input
      type="text"
      value={value ?? ''}
      size={Math.max(8, String(value ?? '').length + 1)}
      onChange={(e) => handleCellChange(row.id, field, e.target.value, row.invoiceId)}
      title={value ?? ''}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'inherit',
        width: 'auto',
        minWidth: '60px',
        fontSize: 'inherit',
        outline: 'none',
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        padding: '2px 4px',
        borderRadius: '4px',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        overflow: 'visible',
        ...extraStyle
      }}
      onFocus={(e) => { 
        e.target.style.background = 'var(--bg-input, #fff)';
        e.target.style.border = '1px solid var(--accent-primary)'; 
      }}
      onBlur={(e) => { 
        e.target.style.background = 'transparent';
        e.target.style.border = '1px solid transparent'; 
      }}
    />
  );

  const renderDateInput = (row, field, value) => (
    <DateField
      className="dt-cell-input"
      value={toDateInputValue(value)}
      onChange={(e) => handleCellChange(row.id, field, e.target.value, row.invoiceId)}
      style={{
        width: '100%',
        minWidth: '118px',
      }}
    />
  );

  const renderCell = (row, col) => {
    const value = row[col.key];
    if (DATE_COLUMNS.has(col.key)) {
      return renderDateInput(row, col.key, value);
    }
    switch (col.key) {
      case 'srNo':
        return <span style={{ fontWeight: 600 }}>{row.srNo}</span>;
      case 'paid':
        return <span>₹{parseFloat(value || 0).toFixed(2)}</span>;
      case 'tdsDeduction':
        return renderInput(row, 'tdsDeduction', value, fullTextStyle(value, 70));
      case 'dueStatus':
        return renderInput(row, 'dueStatus', value, {
          ...fullTextStyle(value, 70),
          textAlign: 'center',
          fontWeight: 700,
          color: value === 'Overdue' ? '#ef4444' : value === '0' ? '#10b981' : '#f59e0b'
        });
      case 'outstanding':
        return renderInput(row, 'outstanding', value, {
          ...fullTextStyle(value, 90),
          textAlign: 'right',
          fontWeight: 700,
          color: parseFloat(value) > 0 ? '#ef4444' : 'inherit'
        });
      case 'piNo':
        return renderInput(row, 'piNo', value, fullTextStyle(value, 170));
      case 'tiNo':
        return renderInput(row, 'tiNo', value, fullTextStyle(value, 170));
      case 'dcNo':
        return renderInput(row, 'dcNo', value, fullTextStyle(value, 150));
      case 'manualPaid':
        return renderInput(row, 'manualPaid', value, fullTextStyle(value, 80));
      case 'partyName':
        return renderInput(row, 'partyName', value, fullTextStyle(value, 160));
      case 'productName':
        return renderInput(row, 'productName', value, fullTextStyle(value, 140));
      case 'paymentAmounts':
        return renderInput(row, 'paymentAmounts', value, fullTextStyle(value, 140));
      case 'paymentRef':
        return renderInput(row, 'paymentRef', value, fullTextStyle(value, 140));
      case 'totalBill':
        return renderInput(row, 'totalBill', value, fullTextStyle(value, 90));
      case 'receivedQty':
        return renderInput(row, 'receivedQty', value, fullTextStyle(value, 70));
      case 'ewayStatus':
        return renderInput(row, 'ewayStatus', value, fullTextStyle(value, 80));
      default:
        return renderInput(row, col.key, value, fullTextStyle(value, 80));
    }
  };

  const thStyle = { padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'visible' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'center', tableLayout: 'auto' };
  const openedRow = openedKey ? rows.find((row) => row.rowKey === openedKey) : null;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Table size={26} color="var(--accent-primary)" />
            Excel Processing Sheet
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            Click a row to open that sheet.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
        </div>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setOpenedKey(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem' }}
            >
              <ChevronLeft size={16} /> Back to list
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{openedRow.partyName || 'Sheet'}</h2>
                <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  {openedRow.productName || '—'} · {openedRow.date ? new Date(openedRow.date).toLocaleDateString('en-GB') : '—'} · {openedRow.tiNo !== 'Pending' ? openedRow.tiNo : openedRow.piNo}
                </p>
              </div>
              <strong style={{ color: (parseFloat(openedRow.outstanding) || 0) <= 0.01 ? '#10b981' : '#ef4444' }}>
                {(parseFloat(openedRow.outstanding) || 0) <= 0.01
                  ? 'Cleared'
                  : `Outstanding ₹${parseFloat(openedRow.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#5b1c85', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={16} /> Receipt</h3>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>M.R. Date</label>
                {renderCell(openedRow, { key: 'date' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Received Qty</label>
                {renderCell(openedRow, { key: 'receivedQty' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>PI No</label>
                {renderCell(openedRow, { key: 'piNo' })}
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#5b1c85', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Truck size={16} /> Delivery</h3>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BPR Date</label>
                {renderCell(openedRow, { key: 'bprDate' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>BPR Qty</label>
                {renderCell(openedRow, { key: 'bprNetQty' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>DC No</label>
                {renderCell(openedRow, { key: 'dcNo' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>DC Date</label>
                {renderCell(openedRow, { key: 'dcDate' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>E-Way</label>
                {renderCell(openedRow, { key: 'ewayStatus' })}
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#5b1c85', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileCheck size={16} /> Invoice</h3>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tax Invoice</label>
                {renderCell(openedRow, { key: 'tiNo' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Invoice Date</label>
                {renderCell(openedRow, { key: 'invoiceDate' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Bill Amount</label>
                {renderCell(openedRow, { key: 'totalBill' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Received (Auto)</label>
                {renderCell(openedRow, { key: 'paid' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Received (Manual)</label>
                {renderCell(openedRow, { key: 'manualPaid' })}
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#5b1c85', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Receipt size={16} /> Payment</h3>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cheque / Ref</label>
                {renderCell(openedRow, { key: 'paymentRef' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>TDS</label>
                {renderCell(openedRow, { key: 'tdsDeduction' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Due Status</label>
                {renderCell(openedRow, { key: 'dueStatus' })}
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.6rem' }}>Outstanding</label>
                {renderCell(openedRow, { key: 'outstanding' })}
              </div>
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
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Sr</th>
                    <th style={thStyle}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Party</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Invoice</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isPaidOff = (parseFloat(row.outstanding) || 0) <= 0.01;
                    const isOverdue = row.dueStatus === 'Overdue';
                    return (
                      <tr key={row.rowKey} onClick={() => setOpenedKey(row.rowKey)} style={{ cursor: 'pointer' }}>
                        <td style={tdStyle}>{row.srNo}</td>
                        <td style={tdStyle}>{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700 }}>{row.partyName || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{row.productName || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {row.tiNo !== 'Pending' ? row.tiNo : row.piNo}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: isPaidOff ? '#10b981' : '#ef4444' }}>
                          ₹{parseFloat(row.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: isPaidOff ? '#ecfdf5' : isOverdue ? '#fef2f2' : '#fefce8',
                            color: isPaidOff ? '#047857' : isOverdue ? '#dc2626' : '#d97706'
                          }}>
                            {isPaidOff ? 'Cleared' : isOverdue ? 'Overdue' : 'Due'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }} onClick={(e) => { e.stopPropagation(); setOpenedKey(row.rowKey); }}>
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
