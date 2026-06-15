import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF } from '../utils/pdfExport';
import ExportButton from '../components/ExportButton';
import { Plus, Search, Edit2, Trash2, ClipboardList, FileDown } from 'lucide-react';

const emptyRow = (batchNo, drumNo) => ({ batchNo, drumNo, gross: '', tare: '', net: '' });

const calcNet = (gross, tare) => {
  if (gross === '' || gross === undefined || tare === '' || tare === undefined) return '';
  const g = parseFloat(gross);
  const t = parseFloat(tare);
  if (isNaN(g) || isNaN(t)) return '';
  return Math.max(0, g - t);
};

const sumNet = (rows) => rows.reduce((s, r) => {
  const n = r.net !== '' && r.net !== undefined ? parseFloat(r.net) : calcNet(r.gross, r.tare);
  return s + (typeof n === 'number' && !isNaN(n) ? n : 0);
}, 0);

const normalizeRow = (r) => ({
  ...r,
  gross: r.gross === 0 ? '' : (r.gross ?? ''),
  tare: r.tare === 0 ? '' : (r.tare ?? ''),
  net: r.net === 0 ? '' : (r.net ?? '')
});

const displayNet = (net, gross, tare) => {
  const val = net !== '' && net !== undefined ? net : calcNet(gross, tare);
  return val === '' ? '' : (typeof val === 'number' ? val.toFixed(2) : val);
};

