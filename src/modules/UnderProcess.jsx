import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { 
  FileText, Activity, UploadCloud, Package, Truck, 
  FileSpreadsheet, FileCheck, CheckCircle, Clock, X, Plus, Edit2, Download, Trash2 
} from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';

const UnderProcess = () => {
  const { data, updateData, updateItem, setData, incrementSerial } = useAppContext();
  const [activeModal, setActiveModal] = useState(null); // 'PI' | 'BPR' | 'PSD' | 'PL' | 'DC' | 'EWDC' | 'TI' | 'EWTI' | null
  const [modalContext, setModalContext] = useState(null); // Active M.R. record
  const [editingDoc, setEditingDoc] = useState(null); // If editing an existing doc
  const [showDocPopover, setShowDocPopover] = useState(null); // { cellType, doc, mrId } for blue click

  // ----------------------------------------------------
  // Document Search & Helper Helpers
  // ----------------------------------------------------
  const getPI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/PI/'));
  const getBPR = (mrId) => (data.bprs || []).find(b => b.receiptId === mrId);
  const getPSD = (mrId) => (data.psds || []).find(p => p.receiptId === mrId);
  const getPL = (mrId) => (data.packingLists || []).find(pl => pl.receiptId === mrId);
  const getDC = (mrId) => (data.deliveryChallans || []).find(dc => dc.receiptId === mrId);
  const getTI = (mrId) => (data.invoices || []).find(inv => inv.receiptId === mrId && inv.invoiceNo?.includes('/IN/'));

  // ----------------------------------------------------
  // Modals & Popover Triggers
  // ----------------------------------------------------
  const handlePendingClick = (mr, type) => {
    setModalContext(mr);
    setEditingDoc(null);
    setActiveModal(type);
  };

  const handleBlueClick = (mrId, cellType, doc, e) => {
    e.stopPropagation();
    setShowDocPopover({ cellType, doc, mrId, x: e.clientX, y: e.clientY });
  };

  const handleEditDoc = () => {
    const { cellType, doc, mrId } = showDocPopover;
    const mr = data.materialReceipts.find(r => r.id === mrId);
    setModalContext(mr);
    setEditingDoc(doc);
    setShowDocPopover(null);
    setActiveModal(cellType);
  };

  const handleDeleteDoc = () => {
    const { cellType, doc } = showDocPopover;
    if (window.confirm(`Are you sure you want to delete this ${cellType} document?`)) {
      if (cellType === 'PI' || cellType === 'TI') {
        setData(prev => ({
          ...prev,
          invoices: prev.invoices.filter(i => i.id !== doc.id)
        }));
      } else if (cellType === 'BPR') {
        setData(prev => ({ ...prev, bprs: prev.bprs.filter(b => b.id !== doc.id) }));
      } else if (cellType === 'PSD') {
        setData(prev => ({ ...prev, psds: prev.psds.filter(p => p.id !== doc.id) }));
      } else if (cellType === 'PL') {
        setData(prev => ({ ...prev, packingLists: prev.packingLists.filter(p => p.id !== doc.id) }));
      } else if (cellType === 'DC') {
        setData(prev => ({ ...prev, deliveryChallans: prev.deliveryChallans.filter(d => d.id !== doc.id) }));
      } else if (cellType === 'EWDC') {
        const dc = getDC(showDocPopover.mrId);
        if (dc) {
          updateItem('deliveryChallans', dc.id, { ...dc, ewayBillNo: '', ewayBillDate: '' });
        }
      } else if (cellType === 'EWTI') {
        const ti = getTI(showDocPopover.mrId);
        if (ti) {
          updateItem('invoices', ti.id, { ...ti, ewayBillNo: '', ewayBillDate: '' });
        }
      }
      setShowDocPopover(null);
    }
  };

  const handleDownloadPDF = () => {
    const { cellType, doc } = showDocPopover;
    exportToPDF(cellType, doc);
    setShowDocPopover(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Under Process Tracker</h1>
        <p style={{ color: 'var(--text-muted)' }}>Interactive workflow command center. Monitor real-time progress and generate downstream documents.</p>
      </header>

      {/* Process Matrix */}
      <div className="premium-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem' }}>M.R. Date</th>
              <th style={{ padding: '1rem' }}>Customer</th>
              <th style={{ padding: '1rem' }}>Product</th>
              <th style={{ padding: '1rem' }}>Qty (Kg)</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>PI</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>BPR</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>PSD</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>PL</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>DC</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>E-Way DC</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>Tax Invoice</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>E-Way TI</th>
            </tr>
          </thead>
          <tbody>
            {(data.materialReceipts || []).length === 0 ? (
              <tr>
                <td colSpan="12" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No Material Receipts found. Go to "Add Material Received Data" first!
                </td>
              </tr>
            ) : (
              (data.materialReceipts || []).map(mr => {
                const pi = getPI(mr.id);
                const bpr = getBPR(mr.id);
                const psd = getPSD(mr.id);
                const pl = getPL(mr.id);
                const dc = getDC(mr.id);
                const ti = getTI(mr.id);

                return (
                  <tr key={mr.id} style={{ borderBottom: '1px solid var(--border-color)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{mr.date}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.partyName}</td>
                    <td style={{ padding: '1rem' }}>{mr.productName} {mr.nickName ? `(${mr.nickName})` : ''}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.totalQty || mr.receivedQty || 0}</td>

                    {/* 1. Performa Invoice (PI) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {pi ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'PI', pi, e)} style={blueStyle}>
                          {pi.invoiceNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PI')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 2. BPR */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {bpr ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'BPR', bpr, e)} style={blueStyle}>
                          {bpr.bprNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'BPR')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 3. PSD Uploader */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {psd ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'PSD', psd, e)} style={blueStyle}>
                          {psd.psdNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PSD')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 4. Packing List (PL) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {pl ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'PL', pl, e)} style={blueStyle}>
                          {pl.plNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PL')} style={yellowStyle} disabled={!bpr}>Pending</button>
                      )}
                    </td>

                    {/* 5. Delivery Challan (DC) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {dc ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'DC', dc, e)} style={blueStyle}>
                          {dc.dcNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'DC')} style={yellowStyle} disabled={!pl}>Pending</button>
                      )}
                    </td>

                    {/* 6. E-Way Bill from DC */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {dc && dc.ewayBillNo ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'EWDC', dc, e)} style={blueStyle}>
                          {dc.ewayBillNo}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'EWDC')} style={yellowStyle} disabled={!dc}>Pending</button>
                      )}
                    </td>

                    {/* 7. Tax Invoice */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {ti ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'TI', ti, e)} style={blueStyle}>
                          {ti.invoiceNo.split('/').slice(-1)[0]}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'TI')} style={yellowStyle} disabled={!pl}>Pending</button>
                      )}
                    </td>

                    {/* 8. E-Way Bill from TI */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {ti && ti.ewayBillNo ? (
                        <button onClick={(e) => handleBlueClick(mr.id, 'EWTI', ti, e)} style={blueStyle}>
                          {ti.ewayBillNo}
                        </button>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'EWTI')} style={yellowStyle} disabled={!ti}>Pending</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}></span>
            <span>Blue = Document Generated (Click to View, Edit or Delete)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }}></span>
            <span>Yellow = Document Pending (Click to Generate now!)</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          CONTEXT MENU/POPOVER FOR GENERATED DOCUMENTS
      ---------------------------------------------------- */}
      {showDocPopover && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setShowDocPopover(null)}>
          <div style={{ 
            position: 'absolute', 
            left: `${showDocPopover.x}px`, 
            top: `${showDocPopover.y - 120}px`,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            borderRadius: '12px',
            padding: '0.5rem 0',
            width: '180px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 120
          }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {showDocPopover.cellType} Actions
            </p>
            <button style={popBtn} onClick={handleDownloadPDF}><Download size={14} /> Download PDF</button>
            <button style={popBtn} onClick={handleEditDoc}><Edit2 size={14} /> Edit Document</button>
            <button style={{ ...popBtn, color: '#ef4444' }} onClick={handleDeleteDoc}><Trash2 size={14} /> Delete Entry</button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          EMBEDDED DOCUMENT GENERATION MODALS
      ---------------------------------------------------- */}
      {activeModal && (
        <ModalWrapper 
          title={`${editingDoc ? 'Edit' : 'Create'} ${activeModal}`} 
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'PI' && (
            <PerformaInvoiceGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'BPR' && (
            <BPRGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'PSD' && (
            <PSDGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'PL' && (
            <PLGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'DC' && (
            <DCGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'EWDC' && (
            <EWayDCGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'TI' && (
            <TaxInvoiceGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
          {activeModal === 'EWTI' && (
            <EWayTIGenerator 
              mr={modalContext} 
              editing={editingDoc}
              onClose={() => setActiveModal(null)} 
            />
          )}
        </ModalWrapper>
      )}
    </div>
  );
};

// ----------------------------------------------------
// UI Styles
// ----------------------------------------------------
const blueStyle = {
  background: 'rgba(59, 130, 246, 0.12)',
  color: '#3b82f6',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '6px',
  padding: '0.35rem 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '90px'
};

const yellowStyle = {
  background: 'rgba(245, 158, 11, 0.12)',
  color: '#f59e0b',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: '6px',
  padding: '0.35rem 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '90px'
};

const popBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.6rem 1rem',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  hover: { background: 'rgba(255,255,255,0.03)' }
};

// Modal Wrapper Component
const ModalWrapper = ({ title, children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)', padding: '2rem 0' }}>
    <div className="premium-card" style={{ width: '900px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto', position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <X size={20} />
      </button>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>{title}</h2>
      {children}
    </div>
  </div>
);

// ----------------------------------------------------
// 1. PERFORMA INVOICE GENERATOR FORM (Slide 7 Set A)
// ----------------------------------------------------
const PerformaInvoiceGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === mr.productName);

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

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        charges: editing.charges || {},
        rates: editing.rates || {}
      });
    } else {
      const piSerial = data.settings?.serials?.PI || 1;
      const docNo = generateDocNumber('PI', piSerial, new Date(form.date));
      
      // Pull pre-configured rates from Party Product Master
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
  }, [form.date, editing, prodConfig, data.settings?.serials?.PI]);

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

  // Subtotal & GST math
  const getSubtotal = () => {
    return Object.keys(form.charges).reduce((sum, key) => {
      if (form.charges[key]) {
        // If it's a processing-rate item, multiply by quantity! Otherwise it is flat.
        const isQtyRate = ['processing', 'sieving', 'cleaning'].includes(key);
        const qty = parseFloat(mr.totalQty || mr.receivedQty || 0);
        const rate = form.rates[key] || 0;
        return sum + (isQtyRate ? qty * rate : rate);
      }
      return sum;
    }, 0);
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
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: mr.productName,
      qty: mr.totalQty || mr.receivedQty || 0,
      subtotal,
      taxAmount,
      total,
      type: 'Proforma Invoice'
    };

    if (editing) {
      updateItem('invoices', editing.id, finalDoc);
    } else {
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PI');
    }
    onClose();
  };

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
          <input type="text" className="input-field" readOnly value={mr.gstinBill} />
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
          <input type="text" className="input-field" readOnly value={`${mr.totalQty || mr.receivedQty || 0} Kg`} />
        </div>
      </div>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '0.5rem' }}>Auto-Charges Configuration Panel</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Toggle standard charges to add them as line items with HSN codes.</p>
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
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>Calculation Invoice Summary</h4>
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
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Proforma Invoice</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 2. BPR WEIGHTStwin TABLES FORM (Slide 8 Set A)
// ----------------------------------------------------
const BPRGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = (data.parties || []).find(p => p.id === mr.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === mr.productName);

  const [form, setForm] = useState({
    bprNo: '',
    date: new Date().toISOString().split('T')[0],
    productName: mr.productName,
    totalInputQty: mr.totalQty || mr.receivedQty || 0,
    psdRequirement: prodConfig?.psdReq || '90% < 10M',
    totalDrums: mr.totalDrums || 1,
    doubleDispatch: false,
    receivedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    dispatchedBatches: [] // Array of { batchNo, drumNo, gross, tare, net }
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        receivedBatches: editing.receivedBatches || [],
        dispatchedBatches: editing.dispatchedBatches || []
      });
    } else {
      const bprSerial = data.settings?.serials?.BPR || 1;
      const docNo = generateDocNumber('BPR', bprSerial, new Date(form.date));

      // Construct rows from MR batches (with legacy fallback for old single-batch structure)
      const activeMRBatches = (mr.batches || [
        { batchNo: mr.batchNo || 'N/A', drums: 1, qty: parseFloat(mr.receivedQty || mr.totalQty || 0), isEmptyDrums: false }
      ]).filter(b => !b.isEmptyDrums);
      const receivedRows = [];
      
      activeMRBatches.forEach(b => {
        const drumCount = parseInt(b.drums) || 1;
        for (let d = 1; d <= drumCount; d++) {
          receivedRows.push({
            batchNo: b.batchNo,
            drumNo: d.toString(),
            gross: 0,
            tare: 0,
            net: 0
          });
        }
      });

      setForm(prev => ({
        ...prev,
        bprNo: docNo,
        receivedBatches: receivedRows,
        dispatchedBatches: receivedRows.map(r => ({ ...r }))
      }));
    }
  }, [form.date, editing, mr, data.settings?.serials?.BPR]);

  // Handle double dispatch drums expansion
  const toggleDoubleDispatch = () => {
    const nextVal = !form.doubleDispatch;
    setForm(prev => {
      let nextDispatch = [];
      if (nextVal) {
        // Double each drum row in dispatched weight!
        prev.receivedBatches.forEach(r => {
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}A` });
          nextDispatch.push({ ...r, drumNo: `${r.drumNo}B` });
        });
      } else {
        nextDispatch = prev.receivedBatches.map(r => ({ ...r }));
      }
      return {
        ...prev,
        doubleDispatch: nextVal,
        dispatchedBatches: nextDispatch
      };
    });
  };

  const handleCellChange = (tableKey, idx, field, val) => {
    setForm(prev => {
      const list = [...prev[tableKey]];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
      list[idx] = item;
      return { ...prev, [tableKey]: list };
    });
  };

  const addCustomRow = (tableKey) => {
    setForm(prev => ({
      ...prev,
      [tableKey]: [...prev[tableKey], { batchNo: 'Custom', drumNo: (prev[tableKey].length + 1).toString(), gross: 0, tare: 0, net: 0 }]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id
    };

    if (editing) {
      updateItem('bprs', editing.id, finalDoc);
    } else {
      updateData('bprs', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('BPR');
    }
    onClose();
  };

  const totalReceivedNet = form.receivedBatches.reduce((s, r) => s + r.net, 0);
  const totalDispatchedNet = form.dispatchedBatches.reduce((s, r) => s + r.net, 0);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>BPR Number</label>
          <input type="text" className="input-field" readOnly value={form.bprNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>BPR Date *</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Product Name</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
        </div>
        <div>
          <label>PSD Requirement *</label>
          <input type="text" className="input-field" required value={form.psdRequirement} onChange={e => setForm({...form, psdRequirement: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Weights Configuration Tables</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}>
          <input type="checkbox" checked={form.doubleDispatch} onChange={toggleDoubleDispatch} />
          Double Dispatch Drums Count (e.g. split micronised batches)
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Received weights */}
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Received Raw Material Weight</h4>
            <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow('receivedBatches')}>+ Add Row</button>
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.35rem' }}>Batch No</th>
                  <th style={{ padding: '0.35rem' }}>Drum No</th>
                  <th style={{ padding: '0.35rem' }}>Gross</th>
                  <th style={{ padding: '0.35rem' }}>Tare</th>
                  <th style={{ padding: '0.35rem' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {form.receivedBatches.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                    <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange('receivedBatches', idx, 'gross', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange('receivedBatches', idx, 'tare', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
            <span>Total Received:</span>
            <span>{totalReceivedNet.toFixed(2)} Kg</span>
          </div>
        </div>

        {/* Dispatched weights */}
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Dispatched (Micronised) Material Weight</h4>
            <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addCustomRow('dispatchedBatches')}>+ Add Row</button>
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.35rem' }}>Batch No</th>
                  <th style={{ padding: '0.35rem' }}>Drum No</th>
                  <th style={{ padding: '0.35rem' }}>Gross</th>
                  <th style={{ padding: '0.35rem' }}>Tare</th>
                  <th style={{ padding: '0.35rem' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {form.dispatchedBatches.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                    <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.gross} onChange={e => handleCellChange('dispatchedBatches', idx, 'gross', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem' }}>
                      <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} value={r.tare} onChange={e => handleCellChange('dispatchedBatches', idx, 'tare', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.25rem', fontWeight: 600 }}>{r.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
            <span>Total Dispatched:</span>
            <span>{totalDispatchedNet.toFixed(2)} Kg</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save BPR Weights</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 3. PSD UPLOADER & RESULTS FORM (Slide 9 Set A)
// ----------------------------------------------------
const PSDGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = data.parties.find(p => p.id === mr.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === mr.productName);

  const [form, setForm] = useState({
    psdNo: '',
    date: new Date().toISOString().split('T')[0],
    requirement: prodConfig?.psdReq || '90% < 10',
    result: '90% < 7.77',
    fileName: '',
    fileSize: ''
  });

  useEffect(() => {
    if (editing) {
      setForm(editing);
    } else {
      const psdSerial = data.settings?.serials?.PSD || 1;
      const docNo = generateDocNumber('PSD', psdSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        psdNo: docNo
      }));
    }
  }, [form.date, editing, data.settings?.serials?.PSD]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({
        ...prev,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: mr.productName,
      uploadedAt: new Date().toLocaleString()
    };

    if (editing) {
      updateItem('psds', editing.id, finalDoc);
    } else {
      updateData('psds', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PSD');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>PSD Document No</label>
          <input type="text" className="input-field" readOnly value={form.psdNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>PSD Date</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Customer Party</label>
          <input type="text" className="input-field" readOnly value={mr.partyName} />
        </div>
        <div>
          <label>Product Name</label>
          <input type="text" className="input-field" readOnly value={mr.productName} />
        </div>
        <div>
          <label>PSD Requirement (ex. 90% &lt; 10) *</label>
          <input type="text" className="input-field" required value={form.requirement} onChange={e => setForm({...form, requirement: e.target.value})} />
        </div>
        <div>
          <label>PSD Result (ex. 90% &lt; 7.77) *</label>
          <input type="text" className="input-field" required value={form.result} onChange={e => setForm({...form, result: e.target.value})} />
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', border: '2px dashed var(--border-color)', padding: '2rem', borderRadius: '8px', textAlign: 'center', marginBottom: '1.5rem' }}>
        <UploadCloud size={36} style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem' }} />
        <p style={{ margin: 0, fontSize: '0.85rem' }}>Drag & drop your PSD PDF report here, or click to browse.</p>
        <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ marginTop: '1rem', fontSize: '0.8rem' }} />
        {form.fileName && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{form.fileName}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({form.fileSize})</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Upload PSD Report</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 4. PACKING LIST GENERATOR FORM (Slide 10 Set A)
// ----------------------------------------------------
const PLGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const bpr = data.bprs.find(b => b.receiptId === mr.id);

  const [form, setForm] = useState({
    plNo: '',
    date: new Date().toISOString().split('T')[0],
    productName: mr.productName,
    totalWeight: 0,
    totalDrums: 0,
    batches: [] // Drum list copied from BPR dispatched weight, but Gross/Tare manual and Net calculated
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        batches: editing.batches || []
      });
    } else {
      const plSerial = data.settings?.serials?.PL || 1;
      const docNo = generateDocNumber('PL', plSerial, new Date(form.date));

      // Import BPR Dispatched batches! Gross & Tare start blank so user enters them manually as requested!
      const bprDrums = bpr?.dispatchedBatches || [];
      const plRows = bprDrums.map(d => ({
        batchNo: d.batchNo,
        drumNo: d.drumNo,
        gross: 0,
        tare: 0,
        net: 0
      }));

      setForm(prev => ({
        ...prev,
        plNo: docNo,
        batches: plRows
      }));
    }
  }, [form.date, editing, bpr, data.settings?.serials?.PL]);

  useEffect(() => {
    const totalDrums = form.batches.length;
    const totalWeight = form.batches.reduce((s, r) => s + r.net, 0);
    setForm(prev => ({ ...prev, totalDrums, totalWeight }));
  }, [form.batches]);

  const handleCellChange = (idx, field, val) => {
    setForm(prev => {
      const list = [...prev.batches];
      const item = { ...list[idx] };
      item[field] = parseFloat(val) || 0;
      item.net = Math.max(0, item.gross - item.tare);
      list[idx] = item;
      return { ...prev, batches: list };
    });
  };

  const addCustomRow = () => {
    setForm(prev => ({
      ...prev,
      batches: [...prev.batches, { batchNo: bpr?.receivedBatches[0]?.batchNo || 'Custom', drumNo: (prev.batches.length + 1).toString(), gross: 0, tare: 0, net: 0 }]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id
    };

    if (editing) {
      updateItem('packingLists', editing.id, finalDoc);
    } else {
      updateData('packingLists', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('PL');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Packing List No</label>
          <input type="text" className="input-field" readOnly value={form.plNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>Packing List Date</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Product Name</label>
          <input type="text" className="input-field" readOnly value={form.productName} />
        </div>
        <div>
          <label>Total Quantity (Calculated)</label>
          <input type="text" className="input-field" readOnly value={`${form.totalWeight.toFixed(2)} Kg`} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>Total Number of Drums</label>
          <input type="text" className="input-field" readOnly value={`${form.totalDrums} Drums`} style={{ fontWeight: 600 }} />
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Batch-Wise Packing Weight Details</h3>
          <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={addCustomRow}>+ Add Column/Row</button>
        </div>
        
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.35rem' }}>Sr No</th>
                <th style={{ padding: '0.35rem' }}>Batch No</th>
                <th style={{ padding: '0.35rem' }}>Drum No</th>
                <th style={{ padding: '0.35rem' }}>Gross Wt (Manual)</th>
                <th style={{ padding: '0.35rem' }}>Tare Wt (Manual)</th>
                <th style={{ padding: '0.35rem' }}>Net Wt (Auto)</th>
              </tr>
            </thead>
            <tbody>
              {form.batches.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.25rem', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '0.25rem' }}>{r.batchNo}</td>
                  <td style={{ padding: '0.25rem' }}>{r.drumNo}</td>
                  <td style={{ padding: '0.25rem' }}>
                    <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.gross} onChange={e => handleCellChange(idx, 'gross', e.target.value)} />
                  </td>
                  <td style={{ padding: '0.25rem' }}>
                    <input type="number" step="0.01" className="input-field" style={{ padding: '0.25rem', fontSize: '0.8rem' }} required value={r.tare} onChange={e => handleCellChange(idx, 'tare', e.target.value)} />
                  </td>
                  <td style={{ padding: '0.25rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{r.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Packing List</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 5. DELIVERY CHALLAN GENERATOR FORM (Slide 11)
// ----------------------------------------------------
const DCGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const pl = getPL(mr.id);
  const pi = getPI(mr.id);

  const [form, setForm] = useState({
    dcNo: '',
    date: new Date().toISOString().split('T')[0],
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
    partyName: mr.partyName || '',
    billAddress: mr.billAddress || '',
    shipAddress: mr.shipAddress || '',
    gstinBill: mr.gstinBill || '',
    gstinShip: mr.gstinShip || '',
    productName: mr.productName || '',
    qty: pl?.totalWeight || mr.totalQty || mr.receivedQty || 0,
    totalDrums: pl?.totalDrums || mr.totalDrums || 1,
    value: pi?.total || mr.value || 0,
    vehicleNo: mr.vehicleNo || '',
    driverName: '',
    termsAndConditions: 'Material sent for Micronisation on Job Work basis. Goods to be returned after processing.'
  });

  useEffect(() => {
    if (editing) {
      setForm(editing);
    } else {
      const dcSerial = data.settings?.serials?.DC || 1;
      const docNo = generateDocNumber('DC', dcSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        dcNo: docNo
      }));
    }
  }, [form.date, editing, data.settings?.serials?.DC]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDoc = {
      ...form,
      receiptId: mr.id
    };

    if (editing) {
      updateItem('deliveryChallans', editing.id, finalDoc);
    } else {
      updateData('deliveryChallans', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('DC');
    }
    onClose();
  };

  return (
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
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Delivery Challan</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 6. E-WAY BILL FROM DC GENERATOR FORM (Slide 12)
// ----------------------------------------------------
const EWayDCGenerator = ({ mr, editing, onClose }) => {
  const { data, updateItem } = useAppContext();
  const dc = getDC(mr.id);

  const [form, setForm] = useState({
    ewayBillNo: dc?.ewayBillNo || '',
    ewayBillDate: dc?.ewayBillDate || new Date().toISOString().split('T')[0],
    ewayBillPurpose: 'Others - Job Work'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dc) {
      alert("No Delivery Challan exists for this receipt!");
      return;
    }
    updateItem('deliveryChallans', dc.id, {
      ...dc,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate,
      ewayBillPurpose: form.ewayBillPurpose
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Delivery Challan Associated</label>
          <input type="text" className="input-field" readOnly value={dc?.dcNo || 'None'} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>E-Way Bill Purpose *</label>
          <select className="input-field" value={form.ewayBillPurpose} onChange={e => setForm({...form, ewayBillPurpose: e.target.value})}>
            <option value="Others - Job Work">Others - Job Work</option>
            <option value="Supply">Supply</option>
            <option value="Export">Export</option>
          </select>
        </div>
        <div>
          <label>E-Way Bill Number *</label>
          <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
        </div>
        <div>
          <label>E-Way Bill Date *</label>
          <input type="date" className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save E-Way Bill details</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 7. TAX INVOICE GENERATOR FORM (Slide 13)
// ----------------------------------------------------
const TaxInvoiceGenerator = ({ mr, editing, onClose }) => {
  const { data, updateData, updateItem, incrementSerial } = useAppContext();
  const party = (data.parties || []).find(p => p.id === mr.partyId);
  const prodConfig = (party?.products || []).find(p => p.name === mr.productName);
  const dc = getDC(mr.id);
  const pl = getPL(mr.id);

  const [form, setForm] = useState({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    dcNo: dc?.dcNo || 'N/A',
    dcDate: dc?.date || 'N/A',
    partyDocNo: mr.partyDocNo || '',
    partyDocDate: mr.partyDocDate || '',
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
    terms: 'Payment against delivery.'
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        charges: editing.charges || {},
        rates: editing.rates || {}
      });
    } else {
      const tiSerial = data.settings?.serials?.TI || 1;
      // prefix is UMA/IN/ as required!
      const docNo = generateDocNumber('IN', tiSerial, new Date(form.date));
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
  }, [form.date, editing, prodConfig, data.settings?.serials?.TI]);

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
        const qty = parseFloat(pl?.totalWeight || mr.totalQty || mr.receivedQty || 0);
        const rate = form.rates[key] || 0;
        return sum + (isQtyRate ? qty * rate : rate);
      }
      return sum;
    }, 0);
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
      receiptId: mr.id,
      partyName: mr.partyName,
      productName: mr.productName,
      qty: pl?.totalWeight || mr.totalQty || mr.receivedQty || 0,
      subtotal,
      taxAmount,
      total,
      type: 'Tax Invoice',
      ewayBillNo: editing?.ewayBillNo || '',
      ewayBillDate: editing?.ewayBillDate || ''
    };

    if (editing) {
      updateItem('invoices', editing.id, finalDoc);
    } else {
      updateData('invoices', { ...finalDoc, id: Date.now().toString() });
      incrementSerial('TI');
    }
    onClose();
  };

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
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Invoice Number</label>
          <input type="text" className="input-field" readOnly value={form.invoiceNo} style={{ color: 'var(--accent-primary)', fontWeight: 600 }} />
        </div>
        <div>
          <label>Invoice Date *</label>
          <input type="date" className="input-field" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
        <div>
          <label>Delivery Challan No</label>
          <input type="text" className="input-field" readOnly value={form.dcNo} />
        </div>
        <div>
          <label>Delivery Challan Date</label>
          <input type="text" className="input-field" readOnly value={form.dcDate} />
        </div>
        <div>
          <label>Supplier Doc No</label>
          <input type="text" className="input-field" readOnly value={form.partyDocNo} />
        </div>
        <div>
          <label>Supplier Doc Date</label>
          <input type="text" className="input-field" readOnly value={form.partyDocDate} />
        </div>
        <div>
          <label>GSTIN</label>
          <input type="text" className="input-field" readOnly value={mr.gstinBill} />
        </div>
        <div>
          <label>Material Micronised Qty</label>
          <input type="text" className="input-field" readOnly value={`${pl?.totalWeight || mr.totalQty} Kg`} />
        </div>
      </div>

      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', pb: '0.5rem' }}>Tax Invoice Charges Grid</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>
            <span>Grand Total:</span>
            <span>₹{(Math.max(0, getSubtotal() - form.discount) * (1 + form.taxRate / 100)).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save Tax Invoice</button>
      </div>
    </form>
  );
};

// ----------------------------------------------------
// 8. E-WAY BILL FROM TAX INVOICE GENERATOR FORM (Slide 14)
// ----------------------------------------------------
const EWayTIGenerator = ({ mr, editing, onClose }) => {
  const { data, updateItem } = useAppContext();
  const ti = getTI(mr.id);

  const [form, setForm] = useState({
    ewayBillNo: ti?.ewayBillNo || '',
    ewayBillDate: ti?.ewayBillDate || new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ti) {
      alert("No Tax Invoice exists for this receipt!");
      return;
    }
    updateItem('invoices', ti.id, {
      ...ti,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label>Tax Invoice Associated</label>
          <input type="text" className="input-field" readOnly value={ti?.invoiceNo || 'None'} style={{ fontWeight: 600 }} />
        </div>
        <div>
          <label>Material Qty</label>
          <input type="text" className="input-field" readOnly value={`${ti?.qty || mr.totalQty} Kg`} />
        </div>
        <div>
          <label>E-Way Bill Number *</label>
          <input type="text" className="input-field" required placeholder="12 digit number" value={form.ewayBillNo} onChange={e => setForm({...form, ewayBillNo: e.target.value})} />
        </div>
        <div>
          <label>E-Way Bill Date *</label>
          <input type="date" className="input-field" required value={form.ewayBillDate} onChange={e => setForm({...form, ewayBillDate: e.target.value})} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save E-Way Bill details</button>
      </div>
    </form>
  );
};

export default UnderProcess;
