import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, CreditCard } from 'lucide-react';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getReceiptOutstanding, hasSheetOverride } from '../utils/paymentTotals';
import { getCurrentFYKey, getFYKeysThroughCurrent, getFYOfDate } from '../utils/financialYear';
import { useNavigate } from 'react-router-dom';

const PartyDue = () => {
  const { data, updateData, updateItem } = useAppContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const fyKeys = useMemo(() => getFYKeysThroughCurrent('21-22'), []);
  const currentFY = useMemo(() => getCurrentFYKey(), []);

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

  const handleCellChange = (partyId, fy, value) => {
    const party = data.parties.find(p => p.id === partyId);
    if (!party) return;
    const currentOverrides = party.dueOverrides || {};
    // Empty input = explicit 0 so clearing a cell does not snap back to invoice-calculated dues
    const nextVal = value === '' || value === null || value === undefined ? '0' : value;
    updateItem('parties', partyId, {
      ...party,
      dueOverrides: { ...currentOverrides, [fy]: nextVal }
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
    const invoiceDuesByFY = Object.fromEntries(fyKeys.map((k) => [k, 0]));

    partyReceipts.forEach(mr => {
      // Find TI for this receipt
      const ti = (data.invoices || []).find(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/IN/'));
      const hasBillOverride = hasSheetOverride(mr.sheetOverrides || {}, 'totalBill');
      if (!ti && !hasBillOverride) return;

      // Processing Sheet "Total Recd (Manual)" / Outstanding feed Party Due automatically
      const invoiceOutstanding = getReceiptOutstanding(mr, ti, data.payments);
      const fy = getFYOfDate(ti?.date || mr.date || mr.sheetOverrides?.invoiceDate);

      // Add to aging bucket (overflow → current FY)
      if (Object.prototype.hasOwnProperty.call(invoiceDuesByFY, fy)) {
        invoiceDuesByFY[fy] += invoiceOutstanding;
      } else {
        invoiceDuesByFY[currentFY] += invoiceOutstanding;
      }
    });

    const o = party.dueOverrides || {};
    const finals = {};
    let totalDue = 0;
    fyKeys.forEach((fy) => {
      const amount = hasSheetOverride(o, fy) ? (parseFloat(o[fy]) || 0) : invoiceDuesByFY[fy];
      finals[fy] = amount;
      totalDue += amount;
    });

    return {
      id: party.id,
      name: party.name,
      ...finals,
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
    ...fyKeys.map((fy) => ({ key: fy, label: `Dues FY ${fy}` })),
    { key: 'totalDue', label: 'Total Outstanding Dues' }
  ];

  const renderInput = (partyId, fy, value, isTotal = false) => {
    if (isTotal) return `₹${parseFloat(value || 0).toFixed(2)}`;
    return (
      <input
        type="number"
        min="0"
        step="0.01"
        value={Number.isFinite(Number(value)) ? value : 0}
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
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      <button 
                        onClick={() => navigate('/processing-sheet', { state: { partyName: party.name } })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        title={`View ${party.name} in Processing Sheet`}
                      >
                        {party.name}
                      </button>
                    </td>
                    {fyKeys.map((fy) => (
                      <td
                        key={fy}
                        style={{
                          padding: '0.5rem',
                          color: party[fy] > 0 ? '#ef4444' : 'var(--text-muted)',
                          fontWeight: party[fy] > 0 ? 600 : 400
                        }}
                      >
                        {renderInput(party.id, fy, party[fy])}
                      </td>
                    ))}
                    <td style={{ padding: '1rem', textAlign: 'right', color: party.totalDue > 0 ? '#ef4444' : 'var(--status-done-text)', fontWeight: 700, fontSize: '0.95rem' }}>
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
                      let due = (parseFloat(ti?.total) || 0) - paidTotal;
                      if (due < 0.01) due = 0;
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
