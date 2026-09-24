import { formatDate } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {Eye,  Plus, Edit2, Trash2, FileDown } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import DateField from '../components/DateField';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import StatusTabBar from '../components/StatusTabBar';
import {
  STANDARD_CHARGES_LIST,
  OTHER_CHARGE_ITEM,
  qtyInputValue,
  rateInputValue
} from '../utils/documentCharges';
import { calcNoteLines } from '../utils/debitCreditNoteHtml';
import SearchableSelect from '../components/SearchableSelect';
import { GST_TYPE_CGST_SGST, GST_TYPE_IGST, normalizeGstType } from '../utils/taxInvoiceLayout';

const blankLine = () => ({ id: Date.now() + Math.random(), description: '', qty: '', rate: '' });

const linesFromNote = (note) => {
  if (Array.isArray(note.customCharges) && note.customCharges.length) {
    return note.customCharges.map((c) => ({
      id: c.id || Date.now() + Math.random(),
      description: c.description || '',
      qty: c.qty ?? '',
      rate: (c.rate === 0 || c.rate == null || c.rate === '') ? '' : c.rate
    }));
  }
  const migrated = [];
  [...STANDARD_CHARGES_LIST, OTHER_CHARGE_ITEM].forEach((c) => {
    if (!note.charges?.[c.key]) return;
    const rawRate = note.rates?.[c.key];
    migrated.push({
      id: `${c.key}-${Date.now()}`,
      description: c.label || c.key,
      qty: note.qtys?.[c.key] ?? '',
      rate: (rawRate === 0 || rawRate == null || rawRate === '') ? '' : rawRate
    });
  });
  return migrated.length ? migrated : [blankLine()];
};

const notePrintPayload = (note, party = {}) => {
  const billAddress = note.billAddress || note.address || party.billAddress || '';
  const shipAddress = note.shipAddress || billAddress || party.shipAddress || '';
  return {
    ...note,
    partyName: note.partyName || party.name || '',
    address: billAddress,
    billAddress,
    shipAddress,
    billState: note.billState || note.state || party.billState || party.state || '',
    billStateCode: note.billStateCode || note.stateCode || party.stateCode || '',
    state: note.state || note.billState || party.state || '',
    stateCode: note.stateCode || note.billStateCode || party.stateCode || '',
    gstin: note.gstin || note.gstinBill || party.gstinBill || '',
    gstinBill: note.gstinBill || note.gstin || party.gstinBill || ''
  };
};

