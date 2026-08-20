import React, { useMemo, useState } from 'react';
import {
  Search,
  Eye,
  ArrowLeft,
  FileDown,
  Mail,
  Phone,
  MessageSquare,
  IndianRupee,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  History,
  Handshake
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatDate } from '../utils/dateUtils';
import ExportButton from '../components/ExportButton';
import {
  buildCustomerOutstanding,
  buildOutstandingInvoices,
  followUpsDueOn,
  promisesDueOnOrBefore,
  moneyINR,
  money,
  todayISO,
  addDaysISO
} from '../utils/paymentFollowUpData';
import {
  buildPaymentFollowUpStatementHtml,
  renderPaymentFollowUpStatementPdf
} from '../utils/paymentFollowUpPdf';
import { applyPrintPrefsToHtml } from '../utils/printPrefs';
import { promptPrintPrefs } from '../utils/promptPrintPrefs';

const FILTER_STATUS = [
  { key: 'all', label: 'All Status' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'due_today', label: 'Follow-Up Due Today' },
  { key: 'due_tomorrow', label: 'Follow-Up Due Tomorrow' },
  { key: 'promised', label: 'Has Promise' }
];

const emptyFollowForm = (customer, invoices = []) => ({
  date: todayISO(),
  method: 'Phone',
  status: 'Called',
  invoiceNos: invoices.map((i) => i.invoiceNo).join(', '),
  outstandingAmount: invoices.reduce((s, i) => s + (i.outstanding || 0), 0),
  nextFollowUpDate: addDaysISO(todayISO(), 3),
  remarks: ''
});

const emptyPromiseForm = (customer) => ({
  partyId: customer?.partyId || '',
  partyName: customer?.partyName || '',
  promiseDate: addDaysISO(todayISO(), 7),
  promiseAmount: customer?.outstandingAmount || 0,
  remarks: ''
});

