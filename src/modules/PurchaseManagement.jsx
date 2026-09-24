import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ShoppingCart,
  Calendar,
  Search,
  Download,
  Eye,
  Edit2,
  Trash2,
  Save,
  X,
  FileText,
  MessageSquare,
  GitCompare,
  BadgeCheck,
  Package,
  History,
  ClipboardList,
  Quote,
  Hourglass,
  Users,
  Boxes,
  AlertTriangle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import StatusTabBar from '../components/StatusTabBar';
import { formatDate, getDefaultFiscalYearRange } from '../utils/dateUtils';

const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();
const CATEGORIES = ['Compressor', 'Solar', 'General', 'Electrical', 'Spares', 'Consumables', 'Utilities', 'Services', 'Capital'];
const STATUSES = ['Quote Pending', 'Quotes Received', 'Follow Up', 'Approved', 'Closed'];
const FOLLOW_UPS = ['Pending', 'Follow Up', 'Completed'];

const fiscalLabel = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const nextInquiryNo = (rows, serial) => {
  const label = fiscalLabel();
  const n = String(serial || rows.length + 1).padStart(5, '0');
  return `INQ/${label}/${n}`;
};

const emptyInquiry = (serial = 1, rows = []) => ({
  inquiryNo: nextInquiryNo(rows, serial),
  date: new Date().toISOString().split('T')[0],
  itemDescription: '',
  category: 'General',
  supplierCount: 0,
  quotesReceived: 0,
  followUp: 'Pending',
  status: 'Quote Pending',
  lowestQuote: '',
  approvedSupplier: '',
  remarks: ''
});

const emptyStock = () => ({
  itemName: '',
  category: 'General',
  currentStock: '',
  unit: 'Nos',
  minimumStock: '',
  lastPurchaseDate: '',
  lastPurchaseRate: ''
});

