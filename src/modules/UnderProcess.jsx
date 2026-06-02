import { formatDate } from '../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { generateDocNumber } from '../utils/numbering';
import { 
  FileText, Activity, UploadCloud, Package, Truck, 
  FileSpreadsheet, FileCheck, CheckCircle, Clock, X, Plus, Edit2, Download, Trash2 
} from 'lucide-react';
import { exportToPDF, viewPDF } from '../utils/pdfExport';

const UnderProcess = () => {
  const { data, updateData, updateItem, setData, incrementSerial, deleteItemSoftly } = useAppContext();
  const [activeModal, setActiveModal] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
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
        deleteItemSoftly('invoices', doc.id);
      } else if (cellType === 'BPR') {
        deleteItemSoftly('bprs', doc.id);
      } else if (cellType === 'PSD') {
        deleteItemSoftly('psds', doc.id);
      } else if (cellType === 'PL') {
        deleteItemSoftly('packingLists', doc.id);
      } else if (cellType === 'DC') {
        deleteItemSoftly('deliveryChallans', doc.id);
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

  const handleViewPDF = () => {
    const { cellType, doc } = showDocPopover;
    viewPDF(cellType, doc);
    setShowDocPopover(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Under Process Tracker</h1>
        <p style={{ color: 'var(--text-muted)' }}>Interactive workflow command center. Monitor real-time progress and generate downstream documents.</p>
      </header>

      <div className="hide-scrollbar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[
          { id: 'All', label: 'All' },
          { id: 'PI', label: 'PI Pending' },
          { id: 'BPR', label: 'BPR Pending' },
          { id: 'PSD', label: 'PSD Pending' },
          { id: 'PL', label: 'PL Pending' },
          { id: 'DC', label: 'DC Pending' },
          { id: 'EWDC', label: 'E-Way DC Pending' },
          { id: 'TI', label: 'Tax Invoice Pending' },
          { id: 'EWTI', label: 'E-Way TI Pending' },
          { id: 'Done', label: 'Done' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              fontSize: '1rem', 
              fontWeight: 600, 
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              (data.materialReceipts || []).filter(mr => {
                  const pi = getPI(mr.id);
                  const bpr = getBPR(mr.id);
                  const psd = getPSD(mr.id);
                  const pl = getPL(mr.id);
                  const dc = getDC(mr.id);
                  const ti = getTI(mr.id);
                  const isComplete = pi && bpr && psd && pl && dc && ti;
                  if (activeTab === 'Done') return isComplete;
                  if (activeTab === 'PI') return !pi;
                  if (activeTab === 'BPR') return !bpr;
                  if (activeTab === 'PSD') return !psd;
                  if (activeTab === 'PL') return !pl;
                  if (activeTab === 'DC') return !dc;
                  if (activeTab === 'EWDC') return !(dc && dc.ewayBillNo);
                  if (activeTab === 'TI') return !ti;
                  if (activeTab === 'EWTI') return !(ti && ti.ewayBillNo);
                  return true;
                }).map(mr => {
                const pi = getPI(mr.id);
                const bpr = getBPR(mr.id);
                const psd = getPSD(mr.id);
                const pl = getPL(mr.id);
                const dc = getDC(mr.id);
                const ti = getTI(mr.id);

                return (
                  <tr key={mr.id} style={{ borderBottom: '1px solid var(--border-color)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{formatDate(mr.date)}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.partyName}</td>
                    <td style={{ padding: '1rem' }}>{mr.productName} {mr.nickName ? `(${mr.nickName})` : ''}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{mr.totalQty || mr.receivedQty || 0}</td>

                    {/* 1. Performa Invoice (PI) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {pi ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('PI', pi)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PI', pi, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {pi.invoiceNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PI')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 2. BPR */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {bpr ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('BPR', bpr)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'BPR', bpr, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {bpr.bprNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'BPR')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 3. PSD Uploader */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {psd ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('PSD', psd)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PSD', psd, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {psd.psdNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PSD')} style={yellowStyle}>Pending</button>
                      )}
                    </td>

                    {/* 4. Packing List (PL) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {pl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('PL', pl)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'PL', pl, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {pl.plNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handlePendingClick(mr, 'PL')} style={yellowStyle} disabled={!bpr}>Pending</button>
                      )}
                    </td>

                    {/* 5. Delivery Challan (DC) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {dc ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('DC', dc)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'DC', dc, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {dc.dcNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                          <button onClick={() => viewPDF('TI', ti)} style={{ ...blueStyle, padding: '0.25rem', width: 'auto', background: 'transparent', border: 'none' }} title="View / Print">
                            <FileText size={14} />
                          </button>
                          <button onClick={(e) => handleBlueClick(mr.id, 'TI', ti, e)} style={{ ...blueStyle, flex: 1, padding: '0.25rem' }}>
                            {ti.invoiceNo.split('/').slice(-1)[0]}
                          </button>
                        </div>
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
            <button style={popBtn} onClick={handleViewPDF}><FileText size={14} /> View / Print</button>
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
          psdReport: (prodConfig?.psdMethodDefault === 'Wet' ? (defaultRates.psdReportWet || 0) : (defaultRates.psdReportDry || 0)) || defaultRates.psdReport || 0,
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

  const [activeFormTab, setActiveFormTab] = useState('Basic Info');
  const formTabs = ['Basic Info', 'Pressures & Checklist', 'Batches & Weights', 'Quality & Dispatch'];

  const [form, setForm] = useState({
    bprNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: mr.partyName,
    productName: mr.productName,
    totalInputQty: mr.totalQty || mr.receivedQty || 0,
    batchNo: '',
    totalNoBatch: 0,
    psdRequirement: prodConfig?.psdReq || '90% < 10M',
    totalDrums: mr.totalDrums || 1,
    doubleDispatch: false,
    receivedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    dispatchedBatches: [], // Array of { batchNo, drumNo, gross, tare, net }
    committedBy: '',
    processingStartDate: new Date().toISOString().split('T')[0],
    processingStartTime: '09:00',
    processingSupervisor: '',
    sizingReportRequired: 'Yes',
    particleSizeResult: '',
    isMicronizerCleaned: false,
    isAreaCleaned: false,
    isFilterBagPackedLabeled: false,
    isBagCleanBlackSpotFree: false,
    pressures: [
      { sp: '', dp: '', tp: '', fp: '', fip: '' },
      { sp: '', dp: '', tp: '', fp: '', fip: '' },
      { sp: '', dp: '', tp: '', fp: '', fip: '' }
    ],
    packingMaterials: { whiteLdBags: '', blackLdBags: '', brownTapes: '', drumUsed: '', otherDetails: '' },
    dispatchQty: { micronizedNet: '', lumpsNet: '', floorDustNet: '', netProcessLoss: '', remark: '' },
    processCompletionDate: new Date().toISOString().split('T')[0],
    processCompletionTime: '17:00',
    isFilterBagPackedStoredAfter: false,
    remarks: '',
    operatorSignature: '',
    plantSupervisorSignature: ''
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
        customerName: mr.partyName,
        receivedBatches: receivedRows,
        dispatchedBatches: receivedRows.map(r => ({ ...r })),
        batchNo: activeMRBatches[0]?.batchNo || '',
        totalNoBatch: activeMRBatches.length
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
      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {formTabs.map(tab => (
          <button 
            key={tab}
            type="button"
            onClick={() => setActiveFormTab(tab)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              color: activeFormTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: activeFormTab === tab ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeFormTab === 'Basic Info' && (
        <>
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
              <label>Customer Name</label>
              <input type="text" className="input-field" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label>Product Name</label>
              <input type="text" className="input-field" readOnly value={form.productName} />
            </div>
            <div>
              <label>Total Quantity (kg)</label>
              <input type="text" className="input-field" readOnly value={String(form.totalInputQty)} />
            </div>
            <div>
              <label>Batch No.</label>
              <input type="text" className="input-field" value={form.batchNo} onChange={e => setForm({ ...form, batchNo: e.target.value })} />
            </div>
            <div>
              <label>Total No. Batch</label>
              <input type="number" className="input-field" value={form.totalNoBatch} onChange={e => setForm({ ...form, totalNoBatch: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label>Total Drum</label>
              <input type="number" className="input-field" value={form.totalDrums} onChange={e => setForm({ ...form, totalDrums: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label>PSD Requirement *</label>
              <input type="text" className="input-field" required value={form.psdRequirement} onChange={e => setForm({...form, psdRequirement: e.target.value})} />
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Process Header</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label>Committed</label>
                <input type="text" className="input-field" value={form.committedBy} onChange={e => setForm({ ...form, committedBy: e.target.value })} />
              </div>
              <div>
                <label>Processing Start (Date)</label>
                <input type="date" className="input-field" value={form.processingStartDate} onChange={e => setForm({ ...form, processingStartDate: e.target.value })} />
              </div>
              <div>
                <label>Processing Start (Time)</label>
                <input type="time" className="input-field" value={form.processingStartTime} onChange={e => setForm({ ...form, processingStartTime: e.target.value })} />
              </div>
              <div>
                <label>Processing Supervisor</label>
                <input type="text" className="input-field" value={form.processingSupervisor} onChange={e => setForm({ ...form, processingSupervisor: e.target.value })} />
              </div>
              <div>
                <label>Sizing report require</label>
                <select className="input-field" value={form.sizingReportRequired} onChange={e => setForm({ ...form, sizingReportRequired: e.target.value })}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label>Particle size result</label>
                <input type="text" className="input-field" value={form.particleSizeResult} onChange={e => setForm({ ...form, particleSizeResult: e.target.value })} />
              </div>
            </div>
          </div>
        </>
      )}

      {activeFormTab === 'Pressures & Checklist' && (
        <>
          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Cleaning Checklist</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { key: 'isMicronizerCleaned', label: 'Is the Micronizar cleaned?' },
                { key: 'isAreaCleaned', label: 'Is the processing Area Cleaned?' },
                { key: 'isFilterBagPackedLabeled', label: 'Is the filter Bag before process packed and labeled in LDPE Bag ?' },
                { key: 'isBagCleanBlackSpotFree', label: 'Is the bag is clean and black spot free?' }
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form[item.key])}
                    onChange={e => setForm({ ...form, [item.key]: e.target.checked })}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Pressure Log</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '0.4rem' }}>S.P.</th>
                    <th style={{ padding: '0.4rem' }}>D.P.</th>
                    <th style={{ padding: '0.4rem' }}>T.P.</th>
                    <th style={{ padding: '0.4rem' }}>F.P.</th>
                    <th style={{ padding: '0.4rem' }}>Fi.P.</th>
                  </tr>
                </thead>
                <tbody>
                  {(form.pressures || []).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {['sp', 'dp', 'tp', 'fp', 'fip'].map(k => (
                        <td key={k} style={{ padding: '0.3rem' }}>
                          <input
                            className="input-field"
                            style={{ padding: '0.25rem', fontSize: '0.8rem' }}
                            value={row[k]}
                            onChange={e => {
                              const next = [...(form.pressures || [])];
                              next[idx] = { ...next[idx], [k]: e.target.value };
                              setForm({ ...form, pressures: next });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeFormTab === 'Batches & Weights' && (
        <>
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
        </>
      )}

      {activeFormTab === 'Quality & Dispatch' && (
        <>
          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Packing Materials Used</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label>White LD Bags</label>
                <input className="input-field" value={form.packingMaterials?.whiteLdBags || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, whiteLdBags: e.target.value } })} />
              </div>
              <div>
                <label>Black LD Bags</label>
                <input className="input-field" value={form.packingMaterials?.blackLdBags || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, blackLdBags: e.target.value } })} />
              </div>
              <div>
                <label>Brow Tapes</label>
                <input className="input-field" value={form.packingMaterials?.brownTapes || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, brownTapes: e.target.value } })} />
              </div>
              <div>
                <label>Drum Used</label>
                <input className="input-field" value={form.packingMaterials?.drumUsed || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, drumUsed: e.target.value } })} />
              </div>
              <div>
                <label>Other Details</label>
                <input className="input-field" value={form.packingMaterials?.otherDetails || ''} onChange={e => setForm({ ...form, packingMaterials: { ...form.packingMaterials, otherDetails: e.target.value } })} />
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Dispatch Material Quantity Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label>Micronized Material net weight</label>
                <input className="input-field" value={form.dispatchQty?.micronizedNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, micronizedNet: e.target.value } })} />
              </div>
              <div>
                <label>Lumps Net weight</label>
                <input className="input-field" value={form.dispatchQty?.lumpsNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, lumpsNet: e.target.value } })} />
              </div>
              <div>
                <label>Floor Dust Net weight</label>
                <input className="input-field" value={form.dispatchQty?.floorDustNet || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, floorDustNet: e.target.value } })} />
              </div>
              <div>
                <label>Net Process Loss</label>
                <input className="input-field" value={form.dispatchQty?.netProcessLoss || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, netProcessLoss: e.target.value } })} />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <label>Remark</label>
                <input className="input-field" value={form.dispatchQty?.remark || ''} onChange={e => setForm({ ...form, dispatchQty: { ...form.dispatchQty, remark: e.target.value } })} />
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0 }}>Process Completion</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label>Process Completion Date</label>
                <input type="date" className="input-field" value={form.processCompletionDate} onChange={e => setForm({ ...form, processCompletionDate: e.target.value })} />
              </div>
              <div>
                <label>Process Completion Time</label>
                <input type="time" className="input-field" value={form.processCompletionTime} onChange={e => setForm({ ...form, processCompletionTime: e.target.value })} />
              </div>
              <div>
                <label>Remarks</label>
                <input type="text" className="input-field" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={form.isFilterBagPackedStoredAfter} onChange={e => setForm({ ...form, isFilterBagPackedStoredAfter: e.target.checked })} />
              Is the filter bag after process packed and labeled and stored safely?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label>Operator Signature Name</label>
                <input type="text" className="input-field" value={form.operatorSignature} onChange={e => setForm({ ...form, operatorSignature: e.target.value })} />
              </div>
              <div>
                <label>Plant Supervisor Signature Name</label>
                <input type="text" className="input-field" value={form.plantSupervisorSignature} onChange={e => setForm({ ...form, plantSupervisorSignature: e.target.value })} />
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <div>
          {activeFormTab !== 'Basic Info' && (
            <button type="button" className="btn btn-secondary" onClick={() => setActiveFormTab(formTabs[formTabs.indexOf(activeFormTab) - 1])}>
              Previous
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
          {activeFormTab !== 'Quality & Dispatch' ? (
            <button type="button" className="btn btn-primary" onClick={() => setActiveFormTab(formTabs[formTabs.indexOf(activeFormTab) + 1])}>
              Next Step
            </button>
          ) : (
            <button type="submit" className="btn btn-primary">Save BPR Document</button>
          )}
        </div>
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
    reports: [
      { batchNo: '', method: (prodConfig?.psdMethodDefault || 'Dry'), requirement: prodConfig?.psdReq || '90% < 10M', result: '', fileName: '', fileSize: '' }
    ],
    notes: ''
  });

  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        reports: editing.reports || [
          { batchNo: '', method: (prodConfig?.psdMethodDefault || 'Dry'), requirement: prodConfig?.psdReq || '90% < 10M', result: '', fileName: '', fileSize: '' }
        ],
        notes: editing.notes || ''
      });
    } else {
      const psdSerial = data.settings?.serials?.PSD || 1;
      const docNo = generateDocNumber('PSD', psdSerial, new Date(form.date));
      setForm(prev => ({
        ...prev,
        psdNo: docNo,
        reports: (prev.reports || []).map(r => ({
          ...r,
          requirement: r.requirement || prodConfig?.psdReq || '90% < 10M',
          method: r.method || (prodConfig?.psdMethodDefault || 'Dry')
        }))
      }));
    }
  }, [form.date, editing, data.settings?.serials?.PSD]);

  const handleFileUpload = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({
        ...prev,
        reports: (prev.reports || []).map((r, idx) => idx === index ? ({
          ...r,
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`
        }) : r)
      }));
    }
  };

  const addReport = () => {
    setForm(prev => {
      const next = [...(prev.reports || [])];
      next.push({ batchNo: '', method: (prodConfig?.psdMethodDefault || 'Dry'), requirement: prodConfig?.psdReq || '90% < 10M', result: '', fileName: '', fileSize: '' });
      return { ...prev, reports: next };
    });
  };

  const removeReport = (idx) => {
    setForm(prev => ({ ...prev, reports: (prev.reports || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Enforce max 3 reports per batch
    const counts = (form.reports || []).reduce((acc, r) => {
      const k = r.batchNo || '';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const tooMany = Object.entries(counts).find(([batch, c]) => batch && c > 3);
    if (tooMany) {
      alert(`Max 3 PSD reports allowed for batch "${tooMany[0]}".`);
      return;
    }

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
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        {(form.reports || []).map((rep, idx) => (
          <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0 }}>Report {idx + 1}</h4>
              {(form.reports || []).length > 1 && (
                <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none' }} onClick={() => removeReport(idx)}>
                  Remove
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label>Batch No *</label>
                <select className="input-field" required value={rep.batchNo} onChange={e => {
                  const next = [...(form.reports || [])];
                  next[idx] = { ...next[idx], batchNo: e.target.value };
                  setForm({ ...form, reports: next });
                }}>
                  <option value="">-- Select Batch --</option>
                  {(mr.batches || []).filter(b => !b.isEmptyDrums).map((b, bIdx) => (
                    <option key={bIdx} value={b.batchNo}>{b.batchNo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Method</label>
                <select className="input-field" value={rep.method} onChange={e => {
                  const next = [...(form.reports || [])];
                  next[idx] = { ...next[idx], method: e.target.value };
                  setForm({ ...form, reports: next });
                }}>
                  <option value="Dry">Dry</option>
                  <option value="Wet">Wet</option>
                </select>
              </div>
              <div>
                <label>PSD Requirement *</label>
                <input className="input-field" required value={rep.requirement} onChange={e => {
                  const next = [...(form.reports || [])];
                  next[idx] = { ...next[idx], requirement: e.target.value };
                  setForm({ ...form, reports: next });
                }} />
              </div>
              <div>
                <label>PSD Result *</label>
                <input className="input-field" required value={rep.result} onChange={e => {
                  const next = [...(form.reports || [])];
                  next[idx] = { ...next[idx], result: e.target.value };
                  setForm({ ...form, reports: next });
                }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Upload PDF</label>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '2px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <UploadCloud size={28} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
                  <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, idx)} style={{ fontSize: '0.8rem' }} />
                  {rep.fileName && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {rep.fileName} ({rep.fileSize})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-secondary" onClick={addReport}>
          + Add Another Report
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label>Note</label>
        <textarea className="input-field" rows="3" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--border-color)' }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save PSD Report(s)</button>
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
          psdReport: (prodConfig?.psdMethodDefault === 'Wet' ? (defaultRates.psdReportWet || 0) : (defaultRates.psdReportDry || 0)) || defaultRates.psdReport || 0,
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
