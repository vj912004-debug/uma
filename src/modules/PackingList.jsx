import React, { useState, useEffect, useMemo } from 'react';
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
        gross: d.gross === 0 ? '' : (d.gross ?? ''),
        tare: d.tare === 0 ? '' : (d.tare ?? ''),
        net: d.net === 0 ? '' : (d.net ?? '')
      }));

      setForm(prev => ({
        ...prev,
        plNo: docNo,
        productName: selectedBPR.productName,
        batches: plRows
      }));
    }
  }, [form.date, editingPL, selectedBPR, data.settings?.serials?.PL]);

  const parseWt = (v) => (v === '' || v === undefined || v === null ? 0 : parseFloat(v) || 0);

  const batchGroups = useMemo(() => {
    const groups = [];
    const map = {};
    (form.batches || []).forEach((b, idx) => {
      const key = b.batchNo || 'Unknown';
      if (!map[key]) {
        map[key] = { batchNo: key, rows: [], gross: 0, tare: 0, net: 0, drums: 0 };
        groups.push(map[key]);
      }
      const net = b.net !== '' && b.net !== undefined ? parseWt(b.net) : Math.max(0, parseWt(b.gross) - parseWt(b.tare));
      map[key].rows.push({ ...b, idx, netVal: net });
      map[key].gross += parseWt(b.gross);
      map[key].tare += parseWt(b.tare);
      map[key].net += net;
      map[key].drums += 1;
    });
    return groups;
  }, [form.batches]);

  const grandTotal = useMemo(() => batchGroups.reduce((acc, g) => ({
    gross: acc.gross + g.gross,
    tare: acc.tare + g.tare,
    net: acc.net + g.net,
    drums: acc.drums + g.drums
  }), { gross: 0, tare: 0, net: 0, drums: 0 }), [batchGroups]);

  useEffect(() => {
    setForm(prev => ({ ...prev, totalDrums: prev.batches.length, totalWeight: grandTotal.net }));
  }, [grandTotal.net, form.batches.length]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      item[field] = val === '' ? '' : (parseFloat(val) || '');
      if (field === 'gross' || field === 'tare') {
        const g = parseWt(item.gross);
        const t = parseWt(item.tare);
        item.net = (item.gross === '' || item.tare === '') ? '' : Math.max(0, g - t);
      }
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
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
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

              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Batch-Wise Packing Weight Details</h3>
                  <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={addCustomRow}>+ Add Column/Row</button>
                </div>
                
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.35rem' }}>Sr No</th>
                        <th style={{ padding: '0.35rem' }}>Batch No</th>
                        <th style={{ padding: '0.35rem' }}>Drum No</th>
                        <th style={{ padding: '0.35rem' }}>Gross Wt (Manual)</th>
                        <th style={{ padding: '0.35rem' }}>Tare Wt (Manual)</th>
                        <th style={{ padding: '0.35rem' }}>Net Wt (Auto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchGroups.map((group) => (
                        <React.Fragment key={group.batchNo}>
                          {group.rows.map((r) => (
                            <tr key={r.idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.idx + 1}</td>
                              <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                              <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                              <td style={{ padding: '0.25rem' }}>
                                <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.gross === 0 ? '' : r.gross} onChange={e => handleCellChange(r.idx, 'gross', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.25rem' }}>
                                <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.tare === 0 ? '' : r.tare} onChange={e => handleCellChange(r.idx, 'tare', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                {r.netVal > 0 ? r.netVal.toFixed(2) : ''}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: 'rgba(16, 185, 129, 0.06)', borderBottom: '2px solid var(--border-color)' }}>
                            <td colSpan={3} style={{ padding: '0.5rem', fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                              Batch {group.batchNo} Total ({group.drums} Drums)
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{group.gross > 0 ? group.gross.toFixed(2) : '—'}</td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{group.tare > 0 ? group.tare.toFixed(2) : '—'}</td>
                            <td style={{ padding: '0.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{group.net > 0 ? group.net.toFixed(2) : '—'}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      {batchGroups.length > 0 && (
                        <tr style={{ background: 'rgba(59, 130, 246, 0.08)', borderTop: '2px solid var(--accent-secondary)' }}>
                          <td colSpan={3} style={{ padding: '0.65rem', fontWeight: 800, fontSize: '0.85rem' }}>
                            ALL BATCHES GRAND TOTAL ({grandTotal.drums} Drums)
                          </td>
                          <td style={{ padding: '0.65rem', fontWeight: 700 }}>{grandTotal.gross > 0 ? grandTotal.gross.toFixed(2) : '—'}</td>
                          <td style={{ padding: '0.65rem', fontWeight: 700 }}>{grandTotal.tare > 0 ? grandTotal.tare.toFixed(2) : '—'}</td>
                          <td style={{ padding: '0.65rem', fontWeight: 800, color: 'var(--accent-secondary)', fontSize: '0.9rem' }}>{grandTotal.net > 0 ? grandTotal.net.toFixed(2) : '—'}</td>
                        </tr>
                      )}
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
