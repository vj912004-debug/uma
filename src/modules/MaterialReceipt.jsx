import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import ExportButton from '../components/ExportButton';
import { exportToPDF } from '../utils/pdfExport';
import { Plus, Search, FileDown, Edit2, Trash2, ShieldAlert } from 'lucide-react';

const MaterialReceipt = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Primary MR Form State
  const [formData, setFormData] = useState({
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    partyDocNo: '',
    partyDocDate: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    billAddress: '',
    gstinBill: '',
    shipAddress: '',
    gstinShip: '',
    productName: '',
    nickName: '',
    value: '', // Editable value of the material
    batches: [], // Array of { batchNo, drums: 0, qty: 0, psdReq: '', psdReport: 'No', psdMethod: '', isEmptyDrums: false }
    totalDrums: 0,
    totalQty: 0
  });

  // Keep serial code synced on open modal or date changes
  useEffect(() => {
    if (isModalOpen && !isEditing) {
      const mrSerial = data.settings?.serials?.MR || 1;
      const code = generateDocNumber('MR', mrSerial, new Date(formData.date));
      setFormData(prev => ({ ...prev, receiptNo: code }));
    }
  }, [formData.date, isModalOpen, isEditing, data.settings?.serials?.MR]);

  // Recalculate totals in real time whenever batches change
  useEffect(() => {
    const totalDrums = formData.batches.reduce((sum, b) => sum + (parseInt(b.drums) || 0), 0);
    const totalQty = formData.batches.reduce((sum, b) => sum + (b.isEmptyDrums ? 0 : (parseFloat(b.qty) || 0)), 0);
    setFormData(prev => ({ ...prev, totalDrums, totalQty }));
  }, [formData.batches]);

  // Triggered when Party selection changes
  const handlePartyChange = (e) => {
    const pId = e.target.value;
    if (!pId) {
      setFormData(prev => ({
        ...prev,
        partyId: '',
        partyName: '',
        billAddress: '',
        gstinBill: '',
        shipAddress: '',
        gstinShip: '',
        productName: '',
        nickName: '',
        batches: []
      }));
      return;
    }

    const party = data.parties.find(p => p.id === pId);
    if (party) {
      setFormData(prev => ({
        ...prev,
        partyId: pId,
        partyName: party.name,
        billAddress: party.billAddress || '',
        gstinBill: party.gstinBill || '',
        shipAddress: party.shipAddress || '',
        gstinShip: party.gstinShip || '',
        productName: '',
        nickName: '',
        batches: []
      }));
    }
  };

  // Triggered when Product selection changes
  const handleProductChange = (e) => {
    const prodName = e.target.value;
    const party = data.parties.find(p => p.id === formData.partyId);
    if (!party) return;

    const prodConfig = (party.products || []).find(p => p.name === prodName);
    if (prodConfig) {
      setFormData(prev => ({
        ...prev,
        productName: prodName,
        nickName: prodConfig.nickname || '',
        rates: {
          ...prev.rates,
          cleaning: prodConfig.charges?.cleaning || 0,
          filterBag: prodConfig.charges?.filterBag || 0,
          processing: prodConfig.charges?.processing || 0,
          sieving: prodConfig.charges?.sieving || 0,
          psdReport: prodConfig.charges?.psdReport || 0,
          liner: prodConfig.charges?.liner || 0,
          courier: prodConfig.charges?.courier || 0,
          fiberDrum: prodConfig.charges?.fiberDrum || 0,
          transportation: prodConfig.charges?.transportation || 0,
          hdpeDrum: prodConfig.charges?.hdpeDrum || 0,
          batchChangeover: prodConfig.charges?.batchChangeover || 0
        },
        charges: {
          ...prev.charges,
          cleaning: (prodConfig.charges?.cleaning || 0) > 0,
          filterBag: (prodConfig.charges?.filterBag || 0) > 0,
          processing: (prodConfig.charges?.processing || 0) > 0,
          sieving: (prodConfig.charges?.sieving || 0) > 0,
          psdReport: (prodConfig.charges?.psdReport || 0) > 0,
          liner: (prodConfig.charges?.liner || 0) > 0,
          courier: (prodConfig.charges?.courier || 0) > 0,
          fiberDrum: (prodConfig.charges?.fiberDrum || 0) > 0,
          transportation: (prodConfig.charges?.transportation || 0) > 0,
          hdpeDrum: (prodConfig.charges?.hdpeDrum || 0) > 0,
          batchChangeover: (prodConfig.charges?.batchChangeover || 0) > 0
        },
        batches: [
          { batchNo: '', drums: 1, qty: 0, psdReq: prodConfig.psdReq || '90% < 10M', psdReport: 'Yes', psdMethod: prodConfig.psdMethodDefault || 'Dry', isEmptyDrums: false }
        ]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productName: prodName,
        nickName: '',
        batches: []
      }));
    }
  };

  const handleAddBatchRow = () => {
    const party = data.parties.find(p => p.id === formData.partyId);
    const prodConfig = (party?.products || []).find(p => p.name === formData.productName);

    setFormData(prev => ({
      ...prev,
      batches: [
        ...prev.batches,
        { 
          batchNo: '', 
          drums: 1, 
          qty: 0, 
          psdReq: prodConfig?.psdReq || '90% < 10M', 
          psdReport: 'Yes', 
          psdMethod: prodConfig?.psdMethodDefault || 'Dry', 
          isEmptyDrums: false 
        }
      ]
    }));
  };

  const handleAddEmptyDrumsRow = () => {
    setFormData(prev => ({
      ...prev,
      batches: [
        ...prev.batches,
        { 
          batchNo: 'Empty Drums', 
          drums: 1, 
          qty: 0, 
          psdReq: '', 
          psdReport: 'No', 
          psdMethod: '', 
          isEmptyDrums: true 
        }
      ]
    }));
  };

  const handleRemoveBatchRow = (idx) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== idx)
    }));
  };

  const handleBatchCellChange = (idx, field, val) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.map((b, i) => i === idx ? { ...b, [field]: val } : b)
    }));
  };

  const handleEdit = (mr) => {
    setFormData(mr);
    setIsEditing(mr.id);
    setIsModalOpen(true);
  };

  const deleteReceipt = (id) => {
    if (window.confirm("Delete this material receipt? This will delete stock entries and affect downstream tracking.")) {
      deleteItemSoftly('materialReceipts', id);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      receiptNo: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      partyDocNo: '',
      partyDocDate: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      billAddress: '',
      gstinBill: '',
      shipAddress: '',
      gstinShip: '',
      productName: '',
      nickName: '',
      value: '',
      batches: [],
    totalDrums: 0,
    totalQty: 0,
    charges: { cleaning: false, filterBag: false, processing: false, sieving: false, psdReport: false, liner: false, courier: false, fiberDrum: false, transportation: false, hdpeDrum: false, batchChangeover: false },
    rates: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 },
    qtys: { cleaning: 1, filterBag: 1, processing: 1, sieving: 1, psdReport: 1, liner: 1, courier: 1, fiberDrum: 1, transportation: 1, hdpeDrum: 1, batchChangeover: 1 }
    });
    setIsEditing(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (!formData.partyId) {
        alert("Please select a Party.");
        return;
      }
      if (!formData.productName) {
        alert("Please select a Product.");
        return;
      }
      if (formData.batches.length === 0) {
        alert("Please add at least one batch details row.");
        return;
      }

      if (isEditing) {
        updateItem('materialReceipts', isEditing, { ...formData, id: isEditing });
      } else {
        const newReceipt = {
          ...formData,
          id: Date.now().toString(),
          status: 'Pending'
        };
        updateData('materialReceipts', newReceipt);
        incrementSerial('MR');
        
        // Auto-fill Production Planning
        formData.batches.forEach((batch, idx) => {
          if (!batch.isEmptyDrums) {
            const party = data.parties.find(p => p.id === formData.partyId);
            const prodConfig = (party?.products || []).find(p => p.name === formData.productName);
            
            const newPlan = {
              id: Date.now().toString() + '_' + idx,
              createdAt: new Date().toISOString(),
              customer: formData.partyName,
              productName: formData.productName,
              productNickName: formData.nickName,
              psdReq: batch.psdReq || prodConfig?.psdReq || '',
              psdNote: prodConfig?.psdNote || prodConfig?.notes || '',
              batchNo: batch.batchNo,
              qty: batch.qty,
              priorityLevel: 'Normal',
              specialInstructions: '',
              status: 'Pending',
              startDate: formData.date,
              startTime: '09:00',
              endDate: formData.date,
              endTime: '17:00',
              hours: '8.00',
              notes: ''
            };
            updateData('productionPlans', newPlan);
          }
        });
      }
      setIsModalOpen(false);
      setIsEditing(null);
    } catch (error) {
      console.error("Failed to save receipt:", error);
      alert("Error saving material receipt.");
    }
  };

  // Get active products for selected party
  const selectedPartyObj = data.parties.find(p => p.id === formData.partyId);
  const partyProducts = selectedPartyObj?.products || [];

  // Filtered List
  const filteredReceipts = (data.materialReceipts || []).filter(mr => 
    (mr.receiptNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mr.partyDocNo && mr.partyDocNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Active batch count (excluding Empty Drums)
  const activeBatchCount = formData.batches.filter(b => !b.isEmptyDrums).length;

  const tableCols = [
    { key: 'receiptNo', label: 'M.R. Number' },
    { key: 'date', label: 'Received Date' },
    { key: 'partyName', label: 'Party Name' },
    { key: 'productName', label: 'Product Name' },
    { key: 'totalDrums', label: 'Batches / Drums' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Material Received Data (M.R.)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Log incoming supplier raw materials, batches, and PSD method specifications.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filteredReceipts} columns={tableCols} filename="Material_Receipts" title="Material Receipts Log" />
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Add Material Receipt
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by M.R. No, Supplier Doc, Party or Product..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>M.R. Number</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Received Date</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Party Name</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Product Name</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Batches / Drums</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Qty</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No receipts found.</td>
                </tr>
              ) : (
                filteredReceipts.map(mr => {
                  const mrBatchesCount = (mr.batches || []).filter(b => !b.isEmptyDrums).length;
                  return (
                    <tr key={mr.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{mr.receiptNo}</td>
                      <td style={{ padding: '1rem' }}>{formatDate(mr.date)} {mr.time}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.partyName}</td>
                      <td style={{ padding: '1rem' }}>
                        <span>{mr.productName}</span>
                        {mr.nickName && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>({mr.nickName})</span>}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                        <p style={{ margin: 0 }}>Batches: {mrBatchesCount}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drums: {mr.totalDrums || 0}</p>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.totalQty || 0} Kg</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem',
                          background: mr.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: mr.status === 'Completed' ? '#10b981' : '#f59e0b',
                          fontWeight: 600
                        }}>
                          {mr.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleEdit(mr)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                          <button onClick={() => deleteReceipt(mr.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Material Receipt Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', overflowY: 'auto', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '950px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isEditing ? 'Modify Material Receipt' : 'Register Material Receipt'}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>M.R.: {formData.receiptNo}</span>
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>M.R. Date *</label>
                  <input type="date" className="input-field" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>M.R. Time *</label>
                  <input type="time" className="input-field" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Document No *</label>
                  <input type="text" className="input-field" required placeholder="Challan / Invoice No" value={formData.partyDocNo} onChange={e => setFormData({...formData, partyDocNo: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc Date *</label>
                  <input type="date" className="input-field" required value={formData.partyDocDate} onChange={e => setFormData({...formData, partyDocDate: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 4', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

                {/* Party Selection */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Name *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={formData.partyId}
                    onChange={handlePartyChange}
                  >
                    <option value="">Select Customer / Supplier</option>
                    {data.parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.vendorCode})</option>
                    ))}
                  </select>
                </div>

                {/* Product Selection linked to Party */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Select Product *</label>
                  <select 
                    className="input-field" 
                    required 
                    value={formData.productName}
                    onChange={handleProductChange}
                    disabled={!formData.partyId}
                  >
                    <option value="">Select Associated Product</option>
                    {partyProducts.map((p, idx) => (
                      <option key={idx} value={p.name}>{p.name} ({p.nickname})</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Nickname</label>
                  <input type="text" className="input-field" value={formData.nickName} onChange={e => setFormData({...formData, nickName: e.target.value})} />
                </div>

                {/* Addresses */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill To Address</label>
                  <textarea className="input-field" rows="2" value={formData.billAddress} readOnly style={{ background: 'rgba(255,255,255,0.01)', opacity: 0.8 }} />
                  <label style={{ marginTop: '0.5rem' }}>Bill To GSTIN</label>
                  <input type="text" className="input-field" value={formData.gstinBill} readOnly style={{ background: 'rgba(255,255,255,0.01)', opacity: 0.8 }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship To Address</label>
                  <textarea className="input-field" rows="2" value={formData.shipAddress} readOnly style={{ background: 'rgba(255,255,255,0.01)', opacity: 0.8 }} />
                  <label style={{ marginTop: '0.5rem' }}>Ship To GSTIN</label>
                  <input type="text" className="input-field" value={formData.gstinShip} readOnly style={{ background: 'rgba(255,255,255,0.01)', opacity: 0.8 }} />
                </div>

                <div>
                  <label>Material Declared Value (₹)</label>
                  <input type="number" className="input-field" placeholder="Editable" value={formData.value} onChange={e => setFormData({...formData, value: parseFloat(e.target.value) || ''})} />
                </div>
              </div>

              
              {/* Charges Specification Grid */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Pre-defined Applicable Charges</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Configure charges here so that Proforma Invoice (PI) and Tax Invoice auto-capture these rates.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {[
                    { key: 'cleaning', label: 'Minimum cleaning charges (998842)', isQtyRate: true },
                    { key: 'filterBag', label: 'Filter Bag charges (591190)', isQtyRate: false },
                    { key: 'processing', label: 'Processing charges (998842)', isQtyRate: true },
                    { key: 'sieving', label: 'Sieving charges (998842)', isQtyRate: true },
                    { key: 'psdReport', label: 'PSD report charges (998346)', isQtyRate: false },
                    { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
                    { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
                    { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
                    { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
                    { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
                    { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
                  ].map(item => (
                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.charges[item.key]} 
                          onChange={() => setFormData(prev => ({ ...prev, charges: { ...prev.charges, [item.key]: !prev.charges[item.key] } }))}
                        />
                        {item.label}
                      </label>
                      {formData.charges[item.key] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty:</span>
                          <input 
                            type="number" 
                            className="input-field" 
                            style={{ padding: '0.2rem', width: '60px', height: 'auto', fontSize: '0.8rem' }}
                            value={formData.qtys?.[item.key] || 1} 
                            onChange={e => setFormData(prev => ({ ...prev, qtys: { ...prev.qtys, [item.key]: parseFloat(e.target.value) || 0 } }))}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                          <input 
                            type="number" 
                            className="input-field" 
                            style={{ padding: '0.2rem', width: '80px', height: 'auto', fontSize: '0.8rem' }}
                            value={formData.rates[item.key]} 
                            onChange={e => setFormData(prev => ({ ...prev, rates: { ...prev.rates, [item.key]: parseFloat(e.target.value) || 0 } }))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Batch Grid Details */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Batch Detail Specification Grid</h3>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddEmptyDrumsRow} disabled={!formData.productName}>
                      + Add Empty Drums Row
                    </button>
                    <button type="button" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddBatchRow} disabled={!formData.productName}>
                      + Add Active Batch Row
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <datalist id="psdReqOptions">
                    {(data.psdRequirements || []).map((r, idx) => (
                      <option key={idx} value={r} />
                    ))}
                  </datalist>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem', width: '60px' }}>Sr No</th>
                        <th style={{ padding: '0.5rem' }}>Batch Number *</th>
                        <th style={{ padding: '0.5rem', width: '120px' }}>No of Drums *</th>
                        <th style={{ padding: '0.5rem', width: '150px' }}>Quantity (Kg) *</th>
                        <th style={{ padding: '0.5rem' }}>PSD Req *</th>
                        <th style={{ padding: '0.5rem', width: '120px' }}>PSD Report</th>
                        <th style={{ padding: '0.5rem', width: '120px' }}>PSD Method</th>
                        <th style={{ padding: '0.5rem', width: '60px' }}>Del</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.batches.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {!formData.productName ? 'Please select a Party and Product first.' : 'No batch details recorded. Add active or empty drum rows above.'}
                          </td>
                        </tr>
                      ) : (
                        formData.batches.map((batch, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: batch.isEmptyDrums ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <input 
                                type="text" 
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                required
                                readOnly={batch.isEmptyDrums}
                                value={batch.batchNo} 
                                onChange={e => handleBatchCellChange(idx, 'batchNo', e.target.value)} 
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                required
                                min="1"
                                value={batch.drums} 
                                onChange={e => handleBatchCellChange(idx, 'drums', parseInt(e.target.value) || 0)} 
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                required
                                disabled={batch.isEmptyDrums}
                                value={batch.isEmptyDrums ? '' : batch.qty} 
                                onChange={e => handleBatchCellChange(idx, 'qty', parseFloat(e.target.value) || 0)} 
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input 
                                type="text" 
                                list="psdReqOptions"
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                required
                                disabled={batch.isEmptyDrums}
                                value={batch.isEmptyDrums ? '' : batch.psdReq} 
                                onChange={e => handleBatchCellChange(idx, 'psdReq', e.target.value)} 
                              />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                disabled={batch.isEmptyDrums}
                                value={batch.psdReport} 
                                onChange={e => handleBatchCellChange(idx, 'psdReport', e.target.value)}
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '0.3rem', fontSize: '0.825rem' }} 
                                disabled={batch.isEmptyDrums}
                                value={batch.psdMethod} 
                                onChange={e => handleBatchCellChange(idx, 'psdMethod', e.target.value)}
                              >
                                <option value="Dry">Dry</option>
                                <option value="Wet">Wet</option>
                                <option value="">None</option>
                              </select>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }} onClick={() => handleRemoveBatchRow(idx)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {formData.batches.length > 0 && (
                      <tfoot>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 'bold' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>Total</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-primary)' }}>{activeBatchCount} Active Batches</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{formData.totalDrums} Drums</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{formData.totalQty.toFixed(2)} Kg</td>
                          <td colSpan="4"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => { setIsModalOpen(false); setIsEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Apply Updates' : 'Confirm Log Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialReceipt;
