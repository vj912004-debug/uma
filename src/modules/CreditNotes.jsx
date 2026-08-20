import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import {Eye,  Plus, Search, Edit2, Trash2, FileDown } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM
} from '../utils/documentCharges';

const blankLine = () => ({ id: Date.now() + Math.random(), description: '', qty: 1, rate: 0 });

const linesFromNote = (note) => {
  if (Array.isArray(note.customCharges) && note.customCharges.length) {
    return note.customCharges.map((c) => ({
      id: c.id || Date.now() + Math.random(),
      description: c.description || '',
      qty: c.qty ?? 1,
      rate: c.rate ?? 0
    }));
  }
  const migrated = [];
  [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM].forEach((c) => {
    if (!note.charges?.[c.key]) return;
    migrated.push({
      id: `${c.key}-${Date.now()}`,
      description: c.label || c.key,
      qty: parseFloat(note.qtys?.[c.key]) || 1,
      rate: parseFloat(note.rates?.[c.key]) || 0
    });
  });
  return migrated.length ? migrated : [blankLine()];
};

const CreditNotes = () => {
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
    refInvoiceDate: '',
    poNo: '',
    reference: '',
    reason: '',
    particulars: '',
    customCharges: [blankLine()],
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
    const serial = data.settings?.serials?.CN || 1;
    setForm({
      noteNo: generateDocNumber('CN', serial, new Date()),
      date: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      refInvoice: '',
      refInvoiceDate: '',
      poNo: '',
      reference: '',
      reason: '',
      particulars: '',
      customCharges: [blankLine()],
      discount: 0,
      taxRate: 18
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note) => {
    setForm({
      ...note,
      customCharges: linesFromNote(note),
      discount: note.discount || 0,
      taxRate: note.taxRate ?? 18
    });
    setIsEditing(note.id);
    setIsModalOpen(true);
  };

  const addCustomCharge = () => {
    setForm(prev => ({
      ...prev,
      customCharges: [...(prev.customCharges || []), blankLine()]
    }));
  };

  const updateCustomCharge = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      customCharges: prev.customCharges.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const removeCustomCharge = (id) => {
    setForm(prev => {
      const next = (prev.customCharges || []).filter(c => c.id !== id);
      return { ...prev, customCharges: next.length ? next : [blankLine()] };
    });
  };

  const getSubtotal = () => {
    let subtotal = 0;
    (form.customCharges || []).forEach(c => {
      subtotal += (parseFloat(c.qty) || 0) * (parseFloat(c.rate) || 0);
    });

    if (subtotal === 0 && (form.particulars || form.amount)) {
      subtotal = parseFloat(form.amount) || 0;
    }
    return subtotal;
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
      charges: {},
      rates: {},
      qtys: {},
      customCharges: (form.customCharges || []).filter(
        (c) => (c.description || '').trim() || (parseFloat(c.qty) || 0) * (parseFloat(c.rate) || 0)
      ),
      subtotal,
      taxAmount,
      amount: total
    };

    if (isEditing) {
      updateItem('creditNotes', isEditing, { ...finalDoc, id: isEditing });
    } else {
      updateData('creditNotes', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('CN');
    }
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const notesList = (data.creditNotes || []).filter(n => !n.isDeleted);
  const filtered = notesList.filter(n =>
    (n.noteNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Credit Notes</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage financial credit notes with GST calculations.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Add Credit Note
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
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No Credit Notes logged.</td></tr>
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
                        <button title="Preview PDF" onClick={() => {
                          const party = data.parties?.find(p => p.id === note.partyId) || {};
                          viewPDF('CN', {
                            ...note,
                            address: party.billAddress,
                            state: 'GUJARAT',
                            stateCode: '24',
                            gstin: party.gstinBill
                          });
                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={16} /></button>
                          <button onClick={() => {
                          const party = data.parties?.find(p => p.id === note.partyId) || {};
                          exportToPDF('CN', {
                            ...note,
                            address: party.billAddress,
                            state: 'GUJARAT',
                            stateCode: '24',
                            gstin: party.gstinBill
                          });
                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={16} /></button>
                        <button onClick={() => handleEdit(note)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => deleteItemSoftly('creditNotes', note.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit Credit Note' : 'Create Credit Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Note Number *</label>
                  <input type="text" className="input-field" required value={form.noteNo} onChange={e => setForm({...form, noteNo: e.target.value})} style={{ background: 'var(--glass-bg)', color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party (optional select)</label>
                  <select className="input-field" value={form.partyId} onChange={handlePartySelect}>
                    <option value="">-- Select or type name below --</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Supplier / Party Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="Enter party name manually"
                    value={form.partyName}
                    onChange={e => setForm(prev => ({ ...prev, partyName: e.target.value, partyId: '' }))}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ref Invoice (Optional)</label>
                  <input type="text" className="input-field" value={form.refInvoice} onChange={e => setForm({...form, refInvoice: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ref Invoice Date</label>
                  <input type="date" className="input-field" value={form.refInvoiceDate} onChange={e => setForm({...form, refInvoiceDate: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Customer PO No.</label>
                  <input type="text" className="input-field" value={form.poNo} onChange={e => setForm({...form, poNo: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Reference</label>
                  <input type="text" className="input-field" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Reason for Credit Note</label>
                  <select className="input-field" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}>
                    <option value="">-- Select Reason --</option>
                    <option value="Sales Return">Sales Return</option>
                    <option value="Rate Difference">Rate Difference</option>
                    <option value="Discount">Discount</option>
                    <option value="Excess Billing">Excess Billing</option>
                    <option value="Material Rejection">Material Rejection</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Particulars / Other Reason *</label>
                  <textarea className="input-field" rows="1" required value={form.particulars} onChange={e => setForm({...form, particulars: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Line Items</h3>
                <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={addCustomCharge}>
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 30px', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>Description</span>
                    <span>Qty</span>
                    <span>Rate (₹)</span>
                    <span />
                  </div>
                  {(form.customCharges || []).map(c => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <input type="text" className="input-field" placeholder="Enter description" value={c.description} onChange={e => updateCustomCharge(c.id, 'description', e.target.value)} />
                      <input type="number" className="input-field" placeholder="Qty" value={c.qty} onChange={e => updateCustomCharge(c.id, 'qty', e.target.value)} min="0" step="any" />
                      <input type="number" className="input-field" placeholder="Rate" value={c.rate} onChange={e => updateCustomCharge(c.id, 'rate', e.target.value)} min="0" step="any" />
                      <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeCustomCharge(c.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>SGST @{(form.taxRate / 2)}%:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    <span>Grand Total:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Credit Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditNotes;
