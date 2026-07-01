import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';

const displayChargeRate = (v) => (v == null || v === '' || v === 0) ? '' : v;
const parseChargeRateInput = (val) => (val === '' ? 0 : (parseFloat(val) || 0));

const Parties = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Primary Form State
  const [formData, setFormData] = useState({
    vendorCode: '',
    date: new Date().toISOString().split('T')[0],
    name: '',
    billAddress: '',
    gstinBill: '',
    shipAddress: '',
    gstinShip: '',
    phone1: '',
    phone2: '',
    phone3: '',
    email1: '',
    email2: '',
    email3: '',
    type: 'Customer',
    products: [] // Array of { name, nickname, psdReq, psdNote, charges: { cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0, liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0 } }
  });

  // Product Sub-form State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductIdx, setEditingProductIdx] = useState(null);
  const [productData, setProductData] = useState({
    name: '',
    nickname: '',
    psdReq: '90% < 10M',
    psdMethodDefault: 'Dry',
    psdNote: '',
    charges: {
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
    }
  });

  // Auto-generate Vendor Code on date or open modal changes
  useEffect(() => {
    if (isModalOpen && !isEditing) {
      const vcSerial = data.settings?.serials?.VC || 1;
      const generatedCode = generateDocNumber('VC', vcSerial, new Date(formData.date));
      setFormData(prev => ({ ...prev, vendorCode: generatedCode }));
    }
  }, [formData.date, isModalOpen, isEditing, data.settings?.serials?.VC]);

  const handleEdit = (party) => {
    setFormData({
      ...party,
      products: party.products || []
    });
    setIsEditing(party.id);
    setIsModalOpen(true);
  };

  const deleteParty = (id) => {
    if (window.confirm("Are you sure you want to delete this party?")) {
      deleteItemSoftly('parties', id);
    }
  };

  const STANDARD_CHARGE_DEFS = [
    { key: 'cleaning',       label: 'Min Cleaning (998842)',      span: 1 },
    { key: 'filterBag',     label: 'Filter Bag (591190)',         span: 1 },
    { key: 'processing',    label: 'Processing (998842)',         span: 1 },
    { key: 'sieving',       label: 'Sieving (998842)',            span: 1 },
    { key: 'psdReportDry',  label: 'PSD Report Dry (998346)',     span: 1 },
    { key: 'psdReportWet',  label: 'PSD Report Wet (998346)',     span: 1 },
    { key: 'liner',         label: 'Liner (39233090)',            span: 1 },
    { key: 'courier',       label: 'Courier (996812)',            span: 1 },
    { key: 'fiberDrum',     label: 'Fiber Drum (7310)',           span: 1 },
    { key: 'transportation',label: 'Transportation (996511)',     span: 1 },
    { key: 'hdpeDrum',      label: 'HDPE Drum (39233090)',        span: 1 },
    { key: 'batchChangeover',label: 'Batch Change Over (998842)', span: 2 },
  ];

  const handleAddProduct = () => {
    setProductData({
      name: '',
      nickname: '',
      psdReq: '90% < 10M',
      psdMethodDefault: 'Dry',
      psdNote: '',
      notes: '',
      charges: {
        cleaning: 0,
        filterBag: 0,
        processing: 0,
        sieving: 0,
        psdReportDry: 0,
        psdReportWet: 0,
        liner: 0,
        courier: 0,
        fiberDrum: 0,
        transportation: 0,
        hdpeDrum: 0,
        batchChangeover: 0
      },
      disabledCharges: [],
      customCharges: []
    });
    setEditingProductIdx(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (idx) => {
    setProductData(formData.products[idx]);
    setEditingProductIdx(idx);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = (idx) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== idx)
    }));
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (editingProductIdx !== null) {
      setFormData(prev => ({
        ...prev,
        products: prev.products.map((p, i) => i === editingProductIdx ? productData : p)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        products: [...prev.products, productData]
      }));
    }
    setIsProductModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        updateItem('parties', isEditing, { ...formData, id: isEditing });
      } else {
        const newParty = {
          ...formData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        updateData('parties', newParty);
        incrementSerial('VC');
      }
      setIsModalOpen(false);
      setIsEditing(null);
      resetPartyForm();
    } catch (error) {
      console.error("Failed to save party:", error);
      alert("Error saving party. Please try again.");
    }
  };

  const resetPartyForm = () => {
    setFormData({
      vendorCode: '',
      date: new Date().toISOString().split('T')[0],
      name: '',
      billAddress: '',
      gstinBill: '',
      shipAddress: '',
      gstinShip: '',
      phone1: '',
      phone2: '',
      phone3: '',
      email1: '',
      email2: '',
      email3: '',
      type: 'Customer',
      products: []
    });
  };

  const filteredParties = data.parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.vendorCode && p.vendorCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gstinBill && p.gstinBill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Party & Products Master</h1>
          <p style={{ color: 'var(--text-muted)' }}>Configure party contacts, billing terms, and product standard pricing templates.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetPartyForm(); setIsModalOpen(true); }}>
          <Plus size={18} /> Add Party
        </button>
      </header>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by Vendor Code, name, or GSTIN..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Vendor Code</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Party Name</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>GSTIN (Bill / Ship)</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Products</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No parties found.</td>
                </tr>
              ) : (
                filteredParties.map(party => (
                  <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{party.vendorCode || 'N/A'}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{party.name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem',
                        background: party.type === 'Customer' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: party.type === 'Customer' ? '#10b981' : '#3b82f6',
                        fontWeight: 600
                      }}>
                        {party.type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>B: {party.gstinBill || 'N/A'}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>S: {party.gstinShip || 'N/A'}</p>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(party.products || []).map((prod, pIdx) => (
                          <span key={pIdx} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                            {prod.name}
                          </span>
                        ))}
                        {(party.products || []).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleEdit(party)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => deleteParty(party.id)}
                          style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
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

      {/* Main Party Form Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', overflowY: 'auto', padding: '2rem 0' }}>
          <div className="premium-card" style={{ width: '850px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{isEditing ? 'Modify Party' : 'Register New Party'}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Code: {formData.vendorCode}</span>
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Document Date *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    required 
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div>
                  <label>Vendor Code</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.vendorCode}
                    onChange={e => setFormData({...formData, vendorCode: e.target.value})}
                    style={{ background: 'var(--glass-bg)', color: 'var(--accent-primary)', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label>Party Type</label>
                  <select 
                    className="input-field" 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <label>Party Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required 
                    placeholder="Enter official registered name"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div style={{ gridColumn: 'span 3', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

                {/* Addresses */}
                <div style={{ gridColumn: 'span 3', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label>Bill To Address (Factory Address Option) *</label>
                    <textarea 
                      className="input-field" 
                      rows="3"
                      required
                      placeholder="Billing / Registered Office Address"
                      value={formData.billAddress}
                      onChange={e => setFormData({...formData, billAddress: e.target.value})}
                    />
                    <label style={{ marginTop: '0.5rem' }}>Bill To GSTIN *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      required
                      placeholder="e.g. 24AAAAA0000A1Z"
                      value={formData.gstinBill}
                      onChange={e => setFormData({...formData, gstinBill: e.target.value})}
                    />
                  </div>
                  <div>
                    <label>Ship To Address *</label>
                    <textarea 
                      className="input-field" 
                      rows="3"
                      required
                      placeholder="Delivery / Warehouse Address"
                      value={formData.shipAddress}
                      onChange={e => setFormData({...formData, shipAddress: e.target.value})}
                    />
                    <label style={{ marginTop: '0.5rem' }}>Ship To GSTIN *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      required
                      placeholder="e.g. 24AAAAA0000A1Z"
                      value={formData.gstinShip}
                      onChange={e => setFormData({...formData, gstinShip: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ gridColumn: 'span 3', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>

                {/* Contacts */}
                <div>
                  <label>Contact Number 1 *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    placeholder="Primary contact"
                    value={formData.phone1}
                    onChange={e => setFormData({...formData, phone1: e.target.value})}
                  />
                </div>
                <div>
                  <label>Contact Number 2</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Alternative"
                    value={formData.phone2}
                    onChange={e => setFormData({...formData, phone2: e.target.value})}
                  />
                </div>
                <div>
                  <label>Contact Number 3</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Landline / Other"
                    value={formData.phone3}
                    onChange={e => setFormData({...formData, phone3: e.target.value})}
                  />
                </div>

                {/* Emails */}
                <div>
                  <label>Email ID 1</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="primary@company.com"
                    value={formData.email1}
                    onChange={e => setFormData({...formData, email1: e.target.value})}
                  />
                </div>
                <div>
                  <label>Email ID 2</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="accounts@company.com"
                    value={formData.email2}
                    onChange={e => setFormData({...formData, email2: e.target.value})}
                  />
                </div>
                <div>
                  <label>Email ID 3</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="shipping@company.com"
                    value={formData.email3}
                    onChange={e => setFormData({...formData, email3: e.target.value})}
                  />
                </div>
              </div>

              {/* Associated Products Configuration Sub-form */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Associated Products & Default Invoice Charges</h3>
                  <button type="button" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddProduct}>
                    <Plus size={14} /> Add Product Config
                  </button>
                </div>

                <div style={{ overflowX: 'auto', background: 'var(--input-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem' }}>Product Name</th>
                        <th style={{ padding: '0.5rem' }}>Nick Name</th>
                        <th style={{ padding: '0.5rem' }}>PSD Req</th>
                        <th style={{ padding: '0.5rem' }}>Cleaning Chg</th>
                        <th style={{ padding: '0.5rem' }}>Filter Bag</th>
                        <th style={{ padding: '0.5rem' }}>Processing</th>
                        <th style={{ padding: '0.5rem' }}>Sieving</th>
                        <th style={{ padding: '0.5rem' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.products.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No products configured for this party. Add a config above.</td>
                        </tr>
                      ) : (
                        formData.products.map((prod, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{prod.name}</td>
                            <td style={{ padding: '0.5rem' }}>{prod.nickname || 'N/A'}</td>
                            <td style={{ padding: '0.5rem' }}>{prod.psdReq}</td>
                            <td style={{ padding: '0.5rem' }}>₹{prod.charges?.cleaning || 0}</td>
                            <td style={{ padding: '0.5rem' }}>₹{prod.charges?.filterBag || 0}</td>
                            <td style={{ padding: '0.5rem' }}>₹{prod.charges?.processing || 0}</td>
                            <td style={{ padding: '0.5rem' }}>₹{prod.charges?.sieving || 0}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button type="button" className="btn" style={{ padding: '0.25rem', background: 'transparent' }} onClick={() => handleEditProduct(idx)}>
                                  <Edit2 size={12} />
                                </button>
                                <button type="button" className="btn" style={{ padding: '0.25rem', background: 'transparent', color: 'rgba(239, 68, 68, 0.6)' }} onClick={() => handleDeleteProduct(idx)}>
                                  <Trash2 size={12} />
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => { setIsModalOpen(false); setIsEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Apply Updates' : 'Confirm Registration'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Associated Product Configuration Sub-Modal */}
      {isProductModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)' }}>
          <div className="premium-card" style={{ width: '680px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>{editingProductIdx !== null ? 'Modify Product Config' : 'Configure New Product & Charges'}</h3>
            <form onSubmit={handleSaveProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Product Name (Chemical) *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required 
                    placeholder="Official name (e.g. Fenofibrate)"
                    value={productData.name}
                    onChange={e => setProductData({...productData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label>Nick Name (Hidden in PDF/Prints)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Short code (e.g. Feno)"
                    value={productData.nickname}
                    onChange={e => setProductData({...productData, nickname: e.target.value})}
                  />
                </div>
                <div>
                  <label>PSD Requirement *</label>
                  <input
                    type="text"
                    list="psdReqOptions"
                    className="input-field"
                    required
                    placeholder="Select or type..."
                    value={productData.psdReq}
                    onChange={e => setProductData({ ...productData, psdReq: e.target.value })}
                  />
                  <datalist id="psdReqOptions">
                    {(data.psdRequirements || []).map((r, idx) => (
                      <option key={idx} value={r} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label>Default PSD Method</label>
                  <select
                    className="input-field"
                    value={productData.psdMethodDefault || 'Dry'}
                    onChange={e => setProductData({ ...productData, psdMethodDefault: e.target.value })}
                  >
                    <option value="Dry">Dry</option>
                    <option value="Wet">Wet</option>
                  </select>
                </div>
                <div>
                  <label>PSD Note (200+ Characters)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Any special handling notes"
                    value={productData.psdNote}
                    onChange={e => setProductData({...productData, psdNote: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem 0', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>Default Standard Charge Rates (₹)</h4>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--glass-bg)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)' }} onClick={() => setProductData(prev => ({ ...prev, customCharges: [...(prev.customCharges || []), { name: '', hsn: '', rate: '' }] }))}>
                  + Add Custom Charge
                </button>
              </div>
              
              <datalist id="amountOptions">
                <option value="5" />
                <option value="35" />
                <option value="70" />
                <option value="500" />
                <option value="550" />
                <option value="1350" />
                <option value="1500" />
                <option value="3500" />
                <option value="4500" />
              </datalist>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                {STANDARD_CHARGE_DEFS.filter(def => !(productData.disabledCharges || []).includes(def.key)).map(def => (
                  <div key={def.key} style={{ gridColumn: def.span > 1 ? `span ${def.span}` : undefined }}>
                    <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>{def.label}</span>
                      <button
                        type="button"
                        title="Remove this charge"
                        onClick={() => {
                          setProductData(prev => ({
                            ...prev,
                            disabledCharges: [...(prev.disabledCharges || []), def.key],
                            charges: { ...prev.charges, [def.key]: 0 }
                          }));
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(239,68,68,0.5)', padding: '0 0 0 4px',
                          lineHeight: 1, fontSize: '1rem', display: 'flex', alignItems: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </label>
                    <input
                      type="number" list="amountOptions"
                      className="input-field"
                      value={displayChargeRate(productData.charges[def.key])}
                      onChange={e => setProductData(prev => ({ ...prev, charges: { ...prev.charges, [def.key]: parseChargeRateInput(e.target.value) } }))}
                    />
                  </div>
                ))}

                {/* Removed / hidden charges restore strip */}
                {(productData.disabledCharges || []).length > 0 && (
                  <div style={{ gridColumn: 'span 3', marginTop: '0.25rem' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Hidden charges (click to restore):</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {(productData.disabledCharges || []).map(key => {
                        const def = STANDARD_CHARGE_DEFS.find(d => d.key === key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setProductData(prev => ({ ...prev, disabledCharges: (prev.disabledCharges || []).filter(k => k !== key) }))}
                            style={{
                              fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                              background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)',
                              borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '0.25rem'
                            }}
                          >
                            <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>+</span>
                            {def?.label || key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ gridColumn: 'span 3', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  {(productData.customCharges || []).length > 0 && (
                    (productData.customCharges || []).map((charge, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input type="text" className="input-field" placeholder="Charge Name (e.g. Micronization)" value={charge.name} onChange={e => {
                          const newCharges = [...productData.customCharges];
                          newCharges[idx].name = e.target.value;
                          setProductData({...productData, customCharges: newCharges});
                        }} />
                        <input type="text" className="input-field" placeholder="HSN Code" value={charge.hsn} onChange={e => {
                          const newCharges = [...productData.customCharges];
                          newCharges[idx].hsn = e.target.value;
                          setProductData({...productData, customCharges: newCharges});
                        }} />
                        <input type="number" className="input-field" placeholder="Rate (₹)" value={displayChargeRate(charge.rate)} onChange={e => {
                          const newCharges = [...productData.customCharges];
                          newCharges[idx].rate = parseChargeRateInput(e.target.value);
                          setProductData({...productData, customCharges: newCharges});
                        }} />
                        <button type="button" className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }} onClick={() => {
                          const newCharges = productData.customCharges.filter((_, i) => i !== idx);
                          setProductData({...productData, customCharges: newCharges});
                        }}><Trash2 size={14} /></button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ gridColumn: 'span 3' }}>
                  <label>Additional Notes / Remarks</label>
                  <textarea 
                    className="input-field" 
                    rows="2"
                    placeholder="Any custom terms or notes for this product"
                    value={productData.notes}
                    onChange={e => setProductData({...productData, notes: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parties;
