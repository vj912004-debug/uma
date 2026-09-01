import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useLocation } from 'react-router-dom';
import { 
  Search, 
  Building2, 
  Package, 
  FileText, 
  Receipt,
  FileCheck,
  Percent,
  ShieldAlert
} from 'lucide-react';
import ExportButton from '../components/ExportButton';
import {
  getReceiptPaymentTotal,
  getReceiptTdsTotal,
  getReceiptPayments,
  getReceiptBillAmount,
  getReceiptOutstanding,
  hasSheetOverride,
  getMergedSheetOverrides
} from '../utils/paymentTotals';
import SearchableSelect from '../components/SearchableSelect';

const DATE_COLUMNS = new Set(['date', 'bprDate', 'dcDate', 'invoiceDate']);

const toDateInputValue = (val) => {
  if (!val) return '';
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str.length === 10 ? `${str}T00:00:00` : str);
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
    const paymentFields = new Set(['totalBill', 'manualPaid', 'tdsDeduction', 'outstanding']);
    // Empty numeric cells save as 0 so clearing does not snap back to auto-calculated values
    const nextVal = numericFields.has(field) && (value === '' || value === null || value === undefined)
      ? '0'
      : value;

    const ti = invoiceId
      ? (data.invoices || []).find((inv) => inv.id === invoiceId)
      : getTI(mrId);

    const persistComputedOutstanding = (bucket, nextMr) => {
      const outstanding = getReceiptOutstanding(nextMr, ti, data.payments);
      bucket.outstanding = outstanding < 0.01 ? '0' : String(Math.round(outstanding * 100) / 100);
      bucket.dueStatus = outstanding <= 0 ? '0' : 'Due';
    };

    if (invoiceId && paymentFields.has(field)) {
      const byInvoice = { ...(currentOverrides.byInvoice || {}) };
      const invO = { ...(byInvoice[invoiceId] || {}) };
      invO[field] = nextVal;
      if (field === 'manualPaid' || field === 'totalBill' || field === 'tdsDeduction') {
        delete invO.outstanding;
        const nextMr = {
          ...mr,
          sheetOverrides: { ...currentOverrides, byInvoice: { ...byInvoice, [invoiceId]: invO } }
        };
        persistComputedOutstanding(invO, nextMr);
      } else if (field === 'outstanding') {
        invO.dueStatus = (parseFloat(nextVal) || 0) <= 0 ? '0' : 'Due';
      }
      byInvoice[invoiceId] = invO;
      currentOverrides.byInvoice = byInvoice;
      // Stale receipt-level outstanding must not leak onto other invoices / Party Due
      delete currentOverrides.outstanding;
    } else {
      currentOverrides[field] = nextVal;
      if (field === 'manualPaid' || field === 'totalBill' || field === 'tdsDeduction') {
        delete currentOverrides.outstanding;
        const nextMr = { ...mr, sheetOverrides: currentOverrides };
        persistComputedOutstanding(currentOverrides, nextMr);
      } else if (field === 'outstanding') {
        currentOverrides.dueStatus = (parseFloat(nextVal) || 0) <= 0 ? '0' : 'Due';
      }
    }

    updateItem('materialReceipts', mrId, {
      ...mr,
      sheetOverrides: currentOverrides
    });

    // Clear stale typed Party Due so this page is the only source of outstanding
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

  // One row per Tax Invoice (+ pending MR rows with no TI yet)
  const rows = (() => {
    const list = [];
    const mrsCoveredByInvoice = new Set();
    let sr = 0;

    (data.invoices || [])
      .filter((inv) => inv.invoiceNo?.includes('/IN/'))
      .forEach((ti) => {
        const mr = (data.materialReceipts || []).find((m) => m.id === ti.receiptId);
        if (!mr) {
          // Orphan TI still listed so Invoice / Billing shows every invoice
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

  const filteredRows = [...rows].reverse().filter((row) => {
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
    return matchesSearch && matchesParty && matchesProduct;
  }).map((row, idx) => ({ ...row, srNo: idx + 1 }));

  const summaryTotals = filteredRows.reduce(
    (acc, row) => {
      const received =
        row.manualPaid !== '' && row.manualPaid != null
          ? (parseFloat(row.manualPaid) || 0) + (parseFloat(row.tdsDeduction) || 0)
          : (parseFloat(row.paid) || 0);
      acc.totalBill += parseFloat(row.totalBill) || 0;
      acc.totalReceived += received;
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
        padding: '0',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        overflow: 'visible',
        ...extraStyle
      }}
      onFocus={(e) => { e.target.style.borderBottom = '1px solid var(--accent-primary)'; }}
      onBlur={(e) => { e.target.style.borderBottom = '1px solid transparent'; }}
    />
  );

  const renderDateInput = (row, field, value) => (
    <input
      type="date"
      value={toDateInputValue(value)}
      onChange={(e) => handleCellChange(row.id, field, e.target.value, row.invoiceId)}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'inherit',
        width: '100%',
        minWidth: '118px',
        fontSize: 'inherit',
        outline: 'none',
        fontFamily: 'inherit',
        padding: '0',
        textAlign: 'center',
        cursor: 'pointer'
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
      case 'paymentDates':
        return renderInput(row, 'paymentDates', value, fullTextStyle(value, 120));
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

  const thStyle = { padding: '1rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'visible' };
  const tableStyle = { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap', tableLayout: 'auto' };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Excel Processing Sheet</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Complete end-to-end master spreadsheet tracking customer materials from receipt to payment reconciliation.</p>
        </div>
        <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', flex: 1, padding: '0 1rem' }}>
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
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>

              {/* Section 1 — all receipts / invoices */}
              <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={18} color="#3b82f6" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Receipt Details</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}</span>
              </div>
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

              {/* Section 2 — all invoice / billing rows */}
              <div style={{ background: 'var(--table-header-bg)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileCheck size={18} color="#5b1c85" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Invoice / Billing Details</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{filteredRows.length} invoice{filteredRows.length === 1 ? '' : 's'}</span>
              </div>
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

              {/* Section 3 — all payment reconciliation rows */}
              <div style={{ background: '#fefce8', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Receipt size={18} color="#eab308" />
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>Payment Reconciliation</span>
              </div>
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

              {/* Footer Stats — totals across all visible invoices */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1.5rem', background: 'var(--bg-card)' }}>
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
