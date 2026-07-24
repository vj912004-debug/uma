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
  hasSheetOverride
} from '../utils/paymentTotals';

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
  
  let valColor = '#1e293b';
  if (title === 'Due Status') {
     valColor = value === 'Overdue' ? '#ef4444' : value === '0' ? '#10b981' : '#eab308';
  } else if (title === 'Outstanding Amount') {
     valColor = value > 0 ? '#ef4444' : '#1e293b';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: bg, padding: '1rem 1.25rem', borderRadius: '8px' }}>
      <div style={{ background: '#fff', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
         <Icon size={20} color={color} />
      </div>
      <div>
         <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{title}</p>
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
  const getPI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/PI/'));
  const getBPR = (mrId) => (data.bprs || []).find(b => b.receiptId === mrId);
  const getDC = (mrId) => (data.deliveryChallans || []).find(dc => dc.receiptId === mrId);
  const getTI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/IN/'));

  const getPaymentsReceived = (mrId) => getReceiptPaymentTotal(data.payments, mrId);
  const getTdsReceived = (mrId) => getReceiptTdsTotal(data.payments, mrId);
  const getPaymentHistory = (mrId) => getReceiptPayments(data.payments, mrId);

  const handleCellChange = (mrId, field, value) => {
    const mr = data.materialReceipts.find(m => m.id === mrId);
    if (!mr) return;
    const currentOverrides = mr.sheetOverrides || {};
    updateItem('materialReceipts', mrId, {
      ...mr,
      sheetOverrides: { ...currentOverrides, [field]: value }
    });
  };

  // Compile row data
  const rows = data.materialReceipts.map((mr, idx) => {
    const pi = getPI(mr.id);
    const bpr = getBPR(mr.id);
    const dc = getDC(mr.id);
    const ti = getTI(mr.id);
    const totalBill = ti?.total || 0;
    const paid = getPaymentsReceived(mr.id);
    const tdsTotal = getTdsReceived(mr.id);
    const overdue = (ti?.total || 0) - paid > 0.01 && ti?.date && new Date(ti.date) < new Date();
    const paymentHistory = getPaymentHistory(mr.id);

    const o = mr.sheetOverrides || {};

    const finalTotalBill = hasSheetOverride(o, 'totalBill') ? parseFloat(o.totalBill) || 0 : totalBill;
    const finalPaid = hasSheetOverride(o, 'manualPaid') ? parseFloat(o.manualPaid) || 0 : paid;
    let compOutstanding = finalTotalBill - finalPaid;
    if (compOutstanding < 0.01) compOutstanding = 0;
    const finalTds = hasSheetOverride(o, 'tdsDeduction') ? parseFloat(o.tdsDeduction) || 0 : tdsTotal;

    let ewayStatus = 'Pending';
    if (dc?.ewayBillNo || ti?.ewayBillNo) {
      ewayStatus = 'Done';
    }

    return {
      id: mr.id,
      srNo: idx + 1,
      date: hasSheetOverride(o, 'date') ? o.date : mr.date,
      partyName: hasSheetOverride(o, 'partyName') ? o.partyName : mr.partyName,
      productName: hasSheetOverride(o, 'productName') ? o.productName : mr.productName,
      receivedQty: hasSheetOverride(o, 'receivedQty') ? o.receivedQty : (parseFloat(mr.totalQty) || 0),
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
      outstanding: hasSheetOverride(o, 'outstanding') ? parseFloat(o.outstanding) || 0 : compOutstanding,
      dueStatus: hasSheetOverride(o, 'dueStatus') ? o.dueStatus : (compOutstanding <= 0 ? '0' : (overdue ? 'Overdue' : 'Due')),
      paymentDates: hasSheetOverride(o, 'paymentDates') ? o.paymentDates : paymentHistory.map(p => p.date).filter(Boolean).join(', '),
      paymentAmounts: hasSheetOverride(o, 'paymentAmounts') ? o.paymentAmounts : paymentHistory.map(p => `₹${(parseFloat(p.amount) || 0).toFixed(2)}${p.tds ? ` (TDS ₹${(parseFloat(p.tds) || 0).toFixed(2)})` : ''}`).join(' | '),
      paymentRef: hasSheetOverride(o, 'paymentRef') ? o.paymentRef : '',
      ewayStatus: o.ewayStatus !== undefined ? o.ewayStatus : ewayStatus
    };
  });

  const hasFilter = partyFilter || searchTerm || productFilter;
  const filteredRows = !hasFilter ? [] : [...rows].reverse().filter(row => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      row.partyName.toLowerCase().includes(s) ||
      row.productName.toLowerCase().includes(s) ||
      row.tiNo.toLowerCase().includes(s);
    const matchesParty = !partyFilter || row.partyName === partyFilter;
    const matchesProduct = !productFilter || row.productName === productFilter;
    return matchesSearch && matchesParty && matchesProduct;
  });

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
    { key: 'bprNetQty', label: 'Milled Qty' },
    { key: 'dcNo', label: 'DC No' },
    { key: 'dcDate', label: 'DC Date' },
    { key: 'dcNetQty', label: 'DC Qty' },
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

  const renderInput = (id, field, value, extraStyle = {}) => (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => handleCellChange(id, field, e.target.value)}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'inherit',
        width: '100%',
        minWidth: '60px',
        fontSize: 'inherit',
        outline: 'none',
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        padding: '0',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        ...extraStyle
      }}
      onFocus={(e) => { e.target.style.borderBottom = '1px solid var(--accent-primary)'; }}
      onBlur={(e) => { e.target.style.borderBottom = '1px solid transparent'; }}
    />
  );

  const renderDateInput = (id, field, value) => (
    <input
      type="date"
      value={toDateInputValue(value)}
      onChange={(e) => handleCellChange(id, field, e.target.value)}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'inherit',
        width: '100%',
        minWidth: '100px',
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
    const { id } = row;
    const value = row[col.key];
    if (DATE_COLUMNS.has(col.key)) {
      return renderDateInput(id, col.key, value);
    }
    switch (col.key) {
      case 'srNo':
        return <span style={{ fontWeight: 600 }}>{row.srNo}</span>;
      case 'paid':
        return <span>₹{parseFloat(value || 0).toFixed(2)}</span>;
      case 'tdsDeduction':
        return renderInput(id, 'tdsDeduction', value);
      case 'dueStatus':
        return renderInput(id, 'dueStatus', value, {
          fontWeight: 700,
          color: value === 'Overdue' ? '#ef4444' : value === '0' ? '#10b981' : '#f59e0b'
        });
      case 'outstanding':
        return renderInput(id, 'outstanding', value);
      case 'piNo':
        return renderInput(id, 'piNo', value);
      case 'tiNo':
        return renderInput(id, 'tiNo', value);
      case 'manualPaid':
        return renderInput(id, 'manualPaid', value);
      case 'partyName':
        return renderInput(id, 'partyName', value);
      case 'paymentAmounts':
        return (
          <span title={value || ''} style={{ maxWidth: '180px', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {renderInput(id, 'paymentAmounts', value)}
          </span>
        );
      case 'paymentRef':
        return value ? renderInput(id, 'paymentRef', value) : <span>—</span>;
      case 'paymentDates':
        return value ? renderInput(id, 'paymentDates', value) : <span>—</span>;
      default:
        return renderInput(id, col.key, value);
    }
  };

  const thStyle = { padding: '1rem', fontWeight: 600, color: '#475569', background: '#fff', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem' };
  const tdStyle = { padding: '1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Excel Processing Sheet</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Complete end-to-end master spreadsheet tracking customer materials from receipt to payment reconciliation.</p>
        </div>
        <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', flex: 1, padding: '0 1rem' }}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search by customer name, chemical or invoice number..." 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '220px' }}>
          <Building2 size={18} color="#10b981" />
          <select 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={partyFilter} onChange={e => setPartyFilter(e.target.value)}
          >
            <option value="">All Parties</option>
            {partyOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '220px' }}>
          <Package size={18} color="#10b981" />
          <select 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', color: '#475569' }}
            value={productFilter} onChange={e => setProductFilter(e.target.value)}
          >
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        {!hasFilter ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '50%' }}>
              <Building2 size={48} color="#94a3b8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', color: '#334155', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Select a Party to View Data</h3>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>The Master Processing Sheet contains all records. Please select a Party from the dropdown above, or use the Search bar to find specific records.</p>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            No master logs found matching your filters.
          </div>
        ) : (
          filteredRows.map(row => (
            <div key={row.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
              
              {/* Section 1 */}
              <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={18} color="#3b82f6" /> 
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Receipt Details</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <thead>
                     <tr>
                       <th style={thStyle}>Sr No</th>
                       <th style={thStyle}>M.R. Date</th>
                       <th style={thStyle}>Party Name</th>
                       <th style={thStyle}>Product</th>
                       <th style={thStyle}>Recd Qty</th>
                       <th style={thStyle}>P / I No</th>
                       <th style={thStyle}>BPR Date</th>
                       <th style={thStyle}>Milled Qty</th>
                       <th style={thStyle}>DC No</th>
                       <th style={thStyle}>DC Date</th>
                       <th style={thStyle}>DC Qty</th>
                       <th style={thStyle}>Tax Inv No</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr>
                       <td style={tdStyle}>{renderCell(row, {key: 'srNo'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'date'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'partyName'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'productName'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'receivedQty'})}</td>
                       <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600 }}>{renderCell(row, {key: 'piNo'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'bprDate'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'bprNetQty'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'dcNo'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'dcDate'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'dcNetQty'})}</td>
                       <td style={{...tdStyle, color: '#10b981', fontWeight: 600 }}>{renderCell(row, {key: 'tiNo'})}</td>
                     </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2 */}
              <div style={{ background: '#f0fdf4', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileCheck size={18} color="#10b981" /> 
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Invoice / Billing Details</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <thead>
                     <tr>
                       <th style={thStyle}>Tax Inv No</th>
                       <th style={thStyle}>Invoice Date</th>
                       <th style={thStyle}>Bill Amount</th>
                       <th style={thStyle}>Payment Recd (Auto)</th>
                       <th style={thStyle}>Total Recd (Manual)</th>
                       <th style={thStyle}>Cheque / Ref Details</th>
                       <th style={thStyle}>Payment Dates</th>
                       <th style={thStyle}>Amounts Received</th>
                       <th style={thStyle}>TDS Deducted</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr>
                       <td style={{...tdStyle, color: '#10b981', fontWeight: 600 }}>{renderCell(row, {key: 'tiNo'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'invoiceDate'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'totalBill'})}</td>
                       <td style={{...tdStyle, color: '#10b981', fontWeight: 600 }}>{renderCell(row, {key: 'paid'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'manualPaid'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentRef'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentDates'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentAmounts'})}</td>
                       <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600 }}>{renderCell(row, {key: 'tdsDeduction'})}</td>
                     </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 3 */}
              <div style={{ background: '#fefce8', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Receipt size={18} color="#eab308" /> 
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Payment Reconciliation</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <thead>
                     <tr>
                       <th style={thStyle}>Payment Recd (Auto)</th>
                       <th style={thStyle}>Total Recd (Manual)</th>
                       <th style={thStyle}>Cheque / Ref Details</th>
                       <th style={thStyle}>Payment Dates</th>
                       <th style={thStyle}>Amounts Received</th>
                       <th style={thStyle}>TDS Deduction</th>
                       <th style={thStyle}>Due Status</th>
                       <th style={thStyle}>Outstanding</th>
                       <th style={thStyle}>E-Way</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr>
                       <td style={{...tdStyle, color: '#10b981', fontWeight: 600 }}>{renderCell(row, {key: 'paid'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'manualPaid'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentRef'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentDates'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'paymentAmounts'})}</td>
                       <td style={{...tdStyle, color: '#8b5cf6', fontWeight: 600 }}>{renderCell(row, {key: 'tdsDeduction'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'dueStatus'})}</td>
                       <td style={{...tdStyle, color: '#ef4444', fontWeight: 600 }}>{renderCell(row, {key: 'outstanding'})}</td>
                       <td style={tdStyle}>{renderCell(row, {key: 'ewayStatus'})}</td>
                     </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1.5rem', background: '#fff' }}>
                 <StatMini title="Total Bill Amount" value={row.totalBill} icon={FileText} color="#3b82f6" bg="#eff6ff" />
                 <StatMini title="Total Received" value={row.manualPaid ? parseFloat(row.manualPaid) : row.paid} icon={FileCheck} color="#10b981" bg="#dcfce3" />
                 <StatMini title="Outstanding Amount" value={row.outstanding} icon={Percent} color="#ef4444" bg="#fee2e2" />
                 <StatMini title="TDS Deducted" value={row.tdsDeduction} icon={Receipt} color="#8b5cf6" bg="#f3e8ff" />
                 <StatMini title="Due Status" value={row.dueStatus} icon={ShieldAlert} color="#eab308" bg="#fef9c3" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProcessingSheet;
