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
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Layers,
  Truck,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
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
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState('master'); // 'master' | 'sections'
  const [openSections, setOpenSections] = useState({ receipt: true, billing: false, recon: false });

  useEffect(() => {
    if (location.state?.partyName) {
      setPartyFilter(location.state.partyName);
    }
  }, [location.state?.partyName]);

  const toggleRowExpanded = (rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey]
    }));
  };

  const toggleAllExpanded = (expand) => {
    const next = {};
    if (expand) {
      filteredRows.forEach((r) => { next[r.rowKey] = true; });
    }
    setExpandedRows(next);
  };

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

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

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Table size={26} color="var(--accent-primary)" />
            Excel Processing Sheet
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            Interactive master tracking sheet. Click any row to expand complete material, billing, & payment details.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-input, #f1f5f9)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setViewMode('master')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'master' ? 'var(--bg-card, #fff)' : 'transparent',
                color: viewMode === 'master' ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'master' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Eye size={14} /> Unified Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sections')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'sections' ? 'var(--bg-card, #fff)' : 'transparent',
                color: viewMode === 'sections' ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'sections' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Layers size={14} /> Collapsible Sections
            </button>
          </div>

          <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
        </div>
      </header>

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
          <Building2 size={18} color="#5b1c85" />
          <SearchableSelect 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={partyFilter} onChange={e => setPartyFilter(e.target.value)}
          >
            <option value="">All Parties</option>
            {partyOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </SearchableSelect>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '220px' }}>
          <Package size={18} color="#5b1c85" />
          <SearchableSelect 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={productFilter} onChange={e => setProductFilter(e.target.value)}
          >
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </SearchableSelect>
        </div>
      </div>

      <div>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '50%' }}>
              <Building2 size={48} color="#94a3b8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', color: '#334155', margin: '0 0 0.5rem 0', fontWeight: 700 }}>No Records Yet</h3>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Create Material Receipts and Tax Invoices to see them listed here.</p>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            No master logs found matching your filters.
          </div>
        ) : viewMode === 'master' ? (
          /* ================= MODE 1: UNIFIED MASTER TABLE WITH EXPANDABLE ROWS ================= */
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
            
            {/* Table Header Bar */}
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Master Processing Logs</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>({filteredRows.length} records)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => toggleAllExpanded(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Expand All
                </button>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <button
                  type="button"
                  onClick={() => toggleAllExpanded(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '40px', padding: '0.85rem 0.5rem' }}></th>
                    <th style={thStyle}>Sr No</th>
                    <th style={thStyle}>M.R. Date</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '160px' }}>Party Name</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '140px' }}>Product</th>
                    <th style={thStyle}>Recd Qty</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '140px' }}>Inv / PI No</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Bill Amount</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total Recd</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isExpanded = !!expandedRows[row.rowKey];
                    const isPaidOff = (parseFloat(row.outstanding) || 0) <= 0.01;
                    const isOverdue = row.dueStatus === 'Overdue';

                    return (
                      <React.Fragment key={row.rowKey}>
                        {/* Summary Master Row */}
                        <tr 
                          onClick={() => toggleRowExpanded(row.rowKey)}
                          style={{
                            cursor: 'pointer',
                            background: isExpanded ? 'rgba(91, 28, 133, 0.04)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                          className="hover-row"
                        >
                          <td style={{ ...tdStyle, padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleRowExpanded(row.rowKey); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}
                            >
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                          </td>
                          <td style={tdStyle}>{row.srNo}</td>
                          <td style={tdStyle}>{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, color: 'var(--text-main)' }}>{row.partyName || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-muted)' }}>{row.productName || '-'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{row.receivedQty}</td>
                          <td style={{ ...tdStyle, textAlign: 'left', color: row.tiNo !== 'Pending' ? 'var(--accent-primary)' : '#8b5cf6', fontWeight: 600 }}>
                            {row.tiNo !== 'Pending' ? row.tiNo : row.piNo}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                            ₹{parseFloat(row.totalBill || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            ₹{parseFloat(row.amountsReceivedTotal || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: isPaidOff ? '#10b981' : '#ef4444' }}>
                            ₹{parseFloat(row.outstanding || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: isPaidOff ? '#ecfdf5' : isOverdue ? '#fef2f2' : '#fefce8',
                              color: isPaidOff ? '#047857' : isOverdue ? '#dc2626' : '#d97706'
                            }}>
                              {isPaidOff ? <CheckCircle2 size={12} /> : isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                              {isPaidOff ? 'Cleared' : isOverdue ? 'Overdue' : 'Due'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleRowExpanded(row.rowKey); }}
                              className="btn btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '4px 10px',
                                background: isExpanded ? 'var(--accent-primary)' : 'var(--bg-input, #f1f5f9)',
                                color: isExpanded ? '#fff' : 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px'
                              }}
                            >
                              {isExpanded ? 'Close' : 'Details'}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Inline Detail Panel */}
                        {isExpanded && (
                          <tr key={`expanded-panel-${row.rowKey}`} style={{ background: '#f8fafc' }}>
                            <td colSpan={12} style={{ padding: '1.25rem', borderBottom: '2px solid var(--accent-primary)' }}>
                              <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ background: 'rgba(91, 28, 133, 0.1)', color: 'var(--accent-primary)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                      {row.srNo}
                                    </div>
                                    <div>
                                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                        {row.partyName}
                                      </h3>
                                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Product: <strong>{row.productName || 'N/A'}</strong> | M.R. Date: {row.date ? new Date(row.date).toLocaleDateString('en-GB') : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPaidOff ? '#10b981' : '#ef4444' }}>
                                      {isPaidOff ? 'Fully Paid & Cleared' : `Outstanding: ₹${parseFloat(row.outstanding || 0).toFixed(2)}`}
                                    </span>
                                  </div>
                                </div>

                                {/* 4 Grid Cards for full Record Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                  
                                  {/* Card 1: Receipt & Material */}
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <FileText size={16} /> Receipt & Material
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>M.R. Date</span>
                                        {renderCell(row, { key: 'date' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Received Qty</span>
                                        {renderCell(row, { key: 'receivedQty' })}
                                      </div>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Proforma Invoice (P/I No)</span>
                                        {renderCell(row, { key: 'piNo' })}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card 2: BPR & Delivery (DC) */}
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <Truck size={16} /> BPR & Delivery (DC)
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>BPR Date</span>
                                        {renderCell(row, { key: 'bprDate' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>BPR Net Qty</span>
                                        {renderCell(row, { key: 'bprNetQty' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>DC No</span>
                                        {renderCell(row, { key: 'dcNo' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>DC Date</span>
                                        {renderCell(row, { key: 'dcDate' })}
                                      </div>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>E-Way Status</span>
                                        {renderCell(row, { key: 'ewayStatus' })}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card 3: Tax Invoice & Billing */}
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <FileCheck size={16} /> Tax Invoice & Billing
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Tax Inv No</span>
                                        {renderCell(row, { key: 'tiNo' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Invoice Date</span>
                                        {renderCell(row, { key: 'invoiceDate' })}
                                      </div>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Total Bill Amount</span>
                                        {renderCell(row, { key: 'totalBill' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Payment Recd (Auto)</span>
                                        {renderCell(row, { key: 'paid' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Total Recd (Manual)</span>
                                        {renderCell(row, { key: 'manualPaid' })}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card 4: Reconciliation & TDS */}
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                                    <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <Receipt size={16} /> Reconciliation & TDS
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Cheque / Ref Details</span>
                                        {renderCell(row, { key: 'paymentRef' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>TDS Deduction</span>
                                        {renderCell(row, { key: 'tdsDeduction' })}
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Due Status</span>
                                        {renderCell(row, { key: 'dueStatus' })}
                                      </div>
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Outstanding Amount</span>
                                        {renderCell(row, { key: 'outstanding' })}
                                      </div>
                                    </div>
                                  </div>

                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1.25rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
               <StatMini title="Total Bill Amount" value={summaryTotals.totalBill} icon={FileText} color="#3b82f6" bg="#eff6ff" />
               <StatMini title="Total Received" value={summaryTotals.totalReceived} icon={FileCheck} color="#5b1c85" bg="var(--table-header-bg)" />
               <StatMini title="Outstanding Amount" value={summaryTotals.outstanding} icon={Percent} color="#ef4444" bg="#fee2e2" />
               <StatMini title="TDS Deducted" value={summaryTotals.tds} icon={Receipt} color="#8b5cf6" bg="#f3e8ff" />
               <StatMini title="Invoices" value={String(filteredRows.length)} icon={ShieldAlert} color="#eab308" bg="#fef9c3" />
            </div>

          </div>
        ) : (
          /* ================= MODE 2: COLLAPSIBLE ACCORDION SECTIONS ================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Section 1 — Receipt Details */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('receipt')}
                style={{ background: '#f8fafc', padding: '1rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: openSections.receipt ? '1px solid var(--border-color)' : 'none' }}
              >
                <FileText size={18} color="#3b82f6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Receipt Details</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>({filteredRows.length} records)</span>
                <button type="button" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {openSections.receipt ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {openSections.receipt && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                       <tr>
                         <th style={thStyle}>Sr No</th>
                         <th style={thStyle}>M.R. Date</th>
                         <th style={{ ...thStyle, minWidth: '160px' }}>Party Name</th>
                         <th style={{ ...thStyle, minWidth: '140px' }}>Product</th>
                         <th style={thStyle}>Recd Qty</th>
                         <th style={{ ...thStyle, minWidth: '170px' }}>P / I No</th>
                         <th style={thStyle}>BPR Date</th>
                         <th style={{ ...thStyle, minWidth: '150px' }}>DC No</th>
                         <th style={thStyle}>DC Date</th>
                         <th style={{ ...thStyle, minWidth: '170px' }}>Tax Inv No</th>
                       </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                       <tr key={`receipt-${row.rowKey}`}>
                         <td style={tdStyle}>{renderCell(row, {key: 'srNo'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'date'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'partyName'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'productName'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'receivedQty'})}</td>
                         <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600, textAlign: 'left' }}>{renderCell(row, {key: 'piNo'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'bprDate'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'dcNo'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'dcDate'})}</td>
                         <td style={{...tdStyle, color: 'var(--accent-primary)', fontWeight: 600, textAlign: 'left' }}>{renderCell(row, {key: 'tiNo'})}</td>
                       </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 2 — Invoice / Billing Details */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('billing')}
                style={{ background: 'var(--table-header-bg)', padding: '1rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: openSections.billing ? '1px solid var(--border-color)' : 'none' }}
              >
                <FileCheck size={18} color="#5b1c85" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Invoice / Billing Details</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>({filteredRows.length} invoices)</span>
                <button type="button" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {openSections.billing ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {openSections.billing && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                       <tr>
                         <th style={{ ...thStyle, minWidth: '170px' }}>Tax Inv No</th>
                         <th style={thStyle}>Invoice Date</th>
                         <th style={thStyle}>Bill Amount</th>
                         <th style={thStyle}>Payment Recd (Auto)</th>
                         <th style={thStyle}>Total Recd (Manual)</th>
                         <th style={{ ...thStyle, minWidth: '140px' }}>Cheque / Ref Details</th>
                         <th style={{ ...thStyle, minWidth: '120px' }}>Payment Dates</th>
                         <th style={{ ...thStyle, minWidth: '140px' }}>Amounts Received</th>
                         <th style={thStyle}>TDS Deducted</th>
                       </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                       <tr key={`billing-${row.rowKey}`}>
                         <td style={{...tdStyle, color: 'var(--accent-primary)', fontWeight: 600, textAlign: 'left' }}>{renderCell(row, {key: 'tiNo'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'invoiceDate'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'totalBill'})}</td>
                         <td style={{...tdStyle, color: 'var(--accent-primary)', fontWeight: 600 }}>{renderCell(row, {key: 'paid'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'manualPaid'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentRef'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentDates'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentAmounts'})}</td>
                         <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600 }}>{renderCell(row, {key: 'tdsDeduction'})}</td>
                       </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 3 — Payment Reconciliation */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('recon')}
                style={{ background: '#fefce8', padding: '1rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: openSections.recon ? '1px solid var(--border-color)' : 'none' }}
              >
                <Receipt size={18} color="#eab308" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Payment Reconciliation</span>
                <button type="button" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {openSections.recon ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {openSections.recon && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                       <tr>
                         <th style={{ ...thStyle, minWidth: '170px' }}>Tax Inv No</th>
                         <th style={thStyle}>Payment Recd (Auto)</th>
                         <th style={thStyle}>Total Recd (Manual)</th>
                         <th style={{ ...thStyle, minWidth: '140px' }}>Cheque / Ref Details</th>
                         <th style={{ ...thStyle, minWidth: '120px' }}>Payment Dates</th>
                         <th style={{ ...thStyle, minWidth: '140px' }}>Amounts Received</th>
                         <th style={thStyle}>TDS Deduction</th>
                         <th style={thStyle}>Due Status</th>
                         <th style={thStyle}>Outstanding</th>
                         <th style={thStyle}>E-Way</th>
                       </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                       <tr key={`recon-${row.rowKey}`}>
                         <td style={{...tdStyle, color: 'var(--accent-primary)', fontWeight: 600, textAlign: 'left' }}>{renderCell(row, {key: 'tiNo'})}</td>
                         <td style={{...tdStyle, color: 'var(--accent-primary)', fontWeight: 600 }}>{renderCell(row, {key: 'paid'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'manualPaid'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentRef'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentDates'})}</td>
                         <td style={{ ...tdStyle, textAlign: 'left' }}>{renderCell(row, {key: 'paymentAmounts'})}</td>
                         <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600 }}>{renderCell(row, {key: 'tdsDeduction'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'dueStatus'})}</td>
                         <td style={{...tdStyle, color: '#ef4444', fontWeight: 600 }}>{renderCell(row, {key: 'outstanding'})}</td>
                         <td style={tdStyle}>{renderCell(row, {key: 'ewayStatus'})}</td>
                       </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1.25rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
               <StatMini title="Total Bill Amount" value={summaryTotals.totalBill} icon={FileText} color="#3b82f6" bg="#eff6ff" />
               <StatMini title="Total Received" value={summaryTotals.totalReceived} icon={FileCheck} color="#5b1c85" bg="var(--table-header-bg)" />
               <StatMini title="Outstanding Amount" value={summaryTotals.outstanding} icon={Percent} color="#ef4444" bg="#fee2e2" />
               <StatMini title="TDS Deducted" value={summaryTotals.tds} icon={Receipt} color="#8b5cf6" bg="#f3e8ff" />
               <StatMini title="Invoices" value={String(filteredRows.length)} icon={ShieldAlert} color="#eab308" bg="#fef9c3" />
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingSheet;
