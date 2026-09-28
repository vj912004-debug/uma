import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Calendar, Paperclip, Pencil, Save, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate, getDefaultFiscalYearRange, newestFirst } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';

const DEFAULT_RANGE = getDefaultFiscalYearRange();
const CATEGORIES = ['Compressor', 'Solar', 'General', 'Electrical', 'Spares', 'Consumables', 'Utilities', 'Services', 'Capital'];
const UNITS = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Set', 'MT', 'Mtr'];
const CONTACT_VIA = ['Call', 'WhatsApp', 'Email', 'Visit'];
const SUPPLIER_STATUS = ['Approved', 'Pending'];
const DOC_TYPES = ['Quotation', 'Invoice', 'Technical Datasheet', 'Other'];
const ISSUE_PURPOSES = ['Maintenance', 'Production', 'Consumption', 'Other'];

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const alive = (rows) => (rows || []).filter((r) => !r.isDeleted);
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
const landedCost = (q) => {
  const rate = num(q?.rate);
  if (!rate) return null;
  const qty = num(q?.qty);
  const freight = num(q?.freight);
  return qty > 0 ? rate + freight / qty : rate;
};
const today = () => new Date().toISOString().split('T')[0];
const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};
const fiscalLabel = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};
const nextInquiryNo = (rows, serial) => {
  const n = String(serial || rows.length + 1).padStart(5, '0');
  return `PUR/INQ/${fiscalLabel()}/${n}`;
};

const emptySupplier = () => ({
  supplierName: '', contactPerson: '', mobile: '', email: '', address: '', gstin: '', itemsSupplied: '', status: 'Approved'
});
const emptyItem = () => ({
  itemName: '', category: 'General', specification: '', unit: 'Nos', currentStock: '', minimumStock: '', preferredSupplier: ''
});
const emptyQuote = () => ({
  supplierName: '', quoteNo: '', quoteDate: today(), rate: '', gst: '18', qty: '', freight: '', deliveryTime: '', paymentTerms: '', warranty: '', remarks: ''
});
const emptyFollow = () => ({
  followDate: today(), contactedPerson: '', remark: '', nextFollowDate: '', status: 'Pending'
});
const emptyReceipt = () => ({
  supplierName: '', invoiceNo: '', date: today(), itemName: '', qty: '', rate: '', remarks: ''
});
const emptyIssue = () => ({
  itemName: '', qty: '', date: today(), purpose: 'Maintenance', remarks: ''
});
const emptyAttachment = () => ({ fileName: '', docType: 'Quotation', remarks: '', sizeLabel: '' });
const emptyPo = () => ({ poCreated: 'No', poNo: '', poDate: '', poRemarks: '' });

const Panel = ({ id, title, extra, children, className = '' }) => (
  <section id={id} className={`pm-panel ${className}`}>
    <header className="pm-panel-head">
      <span>{title}</span>
      {extra ? <span className="pm-panel-extra">{extra}</span> : null}
    </header>
    <div className="pm-panel-body">{children}</div>
  </section>
);

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const RowActions = ({ onEdit, onDelete }) => (
  <div className="pm-row-actions">
    {onEdit ? <button type="button" title="Edit" onClick={onEdit}><Pencil size={13} /></button> : null}
    {onDelete ? <button type="button" title="Delete" className="danger" onClick={onDelete}><Trash2 size={13} /></button> : null}
  </div>
);

