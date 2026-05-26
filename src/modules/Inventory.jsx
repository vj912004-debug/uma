import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Package, History, SlidersHorizontal, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const Inventory = () => {
  const { data, setData } = useAppContext();
  const [activeTab, setActiveTab] = useState('Register');
  const [adjustForm, setAdjustForm] = useState({ item: '', qty: '', type: 'Increase', reason: '' });

  // Calculate real-time stock
  const calculateStock = () => {
    const stock = {};
    
    // Add Opening Stock (simplified logic for demo)
    data.materialReceipts.forEach(mr => {
      stock[mr.productName] = (stock[mr.productName] || 0) + Number(mr.receivedQty);
    });

    // Subtract Issues/Sales
    data.invoices.forEach(inv => {
      inv.items.forEach(item => {
        stock[item.description] = (stock[item.description] || 0) - Number(item.qty);
      });
    });

    // Add/Sub Adjustments
    data.stockAdjustments.forEach(adj => {
      const multiplier = adj.type === 'Increase' ? 1 : -1;
      stock[adj.item] = (stock[adj.item] || 0) + (Number(adj.qty) * multiplier);
    });

    return stock;
  };

  const currentStock = calculateStock();

  const handleAdjust = (e) => {
    e.preventDefault();
    const newAdj = {
      ...adjustForm,
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0]
    };
    setData(prev => ({
      ...prev,
      stockAdjustments: [...prev.stockAdjustments, newAdj]
    }));
    setAdjustForm({ item: '', qty: '', type: 'Increase', reason: '' });
  };

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Inventory Management</h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time stock register and adjustments.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn" onClick={() => setActiveTab('Register')} style={{ background: activeTab === 'Register' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === 'Register' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
          <Package size={18} /> Stock Register
        </button>
        <button className="btn" onClick={() => setActiveTab('Adjust')} style={{ background: activeTab === 'Adjust' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === 'Adjust' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
          <SlidersHorizontal size={18} /> Stock Adjustment
        </button>
        <button className="btn" onClick={() => setActiveTab('History')} style={{ background: activeTab === 'History' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === 'History' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
          <History size={18} /> Adjustment History
        </button>
      </div>

      <div className="premium-card">
        {activeTab === 'Register' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem' }}>Item Name</th>
                  <th style={{ padding: '1rem' }}>Current Stock</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(currentStock).map(([item, qty]) => (
                  <tr key={item} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{item}</td>
                    <td style={{ padding: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>{qty}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem',
                        background: qty > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: qty > 0 ? '#10b981' : '#ef4444'
                      }}>
                        {qty > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Adjust' && (
          <form onSubmit={handleAdjust} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label>Select Item</label>
                <select className="input-field" required value={adjustForm.item} onChange={e => setAdjustForm({...adjustForm, item: e.target.value})}>
                  <option value="">Select Item</option>
                  {[...new Set([...data.items, ...data.materials, ...Object.keys(currentStock)])].map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Adjustment Type</label>
                  <select className="input-field" value={adjustForm.type} onChange={e => setAdjustForm({...adjustForm, type: e.target.value})}>
                    <option value="Increase">Increase (+)</option>
                    <option value="Decrease">Decrease (-)</option>
                  </select>
                </div>
                <div>
                  <label>Quantity</label>
                  <input type="number" className="input-field" required value={adjustForm.qty} onChange={e => setAdjustForm({...adjustForm, qty: e.target.value})} />
                </div>
              </div>
              <div>
                <label>Reason / Remarks</label>
                <textarea className="input-field" rows="3" required value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary">Process Adjustment</button>
            </div>
          </form>
        )}

        {activeTab === 'History' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Item</th>
                  <th style={{ padding: '1rem' }}>Type</th>
                  <th style={{ padding: '1rem' }}>Qty</th>
                  <th style={{ padding: '1rem' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.stockAdjustments.map(adj => (
                  <tr key={adj.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{formatDate(adj.date)}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{adj.item}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: adj.type === 'Increase' ? '#10b981' : '#ef4444' }}>
                        {adj.type === 'Increase' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                        {adj.type}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>{adj.qty}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{adj.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
