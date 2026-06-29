import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Download, Trash2, Edit2 } from 'lucide-react';
import { generateDocNumber } from '../utils/numbering';
import { exportToPDF } from '../utils/pdfExport';
import { formatDate } from '../utils/dateUtils';

const MATERIAL_CHARGES = [
  { key: 'cleaning', label: 'Minimum Cleaning Charges (998842)', isQtyRate: true },
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

const DEFAULT_CHARGES = {
  cleaning: true, filterBag: false, processing: true, sieving: false,
  psdReport: false, liner: false, courier: false, fiberDrum: false,
  transportation: false, hdpeDrum: false, batchChangeover: false
};

const DEFAULT_RATES = {
  cleaning: 0, filterBag: 0, processing: 0, sieving: 0, psdReport: 0,
  liner: 0, courier: 0, fiberDrum: 0, transportation: 0, hdpeDrum: 0, batchChangeover: 0
};

const getDefaultForm = () => ({
  quotationNo: '',
  date: new Date().toISOString().split('T')[0],
  partyId: '',
  partyName: '',
  partyAddress: '',
  gstNumber: '',
  contactPerson: '',
  subject: 'Quotation for Micronization Services.',
  description: '',
  productName: '',
  qty: '',
  psdRequirement: '',
  charges: { ...DEFAULT_CHARGES },
  rates: { ...DEFAULT_RATES },
  mainCharges: [{ description: '', psdRequirement: '', rate: '' }],
  optionalCharges: [{ description: '', rate: '' }],
  productSettings: {},
  validityDate: '2026-06-21',
  terms: 'Tax: GST will charge extra.\nLoss: Loss occurs during Processing is on your account.\nSame Batch: Same materials requirement of micronization separately batch wise of different specification of same materials then change over charge @ Rs. 500/- batch or per specification will be applicable.\nCharges: This is only processing charges, all other charges like Transportation, Insurance, Repacking material charges will be extra.\nPayment: 100% Advance against PI\nValidity: 21/06/2026\nNote: If properties of material change then rate will be change and PSD will change then rate will be change.',
  notes: '1) ABC\n\n2) ABC\n\n3) ABC',
  signatoryName: 'Amit Patel'
});

const buildMainChargesFromMaterial = (charges, rates, qty, psdRequirement) => {
  const rows = [];
  MATERIAL_CHARGES.forEach((item) => {
    if (!charges[item.key]) return;
    const rate = rates[item.key] || 0;
    if (rate <= 0) return;
    const rateLabel = item.isQtyRate && qty
      ? `₹ ${rate} / Kg (Qty: ${qty} Kg)`
      : `₹ ${rate}${item.isQtyRate ? ' / Kg' : ''}`;
    rows.push({
      description: item.label,
      psdRequirement: item.key === 'processing' ? (psdRequirement || '') : '',
      rate: rateLabel
    });
  });
  return rows.length ? rows : [{ description: '', psdRequirement: '', rate: '' }];
};

const buildChargesFromPartyProduct = (prodConfig) => {
  const defaultRates = prodConfig?.charges || {};
  const nextCharges = { ...DEFAULT_CHARGES };
  Object.keys(defaultRates).forEach((key) => {
    if ((defaultRates[key] || 0) > 0) nextCharges[key] = true;
  });
  nextCharges.cleaning = true;
  nextCharges.processing = true;
  return {
    charges: nextCharges,
    rates: { ...DEFAULT_RATES, ...defaultRates },
    psdRequirement: prodConfig?.psdReq || ''
  };
};

const snapshotCurrentProductSettings = (form) => {
  if (!form.productName) return form.productSettings || {};
  return {
    ...(form.productSettings || {}),
    [form.productName]: {
      qty: form.qty,
      psdRequirement: form.psdRequirement || '',
      charges: { ...form.charges },
      rates: { ...form.rates },
      mainCharges: JSON.parse(JSON.stringify(form.mainCharges || [])),
      optionalCharges: JSON.parse(JSON.stringify(form.optionalCharges || []))
    }
  };
};

const applyProductToQuotation = (baseForm, productName, party) => {
  const productSettings = snapshotCurrentProductSettings(baseForm);
  const saved = productSettings[productName];

  if (saved) {
    const charges = { ...DEFAULT_CHARGES, ...saved.charges };
    const rates = { ...DEFAULT_RATES, ...saved.rates };
    return {
      ...baseForm,
      productName,
      productSettings,
      qty: saved.qty ?? '',
      psdRequirement: saved.psdRequirement || '',
      charges,
      rates,
      mainCharges: saved.mainCharges?.length
        ? saved.mainCharges
        : buildMainChargesFromMaterial(charges, rates, saved.qty, saved.psdRequirement)
    };
  }

  const prodConfig = (party?.products || []).find(p => p.name === productName);
  const { charges, rates, psdRequirement } = buildChargesFromPartyProduct(prodConfig);
  const qty = baseForm.productName === productName ? baseForm.qty : '';
  return {
    ...baseForm,
    productName,
    productSettings,
    qty,
    psdRequirement,
    charges,
    rates,
    mainCharges: buildMainChargesFromMaterial(charges, rates, qty, psdRequirement)
  };
};

const Quotations = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState(null);
  
  const [formData, setFormData] = useState(getDefaultForm());

  useEffect(() => {
    if (isModalOpen && !formData.id) {
      const serial = data.settings?.serials?.QT || 1;
      setFormData(prev => ({ ...prev, quotationNo: generateDocNumber('QTN', serial, new Date(prev.date)) }));
    }
  }, [isModalOpen, data.settings?.serials?.QT, formData.date, formData.id]);

  const handlePartySelect = (e) => {
    const partyId = e.target.value;
    const party = data.parties.find(p => p.id === partyId);
    if (party) {
      setFormData(prev => ({
        ...prev,
        partyId: party.id,
        partyName: party.name,
        partyAddress: party.billAddress || '',
        gstNumber: party.gstinBill || '',
        productName: '',
        psdRequirement: '',
        productSettings: {}
      }));
    }
  };

  const loadProduct = (productName, baseForm = formData) => {
    const party = data.parties.find(p => p.id === baseForm.partyId);
    setFormData(applyProductToQuotation(baseForm, productName, party));
  };

  const handleProductSelect = (e) => loadProduct(e.target.value);

  const handleSelectProductFromTable = (productName) => loadProduct(productName);

  const toggleMaterialCharge = (key) => {
    setFormData(prev => {
      const nextCharges = { ...prev.charges, [key]: !prev.charges[key] };
      return {
        ...prev,
        charges: nextCharges,
        mainCharges: buildMainChargesFromMaterial(nextCharges, prev.rates, prev.qty, prev.psdRequirement)
      };
    });
  };

  const handleMaterialRateChange = (key, val) => {
    setFormData(prev => {
      const nextRates = { ...prev.rates, [key]: parseFloat(val) || 0 };
      return {
        ...prev,
        rates: nextRates,
        mainCharges: buildMainChargesFromMaterial(prev.charges, nextRates, prev.qty, prev.psdRequirement)
      };
    });
  };

  const handleQtyChange = (val) => {
    setFormData(prev => ({
      ...prev,
      qty: val,
      mainCharges: buildMainChargesFromMaterial(prev.charges, prev.rates, val, prev.psdRequirement)
    }));
  };

  const selectedParty = data.parties.find(p => p.id === formData.partyId);
  const partyProducts = selectedParty?.products || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    const productSettings = snapshotCurrentProductSettings(formData);
    const configuredProducts = Object.keys(productSettings);
    const payload = {
      ...formData,
      productSettings,
      productName: configuredProducts.length > 1
        ? configuredProducts.join(', ')
        : (formData.productName || configuredProducts[0] || '')
    };

    if (formData.id) {
      updateItem('quotations', formData.id, payload);
    } else {
      const newQuotation = {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      updateData('quotations', newQuotation);
      incrementSerial('QT');
    }
    closeQuotationModal();
  };

  const openQuotationForm = (data) => {
    setFormData(data);
    setIsModalOpen(true);
  };

  const closeQuotationModal = () => {
    setIsModalOpen(false);
    setProductPickerOpen(false);
    setPendingEditData(null);
  };

  const handleEdit = (q) => {
    const party = data.parties.find(p => p.id === q.partyId);
    const baseForm = {
      ...getDefaultForm(),
      ...q,
      charges: { ...DEFAULT_CHARGES, ...(q.charges || {}) },
      rates: { ...DEFAULT_RATES, ...(q.rates || {}) },
      productSettings: { ...(q.productSettings || {}) }
    };

    if (q.productName && !baseForm.productSettings[q.productName?.split(',')[0]?.trim()]) {
      const firstProduct = q.productName.split(',')[0]?.trim();
      if (firstProduct) {
        baseForm.productSettings[firstProduct] = {
          qty: q.qty,
          psdRequirement: q.psdRequirement || '',
          charges: baseForm.charges,
          rates: baseForm.rates,
          mainCharges: q.mainCharges || [],
          optionalCharges: q.optionalCharges || []
        };
      }
    }

    const partyProducts = party?.products || [];
    if (partyProducts.length > 1) {
      setPendingEditData({ baseForm, party, partyProducts });
      setProductPickerOpen(true);
      return;
    }

    const productName = q.productName?.split(',')[0]?.trim() || partyProducts[0]?.name || '';
    openQuotationForm(applyProductToQuotation(baseForm, productName, party));
  };

  const handleConfirmProductEdit = (productName) => {
    if (!pendingEditData) return;
    const { baseForm, party } = pendingEditData;
    openQuotationForm(applyProductToQuotation(baseForm, productName, party));
    setProductPickerOpen(false);
    setPendingEditData(null);
  };

  const handleNewQuotation = () => {
    setFormData(getDefaultForm());
    setIsModalOpen(true);
  };

  const addChargeRow = (type) => {
    setFormData(prev => ({ 
      ...prev, 
      [type]: [...prev[type], type === 'mainCharges' ? { description: '', psdRequirement: '', rate: '' } : { description: '', rate: '' }]
    }));
  };

  const updateChargeRow = (type, index, field, value) => {
    const newCharges = [...formData[type]];
    newCharges[index][field] = value;
    setFormData(prev => ({ ...prev, [type]: newCharges }));
  };

  const quotationsList = data.quotations?.filter(q => !q.isDeleted) || [];
  const filtered = quotationsList.filter(q => 
    q.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.quotationNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Quotations</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create and manage commercial proposals.</p>
        </div>
        <button className="btn btn-primary" onClick={handleNewQuotation}>
          <Plus size={18} /> New Quotation
        </button>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search quotations..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quotation No</th>
                <th>Party Name</th>
                <th>Subject</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id}>
                  <td>{formatDate(q.date)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{q.quotationNo}</td>
                  <td>{q.partyName}</td>
                  <td>{q.subject}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} onClick={() => exportToPDF('QUOTATION', q)}>
                        <Download size={14} /> PDF
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => handleEdit(q)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => deleteItemSoftly('quotations', q.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product picker — shown when editing a quotation with multiple party products */}
      {productPickerOpen && pendingEditData && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, backdropFilter: 'blur(5px)' }}>
          <div className="premium-card" style={{ width: '560px', maxWidth: '95%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '0.35rem', fontSize: '1.25rem' }}>Select Product to Edit</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              This party has multiple products. Choose which product&apos;s quotation details you want to edit.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {pendingEditData.partyProducts.map(prod => {
                const settings = pendingEditData.baseForm.productSettings?.[prod.name];
                const isCurrent = pendingEditData.baseForm.productName?.includes(prod.name);
                const displayRates = settings?.rates || prod.charges || {};
                return (
                  <button
                    key={prod.name}
                    type="button"
                    className="btn"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      background: isCurrent ? 'rgba(16,185,129,0.06)' : 'var(--input-bg)',
                      border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleConfirmProductEdit(prod.name)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{prod.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Nick: {prod.nickname || 'N/A'} · PSD: {prod.psdReq || '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Cleaning ₹{displayRates.cleaning ?? prod.charges?.cleaning ?? 0} · Processing ₹{displayRates.processing ?? prod.charges?.processing ?? 0}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {settings ? 'Configured' : 'Party default'}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.15rem' }}>Click to edit</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={closeQuotationModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{formData.id ? 'Edit Quotation' : 'Create Quotation'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Quotation No</label>
                  <input type="text" className="input-field" value={formData.quotationNo} onChange={e => setFormData({ ...formData, quotationNo: e.target.value })} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Date</label>
                  <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label>Select Party *</label>
                  <select className="input-field" required value={formData.partyId} onChange={handlePartySelect}>
                    <option value="">-- Select --</option>
                    {data.parties.filter(p => p.type === 'Customer').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Contact Person / Attn</label>
                  <input type="text" className="input-field" placeholder="e.g. Mr. Sharma" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Address</label>
                  <textarea className="input-field" rows="2" value={formData.partyAddress} onChange={e => setFormData({...formData, partyAddress: e.target.value})}></textarea>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>GST Number</label>
                  <input type="text" className="input-field" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Subject</label>
                  <input type="text" className="input-field" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Description</label>
                  <textarea className="input-field" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                </div>
              </div>

              {/* Associated Products table — same as Party / Material Receipt */}
              {formData.partyId && partyProducts.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Associated Products &amp; Default Charges</h3>
                    {formData.productName && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        Editing: {formData.productName}
                      </span>
                    )}
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
                        {partyProducts.map((prod, idx) => {
                          const isSelected = formData.productName === prod.name;
                          const savedSettings = formData.productSettings?.[prod.name];
                          const displayRates = savedSettings?.rates || prod.charges || {};
                          const isConfigured = Boolean(savedSettings);
                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                background: isSelected ? 'rgba(16,185,129,0.06)' : isConfigured ? 'rgba(16,185,129,0.02)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{prod.name}</td>
                              <td style={{ padding: '0.5rem' }}>{prod.nickname || 'N/A'}</td>
                              <td style={{ padding: '0.5rem' }}>{prod.psdReq || '—'}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.cleaning ?? prod.charges?.cleaning ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.filterBag ?? prod.charges?.filterBag ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.processing ?? prod.charges?.processing ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>₹{displayRates.sieving ?? prod.charges?.sieving ?? 0}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn"
                                  title="Edit quotation for this product"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: isSelected ? 'var(--accent-primary)' : 'transparent', border: '1px solid var(--border-color)', color: isSelected ? '#fff' : 'inherit' }}
                                  onClick={() => handleSelectProductFromTable(prod.name)}
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                    Click <strong>Edit</strong> on a product to load its charges and editable fields below.
                  </p>
                </div>
              )}

              {formData.productName ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {partyProducts.length > 1 && (
                  <div style={{ gridColumn: 'span 2', padding: '0.85rem 1rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      Which product do you want to edit?
                    </label>
                    <select
                      className="input-field"
                      value={formData.productName || ''}
                      onChange={e => handleSelectProductFromTable(e.target.value)}
                    >
                      {partyProducts.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label>Product / Material *</label>
                  <input type="text" className="input-field" readOnly value={formData.productName} style={{ background: 'var(--glass-bg)' }} />
                </div>
                <div>
                  <label>Estimated Qty (Kg)</label>
                  <input type="number" className="input-field" placeholder="Qty for rate calculation" value={formData.qty} onChange={e => handleQtyChange(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>PSD Requirement</label>
                  <input type="text" className="input-field" placeholder="e.g. d(0.9) < 10 Micron" value={formData.psdRequirement || ''} onChange={e => setFormData({ ...formData, psdRequirement: e.target.value })} />
                </div>
                <div>
                  <label>Validity Date</label>
                  <input type="date" className="input-field" value={formData.validityDate} onChange={e => setFormData({...formData, validityDate: e.target.value})} />
                </div>
                <div>
                  <label>Signatory Name</label>
                  <input type="text" className="input-field" value={formData.signatoryName} onChange={e => setFormData({...formData, signatoryName: e.target.value})} />
                </div>
              </div>
              ) : partyProducts.length > 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--input-bg)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px dashed var(--border-color)' }}>
                  Select a product from the table above to edit quotation charges and details.
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Product / Material *</label>
                  <input type="text" className="input-field" placeholder="e.g. Calcium Carbonate" value={formData.productName} onChange={e => setFormData({ ...formData, productName: e.target.value })} />
                </div>
                <div>
                  <label>Estimated Qty (Kg)</label>
                  <input type="number" className="input-field" placeholder="Qty for rate calculation" value={formData.qty} onChange={e => handleQtyChange(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>PSD Requirement</label>
                  <input type="text" className="input-field" placeholder="e.g. d(0.9) < 10 Micron" value={formData.psdRequirement || ''} onChange={e => setFormData({ ...formData, psdRequirement: e.target.value })} />
                </div>
                <div>
                  <label>Validity Date</label>
                  <input type="date" className="input-field" value={formData.validityDate} onChange={e => setFormData({...formData, validityDate: e.target.value})} />
                </div>
                <div>
                  <label>Signatory Name</label>
                  <input type="text" className="input-field" value={formData.signatoryName} onChange={e => setFormData({...formData, signatoryName: e.target.value})} />
                </div>
              </div>
              )}

              {formData.productName && (
              <>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Material Charges (as per Party Master)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Rates auto-fill from party product config. Minimum cleaning &amp; processing charges are enabled by default.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {MATERIAL_CHARGES.map((item) => (
                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={formData.charges?.[item.key] || false} onChange={() => toggleMaterialCharge(item.key)} />
                        {item.label}
                      </label>
                      {formData.charges?.[item.key] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: ₹</span>
                          <input
                            type="number"
                            className="input-field"
                            style={{ padding: '0.25rem', width: '90px', fontSize: '0.8rem' }}
                            value={formData.rates?.[item.key] || 0}
                            onChange={e => handleMaterialRateChange(item.key, e.target.value)}
                          />
                          {item.isQtyRate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ Kg</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Main Charges Table</h3>
              {formData.mainCharges.map((charge, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input type="text" className="input-field" placeholder="Charge Description (e.g. Processing Charges)" value={charge.description} onChange={e => updateChargeRow('mainCharges', idx, 'description', e.target.value)} />
                  <input type="text" className="input-field" placeholder="PSD Requirement (optional)" value={charge.psdRequirement || ''} onChange={e => updateChargeRow('mainCharges', idx, 'psdRequirement', e.target.value)} />
                  <input type="text" className="input-field" placeholder="Rate (e.g. ₹ 5 / Kg)" value={charge.rate} onChange={e => updateChargeRow('mainCharges', idx, 'rate', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '1.5rem' }} onClick={() => addChargeRow('mainCharges')}>+ Add Main Charge</button>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Optional / Extra Items (If Required)</h3>
              {formData.optionalCharges.map((charge, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input type="text" className="input-field" placeholder="Description (e.g. HDPE Drums)" value={charge.description} onChange={e => updateChargeRow('optionalCharges', idx, 'description', e.target.value)} />
                  <input type="text" className="input-field" placeholder="Rate (e.g. ₹ 500 / PC)" value={charge.rate} onChange={e => updateChargeRow('optionalCharges', idx, 'rate', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '1.5rem' }} onClick={() => addChargeRow('optionalCharges')}>+ Add Optional Charge</button>

              <div>
                <label>Terms & Conditions</label>
                <textarea className="input-field" rows="4" value={formData.terms} onChange={e => setFormData({...formData, terms: e.target.value})}></textarea>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label>Notes</label>
                <textarea className="input-field" rows="4" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
              </div>
              </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn" onClick={closeQuotationModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!formData.productName}>Save Quotation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
