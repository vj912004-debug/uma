import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const PackingList = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPL, setEditingPL] = useState(null);
  const [selectedBPR, setSelectedBPR] = useState(null);

  // PL Form State
  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    productName: '',
    totalWeight: 0,
    totalDrums: 0,
    batches: [] // Array of { batchNo, drumNo, gross, tare, net }
  });

  const activeBPR = editingPL ? data.bprs.find(b => b.receiptId === editingPL.receiptId) : selectedBPR;

  useEffect(() => {
    if (editingPL) {
      setForm(editingPL);
    } else if (selectedBPR) {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date(form.date));

      const bprDrums = selectedBPR.dispatchedBatches || [];
      const plRows = bprDrums.map(d => ({
        batchNo: d.batchNo,
        drumNo: d.drumNo,
        gross: 0,
        tare: 0,
        net: 0
      }));

      setForm(prev => ({
        ...prev,
        plNo: docNo,
        productName: selectedBPR.productName,
        batches: plRows
      }));
    }
  }, [form.date, editingPL, selectedBPR, data.settings?.serials?.PL]);

  useEffect(() => {
    const totalDrums = form.batches.length;
    const totalWeight = form.batches.reduce((s, r) => s + r.net, 0);
    setForm(prev => ({ ...prev, totalDrums, totalWeight }));
  }, [form.batches]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
      list[idx] = item;
      return { ...prev, batches: list };
    });
  };

  const addCustomRow = () => {
    setForm(prev => ({
      ...prev,
      batches: [...prev.batches, { batchNo: activeBPR?.dispatchedBatches[0]?.batchNo || 'Custom', drumNo: (prev.batches.length + 1).toString(), gross: 0, tare: 0, net: 0 }]
    }));
  };

  const handleCreate = (bpr) => {
    setSelectedBPR(bpr);
    setEditingPL(null);
    setForm({
      plNo: '',
      date: new Date().toISOString().split('T')[0],
      productName: '',
      totalWeight: 0,
      totalDrums: 0,
      batches: []
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedBPR(null);
    setEditingPL(null);
    const plSerial = data.settings?.serials?.PL || 1;
    const docNo = generateDocNumber('PL', plSerial, new Date());
    setForm({
      plNo: docNo,
      date: new Date().toISOString().split('T')[0],
      productName: '',
      totalWeight: 0,
      totalDrums: 0,
      batches: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (pl) => {
    setEditingPL(pl);
    setForm(pl);
    setIsModalOpen(true);
  };

  const deletePL = (id) => {
    if (window.confirm("Delete this Packing List record?")) {
      deleteItemSoftly('packingLists', id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: editingPL ? editingPL.receiptId : (selectedBPR?.receiptId || '')
    };

    if (editingPL) {
      updateItem('packingLists', editingPL.id, finalDoc);
    } else {
      updateData('packingLists', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PL');
    }
    setIsModalOpen(false);
  };

  // Find BPRs that do not have a Packing List generated yet
  const pendingBPRs = data.bprs.filter(b => 
    !(data.packingLists || []).some(pl => pl.receiptId === b.receiptId)
  );

  const filteredPLs = (data.packingLists || []).filter(pl => 
    (pl.plNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pl.productName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Packing Lists (P.L.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate batch weight packlists carrying forward dispatched milling data.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Plus size={18} /> Create New PL
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending BPRs */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending BPR to Pack
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a completed batch to compile packing weight lists.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingBPRs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending BPRs awaiting packing lists.</p>
            ) : (
              pendingBPRs.map(bpr => (
                <div 
                  key={bpr.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(bpr)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{bpr.bprNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{bpr.partyName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{bpr.productName} - {bpr.totalDispatchedNet?.toFixed(1) || 0} Kg ({bpr.dispatchedBatches?.length || 0} Drums)</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Packing List History */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Packing List Log</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search PL No or chemical..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>PL No</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Total Weight</th>
                  <th style={{ padding: '0.75rem' }}>Total Drums</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPLs.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PL records found.</td></tr>
                ) : (
                  filteredPLs.map(pl => (
                    <tr key={pl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{pl.plNo}</td>
                      <td style={{ padding: '0.75rem' }}>{pl.productName}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{pl.totalWeight?.toFixed(2)} Kg</td>
                      <td style={{ padding: '0.75rem' }}>{pl.totalDrums} Drums</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('PL', pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(pl)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deletePL(pl.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
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

      {/* PL Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingPL ? 'Modify Packing List' : 'Create Packing List (P.L.)'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Packing List No</label>
                  <input type="text" className="input-field" readOnly value={form.plNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Packing List Date</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} />
                </div>
                <div>
                  <label>Total Weight (Calculated)</label>
                  <input type="text" className="input-field" readOnly value={`${form.totalWeight.toFixed(2)} Kg`} style={{ fontWeight: 600 }} />
                </div>
                <div>
                  <label>Total Number of Drums</label>
                  <input type="text" className="input-field" readOnly value={`${form.totalDrums} Drums`} style={{ fontWeight: 600 }} />
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Batch-Wise Packing Weight Details</h3>
                  <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={addCustomRow}>+ Add Column/Row</button>
                </div>
                
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.35rem' }}>Sr No</th>
                        <th style={{ padding: '0.35rem' }}>Batch No</th>
                        <th style={{ padding: '0.35rem' }}>Drum No</th>
                        <th style={{ padding: '0.35rem' }}>Gross Wt (Manual)</th>
                        <th style={{ padding: '0.35rem' }}>Tare Wt (Manual)</th>
                        <th style={{ padding: '0.35rem' }}>Net Wt (Auto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.batches.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.25rem', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                          <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                          <td style={{ padding: '0.25rem' }}>
                            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.gross} onChange={e => handleCellChange(idx, 'gross', e.target.value)} />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.tare} onChange={e => handleCellChange(idx, 'tare', e.target.value)} />
                          </td>
                          <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{r.net.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Packing List</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackingList;
