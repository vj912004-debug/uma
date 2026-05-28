import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Plus, Trash2, Calculator, Save, FileText } from 'lucide-react';

const STANDARD_CHARGES = [
  { name: 'Cleaning Charges', hsn: '9988', rate: 500 },
  { name: 'Sieving Charges', hsn: '9988', rate: 300 },
  { name: 'Filter Bag Charges', hsn: '9988', rate: 150 },
  { name: 'Handling Charges', hsn: '9988', rate: 200 }
];

const Invoices = () => {
  const { data, updateData, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPL, setSelectedPL] = useState(null);
  
  const [formData, setFormData] = useState({
    invoiceNo: '',
    type: 'Tax Invoice', // or 'Proforma Invoice'
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    items: [],
    taxRate: 18,
    discount: 0
  });

  const handleCreateInvoice = (pl) => {
    const typeKey = formData.type === 'Tax Invoice' ? 'TI' : 'PI';
    const nextSerial = data.settings.serials[typeKey] || 1;
    
    setSelectedPL(pl);
    setFormData({
      ...formData,
      invoiceNo: formData.type === 'Tax Invoice'
        ? generateDocNumber('IN', nextSerial)
        : generateDocNumber('PI', nextSerial),
      partyName: pl.partyName,
      items: [
        { 
          description: pl.productName, 
          hsn: '2827', // Example chemical HSN
          qty: pl.totalWeight, 
          rate: 0, 
          amount: 0 
        }
      ]
    });
    setIsModalOpen(true);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', hsn: '', qty: 1, rate: 0, amount: 0 }]
    });
  };

  const addStandardCharge = (charge) => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: charge.name, hsn: charge.hsn, qty: 1, rate: charge.rate, amount: charge.rate }]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'qty' || field === 'rate') {
      newItems[index].amount = Number(newItems[index].qty) * Number(newItems[index].rate);
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => formData.items.reduce((acc, item) => acc + (item.amount || 0), 0);
  const calculateTax = () => (calculateSubtotal() - formData.discount) * (formData.taxRate / 100);
  const calculateTotal = () => calculateSubtotal() - formData.discount + calculateTax();

  const handleSubmit = (e) => {
    e.preventDefault();
    const typeKey = formData.type === 'Tax Invoice' ? 'TI' : 'PI';
    const newInvoice = {
      ...formData,
      id: Date.now().toString(),
      subtotal: calculateSubtotal(),
      taxAmount: calculateTax(),
      total: calculateTotal(),
      plId: selectedPL?.id,
      status: 'Unpaid'
    };
    updateData('invoices', newInvoice);
    incrementSerial(typeKey);
    setIsModalOpen(false);
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Invoices & PI</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate tax and proforma invoices with automated charges.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem' }}>Ready for Billing</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a Packing List to invoice.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.packingLists.filter(pl => !data.invoices.some(inv => inv.plId === pl.id)).length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No pending packing lists.</p>
            ) : (
              data.packingLists.filter(pl => !data.invoices.some(inv => inv.plId === pl.id)).map(pl => (
                <div key={pl.id} className="glass-panel" style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleCreateInvoice(pl)}>
                  <p style={{ fontWeight: 600, color: '#8b5cf6' }}>{pl.plNo}</p>
                  <p style={{ fontSize: '0.875rem' }}>{pl.partyName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pl.productName} - {pl.totalWeight} Kg</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Invoice History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Inv No</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Party</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No invoices found.</td></tr>
                ) : (
                  data.invoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '1rem' }}>{inv.partyName}</td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>₹{inv.total.toLocaleString()}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.25rem 0.5rem', background: inv.status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: inv.status === 'Paid' ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {inv.status}
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

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}>
          <div className="premium-card" style={{ width: '1000px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div>
                <h2>{formData.type}: {formData.invoiceNo}</h2>
                <p style={{ color: 'var(--text-muted)' }}>Billing for {formData.partyName}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="input-field" style={{ width: 'auto' }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="Tax Invoice">Tax Invoice</option>
                  <option value="Proforma Invoice">Proforma Invoice</option>
                </select>
                <button className="btn btn-primary" onClick={handleSubmit}><Save size={18} /> Save Invoice</button>
                <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <label>Date</label>
                <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div>
                <label>GST Rate (%)</label>
                <input type="number" className="input-field" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: e.target.value})} />
              </div>
              <div>
                <label>Discount (₹)</label>
                <input type="number" className="input-field" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: 'var(--text-muted)' }}>Standard Charges</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {STANDARD_CHARGES.map(charge => (
                    <button key={charge.name} className="btn" style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)' }} onClick={() => addStandardCharge(charge)}>
                      + {charge.name}
                    </button>
                  ))}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem' }}>Description</th>
                    <th style={{ padding: '0.75rem' }}>HSN</th>
                    <th style={{ padding: '0.75rem' }}>Qty</th>
                    <th style={{ padding: '0.75rem' }}>Rate</th>
                    <th style={{ padding: '0.75rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="text" className="input-field" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '120px' }}>
                        <input type="text" className="input-field" value={item.hsn} onChange={e => updateItem(index, 'hsn', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '100px' }}>
                        <input type="number" className="input-field" value={item.qty} onChange={e => updateItem(index, 'qty', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '150px' }}>
                        <input type="number" className="input-field" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem', width: '150px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{(item.amount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem', width: '50px' }}>
                        <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeItem(index)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', width: '100%' }} onClick={addItem}>
                <Plus size={18} /> Add Miscellaneous Item
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                  <span>₹{calculateSubtotal().toLocaleString()}</span>
                </div>
                {formData.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Discount</span>
                    <span>- ₹{formData.discount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GST ({formData.taxRate}%)</span>
                  <span>₹{calculateTax().toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--accent-primary)' }}>
                  <span>Total</span>
                  <span>₹{calculateTotal().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
