import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Edit2 } from 'lucide-react';

const EWayTI = () => {
  const { data, updateItem } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [form, setForm] = useState({
    ewayBillNo: '',
    ewayBillDate: new Date().toISOString().split('T')[0]
  });

  const handleEdit = (inv) => {
    setSelectedInvoice(inv);
    setForm({
      ewayBillNo: inv.ewayBillNo || '',
      ewayBillDate: inv.ewayBillDate || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateItem('invoices', selectedInvoice.id, {
      ...selectedInvoice,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate
    });
    setIsModalOpen(false);
  };

  const filteredInvoices = (data.invoices || []).filter(inv => 
    inv.invoiceNo?.includes('/IN/') &&
    (inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.partyName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>E-Way Bills (Tax Invoice)</h1>
        <p style={{ color: 'var(--text-muted)' }}>Link government E-Way bills directly with commercial Tax Invoices.</p>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by Invoice No, customer or E-Way No..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Invoice No</th>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Material Qty</th>
                <th style={{ padding: '1rem' }}>E-Way Bill Status</th>
                <th style={{ padding: '1rem' }}>E-Way Bill Details</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No Tax Invoices found.</td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{inv.invoiceNo}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{inv.partyName}</td>
                    <td style={{ padding: '1rem' }}>{inv.qty} Kg</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem',
                        background: inv.ewayBillNo ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: inv.ewayBillNo ? '#10b981' : '#f59e0b',
                        fontWeight: 600
                      }}>
                        {inv.ewayBillNo ? 'Logged' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {inv.ewayBillNo ? (
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>No: {inv.ewayBillNo}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {inv.ewayBillDate}</p>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not yet linked</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => handleEdit(inv)}>
                        <Edit2 size={12} /> {inv.ewayBillNo ? 'Edit' : 'Link E-Way'}
                      </button>
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
          <div className="premium-card" style={{ width: '550px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Link government E-Way Bill to Invoice</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Tax Invoice Associated</label>
                  <input type="text" className="input-field" readOnly value={selectedInvoice?.invoiceNo} style={{ fontWeight: 600 }} />
                </div>
                <div>
                  <label>E-Way Bill Number *</label>
                  <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
                </div>
                <div>
                  <label>E-Way Bill Date *</label>
                  <input type="date" className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Link E-Way Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EWayTI;
