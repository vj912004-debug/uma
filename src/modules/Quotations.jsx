import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Download, Trash2 } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF } from '../utils/pdfExport';
import { formatDate } from '../utils/dateUtils';

const Quotations = () => {
  const { data, updateData, deleteDataSoftly, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    quotationNo: '',
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    partyAddress: '',
    contactPerson: '',
    subject: 'Quotation for Micronising / Pulverising',
    productName: '',
    mainCharges: [{ description: '', rate: '' }],
    optionalCharges: [{ description: '', rate: '' }],
    terms: '1) GST: 18% Extra\n2) Freight: Extra as actual\n3) Payment: 100% Advance before delivery\n4) Validity: 30 Days'
  });

  useEffect(() => {
    if (isModalOpen && !formData.id) {
      const serial = data.settings?.serials?.QUOTATION || 1;
      setFormData(prev => ({ ...prev, quotationNo: generateDocNumber('QTN', serial, new Date(prev.date)) }));
    }
  }, [isModalOpen, data.settings?.serials?.QUOTATION, formData.date, formData.id]);

  const handlePartySelect = (e) => {
    const partyId = e.target.value;
    const party = data.parties.find(p => p.id === partyId);
    if (party) {
      setFormData(prev => ({ 
        ...prev, 
        partyId: party.id, 
        partyName: party.name, 
        partyAddress: party.billAddress 
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newQuotation = {
      ...formData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    updateData('quotations', newQuotation);
    incrementSerial('QUOTATION');
    setIsModalOpen(false);
  };

  const addChargeRow = (type) => {
    setFormData(prev => ({ 
      ...prev, 
      [type]: [...prev[type], { description: '', rate: '' }] 
    }));
  };

  const updateChargeRow = (type, index, field, value) => {
    const newCharges = [...formData[type]];
    newCharges[index][field] = value;
    setFormData(prev => ({ ...prev, [type]: newCharges }));
  };

  const quotationsList = data.quotations?.filter(q => !q.isDeleted) || [];
  const filtered = quotationsList.filter(q => 
    q.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.quotationNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Quotations</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create and manage commercial proposals.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); }}>
          <Plus size={18} /> New Quotation
        </button>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search quotations..." 
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
                <th>Quotation No</th>
                <th>Party Name</th>
                <th>Subject</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id}>
                  <td>{formatDate(q.date)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{q.quotationNo}</td>
                  <td>{q.partyName}</td>
                  <td>{q.subject}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} onClick={() => exportToPDF('QUOTATION', q)}>
                        <Download size={14} /> PDF
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => deleteDataSoftly('quotations', q.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Create Quotation</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Quotation No</label>
                  <input type="text" className="input-field" readOnly value={formData.quotationNo} style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div>
                  <label>Date</label>
                  <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>Select Party *</label>
                  <select className="input-field" required value={formData.partyId} onChange={handlePartySelect}>
                    <option value="">-- Select --</option>
                    {data.parties.filter(p => p.type === 'Customer').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Contact Person / Attn</label>
                  <input type="text" className="input-field" placeholder="e.g. Mr. Sharma" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Subject</label>
                  <input type="text" className="input-field" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Product Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Calcium Carbonate" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Main Charges Table</h3>
              {formData.mainCharges.map((charge, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input type="text" className="input-field" placeholder="Charge Description (e.g. Processing Charges)" value={charge.description} onChange={e => updateChargeRow('mainCharges', idx, 'description', e.target.value)} />
                  <input type="text" className="input-field" placeholder="Rate (e.g. ₹ 5 / Kg)" value={charge.rate} onChange={e => updateChargeRow('mainCharges', idx, 'rate', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '1.5rem' }} onClick={() => addChargeRow('mainCharges')}>+ Add Main Charge</button>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Optional / Extra Items (If Required)</h3>
              {formData.optionalCharges.map((charge, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input type="text" className="input-field" placeholder="Description (e.g. HDPE Drums)" value={charge.description} onChange={e => updateChargeRow('optionalCharges', idx, 'description', e.target.value)} />
                  <input type="text" className="input-field" placeholder="Rate (e.g. ₹ 500 / PC)" value={charge.rate} onChange={e => updateChargeRow('optionalCharges', idx, 'rate', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '1.5rem' }} onClick={() => addChargeRow('optionalCharges')}>+ Add Optional Charge</button>

              <div>
                <label>Terms & Conditions</label>
                <textarea className="input-field" rows="4" value={formData.terms} onChange={e => setFormData({...formData, terms: e.target.value})}></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Quotation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
