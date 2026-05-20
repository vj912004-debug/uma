import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Plus, Search, Edit2, Trash2, FileDown, ClipboardList, FileText, CheckSquare, Square } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const InvoicesPI = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);

  // PI Form State
  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    poNo: '',
    poDate: new Date().toISOString().split('T')[0],
    charges: {
      cleaning: false,
      filterBag: false,
      processing: false,
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
    terms: 'Payment 100% advance against PI.'
  });

  const activeMR = editingDoc ? data.materialReceipts.find(mr => mr.id === editingDoc.receiptId) : selectedMR;
  const party = data.parties.find(p => p.id === activeMR?.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === activeMR?.productName);

  useEffect(() => {
    if (editingDoc) {
      setForm(editingDoc);
    } else if (selectedMR) {
      const piSerial = data.settings?.serials?.PI || 1;
      const docNo = generateDocNumber('PI', piSerial, new Date(form.date));
      const defaultRates = prodConfig?.charges || {};

      setForm(prev => ({
        ...prev,
        invoiceNo: docNo,
        rates: {
          cleaning: defaultRates.cleaning || 0,
          filterBag: defaultRates.filterBag || 0,
          processing: defaultRates.processing || 0,
          sieving: defaultRates.sieving || 0,
          psdReport: defaultRates.psdReport || 0,
          liner: defaultRates.liner || 0,
          courier: defaultRates.courier || 0,
          fiberDrum: defaultRates.fiberDrum || 0,
          transportation: defaultRates.transportation || 0,
          hdpeDrum: defaultRates.hdpeDrum || 0,
          batchChangeover: defaultRates.batchChangeover || 0
        }
      }));
    }
  }, [form.date, editingDoc, selectedMR, prodConfig, data.settings?.serials?.PI]);

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
    if (!activeMR) return 0;
    return Object.keys(form.charges).reduce((sum, key) => {
      if (form.charges[key]) {
        const isQtyRate = ['processing', 'sieving', 'cleaning'].includes(key);
        const qty = parseFloat(activeMR.totalQty) || 0;
        const rate = form.rates[key] || 0;
        return sum + (isQtyRate ? qty * rate : rate);
      }
      return sum;
    }, 0);
  };

  const handleCreate = (mr) => {
    setSelectedMR(mr);
    setEditingDoc(null);
    setForm({
      invoiceNo: '',
      date: new Date().toISOString().split('T')[0],
      poNo: '',
      poDate: new Date().toISOString().split('T')[0],
      charges: {
        cleaning: false,
        filterBag: false,
        processing: false,
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
      terms: 'Payment 100% advance against PI.'
    });
    setIsModalOpen(true);
  };

  const handleEdit = (pi) => {
    setEditingDoc(pi);
    setForm(pi);
    setIsModalOpen(true);
  };

  const deletePI = (id) => {
    if (window.confirm("Delete this Proforma Invoice?")) {
      setData(prev => ({
        ...prev,
        invoices: prev.invoices.filter(i => i.id !== id)
      }));
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
      receiptId: activeMR.id,
      partyName: activeMR.partyName,
      productName: activeMR.productName,
      qty: activeMR.totalQty,
      subtotal,
      taxAmount,
      total,
      type: 'Proforma Invoice'
    };

    if (editingDoc) {
      updateItem('invoices', editingDoc.id, finalDoc);
    } else {
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PI');
    }
    setIsModalOpen(false);
  };

  // Find receipts that do not have a PI generated yet
  const pendingReceipts = data.materialReceipts.filter(mr => 
    !(data.invoices || []).some(inv => inv.receiptId === mr.id && inv.invoiceNo?.includes('/PI/'))
  );

  const filteredPIs = (data.invoices || []).filter(inv => 
    inv.invoiceNo?.includes('/PI/') &&
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
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Proforma Invoices (P.I.)</h1>
        <p style={{ color: 'var(--text-muted)' }}>Generate advanced billing quotations and carry forward payment estimates.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending Receipts scheduler */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending M.R. for Quotation
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a receipt to generate a Performa Invoice.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingReceipts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending receipts awaiting quotations.</p>
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

        {/* Right Side: PI Log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>PI Log History</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search PI No, customer or chemical..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem', padding: '0.5rem 2.5rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>PI No</th>
                  <th style={{ padding: '0.75rem' }}>Party Name</th>
                  <th style={{ padding: '0.75rem' }}>Product</th>
                  <th style={{ padding: '0.75rem' }}>Quantity</th>
                  <th style={{ padding: '0.75rem' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPIs.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No PI records found.</td></tr>
                ) : (
                  filteredPIs.map(pi => (
                    <tr key={pi.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{pi.invoiceNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{pi.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{pi.productName}</td>
                      <td style={{ padding: '0.75rem' }}>{pi.qty} Kg</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{pi.total.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('PI', pi)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(pi)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deletePI(pi.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
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

      {/* PI Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDoc ? 'Modify Proforma Invoice' : 'Create Proforma Invoice (P.I.)'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>PI Number</label>
                  <input type="text" className="input-field" readOnly value={form.invoiceNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>PI Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>GSTIN</label>
                  <input type="text" className="input-field" readOnly value={activeMR?.gstinBill || 'N/A'} />
                </div>
                <div>
                  <label>PO Number</label>
                  <input type="text" className="input-field" value={form.poNo} onChange={e => setForm({...form, poNo: e.target.value})} />
                </div>
                <div>
                  <label>PO Date</label>
                  <input type="date" className="input-field" value={form.poDate} onChange={e => setForm({...form, poDate: e.target.value})} />
                </div>
                <div>
                  <label>Material Quantity</label>
                  <input type="text" className="input-field" readOnly value={`${activeMR?.totalQty || 0} Kg`} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '0.5rem' }}>Auto-Charges Configuration Panel</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Toggle charges. Checking auto-populates the default rates defined in the Party Master.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {chargesList.map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
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
                </div>

                {/* Calculation Summary */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>Calculation Summary</h4>
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
                    <span>GST Amount:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (form.taxRate / 100)).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>
                    <span>Grand Total:</span>
                    <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>Terms & Conditions</label>
                    <input type="text" className="input-field" value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm PI Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPI;