const PurchaseManagement = () => {
  const { data, setData, incrementSerial } = useAppContext();
  const fileRef = useRef(null);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);
  const [globalSearch, setGlobalSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [statusChip, setStatusChip] = useState('all');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showFollowForm, setShowFollowForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItemId, setEditingItemId] = useState(null);
  const [inquiryForm, setInquiryForm] = useState(() => emptyInquiryForm(1, []));
  const [editingInquiryId, setEditingInquiryId] = useState(null);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [followForm, setFollowForm] = useState(emptyFollow);
  const [editingFollowId, setEditingFollowId] = useState(null);
  const [receiptForm, setReceiptForm] = useState(emptyReceipt);
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [attachmentForm, setAttachmentForm] = useState(emptyAttachment);
  const [poForm, setPoForm] = useState(emptyPo);

  const userRole = data.settings?.userRole || 'Admin';
  const serial = data.settings?.serials?.INQ || 1;
  const q = globalSearch.trim().toLowerCase();
  const hit = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);

  const suppliers = useMemo(() => alive(data.purchaseSuppliers).sort((a, b) => String(a.supplierName).localeCompare(String(b.supplierName))), [data.purchaseSuppliers]);
  const items = useMemo(() => alive(data.purchaseStock).sort((a, b) => String(a.itemName).localeCompare(String(b.itemName))), [data.purchaseStock]);
  const inquiries = useMemo(
    () => newestFirst(alive(data.purchaseManagement)),
    [data.purchaseManagement]
  );
  const quotes = useMemo(() => newestFirst(alive(data.purchaseQuotes)), [data.purchaseQuotes]);
  const followUps = useMemo(() => newestFirst(alive(data.purchaseFollowUps)), [data.purchaseFollowUps]);
  const receipts = useMemo(() => newestFirst(alive(data.purchaseReceipts)), [data.purchaseReceipts]);
  const attachments = useMemo(() => newestFirst(alive(data.purchaseAttachments)), [data.purchaseAttachments]);

  const rangedInquiries = inquiries.filter((r) => inRange(r.date, rangeFrom, rangeTo) && hit(r.inquiryNo, r.itemDescription, r.category, r.approvedSupplier, r.contactVia));
  const selectedInquiry = inquiries.find((r) => r.id === selectedInquiryId) || null;
  const inquiryQuotes = quotes.filter((r) => r.inquiryId === selectedInquiryId);
  const inquiryFollows = followUps.filter((r) => r.inquiryId === selectedInquiryId);
  const inquiryFiles = attachments.filter((r) => !selectedInquiryId || r.inquiryId === selectedInquiryId);

  useEffect(() => {
    const scroll = () => {
      const id = window.location.hash.replace('#', '');
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    scroll();
    window.addEventListener('hashchange', scroll);
    return () => window.removeEventListener('hashchange', scroll);
  }, []);

  useEffect(() => {
    const inq = inquiries.find((r) => r.id === selectedInquiryId);
    setPoForm(inq ? {
      poCreated: inq.poCreated || 'No',
      poNo: inq.poNo || '',
      poDate: inq.poDate || '',
      poRemarks: inq.poRemarks || ''
    } : emptyPo());
  }, [selectedInquiryId]);

  const commit = (recipe) => setData((prev) => recipe(prev) || prev);

  const removeRow = (module, id) => {
    if (userRole !== 'Admin') {
      alert('Only Admin can delete records.');
      return;
    }
    if (!window.confirm('Delete this record?')) return;
    commit((prev) => {
      const nextList = (prev[module] || []).map((r) => (r.id === id ? { ...r, isDeleted: true, deletedAt: new Date().toISOString() } : r));
      if (module !== 'purchaseQuotes') return { ...prev, [module]: nextList };
      const row = (prev.purchaseQuotes || []).find((r) => r.id === id);
      return {
        ...prev,
        purchaseQuotes: nextList,
        purchaseManagement: row ? syncInquiryQuotes(prev.purchaseManagement, nextList, row.inquiryId) : prev.purchaseManagement
      };
    });
  };

  const saveSupplier = (e) => {
    e.preventDefault();
    const payload = { ...supplierForm, supplierName: supplierForm.supplierName.trim() };
    if (!payload.supplierName) return;
    commit((prev) => {
      const list = prev.purchaseSuppliers || [];
      const next = editingSupplierId
        ? list.map((r) => (r.id === editingSupplierId ? { ...r, ...payload } : r))
        : [...list, { ...payload, id: uid(), createdAt: new Date().toISOString() }];
      return { ...prev, purchaseSuppliers: next };
    });
    setSupplierForm(emptySupplier());
    setEditingSupplierId(null);
  };

  const saveItem = (e) => {
    e.preventDefault();
    const payload = { ...itemForm, itemName: itemForm.itemName.trim() };
    if (!payload.itemName) return;
    commit((prev) => {
      const list = prev.purchaseStock || [];
      const next = editingItemId
        ? list.map((r) => (r.id === editingItemId ? { ...r, ...payload } : r))
        : [...list, { ...payload, id: uid(), createdAt: new Date().toISOString() }];
      return { ...prev, purchaseStock: next };
    });
    setSelectedItem(payload.itemName);
    setItemForm(emptyItem());
    setEditingItemId(null);
  };

  const saveInquiry = (e) => {
    e.preventDefault();
    const payload = {
      ...inquiryForm,
      itemDescription: inquiryForm.itemDescription.trim(),
      supplierCount: parseInt(inquiryForm.supplierCount, 10) || 0,
      quotesReceived: parseInt(inquiryForm.quotesReceived, 10) || 0
    };
    if (!payload.itemDescription) return;
    const creating = !editingInquiryId;
    const id = editingInquiryId || uid();
    commit((prev) => {
      const list = prev.purchaseManagement || [];
      const next = creating
        ? [...list, { ...payload, id, createdAt: new Date().toISOString(), poCreated: 'No' }]
        : list.map((r) => (r.id === id ? { ...r, ...payload } : r));
      return { ...prev, purchaseManagement: next };
    });
    if (creating) incrementSerial('INQ');
    setSelectedInquiryId(id);
    setSelectedItem(payload.itemDescription);
    setEditingInquiryId(null);
    setInquiryForm(emptyInquiryForm(creating ? serial + 1 : serial, inquiries));
  };

  const saveQuote = (e) => {
    e.preventDefault();
    if (!selectedInquiryId) {
      alert('Select an inquiry first.');
      return;
    }
    const payload = { ...quoteForm, supplierName: quoteForm.supplierName.trim(), inquiryId: selectedInquiryId };
    if (!payload.supplierName) return;
    commit((prev) => {
      const list = prev.purchaseQuotes || [];
      const nextQuotes = editingQuoteId
        ? list.map((r) => (r.id === editingQuoteId ? { ...r, ...payload } : r))
        : [...list, { ...payload, id: uid(), createdAt: new Date().toISOString(), approved: false }];
      return { ...prev, purchaseQuotes: nextQuotes, purchaseManagement: syncInquiryQuotes(prev.purchaseManagement, nextQuotes, selectedInquiryId) };
    });
    setQuoteForm(emptyQuote());
    setEditingQuoteId(null);
    setShowQuoteForm(false);
  };

  const approveRecommended = () => {
    if (!inquiryQuotes.length) return;
    const ranked = inquiryQuotes
      .map((q) => ({ q, cost: landedCost(q) }))
      .filter((r) => r.cost != null)
      .sort((a, b) => a.cost - b.cost);
    const winner = ranked[0]?.q || inquiryQuotes[0];
    commit((prev) => {
      const nextQuotes = (prev.purchaseQuotes || []).map((r) => (
        r.inquiryId === selectedInquiryId ? { ...r, approved: r.id === winner.id } : r
      ));
      const nextSuppliers = (prev.purchaseSuppliers || []).map((s) => (
        String(s.supplierName || '').trim().toLowerCase() === String(winner.supplierName || '').trim().toLowerCase()
          ? { ...s, status: 'Approved' }
          : s
      ));
      const nextInquiries = (prev.purchaseManagement || []).map((i) => (
        i.id === selectedInquiryId
          ? { ...i, approvedSupplier: winner.supplierName, status: 'Approved', lowestQuote: landedCost(winner) }
          : i
      ));
      return { ...prev, purchaseQuotes: nextQuotes, purchaseSuppliers: nextSuppliers, purchaseManagement: nextInquiries };
    });
  };

  const saveFollow = (e) => {
    e.preventDefault();
    if (!selectedInquiryId) {
      alert('Select an inquiry first.');
      return;
    }
    const payload = { ...followForm, inquiryId: selectedInquiryId };
    commit((prev) => {
      const list = prev.purchaseFollowUps || [];
      const next = editingFollowId
        ? list.map((r) => (r.id === editingFollowId ? { ...r, ...payload } : r))
        : [...list, { ...payload, id: uid(), createdAt: new Date().toISOString() }];
      const nextInquiries = (prev.purchaseManagement || []).map((i) => (
        i.id === selectedInquiryId && i.status === 'Quote Pending' ? { ...i, status: 'Follow Up' } : i
      ));
      return { ...prev, purchaseFollowUps: next, purchaseManagement: nextInquiries };
    });
    setFollowForm(emptyFollow());
    setEditingFollowId(null);
    setShowFollowForm(false);
  };

  const saveReceipt = (e) => {
    e.preventDefault();
    const itemName = (receiptForm.itemName || selectedItem).trim();
    const qty = num(receiptForm.qty);
    if (!itemName || qty <= 0) return;
    const total = qty * num(receiptForm.rate);
    commit((prev) => {
      const receipt = {
        ...receiptForm,
        itemName,
        qty,
        total,
        inquiryId: selectedInquiryId || '',
        id: uid(),
        createdAt: new Date().toISOString()
      };
      const stock = prev.purchaseStock || [];
      const found = stock.find((s) => !s.isDeleted && String(s.itemName || '').trim().toLowerCase() === itemName.toLowerCase());
      const nextStock = found
        ? stock.map((s) => (s.id === found.id ? {
          ...s,
          currentStock: String(num(s.currentStock) + qty),
          lastPurchaseDate: receipt.date,
          lastPurchaseRate: receipt.rate
        } : s))
        : [...stock, {
          id: uid(),
          itemName,
          category: 'General',
          unit: 'Nos',
          currentStock: String(qty),
          minimumStock: '0',
          lastPurchaseDate: receipt.date,
          lastPurchaseRate: receipt.rate,
          createdAt: new Date().toISOString()
        }];
      const nextInquiries = (prev.purchaseManagement || []).map((i) => (
        selectedInquiryId && i.id === selectedInquiryId ? { ...i, status: 'Received' } : i
      ));
      return {
        ...prev,
        purchaseReceipts: [...(prev.purchaseReceipts || []), receipt],
        purchaseStock: nextStock,
        purchaseManagement: nextInquiries
      };
    });
    setSelectedItem(itemName);
    setReceiptForm(emptyReceipt());
  };

  const saveIssue = (e) => {
    e.preventDefault();
    const itemName = (issueForm.itemName || selectedItem).trim();
    const qty = num(issueForm.qty);
    if (!itemName || qty <= 0) return;
    const found = items.find((s) => String(s.itemName).trim().toLowerCase() === itemName.toLowerCase());
    if (found && num(found.currentStock) < qty) {
      alert('Issue quantity is higher than current stock.');
      return;
    }
    commit((prev) => {
      const issue = { ...issueForm, itemName, qty, id: uid(), createdAt: new Date().toISOString() };
      const stock = prev.purchaseStock || [];
      const match = stock.find((s) => !s.isDeleted && String(s.itemName || '').trim().toLowerCase() === itemName.toLowerCase());
      const nextStock = match
        ? stock.map((s) => (s.id === match.id ? { ...s, currentStock: String(Math.max(0, num(s.currentStock) - qty)) } : s))
        : stock;
      return { ...prev, purchaseIssues: [...(prev.purchaseIssues || []), issue], purchaseStock: nextStock };
    });
    setIssueForm(emptyIssue());
  };

  const saveAttachment = (e) => {
    e.preventDefault();
    if (!attachmentForm.fileName) {
      alert('Choose a file first.');
      return;
    }
    commit((prev) => ({
      ...prev,
      purchaseAttachments: [...(prev.purchaseAttachments || []), {
        ...attachmentForm,
        inquiryId: selectedInquiryId || '',
        id: uid(),
        createdAt: new Date().toISOString()
      }]
    }));
    setAttachmentForm(emptyAttachment());
    if (fileRef.current) fileRef.current.value = '';
  };

  const savePo = (e) => {
    e.preventDefault();
    if (!selectedInquiryId) {
      alert('Select an inquiry first.');
      return;
    }
    commit((prev) => ({
      ...prev,
      purchaseManagement: (prev.purchaseManagement || []).map((i) => (
        i.id === selectedInquiryId
          ? {
            ...i,
            ...poForm,
            status: poForm.poCreated === 'Yes' && i.status !== 'Received' ? 'Ordered' : i.status
          }
          : i
      ))
    }));
  };

  const pickItem = (name) => {
    setSelectedItem(name);
    setReceiptForm((prev) => (prev.itemName ? prev : { ...prev, itemName: name }));
    setIssueForm((prev) => (prev.itemName ? prev : { ...prev, itemName: name }));
    setInquiryForm((prev) => (prev.itemDescription ? prev : { ...prev, itemDescription: name }));
  };

  const visibleSuppliers = suppliers.filter((s) => {
    const local = supplierSearch.trim().toLowerCase();
    const blob = [s.supplierName, s.contactPerson, s.gstin, s.itemsSupplied, s.status].join(' ').toLowerCase();
    return hit(blob) && (!local || blob.includes(local));
  });
  const visibleItems = items.filter((s) => {
    const local = itemSearch.trim().toLowerCase();
    const blob = [s.itemName, s.category, s.specification, s.preferredSupplier].join(' ').toLowerCase();
    return hit(blob) && (!local || blob.includes(local));
  });

  const priceRows = quotes.filter((r) => {
    const inq = inquiries.find((i) => i.id === r.inquiryId);
    const name = inq?.itemDescription || '';
    return (!selectedItem || String(name).trim().toLowerCase() === selectedItem.trim().toLowerCase())
      && inRange(r.quoteDate, rangeFrom, rangeTo);
  });
  const historyRows = receipts.filter((r) => (
    (!selectedItem || String(r.itemName).trim().toLowerCase() === selectedItem.trim().toLowerCase())
    && (!showAllHistory ? true : true)
    && inRange(r.date, rangeFrom, rangeTo)
    && hit(r.itemName, r.supplierName, r.invoiceNo)
  ));
  const shownHistory = showAllHistory ? historyRows : historyRows.slice(0, 6);

  const alertRows = items.filter((s) => showAllAlerts || num(s.currentStock) <= num(s.minimumStock));
  const approvedForItem = suppliers.filter((s) => {
    if (s.status !== 'Approved') return false;
    if (!selectedItem) return true;
    return String(s.itemsSupplied || '').toLowerCase().includes(selectedItem.trim().toLowerCase())
      || inquiries.some((i) => String(i.itemDescription).trim().toLowerCase() === selectedItem.trim().toLowerCase()
        && String(i.approvedSupplier || '').trim().toLowerCase() === String(s.supplierName || '').trim().toLowerCase());
  });

  const chipMatch = (r) => {
    if (statusChip === 'pending') return r.status === 'Quote Pending' || r.status === 'Follow Up' || !r.status;
    if (statusChip === 'received') return r.status === 'Quotes Received';
    if (statusChip === 'comparison') return r.status === 'Comparison' || (num(r.quotesReceived) >= 2 && r.status !== 'Approved' && r.status !== 'Ordered' && r.status !== 'Received');
    if (statusChip === 'approved') return r.status === 'Approved';
    if (statusChip === 'ordered') return r.poCreated === 'Yes' || r.status === 'Ordered';
    if (statusChip === 'got') return r.status === 'Received';
    return true;
  };
  const statusRows = rangedInquiries.filter(chipMatch);
  const counts = {
    all: rangedInquiries.length,
    pending: rangedInquiries.filter((r) => r.status === 'Quote Pending' || r.status === 'Follow Up' || !r.status).length,
    received: rangedInquiries.filter((r) => r.status === 'Quotes Received').length,
    comparison: rangedInquiries.filter((r) => num(r.quotesReceived) >= 2 && !['Approved', 'Ordered', 'Received'].includes(r.status)).length,
    approved: rangedInquiries.filter((r) => r.status === 'Approved').length,
    ordered: rangedInquiries.filter((r) => r.poCreated === 'Yes' || r.status === 'Ordered').length,
    got: rangedInquiries.filter((r) => r.status === 'Received').length
  };

  const bestQuote = inquiryQuotes
    .map((q) => ({ q, cost: landedCost(q) }))
    .filter((r) => r.cost != null)
    .sort((a, b) => a.cost - b.cost)[0];

  const supplierNames = suppliers.map((s) => s.supplierName);
  const itemNames = items.map((s) => s.itemName);

  return (
    <div className="pm-page pm-dash-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <ShoppingCart size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Purchase Management</h1>
            <p className="page-subtitle">Track your inquiries, quotes, suppliers and stock.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <ExportButton
            data={rangedInquiries}
            columns={[
              { label: 'Date', key: 'date' },
              { label: 'Inquiry No', key: 'inquiryNo' },
              { label: 'Item', key: 'itemDescription' },
              { label: 'Category', key: 'category' },
              { label: 'Supplier', key: 'approvedSupplier' },
              { label: 'Contact Via', key: 'contactVia' }
            ]}
            filename="Purchase_Inquiries"
            title="Purchase Inquiries"
          />
          <div className="pm-range">
            <Calendar size={15} />
            <DateField className="input-field" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            <span>–</span>
            <DateField className="input-field" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </div>
          <div className="pm-search">
            <Search size={14} />
            <input type="text" placeholder="Search..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
          </div>
        </div>
      </header>

      <div className="pm-working">
        <Field label="Working inquiry">
          <SearchableSelect className="input-field" value={selectedInquiryId} onChange={(e) => setSelectedInquiryId(e.target.value)} memoryKey="pm-working-inquiry">
            <option value="">Select inquiry</option>
            {inquiries.map((r) => (
              <option key={r.id} value={r.id}>{r.inquiryNo} — {r.itemDescription}</option>
            ))}
          </SearchableSelect>
        </Field>
        <Field label="Working item">
          <SearchableSelect className="input-field" value={selectedItem} onChange={(e) => pickItem(e.target.value)} memoryKey="pm-working-item">
            <option value="">All items</option>
            {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </SearchableSelect>
        </Field>
      </div>

      <div className="pm-board">
        <div className="pm-row pm-row-top">
        <Panel id="pm-supplier" title="1. Supplier Master">
          <div className="pm-split">
            <form onSubmit={saveSupplier} className="pm-stack">
              <h3>{editingSupplierId ? 'Edit Supplier' : 'Add New Supplier'}</h3>
              <Field label="Supplier Name" required>
                <input className="input-field" required value={supplierForm.supplierName} onChange={(e) => setSupplierForm({ ...supplierForm, supplierName: e.target.value })} />
              </Field>
              <Field label="Contact Person">
                <input className="input-field" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
              </Field>
              <Field label="Mobile">
                <input className="input-field" value={supplierForm.mobile} onChange={(e) => setSupplierForm({ ...supplierForm, mobile: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input-field" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              </Field>
              <Field label="Address">
                <input className="input-field" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              </Field>
              <Field label="GSTIN">
                <input className="input-field" value={supplierForm.gstin} onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })} />
              </Field>
              <Field label="Items Supplied">
                <input className="input-field" value={supplierForm.itemsSupplied} onChange={(e) => setSupplierForm({ ...supplierForm, itemsSupplied: e.target.value })} />
              </Field>
              <Field label="Status">
                <SearchableSelect className="input-field" value={supplierForm.status} onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })} memoryKey="pm-supplier-status">
                  {SUPPLIER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </SearchableSelect>
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => { setSupplierForm(emptySupplier()); setEditingSupplierId(null); }}>Reset</button>
              </div>
            </form>
            <div className="pm-stack">
              <div className="pm-search">
                <Search size={14} />
                <input placeholder="Search supplier..." value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
              </div>
              <div className="pm-mini-wrap">
                <table className="pm-mini">
                  <thead>
                    <tr><th>Supplier Name</th><th>Contact</th><th>GSTIN</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {visibleSuppliers.length === 0 ? (
                      <tr><td colSpan={5} className="pm-empty">No suppliers yet.</td></tr>
                    ) : visibleSuppliers.map((s) => (
                      <tr key={s.id}>
                        <td>{s.supplierName}</td>
                        <td>{s.contactPerson || '—'}</td>
                        <td>{s.gstin || '—'}</td>
                        <td><span className={`pm-pill ${s.status === 'Approved' ? 'is-approved' : 'is-pending'}`}>{s.status}</span></td>
                        <td><RowActions onEdit={() => { setSupplierForm({ ...emptySupplier(), ...s }); setEditingSupplierId(s.id); }} onDelete={() => removeRow('purchaseSuppliers', s.id)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Panel>

        <Panel id="pm-item" title="2. Item / Material Master">
          <div className="pm-split">
            <form onSubmit={saveItem} className="pm-stack">
              <h3>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
              <Field label="Item Name" required>
                <input className="input-field" required value={itemForm.itemName} onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })} />
              </Field>
              <Field label="Category">
                <SearchableSelect className="input-field" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} memoryKey="pm-item-category">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Specification">
                <input className="input-field" value={itemForm.specification} onChange={(e) => setItemForm({ ...itemForm, specification: e.target.value })} />
              </Field>
              <Field label="Unit">
                <SearchableSelect className="input-field" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} memoryKey="pm-unit">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Current Stock">
                <input type="number" step="any" className="input-field" value={itemForm.currentStock} onChange={(e) => setItemForm({ ...itemForm, currentStock: e.target.value })} />
              </Field>
              <Field label="Minimum Stock">
                <input type="number" step="any" className="input-field" value={itemForm.minimumStock} onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })} />
              </Field>
              <Field label="Preferred Supplier">
                <SearchableSelect className="input-field" value={itemForm.preferredSupplier} onChange={(e) => setItemForm({ ...itemForm, preferredSupplier: e.target.value })} memoryKey="pm-preferred-supplier">
                  <option value="">Select</option>
                  {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </SearchableSelect>
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => { setItemForm(emptyItem()); setEditingItemId(null); }}>Reset</button>
              </div>
            </form>
            <div className="pm-stack">
              <div className="pm-search">
                <Search size={14} />
                <input placeholder="Search item..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              </div>
              <div className="pm-mini-wrap">
                <table className="pm-mini">
                  <thead>
                    <tr><th>Item Name</th><th>Category</th><th>Stock</th><th>Min</th><th></th></tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr><td colSpan={5} className="pm-empty">No items yet.</td></tr>
                    ) : visibleItems.map((s) => (
                      <tr key={s.id} className={selectedItem === s.itemName ? 'is-picked' : ''} onClick={() => pickItem(s.itemName)}>
                        <td>{s.itemName}</td>
                        <td>{s.category}</td>
                        <td>{s.currentStock || 0}</td>
                        <td>{s.minimumStock || 0}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <RowActions onEdit={() => { setItemForm({ ...emptyItem(), ...s }); setEditingItemId(s.id); }} onDelete={() => removeRow('purchaseStock', s.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Panel>

        <Panel id="pm-inquiry" title="3. New Inquiry" extra={inquiryForm.inquiryNo}>
          <form onSubmit={saveInquiry} className="pm-stack">
            <Field label="Inquiry Number">
              <input className="input-field" value={inquiryForm.inquiryNo} onChange={(e) => setInquiryForm({ ...inquiryForm, inquiryNo: e.target.value })} />
            </Field>
            <Field label="Date" required>
              <DateField className="input-field" required value={inquiryForm.date} onChange={(e) => setInquiryForm({ ...inquiryForm, date: e.target.value })} />
            </Field>
            <Field label="Inquiry Sent Through">
              <SearchableSelect className="input-field" value={inquiryForm.contactVia} onChange={(e) => setInquiryForm({ ...inquiryForm, contactVia: e.target.value })} memoryKey="pm-contact-via">
                {CONTACT_VIA.map((c) => <option key={c} value={c}>{c}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Item / Description" required>
              <SearchableSelect className="input-field" value={inquiryForm.itemDescription} onChange={(e) => setInquiryForm({ ...inquiryForm, itemDescription: e.target.value })} memoryKey="pm-inquiry-item">
                <option value="">Select item</option>
                {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Category">
              <SearchableSelect className="input-field" value={inquiryForm.category} onChange={(e) => setInquiryForm({ ...inquiryForm, category: e.target.value })} memoryKey="pm-inquiry-category">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Remarks">
              <input className="input-field" value={inquiryForm.remarks} onChange={(e) => setInquiryForm({ ...inquiryForm, remarks: e.target.value })} />
            </Field>
            <div className="pm-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
              <button type="button" className="btn pm-btn-outline" onClick={() => { setEditingInquiryId(null); setInquiryForm(emptyInquiryForm(serial, inquiries)); }}>Reset</button>
            </div>
          </form>
        </Panel>

        </div>
        <div className="pm-row pm-row-4">
        <Panel id="pm-quotes" title="4. Multiple Quotes Against One Inquiry" extra={selectedInquiry?.inquiryNo || 'Select inquiry'}>
          <div className="pm-panel-tools">
            <button type="button" className="btn btn-primary" onClick={() => setShowQuoteForm((v) => !v)}>Add Quote</button>
          </div>
          {showQuoteForm && (
            <form onSubmit={saveQuote} className="pm-quote-form">
              <Field label="Supplier" required>
                <SearchableSelect className="input-field" value={quoteForm.supplierName} onChange={(e) => setQuoteForm({ ...quoteForm, supplierName: e.target.value })} memoryKey="pm-quote-supplier">
                  <option value="">Select supplier</option>
                  {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Quote No">
                <input className="input-field" value={quoteForm.quoteNo} onChange={(e) => setQuoteForm({ ...quoteForm, quoteNo: e.target.value })} />
              </Field>
              <Field label="Date">
                <DateField className="input-field" value={quoteForm.quoteDate} onChange={(e) => setQuoteForm({ ...quoteForm, quoteDate: e.target.value })} />
              </Field>
              <Field label="Rate (₹)">
                <input type="number" step="any" className="input-field" value={quoteForm.rate} onChange={(e) => setQuoteForm({ ...quoteForm, rate: e.target.value })} />
              </Field>
              <Field label="GST %">
                <input type="number" step="any" className="input-field" value={quoteForm.gst} onChange={(e) => setQuoteForm({ ...quoteForm, gst: e.target.value })} />
              </Field>
              <Field label="Qty">
                <input type="number" step="any" className="input-field" value={quoteForm.qty} onChange={(e) => setQuoteForm({ ...quoteForm, qty: e.target.value })} />
              </Field>
              <Field label="Freight (₹)">
                <input type="number" step="any" className="input-field" value={quoteForm.freight} onChange={(e) => setQuoteForm({ ...quoteForm, freight: e.target.value })} />
              </Field>
              <Field label="Delivery Time">
                <input className="input-field" value={quoteForm.deliveryTime} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTime: e.target.value })} />
              </Field>
              <Field label="Payment Terms">
                <input className="input-field" value={quoteForm.paymentTerms} onChange={(e) => setQuoteForm({ ...quoteForm, paymentTerms: e.target.value })} />
              </Field>
              <Field label="Warranty">
                <input className="input-field" value={quoteForm.warranty} onChange={(e) => setQuoteForm({ ...quoteForm, warranty: e.target.value })} />
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary">Save Quote</button>
              </div>
            </form>
          )}
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Supplier</th><th>Quote No</th><th>Date</th><th>Rate</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {inquiryQuotes.length === 0 ? (
                  <tr><td colSpan={6} className="pm-empty">No quotes for this inquiry.</td></tr>
                ) : inquiryQuotes.map((r) => (
                  <tr key={r.id}>
                    <td>{r.supplierName}</td>
                    <td>{r.quoteNo || '—'}</td>
                    <td>{formatDate(r.quoteDate) || '—'}</td>
                    <td>{money(r.rate)}</td>
                    <td><span className={`pm-pill ${r.approved ? 'is-approved' : 'is-received'}`}>{r.approved ? 'Approved' : 'Received'}</span></td>
                    <td><RowActions onEdit={() => { setQuoteForm({ ...emptyQuote(), ...r }); setEditingQuoteId(r.id); setShowQuoteForm(true); }} onDelete={() => removeRow('purchaseQuotes', r.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel id="pm-compare" title="5. Quote Comparison" extra={selectedInquiry?.inquiryNo || ''}>
          {inquiryQuotes.length === 0 ? (
            <p className="pm-empty">Add quotes to compare suppliers.</p>
          ) : (
            <div className="pm-mini-wrap">
              <table className="pm-mini pm-matrix">
                <thead>
                  <tr>
                    <th>Criteria</th>
                    {inquiryQuotes.map((r) => <th key={r.id} className={bestQuote?.q.id === r.id ? 'is-best' : ''}>{r.supplierName}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Rate (₹)', (r) => money(r.rate)],
                    ['GST (%)', (r) => r.gst || '—'],
                    ['Freight (₹)', (r) => money(r.freight)],
                    ['Delivery Time', (r) => r.deliveryTime || '—'],
                    ['Payment Terms', (r) => r.paymentTerms || '—'],
                    ['Warranty', (r) => r.warranty || '—'],
                    ['Landed Cost (₹)', (r) => {
                      const cost = landedCost(r);
                      return cost == null ? '—' : money(cost);
                    }]
                  ].map(([label, cell]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {inquiryQuotes.map((r) => (
                        <td key={r.id} className={bestQuote?.q.id === r.id ? 'is-best' : ''}>{cell(r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bestQuote ? <div className="pm-recommend">Recommended Supplier: {bestQuote.q.supplierName}</div> : null}
          <button type="button" className="btn btn-primary" disabled={!inquiryQuotes.length} onClick={approveRecommended}>Mark as Approved</button>
        </Panel>

        <Panel id="pm-follow" title="6. Follow-Up History" extra={selectedInquiry?.inquiryNo || ''}>
          <div className="pm-panel-tools">
            <button type="button" className="btn btn-primary" onClick={() => setShowFollowForm((v) => !v)}>Add Follow Up</button>
          </div>
          {showFollowForm && (
            <form onSubmit={saveFollow} className="pm-quote-form">
              <Field label="Date">
                <DateField className="input-field" value={followForm.followDate} onChange={(e) => setFollowForm({ ...followForm, followDate: e.target.value })} />
              </Field>
              <Field label="Contacted Person">
                <input className="input-field" value={followForm.contactedPerson} onChange={(e) => setFollowForm({ ...followForm, contactedPerson: e.target.value })} />
              </Field>
              <Field label="Remark">
                <input className="input-field" value={followForm.remark} onChange={(e) => setFollowForm({ ...followForm, remark: e.target.value })} />
              </Field>
              <Field label="Next Follow Up">
                <DateField className="input-field" value={followForm.nextFollowDate} onChange={(e) => setFollowForm({ ...followForm, nextFollowDate: e.target.value })} />
              </Field>
              <Field label="Status">
                <SearchableSelect className="input-field" value={followForm.status} onChange={(e) => setFollowForm({ ...followForm, status: e.target.value })} memoryKey="pm-follow-status">
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                </SearchableSelect>
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          )}
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Date</th><th>Person</th><th>Remark</th><th>Next</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {inquiryFollows.length === 0 ? (
                  <tr><td colSpan={6} className="pm-empty">No follow-ups yet.</td></tr>
                ) : inquiryFollows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.followDate) || '—'}</td>
                    <td>{r.contactedPerson || '—'}</td>
                    <td>{r.remark || '—'}</td>
                    <td>{formatDate(r.nextFollowDate) || '—'}</td>
                    <td><span className={`pm-pill ${r.status === 'Received' ? 'is-received' : 'is-pending'}`}>{r.status}</span></td>
                    <td><RowActions onEdit={() => { setFollowForm({ ...emptyFollow(), ...r }); setEditingFollowId(r.id); setShowFollowForm(true); }} onDelete={() => removeRow('purchaseFollowUps', r.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel id="pm-price" title="7. Price History" extra={selectedItem || 'All items'}>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Date</th><th>Supplier</th><th>Rate (₹)</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {priceRows.length === 0 ? (
                  <tr><td colSpan={4} className="pm-empty">No price history.</td></tr>
                ) : priceRows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.quoteDate) || '—'}</td>
                    <td>{r.supplierName}</td>
                    <td>{money(r.rate)}</td>
                    <td>{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        </div>
        <div className="pm-row pm-row-5">
        <Panel id="pm-approved" title="8. Approved Supplier for Particular Item" extra={selectedItem || 'All items'}>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Item Name</th><th>Approved Supplier</th><th>Status</th></tr>
              </thead>
              <tbody>
                {approvedForItem.length === 0 ? (
                  <tr><td colSpan={3} className="pm-empty">No approved supplier for this item.</td></tr>
                ) : approvedForItem.map((s) => (
                  <tr key={s.id}>
                    <td>{selectedItem || s.itemsSupplied || '—'}</td>
                    <td>{s.supplierName}</td>
                    <td><span className="pm-pill is-approved">Approved</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel id="pm-receipt" title="9. Stock Entry / Purchase Receipt">
          <form onSubmit={saveReceipt} className="pm-stack">
            <Field label="Supplier">
              <SearchableSelect className="input-field" value={receiptForm.supplierName} onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })} memoryKey="pm-receipt-supplier">
                <option value="">Select</option>
                {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Invoice / DC No">
              <input className="input-field" value={receiptForm.invoiceNo} onChange={(e) => setReceiptForm({ ...receiptForm, invoiceNo: e.target.value })} />
            </Field>
            <Field label="Date">
              <DateField className="input-field" value={receiptForm.date} onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })} />
            </Field>
            <Field label="Item" required>
              <SearchableSelect className="input-field" value={receiptForm.itemName || selectedItem} onChange={(e) => setReceiptForm({ ...receiptForm, itemName: e.target.value })} memoryKey="pm-receipt-item">
                <option value="">Select item</option>
                {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </SearchableSelect>
            </Field>
            <div className="pm-inline-2">
              <Field label="Quantity">
                <input type="number" step="any" className="input-field" value={receiptForm.qty} onChange={(e) => setReceiptForm({ ...receiptForm, qty: e.target.value })} />
              </Field>
              <Field label="Rate (₹)">
                <input type="number" step="any" className="input-field" value={receiptForm.rate} onChange={(e) => setReceiptForm({ ...receiptForm, rate: e.target.value })} />
              </Field>
            </div>
            <Field label="Total">
              <input className="input-field" readOnly value={num(receiptForm.qty) && num(receiptForm.rate) ? (num(receiptForm.qty) * num(receiptForm.rate)).toFixed(2) : ''} />
            </Field>
            <Field label="Remarks">
              <input className="input-field" value={receiptForm.remarks} onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })} />
            </Field>
            <div className="pm-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setReceiptForm(emptyReceipt())}>Reset</button>
            </div>
          </form>
        </Panel>

        <Panel id="pm-issue" title="10. Stock Issue / Consumption">
          <form onSubmit={saveIssue} className="pm-stack">
            <Field label="Item" required>
              <SearchableSelect className="input-field" value={issueForm.itemName || selectedItem} onChange={(e) => setIssueForm({ ...issueForm, itemName: e.target.value })} memoryKey="pm-issue-item">
                <option value="">Select item</option>
                {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Quantity">
              <input type="number" step="any" className="input-field" value={issueForm.qty} onChange={(e) => setIssueForm({ ...issueForm, qty: e.target.value })} />
            </Field>
            <Field label="Date">
              <DateField className="input-field" value={issueForm.date} onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })} />
            </Field>
            <Field label="Purpose">
              <SearchableSelect className="input-field" value={issueForm.purpose} onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })} memoryKey="pm-issue-purpose">
                {ISSUE_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Remarks">
              <input className="input-field" value={issueForm.remarks} onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })} />
            </Field>
            <div className="pm-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setIssueForm(emptyIssue())}>Reset</button>
            </div>
          </form>
        </Panel>

        <Panel id="pm-alert" title="11. Minimum Stock Alert">
          <div className="pm-alert-banner">
            <AlertTriangle size={16} />
            <div>
              <strong>Low Stock Alert</strong>
              <p>Items at or below the minimum stock level.</p>
            </div>
          </div>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Item</th><th>Current</th><th>Minimum</th><th>Status</th></tr>
              </thead>
              <tbody>
                {alertRows.length === 0 ? (
                  <tr><td colSpan={4} className="pm-empty">No low-stock items.</td></tr>
                ) : alertRows.map((s) => {
                  const low = num(s.currentStock) <= num(s.minimumStock);
                  return (
                    <tr key={s.id} onClick={() => pickItem(s.itemName)}>
                      <td>{s.itemName}</td>
                      <td>{s.currentStock || 0}</td>
                      <td>{s.minimumStock || 0}</td>
                      <td><span className={`pm-pill ${low ? 'is-low' : 'is-approved'}`}>{low ? 'Low Stock' : 'In Stock'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn pm-btn-outline" onClick={() => setShowAllAlerts((v) => !v)}>
            {showAllAlerts ? 'Show low stock only' : 'View All Items'}
          </button>
        </Panel>

        <Panel id="pm-history" title="12. Item Purchase History" extra={selectedItem || 'All items'}>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Date</th><th>Supplier</th><th>Qty</th><th>Rate</th><th>Invoice</th></tr>
              </thead>
              <tbody>
                {shownHistory.length === 0 ? (
                  <tr><td colSpan={5} className="pm-empty">No purchases yet.</td></tr>
                ) : shownHistory.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date) || '—'}</td>
                    <td>{r.supplierName || '—'}</td>
                    <td>{r.qty}</td>
                    <td>{money(r.rate)}</td>
                    <td>{r.invoiceNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pm-note">Total purchases: {historyRows.length}</p>
          <button type="button" className="btn pm-btn-outline" onClick={() => setShowAllHistory((v) => !v)}>
            {showAllHistory ? 'Show recent' : 'View Full History'}
          </button>
        </Panel>

        </div>
        <div className="pm-row pm-row-bottom">
        <Panel id="pm-status" title="13. Inquiry Status Dashboard">
          <div className="pm-chips">
            {[
              ['all', 'All', counts.all],
              ['pending', 'Pending', counts.pending],
              ['received', 'Quote Received', counts.received],
              ['comparison', 'Comparison', counts.comparison],
              ['approved', 'Approved', counts.approved],
              ['ordered', 'Ordered', counts.ordered],
              ['got', 'Received', counts.got]
            ].map(([key, label, value]) => (
              <button type="button" key={key} className={`pm-chip tone-${key}${statusChip === key ? ' is-on' : ''}`} onClick={() => setStatusChip(key)}>
                <strong>{value}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Sr</th><th>Inquiry No</th><th>Item / Description</th><th>Date</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {statusRows.length === 0 ? (
                  <tr><td colSpan={6} className="pm-empty">No inquiries in this range.</td></tr>
                ) : statusRows.map((r, idx) => (
                  <tr key={r.id} className={r.id === selectedInquiryId ? 'is-picked' : ''} onClick={() => { setSelectedInquiryId(r.id); setSelectedItem(r.itemDescription || ''); }}>
                    <td>{idx + 1}</td>
                    <td>{r.inquiryNo}</td>
                    <td>{r.itemDescription}</td>
                    <td>{formatDate(r.date)}</td>
                    <td><span className={`pm-pill ${pillFor(r.status)}`}>{r.status || 'Quote Pending'}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        onEdit={() => {
                          setInquiryForm({ ...emptyInquiryForm(serial, inquiries), ...r });
                          setEditingInquiryId(r.id);
                          document.getElementById('pm-inquiry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        onDelete={() => removeRow('purchaseManagement', r.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel id="pm-files" title="14. Attachment">
          <form onSubmit={saveAttachment} className="pm-stack">
            <Field label="File Name">
              <div className="pm-file-row">
                <input className="input-field" readOnly value={attachmentForm.fileName} placeholder="No file chosen" />
                <button type="button" className="btn pm-btn-outline" onClick={() => fileRef.current?.click()}>Browse</button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const sizeLabel = file.size >= 1024 * 1024
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
                    setAttachmentForm((prev) => ({ ...prev, fileName: file.name, sizeLabel }));
                  }}
                />
              </div>
            </Field>
            <Field label="Document Type">
              <SearchableSelect className="input-field" value={attachmentForm.docType} onChange={(e) => setAttachmentForm({ ...attachmentForm, docType: e.target.value })} memoryKey="pm-doc-type">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Remarks">
              <input className="input-field" value={attachmentForm.remarks} onChange={(e) => setAttachmentForm({ ...attachmentForm, remarks: e.target.value })} />
            </Field>
            <div className="pm-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
            </div>
          </form>
          <ul className="pm-file-list">
            {inquiryFiles.length === 0 ? <li className="pm-empty">No attachments.</li> : inquiryFiles.map((f) => (
              <li key={f.id}>
                <Paperclip size={14} />
                <span>{f.fileName}</span>
                <em>{f.sizeLabel}</em>
                <button type="button" title="Delete" onClick={() => removeRow('purchaseAttachments', f.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="pm-po" title="15. PO Details (Without Generating PO)" extra={selectedInquiry?.inquiryNo || ''}>
          <form onSubmit={savePo} className="pm-stack">
            <Field label="PO Created">
              <div className="pm-yesno">
                <button type="button" className={poForm.poCreated !== 'Yes' ? 'is-on' : ''} onClick={() => setPoForm({ ...poForm, poCreated: 'No' })}>No</button>
                <button type="button" className={poForm.poCreated === 'Yes' ? 'is-on is-yes' : ''} onClick={() => setPoForm({ ...poForm, poCreated: 'Yes' })}>Yes</button>
              </div>
            </Field>
            <Field label="PO No">
              <input className="input-field" value={poForm.poNo} onChange={(e) => setPoForm({ ...poForm, poNo: e.target.value })} disabled={poForm.poCreated !== 'Yes'} />
            </Field>
            <Field label="PO Date">
              <DateField className="input-field" value={poForm.poDate} onChange={(e) => setPoForm({ ...poForm, poDate: e.target.value })} disabled={poForm.poCreated !== 'Yes'} />
            </Field>
            <Field label="Remarks">
              <input className="input-field" value={poForm.poRemarks} onChange={(e) => setPoForm({ ...poForm, poRemarks: e.target.value })} />
            </Field>
            {poForm.poCreated !== 'Yes' ? <p className="pm-note">PO will be generated separately.</p> : null}
            <div className="pm-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setPoForm(selectedInquiry ? {
                poCreated: selectedInquiry.poCreated || 'No',
                poNo: selectedInquiry.poNo || '',
                poDate: selectedInquiry.poDate || '',
                poRemarks: selectedInquiry.poRemarks || ''
              } : emptyPo())}>Reset</button>
            </div>
          </form>
        </Panel>
        </div>
      </div>
    </div>
  );
};

const emptyInquiryForm = (serial, rows) => ({
  inquiryNo: nextInquiryNo(rows, serial),
  date: today(),
  contactVia: 'WhatsApp',
  itemDescription: '',
  category: 'General',
  remarks: '',
  supplierCount: 0,
  quotesReceived: 0,
  status: 'Quote Pending',
  approvedSupplier: '',
  lowestQuote: ''
});

const syncInquiryQuotes = (inquiries, quotes, inquiryId) => {
  const mine = (quotes || []).filter((q) => !q.isDeleted && q.inquiryId === inquiryId);
  const costs = mine.map(landedCost).filter((n) => n != null);
  const lowest = costs.length ? Math.min(...costs) : '';
  return (inquiries || []).map((i) => {
    if (i.id !== inquiryId) return i;
    const locked = ['Approved', 'Ordered', 'Received'].includes(i.status);
    return {
      ...i,
      supplierCount: new Set(mine.map((q) => q.supplierName).filter(Boolean)).size,
      quotesReceived: mine.length,
      lowestQuote: lowest === '' ? i.lowestQuote : Number(lowest.toFixed(2)),
      status: locked ? i.status : (mine.length ? 'Quotes Received' : 'Quote Pending')
    };
  });
};

const pillFor = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'is-approved';
  if (s.includes('received') || s.includes('quote')) return 'is-received';
  if (s.includes('ordered')) return 'is-ordered';
  if (s.includes('low')) return 'is-low';
  return 'is-pending';
};

export default PurchaseManagement;
