import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, UploadCloud, Trash2, Calendar, ClipboardList, CheckCircle } from 'lucide-react';

const PSD = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMR, setSelectedMR] = useState(null);

  // PSD Form State
  const [form, setForm] = useState({
    psdNo: '',
    date: new Date().toISOString().split('T')[0],
    requirement: '90% < 10M',
    result: '90% < 7.77',
    fileName: '',
    fileSize: '',
    notes: ''
  });

  const activeMR = selectedMR;
  const party = data.parties.find(p => p.id === activeMR?.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === activeMR?.productName);

  useEffect(() => {
    if (selectedMR) {
      const psdSerial = data.settings?.serials?.PSD || 1;
      const docNo = generateDocNumber('PSD', psdSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        psdNo: docNo,
        requirement: prodConfig?.psdReq || '90% < 10M'
      }));
    }
  }, [form.date, selectedMR, prodConfig, data.settings?.serials?.PSD]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({
        ...prev,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`
      }));
    }
  };

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setForm({
      psdNo: '',
      date: new Date().toISOString().split('T')[0],
      requirement: '90% < 10M',
      result: '90% < 7.77',
      fileName: '',
      fileSize: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const deletePSD = (id) => {
    if (window.confirm("Delete this PSD test report?")) {
      setData(prev => ({
        ...prev,
        psds: prev.psds.filter(p => p.id !== id)
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: selectedMR.id,
      partyName: selectedMR.partyName,
      productName: selectedMR.productName,
      uploadedAt: new Date().toLocaleString()
    };

    updateData('psds', { ...finalDoc, id: Date.now().toString() });
    incrementSerial('PSD');
    setIsModalOpen(false);
  };

  // Find receipts that do not have a PSD generated yet
  const pendingReceipts = data.materialReceipts.filter(mr => 
    !(data.psds || []).some(p => p.receiptId === mr.id)
  );

  const filteredPSDs = (data.psds || []).filter(p => 
    p.psdNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>PSD Lab Reports</h1>
        <p style={{ color: 'var(--text-muted)' }}>Upload and log Particle Size Distribution (PSD) analysis reports.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending Receipts scheduler */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending Lab Analysis
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a receipt to upload its particle size analysis report.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingReceipts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending batches awaiting lab results.</p>
            ) : (
              pendingReceipts.map(mr => (
                <div 
                  key={mr.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(mr)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{mr.receiptNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{mr.partyName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{mr.productName} - {mr.totalQty} Kg</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: PSD log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Uploaded PSD Reports</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search PSD No, customer or chemical..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>PSD No</th>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Spec vs Result</th>
                  <th style={{ padding: '0.75rem' }}>Notes</th>
                  <th style={{ padding: '0.75rem' }}>File Name</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPSDs.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PSD reports found.</td></tr>
                ) : (
                  filteredPSDs.map(psd => (
                    <tr key={psd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{psd.psdNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{psd.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{psd.productName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Spec: {psd.requirement}</span>
                        <span style={{ fontSize: '0.75rem', display: 'block', color: '#10b981', fontWeight: 600 }}>Result: {psd.result}</span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>{psd.notes || '-'}</td>
                      <td style={{ padding: '0.75rem', fontStyle: 'italic', fontSize: '0.8rem' }}>{psd.fileName ? <a href="#" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{psd.fileName}</a> : 'N/A'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <button onClick={() => deletePSD(psd.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PSD Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '650px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Upload PSD Lab Analysis Report</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>PSD Document No</label>
                  <input type="text" className="input-field" readOnly value={form.psdNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>PSD Date</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Customer Party</label>
                  <input type="text" className="input-field" readOnly value={activeMR?.partyName} />
                </div>
                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" readOnly value={activeMR?.productName} />
                </div>
                <div>
                  <label>PSD Requirement (e.g. 90% &lt; 10M) *</label>
                  <input type="text" className="input-field" required value={form.requirement} onChange={e => setForm({...form, requirement: e.target.value})} />
                </div>
                <div>
                  <label>PSD Result (e.g. 90% &lt; 7.77M) *</label>
                  <input type="text" className="input-field" required value={form.result} onChange={e => setForm({...form, result: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Additional Notes / Remarks</label>
                  <textarea className="input-field" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', border: '2px dashed var(--border-color)', padding: '2rem', borderRadius: '8px', textAlign: 'center', marginBottom: '1.5rem' }}>
                <UploadCloud size={36} style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Drag & drop your PSD PDF report here, or click to browse.</p>
                <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ marginTop: '1rem', fontSize: '0.8rem' }} />
                {form.fileName && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{form.fileName}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({form.fileSize})</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PSD;