const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const money = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved')) return 'is-approved';
  if (s.includes('quotes received')) return 'is-received';
  if (s.includes('follow')) return 'is-follow';
  if (s.includes('pending')) return 'is-pending';
  if (s.includes('closed')) return 'is-closed';
  if (s.includes('low')) return 'is-low';
  if (s.includes('in stock')) return 'is-instock';
  return '';
};

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const PurchaseManagement = () => {
  const { data, updateData, updateItem, deleteItemSoftly, incrementSerial } = useAppContext();
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);
  const [globalSearch, setGlobalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [listFrom, setListFrom] = useState('');
  const [listTo, setListTo] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [activeAction, setActiveAction] = useState('new');
  const [showForm, setShowForm] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyInquiry());
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockForm, setStockForm] = useState(emptyStock);
  const [editingStockId, setEditingStockId] = useState(null);

  const serial = data.settings?.serials?.INQ || 1;

  const inquiries = useMemo(
    () => (data.purchaseManagement || [])
      .filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [data.purchaseManagement]
  );

  const stockItems = useMemo(
    () => (data.purchaseStock || [])
      .filter((r) => !r.isDeleted)
      .sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || ''))),
    [data.purchaseStock]
  );

  const rangedInquiries = useMemo(
    () => inquiries.filter((r) => inRange(r.date, rangeFrom, rangeTo)),
    [inquiries, rangeFrom, rangeTo]
  );

  const stats = useMemo(() => {
    const total = rangedInquiries.length;
    const quotes = rangedInquiries.filter((r) => (parseInt(r.quotesReceived, 10) || 0) > 0 || r.status === 'Quotes Received' || r.status === 'Approved').length;
    const pendingFollow = rangedInquiries.filter((r) => r.followUp === 'Pending' || r.followUp === 'Follow Up' || r.status === 'Follow Up').length;
    const approved = new Set(
      rangedInquiries.filter((r) => r.approvedSupplier).map((r) => String(r.approvedSupplier).trim().toLowerCase())
    ).size;
    const inStock = stockItems.filter((s) => {
      const cur = parseFloat(s.currentStock) || 0;
      const min = parseFloat(s.minimumStock) || 0;
      return cur > min;
    }).length;
    const lowStock = stockItems.filter((s) => {
      const cur = parseFloat(s.currentStock) || 0;
      const min = parseFloat(s.minimumStock) || 0;
      return cur <= min;
    }).length;
    return { total, quotes, pendingFollow, approved, inStock, lowStock };
  }, [rangedInquiries, stockItems]);

  const isInquiryPending = (r) => r.status !== 'Closed';
  const isInquiryCompleted = (r) => r.status === 'Closed';

  const filtered = useMemo(() => {
    const gq = globalSearch.trim().toLowerCase();
    const lq = listSearch.trim().toLowerCase();
    return rangedInquiries.filter((r) => {
      if (statusTab === 'pending' && !isInquiryPending(r)) return false;
      if (statusTab === 'completed' && !isInquiryCompleted(r)) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (listFrom && r.date < listFrom) return false;
      if (listTo && r.date > listTo) return false;
      const hay = [r.inquiryNo, r.itemDescription, r.category, r.approvedSupplier, r.status, r.followUp]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      if (gq && !hay.includes(gq)) return false;
      if (lq && !hay.includes(lq)) return false;
      return true;
    });
  }, [rangedInquiries, statusTab, statusFilter, categoryFilter, listFrom, listTo, globalSearch, listSearch]);

  const pendingCount = rangedInquiries.filter(isInquiryPending).length;
  const completedCount = rangedInquiries.filter(isInquiryCompleted).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const lowStockRows = useMemo(
    () => stockItems.filter((s) => {
      const cur = parseFloat(s.currentStock) || 0;
      const min = parseFloat(s.minimumStock) || 0;
      return cur <= min;
    }).slice(0, 8),
    [stockItems]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setStockField = (key, value) => setStockForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setActiveAction('new');
    setEditingId(null);
    setViewOnly(false);
    setForm(emptyInquiry(serial, inquiries));
    setShowForm(true);
  };

  const openEdit = (row, readOnly = false) => {
    setActiveAction('new');
    setEditingId(row.id);
    setViewOnly(readOnly);
    setForm({ ...emptyInquiry(serial, inquiries), ...row });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setViewOnly(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (viewOnly) return;
    const payload = {
      ...form,
      supplierCount: parseInt(form.supplierCount, 10) || 0,
      quotesReceived: parseInt(form.quotesReceived, 10) || 0,
      lowestQuote: form.lowestQuote === '' ? '' : parseFloat(form.lowestQuote)
    };
    if (editingId) {
      const existing = inquiries.find((r) => r.id === editingId);
      updateItem('purchaseManagement', editingId, { ...existing, ...payload });
    } else {
      updateData('purchaseManagement', {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
      incrementSerial('INQ');
    }
    closeForm();
    setPage(1);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this inquiry?')) deleteItemSoftly('purchaseManagement', id);
  };

  const openStockCreate = (prefill = {}) => {
    setEditingStockId(null);
    setStockForm({ ...emptyStock(), ...prefill });
    setShowStockForm(true);
  };

  const handleStockSave = (e) => {
    e.preventDefault();
    const payload = { ...stockForm };
    if (editingStockId) {
      const existing = stockItems.find((r) => r.id === editingStockId);
      updateItem('purchaseStock', editingStockId, { ...existing, ...payload });
    } else {
      updateData('purchaseStock', {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
    }
    setShowStockForm(false);
    setEditingStockId(null);
  };

  const createInquiryFromStock = (stock) => {
    setActiveAction('new');
    setEditingId(null);
    setViewOnly(false);
    setForm({
      ...emptyInquiry(serial, inquiries),
      itemDescription: stock.itemName || '',
      category: stock.category || 'General',
      status: 'Quote Pending',
      followUp: 'Pending'
    });
    setShowForm(true);
  };

  const applyQuickAction = (key) => {
    setActiveAction(key);
    setPage(1);
    if (key === 'new') {
      openCreate();
      return;
    }
    if (key === 'list') {
      setStatusFilter('');
      setCategoryFilter('');
      document.getElementById('pm-inquiry-list')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (key === 'follow') {
      setStatusFilter('Follow Up');
      setListSearch('');
      document.getElementById('pm-inquiry-list')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (key === 'compare') {
      setStatusFilter('Quotes Received');
      document.getElementById('pm-inquiry-list')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (key === 'approved') {
      setStatusFilter('Approved');
      document.getElementById('pm-inquiry-list')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (key === 'stock') {
      document.getElementById('pm-stock-overview')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (key === 'history') {
      setStatusFilter('Closed');
      document.getElementById('pm-inquiry-list')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const exportExcel = () => {
    const sheet = filtered.map((r, i) => ({
      'Sr. No': i + 1,
      'Inquiry No.': r.inquiryNo,
      Date: formatDate(r.date),
      'Item / Description': r.itemDescription,
      Category: r.category,
      'Supplier Count': r.supplierCount,
      'Quotes Received': r.quotesReceived,
      'Follow Up': r.followUp,
      Status: r.status,
      'Lowest Quote (₹)': r.lowestQuote,
      'Approved Supplier': r.approvedSupplier,
      Remarks: r.remarks
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Inquiries');
    XLSX.writeFile(wb, 'Purchase_Inquiries.xlsx');
  };

  const statCards = [
    { key: 'total', label: 'Total Inquiries', value: stats.total, sub: 'This Month', icon: ClipboardList, tone: 'purple' },
    { key: 'quotes', label: 'Quotes Received', value: stats.quotes, sub: 'This Month', icon: Quote, tone: 'orange' },
    { key: 'follow', label: 'Pending Follow Up', value: stats.pendingFollow, sub: 'This Month', icon: Hourglass, tone: 'violet' },
    { key: 'approved', label: 'Approved Sellers', value: stats.approved, sub: 'Total', icon: Users, tone: 'green' },
    { key: 'instock', label: 'In Stock Items', value: stats.inStock, sub: 'Total', icon: Boxes, tone: 'teal' },
    { key: 'low', label: 'Low Stock Items', value: stats.lowStock, sub: 'Need Purchase', icon: AlertTriangle, tone: 'pink', dangerSub: true }
  ];

  const quickActions = [
    { key: 'new', label: 'New Inquiry', icon: FileText },
    { key: 'list', label: 'View Inquiry List', icon: ClipboardList },
    { key: 'follow', label: 'Quote Follow Up', icon: MessageSquare },
    { key: 'compare', label: 'Compare Quotes', icon: GitCompare },
    { key: 'approved', label: 'Approved Supplier', icon: BadgeCheck },
    { key: 'stock', label: 'View Stock', icon: Package },
    { key: 'history', label: 'Purchase History', icon: History }
  ];

  return (
    <div className="pm-page purch-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <ShoppingCart size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Purchase Management</h1>
            <p className="page-subtitle">Track your inquiries, quotes, suppliers and stock.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <div className="pm-range">
            <Calendar size={15} />
            <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
            <span>–</span>
            <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
          </div>
          <div className="pm-search purch-global-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search item / Supplier / Inquiry No..."
              value={globalSearch}
              onChange={(e) => { setGlobalSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </header>

      <section className="purch-stats">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.key}
              className={`purch-stat-card tone-${card.tone}`}
              onClick={() => {
                if (card.key === 'low' || card.key === 'instock') applyQuickAction('stock');
                else if (card.key === 'follow') applyQuickAction('follow');
                else if (card.key === 'quotes') applyQuickAction('compare');
                else if (card.key === 'approved') applyQuickAction('approved');
                else applyQuickAction('list');
              }}
            >
              <div className="purch-stat-icon"><Icon size={18} /></div>
              <div className="purch-stat-body">
                <span className="purch-stat-label">{card.label}</span>
                <strong className="purch-stat-value">{card.value}</strong>
                <span className={`purch-stat-sub${card.dangerSub ? ' is-danger' : ''}`}>{card.sub}</span>
              </div>
              <ChevronRight size={16} className="purch-stat-chevron" />
            </button>
          );
        })}
      </section>

      <section className="premium-card pm-card purch-quick-card">
        <h2 className="pm-card-title">⚡ Quick Actions</h2>
        <div className="purch-quick-actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                type="button"
                key={action.key}
                className={`purch-quick-btn${activeAction === action.key ? ' is-active' : ''}`}
                onClick={() => applyQuickAction(action.key)}
              >
                <Icon size={16} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <StatusTabBar
        value={statusTab}
        onChange={(v) => { setStatusTab(v); setPage(1); }}
        allCount={rangedInquiries.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <section id="pm-inquiry-list" className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>📦 Inquiry List</h2>
          <div className="pm-list-tools purch-list-tools">
            <SearchableSelect
              className="input-field"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              placeholder="All Status"
            >
              <option value="">All Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SearchableSelect>
            <SearchableSelect
              className="input-field"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              placeholder="All Categories"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SearchableSelect>
            <DateField
              className="input-field"
              value={listFrom}
              onChange={(e) => { setListFrom(e.target.value); setPage(1); }}
              placeholder="From Date"
            />
            <DateField
              className="input-field"
              value={listTo}
              onChange={(e) => { setListTo(e.target.value); setPage(1); }}
              placeholder="To Date"
            />
            <div className="pm-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={listSearch}
                onChange={(e) => { setListSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={exportExcel}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table purch-table">
            <thead>
              <tr>
                <th>Sr. No</th>
                <th>Inquiry No.</th>
                <th>Date</th>
                <th>Item / Description</th>
                <th>Category</th>
                <th>Supplier Count</th>
                <th>Quotes Received</th>
                <th>Follow Up</th>
                <th>Status</th>
                <th>Lowest Quote (₹)</th>
                <th>Approved Supplier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="pm-empty">
                    No inquiries found. Click <strong>New Inquiry</strong> to add one.
                  </td>
                </tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="purch-inq-no">{r.inquiryNo}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.itemDescription || '—'}</td>
                  <td>{r.category || '—'}</td>
                  <td>{r.supplierCount ?? 0}</td>
                  <td>{r.quotesReceived ?? 0}</td>
                  <td>{r.followUp || '—'}</td>
                  <td>
                    <span className={`purch-badge ${statusClass(r.status)}`}>{r.status || '—'}</span>
                  </td>
                  <td>{money(r.lowestQuote)}</td>
                  <td>{r.approvedSupplier || '—'}</td>
                  <td className="pm-actions">
                    <button type="button" title="View" onClick={() => openEdit(r, true)}><Eye size={14} /></button>
                    <button type="button" title="Edit" onClick={() => openEdit(r, false)}><Edit2 size={14} /></button>
                    <button type="button" title="Delete" className="danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pm-pager">
          <span>
            Showing {filtered.length ? (pageSafe - 1) * PAGE_SIZE + 1 : 0} to {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} records
          </span>
          <div className="pm-pager-btns">
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 6).map((n) => (
              <button type="button" key={n} className={n === pageSafe ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </section>

      <section id="pm-stock-overview" className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>🌷 Stock Overview (Low Stock Alert)</h2>
          <div className="pm-list-tools">
            <button type="button" className="btn pm-btn-outline" onClick={() => openStockCreate()}>
              <Plus size={14} /> Add Stock Item
            </button>
            <button type="button" className="btn purch-link-btn" onClick={() => applyQuickAction('stock')}>
              View All Stock →
            </button>
          </div>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
                <th>Status</th>
                <th>Last Purchase Date</th>
                <th>Last Purchase Rate (₹)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(lowStockRows.length ? lowStockRows : stockItems.slice(0, 8)).length === 0 ? (
                <tr>
                  <td colSpan={8} className="pm-empty">
                    No stock items yet. Add stock items to track low-stock alerts.
                  </td>
                </tr>
              ) : (lowStockRows.length ? lowStockRows : stockItems.slice(0, 8)).map((s) => {
                const cur = parseFloat(s.currentStock) || 0;
                const min = parseFloat(s.minimumStock) || 0;
                const isLow = cur <= min;
                return (
                  <tr key={s.id}>
                    <td>{s.itemName}</td>
                    <td>{s.category}</td>
                    <td>{`${s.currentStock || 0} ${s.unit || 'Nos'}`}</td>
                    <td>{s.minimumStock || 0}</td>
                    <td>
                      <span className={`purch-badge ${isLow ? 'is-low' : 'is-instock'}`}>
                        {isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td>{formatDate(s.lastPurchaseDate) || '—'}</td>
                    <td>{money(s.lastPurchaseRate)}</td>
                    <td>
                      <button type="button" className="btn pm-btn-outline purch-create-inq" onClick={() => createInquiryFromStock(s)}>
                        Create Inquiry
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 920, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>
                {viewOnly ? 'View Inquiry' : editingId ? 'Edit Inquiry' : 'New Inquiry'}
              </h2>
              <button type="button" className="btn" onClick={closeForm}><X size={15} /> Close</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="pm-form-grid pm-form-grid-3">
                <Field label="Inquiry No." required>
                  <input type="text" className="input-field" required value={form.inquiryNo} onChange={(e) => setField('inquiryNo', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Date" required>
                  <DateField className="input-field" required value={form.date} onChange={(e) => setField('date', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Category" required>
                  <SearchableSelect className="input-field" required value={form.category} onChange={(e) => setField('category', e.target.value)} disabled={viewOnly}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Item / Description" required>
                  <input type="text" className="input-field" required value={form.itemDescription} onChange={(e) => setField('itemDescription', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Supplier Count">
                  <input type="number" className="input-field" min="0" value={form.supplierCount} onChange={(e) => setField('supplierCount', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Quotes Received">
                  <input type="number" className="input-field" min="0" value={form.quotesReceived} onChange={(e) => setField('quotesReceived', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Follow Up" required>
                  <SearchableSelect className="input-field" required value={form.followUp} onChange={(e) => setField('followUp', e.target.value)} disabled={viewOnly}>
                    {FOLLOW_UPS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Status" required>
                  <SearchableSelect className="input-field" required value={form.status} onChange={(e) => setField('status', e.target.value)} disabled={viewOnly}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Lowest Quote (₹)">
                  <input type="number" step="any" className="input-field" value={form.lowestQuote} onChange={(e) => setField('lowestQuote', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Approved Supplier">
                  <input type="text" className="input-field" value={form.approvedSupplier} onChange={(e) => setField('approvedSupplier', e.target.value)} disabled={viewOnly} />
                </Field>
                <Field label="Remarks">
                  <input type="text" className="input-field" value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} disabled={viewOnly} />
                </Field>
              </div>
              <div className="pm-form-actions">
                {!viewOnly && (
                  <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
                )}
                <button type="button" className="btn pm-btn-outline" onClick={closeForm}>
                  {viewOnly ? 'Close' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockForm && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>
                {editingStockId ? 'Edit Stock Item' : 'Add Stock Item'}
              </h2>
              <button type="button" className="btn" onClick={() => setShowStockForm(false)}><X size={15} /> Close</button>
            </div>
            <form onSubmit={handleStockSave}>
              <div className="pm-form-grid pm-form-grid-3">
                <Field label="Item Name" required>
                  <input type="text" className="input-field" required value={stockForm.itemName} onChange={(e) => setStockField('itemName', e.target.value)} />
                </Field>
                <Field label="Category" required>
                  <SearchableSelect className="input-field" required value={stockForm.category} onChange={(e) => setStockField('category', e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Unit">
                  <SearchableSelect className="input-field" value={stockForm.unit} onChange={(e) => setStockField('unit', e.target.value)}>
                    {['Nos', 'Pcs', 'Kg', 'Ltr', 'Set', 'MT'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Current Stock" required>
                  <input type="number" step="any" className="input-field" required value={stockForm.currentStock} onChange={(e) => setStockField('currentStock', e.target.value)} />
                </Field>
                <Field label="Minimum Stock" required>
                  <input type="number" step="any" className="input-field" required value={stockForm.minimumStock} onChange={(e) => setStockField('minimumStock', e.target.value)} />
                </Field>
                <Field label="Last Purchase Date">
                  <DateField className="input-field" value={stockForm.lastPurchaseDate} onChange={(e) => setStockField('lastPurchaseDate', e.target.value)} />
                </Field>
                <Field label="Last Purchase Rate (₹)">
                  <input type="number" step="any" className="input-field" value={stockForm.lastPurchaseRate} onChange={(e) => setStockField('lastPurchaseRate', e.target.value)} />
                </Field>
              </div>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => setShowStockForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseManagement;