const CreditNotes = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending');

  const [form, setForm] = useState({
    noteNo: '',
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    address: '',
    billAddress: '',
    shipAddress: '',
    gstin: '',
    state: 'GUJARAT',
    stateCode: '24',
    refInvoice: '',
    refInvoiceDate: '',
    poNo: '',
    reference: '',
    reason: '',
    particulars: '',
    customCharges: [blankLine()],
    discount: 0,
    taxRate: 18,
    gstType: GST_TYPE_CGST_SGST
  });

  const handlePartySelect = (e) => {
    const name = e.target.value || '';
    const party = (data.parties || []).find(p =>
      !p.isDeleted && (p.name || '').trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (party) {
      const bill = party.billAddress || '';
      const ship = party.shipAddress || bill;
      setForm(prev => ({
        ...prev,
        partyId: party.id,
        partyName: party.name || name,
        address: bill || prev.address || '',
        billAddress: bill || prev.billAddress || '',
        shipAddress: ship || prev.shipAddress || '',
        gstin: party.gstinBill || prev.gstin || '',
        state: party.state || prev.state || 'GUJARAT',
        stateCode: party.stateCode || prev.stateCode || '24'
      }));
      return;
    }
    setForm(prev => ({ ...prev, partyId: '', partyName: name }));
  };

  const handleOpenModal = () => {
    const serial = data.settings?.serials?.CN || 1;
    setForm({
      noteNo: generateDocNumber('CN', serial, new Date()),
      date: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      address: '',
      billAddress: '',
      shipAddress: '',
      gstin: '',
      state: 'GUJARAT',
      stateCode: '24',
      refInvoice: '',
      refInvoiceDate: '',
      poNo: '',
      reference: '',
      reason: '',
      particulars: '',
      customCharges: [blankLine()],
      discount: 0,
      taxRate: 18,
      gstType: GST_TYPE_CGST_SGST
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note) => {
    const party = data.parties?.find(p => p.id === note.partyId) || {};
    const bill = note.billAddress || note.address || party.billAddress || '';
    const ship = note.shipAddress || bill || party.shipAddress || '';
    setForm({
      ...note,
      partyName: note.partyName || party.name || '',
      address: bill,
      billAddress: bill,
      shipAddress: ship,
      gstin: note.gstin || note.gstinBill || party.gstinBill || '',
      state: note.state || note.billState || 'GUJARAT',
      stateCode: note.stateCode || note.billStateCode || '24',
      customCharges: linesFromNote(note),
      discount: note.discount || 0,
      taxRate: note.taxRate ?? 18,
      gstType: normalizeGstType(note.gstType)
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

  const noteTotals = calcNoteLines(form);

  const handleSubmit = (e) => {
    e.preventDefault();
    const calc = calcNoteLines(form);
    const billAddress = (form.billAddress || form.address || '').trim();
    const shipAddress = (form.shipAddress || billAddress).trim();
    const finalDoc = {
      ...form,
      address: billAddress,
      billAddress,
      shipAddress,
      billState: form.billState || form.state || '',
      billStateCode: form.billStateCode || form.stateCode || '',
      gstinBill: form.gstinBill || form.gstin || '',
      charges: {},
      rates: {},
      qtys: {},
      customCharges: (form.customCharges || []).filter(
        (c) => (c.description || '').trim() || (parseFloat(c.qty) || 0) * (parseFloat(c.rate) || 0)
      ),
      subtotal: calc.grossAmt,
      taxAmount: calc.totalSgst + calc.totalCgst + calc.totalIgst,
      amount: calc.roundedTotal
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
  const partyOptions = useMemo(() => uniqueSortedOptions(notesList.map((n) => n.partyName)), [notesList]);
  const isNotePending = (n) => !String(n.refInvoice || n.invoiceNo || '').trim();
  const pendingCount = notesList.filter(isNotePending).length;
  const completedCount = notesList.filter((n) => !isNotePending(n)).length;
  const filtered = notesList.filter((n) => {
    if (statusTab === 'pending' && !isNotePending(n)) return false;
    if (statusTab === 'completed' && isNotePending(n)) return false;
    if (partyFilter && (n.partyName || '') !== partyFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (n.noteNo || '').toLowerCase().includes(q) ||
      (n.partyName || '').toLowerCase().includes(q)
    );
  });

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

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={notesList.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by Note No or Party Name..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        showProduct={false}
      />

      <div className="premium-card">
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
                          viewPDF('CN', notePrintPayload(note, party));
                        }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={16} /></button>
                          <button onClick={() => {
                          const party = data.parties?.find(p => p.id === note.partyId) || {};
                          exportToPDF('CN', notePrintPayload(note, party));
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
        <div className="page-form-overlay">
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
                  <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Name *</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    required
                    placeholder="Select or type party name"
                    value={form.partyName}
                    onChange={handlePartySelect}
                  >
                    <option value="">Select or type party name</option>
                    {(data.parties || []).filter(p => !p.isDeleted).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill To Address</label>
                  <textarea
                    className="input-field"
                    rows="3"
                    placeholder="Type bill-to address manually"
                    value={form.billAddress || form.address || ''}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      billAddress: e.target.value,
                      address: e.target.value
                    }))}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship To Address</label>
                  <textarea
                    className="input-field"
                    rows="3"
                    placeholder="Type ship-to address manually"
                    value={form.shipAddress || ''}
                    onChange={e => setForm(prev => ({ ...prev, shipAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <label>GSTIN</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Party GSTIN"
                    value={form.gstin || ''}
                    onChange={e => setForm(prev => ({ ...prev, gstin: e.target.value }))}
                  />
                </div>
                <div>
                  <label>State</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.state || ''}
                    onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ref Invoice (Optional)</label>
                  <input type="text" className="input-field" value={form.refInvoice} onChange={e => setForm({...form, refInvoice: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ref Invoice Date</label>
                  <DateField className="input-field" value={form.refInvoiceDate} onChange={e => setForm({...form, refInvoiceDate: e.target.value})} />
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
                  <SearchableSelect className="input-field" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}>
                    <option value="">-- Select Reason --</option>
                    <option value="Sales Return">Sales Return</option>
                    <option value="Rate Difference">Rate Difference</option>
                    <option value="Discount">Discount</option>
                    <option value="Excess Billing">Excess Billing</option>
                    <option value="Material Rejection">Material Rejection</option>
                    <option value="Others">Others</option>
                  </SearchableSelect>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 30px', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>Description</span>
                    <span>Qty</span>
                    <span>Rate (₹)</span>
                    <span />
                  </div>
                  {(form.customCharges || []).map(c => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <input type="text" className="input-field" placeholder="Enter description" value={c.description} onChange={e => updateCustomCharge(c.id, 'description', e.target.value)} />
                      <input type="number" className="input-field" placeholder="NIL" value={qtyInputValue(c.qty)} onChange={e => updateCustomCharge(c.id, 'qty', e.target.value)} min="0" step="any" />
                      <input type="number" className="input-field" placeholder="Rate" value={rateInputValue(c.rate)} onChange={e => updateCustomCharge(c.id, 'rate', e.target.value)} min="0" step="any" />
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
                    <span style={{ fontWeight: 600 }}>₹{noteTotals.grossAmt.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>Discount (₹):</span>
                    <input type="number" className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.discount} onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
                  </div>
                  {noteTotals.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Taxable Amount:</span>
                      <span>₹{noteTotals.totalAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>GST Type:</span>
                    <SearchableSelect className="input-field" style={{ width: '160px', padding: '0.2rem', height: 'auto' }} value={normalizeGstType(form.gstType)} onChange={e => setForm({...form, gstType: e.target.value})}>
                      <option value={GST_TYPE_CGST_SGST}>CGST + SGST</option>
                      <option value={GST_TYPE_IGST}>IGST</option>
                    </SearchableSelect>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>GST Rate (%):</span>
                    <SearchableSelect className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.taxRate} onChange={e => setForm({...form, taxRate: parseInt(e.target.value) || 0})}>
                      <option value="18">18%</option>
                      <option value="12">12%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                    </SearchableSelect>
                  </div>
                  {normalizeGstType(form.gstType) === GST_TYPE_IGST ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>IGST @{noteTotals.taxRate}%:</span>
                      <span>₹{noteTotals.totalIgst.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>CGST @{noteTotals.displayRate}%:</span>
                        <span>₹{noteTotals.totalCgst.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>SGST @{noteTotals.displayRate}%:</span>
                        <span>₹{noteTotals.totalSgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Round Off:</span>
                    <span>₹{noteTotals.roundOff.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    <span>Grand Total:</span>
                    <span>₹{noteTotals.roundedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
