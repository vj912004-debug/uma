import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, CreditCard } from 'lucide-react';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getReceiptPaymentTotal, hasSheetOverride } from '../utils/paymentTotals';

const PartyDue = () => {
  const { data, updateData, setData, updateItem } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    partyId: '',
    receiptId: '',
    amount: '',
    tds: '',
    date: new Date().toISOString().split('T')[0],
    chequeNo: '',
    bankName: '',
    notes: 'Cheque received against outstanding dues.'
  });

  const selectedPartyReceipts = data.materialReceipts.filter(mr => 
    mr.partyId === paymentForm.partyId && 
    (data.invoices || []).some(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'))
  );

  // Helper to determine the Financial Year (FY) string based on a date string
  const getFYOfDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed, 3 = April
      
      let fyStart, fyEnd;
      if (month >= 3) {
        fyStart = year;
        fyEnd = year + 1;
      } else {
        fyStart = year - 1;
        fyEnd = year;
      }
      return `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;
    } catch {
      return '24-25';
    }
  };

  const handleCellChange = (partyId, fy, value) => {
    const party = data.parties.find(p => p.id === partyId);
    if (!party) return;
    const currentOverrides = party.dueOverrides || {};
    updateItem('parties', partyId, {
      ...party,
      dueOverrides: { ...currentOverrides, [fy]: value }
    });
  };

  const recordPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.partyId || !paymentForm.receiptId || !paymentForm.amount) {
      alert("Please enter all required fields.");
      return;
    }

    const party = data.parties.find(p => p.id === paymentForm.partyId);
    const mr = data.materialReceipts.find(m => m.id === paymentForm.receiptId);

    const newPayment = {
      ...paymentForm,
      id: Date.now().toString(),
      amount: parseFloat(paymentForm.amount) || 0,
      tds: parseFloat(paymentForm.tds) || 0
    };

    updateData('payments', newPayment);

    // Clear stale manual overrides so balances recalculate from payments
    if (party?.dueOverrides && Object.keys(party.dueOverrides).length > 0) {
      updateItem('parties', party.id, { ...party, dueOverrides: {} });
    }
    if (mr?.sheetOverrides) {
      const nextOverrides = { ...mr.sheetOverrides };
      ['outstanding', 'manualPaid', 'dueStatus', 'tdsDeduction', 'paymentDates', 'paymentAmounts'].forEach((key) => {
        delete nextOverrides[key];
      });
      if (Object.keys(nextOverrides).length !== Object.keys(mr.sheetOverrides).length) {
        updateItem('materialReceipts', mr.id, { ...mr, sheetOverrides: nextOverrides });
      }
    }

    setIsModalOpen(false);
    setPaymentForm({
      partyId: '',
      receiptId: '',
      amount: '',
      tds: '',
      date: new Date().toISOString().split('T')[0],
      chequeNo: '',
      bankName: '',
      notes: 'Cheque received against outstanding dues.'
    });
  };

  // Compile Aging Data by Party
  const partyRows = data.parties.map(party => {
    const partyReceipts = data.materialReceipts.filter(r => r.partyId === party.id);
    const invoiceDuesByFY = {
      '21-22': 0,
      '22-23': 0,
      '23-24': 0,
      '24-25': 0
    };

    partyReceipts.forEach(mr => {
      // Find TI for this receipt
      const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
      if (ti) {
        const fy = getFYOfDate(ti.date);
        const paymentsTotal = getReceiptPaymentTotal(data.payments, mr.id);
        
        const invoiceOutstanding = Math.max(0, (parseFloat(ti.total) || 0) - paymentsTotal);
        
        // Add to aging bucket
        if (invoiceDuesByFY.hasOwnProperty(fy)) {
          invoiceDuesByFY[fy] += invoiceOutstanding;
        } else {
          // Default to latest if outside these years
          invoiceDuesByFY['24-25'] += invoiceOutstanding;
        }
      }
    });

    const o = party.dueOverrides || {};
    
    const final21 = hasSheetOverride(o, '21-22') ? parseFloat(o['21-22']) || 0 : invoiceDuesByFY['21-22'];
    const final22 = hasSheetOverride(o, '22-23') ? parseFloat(o['22-23']) || 0 : invoiceDuesByFY['22-23'];
    const final23 = hasSheetOverride(o, '23-24') ? parseFloat(o['23-24']) || 0 : invoiceDuesByFY['23-24'];
    const final24 = hasSheetOverride(o, '24-25') ? parseFloat(o['24-25']) || 0 : invoiceDuesByFY['24-25'];

    const totalDue = final21 + final22 + final23 + final24;

    return {
      id: party.id,
      name: party.name,
      '21-22': final21,
      '22-23': final22,
      '23-24': final23,
      '24-25': final24,
      totalDue
    };
  });

  const filteredDues = partyRows.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(s);

    let matchesColumnFilters = true;
    for (const [key, filterVal] of Object.entries(columnFilters)) {
      if (filterVal) {
        const rowVal = String(p[key] || '').toLowerCase();
        if (!rowVal.includes(filterVal.toLowerCase())) {
          matchesColumnFilters = false;
          break;
        }
      }
    }

    return matchesSearch && matchesColumnFilters;
  });

  const tableCols = [
    { key: 'name', label: 'Party Name' },
    { key: '21-22', label: 'Dues FY 21-22' },
    { key: '22-23', label: 'Dues FY 22-23' },
    { key: '23-24', label: 'Dues FY 23-24' },
    { key: '24-25', label: 'Dues FY 24-25' },
    { key: 'totalDue', label: 'Total Outstanding Dues' }
  ];

  const renderInput = (partyId, fy, value, isTotal = false) => {
    if (isTotal) return `₹${parseFloat(value || 0).toFixed(2)}`;
    return (
      <input
        type="number"
        value={value === 0 ? '' : value}
        placeholder="0.00"
        onChange={(e) => handleCellChange(partyId, fy, e.target.value)}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: 'inherit',
          width: '100%',
          textAlign: 'right',
          fontSize: 'inherit',
          outline: 'none',
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          padding: '0.2rem',
          transition: 'all 0.2s ease',
        }}
        onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-primary)'}
        onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
      />
    );
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Party Wise Outstanding</h1>
          <p style={{ color: 'var(--text-muted)' }}>Financial Year-wise aging report. Track unpaid commercial invoices and outstanding balances.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredDues} columns={tableCols} filename="Party_Outstanding_Dues" title="Party Wise Outstanding" />
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Record Cheque Payment
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search customer outstanding ledger..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {tableCols.map(col => (
                  <th key={col.key} style={{ padding: '1rem', textAlign: col.key === 'name' ? 'left' : 'right' }}>
                    {col.label}
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
                      style={{ width: '100%', fontSize: '0.75rem', padding: '0.2rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px' }} 
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={tableCols.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No outstanding party balances.</td>
                </tr>
              ) : (
                filteredDues.map(party => (
                  <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>{party.name}</td>
                    <td style={{ padding: '0.5rem', color: party['21-22'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['21-22'] > 0 ? 600 : 400 }}>
                      {renderInput(party.id, '21-22', party['21-22'])}
                    </td>
                    <td style={{ padding: '0.5rem', color: party['22-23'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['22-23'] > 0 ? 600 : 400 }}>
                      {renderInput(party.id, '22-23', party['22-23'])}
                    </td>
                    <td style={{ padding: '0.5rem', color: party['23-24'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['23-24'] > 0 ? 600 : 400 }}>
                      {renderInput(party.id, '23-24', party['23-24'])}
                    </td>
                    <td style={{ padding: '0.5rem', color: party['24-25'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['24-25'] > 0 ? 600 : 400 }}>
                      {renderInput(party.id, '24-25', party['24-25'])}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party.totalDue > 0 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '0.95rem' }}>
                      {renderInput(party.id, 'totalDue', party.totalDue, true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' }}>
          <div className="premium-card" style={{ width: '600px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard style={{ color: 'var(--accent-primary)' }} />
              Record Cheque Payment Receipt
            </h2>
            <form onSubmit={recordPayment}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Party Customer *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={paymentForm.partyId}
                    onChange={e => setPaymentForm({...paymentForm, partyId: e.target.value, receiptId: ''})}
                  >
                    <option value="">Choose Party</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Invoiced Material Receipt *</label>
                  <select 
                    className="input-field" 
                    required 
                    disabled={!paymentForm.partyId}
                    value={paymentForm.receiptId}
                    onChange={e => setPaymentForm({...paymentForm, receiptId: e.target.value})}
                  >
                    <option value="">Choose Invoiced Batch</option>
                    {selectedPartyReceipts.map(mr => {
                      const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
                      const paidTotal = getReceiptPaymentTotal(data.payments, mr.id);
                      const due = Math.max(0, (parseFloat(ti?.total) || 0) - paidTotal);
                      return (
                        <option key={mr.id} value={mr.id}>
                          {mr.receiptNo} - {mr.productName} ({formatDate(mr.date)}) - Balance Due: ₹{due.toFixed(2)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label>Payment Date *</label>
                  <input type="date" className="input-field" required value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} />
                </div>
                <div>
                  <label>Cheque Amount Received (₹) *</label>
                  <input type="number" step="0.01" className="input-field" required placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                </div>
                <div>
                  <label>TDS (₹)</label>
                  <input type="number" step="0.01" className="input-field" placeholder="0.00" value={paymentForm.tds} onChange={e => setPaymentForm({...paymentForm, tds: e.target.value})} />
                </div>

                <div>
                  <label>Cheque / DD Number</label>
                  <input type="text" className="input-field" placeholder="e.g. 091823" value={paymentForm.chequeNo} onChange={e => setPaymentForm({...paymentForm, chequeNo: e.target.value})} />
                </div>
                <div>
                  <label>Drawer Bank Name</label>
                  <input type="text" className="input-field" placeholder="e.g. HDFC Bank" value={paymentForm.bankName} onChange={e => setPaymentForm({...paymentForm, bankName: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Reconciliation Notes</label>
                  <input type="text" className="input-field" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Reconcile Dues</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyDue;
