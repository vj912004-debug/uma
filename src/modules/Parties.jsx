import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit2, Trash2, ShieldAlert, ArrowLeft, X } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import { newestFirst } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';

const displayChargeRate = (v) => (v == null || v === '' || v === 0) ? '' : v;
const parseChargeRateInput = (val) => (val === '' ? 0 : (parseFloat(val) || 0));

const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' }
];

const stateCodeForName = (name) => {
  const hit = INDIAN_STATES.find((s) => s.name.toLowerCase() === String(name || '').trim().toLowerCase());
  return hit?.code || '';
};

const Parties = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const navigate = useNavigate();
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
    state: '',
    stateCode: '',
    deliveryNote: '',
    tiNote: '',
    phone1: '',
    phone2: '',
    phone3: '',
    email1: '',
    email2: '',
    email3: '',
    type: 'Customer',
    products: [] // Array of { name, nickname, psdReq, psdNote, specialNote, charges: { ... } }
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
    specialNote: '',
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
    { key: 'cleaning', label: 'Minimum Cleaning Charge', hint: 'Printed as Minimum Cleaning Charges (998842)' },
    { key: 'filterBag', label: 'Filter Bag Charge', hint: 'HSN / SAC 591190' },
    { key: 'processing', label: 'Processing Charge', hint: 'HSN / SAC 998842' },
    { key: 'sieving', label: 'Sieving Charge', hint: 'HSN / SAC 998842' },
    { key: 'sleeving', label: 'Sleeving Charges', hint: 'Other / optional charge' },
    { key: 'psdReportDry', label: 'PSD Report Dry', hint: 'HSN / SAC 998346' },
    { key: 'psdReportWet', label: 'PSD Report Wet', hint: 'HSN / SAC 998346' },
    { key: 'liner', label: 'Liner', hint: 'HSN 39233090' },
    { key: 'courier', label: 'Courier', hint: 'HSN / SAC 996812' },
    { key: 'fiberDrum', label: 'Fiber Drum', hint: 'HSN 7310' },
    { key: 'transportation', label: 'Transportation', hint: 'HSN / SAC 996511' },
    { key: 'hdpeDrum', label: 'HDPE Drum', hint: 'HSN 39233090' },
    { key: 'batchChangeover', label: 'Batch Change Over', hint: 'HSN / SAC 998842' }
  ];

  const emptyProductCharges = () => Object.fromEntries(
    STANDARD_CHARGE_DEFS.map((def) => [def.key, 0])
  );

  const handleAddProduct = () => {
    setProductData({
      name: '',
      nickname: '',
      psdReq: '90% < 10M',
      psdMethodDefault: 'Dry',
      psdNote: '',
      specialNote: '',
      notes: '',
      charges: emptyProductCharges(),
      chargeNotes: {},
      disabledCharges: [],
      customCharges: []
    });
    setEditingProductIdx(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (idx) => {
    const existing = formData.products[idx] || {};
    setProductData({
      ...existing,
      charges: { ...emptyProductCharges(), ...(existing.charges || {}) },
      chargeNotes: { ...(existing.chargeNotes || {}) },
      disabledCharges: existing.disabledCharges || [],
      customCharges: existing.customCharges || []
    });
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
      state: '',
      stateCode: '',
      deliveryNote: '',
      tiNote: '',
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

  const filteredParties = newestFirst(data.parties).filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.vendorCode && p.vendorCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gstinBill && p.gstinBill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {!isModalOpen && (
      <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Party & Products Master</h1>
          <p className="page-subtitle">Configure party contacts, billing terms, and product standard pricing templates.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ExportButton
            data={filteredParties.map((p) => ({
              vendorCode: p.vendorCode || '',
              name: p.name || '',
              type: p.type || '',
              gstin: [p.gstinBill, p.gstinShip].filter(Boolean).join(' / '),
              state: p.state || '',
              products: (p.products || []).map((prod) => prod.productName || prod.name || '').filter(Boolean).join(', ')
            }))}
            columns={[
              { label: 'Vendor Code', key: 'vendorCode' },
              { label: 'Party Name', key: 'name' },
              { label: 'Type', key: 'type' },
              { label: 'GSTIN (Bill / Ship)', key: 'gstin' },
              { label: 'State', key: 'state' },
              { label: 'Products', key: 'products' }
            ]}
            filename="Parties"
            title="Party & Products Master"
          />
          <button className="btn btn-primary" onClick={() => { resetPartyForm(); setIsModalOpen(true); }}>
            <Plus size={18} /> Add Party
          </button>
        </div>
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
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sr. No</th>
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
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No parties found.</td>
                </tr>
              ) : (
                filteredParties.map((party, idx) => (
                  <tr key={party.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{idx + 1}</td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{party.vendorCode || 'N/A'}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>
                      <button 
                        onClick={() => navigate('/processing-sheet', { state: { partyName: party.name } })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        title={`View ${party.name} in Processing Sheet`}
                      >
                        {party.name}
                      </button>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem',
                        background: party.type === 'Customer' ? 'rgba(155, 98, 196, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: party.type === 'Customer' ? '#9b62c4' : '#3b82f6',
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
                          <span key={pIdx} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'var(--lavender)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
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
      </>
      )}

      {/* Main Party Form — card sections like reference */}
      {isModalOpen && (
        <div className="page-form-overlay party-form-page">
          <form onSubmit={handleSubmit} className="party-form">
            <header className="party-form-header">
              <button
                type="button"
                className="party-back-btn"
                onClick={() => { setIsModalOpen(false); setIsEditing(null); }}
              >
                <ArrowLeft size={18} /> Back
              </button>
              <div className="party-form-title-wrap">
                <h1>{isEditing ? 'Modify Party' : 'Register New Party'}</h1>
                <p>{isEditing ? 'Update party details and product charge configuration.' : 'Add new party details and configure contact & billing information.'}</p>
              </div>
              <div className="party-form-code">Code: {formData.vendorCode || '—'}</div>
            </header>

            <section className="premium-card party-section-card">
              <h3 className="party-section-title">Basic Information</h3>
              <div className="party-grid-3">
                <div>
                  <label>Document Date *</label>
                  <DateField
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
                    className="input-field party-readonly-field"
                    readOnly
                    value={formData.vendorCode}
                  />
                </div>
                <div>
                  <label>Party Type</label>
                  <SearchableSelect
                    className="input-field"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                  </SearchableSelect>
                </div>
                <div className="party-span-all">
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
              </div>
            </section>

            <section className="premium-card party-section-card">
              <h3 className="party-section-title">Address & GST Details</h3>
              <div className="party-grid-2">
                <div>
                  <label>Bill To Address *</label>
                  <textarea
                    className="input-field"
                    rows="3"
                    required
                    placeholder="Type each print line, then press Enter"
                    value={formData.billAddress}
                    onChange={e => setFormData({...formData, billAddress: e.target.value})}
                  />
                  <label style={{ marginTop: '0.75rem' }}>Bill To GSTIN# *</label>
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
                    placeholder="Type each print line, then press Enter"
                    value={formData.shipAddress}
                    onChange={e => setFormData({...formData, shipAddress: e.target.value})}
                  />
                  <label style={{ marginTop: '0.75rem' }}>Ship To GSTIN# *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="e.g. 24AAAAA0000A1Z"
                    value={formData.gstinShip}
                    onChange={e => setFormData({...formData, gstinShip: e.target.value})}
                  />
                </div>
                <div className="party-span-all">
                  <label>State</label>
                  <SearchableSelect
                    className="input-field"
                    value={formData.state || ''}
                    placeholder="Select state"
                    allowCustom
                    memoryKey="party-state"
                    onChange={(e) => {
                      const state = e.target.value;
                      setFormData({
                        ...formData,
                        state,
                        stateCode: stateCodeForName(state)
                      });
                    }}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>
            </section>

            <section className="premium-card party-section-card">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <h3 className="party-section-title">DC Description Notes</h3>
                  <textarea
                    className="input-field"
                    rows="3"
                    placeholder="Prints in the Delivery Challan description for this party"
                    value={formData.deliveryNote || ''}
                    onChange={e => setFormData({ ...formData, deliveryNote: e.target.value })}
                  />
                </div>
                <div>
                  <h3 className="party-section-title">TI Notes</h3>
                  <textarea
                    className="input-field"
                    rows="3"
                    placeholder="Prints in the Tax Invoice description / notes for this party"
                    value={formData.tiNote || ''}
                    onChange={e => setFormData({ ...formData, tiNote: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section className="premium-card party-section-card">
              <h3 className="party-section-title">Contact Details</h3>
              <div className="party-grid-3">
                <div>
                  <label>Contact Number 1</label>
                  <input
                    type="text"
                    className="input-field"
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
            </section>

            <section className="premium-card party-section-card">
              <div className="party-section-head">
                <h3 className="party-section-title" style={{ margin: 0 }}>Products & Default Invoice Charges</h3>
                <button type="button" className="btn btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }} onClick={handleAddProduct}>
                  <Plus size={14} /> Add Product Config
                </button>
              </div>
              <div className="party-products-table-wrap">
                <table className="party-products-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Nick Name</th>
                      <th>PSD Req</th>
                      <th>Cleaning Chg</th>
                      <th>Filter Bag</th>
                      <th>Processing</th>
                      <th>Sieving</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.products.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="party-empty-cell">No products configured for this party. Add a config above.</td>
                      </tr>
                    ) : (
                      formData.products.map((prod, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{prod.name}</td>
                          <td>{prod.nickname || 'N/A'}</td>
                          <td>{prod.psdReq}</td>
                          <td>₹{prod.charges?.cleaning || 0}</td>
                          <td>₹{prod.charges?.filterBag || 0}</td>
                          <td>₹{prod.charges?.processing || 0}</td>
                          <td>₹{prod.charges?.sieving || 0}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button type="button" className="btn" style={{ padding: '0.25rem', background: 'transparent' }} onClick={() => handleEditProduct(idx)}>
                                <Edit2 size={12} />
                              </button>
                              <button type="button" className="btn" style={{ padding: '0.25rem', background: 'transparent', color: 'rgba(239, 68, 68, 0.7)' }} onClick={() => handleDeleteProduct(idx)}>
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
            </section>

            <div className="party-form-actions">
              <button type="button" className="btn" onClick={() => { setIsModalOpen(false); setIsEditing(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEditing ? 'Apply Updates' : 'Confirm Registration'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Associated Product Configuration Sub-Modal */}
      {isProductModalOpen && (
        <div className="page-form-overlay">
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
                  <SearchableSelect
                    className="input-field"
                    required
                    value={productData.psdReq || ''}
                    onChange={(e) => setProductData({ ...productData, psdReq: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {(data.psdRequirements || []).map((r, idx) => (
                      <option key={idx} value={r}>{r}</option>
                    ))}
                    {!(data.psdRequirements || []).some((r) => String(r).trim().toUpperCase() === 'N/A') && (
                      <option value="N/A">N/A</option>
                    )}
                  </SearchableSelect>
                </div>
                <div>
                  <label>Default PSD Method</label>
                  <SearchableSelect
                    className="input-field"
                    value={productData.psdMethodDefault || 'Dry'}
                    onChange={e => setProductData({ ...productData, psdMethodDefault: e.target.value })}
                  >
                    <option value="Dry">Dry</option>
                    <option value="Wet">Wet</option>
                    <option value="N/A">N/A</option>
                  </SearchableSelect>
                </div>
                <div>
                  <label>PSD Note (200+ Characters)</label>
                  <textarea
                    className="input-field"
                    rows={6}
                    placeholder={'One detail per line\nOld mill\nNew jet\nFast ventury'}
                    value={productData.psdNote}
                    onChange={e => setProductData({...productData, psdNote: e.target.value})}
                  />
                </div>
                <div>
                  <label>Special Note</label>
                  <textarea
                    className="input-field"
                    rows={6}
                    placeholder={'One detail per line\nCarries to BPR Special Note'}
                    value={productData.specialNote || ''}
                    onChange={e => setProductData({ ...productData, specialNote: e.target.value })}
                  />
                </div>
              </div>

              <div style={{
                border: '1px solid #ddd6fe',
                borderRadius: '12px',
                overflow: 'hidden',
                margin: '1rem 0',
                background: '#fff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: '#5b1c85',
                  color: '#fff',
                  flexWrap: 'wrap'
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Default Standard Charge Rates (₹)</h4>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem',
                      background: '#fff',
                      color: '#5b1c85',
                      border: '1px solid #c4b5fd',
                      fontWeight: 600
                    }}
                    onClick={() => setProductData(prev => ({
                      ...prev,
                      customCharges: [...(prev.customCharges || []), { name: '', hsn: '', rate: '', note: '' }]
                    }))}
                  >
                    + Add Custom Charge
                  </button>
                </div>
                <p style={{ margin: 0, padding: '0.55rem 1rem', fontSize: '0.75rem', color: '#6d28d9', background: '#f5f3ff' }}>
                  Set default rates for this product. Remove a box to hide it; restore from Hidden charges below.
                </p>

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

                <div style={{ padding: '0.75rem 1rem 1rem' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '0.65rem',
                    marginBottom: '0.75rem'
                  }}>
                    {STANDARD_CHARGE_DEFS.filter(def => !(productData.disabledCharges || []).includes(def.key)).map(def => (
                      <div
                        key={def.key}
                        style={{
                          border: '1px solid #c4b5fd',
                          borderRadius: '10px',
                          background: '#f5f3ff',
                          padding: '0.65rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          position: 'relative',
                          minWidth: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5b1c85', lineHeight: 1.25 }}>
                            {def.label}
                          </span>
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
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'rgba(100, 116, 139, 0.7)',
                              padding: 0,
                              lineHeight: 1,
                              display: 'flex',
                              flexShrink: 0
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <input
                          type="number"
                          list="amountOptions"
                          className="input-field"
                          placeholder="0"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', background: '#fff' }}
                          value={displayChargeRate(productData.charges?.[def.key])}
                          onChange={e => setProductData(prev => ({
                            ...prev,
                            charges: { ...prev.charges, [def.key]: parseChargeRateInput(e.target.value) }
                          }))}
                        />
                        {def.hint && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{def.hint}</span>
                        )}
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                            Print note
                          </span>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Note e.g. Nil if Qty is more than 500kg"
                            style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem', background: '#fff' }}
                            value={productData.chargeNotes?.[def.key] || ''}
                            onChange={e => setProductData(prev => ({
                              ...prev,
                              chargeNotes: { ...(prev.chargeNotes || {}), [def.key]: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {(productData.disabledCharges || []).length > 0 && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        Hidden charges (click to restore):
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(productData.disabledCharges || []).map(key => {
                          const def = STANDARD_CHARGE_DEFS.find(d => d.key === key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setProductData(prev => ({
                                ...prev,
                                disabledCharges: (prev.disabledCharges || []).filter(k => k !== key)
                              }))}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.25rem 0.55rem',
                                background: '#f5f3ff',
                                border: '1px dashed #c4b5fd',
                                borderRadius: '999px',
                                color: '#5b1c85',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontWeight: 600
                              }}
                            >
                              <Plus size={12} />
                              {def?.label || key}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(productData.customCharges || []).length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '0.65rem',
                      marginBottom: '0.85rem'
                    }}>
                      {(productData.customCharges || []).map((charge, idx) => (
                        <div
                          key={`custom-${idx}`}
                          style={{
                            border: '1px solid #c4b5fd',
                            borderRadius: '10px',
                            background: '#f5f3ff',
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5b1c85' }}>Custom Charge</span>
                            <button
                              type="button"
                              title="Remove"
                              onClick={() => {
                                const newCharges = productData.customCharges.filter((_, i) => i !== idx);
                                setProductData({ ...productData, customCharges: newCharges });
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Charge name"
                            style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', background: '#fff' }}
                            value={charge.name}
                            onChange={e => {
                              const newCharges = [...productData.customCharges];
                              newCharges[idx] = { ...newCharges[idx], name: e.target.value };
                              setProductData({ ...productData, customCharges: newCharges });
                            }}
                          />
                          <input
                            type="text"
                            className="input-field"
                            placeholder="HSN Code"
                            style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', background: '#fff' }}
                            value={charge.hsn}
                            onChange={e => {
                              const newCharges = [...productData.customCharges];
                              newCharges[idx] = { ...newCharges[idx], hsn: e.target.value };
                              setProductData({ ...productData, customCharges: newCharges });
                            }}
                          />
                          <input
                            type="number"
                            className="input-field"
                            placeholder="Rate (₹)"
                            style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', background: '#fff' }}
                            value={displayChargeRate(charge.rate)}
                            onChange={e => {
                              const newCharges = [...productData.customCharges];
                              newCharges[idx] = { ...newCharges[idx], rate: parseChargeRateInput(e.target.value) };
                              setProductData({ ...productData, customCharges: newCharges });
                            }}
                          />
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Note e.g. Nil if Qty is more than 500kg"
                            style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem', background: '#fff' }}
                            value={charge.note || ''}
                            onChange={e => {
                              const newCharges = [...productData.customCharges];
                              newCharges[idx] = { ...newCharges[idx], note: e.target.value };
                              setProductData({ ...productData, customCharges: newCharges });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label>Additional Notes / Remarks</label>
                    <textarea
                      className="input-field"
                      rows="2"
                      placeholder="Any custom terms or notes for this product"
                      value={productData.notes}
                      onChange={e => setProductData({ ...productData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
