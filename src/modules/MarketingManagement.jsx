import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Megaphone,
  Target,
  Save,
  X,
  Edit2,
  Trash2,
  Search,
  Plus,
  Phone,
  Users,
  FileText,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/dateUtils';

const LEAD_SOURCES = ['Website', 'Referral', 'Cold Call', 'Exhibition', 'Email', 'Walk-in', 'Other'];
const LEAD_STATUSES = ['New', 'Contacted', 'Follow Up', 'Qualified', 'Converted', 'Lost'];
const FOLLOW_TYPES = ['Call', 'Meeting', 'Email', 'Visit', 'WhatsApp'];
const FOLLOW_STATUSES = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];
const PAGE_SIZE = 5;

const emptyLead = () => ({
  date: new Date().toISOString().split('T')[0],
  companyName: '',
  contactPerson: '',
  mobile: '',
  email: '',
  source: 'Website',
  status: 'New',
  productInterest: '',
  remarks: ''
});

const emptyFollowUp = () => ({
  leadId: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  type: 'Call',
  status: 'Scheduled',
  notes: ''
});

const emptyEnquiry = () => ({
  leadId: '',
  enquiryNo: '',
  date: new Date().toISOString().split('T')[0],
  product: '',
  qty: '',
  status: 'Open',
  quotationNo: '',
  remarks: ''
});

const emptyOrder = () => ({
  leadId: '',
  enquiryId: '',
  orderNo: '',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  status: 'Confirmed',
  remarks: ''
});

const Panel = ({ no, title, children, right, id }) => (
  <section className="mkt-panel" id={id}>
    <header className="mkt-panel-head">
      <span className="mkt-panel-no">{no}</span>
      <h2>{title}</h2>
      {right || null}
    </header>
    <div className="mkt-panel-body">{children}</div>
  </section>
);

const Field = ({ label, required, children, className = '' }) => (
  <div className={`form-group mkt-field ${className}`}>
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const badgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'new') return 'is-new';
  if (s === 'contacted') return 'is-contacted';
  if (s.includes('follow')) return 'is-follow';
  if (s === 'qualified' || s === 'converted' || s === 'confirmed' || s === 'completed') return 'is-done';
  if (s === 'pending' || s === 'scheduled' || s === 'open') return 'is-pending';
  if (s === 'lost' || s === 'cancelled') return 'is-lost';
  return '';
};

