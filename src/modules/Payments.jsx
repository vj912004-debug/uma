import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, CreditCard, Banknote, Calendar, Search } from 'lucide-react';

const Payments = () => {
  const { data, updateData, updateItem } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    invoiceId: '',
    amount: 0,
    tds: 0,
    paymentMode: 'Bank Transfer',
    referenceNo: '', // Cheque or UTR
    remarks: ''
  });

  const handlePayment = (inv) => {
    setSelectedInvoice(inv);
    setFormData({
      ...formData,
      invoiceId: inv.id,
      amount: inv.total
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newPayment = {
      ...formData,
      id: Date.now().toString(),
      partyName: selectedInvoice.partyName,
      invoiceNo: selectedInvoice.invoiceNo,
      receiptId: selectedInvoice.receiptId || '' // for processing sheet reconciliation
    };
    updateData('payments', newPayment);
    
    // Update invoice status based on cumulative payments
    const paidTotal = (data.payments || [])
      .filter(p => p.invoiceId === selectedInvoice.id)
      .reduce((s, p) => s + (parseFloat(p.amount) || 0) + (parseFloat(p.tds) || 0), 0)
      + (parseFloat(formData.amount) || 0) + (parseFloat(formData.tds) || 0);

    const nextStatus = paidTotal >= (parseFloat(selectedInvoice.total) || 0) ? 'Paid' : 'Unpaid';
    updateItem('invoices', selectedInvoice.id, { ...selectedInvoice, status: nextStatus });
    
    setIsModalOpen(false);
  };

  // Group by Party for the Due Dashboard
  const partyDues = data.parties.map(party => {
    const partyInvoices = data.invoices.filter(inv => inv.partyName === party.name);
    const unpaid = partyInvoices.filter(inv => inv.status === 'Unpaid');
    const totalDue = unpaid.reduce((acc, inv) => acc + inv.total, 0);
    
    // Logic for FY-wise grouping (simplified)
    const dueByFY = unpaid.reduce((acc, inv) => {
      const fy = inv.invoiceNo.split('/')[2];
      acc[fy] = (acc[fy] || 0) + inv.total;
      return acc;
    }, {});

    return { party, totalDue, dueByFY };
  }).filter(d => d.totalDue > 0);

  const paymentHistory = (data.payments || []).slice().reverse().filter(p => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (p.partyName || '').toLowerCase().includes(s) ||
      (p.invoiceNo || '').toLowerCase().includes(s) ||
      (p.referenceNo || '').toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Financial Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Track outstanding payments and record transactions.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Party-Wise Dues</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Party Name</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Total Due</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Breakdown by FY</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {partyDues.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Great! No outstanding dues.</td></tr>
                ) : (
                  partyDues.map(({ party, totalDue, dueByFY }) => (
                    <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{party.name}</td>
                      <td style={{ padding: '1rem', color: '#ef4444', fontWeight: 700 }}>₹{totalDue.toLocaleString()}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {Object.entries(dueByFY).map(([fy, amount]) => (
                            <span key={fy} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--glass-bg)', borderRadius: '4px' }}>
                              FY {fy}: ₹{amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button className="btn" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', background: 'var(--accent-primary)', color: 'var(--text-main)' }} onClick={() => {
                          const firstUnpaid = data.invoices.find(inv => inv.partyName === party.name && inv.status === 'Unpaid');
                          if (firstUnpaid) handlePayment(firstUnpaid);
                        }}>
                          Pay Now
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Payment History</h3>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input
              type="text"
              className="input-field"
              placeholder="Search party, invoice, reference..."
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {paymentHistory.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No payments recorded.</p>
            ) : (
              paymentHistory.slice(0, 12).map(pay => (
                <div key={pay.id} style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', borderLeft: '4px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <p style={{ fontWeight: 600 }}>{pay.partyName}</p>
                    <p style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                      ₹{(parseFloat(pay.amount) || 0).toLocaleString()} {pay.tds ? <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8rem' }}>(TDS ₹{(parseFloat(pay.tds) || 0).toLocaleString()})</span> : null}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{pay.invoiceNo}</span>
                    <span>{formatDate(pay.date)}</span>
                  </div>
                  {(pay.paymentMode || pay.referenceNo) && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {pay.paymentMode ? `${pay.paymentMode}` : ''}{pay.referenceNo ? ` • Ref: ${pay.referenceNo}` : ''}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="premium-card" style={{ width: '500px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Record Payment</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label>Invoice</label>
                  <input type="text" className="input-field" value={`${selectedInvoice?.invoiceNo} - ${selectedInvoice?.partyName}`} readOnly />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label>Amount (₹)</label>
                    <input type="number" className="input-field" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                  <div>
                    <label>Date</label>
                    <input type="date" className="input-field" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label>TDS (₹)</label>
                  <input type="number" className="input-field" value={formData.tds} onChange={e => setFormData({ ...formData, tds: e.target.value })} />
                </div>
                <div>
                  <label>Payment Mode</label>
                  <select className="input-field" value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})}>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label>Reference No (UTR / Cheque No)</label>
                  <input type="text" className="input-field" placeholder="Enter reference number..." value={formData.referenceNo} onChange={e => setFormData({...formData, referenceNo: e.target.value})} />
                </div>
                <div>
                  <label>Remarks</label>
                  <input type="text" className="input-field" placeholder="Optional" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
