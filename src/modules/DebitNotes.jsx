import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import {Eye,  Plus, Search, Edit2, Trash2, FileDown } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import DocChargeRow from '../components/DocChargeRow';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM,
  CHARGE_KEYS,
  defaultChargeFlags,
  defaultChargeRates,
  emptyChargeQtys,
  buildChargeQtys,
  calcStandardChargesSubtotal,
  parseChargeFieldValue
} from '../utils/documentCharges';

const DN_CHARGE_KEYS = [...CHARGE_KEYS, 'other'];
const chargesList = [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM];

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
    refInvoiceDate: '',
    poNo: '',
    reference: '',
    reason: '',
    particulars: '',
    charges: defaultChargeFlags({ other: true }),
    rates: defaultChargeRates(['other']),
    qtys: emptyChargeQtys(['other']),
    customCharges: [],
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
      refInvoiceDate: '',
      poNo: '',
      reference: '',
      reason: '',
      particulars: '',
      charges: defaultChargeFlags({ other: true }),
      rates: defaultChargeRates(['other']),
      qtys: emptyChargeQtys(['other']),
      customCharges: [],
      discount: 0,
      taxRate: 18
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note) => {
    const legacyQty = parseFloat(note.qty) || 1;
    setForm({
      ...note,
      qtys: note.qtys
        ? { ...emptyChargeQtys(['other']), ...note.qtys }
        : buildChargeQtys({}, legacyQty, ['other']),
      customCharges: note.customCharges || []
    });
    setIsEditing(note.id);
    setIsModalOpen(true);
  };

  const toggleCharge = (key) => {
    setForm(prev => {
      const turningOn = !prev.charges[key];
      const qtys = { ...(prev.qtys || emptyChargeQtys(['other'])) };
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = 1;
      }
      return { ...prev, charges: { ...prev.charges, [key]: turningOn }, qtys };
    });
  };

  const addCustomCharge = () => {
    setForm(prev => ({
      ...prev,
      customCharges: [...(prev.customCharges || []), { id: Date.now(), description: '', qty: 1, rate: 0 }]
    }));
  };

  const updateCustomCharge = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      customCharges: prev.customCharges.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const removeCustomCharge = (id) => {
    setForm(prev => ({
      ...prev,
      customCharges: prev.customCharges.filter(c => c.id !== id)
    }));
  };

  const handleRateChange = (key, val) => {
    setForm(prev => ({ ...prev, rates: { ...prev.rates, [key]: parseChargeFieldValue(val) } }));
  };

  const handleQtyChange = (key, val) => {
    setForm(prev => ({ ...prev, qtys: { ...(prev.qtys || emptyChargeQtys(['other'])), [key]: parseChargeFieldValue(val) } }));
  };

  const getSubtotal = () => {
    let subtotal = calcStandardChargesSubtotal(form.charges, form.rates, form.qtys, 0, DN_CHARGE_KEYS);
    
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
      subtotal,
      taxAmount,
      amount: total
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
                        <button title="Preview PDF" onClick={() => {
                          const party = data.parties?.find(p => p.id === note.partyId) || {};
                          viewPDF('DN', {
                            ...note,
                            address: party.billAddress,
                            state: 'GUJARAT',
                            stateCode: '24',
                            gstin: party.gstinBill
                          });
                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={16} /></button>
                          <button onClick={() => {
                          const party = data.parties?.find(p => p.id === note.partyId) || {};
                          exportToPDF('DN', {
                            ...note,
                            address: party.billAddress,
                            state: 'GUJARAT',
                            stateCode: '24',
                            gstin: party.gstinBill
                          });
                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={16} /></button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit Debit Note' : 'Create Debit Note'}</h2>
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
                  <label>Reason for Debit Note</label>
                  <select className="input-field" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}>
                    <option value="">-- Select Reason --</option>
                    <option value="Additional Charges">Additional Charges</option>
                    <option value="Rate Revision">Rate Revision</option>
                    <option value="Packing Charges">Packing Charges</option>
                    <option value="Freight Charges">Freight Charges</option>
                    <option value="Material Shortage">Material Shortage</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Particulars / Other Reason *</label>
                  <textarea className="input-field" rows="1" required value={form.particulars} onChange={e => setForm({...form, particulars: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>Debit Note Charges Grid</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chargesList.map(item => (
                      <DocChargeRow
                        key={item.key}
                        item={item}
                        charges={form.charges}
                        rates={form.rates}
                        qtys={form.qtys}
                        materialQty={1}
                        onToggle={toggleCharge}
                        onQtyChange={handleQtyChange}
                        onRateChange={handleRateChange}
                      />
                    ))}
                  </div>

                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Manual Custom Charges</label>
                      <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={addCustomCharge}>
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    {(form.customCharges || []).map(c => (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <input type="text" className="input-field" placeholder="Description" value={c.description} onChange={e => updateCustomCharge(c.id, 'description', e.target.value)} />
                        <input type="number" className="input-field" placeholder="Qty" value={c.qty} onChange={e => updateCustomCharge(c.id, 'qty', e.target.value)} min="0" step="any" />
                        <input type="number" className="input-field" placeholder="Rate" value={c.rate} onChange={e => updateCustomCharge(c.id, 'rate', e.target.value)} min="0" step="any" />
                        <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeCustomCharge(c.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(form.customCharges || []).length === 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No manual charges added.</div>
                    )}
                  </div>
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