const MarketingManagement = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return undefined;
    const id = location.hash.replace('#', '');
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  const [leadForm, setLeadForm] = useState(emptyLead);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [leadPage, setLeadPage] = useState(1);

  const [followForm, setFollowForm] = useState(emptyFollowUp);
  const [followSearch, setFollowSearch] = useState('');
  const [followPage, setFollowPage] = useState(1);

  const [enquiryForm, setEnquiryForm] = useState(emptyEnquiry);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const leads = useMemo(
    () => (data.marketingLeads || []).filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [data.marketingLeads]
  );

  const followUps = useMemo(
    () => (data.marketingFollowUps || []).filter((r) => !r.isDeleted)
      .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`)),
    [data.marketingFollowUps]
  );

  const enquiries = useMemo(
    () => (data.marketingEnquiries || []).filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [data.marketingEnquiries]
  );

  const orders = useMemo(
    () => (data.marketingOrders || []).filter((r) => !r.isDeleted),
    [data.marketingOrders]
  );

  const leadLabel = (id) => {
    const lead = leads.find((l) => l.id === id);
    return lead ? `${lead.companyName} (${lead.contactPerson || '—'})` : '—';
  };

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return leads.filter((r) => {
      if (leadSourceFilter && r.source !== leadSourceFilter) return false;
      if (leadStatusFilter && r.status !== leadStatusFilter) return false;
      if (!q) return true;
      return [r.companyName, r.contactPerson, r.mobile, r.email, r.source, r.status]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [leads, leadSearch, leadSourceFilter, leadStatusFilter]);

  const leadPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const leadPageSafe = Math.min(leadPage, leadPages);
  const leadRows = filteredLeads.slice((leadPageSafe - 1) * PAGE_SIZE, leadPageSafe * PAGE_SIZE);

  const filteredFollowUps = useMemo(() => {
    const q = followSearch.trim().toLowerCase();
    if (!q) return followUps;
    return followUps.filter((r) => {
      const company = leadLabel(r.leadId).toLowerCase();
      return [company, r.type, r.status, r.notes, r.date].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [followUps, followSearch, leads]);

  const followPages = Math.max(1, Math.ceil(filteredFollowUps.length / PAGE_SIZE));
  const followPageSafe = Math.min(followPage, followPages);
  const followRows = filteredFollowUps.slice((followPageSafe - 1) * PAGE_SIZE, followPageSafe * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter((l) => ['Contacted', 'Follow Up', 'Qualified', 'Converted'].includes(l.status)).length;
    const follow = leads.filter((l) => l.status === 'Follow Up').length;
    const won = leads.filter((l) => l.status === 'Converted').length || orders.length;
    const bySource = LEAD_SOURCES.map((s) => ({
      source: s,
      count: leads.filter((l) => l.source === s).length
    })).filter((x) => x.count > 0);
    return { total, contacted, follow, won, bySource };
  }, [leads, orders]);

  const funnel = useMemo(() => ([
    { label: 'Leads', value: leads.length, color: '#7c3aed' },
    { label: 'Follow Ups', value: followUps.length, color: '#a855f7' },
    { label: 'Enquiries', value: enquiries.length, color: '#c084fc' },
    { label: 'Orders', value: orders.length, color: '#5b1c85' }
  ]), [leads, followUps, enquiries, orders]);

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  const calendarDays = useMemo(() => {
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = followUps.filter((f) => f.date === dateStr);
      cells.push({ day: d, dateStr, items });
    }
    return cells;
  }, [calMonth, followUps]);

  const setLeadField = (key, value) => setLeadForm((prev) => ({ ...prev, [key]: value }));
  const setFollowField = (key, value) => setFollowForm((prev) => ({ ...prev, [key]: value }));
  const setEnquiryField = (key, value) => setEnquiryForm((prev) => ({ ...prev, [key]: value }));
  const setOrderField = (key, value) => setOrderForm((prev) => ({ ...prev, [key]: value }));

  const clearLead = () => {
    setLeadForm(emptyLead());
    setEditingLeadId(null);
  };

  const saveLead = (e) => {
    e.preventDefault();
    if (editingLeadId) {
      const existing = leads.find((l) => l.id === editingLeadId);
      updateItem('marketingLeads', editingLeadId, { ...existing, ...leadForm });
    } else {
      updateData('marketingLeads', {
        ...leadForm,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
    }
    clearLead();
    setLeadPage(1);
  };

  const editLead = (row) => {
    setEditingLeadId(row.id);
    setLeadForm({ ...emptyLead(), ...row });
    document.getElementById('mkt-add-lead')?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteLead = (id) => {
    if (window.confirm('Delete this lead?')) deleteItemSoftly('marketingLeads', id);
  };

  const saveFollowUp = (e) => {
    e.preventDefault();
    if (!followForm.leadId) {
      alert('Please select a lead / company.');
      return;
    }
    updateData('marketingFollowUps', {
      ...followForm,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    const lead = leads.find((l) => l.id === followForm.leadId);
    if (lead && lead.status === 'New') {
      updateItem('marketingLeads', lead.id, { ...lead, status: 'Follow Up' });
    }
    setFollowForm(emptyFollowUp());
    setFollowPage(1);
  };

  const deleteFollowUp = (id) => {
    if (window.confirm('Delete this follow-up?')) deleteItemSoftly('marketingFollowUps', id);
  };

  const saveEnquiry = (e) => {
    e.preventDefault();
    if (!enquiryForm.leadId) {
      alert('Please select a lead to convert.');
      return;
    }
    const enquiryNo = enquiryForm.enquiryNo || `ENQ-${Date.now().toString().slice(-6)}`;
    updateData('marketingEnquiries', {
      ...enquiryForm,
      enquiryNo,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    const lead = leads.find((l) => l.id === enquiryForm.leadId);
    if (lead) updateItem('marketingLeads', lead.id, { ...lead, status: 'Qualified' });
    setEnquiryForm(emptyEnquiry());
  };

  const saveOrder = (e) => {
    e.preventDefault();
    if (!orderForm.leadId) {
      alert('Please select a lead / enquiry.');
      return;
    }
    const orderNo = orderForm.orderNo || `SO-${Date.now().toString().slice(-6)}`;
    updateData('marketingOrders', {
      ...orderForm,
      orderNo,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    const lead = leads.find((l) => l.id === orderForm.leadId);
    if (lead) updateItem('marketingLeads', lead.id, { ...lead, status: 'Converted' });
    setOrderForm(emptyOrder());
  };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const conversionChecks = [
    { label: 'Lead Captured', done: leads.length > 0 },
    { label: 'Follow Up Done', done: followUps.some((f) => f.status === 'Completed') || followUps.length > 0 },
    { label: 'Enquiry Created', done: enquiries.length > 0 },
    { label: 'Quotation / Order', done: orders.length > 0 || enquiries.some((e) => e.quotationNo) }
  ];

  const sourceTotal = Math.max(1, stats.bySource.reduce((s, x) => s + x.count, 0));

  return (
    <div className="mkt-page">
      <header className="mkt-hero">
        <div>
          <div className="mkt-hero-title">
            <Megaphone size={22} />
            <h1>Marketing Management Module</h1>
          </div>
          <p className="mkt-hero-flow">
            Track Leads <span>→</span> Follow Ups <span>→</span> Convert to Enquiries <span>→</span> Grow Your Business
          </p>
        </div>
        <div className="mkt-hero-cta">
          <Target size={18} />
          <div>
            <strong>Never miss a follow-up</strong>
            <span>Schedule calls & meetings on time</span>
          </div>
        </div>
      </header>

      <div className="mkt-grid">
        {/* 1. Add New Lead */}
        <Panel no="1" title="Add New Lead" id="mkt-add-lead">
          <form onSubmit={saveLead} className="mkt-form">
            <div className="mkt-form-grid">
              <Field label="Date" required>
                <DateField className="input-field" required value={leadForm.date} onChange={(e) => setLeadField('date', e.target.value)} />
              </Field>
              <Field label="Company Name" required>
                <input className="input-field" required value={leadForm.companyName} onChange={(e) => setLeadField('companyName', e.target.value)} />
              </Field>
              <Field label="Contact Person" required>
                <input className="input-field" required value={leadForm.contactPerson} onChange={(e) => setLeadField('contactPerson', e.target.value)} />
              </Field>
              <Field label="Mobile" required>
                <input type="tel" className="input-field" required value={leadForm.mobile} onChange={(e) => setLeadField('mobile', e.target.value)} />
              </Field>
              <Field label="Email">
                <input type="email" className="input-field" value={leadForm.email} onChange={(e) => setLeadField('email', e.target.value)} />
              </Field>
              <Field label="Product Interest">
                <input className="input-field" value={leadForm.productInterest} onChange={(e) => setLeadField('productInterest', e.target.value)} />
              </Field>
              <Field label="Status" required>
                <SearchableSelect className="input-field" required value={leadForm.status} onChange={(e) => setLeadField('status', e.target.value)}>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Remarks">
                <input className="input-field" value={leadForm.remarks} onChange={(e) => setLeadField('remarks', e.target.value)} />
              </Field>
            </div>
            <div className="mkt-source-block">
              <span className="mkt-source-label">Lead Source Options</span>
              <div className="mkt-source-options">
                {LEAD_SOURCES.map((src) => (
                  <label key={src} className={`mkt-chip${leadForm.source === src ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="leadSource"
                      checked={leadForm.source === src}
                      onChange={() => setLeadField('source', src)}
                    />
                    {src}
                  </label>
                ))}
              </div>
            </div>
            <div className="mkt-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> {editingLeadId ? 'Update Lead' : 'Save'}</button>
              {editingLeadId ? (
                <button type="button" className="btn mkt-btn-outline" onClick={clearLead}><X size={14} /> Cancel</button>
              ) : null}
            </div>
          </form>
        </Panel>

        {/* 2. View / Manage Leads */}
        <Panel no="2" title="View / Manage Leads" id="mkt-leads">
          <div className="mkt-toolbar">
            <div className="pm-search">
              <Search size={14} />
              <input placeholder="Search leads..." value={leadSearch} onChange={(e) => { setLeadSearch(e.target.value); setLeadPage(1); }} />
            </div>
            <SearchableSelect className="input-field" value={leadSourceFilter} onChange={(e) => { setLeadSourceFilter(e.target.value); setLeadPage(1); }} placeholder="Source">
              <option value="">All Sources</option>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SearchableSelect>
            <SearchableSelect className="input-field" value={leadStatusFilter} onChange={(e) => { setLeadStatusFilter(e.target.value); setLeadPage(1); }} placeholder="Status">
              <option value="">All Status</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SearchableSelect>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table mkt-table">
              <thead>
                <tr>
                  <th>SL.No</th>
                  <th>Date</th>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Mobile</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leadRows.length === 0 ? (
                  <tr><td colSpan={8} className="pm-empty">No leads yet. Add a lead in panel 1.</td></tr>
                ) : leadRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td>{(leadPageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.companyName}</td>
                    <td>{r.contactPerson}</td>
                    <td>{r.mobile}</td>
                    <td>{r.source}</td>
                    <td><span className={`mkt-badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                    <td className="pm-actions">
                      <button type="button" title="Edit" onClick={() => editLead(r)}><Edit2 size={14} /></button>
                      <button type="button" title="Delete" className="danger" onClick={() => deleteLead(r.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pm-pager">
            <span>Showing {filteredLeads.length ? (leadPageSafe - 1) * PAGE_SIZE + 1 : 0}–{Math.min(leadPageSafe * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}</span>
            <div className="pm-pager-btns">
              {Array.from({ length: leadPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
                <button type="button" key={n} className={n === leadPageSafe ? 'active' : ''} onClick={() => setLeadPage(n)}>{n}</button>
              ))}
            </div>
          </div>
        </Panel>

        {/* 3. Schedule Follow Up */}
        <Panel no="3" title="Schedule Follow Up" id="mkt-schedule">
          <form onSubmit={saveFollowUp} className="mkt-form">
            <div className="mkt-form-grid">
              <Field label="Lead / Company" required>
                <SearchableSelect className="input-field" required value={followForm.leadId} onChange={(e) => setFollowField('leadId', e.target.value)} placeholder="Select lead">
                  <option value="">Select lead</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.companyName} — {l.contactPerson}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Date" required>
                <DateField className="input-field" required value={followForm.date} onChange={(e) => setFollowField('date', e.target.value)} />
              </Field>
              <Field label="Time" required>
                <TimeField className="input-field" required value={followForm.time} onChange={(e) => setFollowField('time', e.target.value)} />
              </Field>
              <Field label="Follow Up Type" required>
                <SearchableSelect className="input-field" required value={followForm.type} onChange={(e) => setFollowField('type', e.target.value)}>
                  {FOLLOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Status" required>
                <SearchableSelect className="input-field" required value={followForm.status} onChange={(e) => setFollowField('status', e.target.value)}>
                  {FOLLOW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Notes">
                <input className="input-field" value={followForm.notes} onChange={(e) => setFollowField('notes', e.target.value)} />
              </Field>
            </div>
            <div className="mkt-form-actions">
              <button type="submit" className="btn btn-primary"><Save size={14} /> Save</button>
              <button type="button" className="btn mkt-btn-outline" onClick={() => setFollowForm(emptyFollowUp())}>Cancel</button>
            </div>
          </form>
        </Panel>

        {/* 4. Follow Up History */}
        <Panel no="4" title="Follow Up History" id="mkt-follow-history">
          <div className="mkt-toolbar">
            <div className="pm-search">
              <Search size={14} />
              <input placeholder="Search follow-ups..." value={followSearch} onChange={(e) => { setFollowSearch(e.target.value); setFollowPage(1); }} />
            </div>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table mkt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {followRows.length === 0 ? (
                  <tr><td colSpan={7} className="pm-empty">No follow-ups scheduled yet.</td></tr>
                ) : followRows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.time || '—'}</td>
                    <td>{leadLabel(r.leadId)}</td>
                    <td>{r.type}</td>
                    <td><span className={`mkt-badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                    <td>{r.notes || '—'}</td>
                    <td className="pm-actions">
                      <button type="button" title="Delete" className="danger" onClick={() => deleteFollowUp(r.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pm-pager">
            <span>{filteredFollowUps.length} records</span>
            <div className="pm-pager-btns">
              {Array.from({ length: followPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
                <button type="button" key={n} className={n === followPageSafe ? 'active' : ''} onClick={() => setFollowPage(n)}>{n}</button>
              ))}
            </div>
          </div>
        </Panel>

        {/* 5. Convert to Enquiry */}
        <Panel no="5" title="Convert to Enquiry" id="mkt-convert-enquiry">
          <div className="mkt-split">
            <form onSubmit={saveEnquiry} className="mkt-form">
              <div className="mkt-form-grid mkt-form-grid-1">
                <Field label="Select Lead" required>
                  <SearchableSelect className="input-field" required value={enquiryForm.leadId} onChange={(e) => setEnquiryField('leadId', e.target.value)} placeholder="Select lead">
                    <option value="">Select lead</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.companyName} — {l.contactPerson}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Enquiry No.">
                  <input className="input-field" placeholder="Auto if blank" value={enquiryForm.enquiryNo} onChange={(e) => setEnquiryField('enquiryNo', e.target.value)} />
                </Field>
                <Field label="Date" required>
                  <DateField className="input-field" required value={enquiryForm.date} onChange={(e) => setEnquiryField('date', e.target.value)} />
                </Field>
                <Field label="Product / Requirement" required>
                  <input className="input-field" required value={enquiryForm.product} onChange={(e) => setEnquiryField('product', e.target.value)} />
                </Field>
                <Field label="Approx Qty">
                  <input className="input-field" value={enquiryForm.qty} onChange={(e) => setEnquiryField('qty', e.target.value)} />
                </Field>
                <Field label="Remarks">
                  <input className="input-field" value={enquiryForm.remarks} onChange={(e) => setEnquiryField('remarks', e.target.value)} />
                </Field>
              </div>
              <div className="mkt-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={14} /> Convert</button>
              </div>
            </form>
            <aside className="mkt-flow-card">
              <h3>Conversion Flow</h3>
              <ol className="mkt-flow">
                <li><Users size={15} /> Lead</li>
                <li><Phone size={15} /> Follow Up</li>
                <li><FileText size={15} /> Enquiry</li>
                <li><BadgeCheck size={15} /> Quotation</li>
              </ol>
            </aside>
          </div>
        </Panel>

        {/* 6. Enquiries & Quotations */}
        <Panel
          no="6"
          title="Enquiries & Quotations"
          id="mkt-enquiries"
          right={(
            <button type="button" className="btn btn-primary mkt-panel-btn" onClick={() => scrollTo('mkt-convert-enquiry')}>
              <Plus size={14} /> Add Quotation
            </button>
          )}
        >
          <div className="pm-table-wrap">
            <table className="pm-table mkt-table">
              <thead>
                <tr>
                  <th>Enquiry No.</th>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Quotation No.</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 ? (
                  <tr><td colSpan={7} className="pm-empty">No enquiries converted yet.</td></tr>
                ) : enquiries.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className="purch-inq-no">{r.enquiryNo}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{leadLabel(r.leadId)}</td>
                    <td>{r.product}</td>
                    <td>{r.qty || '—'}</td>
                    <td><span className={`mkt-badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                    <td>{r.quotationNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* 7. Conversion to Order */}
        <Panel no="7" title="Conversion to Order / Business" id="mkt-order">
          <div className="mkt-split">
            <form onSubmit={saveOrder} className="mkt-form">
              <div className="mkt-form-grid mkt-form-grid-1">
                <Field label="Lead / Company" required>
                  <SearchableSelect className="input-field" required value={orderForm.leadId} onChange={(e) => setOrderField('leadId', e.target.value)} placeholder="Select lead">
                    <option value="">Select lead</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.companyName}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Linked Enquiry">
                  <SearchableSelect className="input-field" value={orderForm.enquiryId} onChange={(e) => setOrderField('enquiryId', e.target.value)} placeholder="Optional">
                    <option value="">Optional</option>
                    {enquiries.filter((en) => !orderForm.leadId || en.leadId === orderForm.leadId).map((en) => (
                      <option key={en.id} value={en.id}>{en.enquiryNo} — {en.product}</option>
                    ))}
                  </SearchableSelect>
                </Field>
                <Field label="Order No.">
                  <input className="input-field" placeholder="Auto if blank" value={orderForm.orderNo} onChange={(e) => setOrderField('orderNo', e.target.value)} />
                </Field>
                <Field label="Date" required>
                  <DateField className="input-field" required value={orderForm.date} onChange={(e) => setOrderField('date', e.target.value)} />
                </Field>
                <Field label="Order Amount (₹)">
                  <input type="number" step="any" className="input-field" value={orderForm.amount} onChange={(e) => setOrderField('amount', e.target.value)} />
                </Field>
                <Field label="Remarks">
                  <input className="input-field" value={orderForm.remarks} onChange={(e) => setOrderField('remarks', e.target.value)} />
                </Field>
              </div>
              <div className="mkt-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={14} /> Confirm Order</button>
              </div>
            </form>
            <aside className="mkt-check-card">
              <h3>Conversion Status</h3>
              <ul className="mkt-checklist">
                {conversionChecks.map((c) => (
                  <li key={c.label} className={c.done ? 'is-done' : ''}>
                    {c.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Panel>

        {/* 8. Reports & Analytics */}
        <Panel no="8" title="Reports & Analytics" id="mkt-reports">
          <div className="mkt-kpi-row">
            <div className="mkt-kpi tone-a"><span>Total Leads</span><strong>{stats.total}</strong></div>
            <div className="mkt-kpi tone-b"><span>Contacted</span><strong>{stats.contacted}</strong></div>
            <div className="mkt-kpi tone-c"><span>Follow Up</span><strong>{stats.follow}</strong></div>
            <div className="mkt-kpi tone-d"><span>Closed / Won</span><strong>{stats.won}</strong></div>
          </div>
          <div className="mkt-charts">
            <div className="mkt-chart-box">
              <h4>Lead Source</h4>
              {stats.bySource.length === 0 ? (
                <p className="pm-muted">No source data yet.</p>
              ) : (
                <div className="mkt-donut-wrap">
                  <div
                    className="mkt-donut"
                    style={{
                      background: `conic-gradient(${stats.bySource.map((s, i) => {
                        const colors = ['#5b1c85', '#7c3aed', '#a855f7', '#c084fc', '#ddd6fe', '#f5d0fe', '#f9a8d4'];
                        const start = stats.bySource.slice(0, i).reduce((a, x) => a + (x.count / sourceTotal) * 100, 0);
                        const end = start + (s.count / sourceTotal) * 100;
                        return `${colors[i % colors.length]} ${start}% ${end}%`;
                      }).join(', ')})`
                    }}
                  />
                  <ul className="mkt-legend">
                    {stats.bySource.map((s) => (
                      <li key={s.source}><span>{s.source}</span><strong>{s.count}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mkt-chart-box">
              <h4>Conversion Funnel</h4>
              <div className="mkt-funnel">
                {funnel.map((f) => (
                  <div key={f.label} className="mkt-funnel-row">
                    <span>{f.label}</span>
                    <div className="mkt-funnel-bar-wrap">
                      <div className="mkt-funnel-bar" style={{ width: `${(f.value / maxFunnel) * 100}%`, background: f.color }} />
                    </div>
                    <strong>{f.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* 9. Calendar View */}
        <Panel
          no="9"
          title="Calendar View"
          id="mkt-calendar"
          right={(
            <input
              type="month"
              className="input-field mkt-month-input"
              value={calMonth}
              onChange={(e) => setCalMonth(e.target.value)}
            />
          )}
        >
          <div className="mkt-cal-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="mkt-cal-dow">{d}</div>
            ))}
            {calendarDays.map((cell, idx) => (
              <div key={idx} className={`mkt-cal-cell${cell?.items?.length ? ' has-items' : ''}${cell ? '' : ' is-empty'}`}>
                {cell ? (
                  <>
                    <span className="mkt-cal-day">{cell.day}</span>
                    {cell.items.slice(0, 2).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mkt-cal-event"
                        title={`${item.time || ''} ${leadLabel(item.leadId)} — ${item.type}`}
                        onClick={() => scrollTo('mkt-follow-history')}
                      >
                        {item.time || item.type}
                      </button>
                    ))}
                    {cell.items.length > 2 ? <span className="mkt-cal-more">+{cell.items.length - 2}</span> : null}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <footer className="mkt-footer">
        <div className="mkt-footer-steps">
          {[
            { id: 'mkt-add-lead', label: 'Add Lead', icon: Users },
            { id: 'mkt-schedule', label: 'Follow Up', icon: Phone },
            { id: 'mkt-convert-enquiry', label: 'Convert to Enquiry', icon: FileText },
            { id: 'mkt-order', label: 'Convert to Order', icon: BadgeCheck },
            { id: 'mkt-reports', label: 'Reports', icon: Megaphone },
            { id: 'mkt-calendar', label: 'Calendar', icon: CalendarDays }
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button type="button" key={s.id} className="mkt-footer-step" onClick={() => scrollTo(s.id)}>
                <Icon size={14} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        <ul className="mkt-footer-checks">
          {conversionChecks.map((c) => (
            <li key={c.label} className={c.done ? 'is-done' : ''}>
              {c.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {c.label}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
};

export default MarketingManagement;
