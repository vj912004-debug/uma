import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, FileMinus } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';

const DebitNotes = () => {
  const { data, updateData, updateItem, deleteDataSoftly, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    noteNo: '',
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    refInvoice: '',
    particulars: '',
    amount: ''
  });

  const handlePartySelect = (e) => {
    const party = data.parties.find(p => p.id === e.target.value);
    if (party) {
      setFormData(prev => ({ ...prev, partyId: party.id, partyName: party.name }));
    }
  };

  const handleOpenModal = () => {
    const serial = data.settings?.serials?.DN || 1;
    setFormData({
      noteNo: generateDocNumber('DN', serial, new Date()),
      date: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      refInvoice: '',
      particulars: '',
      amount: ''
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (note) => {
    setFormData(note);
    setIsEditing(note.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditing) {
      updateItem('debitNotes', isEditing, { ...formData, id: isEditing });
    } else {
      updateData('debitNotes', { ...formData, id: Date.now().toString() });
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
          <p style={{ color: 'var(--text-muted)' }}>Manage financial debit notes for customers/suppliers.</p>
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
                    <td>{note.date}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{note.noteNo}</td>
                    <td style={{ fontWeight: 600 }}>{note.partyName}</td>
                    <td>{note.refInvoice || '-'}</td>
                    <td>{note.particulars}</td>
                    <td style={{ fontWeight: 600 }}>{parseFloat(note.amount).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEdit(note)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => deleteDataSoftly('debitNotes', note.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
            <h2 style={{ marginBottom: '1.5rem' }}>{isEditing ? 'Edit Debit Note' : 'Add Debit Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Note Number *</label>
                  <input type="text" className="input-field" required readOnly value={formData.noteNo} style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div>
                  <label>Date *</label>
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
                  <label>Ref Invoice (Optional)</label>
                  <input type="text" className="input-field" value={formData.refInvoice} onChange={e => setFormData({...formData, refInvoice: e.target.value})} />
                </div>
                <div>
                  <label>Amount (₹) *</label>
                  <input type="number" step="0.01" className="input-field" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Particulars / Reason *</label>
                  <textarea className="input-field" rows="2" required value={formData.particulars} onChange={e => setFormData({...formData, particulars: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
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