const BPR = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBPR, setEditingBPR] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);
  const [activeTab, setActiveTab] = useState('page1');

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
    receivedBatches: [],
    dispatchedBatches: [],
    cleaningChecklist: { equipmentCleaned: false, areaCleaned: false, lineClearance: false, bagClean: false },
    pressureMetrics: { grindingPressure: '', injectionPressure: '', feedingSP: '', feedingDP: '', feedingTP: '', millingFP: '', millingFiP: '' },
    packingConsumables: { fiberDrumsUsed: '', hdpeDrumsUsed: '', linersUsed: '', whiteLdBags: '', blackLdBags: '', brownTapes: '', drumUsed: '', otherDetails: '' },
    processingSupervisor: '',
    materialReceivedDate: '',
    materialReceivedTime: '',
    committedDate: '',
    committedTime: '',
    processingStartDate: '',
    processingStartTime: '',
    sizingReportRequired: '',
    particleSizeResult: '',
    lumpsNetWeight: '',
    floorDustNetWeight: '',
    sampleNetWeight: '',
    irrecoverableLoss: '',
    processLoss: '',
    dispatchRemark: '',
    remark: '',
    filterBagPacked: false,
    processCompletionDate: '',
    processCompletionTime: ''
  });

  const totalReceivedNet = sumNet(form.receivedBatches);
  const totalDispatchedNet = sumNet(form.dispatchedBatches);

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setEditingBPR(null);
    setActiveTab('page1');

    const bprSerial = data.settings?.serials?.BPR || 1;
    const docNo = generateDocNumber('BPR', bprSerial, new Date(form.date));

    const activeMRBatches = mr.batches.filter(b => !b.isEmptyDrums);
    const receivedRows = [];
    activeMRBatches.forEach(b => {
      const drumCount = parseInt(b.drums) || 1;
      for (let d = 1; d <= drumCount; d++) {
        receivedRows.push(emptyRow(b.batchNo, d.toString()));
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
      cleaningChecklist: { equipmentCleaned: false, areaCleaned: false, lineClearance: false, bagClean: false },
      pressureMetrics: { grindingPressure: '', injectionPressure: '', feedingSP: '', feedingDP: '', feedingTP: '', millingFP: '', millingFiP: '' },
      packingConsumables: { fiberDrumsUsed: '', hdpeDrumsUsed: '', linersUsed: '', whiteLdBags: '', blackLdBags: '', brownTapes: '', drumUsed: '', otherDetails: '' },
      processingSupervisor: '',
      materialReceivedDate: mr.date || '',
      materialReceivedTime: mr.time || '',
      committedDate: '',
      committedTime: '',
      processingStartDate: '',
      processingStartTime: '',
      sizingReportRequired: '',
      particleSizeResult: '',
      lumpsNetWeight: '',
      floorDustNetWeight: '',
      sampleNetWeight: '',
      irrecoverableLoss: '',
      processLoss: '',
      dispatchRemark: '',
      remark: '',
      filterBagPacked: false,
      processCompletionDate: '',
      processCompletionTime: ''
    });

    setIsModalOpen(true);
  };

  const handleEdit = (bpr) => {
    setEditingBPR(bpr);
    setActiveTab('page1');
    setForm({
      ...bpr,
      receivedBatches: (bpr.receivedBatches || []).map(normalizeRow),
      dispatchedBatches: (bpr.dispatchedBatches || []).map(normalizeRow),
      cleaningChecklist: { equipmentCleaned: false, areaCleaned: false, lineClearance: false, bagClean: false, ...(bpr.cleaningChecklist || {}) },
      packingConsumables: {
        fiberDrumsUsed: '', hdpeDrumsUsed: '', linersUsed: '', whiteLdBags: '', blackLdBags: '', brownTapes: '', drumUsed: '', otherDetails: '',
        ...(bpr.packingConsumables || {})
      }
    });
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
      item[field] = val === '' ? '' : (parseFloat(val) || '');
      if (field === 'gross' || field === 'tare') {
        item.net = calcNet(item.gross, item.tare);
      }
      list[idx] = item;
      return { ...prev, [tableKey]: list };
    });
  };

  const addCustomRow = (tableKey) => {
    setForm(prev => ({
      ...prev,
      [tableKey]: [...prev[tableKey], emptyRow('Custom', (prev[tableKey].length + 1).toString())]
    }));
  };

  const renderWeightTable = (tableKey, title) => (
    <div style={{ background: 'var(--input-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h4>
        <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow(tableKey)}>+ Add Row</button>
      </div>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.35rem' }}>Batch No</th>
              <th style={{ padding: '0.35rem' }}>Drum No</th>
              <th style={{ padding: '0.35rem' }}>Gross</th>
              <th style={{ padding: '0.35rem' }}>Tare</th>
              <th style={{ padding: '0.35rem' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {form[tableKey].map((r, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                <td style={{ padding: '0.25rem' }}>
                  <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.gross === 0 ? '' : r.gross} onChange={e => handleCellChange(tableKey, idx, 'gross', e.target.value)} />
                </td>
                <td style={{ padding: '0.25rem' }}>
                  <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} placeholder="—" value={r.tare === 0 ? '' : r.tare} onChange={e => handleCellChange(tableKey, idx, 'tare', e.target.value)} />
                </td>
                <td style={{ padding: '0.25rem', fontWeight: 600 }}>{displayNet(r.net, r.gross, r.tare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
        <span>Total:</span>
        <span>{tableKey === 'receivedBatches' ? totalReceivedNet.toFixed(2) : totalDispatchedNet.toFixed(2)} Kg</span>
      </div>
    </div>
  );

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

  const tableCols = [
    { key: 'bprNo', label: 'BPR No' },
    { key: 'partyName', label: 'Party Name' },
    { key: 'productName', label: 'Product Name' },
    { key: 'totalDispatchedNet', label: 'Total Net Weight (Kg)' },
    { key: 'totalDispatchedGross', label: 'Total Gross Weight (Kg)' }
  ];

  return (
    <div>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Batch Processing Records (BPR)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Monitor milled batches and double-check dispatched weights.</p>
        </div>
        <ExportButton data={filteredBPRs} columns={tableCols} filename="BPR_Records" title="Batch Processing Records" />
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
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>{editingBPR ? 'Modify BPR' : 'Create Batch Processing Record (BPR)'}</h2>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab('page1')}
                style={{
                  background: activeTab === 'page1' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: activeTab === 'page1' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  border: activeTab === 'page1' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)'
                }}
              >
                Page 1 — Batch Processing Record
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab('page2')}
                style={{
                  background: activeTab === 'page2' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  color: activeTab === 'page2' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  border: activeTab === 'page2' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)'
                }}
              >
                Page 2 — Batch Packing Record
              </button>
            </div>
            
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

              {activeTab === 'page1' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={form.cleaningChecklist.bagClean} onChange={e => setForm({...form, cleaningChecklist: {...form.cleaningChecklist, bagClean: e.target.checked}})} />
                        Bag clean & black spot free
                      </label>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Processing Timeline</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Material Received Date</label>
                          <input type="date" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.materialReceivedDate || ''} onChange={e => setForm({...form, materialReceivedDate: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Time</label>
                          <input type="time" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.materialReceivedTime || ''} onChange={e => setForm({...form, materialReceivedTime: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Committed Date</label>
                          <input type="date" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.committedDate || ''} onChange={e => setForm({...form, committedDate: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Time</label>
                          <input type="time" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.committedTime || ''} onChange={e => setForm({...form, committedTime: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Processing Start Date</label>
                          <input type="date" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.processingStartDate || ''} onChange={e => setForm({...form, processingStartDate: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem' }}>Time</label>
                          <input type="time" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} value={form.processingStartTime || ''} onChange={e => setForm({...form, processingStartTime: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Pressure Metrics</h4>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Grinding Pressure (kg/cm²)</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.pressureMetrics.grindingPressure} onChange={e => setForm({...form, pressureMetrics: {...form.pressureMetrics, grindingPressure: e.target.value}})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem' }}>Injection Pressure (kg/cm²)</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.pressureMetrics.injectionPressure} onChange={e => setForm({...form, pressureMetrics: {...form.pressureMetrics, injectionPressure: e.target.value}})} />
                      </div>
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Processing Supervisor</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.processingSupervisor || ''} onChange={e => setForm({...form, processingSupervisor: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--accent-primary)' }}>Packing Consumables</h4>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Fiber Drums Used</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.packingConsumables.fiberDrumsUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, fiberDrumsUsed: e.target.value}})} />
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>HDPE Drums Used</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.packingConsumables.hdpeDrumsUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, hdpeDrumsUsed: e.target.value}})} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem' }}>Liners / White LD Bags</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.packingConsumables.whiteLdBags || form.packingConsumables.linersUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, whiteLdBags: e.target.value, linersUsed: e.target.value}})} />
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Black LD Bags</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.packingConsumables.blackLdBags} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, blackLdBags: e.target.value}})} />
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Brown Tapes / Drum Used</label>
                        <input type="text" className="input-field" style={{ padding: '0.3rem', fontSize: '0.85rem' }} placeholder="—" value={form.packingConsumables.brownTapes || form.packingConsumables.drumUsed || form.packingConsumables.fiberDrumsUsed} onChange={e => setForm({...form, packingConsumables: {...form.packingConsumables, brownTapes: e.target.value, drumUsed: e.target.value, fiberDrumsUsed: e.target.value}})} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label>Sizing Report Required</label>
                      <input type="text" className="input-field" placeholder="—" value={form.sizingReportRequired || ''} onChange={e => setForm({...form, sizingReportRequired: e.target.value})} />
                    </div>
                    <div>
                      <label>Particle Size Result</label>
                      <input type="text" className="input-field" placeholder="—" value={form.particleSizeResult || ''} onChange={e => setForm({...form, particleSizeResult: e.target.value})} />
                    </div>
                    <div>
                      <label>Total Input Qty (Kg)</label>
                      <input type="text" className="input-field" placeholder="—" value={form.totalInputQty || ''} onChange={e => setForm({...form, totalInputQty: e.target.value})} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <label>Micronized Material Net Weight</label>
                      <input type="text" className="input-field" placeholder="—" value={totalDispatchedNet > 0 ? totalDispatchedNet.toFixed(2) : ''} readOnly style={{ opacity: 0.7 }} />
                    </div>
                    <div>
                      <label>Lumps Net Weight</label>
                      <input type="text" className="input-field" placeholder="—" value={form.lumpsNetWeight || ''} onChange={e => setForm({...form, lumpsNetWeight: e.target.value})} />
                    </div>
                    <div>
                      <label>Floor Dust Net Weight</label>
                      <input type="text" className="input-field" placeholder="—" value={form.floorDustNetWeight || ''} onChange={e => setForm({...form, floorDustNetWeight: e.target.value})} />
                    </div>
                    <div>
                      <label>Net Process Loss</label>
                      <input type="text" className="input-field" placeholder="—" value={form.processLoss || ''} onChange={e => setForm({...form, processLoss: e.target.value})} />
                    </div>
                    <div>
                      <label>Sample Net Weight</label>
                      <input type="text" className="input-field" placeholder="—" value={form.sampleNetWeight || ''} onChange={e => setForm({...form, sampleNetWeight: e.target.value})} />
                    </div>
                    <div>
                      <label>Irrecoverable Loss</label>
                      <input type="text" className="input-field" placeholder="—" value={form.irrecoverableLoss || form.processLoss || ''} onChange={e => setForm({...form, irrecoverableLoss: e.target.value, processLoss: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label>Remark</label>
                      <textarea className="input-field" rows="2" placeholder="—" value={form.remark || form.dispatchRemark || ''} onChange={e => setForm({...form, remark: e.target.value, dispatchRemark: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginTop: '1.5rem' }}>
                        <input type="checkbox" checked={form.filterBagPacked} onChange={e => setForm({...form, filterBagPacked: e.target.checked})} />
                        Filter bag packed in HDPE after processing
                      </label>
                    </div>
                    <div>
                      <label>Process Completion Date</label>
                      <input type="date" className="input-field" value={form.processCompletionDate || ''} onChange={e => setForm({...form, processCompletionDate: e.target.value})} />
                    </div>
                    <div>
                      <label>Process Completion Time</label>
                      <input type="time" className="input-field" value={form.processCompletionTime || ''} onChange={e => setForm({...form, processCompletionTime: e.target.value})} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'page2' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Received vs Dispatched Weight Tables</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      <input type="checkbox" checked={form.doubleDispatch} onChange={toggleDoubleDispatch} />
                      Double Dispatch Drums (A/B split)
                    </label>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Weight fields are left blank for manual entry. Net weight auto-calculates when gross and tare are filled.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {renderWeightTable('receivedBatches', 'Received Raw Material Weight')}
                    {renderWeightTable('dispatchedBatches', 'Dispatched (Micronised) Weight')}
                  </div>
                </>
              )}

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
