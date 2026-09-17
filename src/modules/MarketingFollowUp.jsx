import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone,
  Search,
  Calendar,
  Plus,
  Users,
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageCircle,
  ChevronRight,
  FileText,
  BarChart3,
  UserPlus,
  CalendarDays,
  X,
  Save,
  Bell
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/dateUtils';

const FOLLOW_TYPES = ['Call', 'Meeting', 'Email', 'Visit', 'WhatsApp'];
const FOLLOW_STATUSES = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];
const LEAD_SOURCES = ['Website', 'Referral', 'Cold Call', 'Exhibition', 'Email', 'Walk-in', 'Other'];

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyLead = () => ({
  date: todayStr(),
  companyName: '',
  contactPerson: '',
  mobile: '',
  email: '',
  source: 'Website',
  status: 'New',
  productInterest: '',
  remarks: ''
});

const emptyFollow = () => ({
  leadId: '',
  date: todayStr(),
  time: new Date().toTimeString().slice(0, 5),
  type: 'Call',
  status: 'Scheduled',
  notes: ''
});

const Field = ({ label, required, children }) => (
  <div className="form-group mkt-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const typeIcon = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('whats')) return MessageCircle;
  if (t.includes('email') || t.includes('mail')) return Mail;
  if (t.includes('meet') || t.includes('visit')) return Users;
  return Phone;
};

const typeClass = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('whats')) return 'is-whatsapp';
  if (t.includes('email') || t.includes('mail')) return 'is-email';
  if (t.includes('meet')) return 'is-meeting';
  if (t.includes('visit')) return 'is-visit';
  return 'is-call';
};

