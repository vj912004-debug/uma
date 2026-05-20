import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, CreditCard, DollarSign } from 'lucide-react';

const PartyDue = () => {
  const { data, updateData, setData } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    partyId: '',
    receiptId: '',
    amount: '',
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

  const recordPayment = (e) => {
    e.preventDefault();
    if (!paymentForm.partyId || !paymentForm.receiptId || !paymentForm.amount) {
      alert("Please enter all required fields.");
      return;
    }

    const newPayment = {
      ...paymentForm,
      id: Date.now().toString(),
      amount: parseFloat(paymentForm.amount) || 0
    };

    updateData('payments', newPayment);
    setIsModalOpen(false);
    setPaymentForm({
      partyId: '',
      receiptId: '',
      amount: '',
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
        const paymentsTotal = (data.payments || [])
          .filter(p => p.receiptId === mr.id)
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        const invoiceOutstanding = Math.max(0, ti.total - paymentsTotal);
        
        // Add to aging bucket
        if (invoiceDuesByFY.hasOwnProperty(fy)) {
          invoiceDuesByFY[fy] += invoiceOutstanding;
        } else {
          // Default to latest if outside these years
          invoiceDuesByFY['24-25'] += invoiceOutstanding;
        }
      }
    });

    const totalDue = Object.values(invoiceDuesByFY).reduce((s, v) => s + v, 0);

    return {
      id: party.id,
      name: party.name,
      ...invoiceDuesByFY,
      totalDue
    };
  });

  const filteredDues = partyRows.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Party Wise Outstanding</h1>
          <p style={{ color: 'var(--text-muted)' }}>Financial Year-wise aging report. Track unpaid commercial invoices and outstanding balances.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Record Cheque Payment
        </button>
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
                <th style={{ padding: '1rem' }}>Party Name</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Dues FY 21-22</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Dues FY 22-23</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Dues FY 23-24</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Dues FY 24-25</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'white' }}>Total Outstanding Dues</th>
              </tr>
            </thead>
            <tbody>
              {filteredDues.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No outstanding party balances.</td>
                </tr>
              ) : (
                filteredDues.map(party => (
                  <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'white' }}>{party.name}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party['21-22'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['21-22'] > 0 ? 600 : 400 }}>
                      ₹{party['21-22'].toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party['22-23'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['22-23'] > 0 ? 600 : 400 }}>
                      ₹{party['22-23'].toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party['23-24'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['23-24'] > 0 ? 600 : 400 }}>
                      ₹{party['23-24'].toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party['24-25'] > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: party['24-25'] > 0 ? 600 : 400 }}>
                      ₹{party['24-25'].toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: party.totalDue > 0 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{party.totalDue.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' }}>
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
                      const paidTotal = (data.payments || []).filter(p => p.receiptId === mr.id).reduce((s, p) => s + p.amount, 0);
                      const due = Math.max(0, (ti?.total || 0) - paidTotal);
                      return (
                        <option key={mr.id} value={mr.id}>
                          {mr.receiptNo} - {mr.productName} ({mr.date}) - Balance Due: ₹{due.toFixed(2)}
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
