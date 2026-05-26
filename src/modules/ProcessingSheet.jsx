import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

const ProcessingSheet = () => {
  const { data } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Table Helpers to retrieve downstream details
  const getPI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/PI/'));
  const getBPR = (mrId) => (data.bprs || []).find(b => b.receiptId === mrId);
  const getDC = (mrId) => (data.deliveryChallans || []).find(dc => dc.receiptId === mrId);
  const getTI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/IN/'));

  const getPaymentsReceived = (mrId) => {
    return (data.payments || [])
      .filter(p => p.receiptId === mrId)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  // Compile row data
  const rows = data.materialReceipts.map((mr, idx) => {
    const pi = getPI(mr.id);
    const bpr = getBPR(mr.id);
    const dc = getDC(mr.id);
    const ti = getTI(mr.id);
    const totalBill = ti?.total || 0;
    const paid = getPaymentsReceived(mr.id);
    const outstanding = Math.max(0, totalBill - paid);
    
    // E-Way status
    let ewayStatus = 'Pending';
    if (dc?.ewayBillNo || ti?.ewayBillNo) {
      ewayStatus = 'Done';
    }

    return {
      id: mr.id,
      srNo: idx + 1,
      date: mr.date,
      partyName: mr.partyName,
      productName: mr.productName,
      receivedQty: parseFloat(mr.totalQty) || 0,
      piNo: pi?.invoiceNo || 'Pending',
      bprNetQty: bpr?.totalDispatchedNet || 0,
      dcNo: dc?.dcNo || 'Pending',
      dcNetQty: dc?.qty || 0,
      tiNo: ti?.invoiceNo || 'Pending',
      totalBill,
      paid,
      outstanding,
      ewayStatus
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

  const filteredRows = sortedRows.filter(row => 
    row.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.tiNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Excel Processing Sheet</h1>
        <p style={{ color: 'var(--text-muted)' }}>Complete end-to-end master spreadsheet tracking customer materials from receipt to payment reconciliation.</p>
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
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('srNo')}>
                  Sr No <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('date')}>
                  M.R. Date <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('partyName')}>
                  Party Name <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('productName')}>
                  Product <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('receivedQty')}>
                  Recd Qty <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem' }}>PI No</th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('bprNetQty')}>
                  Milled Qty <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem' }}>DC No</th>
                <th style={{ padding: '0.75rem' }}>DC Qty</th>
                <th style={{ padding: '0.75rem' }}>Tax Inv No</th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('totalBill')}>
                  Bill Amount <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('paid')}>
                  Payment Recd <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleSort('outstanding')}>
                  Outstanding <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                </th>
                <th style={{ padding: '0.75rem' }}>E-Way</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="14" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No master logs recorded in this spreadsheet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{row.srNo}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDate(row.date)}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: 'white' }}>{row.partyName}</td>
                    <td style={{ padding: '0.75rem' }}>{row.productName}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.receivedQty} Kg</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: row.piNo === 'Pending' ? '#f59e0b' : 'var(--accent-primary)' }}>{row.piNo}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.bprNetQty ? `${row.bprNetQty.toFixed(1)} Kg` : '0'}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>{row.dcNo}</td>
                    <td style={{ padding: '0.75rem' }}>{row.dcNetQty ? `${row.dcNetQty} Kg` : '0'}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: row.tiNo === 'Pending' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>{row.tiNo}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>₹{row.totalBill.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', color: '#10b981', fontWeight: 600 }}>₹{row.paid.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', color: row.outstanding > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>₹{row.outstanding.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        background: row.ewayStatus === 'Done' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: row.ewayStatus === 'Done' ? '#10b981' : '#f59e0b',
                        fontWeight: 600
                      }}>
                        {row.ewayStatus}
                      </span>
                    </td>
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
