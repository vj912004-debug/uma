import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import {Eye,  Edit2, Trash2, FileDown, ClipboardList, Plus, ArrowLeft } from 'lucide-react';
import { exportToPDF, viewPDF } from '../utils/pdfExport';
import DocChargeRow from '../components/DocChargeRow';
import DateField from '../components/DateField';
import GstTaxBlock from '../components/GstTaxBlock';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import { GST_TYPE_CGST_SGST } from '../utils/taxInvoiceLayout';
import {
  STANDARD_CHARGES_LIST,
  defaultChargeFlags,
  defaultChargeRates,
  emptyChargeQtys,
  calcStandardChargesSubtotal,
  calcProductChargesSubtotalWithQty,
  parseChargeFieldValue,
  qtyInputValue,
  rateInputValue,
  mergeSavedDocCharges,
  getFreshMaterialReceipt,
  findAnyTaxInvoice,
  findAnyProformaInvoice,
  resolveTIProductChargesForDoc,
  getLinkedPITermsForTI,
  applyProformaFinancialsToTaxInvoice,
  syncAllTaxInvoicesWithProformas,
  sanitizeProductCharges,
  enrichTIForPrint
} from '../utils/documentCharges';
import {
  getReceiptProductLabel,
  getReceiptProductNames,
  getProductQty,
  getProductDisplayIndex,
  buildPLProductSummaries,
  getMRReceivedQty,
  getDocProductLabel,
  findAnyPackingList,
  receiptProductOptions
} from '../utils/receiptProducts';
import SearchableSelect from '../components/SearchableSelect';

