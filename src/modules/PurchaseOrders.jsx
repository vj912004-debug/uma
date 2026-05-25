import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, Calendar, FileText } from 'lucide-react';

const PurchaseOrders = () => {
  const { data, updateData, updateItem, deleteDataSoftly } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    poNo: '',
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    productName: '',
    qty: '',
    rate: '',
    amount: '',
    status: 'Pending'
  });

  const handlePartySelect = (e) => {
    const party = data.parties.find(p => p.id === e.target.value);
    if (party) {
      setFormData(prev => ({ ...prev, partyId: party.id, partyName: party.name, productName: party.products?.[0]?.name || '' }));
    }
  };

  const calculateAmount = (q, r) => {
    const qty = parseFloat(q) || 0;
    const rate = parseFloat(r) || 0;
    return (qty * rate).toFixed(2);
  };

  const handleEdit = (po) => {
    setFormData(po);
    setIsEditing(po.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalPo = {
      ...formData,
      amount: calculateAmount(formData.qty, formData.rate)
    };

    if (isEditing) {
      updateItem('purchaseOrders', isEditing, { ...finalPo, id: isEditing });
    } else {
      updateData('purchaseOrders', { ...finalPo, id: Date.now().toString() });
    }
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const poList = (data.purchaseOrders || []).filter(po => !po.isDeleted);
  const filtered = poList.filter(po => 
    (po.poNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (po.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Purchase Orders</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track incoming POs from clients for job work.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); setFormData({...formData, poNo: `PO-${Date.now().toString().slice(-4)}`}); }}>
          <Plus size={18} /> Add PO
        </button>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by PO number or Party Name..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Date</th>
                <th>PO Number</th>
                <th>Party Name</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No Purchase Orders logged.</td></tr>
              ) : (
                filtered.map(po => (
                  <tr key={po.id}>
                    <td>{po.date}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{po.poNo}</td>
                    <td style={{ fontWeight: 600 }}>{po.partyName}</td>
                    <td>{po.productName}</td>
                    <td>{po.qty}</td>
                    <td style={{ fontWeight: 600 }}>{po.amount}</td>
                    <td>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        background: po.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: po.status === 'Completed' ? '#10b981' : '#f59e0b'
                      }}>
                        {po.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEdit(po)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => deleteDataSoftly('purchaseOrders', po.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '600px', maxWidth: '95%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit PO' : 'Add Purchase Order'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>PO Number *</label>
                  <input type="text" className="input-field" required value={formData.poNo} onChange={e => setFormData({...formData, poNo: e.target.value})} />
                </div>
                <div>
                  <label>PO Date *</label>
                  <input type="date" className="input-field" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Party *</label>
                  <select className="input-field" required value={formData.partyId} onChange={handlePartySelect}>
                    <option value="">-- Select --</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
                </div>
                <div>
                  <label>Status</label>
                  <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label>Quantity</label>
                  <input type="number" className="input-field" required value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} />
                </div>
                <div>
                  <label>Rate (₹)</label>
                  <input type="number" className="input-field" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Total Amount (₹)</label>
                  <input type="text" className="input-field" readOnly value={calculateAmount(formData.qty, formData.rate)} style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
