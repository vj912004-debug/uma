import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber, nextAvailableDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import ExportButton from '../components/ExportButton';
import DocChargeRow from '../components/DocChargeRow';
import {
  STANDARD_CHARGES_LIST,
  defaultChargeFlags,
  defaultChargeRates,
  emptyChargeQtys,
  calcStandardChargesSubtotal,
  parseChargeFieldValue,
  mergeSavedDocCharges,
  getFreshMaterialReceipt,
  findAnyProformaInvoice,
  initProductChargesFromMR,
  normalizeProductChargesFromDoc,
  sanitizeProductCharges,
  calcProductChargesSubtotal,
  enrichPIForPrint
} from '../utils/documentCharges';
import {
  getReceiptProductLabel,
  getReceiptProductNames,
  getReceiptProductSummaries,
  getProductQty,
  getProductDisplayIndex,
  receiptProductOptions
} from '../utils/receiptProducts';

const InvoicesPI = () => {
  const { data, updateData, updateItem, deleteItemSoftly, ensureSerialAtLeast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedMR, setSelectedMR] = useState(null);

  // PI Form State
  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: '',
    partyDocDate: '',
    partyName: '',
    productName: '',
    productSummaries: [],
    billAddress: '',
    shipAddress: '',
    gstinBill: '',
    gstinShip: '',
    dcNo: 'Verbal',
    dcDate: '',
    qty: 0,
    charges: defaultChargeFlags(),
    rates: defaultChargeRates(),
    qtys: emptyChargeQtys(),
    discount: 0,
    taxRate: 18,
    terms: '100% advance against PI.',
    customCharges: [], // Array of { name: '', hsn: '', rate: 0, qty: 1, checked: true }
    productCharges: {}
  });

  const activeMR = editingDoc
    ? getFreshMaterialReceipt(data.materialReceipts, editingDoc.receiptId)
    : selectedMR
      ? getFreshMaterialReceipt(data.materialReceipts, selectedMR)
      : null;
  const party = data.parties.find(p => p.id === activeMR?.partyId);

  const buildFormFromMR = (mr, docDate) => {
    const freshMR = getFreshMaterialReceipt(data.materialReceipts, mr);
    if (!freshMR) return null;
    const prodOpts = receiptProductOptions(freshMR, data);
    const mrParty = prodOpts.party || data.parties.find(p => p.id === freshMR.partyId);
    const productLabel = getReceiptProductLabel(freshMR, prodOpts);
    const productSummaries = getReceiptProductSummaries(freshMR, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
    const materialQty = productSummaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0)
      || parseFloat(freshMR.totalQty)
      || 0;
    const productCharges = initProductChargesFromMR(freshMR, mrParty, prodOpts);
    const piSerial = data.settings?.serials?.PI || 1;
    return {
      invoiceNo: generateDocNumber('PI', piSerial, new Date(docDate)),
      date: docDate,
      partyDocNo: freshMR.partyDocNo,
      partyDocDate: freshMR.partyDocDate,
      partyName: freshMR.partyName,
      productName: productLabel,
      productSummaries,
      billAddress: freshMR.billAddress || '',
      shipAddress: freshMR.shipAddress || '',
      gstinBill: freshMR.gstinBill || '',
      gstinShip: freshMR.gstinShip || '',
      dcNo: 'Verbal',
      dcDate: docDate,
      qty: materialQty,
      productCharges,
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      customCharges: [],
      discount: 0,
      taxRate: 18,
      terms: '100% advance against PI.'
    };
  };

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingDoc) {
      const mr = getFreshMaterialReceipt(data.materialReceipts, editingDoc.receiptId);
      const prodOpts = mr ? receiptProductOptions(mr, data) : {};
      const productSummaries = mr
        ? getReceiptProductSummaries(mr, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0)
        : (editingDoc.productSummaries || []);
      const merged = mergeSavedDocCharges(editingDoc, parseFloat(editingDoc.qty) || 0);
      const productCharges = mr
        ? normalizeProductChargesFromDoc(editingDoc.productCharges, editingDoc, mr, prodOpts, prodOpts.party)
        : (editingDoc.productCharges || {});
      setForm(prev => ({
        ...editingDoc,
        ...merged,
        productName: mr ? getReceiptProductLabel(mr, prodOpts) : (editingDoc.productName || ''),
        productSummaries: productSummaries.length ? productSummaries : (editingDoc.productSummaries || []),
        productCharges,
        invoiceNo: prev.invoiceNo || editingDoc.invoiceNo,
        date: prev.date || editingDoc.date
      }));
      return;
    }

    if (selectedMR) {
      const freshMR = getFreshMaterialReceipt(data.materialReceipts, selectedMR);
      if (!freshMR) return;
      const prodOpts = receiptProductOptions(freshMR, data);
      const mrParty = prodOpts.party || data.parties.find(p => p.id === freshMR.partyId);
      const productLabel = getReceiptProductLabel(freshMR, prodOpts);
      const productSummaries = getReceiptProductSummaries(freshMR, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0);
      const materialQty = productSummaries.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0)
        || parseFloat(freshMR.totalQty)
        || 0;
      const productCharges = initProductChargesFromMR(freshMR, mrParty, prodOpts);
      setForm(prev => ({
        ...prev,
        partyDocNo: freshMR.partyDocNo || '',
        partyDocDate: freshMR.partyDocDate || '',
        partyName: freshMR.partyName || '',
        billAddress: freshMR.billAddress || '',
        shipAddress: freshMR.shipAddress || '',
        gstinBill: freshMR.gstinBill || '',
        gstinShip: freshMR.gstinShip || '',
        productName: productLabel,
        productSummaries,
        qty: materialQty,
        productCharges
      }));
    }
  }, [editingDoc?.id, selectedMR?.id, isModalOpen]);

  useEffect(() => {
    if (editingDoc || !isModalOpen) return;
    const piSerial = data.settings?.serials?.PI || 1;
    const docNo = generateDocNumber('PI', piSerial, new Date(form.date));
    setForm(prev => (prev.invoiceNo === docNo ? prev : { ...prev, invoiceNo: docNo, dcDate: form.date }));
  }, [form.date, editingDoc, isModalOpen, data.settings?.serials?.PI]);

  const handleMaterialQtyChange = (val) => {
    setForm(prev => ({ ...prev, qty: parseFloat(val) || 0 }));
  };

  const prodOpts = activeMR ? receiptProductOptions(activeMR, data) : {};
  const chargeProductNames = activeMR
    ? getReceiptProductNames(activeMR, prodOpts)
    : Object.keys(form.productCharges || {});

  const getProductChargeBlock = (prodName) =>
    form.productCharges?.[prodName]
    || form.productCharges?.[Object.keys(form.productCharges || {}).find(k =>
      (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
    )]
    || { charges: defaultChargeFlags(), rates: defaultChargeRates(), qtys: emptyChargeQtys() };

  const toggleProductCharge = (prodName, key) => {
    setForm(prev => {
      const pc = prev.productCharges?.[prodName]
        || prev.productCharges?.[Object.keys(prev.productCharges || {}).find(k =>
          (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
        )]
        || { charges: defaultChargeFlags(), rates: defaultChargeRates(), qtys: emptyChargeQtys() };
      const turningOn = !pc.charges[key];
      const qtys = { ...(pc.qtys || emptyChargeQtys()) };
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = 1;
      }
      return {
        ...prev,
        productCharges: {
          ...(prev.productCharges || {}),
          [prodName]: {
            ...pc,
            charges: { ...pc.charges, [key]: turningOn },
            qtys
          }
        }
      };
    });
  };

  const handleProductRateChange = (prodName, key, val) => {
    setForm(prev => {
      const pc = prev.productCharges?.[prodName]
        || { charges: defaultChargeFlags(), rates: defaultChargeRates(), qtys: emptyChargeQtys() };
      return {
        ...prev,
        productCharges: {
          ...(prev.productCharges || {}),
          [prodName]: {
            ...pc,
            rates: { ...pc.rates, [key]: parseChargeFieldValue(val) }
          }
        }
      };
    });
  };

  const handleProductQtyChange = (prodName, key, val) => {
    setForm(prev => {
      const pc = prev.productCharges?.[prodName]
        || { charges: defaultChargeFlags(), rates: defaultChargeRates(), qtys: emptyChargeQtys() };
      return {
        ...prev,
        productCharges: {
          ...(prev.productCharges || {}),
          [prodName]: {
            ...pc,
            qtys: { ...(pc.qtys || emptyChargeQtys()), [key]: parseChargeFieldValue(val) }
          }
        }
      };
    });
  };

  const toggleCharge = (key) => {
    setForm(prev => {
      const turningOn = !prev.charges[key];
      const qtys = { ...(prev.qtys || emptyChargeQtys()) };
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = 1;
      }
      return {
        ...prev,
        charges: { ...prev.charges, [key]: turningOn },
        qtys
      };
    });
  };

  const handleRateChange = (key, val) => {
    setForm(prev => ({
      ...prev,
      rates: { ...prev.rates, [key]: parseChargeFieldValue(val) }
    }));
  };

  const handleQtyChange = (key, val) => {
    setForm(prev => ({
      ...prev,
      qtys: { ...(prev.qtys || emptyChargeQtys()), [key]: parseChargeFieldValue(val) }
    }));
  };

  const getSubtotal = () => {
    const customSum = (form.customCharges || []).reduce((sum, charge) => {
      if (charge.checked) {
        return sum + ((parseFloat(charge.qty) || 0) * (parseFloat(charge.rate) || 0));
      }
      return sum;
    }, 0);

    if (activeMR && Object.keys(form.productCharges || {}).length > 0) {
      return calcProductChargesSubtotal(form.productCharges, activeMR, prodOpts) + customSum;
    }

    const materialQty = parseFloat(form.qty) || 0;
    return calcStandardChargesSubtotal(form.charges, form.rates, form.qtys, materialQty) + customSum;
  };

  const handleCreate = (mr) => {
    const docDate = new Date().toISOString().split('T')[0];
    const fromMR = buildFormFromMR(mr, docDate);
    setSelectedMR(mr);
    setEditingDoc(null);
    setForm(fromMR || {
      invoiceNo: '',
      date: docDate,
      partyDocNo: '',
      partyDocDate: '',
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      discount: 0,
      taxRate: 18,
      terms: '100% advance against PI.',
      partyName: '',
      productName: '',
    productSummaries: [],
      billAddress: '',
      shipAddress: '',
      gstinBill: '',
      gstinShip: '',
      dcNo: 'Verbal',
      dcDate: docDate,
      qty: 0,
      customCharges: []
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedMR(null);
    setEditingDoc(null);
    const piSerial = data.settings?.serials?.PI || 1;
    const docNo = generateDocNumber('PI', piSerial, new Date());
    setForm({
      invoiceNo: docNo,
      date: new Date().toISOString().split('T')[0],
      partyDocNo: '',
      partyDocDate: '',
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      discount: 0,
      taxRate: 18,
      terms: '100% advance against PI.',
      partyName: '',
      productName: '',
    productSummaries: [],
      billAddress: '',
      shipAddress: '',
      gstinBill: '',
      gstinShip: '',
      dcNo: 'Verbal',
      dcDate: '',
      qty: 0,
      customCharges: [],
      productCharges: {}
    });
    setIsModalOpen(true);
  };

  const enrichPIForExport = (pi) => enrichPIForPrint(pi, data);

  const handleEdit = (pi) => {
    setEditingDoc(pi);
    setSelectedMR(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = getSubtotal();
    const discountAmount = parseFloat(form.discount) || 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxable * (form.taxRate / 100);
    const total = taxable + taxAmount;

    const prodOpts = activeMR ? receiptProductOptions(activeMR, data) : {};
    const productSummaries = activeMR
      ? getReceiptProductSummaries(activeMR, prodOpts).filter(p => p.batchCount > 0 || p.qty > 0)
      : (form.productSummaries || []);
    const productName = activeMR
      ? getReceiptProductLabel(activeMR, prodOpts)
      : form.productName;
    const sanitizedProductCharges = activeMR
      ? sanitizeProductCharges(form.productCharges)
      : (form.productCharges || {});
    const firstProd = chargeProductNames[0] || productName;
    const legacyBlock = sanitizedProductCharges[firstProd] || {};

    const piPool = (data.invoices || []).filter(inv =>
      !inv.isDeleted && (inv.type === 'Proforma Invoice' || inv.invoiceNo?.includes('/PI/'))
    );
    const { docNo, nextSerial } = nextAvailableDocNumber(
      'PI',
      data.settings?.serials?.PI || 1,
      form.date,
      piPool,
      { excludeId: editingDoc?.id }
    );

    const finalDoc = {
      ...form,
      receiptId: activeMR?.id || editingDoc?.receiptId || '',
      partyName: form.partyName,
      productName,
      productSummaries,
      productCharges: sanitizedProductCharges,
      charges: legacyBlock.charges || form.charges,
      rates: legacyBlock.rates || form.rates,
      qtys: legacyBlock.qtys || form.qtys,
      invoiceNo: editingDoc ? form.invoiceNo : docNo,
      qty: form.qty,
      subtotal,
      taxAmount,
      total,
      type: 'Proforma Invoice'
    };

    if (editingDoc) {
      updateItem('invoices', editingDoc.id, finalDoc);
    } else {
      if (activeMR?.id && findAnyProformaInvoice(data.invoices, activeMR.id)) {
        alert('A Proforma Invoice already exists for this Material Receipt. Please edit the existing PI.');
        return;
      }
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      ensureSerialAtLeast('PI', nextSerial);
    }
    setIsModalOpen(false);
    setSelectedMR(null);
  };

  const pendingMRs = (data.materialReceipts || []).filter(mr =>
    !findAnyProformaInvoice(data.invoices, mr.id)
  );

  const piList = (data.invoices || []).filter(inv => inv.type === 'Proforma Invoice' && !inv.isDeleted);
  const filtered = piList.filter(inv => 
    (inv.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Date', key: 'date' },
    { label: 'PI Number', key: 'invoiceNo' },
    { label: 'Party Name', key: 'partyName' },
    { label: 'Qty (Kg)', key: 'qty' },
    { label: 'Total (₹)', key: 'total' }
  ];

  const chargesList = STANDARD_CHARGES_LIST;
  const materialQty = parseFloat(form.qty) || 0;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Proforma Invoices (PI)</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate advanced billing from Material Receipts.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ExportButton data={filtered} columns={exportColumns} filename="Proforma_Invoices" title="Proforma Invoices Log" />
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={18} /> Create New PI
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Left Side: Pending MRs scheduler */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Pending M.R. Queue
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select a Material Receipt to generate one combined Proforma Invoice for all products.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingMRs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending receipts awaiting PI.</p>
            ) : (
              pendingMRs.map(mr => {
                const prodOpts = receiptProductOptions(mr, data);
                const productLabel = getReceiptProductLabel(mr, prodOpts);
                return (
                <div 
                  key={mr.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(mr)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{mr.receiptNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{mr.partyName}</p>
                  <p style={{ fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>{productLabel || mr.productName || '—'}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Weight: {mr.totalQty?.toFixed(1) || 0} Kg</p>
                </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: PI Log */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Proforma Invoice Log</h3>
          
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by PI number or Party Name..." 
              style={{ paddingLeft: '3rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PI Date</th>
                  <th>PI Number</th>
                  <th>Party Name</th>
                  <th>Product</th>
                  <th>Qty (Kg)</th>
                  <th>Total (₹)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No Proforma Invoices found.</td></tr>
                ) : (
                  filtered.map(pi => (
                    <tr key={pi.id}>
                      <td>{formatDate(pi.date)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{pi.invoiceNo}</td>
                      <td style={{ fontWeight: 600 }}>{pi.partyName}</td>
                      <td>{pi.productName}</td>
                      <td>{pi.qty}</td>
                      <td style={{ fontWeight: 600 }}>₹{pi.total?.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('PI', enrichPIForExport(pi))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(pi)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteItemSoftly('invoices', pi.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}>
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
            <h2 style={{ marginBottom: '1.5rem' }}>{editingDoc ? 'Modify Proforma Invoice' : 'Create Proforma Invoice'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>PI Number</label>
                  <input type="text" className="input-field" value={form.invoiceNo} onChange={e => setForm({...form, invoiceNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>PI Date *</label>
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
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Product Name</label>
                  <input type="text" className="input-field" readOnly value={form.productName} />
                  {(form.productSummaries || []).length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(form.productSummaries || []).map((p, idx) => (
                        <div key={p.prodName || idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', background: 'var(--glass-bg)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <strong style={{ color: 'var(--text-main)' }}>{p.prodName}</strong>
                          <span> · {parseFloat(p.qty || 0).toFixed(2)} Kg · {p.drums || 0} drum{(p.drums || 0) !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label>Material Qty (Kg)</label>
                  <input type="number" step="any" className="input-field" value={form.qty} onChange={e => handleMaterialQtyChange(e.target.value)} />
                </div>
                <div>
                  <label>Delivery Challan No.</label>
                  <input type="text" className="input-field" value={form.dcNo || 'Verbal'} onChange={e => setForm({...form, dcNo: e.target.value})} />
                </div>
                <div>
                  <label>Delivery Challan Date</label>
                  <input type="date" className="input-field" value={form.dcDate || form.date} onChange={e => setForm({...form, dcDate: e.target.value})} />
                </div>
                <div>
                  <label>Bill-To GSTIN</label>
                  <input type="text" className="input-field" value={form.gstinBill || ''} onChange={e => setForm({...form, gstinBill: e.target.value})} />
                </div>
                <div>
                  <label>Ship-To GSTIN</label>
                  <input type="text" className="input-field" value={form.gstinShip || ''} onChange={e => setForm({...form, gstinShip: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill-To Address</label>
                  <textarea className="input-field" rows="2" value={form.billAddress || ''} onChange={e => setForm({...form, billAddress: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship-To Address</label>
                  <textarea className="input-field" rows="2" value={form.shipAddress || ''} onChange={e => setForm({...form, shipAddress: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>PI Charges Grid</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  {activeMR && chargeProductNames.length > 0 ? (
                    chargeProductNames.map(prodName => {
                      const pc = getProductChargeBlock(prodName);
                      const prodQty = getProductQty(activeMR, prodName, prodOpts);
                      const displayIdx = getProductDisplayIndex(activeMR, prodName, prodOpts);
                      return (
                        <div key={prodName} style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            Product {displayIdx}: {prodName} ({prodQty.toFixed(2)} Kg)
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {chargesList.map(item => (
                              <DocChargeRow
                                key={`${prodName}-${item.key}`}
                                item={item}
                                charges={pc.charges}
                                rates={pc.rates}
                                qtys={pc.qtys}
                                materialQty={prodQty}
                                onToggle={(key) => toggleProductCharge(prodName, key)}
                                onQtyChange={(key, val) => handleProductQtyChange(prodName, key, val)}
                                onRateChange={(key, val) => handleProductRateChange(prodName, key, val)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {chargesList.map(item => (
                        <DocChargeRow
                          key={item.key}
                          item={item}
                          charges={form.charges}
                          rates={form.rates}
                          qtys={form.qtys}
                          materialQty={materialQty}
                          onToggle={toggleCharge}
                          onQtyChange={handleQtyChange}
                          onRateChange={handleRateChange}
                        />
                      ))}
                    </div>
                  )}

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
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>GST Tax Calculations</h4>
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
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={() => { setIsModalOpen(false); setSelectedMR(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Proforma Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPI;
