import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, FileMinus, FileDown } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF } from '../utils/pdfExport';

const DebitNotes = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    noteNo: '',
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    refInvoice: '',
    particulars: '',
    charges: {
      cleaning: false, filterBag: false, processing: false, sieving: false,
      psdReport: false, liner: false, courier: false, fiberDrum: false,
      transportation: false, hdpeDrum: false, batchChangeover: false,
      other: true
    },
    rates: {
      cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
      liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0,
      other: 0
    },
    qty: 1, // Default multiplier for rate
    discount: 0,
    taxRate: 18
  });

  const handlePartySelect = (e) => {
    const party = data.parties.find(p => p.id === e.target.value);
    if (party) {
      setForm(prev => ({ ...prev, partyId: party.id, partyName: party.name }));
    } else {
      setForm(prev => ({ ...prev, partyId: '', partyName: '' }));
    }
  };

  const handleOpenModal = () => {
    const serial = data.settings?.serials?.DN || 1;
    setForm({
      noteNo: generateDocNumber('DN', serial, new Date()),
      date: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      refInvoice: '',
      particulars: '',
      charges: {
        cleaning: false, filterBag: false, processing: false, sieving: false,
        psdReport: false, liner: false, courier: false, fiberDrum: false,
        transportation: false, hdpeDrum: false, batchChangeover: false,
        other: true
      },
      rates: {
        cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
        liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0,
        other: 0
      },
      qty: 1,
      discount: 0,
      taxRate: 18
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note) => {
    setForm(note);
    setIsEditing(note.id);
    setIsModalOpen(true);
  };

  const toggleCharge = (key) => {
    setForm(prev => ({
      ...prev,
      charges: { ...prev.charges, [key]: !prev.charges[key] }
    }));
  };

  const handleRateChange = (key, val) => {
    setForm(prev => ({
      ...prev,
      rates: { ...prev.rates, [key]: parseFloat(val) || 0 }
    }));
  };

  const getSubtotal = () => {
    return Object.keys(form.charges).reduce((sum, key) => {
      if (form.charges[key]) {
        const isQtyRate = ['processing', 'sieving', 'cleaning', 'other'].includes(key);
        const qty = parseFloat(form.qty) || 1;
        const rate = form.rates[key] || 0;
        return sum + (isQtyRate ? qty * rate : rate);
      }
      return sum;
    }, 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = getSubtotal();
    const discountAmount = parseFloat(form.discount) || 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxable * (form.taxRate / 100);
    const total = taxable + taxAmount;

    const finalDoc = {
      ...form,
      subtotal,
      taxAmount,
      amount: total // Use amount as final total for compatibility
    };

    if (isEditing) {
      updateItem('debitNotes', isEditing, { ...finalDoc, id: isEditing });
    } else {
      updateData('debitNotes', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('DN');
    }
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const notesList = (data.debitNotes || []).filter(n => !n.isDeleted);
  const filtered = notesList.filter(n => 
    (n.noteNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chargesList = [
    { key: 'cleaning', label: 'Cleaning Charges (998842)', isQtyRate: true },
    { key: 'filterBag', label: 'Filter Bag Charges (591190)', isQtyRate: false },
    { key: 'processing', label: 'Processing Charges (998842)', isQtyRate: true },
    { key: 'sieving', label: 'Sieving Charges (998842)', isQtyRate: true },
    { key: 'psdReport', label: 'PSD Report Charges (998346)', isQtyRate: false },
    { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
    { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
    { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
    { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
    { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
    { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false },
    { key: 'other', label: 'Other Particulars', isQtyRate: true }
  ];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Debit Notes</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage financial debit notes with GST calculations.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Add Debit Note
        </button>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by Note No or Party Name..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Note Number</th>
                <th>Party Name</th>
                <th>Ref Invoice</th>
                <th>Particulars</th>
                <th>Amount (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No Debit Notes logged.</td></tr>
              ) : (
                filtered.map(note => (
                  <tr key={note.id}>
                    <td>{formatDate(note.date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{note.noteNo}</td>
                    <td style={{ fontWeight: 600 }}>{note.partyName}</td>
                    <td>{note.refInvoice || '-'}</td>
                    <td>{note.particulars}</td>
                    <td style={{ fontWeight: 600 }}>₹{parseFloat(note.amount || 0).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => exportToPDF('DN', note)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={16} /></button>
                        <button onClick={() => handleEdit(note)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => deleteItemSoftly('debitNotes', note.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit Debit Note' : 'Create Debit Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Note Number *</label>
                  <input type="text" className="input-field" required value={form.noteNo} onChange={e => setForm({...form, noteNo: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Party *</label>
                  <select className="input-field" required value={form.partyId} onChange={handlePartySelect}>
                    <option value="">-- Select --</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ref Invoice (Optional)</label>
                  <input type="text" className="input-field" value={form.refInvoice} onChange={e => setForm({...form, refInvoice: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Particulars / Reason *</label>
                  <textarea className="input-field" rows="1" required value={form.particulars} onChange={e => setForm({...form, particulars: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Quantity / Multiplier</label>
                  <input type="number" className="input-field" required value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '0.5rem' }}>Debit Note Charges Grid</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chargesList.map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                          <input type="checkbox" checked={form.charges[item.key] || false} onChange={() => toggleCharge(item.key)} />
                          {item.label}
                        </label>
                        {form.charges[item.key] && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.isQtyRate ? 'per unit' : 'flat'}:</span>
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ width: '80px', padding: '0.2rem', fontSize: '0.8rem', height: 'auto' }}
                              value={form.rates[item.key] || 0} 
                              onChange={e => handleRateChange(item.key, e.target.value)} 
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation Summary */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>GST Tax Calculations</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>₹{getSubtotal().toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>Discount (₹):</span>
                    <input type="number" className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.discount} onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>GST Rate (%):</span>
                    <select className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.taxRate} onChange={e => setForm({...form, taxRate: parseInt(e.target.value) || 0})}>
                      <option value="18">18%</option>
                      <option value="12">12%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>CGST @{(form.taxRate / 2)}%:</span>
                    <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>SGST @{(form.taxRate / 2)}%:</span>
                    <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>
                    <span>Grand Total:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Debit Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebitNotes;
