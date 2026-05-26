import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const DeliveryChallan = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedPL, setSelectedPL] = useState(null);

  // DC Form State
  const [form, setForm] = useState({
    dcNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: '',
    partyDocDate: '',
    partyName: '',
    billAddress: '',
    shipAddress: '',
    gstinBill: '',
    gstinShip: '',
    productName: '',
    qty: 0,
    totalDrums: 0,
    value: 0,
    vehicleNo: '',
    driverName: '',
    termsAndConditions: 'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
  });

  const activePL = editingDoc ? data.packingLists.find(p => p.receiptId === editingDoc.receiptId) : selectedPL;
  const activeMR = data.materialReceipts.find(mr => mr.id === (activePL?.receiptId || editingDoc?.receiptId));
  const activePI = data.invoices.find(inv => inv.receiptId === activeMR?.id && inv.invoiceNo?.includes('/PI/'));

  useEffect(() => {
    if (editingDoc) {
      setForm(editingDoc);
    } else if (selectedPL && activeMR) {
      const dcSerial = data.settings?.serials?.DC || 1;
      const docNo = generateDocNumber('DC', dcSerial, new Date(form.date));

      setForm({
        dcNo: docNo,
        date: new Date().toISOString().split('T')[0],
        partyDocNo: activeMR.partyDocNo || '',
        partyDocDate: activeMR.partyDocDate || '',
        partyName: activeMR.partyName,
        billAddress: activeMR.billAddress,
        shipAddress: activeMR.shipAddress,
        gstinBill: activeMR.gstinBill,
        gstinShip: activeMR.gstinShip,
        productName: activeMR.productName,
        qty: selectedPL.totalWeight || activeMR.totalQty,
        totalDrums: selectedPL.totalDrums || activeMR.totalDrums,
        value: activePI?.total || activeMR.value || 0,
        vehicleNo: '',
        driverName: '',
        termsAndConditions: 'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
      });
    }
  }, [form.date, editingDoc, selectedPL, activeMR, activePI, data.settings?.serials?.DC]);

  const handleCreate = (pl) => {
    setSelectedPL(pl);
    setEditingDoc(null);
    setIsModalOpen(true);
  };

  const handleEdit = (dc) => {
    setEditingDoc(dc);
    setForm(dc);
    setIsModalOpen(true);
  };

  const deleteDC = (id) => {
    if (window.confirm("Delete this Delivery Challan record?")) {
      deleteItemSoftly('deliveryChallans', id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: activeMR.id
    };

    if (editingDoc) {
      updateItem('deliveryChallans', editingDoc.id, finalDoc);
    } else {
      updateData('deliveryChallans', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('DC');
    }
    setIsModalOpen(false);
  };

  // Find PLs that do not have a DC generated yet
  const pendingPLs = data.packingLists.filter(pl => 
    !(data.deliveryChallans || []).some(dc => dc.receiptId === pl.receiptId)
  );

  const filteredDCs = (data.deliveryChallans || []).filter(dc => 
    dc.dcNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dc.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dc.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Delivery Challans (D.C.)</h1>
        <p style={{ color: 'var(--text-muted)' }}>Generate transport dispatch delivery challans mapped to packing lists.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending PLs */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending PL to Dispatch
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a packing list to create transport Delivery Challans.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingPLs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending packing lists awaiting dispatch.</p>
            ) : (
              pendingPLs.map(pl => (
                <div 
                  key={pl.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(pl)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{pl.plNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{pl.productName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Weight: {pl.totalWeight?.toFixed(1) || 0} Kg ({pl.totalDrums} Drums)</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: DC History */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Delivery Challan Log</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search DC No, customer or vehicle..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>DC No</th>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Qty (Net)</th>
                  <th style={{ padding: '0.75rem' }}>Vehicle No</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDCs.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No DC records found.</td></tr>
                ) : (
                  filteredDCs.map(dc => (
                    <tr key={dc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{dc.dcNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{dc.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{dc.productName}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{dc.qty} Kg</td>
                      <td style={{ padding: '0.75rem' }}>{dc.vehicleNo}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('DC', dc)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(dc)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteDC(dc.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
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

      {/* DC Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDoc ? 'Modify Delivery Challan' : 'Create Delivery Challan (D.C.)'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Delivery Challan No</label>
                  <input type="text" className="input-field" readOnly value={form.dcNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>DC Date</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Document No</label>
                  <input type="text" className="input-field" readOnly value={form.partyDocNo} />
                </div>
                <div>
                  <label>Supplier Doc Date</label>
                  <input type="text" className="input-field" readOnly value={form.partyDocDate} />
                </div>

                <div style={{ gridColumn: 'span 4', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

                <div>
                  <label>Product Name</label>
                  <input type="text" className="input-field" readOnly value={form.productName} />
                </div>
                <div>
                  <label>Micronised Qty (Kg)</label>
                  <input type="number" className="input-field" required value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label>Total Drums *</label>
                  <input type="number" className="input-field" required value={form.totalDrums} onChange={e => setForm({...form, totalDrums: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label>Value of Goods (₹)</label>
                  <input type="number" className="input-field" required value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Vehicle No *</label>
                  <input type="text" className="input-field" required placeholder="e.g. GJ-01-XX-0000" value={form.vehicleNo} onChange={e => setForm({...form, vehicleNo: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Driver Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Ramesh Kumar" value={form.driverName} onChange={e => setForm({...form, driverName: e.target.value})} />
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <label>Terms & Conditions / Dispatch Description</label>
                  <textarea className="input-field" rows="2" value={form.termsAndConditions} onChange={e => setForm({...form, termsAndConditions: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Delivery Challan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryChallan;
