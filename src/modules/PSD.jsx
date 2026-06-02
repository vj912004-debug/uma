import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF } from '../utils/pdfExport';
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
    reports: [
      { batchNo: '', method: 'Dry', requirement: '90% < 10M', result: '', fileName: '', fileSize: '' }
    ],
    notes: ''
  });

  const activeMR = selectedMR;
  const party = data.parties.find(p => p.id === activeMR?.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === activeMR?.productName);

  useEffect(() => {
    if (selectedMR) {
      const psdSerial = data.settings?.serials?.PSD || 1;
      const docNo = generateDocNumber('PSD', psdSerial, new Date(form.date));
      setForm(prev => {
        const reps = [...prev.reports];
        reps[0].requirement = prodConfig?.psdReq || '90% < 10M';
        reps[0].method = prodConfig?.psdMethodDefault || 'Dry';
        reps[0].batchNo = (selectedMR?.batches || []).filter(b => !b.isEmptyDrums)[0]?.batchNo || '';
        return { ...prev, psdNo: docNo, reports: reps };
      });
    }
  }, [form.date, selectedMR, prodConfig, data.settings?.serials?.PSD]);

  const handleFileUpload = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => {
        const reps = [...prev.reports];
        reps[index].fileName = file.name;
        reps[index].fileSize = `${(file.size / 1024).toFixed(1)} KB`;
        return { ...prev, reports: reps };
      });
    }
  };

  const addReport = () => {
    if (form.reports.length < 10) {
      setForm(prev => ({
        ...prev,
        reports: [...prev.reports, { batchNo: prev.reports[0].batchNo, method: prev.reports[0].method, requirement: prev.reports[0].requirement, result: '', fileName: '', fileSize: '' }]
      }));
    }
  };

  const removeReport = (index) => {
    if (form.reports.length > 1) {
      setForm(prev => ({
        ...prev,
        reports: prev.reports.filter((_, i) => i !== index)
      }));
    }
  };

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setForm({
      psdNo: '',
      date: new Date().toISOString().split('T')[0],
      reports: [{ batchNo: (mr?.batches || []).filter(b => !b.isEmptyDrums)[0]?.batchNo || '', method: 'Dry', requirement: '90% < 10M', result: '', fileName: '', fileSize: '' }],
      notes: ''
    });
    setIsModalOpen(true);
  };

  const deletePSD = (id) => {
    if (window.confirm("Delete this PSD test report?")) {
      deleteItemSoftly('psds', id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Enforce max 10 reports per batch
    const counts = (form.reports || []).reduce((acc, r) => {
      const k = r.batchNo || '';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const tooMany = Object.entries(counts).find(([batch, c]) => batch && c > 10);
    if (tooMany) {
      alert(`Max 10 PSD reports allowed for batch "${tooMany[0]}".`);
      return;
    }

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
                        {(psd.reports || []).map((rep, idx) => (
                          <div key={idx} style={{ marginBottom: '0.5rem', borderBottom: idx < psd.reports.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: idx < psd.reports.length - 1 ? '0.5rem' : '0' }}>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Batch: {rep.batchNo || '-'}</span>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Method: {rep.method || '-'}</span>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Spec: {rep.requirement}</span>
                            <span style={{ fontSize: '0.75rem', display: 'block', color: '#10b981', fontWeight: 600 }}>Result: {rep.result}</span>
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>{psd.notes || '-'}</td>
                      <td style={{ padding: '0.75rem', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        {(psd.reports || []).map((rep, idx) => (
                          <div key={idx}>
                            {rep.fileName ? <a href="#" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{rep.fileName}</a> : 'N/A'}
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('PSD', psd)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }} title="Download PDF"><ClipboardList size={16} /></button>
                          <button onClick={() => deletePSD(psd.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }} title="Delete"><Trash2 size={16} /></button>
                        </div>
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
                {form.reports.map((rep, idx) => (
                  <div key={idx} style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Report {idx + 1}</h4>
                      {form.reports.length > 1 && (
                        <button type="button" className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }} onClick={() => removeReport(idx)}>Remove</button>
                      )}
                    </div>
                    <div>
                      <label>Batch No *</label>
                      <select className="input-field" required value={rep.batchNo} onChange={e => {
                        const newReps = [...form.reports];
                        newReps[idx].batchNo = e.target.value;
                        setForm({ ...form, reports: newReps});
                      }}>
                        <option value="">-- Select Batch --</option>
                        {(activeMR?.batches || []).filter(b => !b.isEmptyDrums).map((b, bIdx) => (
                          <option key={bIdx} value={b.batchNo}>{b.batchNo}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Method</label>
                      <select className="input-field" value={rep.method} onChange={e => {
                        const newReps = [...form.reports];
                        newReps[idx].method = e.target.value;
                        setForm({ ...form, reports: newReps});
                      }}>
                        <option value="Dry">Dry</option>
                        <option value="Wet">Wet</option>
                      </select>
                    </div>
                    <div>
                      <label>PSD Requirement *</label>
                      <input type="text" className="input-field" required value={rep.requirement} onChange={e => {
                        const newReps = [...form.reports];
                        newReps[idx].requirement = e.target.value;
                        setForm({...form, reports: newReps});
                      }} />
                    </div>
                    <div>
                      <label>PSD Result *</label>
                      <input type="text" className="input-field" required value={rep.result} onChange={e => {
                        const newReps = [...form.reports];
                        newReps[idx].result = e.target.value;
                        setForm({...form, reports: newReps});
                      }} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label>Upload PDF</label>
                      <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, idx)} style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'block' }} />
                      {rep.fileName && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rep.fileName}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({rep.fileSize})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {form.reports.length < 10 && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <button type="button" className="btn btn-secondary" onClick={addReport}>+ Add Another Report (Max 10)</button>
                  </div>
                )}
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Additional Notes / Remarks</label>
                  <textarea className="input-field" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
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
