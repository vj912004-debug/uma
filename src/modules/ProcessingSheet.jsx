import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import ExportButton from '../components/ExportButton';

const ProcessingSheet = () => {
  const { data, updateItem } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});

  // Table Helpers to retrieve downstream details
  const getPI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/PI/'));
  const getBPR = (mrId) => (data.bprs || []).find(b => b.receiptId === mrId);
  const getDC = (mrId) => (data.deliveryChallans || []).find(dc => dc.receiptId === mrId);
  const getTI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/IN/'));

  const getPaymentsReceived = (mrId) => {
    return (data.payments || [])
      .filter(p => p.receiptId === mrId)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.tds) || 0), 0);
  };

  const getPaymentHistory = (mrId) => {
    return (data.payments || [])
      .filter(p => p.receiptId === mrId)
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  };

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
    const overdue = (ti?.total || 0) - paid > 0 && ti?.date && new Date(ti.date) < new Date();
    const paymentHistory = getPaymentHistory(mr.id);
    
    // E-Way status
    let ewayStatus = 'Pending';
    if (dc?.ewayBillNo || ti?.ewayBillNo) {
      ewayStatus = 'Done';
    }

    const o = mr.sheetOverrides || {};
    
    const finalTotalBill = o.totalBill !== undefined ? parseFloat(o.totalBill) || 0 : totalBill;
    const finalPaid = o.manualPaid !== undefined ? parseFloat(o.manualPaid) || 0 : paid;
    const compOutstanding = Math.max(0, finalTotalBill - finalPaid);

    return {
      id: mr.id,
      srNo: idx + 1,
      date: o.date !== undefined ? o.date : mr.date,
      partyName: o.partyName !== undefined ? o.partyName : mr.partyName,
      productName: o.productName !== undefined ? o.productName : mr.productName,
      receivedQty: o.receivedQty !== undefined ? o.receivedQty : (parseFloat(mr.totalQty) || 0),
      piNo: o.piNo !== undefined ? o.piNo : (pi?.invoiceNo || 'Pending'),
      bprDate: o.bprDate !== undefined ? o.bprDate : (bpr?.date || ''),
      bprNetQty: o.bprNetQty !== undefined ? o.bprNetQty : (bpr?.totalDispatchedNet || 0),
      dcNo: o.dcNo !== undefined ? o.dcNo : (dc?.dcNo || 'Pending'),
      dcDate: o.dcDate !== undefined ? o.dcDate : (dc?.date || ''),
      dcNetQty: o.dcNetQty !== undefined ? o.dcNetQty : (dc?.qty || 0),
      tiNo: o.tiNo !== undefined ? o.tiNo : (ti?.invoiceNo || 'Pending'),
      invoiceDate: o.invoiceDate !== undefined ? o.invoiceDate : (ti?.date || ''),
      totalBill: finalTotalBill,
      paid: paid, // auto calculated
      manualPaid: o.manualPaid !== undefined ? o.manualPaid : '', // manual
      outstanding: o.outstanding !== undefined ? o.outstanding : compOutstanding,
      dueStatus: o.dueStatus !== undefined ? o.dueStatus : (compOutstanding <= 0 ? '0' : (overdue ? 'Overdue' : 'Due')),
      paymentDates: o.paymentDates !== undefined ? o.paymentDates : paymentHistory.map(p => p.date).filter(Boolean).join(', '),
      paymentAmounts: o.paymentAmounts !== undefined ? o.paymentAmounts : paymentHistory.map(p => `Γé╣${(parseFloat(p.amount) || 0).toFixed(2)}${p.tds ? ` (TDS Γé╣${(parseFloat(p.tds) || 0).toFixed(2)})` : ''}`).join(' | '),
      paymentRef: o.paymentRef !== undefined ? o.paymentRef : '',
      ewayStatus: o.ewayStatus !== undefined ? o.ewayStatus : ewayStatus
    };
  });

  // Handle Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return sortOrder === 'asc' 
        ? (valA - valB) 
        : (valB - valA);
    }
  });

  const filteredRows = sortedRows.filter(row => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      row.partyName.toLowerCase().includes(s) ||
      row.productName.toLowerCase().includes(s) ||
      row.tiNo.toLowerCase().includes(s);
    const matchesParty = !partyFilter || row.partyName === partyFilter;
    const matchesProduct = !productFilter || row.productName === productFilter;
    
    let matchesColumnFilters = true;
    for (const [key, filterVal] of Object.entries(columnFilters)) {
      if (filterVal) {
        const rowVal = String(row[key] || '').toLowerCase();
        if (!rowVal.includes(filterVal.toLowerCase())) {
          matchesColumnFilters = false;
          break;
        }
      }
    }

    return matchesSearch && matchesParty && matchesProduct && matchesColumnFilters;
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
    { key: 'dueStatus', label: 'Due Status' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'ewayStatus', label: 'E-Way' }
  ];

  const renderInput = (id, field, value, extraStyle = {}) => (
    <input
      type="text"
      value={value || ''}
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
        padding: '0.2rem',
        transition: 'all 0.2s ease',
        ...extraStyle
      }}
      onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-primary)'}
      onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
    />
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Excel Processing Sheet</h1>
          <p style={{ color: 'var(--text-muted)' }}>Complete end-to-end master spreadsheet tracking customer materials from receipt to payment reconciliation.</p>
        </div>
        <ExportButton data={filteredRows} columns={tableCols} filename="Master_Processing_Sheet" title="Master Processing Sheet" />
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by customer name, chemical or invoice number..." 
              style={{ paddingLeft: '3rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ minWidth: '220px' }}>
            <select className="input-field" value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
              <option value="">All Parties</option>
              {partyOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '220px' }}>
            <select className="input-field" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
              <option value="">All Products</option>
              {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                {tableCols.map(col => (
                  <th key={col.key} style={{ padding: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort(col.key)}>
                    {col.label} <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                  </th>
                ))}
              </tr>
              {/* Filter Row */}
              <tr style={{ background: 'var(--glass-bg)' }}>
                {tableCols.map(col => (
                  <th key={`filter-${col.key}`} style={{ padding: '0.2rem' }}>
                    <input 
                      type="text" 
                      placeholder={`Filter...`} 
                      value={columnFilters[col.key] || ''} 
                      onChange={e => setColumnFilters({...columnFilters, [col.key]: e.target.value})} 
                      style={{ width: '100%', minWidth: '60px', fontSize: '0.75rem', padding: '0.2rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }} 
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={tableCols.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No master logs recorded in this spreadsheet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{row.srNo}</td>
                    <td style={{ padding: '0.25rem' }}>{renderInput(row.id, 'date', row.date)}</td>
                    <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--text-main)' }}>{renderInput(row.id, 'partyName', row.partyName)}</td>
                    <td style={{ padding: '0.25rem' }}>{renderInput(row.id, 'productName', row.productName)}</td>
                    <td style={{ padding: '0.25rem', fontWeight: 500 }}>{renderInput(row.id, 'receivedQty', row.receivedQty)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem', color: row.piNo === 'Pending' ? '#f59e0b' : 'var(--accent-primary)' }}>{renderInput(row.id, 'piNo', row.piNo)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem' }}>{renderInput(row.id, 'bprDate', row.bprDate)}</td>
                    <td style={{ padding: '0.25rem', fontWeight: 500 }}>{renderInput(row.id, 'bprNetQty', row.bprNetQty)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem' }}>{renderInput(row.id, 'dcNo', row.dcNo)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem' }}>{renderInput(row.id, 'dcDate', row.dcDate)}</td>
                    <td style={{ padding: '0.25rem' }}>{renderInput(row.id, 'dcNetQty', row.dcNetQty)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem', color: row.tiNo === 'Pending' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{renderInput(row.id, 'tiNo', row.tiNo)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem' }}>{renderInput(row.id, 'invoiceDate', row.invoiceDate)}</td>
                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{renderInput(row.id, 'totalBill', row.totalBill)}</td>
                    <td style={{ padding: '0.25rem', color: '#10b981', fontWeight: 600 }}>Γé╣{parseFloat(row.paid || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.25rem', color: '#10b981', fontWeight: 600 }}>{renderInput(row.id, 'manualPaid', row.manualPaid, { color: '#10b981' })}</td>
                    <td style={{ padding: '0.25rem' }}>{renderInput(row.id, 'paymentRef', row.paymentRef)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{renderInput(row.id, 'paymentDates', row.paymentDates)}</td>
                    <td style={{ padding: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.paymentAmounts || ''}>{renderInput(row.id, 'paymentAmounts', row.paymentAmounts)}</td>
                    <td style={{ padding: '0.25rem', fontWeight: 700, color: row.dueStatus === 'Overdue' ? '#ef4444' : row.dueStatus === '0' ? '#10b981' : '#f59e0b' }}>{renderInput(row.id, 'dueStatus', row.dueStatus)}</td>
                    <td style={{ padding: '0.25rem', color: row.outstanding > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>{renderInput(row.id, 'outstanding', row.outstanding)}</td>
                    <td style={{ padding: '0.25rem' }}>{renderInput(row.id, 'ewayStatus', row.ewayStatus)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProcessingSheet;