const StatCard = ({ label, value, icon: Icon, accent }) => (
  <div className="premium-card" style={{ padding: '1.1rem 1.25rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
      <Icon size={15} /> {label}
    </div>
    <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.4rem', color: accent || 'var(--text-main)' }}>
      {value}
    </div>
  </div>
);

const ModalShell = ({ title, onClose, children, width = '720px' }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, backdropFilter: 'blur(4px)', padding: '1.5rem' }}>
    <div className="premium-card" style={{ width, maxWidth: '96%', maxHeight: '92vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h2>
        <button type="button" className="btn" style={{ padding: '0.25rem 0.6rem' }} onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const PaymentFollowUp = () => {
  const { data, updateData } = useAppContext();
  const [view, setView] = useState('dashboard'); // dashboard | customers | detail | history
  const [asOnDate, setAsOnDate] = useState(todayISO());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfHtml, setPdfHtml] = useState('');
  const [statementPrintPrefs, setStatementPrintPrefs] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [followForm, setFollowForm] = useState(emptyFollowForm());
  const [promiseForm, setPromiseForm] = useState(emptyPromiseForm());
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '', body: '' });

  const customers = useMemo(
    () => buildCustomerOutstanding(data, asOnDate),
    [data, asOnDate]
  );
  const allInvoices = useMemo(
    () => buildOutstandingInvoices(data, asOnDate),
    [data, asOnDate]
  );

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const dueToday = useMemo(() => followUpsDueOn(customers, today), [customers, today]);
  const dueTomorrow = useMemo(() => followUpsDueOn(customers, tomorrow), [customers, tomorrow]);
  const promises = data.paymentPromises || [];
  const promisesDue = useMemo(
    () => promisesDueOnOrBefore(promises, today).map((p) => ({
      ...p,
      partyName: p.partyName || customers.find((c) => c.partyId === p.partyId)?.partyName || '—'
    })),
    [promises, today, customers]
  );

  const summary = useMemo(() => {
    const overdueInvoices = allInvoices.filter((i) => i.overdue).length;
    const partyMasterCount = (data.parties || []).filter((p) => !p.isDeleted).length;
    const fromCustomers = customers.reduce((s, c) => s + (parseFloat(c.outstandingAmount) || 0), 0);
    const fromInvoices = allInvoices.reduce((s, i) => s + (parseFloat(i.outstanding) || 0), 0);
    return {
      totalCustomers: partyMasterCount,
      totalOutstanding: fromCustomers > 0.01 ? fromCustomers : fromInvoices,
      pendingInvoices: allInvoices.length,
      overdueInvoices
    };
  }, [customers, allInvoices, data.parties]);

  const promisedPartyIds = useMemo(
    () => new Set((promises || []).filter((p) => !p.cleared).map((p) => p.partyId)),
    [promises]
  );

  const filteredCustomers = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter === 'overdue' && c.overdueAmount < 0.01) return false;
      if (statusFilter === 'due_today' && c.nextFollowUp !== today) return false;
      if (statusFilter === 'due_tomorrow' && c.nextFollowUp !== tomorrow) return false;
      if (statusFilter === 'promised' && !promisedPartyIds.has(c.partyId)) return false;
      if (!s) return true;
      return (
        c.partyName.toLowerCase().includes(s) ||
        (c.phone || '').includes(s) ||
        (c.email || '').toLowerCase().includes(s)
      );
    });
  }, [customers, searchTerm, statusFilter, today, tomorrow, promisedPartyIds]);

  const selectedCustomer = useMemo(() => {
    if (!selectedPartyId) return null;
    return customers.find((c) => String(c.partyId) === String(selectedPartyId))
      || customers.find((c) => c.partyName === selectedPartyId)
      || null;
  }, [customers, selectedPartyId]);

  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    if ((selectedCustomer.invoices || []).length > 0) return selectedCustomer.invoices;
    // Party Due override-only: show one synthetic pending line so amounts are visible
    if ((selectedCustomer.outstandingAmount || 0) > 0.01) {
      return [{
        id: `override-${selectedCustomer.partyId}`,
        invoiceNo: 'Party Due (Manual)',
        invoiceDate: asOnDate,
        invoiceAmount: selectedCustomer.outstandingAmount,
        paidAmount: 0,
        tdsAmount: 0,
        outstanding: selectedCustomer.outstandingAmount,
        ageDays: 0,
        overdue: false
      }];
    }
    return [];
  }, [selectedCustomer, asOnDate]);

  const selectedInvoices = customerInvoices.filter((i) => selectedInvoiceIds.includes(i.id));
  const selectedOutstanding = selectedInvoices.reduce((s, i) => s + i.outstanding, 0);

  const customerHistory = useMemo(() => {
    if (!selectedPartyId) return [];
    return (data.paymentFollowUps || [])
      .filter((f) => String(f.partyId) === String(selectedPartyId))
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [data.paymentFollowUps, selectedPartyId]);

  const openCustomer = (partyId) => {
    const cust = customers.find((c) => String(c.partyId) === String(partyId))
      || customers.find((c) => c.partyName === partyId);
    setSelectedPartyId(cust?.partyId || partyId);
    const invs = (cust?.invoices || []).length
      ? cust.invoices
      : ((cust?.outstandingAmount || 0) > 0.01
        ? [{ id: `override-${cust.partyId}` }]
        : []);
    setSelectedInvoiceIds(invs.map((i) => i.id));
    setView('detail');
  };

  const toggleInvoice = (id) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllInvoices = () => {
    if (selectedInvoiceIds.length === customerInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(customerInvoices.map((i) => i.id));
    }
  };

  const buildStatementInvoices = () =>
    (selectedInvoices.length ? selectedInvoices : customerInvoices);

  const openPdfPreview = async () => {
    if (!selectedCustomer) return;
    const printPrefs = await promptPrintPrefs({ mode: 'view', docType: 'Payment Follow-Up' });
    if (!printPrefs) return;
    setStatementPrintPrefs(printPrefs);
    const invoices = buildStatementInvoices();
    const html = applyPrintPrefsToHtml(
      buildPaymentFollowUpStatementHtml({
        customer: selectedCustomer,
        invoices,
        asOnDate,
        profileInput: data.companyProfile
      }),
      printPrefs
    ).replace('<body', '<body class="uma-print-root"');
    setPdfHtml(html);
    setPdfOpen(true);
  };

  const downloadStatementPdf = async () => {
    if (!selectedCustomer) return;
    // Reuse font/size from preview when available; otherwise ask on download
    let printPrefs = statementPrintPrefs;
    if (!printPrefs) {
      printPrefs = await promptPrintPrefs({ mode: 'save', docType: 'Payment Follow-Up' });
      if (!printPrefs) return;
      setStatementPrintPrefs(printPrefs);
    }
    await renderPaymentFollowUpStatementPdf({
      customer: selectedCustomer,
      invoices: buildStatementInvoices(),
      asOnDate,
      companyProfile: data.companyProfile,
      mode: 'save',
      printPrefs
    });
  };

  const openEmailModal = () => {
    if (!selectedCustomer) return;
    const invoices = buildStatementInvoices();
    const total = invoices.reduce((s, i) => s + i.outstanding, 0);
    const tableText = invoices
      .map((i) => `${i.invoiceNo} | ${formatDate(i.invoiceDate)} | Outstanding ₹ ${money(i.outstanding)}`)
      .join('\n');
    setEmailForm({
      to: selectedCustomer.email || '',
      cc: data.companyProfile?.email || '',
      subject: `Payment Follow-up - Outstanding Invoices - ${selectedCustomer.partyName}`,
      body:
        `Dear Sir/Madam,\n\n` +
        `Please find below the outstanding payment summary for ${selectedCustomer.partyName} as on ${formatDate(asOnDate)}.\n\n` +
        `${tableText}\n\n` +
        `Total Outstanding: ₹ ${money(total)}\n\n` +
        `Kindly arrange payment at the earliest.\n\n` +
        `Regards,\n${data.companyProfile?.companyName || 'UMA MICRON'}`
    });
    setEmailOpen(true);
  };

  const sendEmail = () => {
    if (!emailForm.to.trim()) {
      alert('Please enter recipient email (To).');
      return;
    }
    const mailto = `mailto:${encodeURIComponent(emailForm.to)}`
      + (emailForm.cc ? `?cc=${encodeURIComponent(emailForm.cc)}&` : '?')
      + `subject=${encodeURIComponent(emailForm.subject)}`
      + `&body=${encodeURIComponent(emailForm.body)}`;
    window.open(mailto, '_blank');
    // Log automatic follow-up entry for email send
    updateData('paymentFollowUps', {
      id: Date.now().toString(),
      partyId: selectedCustomer.partyId,
      partyName: selectedCustomer.partyName,
      date: todayISO(),
      method: 'Email',
      status: 'Email Sent',
      invoiceNos: buildStatementInvoices().map((i) => i.invoiceNo).join(', '),
      outstandingAmount: selectedOutstanding || selectedCustomer.outstandingAmount,
      nextFollowUpDate: addDaysISO(todayISO(), 3),
      remarks: 'Statement emailed via Payment Follow-Up module.'
    });
    setEmailOpen(false);
    alert('Email composer opened. Attach the downloaded PDF before sending.');
  };

  const openFollowModal = () => {
    if (!selectedCustomer) return;
    setFollowForm(emptyFollowForm(selectedCustomer, buildStatementInvoices()));
    setFollowOpen(true);
  };

  const saveFollowUp = (e) => {
    e.preventDefault();
    updateData('paymentFollowUps', {
      id: Date.now().toString(),
      partyId: selectedCustomer.partyId,
      partyName: selectedCustomer.partyName,
      date: followForm.date,
      method: followForm.method,
      status: followForm.status,
      invoiceNos: followForm.invoiceNos,
      outstandingAmount: parseFloat(followForm.outstandingAmount) || 0,
      nextFollowUpDate: followForm.nextFollowUpDate,
      remarks: followForm.remarks
    });
    setFollowOpen(false);
  };

  const openPromiseModal = (customer = selectedCustomer) => {
    setPromiseForm(emptyPromiseForm(customer || { partyId: '', partyName: '', outstandingAmount: 0 }));
    setPromiseOpen(true);
  };

  const savePromise = (e) => {
    e.preventDefault();
    if (!promiseForm.partyId && !promiseForm.partyName) {
      alert('Select a customer.');
      return;
    }
    updateData('paymentPromises', {
      id: Date.now().toString(),
      partyId: promiseForm.partyId,
      partyName: promiseForm.partyName,
      promiseDate: promiseForm.promiseDate,
      promiseAmount: parseFloat(promiseForm.promiseAmount) || 0,
      remarks: promiseForm.remarks,
      createdAt: todayISO(),
      cleared: false
    });
    setPromiseOpen(false);
  };

  const customerExportCols = [
    { label: 'Customer Name', key: 'partyName' },
    { label: 'Pending Invoices', key: 'pendingInvoices' },
    { label: 'Outstanding Amount', key: 'outstandingAmount' },
    { label: 'Overdue Amount', key: 'overdueAmount' },
    { label: 'Last Follow-Up', key: 'lastFollowUp' },
    { label: 'Next Follow-Up', key: 'nextFollowUp' }
  ];

  const renderMiniList = (title, items, emptyText) => (
    <div className="premium-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
        <button type="button" className="btn" style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }} onClick={() => setView('customers')}>
          View All
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: 260, overflowY: 'auto' }}>
        {items.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emptyText}</div>}
        {items.slice(0, 8).map((item) => (
          <button
            key={item.partyId || item.id}
            type="button"
            onClick={() => openCustomer(item.partyId)}
            style={{
              textAlign: 'left',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '0.65rem 0.75rem',
              cursor: 'pointer',
              color: 'var(--text-main)'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.partyName}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {moneyINR(item.outstandingAmount ?? item.promiseAmount)}
              {item.promiseDate ? ` · Promise ${formatDate(item.promiseDate)}` : ''}
              {item.nextFollowUp ? ` · Next ${formatDate(item.nextFollowUp)}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  /* ───────── VIEW: DASHBOARD ───────── */
  const renderDashboard = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <StatCard label="Total Customers" value={summary.totalCustomers} icon={Users} />
        <StatCard label="Total Outstanding" value={moneyINR(summary.totalOutstanding)} icon={IndianRupee} />
        <StatCard label="Pending Invoices" value={summary.pendingInvoices} icon={FileSpreadsheet} />
        <StatCard label="Overdue Invoices" value={summary.overdueInvoices} icon={AlertCircle} accent="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        {renderMiniList('Follow-Up Due Today', dueToday, 'No follow-ups due today.')}
        {renderMiniList('Follow-Up Due Tomorrow', dueTomorrow, 'No follow-ups due tomorrow.')}
        {renderMiniList('Payment Promises Due', promisesDue, 'No payment promises due.')}
      </div>

      <div className="premium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Customers with Pending Amount</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <ExportButton data={customers} columns={customerExportCols} filename="Pending_Customers" title="Customers with Pending Amount" />
            <button type="button" className="btn btn-primary" onClick={() => setView('customers')}>Customer Wise List</button>
            <button type="button" className="btn" onClick={() => openPromiseModal(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Handshake size={14} /> Add Promise
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Pending Invoices</th>
                <th>Outstanding Amount</th>
                <th>Last Follow-Up</th>
                <th>Next Follow-Up</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.partyId || c.partyName}>
                  <td style={{ fontWeight: 600 }}>{c.partyName}</td>
                  <td>{c.pendingInvoices || c.invoices?.length || 0}</td>
                  <td style={{ fontWeight: 700, color: '#ef4444' }}>{moneyINR(c.outstandingAmount)}</td>
                  <td>{c.lastFollowUp ? formatDate(c.lastFollowUp) : '—'}</td>
                  <td>{c.nextFollowUp ? formatDate(c.nextFollowUp) : '—'}</td>
                  <td>
                    <button type="button" title="View" onClick={() => openCustomer(c.partyId || c.partyName)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.75rem', color: 'var(--text-muted)' }}>No pending amounts found. Check Tax Invoices / Processing Sheet outstanding.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  /* ───────── VIEW: CUSTOMER LIST ───────── */
  const renderCustomers = () => (
    <div className="premium-card">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: '2rem' }} placeholder="Search Customer" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</label>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {FILTER_STATUS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>As On Date</label>
          <input type="date" className="input-field" value={asOnDate} onChange={(e) => setAsOnDate(e.target.value)} />
        </div>
        <ExportButton data={filteredCustomers} columns={customerExportCols} filename="Customer_Wise_Outstanding" title="Customer Wise Outstanding" />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Pending Invoices</th>
              <th>Outstanding Amount</th>
              <th>Overdue Amount</th>
              <th>Last Follow-Up</th>
              <th>Next Follow-Up</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.partyId}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.partyName}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {c.phone && <span style={{ marginRight: 8 }}><Phone size={11} style={{ display: 'inline' }} /> {c.phone}</span>}
                    {c.email && <span><Mail size={11} style={{ display: 'inline' }} /> {c.email}</span>}
                  </div>
                </td>
                <td>{c.pendingInvoices}</td>
                <td style={{ fontWeight: 600 }}>{moneyINR(c.outstandingAmount)}</td>
                <td style={{ color: c.overdueAmount > 0 ? '#ef4444' : undefined }}>{moneyINR(c.overdueAmount)}</td>
                <td>{c.lastFollowUp ? formatDate(c.lastFollowUp) : '—'}</td>
                <td>{c.nextFollowUp ? formatDate(c.nextFollowUp) : '—'}</td>
                <td>
                  <button type="button" title="View invoices" onClick={() => openCustomer(c.partyId)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No customers matched.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700 }}>TOTAL</td>
              <td style={{ fontWeight: 700 }}>{filteredCustomers.reduce((s, c) => s + c.pendingInvoices, 0)}</td>
              <td style={{ fontWeight: 700 }}>{moneyINR(filteredCustomers.reduce((s, c) => s + c.outstandingAmount, 0))}</td>
              <td style={{ fontWeight: 700 }}>{moneyINR(filteredCustomers.reduce((s, c) => s + c.overdueAmount, 0))}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  /* ───────── VIEW: CUSTOMER DETAIL ───────── */
  const renderDetail = () => {
    if (!selectedCustomer) return null;
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <button type="button" className="btn" onClick={() => setView('customers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ArrowLeft size={14} /> Back
            </button>
            <h2 style={{ margin: 0 }}>{selectedCustomer.partyName}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={openPdfPreview} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileDown size={14} /> Generate PDF</button>
            <button type="button" className="btn" onClick={openEmailModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> Send Email</button>
            <button type="button" className="btn btn-primary" onClick={openFollowModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MessageSquare size={14} /> Record Follow-Up</button>
            <button type="button" className="btn" onClick={() => setView('history')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><History size={14} /> History</button>
            <button type="button" className="btn" onClick={() => openPromiseModal(selectedCustomer)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Handshake size={14} /> Promise</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <StatCard label="Total Pending Invoices" value={selectedCustomer.pendingInvoices} icon={FileSpreadsheet} />
          <StatCard label="Total Outstanding" value={moneyINR(selectedCustomer.outstandingAmount)} icon={IndianRupee} accent="#ef4444" />
        </div>

        <div className="premium-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={selectedInvoiceIds.length === customerInvoices.length && customerInvoices.length > 0} onChange={toggleAllInvoices} />
                  </th>
                  <th>Invoice No.</th>
                  <th>Invoice Date</th>
                  <th>Invoice Amount</th>
                  <th>Paid Amount</th>
                  <th>TDS Amount</th>
                  <th>Outstanding</th>
                  <th>Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {customerInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><input type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} onChange={() => toggleInvoice(inv.id)} /></td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{inv.invoiceNo}</td>
                    <td>{formatDate(inv.invoiceDate)}</td>
                    <td>{moneyINR(inv.invoiceAmount)}</td>
                    <td>{moneyINR(inv.paidAmount)}</td>
                    <td>{moneyINR(inv.tdsAmount)}</td>
                    <td style={{ fontWeight: 700 }}>{moneyINR(inv.outstanding)}</td>
                    <td>
                      <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: inv.overdue ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
                        color: inv.overdue ? '#ef4444' : '#16a34a'
                      }}>
                        {inv.ageDays ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem', fontWeight: 700 }}>
            Total Selected Outstanding: {moneyINR(selectedOutstanding)}
          </div>
        </div>
      </>
    );
  };

  /* ───────── VIEW: HISTORY ───────── */
  const renderHistory = () => (
    <div className="premium-card">
      <button type="button" className="btn" onClick={() => setView('detail')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
        <ArrowLeft size={14} /> Back
      </button>
      <h2 style={{ marginTop: 0 }}>Follow-Up History — {selectedCustomer?.partyName}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Follow-Up Date</th>
              <th>Method</th>
              <th>Invoices</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Next Follow-Up</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {customerHistory.map((f) => (
              <tr key={f.id}>
                <td>{formatDate(f.date)}</td>
                <td>{f.method || '—'}</td>
                <td style={{ maxWidth: 220 }}>{f.invoiceNos || '—'}</td>
                <td>{moneyINR(f.outstandingAmount)}</td>
                <td>{f.status || '—'}</td>
                <td>{f.nextFollowUpDate ? formatDate(f.nextFollowUpDate) : '—'}</td>
                <td>{f.remarks || f.note || '—'}</td>
              </tr>
            ))}
            {customerHistory.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No follow-up history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Payment Follow-Up</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
            Outstanding tracking, statements, email, follow-ups & payment promises.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ borderRadius: 999, background: view === 'dashboard' ? 'var(--accent-primary)' : 'transparent', color: view === 'dashboard' ? '#fff' : undefined, border: '1px solid var(--border-color)' }} onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button type="button" className="btn" style={{ borderRadius: 999, background: view === 'customers' || view === 'detail' || view === 'history' ? 'var(--accent-primary)' : 'transparent', color: (view === 'customers' || view === 'detail' || view === 'history') ? '#fff' : undefined, border: '1px solid var(--border-color)' }} onClick={() => setView('customers')}>
            Customer Wise
          </button>
        </div>
      </header>

      {view === 'dashboard' && renderDashboard()}
      {view === 'customers' && renderCustomers()}
      {view === 'detail' && renderDetail()}
      {view === 'history' && renderHistory()}

      {/* PDF Preview Modal */}
      {pdfOpen && (
        <ModalShell title="Payment Follow-Up Statement — Preview" onClose={() => setPdfOpen(false)} width="860px">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button type="button" className="btn btn-primary" onClick={downloadStatementPdf} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileDown size={14} /> Download PDF
            </button>
            <button
              type="button"
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => {
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(pdfHtml);
                  w.document.close();
                  w.focus();
                  w.print();
                }
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            <iframe title="statement-preview" srcDoc={pdfHtml} style={{ width: '100%', height: '70vh', border: 'none' }} />
          </div>
        </ModalShell>
      )}

      {/* Email Modal */}
      {emailOpen && (
        <ModalShell title="Send Email — Payment Follow-Up" onClose={() => setEmailOpen(false)} width="700px">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label>To</label>
              <input className="input-field" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} />
            </div>
            <div>
              <label>CC</label>
              <input className="input-field" value={emailForm.cc} onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })} />
            </div>
            <div>
              <label>Subject</label>
              <input className="input-field" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
            </div>
            <div>
              <label>Email Body</label>
              <textarea className="input-field" rows={10} value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Attachment: Download the PDF first, then attach it in your email client.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn" onClick={() => setEmailOpen(false)}>Cancel</button>
              <button type="button" className="btn" onClick={downloadStatementPdf}>Download PDF</button>
              <button type="button" className="btn btn-primary" onClick={sendEmail}>Send Email</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Record Follow-Up Modal */}
      {followOpen && (
        <ModalShell title="Record Follow-Up Details" onClose={() => setFollowOpen(false)} width="640px">
          <form onSubmit={saveFollowUp} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label>Follow-Up Date</label>
              <input type="date" className="input-field" required value={followForm.date} onChange={(e) => setFollowForm({ ...followForm, date: e.target.value })} />
            </div>
            <div>
              <label>Method</label>
              <select className="input-field" value={followForm.method} onChange={(e) => setFollowForm({ ...followForm, method: e.target.value })}>
                <option>Phone</option>
                <option>Email</option>
                <option>Meeting</option>
                <option>WhatsApp</option>
                <option>Visit</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select className="input-field" value={followForm.status} onChange={(e) => setFollowForm({ ...followForm, status: e.target.value })}>
                <option>Called</option>
                <option>Email Sent</option>
                <option>No Response</option>
                <option>Promised</option>
                <option>Partial Paid</option>
                <option>Disputed</option>
              </select>
            </div>
            <div>
              <label>Next Follow-Up Date</label>
              <input type="date" className="input-field" value={followForm.nextFollowUpDate} onChange={(e) => setFollowForm({ ...followForm, nextFollowUpDate: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Invoice(s) Followed</label>
              <input className="input-field" value={followForm.invoiceNos} onChange={(e) => setFollowForm({ ...followForm, invoiceNos: e.target.value })} />
            </div>
            <div>
              <label>Outstanding Amount</label>
              <input type="number" step="any" className="input-field" value={followForm.outstandingAmount} onChange={(e) => setFollowForm({ ...followForm, outstandingAmount: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Remarks</label>
              <textarea className="input-field" rows={3} value={followForm.remarks} onChange={(e) => setFollowForm({ ...followForm, remarks: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn" onClick={() => setFollowOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Follow-Up</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Payment Promise Modal */}
      {promiseOpen && (
        <ModalShell title="Payment Promise" onClose={() => setPromiseOpen(false)} width="520px">
          <form onSubmit={savePromise} style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label>Customer</label>
              <select
                className="input-field"
                required
                value={promiseForm.partyId}
                onChange={(e) => {
                  const c = customers.find((x) => x.partyId === e.target.value);
                  setPromiseForm({
                    ...promiseForm,
                    partyId: e.target.value,
                    partyName: c?.partyName || '',
                    promiseAmount: c?.outstandingAmount || promiseForm.promiseAmount
                  });
                }}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.partyId} value={c.partyId}>{c.partyName}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Promise Date</label>
              <input type="date" className="input-field" required value={promiseForm.promiseDate} onChange={(e) => setPromiseForm({ ...promiseForm, promiseDate: e.target.value })} />
            </div>
            <div>
              <label>Promise Amount</label>
              <input type="number" step="any" className="input-field" required value={promiseForm.promiseAmount} onChange={(e) => setPromiseForm({ ...promiseForm, promiseAmount: e.target.value })} />
            </div>
            <div>
              <label>Remarks</label>
              <textarea className="input-field" rows={3} value={promiseForm.remarks} onChange={(e) => setPromiseForm({ ...promiseForm, remarks: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn" onClick={() => setPromiseOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Promise</button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};

export default PaymentFollowUp;
