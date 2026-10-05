import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Calendar, ClipboardList, Package, Paperclip, Pencil, Plus,
  Save, Search, ShoppingCart, Trash2, Truck, X
} from 'lucide-react';
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

const TABS = [
  { id: 'inquiries', label: 'Inquiries', icon: ClipboardList },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'stock', label: 'Stock & History', icon: Boxes }
];
const DETAIL_TABS = [
  { id: 'quotes', label: 'Quotes' },
  { id: 'compare', label: 'Comparison' },
  { id: 'follow', label: 'Follow Ups' },
  { id: 'files', label: 'Attachments' },
  { id: 'po', label: 'PO Details' }
];

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
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('inquiries');
  const [modal, setModal] = useState(null);
  const [detailTab, setDetailTab] = useState('quotes');
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
    setModal(null);
    setActiveTab('suppliers');
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
    setModal(null);
    setActiveTab('items');
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
    setModal(null);
    setActiveTab('inquiries');
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
    setModal(null);
    setActiveTab('stock');
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
    setModal(null);
    setActiveTab('stock');
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

  const openSupplier = (row = null) => {
    setSupplierForm(row ? { ...emptySupplier(), ...row } : emptySupplier());
    setEditingSupplierId(row?.id || null);
    setModal('supplier');
  };

  const openItem = (row = null) => {
    setItemForm(row ? { ...emptyItem(), ...row } : emptyItem());
    setEditingItemId(row?.id || null);
    setModal('item');
  };

  const openInquiryForm = (row = null) => {
    setInquiryForm(row ? { ...emptyInquiryForm(serial, inquiries), ...row } : emptyInquiryForm(serial, inquiries));
    setEditingInquiryId(row?.id || null);
    setModal('inquiry');
  };

  const openInquiryDetail = (row, tab = 'quotes') => {
    setSelectedInquiryId(row.id);
    setSelectedItem(row.itemDescription || '');
    setDetailTab(tab);
    setShowQuoteForm(false);
    setShowFollowForm(false);
    setModal('detail');
  };

  const openReceipt = (againstInquiry = false) => {
    if (!againstInquiry) setSelectedInquiryId('');
    setReceiptForm({
      ...emptyReceipt(),
      itemName: againstInquiry ? (selectedInquiry?.itemDescription || '') : selectedItem,
      supplierName: againstInquiry ? (selectedInquiry?.approvedSupplier || '') : ''
    });
    setModal('receipt');
  };

  const openIssue = () => {
    setIssueForm({ ...emptyIssue(), itemName: selectedItem });
    setModal('issue');
  };

  const closeModal = () => {
    setModal(null);
    setEditingSupplierId(null);
    setEditingItemId(null);
    setEditingInquiryId(null);
    setEditingQuoteId(null);
    setEditingFollowId(null);
    setShowQuoteForm(false);
    setShowFollowForm(false);
  };

  useEffect(() => {
    const id = (location.hash || '').replace('#', '');
    if (!id) return;
    setActiveTab('inquiries');
    if (id === 'pm-inquiry') {
      openInquiryForm();
    } else if (id === 'pm-status') {
      setModal(null);
    } else if (id === 'pm-follow' || id === 'pm-compare') {
      const target = inquiries.find((r) => r.id === selectedInquiryId) || inquiries[0];
      if (target) openInquiryDetail(target, id === 'pm-follow' ? 'follow' : 'compare');
    }
  }, [location.hash]);

  const tabCounts = {
    inquiries: rangedInquiries.length,
    suppliers: suppliers.length,
    items: items.length,
    stock: items.filter((s) => num(s.currentStock) <= num(s.minimumStock)).length
  };

  const supplierFormView = (
    <form onSubmit={saveSupplier} className="pm-modal-form">
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
      <Field label="GSTIN">
        <input className="input-field" value={supplierForm.gstin} onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })} />
      </Field>
      <Field label="Status">
        <SearchableSelect className="input-field" value={supplierForm.status} onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.value })} memoryKey="pm-supplier-status">
          {SUPPLIER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </SearchableSelect>
      </Field>
      <div className="pm-span-2">
        <Field label="Address">
          <input className="input-field" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
        </Field>
      </div>
      <Field label="Items Supplied">
        <input className="input-field" value={supplierForm.itemsSupplied} onChange={(e) => setSupplierForm({ ...supplierForm, itemsSupplied: e.target.value })} />
      </Field>
      <div className="pm-form-actions">
        <button type="submit" className="btn btn-primary"><Save size={14} /> {editingSupplierId ? 'Update' : 'Save'}</button>
        <button type="button" className="btn pm-btn-outline" onClick={closeModal}>Cancel</button>
      </div>
    </form>
  );

  const itemFormView = (
    <form onSubmit={saveItem} className="pm-modal-form">
      <Field label="Item Name" required>
        <input className="input-field" required value={itemForm.itemName} onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })} />
      </Field>
      <Field label="Category">
        <SearchableSelect className="input-field" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} memoryKey="pm-item-category">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SearchableSelect>
      </Field>
      <Field label="Unit">
        <SearchableSelect className="input-field" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} memoryKey="pm-unit">
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </SearchableSelect>
      </Field>
      <div className="pm-span-2">
        <Field label="Specification">
          <input className="input-field" value={itemForm.specification} onChange={(e) => setItemForm({ ...itemForm, specification: e.target.value })} />
        </Field>
      </div>
      <Field label="Preferred Supplier">
        <SearchableSelect className="input-field" value={itemForm.preferredSupplier} onChange={(e) => setItemForm({ ...itemForm, preferredSupplier: e.target.value })} memoryKey="pm-preferred-supplier">
          <option value="">Select</option>
          {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </SearchableSelect>
      </Field>
      <Field label="Current Stock">
        <input type="number" step="any" className="input-field" value={itemForm.currentStock} onChange={(e) => setItemForm({ ...itemForm, currentStock: e.target.value })} />
      </Field>
      <Field label="Minimum Stock">
        <input type="number" step="any" className="input-field" value={itemForm.minimumStock} onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })} />
      </Field>
      <div className="pm-form-actions">
        <button type="submit" className="btn btn-primary"><Save size={14} /> {editingItemId ? 'Update' : 'Save'}</button>
        <button type="button" className="btn pm-btn-outline" onClick={closeModal}>Cancel</button>
      </div>
    </form>
  );

  const inquiryFormView = (
    <form onSubmit={saveInquiry} className="pm-modal-form">
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
        <button type="submit" className="btn btn-primary"><Save size={14} /> {editingInquiryId ? 'Update' : 'Save'}</button>
        <button type="button" className="btn pm-btn-outline" onClick={closeModal}>Cancel</button>
      </div>
    </form>
  );

  const receiptFormView = (
    <form onSubmit={saveReceipt} className="pm-modal-form">
      {selectedInquiry ? (
        <p className="pm-note pm-span-all">Against inquiry {selectedInquiry.inquiryNo} — it will be marked Received.</p>
      ) : null}
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
        <SearchableSelect className="input-field" value={receiptForm.itemName} onChange={(e) => setReceiptForm({ ...receiptForm, itemName: e.target.value })} memoryKey="pm-receipt-item">
          <option value="">Select item</option>
          {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </SearchableSelect>
      </Field>
      <Field label="Quantity">
        <input type="number" step="any" className="input-field" value={receiptForm.qty} onChange={(e) => setReceiptForm({ ...receiptForm, qty: e.target.value })} />
      </Field>
      <Field label="Rate (₹)">
        <input type="number" step="any" className="input-field" value={receiptForm.rate} onChange={(e) => setReceiptForm({ ...receiptForm, rate: e.target.value })} />
      </Field>
      <Field label="Total">
        <input className="input-field" readOnly value={num(receiptForm.qty) && num(receiptForm.rate) ? (num(receiptForm.qty) * num(receiptForm.rate)).toFixed(2) : ''} />
      </Field>
      <div className="pm-span-2">
        <Field label="Remarks">
          <input className="input-field" value={receiptForm.remarks} onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })} />
        </Field>
      </div>
      <div className="pm-form-actions">
        <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
        <button type="button" className="btn pm-btn-outline" onClick={closeModal}>Cancel</button>
      </div>
    </form>
  );

  const issueFormView = (
    <form onSubmit={saveIssue} className="pm-modal-form">
      <Field label="Item" required>
        <SearchableSelect className="input-field" value={issueForm.itemName} onChange={(e) => setIssueForm({ ...issueForm, itemName: e.target.value })} memoryKey="pm-issue-item">
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
      <div className="pm-span-2">
        <Field label="Remarks">
          <input className="input-field" value={issueForm.remarks} onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })} />
        </Field>
      </div>
      <div className="pm-form-actions">
        <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
        <button type="button" className="btn pm-btn-outline" onClick={closeModal}>Cancel</button>
      </div>
    </form>
  );

  const quotesView = (
    <>
      <div className="pm-panel-tools">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setQuoteForm(emptyQuote()); setEditingQuoteId(null); setShowQuoteForm((v) => !v); }}
        >
          <Plus size={14} /> Add Quote
        </button>
      </div>
      {showQuoteForm && (
        <form onSubmit={saveQuote} className="pm-modal-form pm-inner-form">
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
          <div className="pm-span-2">
            <Field label="Remarks">
              <input className="input-field" value={quoteForm.remarks} onChange={(e) => setQuoteForm({ ...quoteForm, remarks: e.target.value })} />
            </Field>
          </div>
          <div className="pm-form-actions">
            <button type="submit" className="btn btn-primary"><Save size={14} /> {editingQuoteId ? 'Update Quote' : 'Save Quote'}</button>
            <button type="button" className="btn pm-btn-outline" onClick={() => { setShowQuoteForm(false); setEditingQuoteId(null); }}>Cancel</button>
          </div>
        </form>
      )}
      <div className="pm-mini-wrap">
        <table className="pm-mini">
          <thead>
            <tr><th>Supplier</th><th>Quote No</th><th>Date</th><th>Rate</th><th>GST %</th><th>Qty</th><th>Freight</th><th>Landed Cost</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {inquiryQuotes.length === 0 ? (
              <tr><td colSpan={10} className="pm-empty">No quotes for this inquiry. Click Add Quote.</td></tr>
            ) : inquiryQuotes.map((r) => (
              <tr key={r.id}>
                <td>{r.supplierName}</td>
                <td>{r.quoteNo || '—'}</td>
                <td>{formatDate(r.quoteDate) || '—'}</td>
                <td>{money(r.rate)}</td>
                <td>{r.gst || '—'}</td>
                <td>{r.qty || '—'}</td>
                <td>{money(r.freight)}</td>
                <td>{landedCost(r) == null ? '—' : money(landedCost(r))}</td>
                <td><span className={`pm-pill ${r.approved ? 'is-approved' : 'is-received'}`}>{r.approved ? 'Approved' : 'Received'}</span></td>
                <td><RowActions onEdit={() => { setQuoteForm({ ...emptyQuote(), ...r }); setEditingQuoteId(r.id); setShowQuoteForm(true); }} onDelete={() => removeRow('purchaseQuotes', r.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const compareView = (
    <>
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
      <div className="pm-form-actions">
        <button type="button" className="btn btn-primary" disabled={!inquiryQuotes.length} onClick={approveRecommended}>Mark as Approved</button>
      </div>
    </>
  );

  const followView = (
    <>
      <div className="pm-panel-tools">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setFollowForm(emptyFollow()); setEditingFollowId(null); setShowFollowForm((v) => !v); }}
        >
          <Plus size={14} /> Add Follow Up
        </button>
      </div>
      {showFollowForm && (
        <form onSubmit={saveFollow} className="pm-modal-form pm-inner-form">
          <Field label="Date">
            <DateField className="input-field" value={followForm.followDate} onChange={(e) => setFollowForm({ ...followForm, followDate: e.target.value })} />
          </Field>
          <Field label="Contacted Person">
            <input className="input-field" value={followForm.contactedPerson} onChange={(e) => setFollowForm({ ...followForm, contactedPerson: e.target.value })} />
          </Field>
          <Field label="Next Follow Up">
            <DateField className="input-field" value={followForm.nextFollowDate} onChange={(e) => setFollowForm({ ...followForm, nextFollowDate: e.target.value })} />
          </Field>
          <div className="pm-span-2">
            <Field label="Remark">
              <input className="input-field" value={followForm.remark} onChange={(e) => setFollowForm({ ...followForm, remark: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <SearchableSelect className="input-field" value={followForm.status} onChange={(e) => setFollowForm({ ...followForm, status: e.target.value })} memoryKey="pm-follow-status">
              <option value="Pending">Pending</option>
              <option value="Received">Received</option>
            </SearchableSelect>
          </Field>
          <div className="pm-form-actions">
            <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
            <button type="button" className="btn pm-btn-outline" onClick={() => { setShowFollowForm(false); setEditingFollowId(null); }}>Cancel</button>
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
              <tr><td colSpan={6} className="pm-empty">No follow-ups yet. Click Add Follow Up.</td></tr>
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
    </>
  );

  const filesView = (
    <>
      <form onSubmit={saveAttachment} className="pm-modal-form pm-inner-form">
        <div className="pm-span-2">
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
        </div>
        <Field label="Document Type">
          <SearchableSelect className="input-field" value={attachmentForm.docType} onChange={(e) => setAttachmentForm({ ...attachmentForm, docType: e.target.value })} memoryKey="pm-doc-type">
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </SearchableSelect>
        </Field>
        <div className="pm-span-2">
          <Field label="Remarks">
            <input className="input-field" value={attachmentForm.remarks} onChange={(e) => setAttachmentForm({ ...attachmentForm, remarks: e.target.value })} />
          </Field>
        </div>
        <div className="pm-form-actions">
          <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
        </div>
      </form>
      <ul className="pm-file-list">
        {inquiryFiles.length === 0 ? <li className="pm-empty">No attachments.</li> : inquiryFiles.map((f) => (
          <li key={f.id}>
            <Paperclip size={14} />
            <span>{f.fileName}</span>
            <em>{f.docType} · {f.sizeLabel}</em>
            <button type="button" title="Delete" onClick={() => removeRow('purchaseAttachments', f.id)}><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>
    </>
  );

  const poView = (
    <form onSubmit={savePo} className="pm-modal-form pm-inner-form">
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
      <div className="pm-span-all">
        <Field label="Remarks">
          <input className="input-field" value={poForm.poRemarks} onChange={(e) => setPoForm({ ...poForm, poRemarks: e.target.value })} />
        </Field>
      </div>
      {poForm.poCreated !== 'Yes' ? <p className="pm-note pm-span-all">PO will be generated separately.</p> : null}
      <div className="pm-form-actions">
        <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
      </div>
    </form>
  );

  const detailView = selectedInquiry ? (
    <>
      <div className="pm-detail-summary">
        <div><span>Date</span><strong>{formatDate(selectedInquiry.date) || '—'}</strong></div>
        <div><span>Item</span><strong>{selectedInquiry.itemDescription || '—'}</strong></div>
        <div><span>Category</span><strong>{selectedInquiry.category || '—'}</strong></div>
        <div><span>Sent Through</span><strong>{selectedInquiry.contactVia || '—'}</strong></div>
        <div><span>Quotes</span><strong>{inquiryQuotes.length}</strong></div>
        <div><span>Lowest</span><strong>{money(selectedInquiry.lowestQuote)}</strong></div>
        <div><span>Approved Supplier</span><strong>{selectedInquiry.approvedSupplier || '—'}</strong></div>
        <div><span>Status</span><strong><span className={`pm-pill ${pillFor(selectedInquiry.status)}`}>{selectedInquiry.status || 'Quote Pending'}</span></strong></div>
      </div>
      <div className="pm-detail-bar">
        <div className="esm-tabs">
          {DETAIL_TABS.map((t) => (
            <button key={t.id} type="button" className={`esm-tab ${detailTab === t.id ? 'is-active' : ''}`} onClick={() => setDetailTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="pm-detail-actions">
          <button type="button" className="btn pm-btn-outline" onClick={() => openInquiryForm(selectedInquiry)}><Pencil size={14} /> Edit Inquiry</button>
          <button type="button" className="btn pm-btn-outline" onClick={() => openReceipt(true)}><ArrowDownToLine size={14} /> Receive Stock</button>
        </div>
      </div>
      <div className="pm-detail-body">
        {detailTab === 'quotes' && quotesView}
        {detailTab === 'compare' && compareView}
        {detailTab === 'follow' && followView}
        {detailTab === 'files' && filesView}
        {detailTab === 'po' && poView}
      </div>
    </>
  ) : <p className="pm-empty">Inquiry not found.</p>;

  const MODALS = {
    supplier: { title: editingSupplierId ? 'Edit Supplier' : 'Add New Supplier', body: supplierFormView },
    item: { title: editingItemId ? 'Edit Item' : 'Add New Item', body: itemFormView },
    inquiry: { title: `${editingInquiryId ? 'Edit Inquiry' : 'New Inquiry'} — ${inquiryForm.inquiryNo}`, body: inquiryFormView },
    detail: { title: selectedInquiry ? `${selectedInquiry.inquiryNo} — ${selectedInquiry.itemDescription || ''}` : 'Inquiry', body: detailView },
    receipt: { title: 'Stock Entry / Purchase Receipt', body: receiptFormView },
    issue: { title: 'Stock Issue / Consumption', body: issueFormView }
  };
  const openModal = modal ? MODALS[modal] : null;

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

      <div className="pm-quick-actions">
        <button type="button" className="btn btn-primary" onClick={() => openInquiryForm()}><Plus size={14} /> New Inquiry</button>
        <button type="button" className="btn pm-btn-outline" onClick={() => openSupplier()}><Truck size={14} /> Add Supplier</button>
        <button type="button" className="btn pm-btn-outline" onClick={() => openItem()}><Package size={14} /> Add Item</button>
        <button type="button" className="btn pm-btn-outline" onClick={() => openReceipt()}><ArrowDownToLine size={14} /> Stock Entry</button>
        <button type="button" className="btn pm-btn-outline" onClick={openIssue}><ArrowUpFromLine size={14} /> Stock Issue</button>
      </div>

      <div className="esm-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" className={`esm-tab ${activeTab === t.id ? 'is-active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <Icon size={15} />
              {t.label}
              <span className="pm-tab-count">{tabCounts[t.id]}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'inquiries' && (
        <Panel id="pm-status" className="pm-tab-panel" title="Inquiry Status Dashboard" extra="Click an inquiry to open quotes, follow-ups and PO">
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
                <tr>
                  <th>Sr</th><th>Inquiry No</th><th>Item / Description</th><th>Category</th><th>Date</th><th>Sent Through</th>
                  <th>Quotes</th><th>Lowest</th><th>Approved Supplier</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {statusRows.length === 0 ? (
                  <tr><td colSpan={11} className="pm-empty">No inquiries in this range. Click New Inquiry to add one.</td></tr>
                ) : statusRows.map((r, idx) => (
                  <tr key={r.id} className="pm-click-row" title="Click to open inquiry" onClick={() => openInquiryDetail(r)}>
                    <td>{idx + 1}</td>
                    <td>{r.inquiryNo}</td>
                    <td>{r.itemDescription}</td>
                    <td>{r.category || '—'}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.contactVia || '—'}</td>
                    <td>{r.quotesReceived || 0}</td>
                    <td>{money(r.lowestQuote)}</td>
                    <td>{r.approvedSupplier || '—'}</td>
                    <td><span className={`pm-pill ${pillFor(r.status)}`}>{r.status || 'Quote Pending'}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActions onEdit={() => openInquiryForm(r)} onDelete={() => removeRow('purchaseManagement', r.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'suppliers' && (
        <Panel id="pm-supplier" className="pm-tab-panel" title="Supplier Master" extra="Click a supplier to open details">
          <div className="pm-search pm-tab-search">
            <Search size={14} />
            <input placeholder="Search supplier..." value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
          </div>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Supplier Name</th><th>Contact Person</th><th>Mobile</th><th>Email</th><th>GSTIN</th><th>Items Supplied</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {visibleSuppliers.length === 0 ? (
                  <tr><td colSpan={8} className="pm-empty">No suppliers yet. Click Add Supplier.</td></tr>
                ) : visibleSuppliers.map((s) => (
                  <tr key={s.id} className="pm-click-row" title="Click to open supplier" onClick={() => openSupplier(s)}>
                    <td>{s.supplierName}</td>
                    <td>{s.contactPerson || '—'}</td>
                    <td>{s.mobile || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.gstin || '—'}</td>
                    <td>{s.itemsSupplied || '—'}</td>
                    <td><span className={`pm-pill ${s.status === 'Approved' ? 'is-approved' : 'is-pending'}`}>{s.status}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowActions onEdit={() => openSupplier(s)} onDelete={() => removeRow('purchaseSuppliers', s.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'items' && (
        <Panel id="pm-item" className="pm-tab-panel" title="Item / Material Master" extra="Click an item to open details">
          <div className="pm-search pm-tab-search">
            <Search size={14} />
            <input placeholder="Search item..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
          </div>
          <div className="pm-mini-wrap">
            <table className="pm-mini">
              <thead>
                <tr><th>Item Name</th><th>Category</th><th>Specification</th><th>Unit</th><th>Stock</th><th>Min</th><th>Preferred Supplier</th><th>Last Rate</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr><td colSpan={10} className="pm-empty">No items yet. Click Add Item.</td></tr>
                ) : visibleItems.map((s) => {
                  const low = num(s.currentStock) <= num(s.minimumStock);
                  return (
                    <tr key={s.id} className="pm-click-row" title="Click to open item" onClick={() => openItem(s)}>
                      <td>{s.itemName}</td>
                      <td>{s.category || '—'}</td>
                      <td>{s.specification || '—'}</td>
                      <td>{s.unit || '—'}</td>
                      <td>{s.currentStock || 0}</td>
                      <td>{s.minimumStock || 0}</td>
                      <td>{s.preferredSupplier || '—'}</td>
                      <td>{money(s.lastPurchaseRate)}</td>
                      <td><span className={`pm-pill ${low ? 'is-low' : 'is-approved'}`}>{low ? 'Low Stock' : 'In Stock'}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <RowActions onEdit={() => openItem(s)} onDelete={() => removeRow('purchaseStock', s.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'stock' && (
        <>
          <div className="pm-working">
            <Field label="Item">
              <SearchableSelect className="input-field" value={selectedItem} onChange={(e) => pickItem(e.target.value)} memoryKey="pm-working-item">
                <option value="">All items</option>
                {itemNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </SearchableSelect>
            </Field>
          </div>
          <div className="pm-tab-grid">
            <Panel id="pm-alert" title="Minimum Stock Alert">
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
                        <tr key={s.id} className="pm-click-row" onClick={() => pickItem(s.itemName)}>
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

            <Panel id="pm-history" title="Item Purchase History" extra={selectedItem || 'All items'}>
              <div className="pm-mini-wrap">
                <table className="pm-mini">
                  <thead>
                    <tr><th>Date</th><th>Item</th><th>Supplier</th><th>Qty</th><th>Rate</th><th>Invoice</th></tr>
                  </thead>
                  <tbody>
                    {shownHistory.length === 0 ? (
                      <tr><td colSpan={6} className="pm-empty">No purchases yet.</td></tr>
                    ) : shownHistory.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDate(r.date) || '—'}</td>
                        <td>{r.itemName}</td>
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

            <Panel id="pm-price" title="Price History" extra={selectedItem || 'All items'}>
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

            <Panel id="pm-approved" title="Approved Supplier for Item" extra={selectedItem || 'All items'}>
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
          </div>
        </>
      )}

      {openModal && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card pm-modal-card">
            <div className="pm-modal-head">
              <h2 className="pm-card-title">{openModal.title}</h2>
              <button type="button" className="btn" onClick={closeModal}><X size={14} /> Close</button>
            </div>
            {openModal.body}
          </div>
        </div>
      )}
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
