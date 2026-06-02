import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Plus, Search, Edit2, Trash2, Calendar, ClipboardList, Columns, FileDown } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const BPR = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBPR, setEditingBPR] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);

  // BPR Form State
  const [form, setForm] = useState({
    bprNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    productName: '',
    totalInputQty: 0,
    psdRequirement: '90% < 10M',
    totalDrums: 0,
    doubleDispatch: false,
    receivedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    dispatchedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    cleaningChecklist: { equipmentCleaned: false, areaCleaned: false, lineClearance: false },
    pressureMetrics: { grindingPressure: '', injectionPressure: '' },
    packingConsumables: { fiberDrumsUsed: 0, hdpeDrumsUsed: 0, linersUsed: 0 }
  });

  // Calculate totals in real-time
  const totalReceivedNet = form.receivedBatches.reduce((s, r) => s + r.net, 0);
  const totalDispatchedNet = form.dispatchedBatches.reduce((s, r) => s + r.net, 0);

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setEditingBPR(null);
    
    const bprSerial = data.settings?.serials?.BPR || 1;
    const docNo = generateDocNumber('BPR', bprSerial, new Date(form.date));

    // Construct drum list from MR batches
    const activeMRBatches = mr.batches.filter(b => !b.isEmptyDrums);
    const receivedRows = [];
    activeMRBatches.forEach(b => {
      const drumCount = parseInt(b.drums) || 1;
      for (let d = 1; d <= drumCount; d++) {
        receivedRows.push({
          batchNo: b.batchNo,
          drumNo: d.toString(),
          gross: 0,
          tare: 0,
          net: 0
        });
      }
    });

    setForm({
      bprNo: docNo,
      date: new Date().toISOString().split('T')[0],
      partyName: mr.partyName,
      productName: mr.productName,
      totalInputQty: mr.totalQty,
      psdRequirement: '90% < 10M',
      totalDrums: mr.totalDrums || 0,
      doubleDispatch: false,
      receivedBatches: receivedRows,
      dispatchedBatches: receivedRows.map(r => ({ ...r })),
      cleaningChecklist: { equipmentCleaned: false, areaCleaned: false, lineClearance: false },
      pressureMetrics: { grindingPressure: '', injectionPressure: '' },
      packingConsumables: { fiberDrumsUsed: 0, hdpeDrumsUsed: 0, linersUsed: 0 }
    });

    setIsModalOpen(true);
  };

  const handleEdit = (bpr) => {
    setEditingBPR(bpr);
    setForm(bpr);
    setIsModalOpen(true);
  };

  const toggleDoubleDispatch = () => {
    const nextVal = !form.doubleDispatch;
    setForm(prev => {
      let nextDispatch = [];
      if (nextVal) {
        prev.receivedBatches.forEach(r => {
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}A` });
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}B` });
        });
      } else {
        nextDispatch = prev.receivedBatches.map(r => ({ ...r }));
      }
      return {
        ...prev,
        doubleDispatch: nextVal,
        dispatchedBatches: nextDispatch
      };
    });
  };

  const handleCellChange = (tableKey, idx, field, val) => {
    setForm(prev => {
      const list = [...prev[tableKey]];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
      list[idx] = item;
      return { ...prev, [tableKey]: list };
    });
  };

  const addCustomRow = (tableKey) => {
    setForm(prev => ({
      ...prev,
      [tableKey]: [...prev[tableKey], { batchNo: 'Custom', drumNo: (prev[tableKey].length + 1).toString(), gross: 0, tare: 0, net: 0 }]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: editingBPR ? editingBPR.receiptId : selectedMR.id,
      partyName: form.partyName,
      productName: form.productName,
      totalReceivedNet,
      totalDispatchedNet
    };

    if (editingBPR) {
      updateItem('bprs', editingBPR.id, finalDoc);
    } else {
      updateData('bprs', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('BPR');
    }
    setIsModalOpen(false);
  };

  const deleteBPR = (id) => {
    if (window.confirm("Delete this BPR record?")) {
      deleteItemSoftly('bprs', id);
    }
  };

  // Find receipts that do not have a BPR generated yet
  const pendingReceipts = data.materialReceipts.filter(mr => 
    !(data.bprs || []).some(b => b.receiptId === mr.id)
  );

  const filteredBPRs = (data.bprs || []).filter(b => 
    (b.bprNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.productName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Batch Processing Records (BPR)</h1>
        <p style={{ color: 'var(--text-muted)' }}>Monitor milled batches and double-check dispatched weights.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending Receipts scheduler */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending M.R. Receipts
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a receipt to enter manufacturing batch weights.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingReceipts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending receipts awaiting processing.</p>
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
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{mr.productName} - {mr.totalQty} Kg ({mr.totalDrums} Drums)</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Production History */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>BPR Production Log</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search BPR No, customer or chemical..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>BPR No</th>
                  <th style={{ padding: '0.75rem' }}>Party Name</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Drums (Net)</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBPRs.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No BPR records found.</td></tr>
                ) : (
                  filteredBPRs.map(bpr => (
                    <tr key={bpr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{bpr.bprNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{bpr.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{bpr.productName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span>{bpr.dispatchedBatches?.length || 0} Drums</span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net: {bpr.totalDispatchedNet?.toFixed(1) || 0} Kg</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('BPR', bpr)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(bpr)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteBPR(bpr.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
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

      {/* Embedded Generator Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingBPR ? 'Modify BPR weights' : 'Create Batch Processing Record (BPR)'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>BPR Number</label>
                  <input type="text" className="input-field" value={form.bprNo} onChange={e => setForm({...form, bprNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>BPR Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Party Name</label>
                  <input type="text" className="input-field" value={form.partyName} onChange={e => setForm({...form, partyName: e.target.value})} />
                </div>
                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} />
                </div>
                <div>
                  <label>PSD Requirement *</label>
                  <input type="text" className="input-field" required value={form.psdRequirement} onChange={e => setForm({...form, psdRequirement: e.target.value})} />
                </div>
              </div>

              {/* Checklists and Metrics Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Operational Cleaning</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={form.cleaningChecklist.equipmentCleaned} onChange={e => setForm({...form, cleaningChecklist: {...form.cleaningChecklist, equipmentCleaned: e.target.checked}})} />
                    Equipment Cleaned
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={form.cleaningChecklist.areaCleaned} onChange={e => setForm({...form, cleaningChecklist: {...form.cleaningChecklist, areaCleaned: e.target.checked}})} />
                    Area Cleaned
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={form.cleaningChecklist.lineClearance} onChange={e => setForm({...form, cleaningChecklist: {...form.cleaningChecklist, lineClearance: e.target.checked}})} />
                    Line Clearance Received
                  </label>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Pressure Metrics</h4>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>Grinding Pressure (kg/cm²)</label>
                    <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.pressureMetrics.grindingPressure} onChange={e => setForm({...form, pressureMetrics: {...form.pressureMetrics, grindingPressure: e.target.value}})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem' }}>Injection Pressure (kg/cm²)</label>
                    <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.pressureMetrics.injectionPressure} onChange={e => setForm({...form, pressureMetrics: {...form.pressureMetrics, injectionPressure: e.target.value}})} />
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Packing Consumables</h4>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>Fiber Drums Used</label>
                    <input type="number" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.packingConsumables.fiberDrumsUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, fiberDrumsUsed: parseInt(e.target.value) || 0}})} />
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>HDPE Drums Used</label>
                    <input type="number" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.packingConsumables.hdpeDrumsUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, hdpeDrumsUsed: parseInt(e.target.value) || 0}})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem' }}>Liners Used</label>
                    <input type="number" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.packingConsumables.linersUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, linersUsed: parseInt(e.target.value) || 0}})} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Received vs Dispatched Twin Weight Tables</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  <input type="checkbox" checked={form.doubleDispatch} onChange={toggleDoubleDispatch} />
                  Double Dispatch Drums Count (micronised splitting)
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Received weights */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Received Raw Material Weight</h4>
                    <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow('receivedBatches')}>+ Add Row</button>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.35rem' }}>Batch No</th>
                          <th style={{ padding: '0.35rem' }}>Drum No</th>
                          <th style={{ padding: '0.35rem' }}>Gross</th>
                          <th style={{ padding: '0.35rem' }}>Tare</th>
                          <th style={{ padding: '0.35rem' }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.receivedBatches.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                            <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange('receivedBatches', idx, 'gross', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange('receivedBatches', idx, 'tare', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.net.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                    <span>Total Received:</span>
                    <span>{totalReceivedNet.toFixed(2)} Kg</span>
                  </div>
                </div>

                {/* Dispatched weights */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Dispatched (Micronised) Weight</h4>
                    <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow('dispatchedBatches')}>+ Add Row</button>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.35rem' }}>Batch No</th>
                          <th style={{ padding: '0.35rem' }}>Drum No</th>
                          <th style={{ padding: '0.35rem' }}>Gross</th>
                          <th style={{ padding: '0.35rem' }}>Tare</th>
                          <th style={{ padding: '0.35rem' }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.dispatchedBatches.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                            <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange('dispatchedBatches', idx, 'gross', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange('dispatchedBatches', idx, 'tare', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.net.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                    <span>Total Dispatched:</span>
                    <span>{totalDispatchedNet.toFixed(2)} Kg</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save BPR Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BPR;
