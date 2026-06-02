import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const TaxInvoice = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedPL, setSelectedPL] = useState(null);

  // TI Form State
  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dcNo: '',
    dcDate: '',
    partyDocNo: '',
    partyDocDate: '',
    billAddress: '',
    shipAddress: '',
    gstinBill: '',
    gstinShip: '',
    partyName: '',
    productName: '',
    qty: 0,
    charges: {
      cleaning: true,
      filterBag: false,
      processing: true,
      sieving: false,
      psdReport: false,
      liner: false,
      courier: false,
      fiberDrum: false,
      transportation: false,
      hdpeDrum: false,
      batchChangeover: false
    },
    rates: {
      cleaning: 0,
      filterBag: 0,
      processing: 0,
      sieving: 0,
      psdReport: 0,
      liner: 0,
      courier: 0,
      fiberDrum: 0,
      transportation: 0,
      hdpeDrum: 0,
      batchChangeover: 0
    },
    discount: 0,
    taxRate: 18,
    terms: 'Payment against delivery.',
    customCharges: [] // Array of { name: '', hsn: '', rate: 0, qty: 1, checked: true }
  });

  const activePL = editingDoc ? data.packingLists.find(p => p.receiptId === editingDoc.receiptId) : selectedPL;
  const activeMR = data.materialReceipts.find(mr => mr.id === (activePL?.receiptId || editingDoc?.receiptId));
  const dc = data.deliveryChallans.find(d => d.receiptId === activeMR?.id);
  const party = data.parties.find(p => p.id === activeMR?.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === activeMR?.productName);

  useEffect(() => {
    if (editingDoc) {
      setForm(editingDoc);
    } else if (selectedPL && activeMR) {
      const tiSerial = data.settings?.serials?.TI || 1;
      const docNo = generateDocNumber('IN', tiSerial, new Date(form.date));
      const defaultRates = prodConfig?.charges || {};

      setForm(prev => ({
        ...prev,
        invoiceNo: docNo,
        dcNo: dc?.dcNo || 'N/A',
        dcDate: dc?.date || 'N/A',
        partyDocNo: activeMR.partyDocNo,
        partyDocDate: activeMR.partyDocDate,
        billAddress: activeMR.billAddress || '',
        shipAddress: activeMR.shipAddress || '',
        gstinBill: activeMR.gstinBill || '',
        gstinShip: activeMR.gstinShip || '',
        partyName: activeMR.partyName,
        productName: activeMR.productName,
        qty: activePL.totalWeight,
        rates: {
          cleaning: defaultRates.cleaning || 0,
          filterBag: defaultRates.filterBag || 0,
          processing: defaultRates.processing || 0,
          sieving: defaultRates.sieving || 0,
          psdReport: (prodConfig?.psdMethodDefault === 'Wet' ? (defaultRates.psdReportWet || 0) : (defaultRates.psdReportDry || 0)) || defaultRates.psdReport || 0,
          liner: defaultRates.liner || 0,
          courier: defaultRates.courier || 0,
          fiberDrum: defaultRates.fiberDrum || 0,
          transportation: defaultRates.transportation || 0,
          hdpeDrum: defaultRates.hdpeDrum || 0,
          batchChangeover: defaultRates.batchChangeover || 0
        },
        customCharges: activeMR.customCharges ? JSON.parse(JSON.stringify(activeMR.customCharges)) : []
      }));
    }
  }, [form.date, editingDoc, selectedPL, activeMR, dc, prodConfig, data.settings?.serials?.TI]);

  const toggleCharge = (key) => {
    setForm(prev => ({
      ...prev,
      charges: { ...prev.charges, [key]: !prev.charges[key] }
    }));
  };

  const handleRateChange = (key, val) => {
    setForm(prev => ({
      ...prev,
      rates: { ...prev.rates, [key]: parseFloat(val) || 0 }
    }));
  };

  const getSubtotal = () => {
    const standardSum = Object.keys(form.charges).reduce((sum, key) => {
      if (form.charges[key]) {
        const isQtyRate = ['processing', 'sieving', 'cleaning'].includes(key);
        const qty = parseFloat(form.qty) || 0;
        const rate = form.rates[key] || 0;
        return sum + (isQtyRate ? qty * rate : rate);
      }
      return sum;
    }, 0);

    const customSum = (form.customCharges || []).reduce((sum, charge) => {
      if (charge.checked) {
        return sum + ((parseFloat(charge.qty) || 0) * (parseFloat(charge.rate) || 0));
      }
      return sum;
    }, 0);

    return standardSum + customSum;
  };

  const handleCreate = (pl) => {
    setSelectedPL(pl);
    setEditingDoc(null);
    setForm({
      invoiceNo: '',
      date: new Date().toISOString().split('T')[0],
      dcNo: '',
      dcDate: '',
      partyDocNo: '',
      partyDocDate: '',
      billAddress: '',
      shipAddress: '',
      gstinBill: '',
      gstinShip: '',
      charges: {
        cleaning: true, filterBag: false, processing: true, sieving: false,
        psdReport: false, liner: false, courier: false, fiberDrum: false,
        transportation: false, hdpeDrum: false, batchChangeover: false
      },
      rates: {
        cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
        liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0
      },
      discount: 0,
      taxRate: 18,
      terms: 'Payment against delivery.',
      partyName: '',
      productName: '',
      qty: 0,
      customCharges: []
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedPL(null);
    setEditingDoc(null);
    const tiSerial = data.settings?.serials?.TI || 1;
    const docNo = generateDocNumber('IN', tiSerial, new Date());
    setForm({
      invoiceNo: docNo,
      date: new Date().toISOString().split('T')[0],
      dcNo: '',
      dcDate: '',
      partyDocNo: '',
      partyDocDate: '',
      billAddress: '',
      shipAddress: '',
      gstinBill: '',
      gstinShip: '',
      charges: {
        cleaning: true, filterBag: false, processing: true, sieving: false,
        psdReport: false, liner: false, courier: false, fiberDrum: false,
        transportation: false, hdpeDrum: false, batchChangeover: false
      },
      rates: {
        cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
        liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0
      },
      discount: 0,
      taxRate: 18,
      terms: 'Payment against delivery.',
      partyName: '',
      productName: '',
      qty: 0,
      customCharges: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (ti) => {
    setEditingDoc(ti);
    setForm(ti);
    setIsModalOpen(true);
  };

  const deleteTI = (id) => {
    if (window.confirm("Delete this Tax Invoice?")) {
      deleteItemSoftly('invoices', id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = getSubtotal();
    const discountAmount = parseFloat(form.discount) || 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxable * (form.taxRate / 100);
    const total = taxable + taxAmount;

    const finalDoc = {
      ...form,
      receiptId: activeMR?.id || activePL?.receiptId || '',
      partyName: form.partyName,
      productName: form.productName,
      qty: form.qty,
      subtotal,
      taxAmount,
      total,
      type: 'Tax Invoice',
      ewayBillNo: editingDoc?.ewayBillNo || '',
      ewayBillDate: editingDoc?.ewayBillDate || ''
    };

    if (editingDoc) {
      updateItem('invoices', editingDoc.id, finalDoc);
    } else {
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('TI');
    }
    setIsModalOpen(false);
  };

  const pendingPLs = data.packingLists.filter(pl => 
    !(data.invoices || []).some(inv => inv.receiptId === pl.receiptId && inv.invoiceNo?.includes('/IN/'))
  );

  const filteredInvoices = (data.invoices || []).filter(inv => 
    inv.invoiceNo?.includes('/IN/') &&
    (inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const chargesList = [
    { key: 'cleaning', label: 'Cleaning Charges (998842)', isQtyRate: true },
    { key: 'filterBag', label: 'Filter Bag Charges (591190)', isQtyRate: false },
    { key: 'processing', label: 'Processing Charges (998842)', isQtyRate: true },
    { key: 'sieving', label: 'Sieving Charges (998842)', isQtyRate: true },
    { key: 'psdReport', label: 'PSD Report Charges (998346)', isQtyRate: false },
    { key: 'liner', label: 'Liner (39233090)', isQtyRate: false },
    { key: 'courier', label: 'Courier (996812)', isQtyRate: false },
    { key: 'fiberDrum', label: 'Fiber Drum (7310)', isQtyRate: false },
    { key: 'transportation', label: 'Transportation (996511)', isQtyRate: false },
    { key: 'hdpeDrum', label: 'HDPE Drum (39233090)', isQtyRate: false },
    { key: 'batchChangeover', label: 'Batch Changeover (998842)', isQtyRate: false }
  ];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Tax Invoices</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate and manage billing against finalized delivery challans.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Plus size={18} /> Create New Tax Invoice
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending Invoicing Queue
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a packed dispatch to generate commercial Tax Invoices.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingPLs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending dispatches awaiting invoices.</p>
            ) : (
              pendingPLs.map(pl => (
                <div 
                  key={pl.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(pl)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{pl.plNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{pl.productName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Weight: {pl.totalWeight?.toFixed(1) || 0} Kg</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: TI Log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Tax Invoice Log History</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search Invoice No, customer or chemical..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>Invoice No</th>
                  <th style={{ padding: '0.75rem' }}>Customer</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Qty</th>
                  <th style={{ padding: '0.75rem' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No Tax Invoices found.</td></tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{inv.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{inv.productName}</td>
                      <td style={{ padding: '0.75rem' }}>{inv.qty} Kg</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{inv.total.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('TI', inv)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(inv)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteTI(inv.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
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

      {/* Tax Invoice Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDoc ? 'Modify Tax Invoice' : 'Create Tax Invoice'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Invoice Number</label>
                  <input type="text" className="input-field" value={form.invoiceNo} onChange={e => setForm({...form, invoiceNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Invoice Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Delivery Challan No</label>
                  <input type="text" className="input-field" value={form.dcNo} onChange={e => setForm({...form, dcNo: e.target.value})} />
                </div>
                <div>
                  <label>Delivery Challan Date</label>
                  <input type="text" className="input-field" value={form.dcDate} onChange={e => setForm({...form, dcDate: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc No</label>
                  <input type="text" className="input-field" value={form.partyDocNo} onChange={e => setForm({...form, partyDocNo: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc Date</label>
                  <input type="date" className="input-field" value={form.partyDocDate} onChange={e => setForm({...form, partyDocDate: e.target.value})} />
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
                  <label>Bill-To GSTIN</label>
                  <input type="text" className="input-field" value={form.gstinBill} onChange={e => setForm({...form, gstinBill: e.target.value})} />
                </div>
                <div>
                  <label>Ship-To GSTIN</label>
                  <input type="text" className="input-field" value={form.gstinShip} onChange={e => setForm({...form, gstinShip: e.target.value})} />
                </div>
                <div>
                  <label>Material Micronised Qty (Kg)</label>
                  <input type="number" step="any" className="input-field" value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill-To Address</label>
                  <textarea className="input-field" rows="2" readOnly value={form.billAddress || 'N/A'} style={{ background: 'var(--glass-bg)', opacity: 0.8 }}></textarea>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship-To Address</label>
                  <textarea className="input-field" rows="2" readOnly value={form.shipAddress || 'N/A'} style={{ background: 'var(--glass-bg)', opacity: 0.8 }}></textarea>
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>Tax Invoice Charges Grid</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chargesList.map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', background: 'var(--glass-bg)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                          <input type="checkbox" checked={form.charges[item.key]} onChange={() => toggleCharge(item.key)} />
                          {item.label}
                        </label>
                        {form.charges[item.key] && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.isQtyRate ? '/Kg' : 'flat'}:</span>
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ width: '80px', padding: '0.2rem', fontSize: '0.8rem', height: 'auto' }}
                              value={form.rates[item.key]} 
                              onChange={e => handleRateChange(item.key, e.target.value)} 
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)', margin: 0 }}>Custom / Extra Charges</h4>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setForm(prev => ({ ...prev, customCharges: [...(prev.customCharges || []), { name: '', hsn: '', rate: 0, qty: 1, checked: true }] }))}>
                        + Add Custom Charge
                      </button>
                    </div>
                    {(form.customCharges || []).length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No custom charges applied.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(form.customCharges || []).map((charge, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <input type="checkbox" checked={charge.checked} onChange={e => {
                              const newCharges = [...form.customCharges];
                              newCharges[idx].checked = e.target.checked;
                              setForm({...form, customCharges: newCharges});
                            }} />
                            <input type="text" className="input-field" style={{ flex: 2, padding: '0.2rem', fontSize: '0.8rem' }} placeholder="Charge Name" value={charge.name} onChange={e => {
                              const newCharges = [...form.customCharges];
                              newCharges[idx].name = e.target.value;
                              setForm({...form, customCharges: newCharges});
                            }} />
                            <input type="text" className="input-field" style={{ flex: 1, padding: '0.2rem', fontSize: '0.8rem' }} placeholder="HSN" value={charge.hsn} onChange={e => {
                              const newCharges = [...form.customCharges];
                              newCharges[idx].hsn = e.target.value;
                              setForm({...form, customCharges: newCharges});
                            }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty:</span>
                            <input type="number" className="input-field" style={{ width: '60px', padding: '0.2rem', fontSize: '0.8rem' }} value={charge.qty} onChange={e => {
                              const newCharges = [...form.customCharges];
                              newCharges[idx].qty = parseFloat(e.target.value) || 0;
                              setForm({...form, customCharges: newCharges});
                            }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                            <input type="number" className="input-field" style={{ width: '80px', padding: '0.2rem', fontSize: '0.8rem' }} value={charge.rate} onChange={e => {
                              const newCharges = [...form.customCharges];
                              newCharges[idx].rate = parseFloat(e.target.value) || 0;
                              setForm({...form, customCharges: newCharges});
                            }} />
                            <button type="button" className="btn" style={{ padding: '0.3rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }} onClick={() => {
                              const newCharges = form.customCharges.filter((_, i) => i !== idx);
                              setForm({...form, customCharges: newCharges});
                            }}><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculation Summary */}
                <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>GST Tax Billing Calculations</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>₹{getSubtotal().toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>Discount (₹):</span>
                    <input type="number" className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.discount} onChange={e => setForm({...form, discount: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>GST Rate (%):</span>
                    <select className="input-field" style={{ width: '100px', padding: '0.2rem', height: 'auto' }} value={form.taxRate} onChange={e => setForm({...form, taxRate: parseInt(e.target.value) || 0})}>
                      <option value="18">18%</option>
                      <option value="12">12%</option>
                      <option value="5">5%</option>
                      <option value="0">0%</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>CGST @{(form.taxRate / 2)}%:</span>
                    <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>SGST @{(form.taxRate / 2)}%:</span>
                    <span>₹{((Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    <span>Grand Total:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Tax Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxInvoice;