const TaxInvoice = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
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
    partyId: '',
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
    gstType: GST_TYPE_CGST_SGST,
    terms: 'Payment against delivery.',
    customCharges: [] // Array of { name: '', hsn: '', rate: 0, qty: 0, checked: true }
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

  const resolveProductQty = (prodName) => getProductQty(activeMR, prodName, prodOpts);

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
    const receivedQty = getMRReceivedQty(freshMR, opts);
    const productSummaries = buildPLProductSummaries(pl, freshMR, opts);
    const productLabel = getReceiptProductLabel(freshMR, opts);
    const piTerms = getLinkedPITermsForTI(data.invoices, freshMR.id);
    const productCharges = piTerms?.productCharges
      || resolveTIProductChargesForDoc(freshMR, mrParty, data.invoices, opts);
    const prod = (mrParty?.products || []).find(p => p.name === productSummaries[0]?.prodName);
    const tiSerial = data.settings?.serials?.TI || 1;
    return {
      invoiceNo: generateDocNumber('IN', tiSerial, new Date(docDate)),
      date: docDate,
      dcNo: linkedDC?.dcNo || 'N/A',
      dcDate: linkedDC?.date || 'N/A',
      partyDocNo: freshMR.partyDocNo,
      partyDocDate: freshMR.partyDocDate,
      billAddress: freshMR.billAddress || mrParty?.billAddress || '',
      shipAddress: freshMR.shipAddress || mrParty?.shipAddress || '',
      gstinBill: freshMR.gstinBill || mrParty?.gstinBill || '',
      gstinShip: freshMR.gstinShip || mrParty?.gstinShip || '',
      partyId: freshMR.partyId || mrParty?.id || '',
      partyName: freshMR.partyName,
      productName: productLabel,
      productSummaries,
      productCharges,
      hsnCode: prod?.hsn || '',
      qty: piTerms?.qty > 0 ? piTerms.qty : receivedQty,
      charges: defaultChargeFlags(),
      rates: defaultChargeRates(),
      qtys: emptyChargeQtys(),
      customCharges: piTerms?.customCharges || [],
      discount: piTerms?.discount ?? 0,
      taxRate: piTerms?.taxRate ?? 18,
      gstType: piTerms?.gstType === 'igst' ? 'igst' : GST_TYPE_CGST_SGST,
      terms: 'Payment against delivery.'
    };
  };

  // Keep every TI total identical to its linked PI (repairs existing mismatches)
  useEffect(() => {
    const { invoices, changed } = syncAllTaxInvoicesWithProformas(data.invoices);
    if (changed) setData((prev) => ({ ...prev, invoices }));
  }, [data.invoices, setData]);

  useEffect(() => {
    if (!isModalOpen) return;

    if (editingDoc) {
      const mr = getFreshMaterialReceipt(data.materialReceipts, editingDoc.receiptId);
      const opts = mr ? receiptProductOptions(mr, data) : {};
      const pl = mr ? findAnyPackingList(data.packingLists, mr.id) : null;
      const productSummaries = mr
        ? buildPLProductSummaries(pl, mr, opts)
        : (editingDoc.productSummaries || []);
      const receivedQty = mr ? getMRReceivedQty(mr, opts) : (parseFloat(editingDoc.qty) || 0);
      const merged = mergeSavedDocCharges(editingDoc, receivedQty);
      const piTerms = getLinkedPITermsForTI(data.invoices, editingDoc.receiptId);
      // Prefer linked PI commercial terms so TI total matches PI after Save
      const productCharges = piTerms?.productCharges
        || (editingDoc.productCharges && Object.keys(editingDoc.productCharges).length
          ? sanitizeProductCharges(editingDoc.productCharges)
          : (editingDoc.productCharges || {}));
      setForm(prev => ({
        ...editingDoc,
        ...merged,
        qty: receivedQty > 0 ? receivedQty : (parseFloat(editingDoc.qty) || 0),
        productName: mr ? getReceiptProductLabel(mr, opts) : (editingDoc.productName || ''),
        productSummaries: productSummaries.length ? productSummaries : (editingDoc.productSummaries || []),
        productCharges,
        customCharges: piTerms?.customCharges?.length
          ? piTerms.customCharges
          : (editingDoc.customCharges || []),
        discount: piTerms ? piTerms.discount : (editingDoc.discount || 0),
        taxRate: piTerms ? piTerms.taxRate : (editingDoc.taxRate ?? 18),
        gstType: (piTerms?.gstType || editingDoc.gstType) === 'igst' ? 'igst' : GST_TYPE_CGST_SGST,
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
      const receivedQty = getMRReceivedQty(freshMR, opts);
      const piTerms = getLinkedPITermsForTI(data.invoices, freshMR.id);
      setForm(prev => ({
        ...prev,
        qty: receivedQty,
        productName: getReceiptProductLabel(freshMR, opts),
        productSummaries: buildPLProductSummaries(selectedPL, freshMR, opts),
        productCharges: piTerms?.productCharges
          || resolveTIProductChargesForDoc(freshMR, mrParty, data.invoices, opts),
        customCharges: piTerms?.customCharges || prev.customCharges || [],
        discount: piTerms?.discount ?? prev.discount ?? 0,
        taxRate: piTerms?.taxRate ?? prev.taxRate ?? 18,
        gstType: (piTerms?.gstType || prev.gstType) === 'igst' ? 'igst' : GST_TYPE_CGST_SGST
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

  const handlePartyNameChange = (e) => {
    const name = e.target.value || '';
    const party = (data.parties || []).find(p =>
      !p.isDeleted && (p.name || '').trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (party) {
      setForm(prev => ({
        ...prev,
        partyId: party.id,
        partyName: party.name,
        billAddress: party.billAddress || prev.billAddress || '',
        shipAddress: party.shipAddress || party.billAddress || prev.shipAddress || '',
        gstinBill: party.gstinBill || prev.gstinBill || '',
        gstinShip: party.gstinShip || party.gstinBill || prev.gstinShip || ''
      }));
      return;
    }
    setForm(prev => ({ ...prev, partyId: '', partyName: name }));
  };

  const toggleProductCharge = (prodName, key) => {
    setForm(prev => {
      const pc = getProductChargeBlock(prodName);
      const turningOn = !pc.charges[key];
      const qtys = { ...(pc.qtys || emptyChargeQtys()) };
      if (turningOn && (qtys[key] == null || qtys[key] === '')) {
        qtys[key] = '';
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
        qtys[key] = '';
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

  const addCustomCharge = () => {
    setForm(prev => ({
      ...prev,
      customCharges: [...(prev.customCharges || []), { id: Date.now(), name: '', qty: '', rate: '', checked: true }]
    }));
  };

  const updateCustomCharge = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      customCharges: prev.customCharges.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const removeCustomCharge = (id) => {
    setForm(prev => ({
      ...prev,
      customCharges: prev.customCharges.filter(c => c.id !== id)
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
      gstType: GST_TYPE_CGST_SGST,
      terms: 'Payment against delivery.',
      partyId: '',
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
      gstType: GST_TYPE_CGST_SGST,
      terms: 'Payment against delivery.',
      partyId: '',
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
    const receiptId = activeMR?.id || activePL?.receiptId || editingDoc?.receiptId || '';

    let finalDoc = {
      ...form,
      receiptId,
      partyId: form.partyId || activeMR?.partyId || editingDoc?.partyId || '',
      partyName: form.partyName,
      productName,
      productSummaries,
      productCharges: sanitizedProductCharges,
      charges: legacyBlock.charges || form.charges,
      rates: legacyBlock.rates || form.rates,
      qtys: legacyBlock.qtys || form.qtys,
      qty: activeMR ? (getMRReceivedQty(activeMR, opts) || form.qty) : form.qty,
      subtotal,
      taxAmount,
      total,
      type: 'Tax Invoice',
      ewayBillNo: editingDoc?.ewayBillNo || '',
      ewayBillDate: editingDoc?.ewayBillDate || ''
    };

    // Force TI financials to match linked PI exactly
    const linkedPI = findAnyProformaInvoice(data.invoices, receiptId);
    if (linkedPI && typeof linkedPI.total === 'number') {
      finalDoc = applyProformaFinancialsToTaxInvoice(finalDoc, linkedPI);
    }

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
    setSelectedPL(null);
    setEditingDoc(null);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setSelectedPL(null);
    setEditingDoc(null);
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

  const taxInvoices = (data.invoices || []).filter(inv => inv.invoiceNo?.includes('/IN/'));
  const partyOptions = useMemo(() => uniqueSortedOptions(taxInvoices.map((r) => r.partyName)), [taxInvoices]);
  const productOptions = useMemo(() => uniqueSortedOptions(
    taxInvoices.map((inv) => {
      const mr = (data.materialReceipts || []).find(m => m.id === inv.receiptId);
      return getDocProductLabel(inv, mr, mr ? receiptProductOptions(mr, data) : {});
    })
  ), [taxInvoices, data]);

  const filteredInvoices = taxInvoices.filter((inv) => {
    const mr = (data.materialReceipts || []).find(m => m.id === inv.receiptId);
    const label = getDocProductLabel(inv, mr, mr ? receiptProductOptions(mr, data) : {});
    if (partyFilter && (inv.partyName || '') !== partyFilter) return false;
    if (productFilter && label !== productFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (inv.invoiceNo || '').toLowerCase().includes(q) ||
      (inv.partyName || '').toLowerCase().includes(q) ||
      label.toLowerCase().includes(q)
    );
  });

  const chargesList = STANDARD_CHARGES_LIST;
  const materialQty = parseFloat(form.qty) || 0;

  return (
    <div>
      {!isModalOpen && (
      <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Tax Invoices</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate and manage billing against finalized delivery challans.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Plus size={18} /> Create New Tax Invoice
        </button>
      </header>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search Invoice No, customer or chemical..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        productFilter={productFilter}
        onProductChange={setProductFilter}
        productOptions={productOptions}
      />

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
                          <button title="Preview PDF" onClick={() => viewPDF('TI', enrichTIForExport(inv))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Eye size={14} /></button>
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
      </>
      )}

      {/* Tax Invoice Form */}
      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <span>{editingDoc ? 'Modify Tax Invoice' : 'Create Tax Invoice'}</span>
              <button type="button" className="btn" onClick={closeForm}>
                <ArrowLeft size={18} /> Back to TI list
              </button>
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label>Invoice Number</label>
                  <input type="text" className="input-field" value={form.invoiceNo} onChange={e => setForm({...form, invoiceNo: e.target.value})} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
                </div>
                <div>
                  <label>Invoice Date *</label>
                  <DateField className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label>Delivery Challan No</label>
                  <input type="text" className="input-field" value={form.dcNo} onChange={e => setForm({...form, dcNo: e.target.value})} />
                </div>
                <div>
                  <label>Delivery Challan Date</label>
                  <DateField
                    className="input-field"
                    value={form.dcDate && form.dcDate !== 'N/A' ? form.dcDate : ''}
                    onChange={e => setForm({...form, dcDate: e.target.value})}
                  />
                </div>
                <div>
                  <label>Supplier Doc No</label>
                  <input type="text" className="input-field" value={form.partyDocNo} onChange={e => setForm({...form, partyDocNo: e.target.value})} />
                </div>
                <div>
                  <label>Supplier Doc Date</label>
                  <DateField className="input-field" value={form.partyDocDate} onChange={e => setForm({...form, partyDocDate: e.target.value})} />
                </div>
                <div>
                  <label>Party Name</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    placeholder="Select or type party name"
                    value={form.partyName}
                    onChange={handlePartyNameChange}
                  >
                    <option value="">Select or type party name</option>
                    {(data.parties || []).filter(p => !p.isDeleted).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div>
                  <label>Product(s)</label>
                  <input
                    type="text"
                    className="input-field"
                    readOnly={!!activeMR}
                    placeholder={activeMR ? '' : 'Enter product name'}
                    value={form.productName}
                    onChange={e => setForm({...form, productName: e.target.value})}
                  />
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
                  <label>Received Qty (Kg)</label>
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
                          materialQty={parseFloat(form.qty) || 0}
                          onToggle={toggleCharge}
                          onQtyChange={handleQtyChange}
                          onRateChange={handleRateChange}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Manual Custom Charges</label>
                      <button type="button" className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={addCustomCharge}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Row
                      </button>
                    </div>
                    {(form.customCharges || []).map(c => (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 110px 110px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <input type="checkbox" checked={c.checked !== false} onChange={e => updateCustomCharge(c.id, 'checked', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                        <input type="text" className="input-field" placeholder="Description" value={c.name} onChange={e => updateCustomCharge(c.id, 'name', e.target.value)} />
                        <input type="number" className="input-field" placeholder="NIL" value={qtyInputValue(c.qty)} onChange={e => updateCustomCharge(c.id, 'qty', e.target.value)} min="0" step="any" />
                        <input type="number" className="input-field" placeholder="Rate" value={rateInputValue(c.rate)} onChange={e => updateCustomCharge(c.id, 'rate', e.target.value)} min="0" step="any" />
                        <button type="button" style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.8)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeCustomCharge(c.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    ))}
                    {(form.customCharges || []).length === 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No manual charges added.</div>
                    )}
                  </div>
                </div>

                {/* Calculation Summary */}
                <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>GST Tax Billing Calculations</h4>
                  <GstTaxBlock
                    subtotal={getSubtotal()}
                    taxable={Math.max(0, getSubtotal() - form.discount)}
                    discount={form.discount}
                    taxRate={form.taxRate}
                    gstType={form.gstType}
                    showDiscountInput
                    discountValue={form.discount}
                    onDiscountChange={(discount) => setForm({ ...form, discount })}
                    onTaxRateChange={(taxRate) => setForm({ ...form, taxRate })}
                    onGstTypeChange={(gstType) => setForm({ ...form, gstType })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={closeForm}>Cancel</button>
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