const MarketingFollowUp = () => {
  const { data, updateData, updateItem } = useAppContext();
  const [search, setSearch] = useState('');
  const [focusDate, setFocusDate] = useState(todayStr());
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showFollowForm, setShowFollowForm] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [followForm, setFollowForm] = useState(emptyFollow);
  const [quickFilter, setQuickFilter] = useState('all');

  const leads = useMemo(
    () => (data.marketingLeads || []).filter((r) => !r.isDeleted),
    [data.marketingLeads]
  );

  const followUps = useMemo(
    () => (data.marketingFollowUps || []).filter((r) => !r.isDeleted)
      .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`)),
    [data.marketingFollowUps]
  );

  const leadById = (id) => leads.find((l) => l.id === id);

  const leadLabel = (id) => {
    const lead = leadById(id);
    return lead ? lead.companyName : 'Unknown Lead';
  };

  const contactOf = (id) => {
    const lead = leadById(id);
    return lead ? (lead.contactPerson || '—') : '—';
  };

  const mobileOf = (id) => {
    const lead = leadById(id);
    return lead ? (lead.mobile || '—') : '—';
  };

  const q = search.trim().toLowerCase();

  const matchesSearch = (f) => {
    if (!q) return true;
    const lead = leadById(f.leadId);
    return [lead?.companyName, lead?.contactPerson, lead?.mobile, f.type, f.status, f.notes, f.date]
      .some((v) => String(v || '').toLowerCase().includes(q));
  };

  const openFollowUps = useMemo(
    () => followUps.filter((f) => f.status !== 'Completed' && f.status !== 'Cancelled'),
    [followUps]
  );

  const todayFollowUps = useMemo(
    () => openFollowUps.filter((f) => f.date === focusDate && matchesSearch(f)),
    [openFollowUps, focusDate, search, leads]
  );

  const overdueFollowUps = useMemo(
    () => openFollowUps.filter((f) => f.date && f.date < todayStr() && matchesSearch(f)),
    [openFollowUps, search, leads]
  );

  const upcomingFollowUps = useMemo(
    () => openFollowUps.filter((f) => f.date && f.date > focusDate && matchesSearch(f)).slice(0, 8),
    [openFollowUps, focusDate, search, leads]
  );

  const pendingFollowUps = useMemo(
    () => openFollowUps.filter((f) => (f.status === 'Pending' || f.status === 'Scheduled') && matchesSearch(f)).slice(0, 8),
    [openFollowUps, search, leads]
  );

  const completedToday = useMemo(
    () => followUps.filter((f) => f.status === 'Completed' && f.date === focusDate).length,
    [followUps, focusDate]
  );

  const stats = [
    { key: 'total', label: 'Total Leads', value: leads.length, tone: 'blue', icon: Users },
    { key: 'today', label: "Today's Follow Ups", value: todayFollowUps.length, tone: 'yellow', icon: Phone },
    { key: 'overdue', label: 'Overdue', value: overdueFollowUps.length, tone: 'pink', icon: AlertTriangle, alert: overdueFollowUps.length > 0 },
    { key: 'pending', label: 'Pending', value: pendingFollowUps.length, tone: 'green', icon: Clock },
    { key: 'done', label: 'Completed Today', value: completedToday, tone: 'lavender', icon: CheckCircle2 },
    { key: 'upcoming', label: 'Upcoming', value: upcomingFollowUps.length, tone: 'grey', icon: CalendarDays }
  ];

  const recentActivity = useMemo(() => {
    const items = [...followUps]
      .sort((a, b) => String(b.createdAt || `${b.date}T${b.time || '00:00'}`).localeCompare(String(a.createdAt || `${a.date}T${a.time || '00:00'}`)))
      .slice(0, 6)
      .map((f) => ({
        id: f.id,
        text: f.status === 'Completed'
          ? `Completed follow-up with ${leadLabel(f.leadId)}`
          : `Scheduled ${f.type} for ${leadLabel(f.leadId)}`,
        time: f.createdAt
          ? new Date(f.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : `${formatDate(f.date)} ${f.time || ''}`.trim(),
        tone: f.status === 'Completed' ? 'green' : 'blue'
      }));
    return items;
  }, [followUps, leads]);

  const listForFilter = () => {
    if (quickFilter === 'today') return todayFollowUps;
    if (quickFilter === 'overdue') return overdueFollowUps;
    if (quickFilter === 'pending') return pendingFollowUps;
    if (quickFilter === 'upcoming') return upcomingFollowUps;
    return todayFollowUps;
  };

  const markDone = (row) => {
    updateItem('marketingFollowUps', row.id, {
      ...row,
      status: 'Completed',
      completedAt: new Date().toISOString()
    });
    const lead = leadById(row.leadId);
    if (lead && ['New', 'Follow Up'].includes(lead.status)) {
      updateItem('marketingLeads', lead.id, { ...lead, status: 'Contacted' });
    }
  };

  const saveLead = (e) => {
    e.preventDefault();
    updateData('marketingLeads', {
      ...leadForm,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    setLeadForm(emptyLead());
    setShowLeadForm(false);
  };

  const saveFollow = (e) => {
    e.preventDefault();
    if (!followForm.leadId) {
      alert('Please select a lead.');
      return;
    }
    updateData('marketingFollowUps', {
      ...followForm,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    });
    const lead = leadById(followForm.leadId);
    if (lead && lead.status === 'New') {
      updateItem('marketingLeads', lead.id, { ...lead, status: 'Follow Up' });
    }
    setFollowForm(emptyFollow());
    setShowFollowForm(false);
  };

  const openSchedule = (leadId = '') => {
    setFollowForm({ ...emptyFollow(), leadId, date: focusDate });
    setShowFollowForm(true);
  };

  const renderFollowTable = (rows, emptyText) => (
    <div className="pm-table-wrap">
      <table className="fu-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Mobile</th>
            <th>Time</th>
            <th>Type</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="pm-empty">{emptyText}</td></tr>
          ) : rows.map((r) => {
            const TypeIcon = typeIcon(r.type);
            return (
              <tr key={r.id}>
                <td className="fu-company">{leadLabel(r.leadId)}</td>
                <td>{contactOf(r.leadId)}</td>
                <td>{mobileOf(r.leadId)}</td>
                <td>{r.time || '—'}</td>
                <td>
                  <span className={`fu-type-badge ${typeClass(r.type)}`}>
                    <TypeIcon size={12} />
                    {r.type}
                  </span>
                </td>
                <td>
                  <span className={`fu-status-badge ${r.status === 'Pending' ? 'is-pending' : r.date < todayStr() ? 'is-overdue' : 'is-scheduled'}`}>
                    {r.date < todayStr() && r.status !== 'Completed' ? 'Overdue' : r.status}
                  </span>
                </td>
                <td>
                  <button type="button" className="fu-done-btn" onClick={() => markDone(r)}>
                    Mark Done <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const filteredMain = listForFilter();
  const mainTitle = quickFilter === 'overdue'
    ? 'Overdue Follow Ups'
    : quickFilter === 'pending'
      ? 'Pending Follow Ups'
      : quickFilter === 'upcoming'
        ? 'Upcoming Follow Ups'
        : "Today's Follow Ups";

  return (
    <div className="fu-page">
      <header className="fu-header">
        <div className="fu-title-wrap">
          <Megaphone size={22} className="fu-title-icon" />
          <div>
            <h1>Marketing Follow Up</h1>
            <p>Track daily calls, meetings and never miss a lead follow-up.</p>
          </div>
        </div>
        <div className="fu-header-actions">
          <div className="pm-search fu-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search company, contact, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="fu-date-chip">
            <Calendar size={15} />
            <DateField className="input-field" value={focusDate} onChange={(e) => setFocusDate(e.target.value || todayStr())} />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowLeadForm(true)}>
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </header>

      <section className="fu-stats">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              type="button"
              key={s.key}
              className={`fu-stat tone-${s.tone}`}
              onClick={() => setQuickFilter(s.key === 'total' ? 'all' : s.key === 'done' ? 'today' : s.key === 'today' ? 'today' : s.key)}
            >
              <div className="fu-stat-icon"><Icon size={18} /></div>
              <div className="fu-stat-body">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
              {s.alert ? <Bell size={14} className="fu-stat-alert" /> : null}
            </button>
          );
        })}
      </section>

      <div className="fu-layout">
        <div className="fu-main">
          <section className="fu-section">
            <header className="fu-section-head">
              <h2>{mainTitle}</h2>
              <span className="fu-count">{filteredMain.length}</span>
            </header>
            <div className="fu-section-body">
              {renderFollowTable(
                quickFilter === 'all' ? todayFollowUps : filteredMain,
                quickFilter === 'overdue'
                  ? 'No overdue follow-ups. Great job!'
                  : 'No follow-ups for this view. Schedule one from Quick Actions.'
              )}
            </div>
          </section>

          <section className="fu-section">
            <header className="fu-section-head">
              <h2>Pending & Upcoming</h2>
              <span className="fu-count">{pendingFollowUps.length + upcomingFollowUps.length}</span>
            </header>
            <div className="fu-section-body">
              {renderFollowTable(
                [...overdueFollowUps.slice(0, 3), ...pendingFollowUps.filter((p) => !overdueFollowUps.some((o) => o.id === p.id))].slice(0, 8),
                'No pending follow-ups right now.'
              )}
            </div>
          </section>
        </div>

        <aside className="fu-side">
          <section className="fu-side-card">
            <h3>Quick View & Actions</h3>
            <div className="fu-quick-list">
              {[
                { key: 'today', label: "Today's Follow Ups", summary: `${todayFollowUps.length} follow ups`, tone: 'yellow', icon: Phone },
                { key: 'overdue', label: 'Overdue', summary: `${overdueFollowUps.length} overdue`, tone: 'pink', icon: AlertTriangle },
                { key: 'pending', label: 'Pending Queue', summary: `${pendingFollowUps.length} pending`, tone: 'green', icon: Clock },
                { key: 'upcoming', label: 'Upcoming', summary: `${upcomingFollowUps.length} scheduled`, tone: 'blue', icon: CalendarDays }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`fu-quick-item tone-${item.tone}${quickFilter === item.key ? ' is-active' : ''}`}
                    onClick={() => setQuickFilter(item.key)}
                  >
                    <div className="fu-quick-icon"><Icon size={16} /></div>
                    <div className="fu-quick-text">
                      <strong>{item.label}</strong>
                      <span>{item.summary}</span>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="fu-side-card">
            <h3>Quick Actions</h3>
            <div className="fu-action-grid">
              <button type="button" onClick={() => setShowLeadForm(true)}>
                <UserPlus size={18} />
                <span>Add Lead</span>
              </button>
              <button type="button" onClick={() => openSchedule()}>
                <Phone size={18} />
                <span>Schedule</span>
              </button>
              <Link to="/marketing#mkt-reports">
                <BarChart3 size={18} />
                <span>Reports</span>
              </Link>
              <Link to="/marketing">
                <FileText size={18} />
                <span>All Leads</span>
              </Link>
            </div>
          </section>

          <section className="fu-side-card">
            <h3>Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="fu-empty-side">No recent activity yet.</p>
            ) : (
              <ul className="fu-activity">
                {recentActivity.map((a) => (
                  <li key={a.id}>
                    <span className={`fu-dot tone-${a.tone}`} />
                    <div>
                      <p>{a.text}</p>
                      <time>{a.time}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {showLeadForm && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>Add Lead</h2>
              <button type="button" className="btn" onClick={() => setShowLeadForm(false)}><X size={15} /> Close</button>
            </div>
            <form onSubmit={saveLead}>
              <div className="pm-form-grid pm-form-grid-2">
                <Field label="Company Name" required>
                  <input className="input-field" required value={leadForm.companyName} onChange={(e) => setLeadForm((p) => ({ ...p, companyName: e.target.value }))} />
                </Field>
                <Field label="Contact Person" required>
                  <input className="input-field" required value={leadForm.contactPerson} onChange={(e) => setLeadForm((p) => ({ ...p, contactPerson: e.target.value }))} />
                </Field>
                <Field label="Mobile" required>
                  <input type="tel" className="input-field" required value={leadForm.mobile} onChange={(e) => setLeadForm((p) => ({ ...p, mobile: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <input type="email" className="input-field" value={leadForm.email} onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))} />
                </Field>
                <Field label="Source" required>
                  <SearchableSelect className="input-field" required value={leadForm.source} onChange={(e) => setLeadForm((p) => ({ ...p, source: e.target.value }))}>
                    {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Product Interest">
                  <input className="input-field" value={leadForm.productInterest} onChange={(e) => setLeadForm((p) => ({ ...p, productInterest: e.target.value }))} />
                </Field>
              </div>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> Save Lead</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => setShowLeadForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFollowForm && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>Schedule Follow Up</h2>
              <button type="button" className="btn" onClick={() => setShowFollowForm(false)}><X size={15} /> Close</button>
            </div>
            <form onSubmit={saveFollow}>
              <div className="pm-form-grid pm-form-grid-2">
                <Field label="Lead / Company" required>
                  <SearchableSelect className="input-field" required value={followForm.leadId} onChange={(e) => setFollowForm((p) => ({ ...p, leadId: e.target.value }))} placeholder="Select lead">
                    <option value="">Select lead</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.companyName} — {l.contactPerson}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Type" required>
                  <SearchableSelect className="input-field" required value={followForm.type} onChange={(e) => setFollowForm((p) => ({ ...p, type: e.target.value }))}>
                    {FOLLOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Date" required>
                  <DateField className="input-field" required value={followForm.date} onChange={(e) => setFollowForm((p) => ({ ...p, date: e.target.value }))} />
                </Field>
                <Field label="Time" required>
                  <TimeField className="input-field" required value={followForm.time} onChange={(e) => setFollowForm((p) => ({ ...p, time: e.target.value }))} />
                </Field>
                <Field label="Status" required>
                  <SearchableSelect className="input-field" required value={followForm.status} onChange={(e) => setFollowForm((p) => ({ ...p, status: e.target.value }))}>
                    {FOLLOW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Notes">
                  <input className="input-field" value={followForm.notes} onChange={(e) => setFollowForm((p) => ({ ...p, notes: e.target.value }))} />
                </Field>
              </div>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => setShowFollowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingFollowUp;
