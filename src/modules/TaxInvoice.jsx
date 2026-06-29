import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { Search, Edit2, Trash2, FileDown, ClipboardList, Plus } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import DocChargeRow from '../components/DocChargeRow';
import {
  STANDARD_CHARGES_LIST,
  defaultChargeFlags,
  defaultChargeRates,
  emptyChargeQtys,
  calcStandardChargesSubtotal,
  calcProductChargesSubtotalWithQty,
  parseChargeFieldValue,
  mergeSavedDocCharges,
  getFreshMaterialReceipt,
  findAnyTaxInvoice,
  resolveTIProductChargesForDoc,
  normalizeProductChargesFromDoc,
  sanitizeProductCharges,
  enrichTIForPrint
} from '../utils/documentCharges';
import {
  getReceiptProductLabel,
  getReceiptProductNames,
  getProductQty,
  getProductDisplayIndex,
  getPLProductNetQty,
  buildPLProductSummaries,
  getDocProductLabel,
  findAnyPackingList,
  receiptProductOptions
} from '../utils/receiptProducts';

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
    productSummaries: [],
    productCharges: {},
    hsnCode: '',
    qty: 0,
    charges: defaultChargeFlags(),
    rates: defaultChargeRates(),
    qtys: emptyChargeQtys(),
    discount: 0,
    taxRate: 18,
    terms: 'Payment against delivery.',
    customCharges: [] // Array of { name: '', hsn: '', rate: 0, qty: 1, checked: true }
  });

  const activePL = editingDoc
    ? findAnyPackingList(data.packingLists, editingDoc.receiptId)
    : selectedPL;
  const activeMR = getFreshMaterialReceipt(
    data.materialReceipts,
    activePL?.receiptId || editingDoc?.receiptId || selectedPL?.receiptId
  );
  const prodOpts = activeMR ? receiptProductOptions(activeMR, data) : {};
  const chargeProductNames = activeMR
    ? getReceiptProductNames(activeMR, prodOpts)
    : Object.keys(form.productCharges || {});

  const resolveProductQty = (prodName) => {
    if (activePL) return getPLProductNetQty(activePL, prodName, activeMR, prodOpts);
    return getProductQty(activeMR, prodName, prodOpts);
  };

  const getProductChargeBlock = (prodName) =>
    form.productCharges?.[prodName]
    || form.productCharges?.[Object.keys(form.productCharges || {}).find(k =>
      (k || '').trim().toLowerCase() === (prodName || '').trim().toLowerCase()
    )]
    || { charges: defaultChargeFlags(), rates: defaultChargeRates(), qtys: emptyChargeQtys() };

  const buildFormFromPL = (pl, docDate) => {
    const freshMR = getFreshMaterialReceipt(data.materialReceipts, pl.receiptId);
    if (!freshMR) return null;
    const opts = receiptProductOptions(freshMR, data);
    const mrParty = opts.party || data.parties.find(p => p.id === freshMR.partyId);
    const linkedDC = data.deliveryChallans.find(d => d.receiptId === freshMR.id);
    const plWeight = pl.totalWeight || 0;
    const productSummaries = buildPLProductSummaries(pl, freshMR, opts);
    const productLabel = getReceiptProductLabel(freshMR, opts);
    const productCharges = resolveTIProductChargesForDoc(freshMR, mrParty, data.invoices, opts);
    const prod = (mrParty?.products || []).find(p => p.name === productSummaries[0]?.prodName);
    const tiSerial = data.settings?.serials?.TI || 1;
    return {
      invoiceNo: generateDocNumber('IN', tiSerial, new Date(docDate)),
      date: docDate,
      dcNo: linkedDC?.dcNo || 'N/A',
      dcDate: linkedDC?.date || 'N/A',
      partyDocNo: freshMR.partyDocNo,
      partyDocDate: freshMR.partyDocDate,
      billAddress: freshMR.billAddress || '',
      shipAddress: freshMR.shipAddress || '',
      gstinBill: freshMR.gstinBill || '',
      gstinShip: freshMR.gstinShip || '',
      partyName: freshMR.partyName,
      productName: productLabel,
      productSummaries,
      productCharges,
      hsnCode: prod?.hsn || '',
      qty: plWeight,
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      customCharges: [],
      discount: 0,
      taxRate: 18,
      terms: 'Payment against delivery.'
    };
  };

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingDoc) {
      const mr = getFreshMaterialReceipt(data.materialReceipts, editingDoc.receiptId);
      const opts = mr ? receiptProductOptions(mr, data) : {};
      const pl = mr ? findAnyPackingList(data.packingLists, mr.id) : null;
      const productSummaries = mr
        ? buildPLProductSummaries(pl, mr, opts)
        : (editingDoc.productSummaries || []);
      const merged = mergeSavedDocCharges(editingDoc, parseFloat(editingDoc.qty) || 0);
      const productCharges = mr
        ? normalizeProductChargesFromDoc(editingDoc.productCharges, editingDoc, mr, opts, opts.party)
        : (editingDoc.productCharges || {});
      setForm(prev => ({
        ...editingDoc,
        ...merged,
        productName: mr ? getReceiptProductLabel(mr, opts) : (editingDoc.productName || ''),
        productSummaries: productSummaries.length ? productSummaries : (editingDoc.productSummaries || []),
        productCharges,
        invoiceNo: prev.invoiceNo || editingDoc.invoiceNo,
        date: prev.date || editingDoc.date
      }));
      return;
    }

    if (selectedPL) {
      const freshMR = getFreshMaterialReceipt(data.materialReceipts, selectedPL.receiptId);
      if (!freshMR) return;
      const opts = receiptProductOptions(freshMR, data);
      const mrParty = opts.party || data.parties.find(p => p.id === freshMR.partyId);
      const plWeight = selectedPL.totalWeight || 0;
      setForm(prev => ({
        ...prev,
        qty: plWeight,
        productName: getReceiptProductLabel(freshMR, opts),
        productSummaries: buildPLProductSummaries(selectedPL, freshMR, opts),
        productCharges: resolveTIProductChargesForDoc(freshMR, mrParty, data.invoices, opts)
      }));
    }
  }, [editingDoc?.id, selectedPL?.id, isModalOpen]);

  useEffect(() => {
    if (editingDoc || !isModalOpen) return;
    const tiSerial = data.settings?.serials?.TI || 1;
    const docNo = generateDocNumber('IN', tiSerial, new Date(form.date));
    setForm(prev => (prev.invoiceNo === docNo ? prev : { ...prev, invoiceNo: docNo }));
  }, [form.date, editingDoc, isModalOpen, data.settings?.serials?.TI]);

  const handleMaterialQtyChange = (val) => {
    setForm(prev => ({ ...prev, qty: parseFloat(val) || 0 }));
  };

  const toggleProductCharge = (prodName, key) => {
    setForm(prev => {
      const pc = getProductChargeBlock(prodName);
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
      return { ...prev, charges: { ...prev.charges, [key]: turningOn }, qtys };
    });
  };

  const handleRateChange = (key, val) => {
    setForm(prev => ({ ...prev, rates: { ...prev.rates, [key]: parseChargeFieldValue(val) } }));
  };

  const handleQtyChange = (key, val) => {
    setForm(prev => ({ ...prev, qtys: { ...(prev.qtys || emptyChargeQtys()), [key]: parseChargeFieldValue(val) } }));
  };

  const getSubtotal = () => {
    const customSum = (form.customCharges || []).reduce((sum, charge) => {
      if (charge.checked) {
        return sum + ((parseFloat(charge.qty) || 0) * (parseFloat(charge.rate) || 0));
      }
      return sum;
    }, 0);

    if (activeMR && Object.keys(form.productCharges || {}).length > 0) {
      return calcProductChargesSubtotalWithQty(form.productCharges, resolveProductQty) + customSum;
    }

    const materialQty = parseFloat(form.qty) || 0;
    return calcStandardChargesSubtotal(form.charges, form.rates, form.qtys, materialQty) + customSum;
  };

  const handleCreate = (pl) => {
    const existing = findAnyTaxInvoice(data.invoices, pl.receiptId);
    if (existing) {
      setEditingDoc(existing);
      setSelectedPL(null);
      setIsModalOpen(true);
      return;
    }
    const docDate = new Date().toISOString().split('T')[0];
    const fromPL = buildFormFromPL(pl, docDate);
    setSelectedPL(pl);
    setEditingDoc(null);
    setForm(fromPL || {
      invoiceNo: '',
      date: docDate,
      dcNo: '',
      dcDate: '',
      partyDocNo: '',
      partyDocDate: '',
      billAddress: '',
      shipAddress: '',
      gstinBill: '',
      gstinShip: '',
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      discount: 0,
      taxRate: 18,
      terms: 'Payment against delivery.',
      partyName: '',
      productName: '',
      hsnCode: '',
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
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      discount: 0,
      taxRate: 18,
      terms: 'Payment against delivery.',
      partyName: '',
      productName: '',
      productSummaries: [],
      productCharges: {},
      hsnCode: '',
      qty: 0,
      customCharges: []
    });
    setIsModalOpen(true);
  };

  const enrichTIForExport = (ti) => enrichTIForPrint(ti, data);

  const handleEdit = (ti) => {
    setEditingDoc(ti);
    setSelectedPL(null);
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

    const opts = activeMR ? receiptProductOptions(activeMR, data) : {};
    const pl = activeMR ? findAnyPackingList(data.packingLists, activeMR.id) : null;
    const productSummaries = activeMR
      ? buildPLProductSummaries(pl, activeMR, opts)
      : (form.productSummaries || []);
    const productName = activeMR
      ? getReceiptProductLabel(activeMR, opts)
      : form.productName;
    const sanitizedProductCharges = activeMR
      ? sanitizeProductCharges(form.productCharges)
      : (form.productCharges || {});
    const firstProd = chargeProductNames[0] || productName;
    const legacyBlock = sanitizedProductCharges[firstProd] || {};

    const finalDoc = {
      ...form,
      receiptId: activeMR?.id || activePL?.receiptId || editingDoc?.receiptId || '',
      partyName: form.partyName,
      productName,
      productSummaries,
      productCharges: sanitizedProductCharges,
      charges: legacyBlock.charges || form.charges,
      rates: legacyBlock.rates || form.rates,
      qtys: legacyBlock.qtys || form.qtys,
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
      if (finalDoc.receiptId && findAnyTaxInvoice(data.invoices, finalDoc.receiptId)) {
        alert('A Tax Invoice already exists for this Material Receipt. Please edit the existing TI.');
        return;
      }
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('TI');
    }
    setIsModalOpen(false);
  };

  const pendingPLs = (data.packingLists || []).filter(pl =>
    !findAnyTaxInvoice(data.invoices, pl.receiptId)
  );

  const seenReceipts = new Set();
  const uniquePendingPLs = pendingPLs.filter(pl => {
    if (seenReceipts.has(pl.receiptId)) return false;
    seenReceipts.add(pl.receiptId);
    return true;
  });

  const filteredInvoices = (data.invoices || []).filter(inv => {
    if (!inv.invoiceNo?.includes('/IN/')) return false;
    const mr = (data.materialReceipts || []).find(m => m.id === inv.receiptId);
    const label = getDocProductLabel(inv, mr, mr ? receiptProductOptions(mr, data) : {});
    return (inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const chargesList = STANDARD_CHARGES_LIST;
  const materialQty = parseFloat(form.qty) || 0;

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
            {uniquePendingPLs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>No pending dispatches awaiting invoices.</p>
            ) : (
              uniquePendingPLs.map(pl => {
                const mr = (data.materialReceipts || []).find(m => m.id === pl.receiptId);
                const label = mr ? getReceiptProductLabel(mr, receiptProductOptions(mr, data)) : pl.productName;
                return (
                <div 
                  key={pl.id} 
                  className="glass-panel" 
                  style={{ padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'all 0.15s ease' }} 
                  onClick={() => handleCreate(pl)}
                >
                  <p style={{ fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 0.25rem 0' }}>{pl.plNo}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{label}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Weight: {pl.totalWeight?.toFixed(1) || 0} Kg</p>
                </div>
              )})
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
                  filteredInvoices.map(inv => {
                    const mr = (data.materialReceipts || []).find(m => m.id === inv.receiptId);
                    const productLabel = getDocProductLabel(inv, mr, mr ? receiptProductOptions(mr, data) : {});
                    return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{inv.invoiceNo}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{inv.partyName}</td>
                      <td style={{ padding: '0.75rem' }}>{productLabel}</td>
                      <td style={{ padding: '0.75rem' }}>{inv.qty} Kg</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{inv.total.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => exportToPDF('TI', enrichTIForExport(inv))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><FileDown size={14} /></button>
                          <button onClick={() => handleEdit(inv)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteTI(inv.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )})
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
                  <label>Product(s)</label>
                  <input type="text" className="input-field" readOnly value={form.productName} />
                  {(form.productSummaries || []).length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(form.productSummaries || []).map((p, idx) => (
                        <div key={p.prodName || idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', background: 'var(--glass-bg)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <strong style={{ color: 'var(--text-main)' }}>{p.prodName}</strong>
                          <span> · {parseFloat(p.qty || 0).toFixed(2)} Kg</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label>HSN Code</label>
                  <input type="text" className="input-field" placeholder="e.g. 29262000" value={form.hsnCode || ''} onChange={e => setForm({...form, hsnCode: e.target.value})} />
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
                  <input type="number" step="any" className="input-field" value={form.qty} onChange={e => handleMaterialQtyChange(e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Bill-To Address</label>
                  <textarea className="input-field" rows="2" value={form.billAddress || ''} onChange={e => setForm({...form, billAddress: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }}></textarea>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Ship-To Address</label>
                  <textarea className="input-field" rows="2" value={form.shipAddress || ''} onChange={e => setForm({...form, shipAddress: e.target.value})} style={{ background: 'var(--glass-bg)', opacity: 0.8 }}></textarea>
                </div>
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', pb: '0.5rem' }}>Tax Invoice Charges Grid</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  {activeMR && chargeProductNames.length > 0 ? (
                    chargeProductNames.map(prodName => {
                      const pc = getProductChargeBlock(prodName);
                      const prodQty = resolveProductQty(prodName);
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
