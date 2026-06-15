import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import ExportButton from '../components/ExportButton';

const PurchaseOrders = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);

  // PO Form State
  const [form, setForm] = useState({
    poNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: '',
    partyDocDate: '',
    partyName: '',
    productName: '',
    productDescription: '',
    address: '',
    state: 'GUJARAT',
    gstin: '',
    mobile: '',
    email: '',
    qty: 0,
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
    terms: '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty'
  });

  const activeMR = editingDoc ? data.materialReceipts.find(mr => mr.id === editingDoc.receiptId) : selectedMR;
  const party = data.parties.find(p => p.id === activeMR?.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === activeMR?.productName);

  useEffect(() => {
    if (editingDoc) {
      setForm(editingDoc);
    } else if (selectedMR && activeMR) {
      const poSerial = data.settings?.serials?.PO || 1;
      const docNo = generateDocNumber('PO', poSerial, new Date(form.date));
      const defaultRates = prodConfig?.charges || activeMR?.rates || {};

      setForm(prev => ({
        ...prev,
        poNo: docNo,
        partyDocNo: activeMR.partyDocNo,
        partyDocDate: activeMR.partyDocDate,
        partyName: activeMR.partyName,
        productName: activeMR.productName,
        productDescription: [prodConfig?.psdReq, prodConfig?.psdNote].filter(Boolean).join('\n'),
        address: activeMR.billAddress || party?.billAddress || '',
        gstin: activeMR.gstinBill || party?.gstinBill || '',
        mobile: party?.phone1 || '',
        email: party?.email1 || '',
        qty: activeMR.totalQty,
        charges: activeMR.charges || prev.charges,
        rates: {
          ...prev.rates,
          ...defaultRates
        }
      }));
    }
  }, [form.date, editingDoc, selectedMR, activeMR, prodConfig, data.settings?.serials?.PO]);

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
    return Object.keys(form.charges).reduce((sum, key) => {
      if (form.charges[key]) {
        const isQtyRate = ['processing', 'sieving', 'cleaning'].includes(key);
        const qty = parseFloat(form.qty) || 0;
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
      poNo: '',
      date: new Date().toISOString().split('T')[0],
      partyDocNo: '',
      partyDocDate: '',
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
      terms: '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty',
      partyName: '',
      productName: '',
      productDescription: '',
      address: '',
      state: 'GUJARAT',
      gstin: '',
      mobile: '',
      email: '',
      qty: 0
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedMR(null);
    setEditingDoc(null);
    const poSerial = data.settings?.serials?.PO || 1;
    const docNo = generateDocNumber('PO', poSerial, new Date());
    setForm({
      poNo: docNo,
      date: new Date().toISOString().split('T')[0],
      partyDocNo: '',
      partyDocDate: '',
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
      terms: '1. Delivery 10 days from the date of Purchase Order.\n2. Transportation Extra As Actual.\n3. 10 Years Warranty',
      partyName: '',
      productName: '',
      productDescription: '',
      address: '',
      state: 'GUJARAT',
      gstin: '',
      mobile: '',
      email: '',
      qty: 0
    });
    setIsModalOpen(true);
  };

  const handleEdit = (po) => {
    setEditingDoc(po);
    setForm(po);
    setIsModalOpen(true);
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
      receiptId: activeMR?.id || '',
      partyName: form.partyName,
      productName: form.productName,
      qty: form.qty,
      subtotal,
      taxAmount,
      total,
      type: 'Purchase Order'
    };

    if (editingDoc) {
      updateItem('purchaseOrders', editingDoc.id, finalDoc);
    } else {
      updateData('purchaseOrders', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PO');
    }
    setIsModalOpen(false);
  };

  // Find MRs that do not have a PO generated yet
  const pendingMRs = data.materialReceipts.filter(mr => 
    !(data.purchaseOrders || []).some(po => po.receiptId === mr.id)
  );

  const poList = (data.purchaseOrders || []).filter(po => !po.isDeleted);
  const filtered = poList.filter(po => 
    (po.poNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (po.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Date', key: 'date' },
    { label: 'PO Number', key: 'poNo' },
    { label: 'Party Name', key: 'partyName' },
    { label: 'Qty (Kg)', key: 'qty' },
    { label: 'Total (₹)', key: 'total' }
  ];

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
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Purchase Orders (PO)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate and manage incoming POs seamlessly from workflows.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ExportButton data={filtered} columns={exportColumns} filename="Purchase_Orders" title="Purchase Orders Log" />
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={18} /> Create New PO
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending MRs scheduler */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending PO Queue
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a Material Receipt to generate a Purchase Order.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingMRs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending receipts awaiting PO.</p>
            ) : (
              pendingMRs.map(mr => (
                <div 
                  key={mr.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(mr)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{mr.receiptNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{mr.partyName}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Weight: {mr.totalQty?.toFixed(1) || 0} Kg</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: PO Log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Purchase Order Log</h3>
          
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by PO number or Party Name..." 
              style={{ paddingLeft: '3rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Date</th>
                  <th>PO Number</th>
                  <th>Party Name</th>
                  <th>Product</th>
                  <th>Qty (Kg)</th>
                  <th>Total (₹)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No Purchase Orders found.</td></tr>
                ) : (
                  filtered.map(po => (
                    <tr key={po.id}>
                      <td>{formatDate(po.date)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{po.poNo}</td>
                      <td style={{ fontWeight: 600 }}>{po.partyName}</td>
                      <td>{po.productName}</td>
                      <td>{po.qty}</td>
                      <td style={{ fontWeight: 600 }}>₹{po.total?.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('PO', po)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(po)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteItemSoftly('purchaseOrders', po.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
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

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDoc ? 'Modify Purchase Order' : 'Create Purchase Order'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>PO Number</label>
                  <input type="text" className="input-field" value={form.poNo} onChange={e => setForm({...form, poNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>PO Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
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
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Product Description / Specifications</label>
                  <textarea className="input-field" rows="3" placeholder="Additional lines shown under product name on PO PDF" value={form.productDescription || ''} onChange={e => setForm({...form, productDescription: e.target.value})} />
                </div>
                <div>
                  <label>Vendor Address</label>
                  <textarea className="input-field" rows="2" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} />
                </div>
                <div>
                  <label>Vendor State</label>
                  <input type="text" className="input-field" value={form.state || 'GUJARAT'} onChange={e => setForm({...form, state: e.target.value})} />
                </div>
                <div>
                  <label>Vendor GSTIN</label>
                  <input type="text" className="input-field" value={form.gstin || ''} onChange={e => setForm({...form, gstin: e.target.value})} />
                </div>
                <div>
                  <label>Vendor Mobile</label>
                  <input type="text" className="input-field" value={form.mobile || ''} onChange={e => setForm({...form, mobile: e.target.value})} />
                </div>
                <div>
                  <label>Vendor Email</label>
                  <input type="text" className="input-field" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label>Material Qty (Kg)</label>
                  <input type="number" step="any" className="input-field" value={form.qty} onChange={e => setForm({...form, qty: parseFloat(e.target.value) || 0})} />
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                  <label>Terms & Conditions</label>
                  <textarea className="input-field" rows="3" value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>PO Grid</h3>
              
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
                </div>

                {/* Calculation Summary */}
                <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>GST Calculations</h4>
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
                <button type="submit" className="btn btn-primary">Save Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
