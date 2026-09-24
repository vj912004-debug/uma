import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Fingerprint,
  UserCheck,
  Calculator,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  Circle,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import ExportButton from '../components/ExportButton';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import { formatDate } from '../utils/dateUtils';
import {
  SHIFTS,
  SHIFT_TYPES,
  STATUS_CODES,
  calculateTimes,
  getEffectiveRate,
  getShiftStdHours,
  money,
  monthValue,
  calculateMonthSalary,
  simulateEsslSync,
  summarizeAttendanceDay,
  defaultEsslSettings
} from '../utils/payroll';

const TABS = [
  { id: 'master', label: '1. Employee Master', icon: Users },
  { id: 'essl', label: '2. eSSL Sync', icon: Fingerprint },
  { id: 'attendance', label: '3. Attendance', icon: UserCheck },
  { id: 'calculate', label: '4. Salary Calc', icon: Calculator },
  { id: 'summary', label: '5. Salary Summary', icon: FileSpreadsheet }
];

const statusBadge = (code) => {
  if (code === 'P') return 'is-present';
  if (code === 'A' || code === 'LWP') return 'is-absent';
  if (code === 'HD') return 'is-half';
  return 'is-leave';
};

const emptyMasterForm = () => ({
  userId: '',
  esslId: '',
  shiftType: '9hr',
  perDayRate: '',
  otRate: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  active: true
});

const EmployeeSalaryManagement = ({ defaultTab = 'master' }) => {
  const { data, updateData, updateItem, deleteItemSoftly, setData } = useAppContext();
  const { currentUser, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;

  const setTab = (id) => {
    setSearchParams({ tab: id }, { replace: true });
  };

  useEffect(() => {
    if (!searchParams.get('tab') && defaultTab) {
      setSearchParams({ tab: defaultTab }, { replace: true });
    }
  }, [defaultTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const allStaff = useMemo(() => (data.users || []).filter((u) => u.active !== false), [data.users]);
  const payrollUsers = useMemo(
    () => (data.users || []).filter((u) => u.role !== 'Admin' || Number(u.perDayRate) > 0 || u.esslId),
    [data.users]
  );
  const departments = [...new Set((data.users || []).map((u) => u.department).filter(Boolean))];
  const attendance = useMemo(() => (data.attendance || []).filter((r) => !r.isDeleted), [data.attendance]);
  const essl = { ...defaultEsslSettings(), ...(data.esslSettings || {}) };

  /* ── Master state ── */
  const [masterForm, setMasterForm] = useState(emptyMasterForm());
  const [editingUserId, setEditingUserId] = useState(null);
  const [historyUserId, setHistoryUserId] = useState(null);
  const [masterSearch, setMasterSearch] = useState('');

  /* ── Attendance state ── */
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    employee: '',
    department: '',
    status: ''
  });
  const [attModal, setAttModal] = useState(false);
  const [attEditing, setAttEditing] = useState(null);
  const [attForm, setAttForm] = useState({
    userId: '',
    date: new Date().toISOString().slice(0, 10),
    shift: 'Day',
    inTime: '09:00',
    outTime: '18:00',
    statusCode: 'P',
    remark: '',
    isHalfDay: false
  });
  const [syncBusy, setSyncBusy] = useState(false);

  /* ── Salary state ── */
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(monthValue());
  const [calculated, setCalculated] = useState(false);
  const [payStatus, setPayStatus] = useState({});

  const historyUser = (data.users || []).find((u) => String(u.id) === String(historyUserId));
  const selectedUser = (data.users || []).find((u) => String(u.id) === String(employeeId));

  const filteredMaster = payrollUsers.filter((u) => {
    if (!masterSearch) return true;
    const q = masterSearch.toLowerCase();
    return [u.name, u.username, u.employeeId, u.esslId, u.department]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const openMasterEdit = (user) => {
    const rate = getEffectiveRate(user);
    setEditingUserId(user.id);
    setHistoryUserId(user.id);
    setMasterForm({
      userId: String(user.id),
      esslId: user.esslId || '',
      shiftType: user.shiftType === '12hr' ? '12hr' : '9hr',
      perDayRate: rate.perDayRate || '',
      otRate: rate.otRate || '',
      effectiveFrom: rate.effectiveFrom || new Date().toISOString().slice(0, 10),
      active: user.active !== false
    });
  };

  const saveMaster = (e) => {
    e.preventDefault();
    const user = (data.users || []).find((u) => String(u.id) === String(masterForm.userId || editingUserId));
    if (!user) {
      alert('Select an employee.');
      return;
    }
    if (!masterForm.effectiveFrom) {
      alert('Effective From date is required.');
      return;
    }
    const perDayRate = Number(masterForm.perDayRate) || 0;
    const otRate = Number(masterForm.otRate) || 0;
    const history = Array.isArray(user.rateHistory) ? [...user.rateHistory] : [];
    const existingIdx = history.findIndex((h) => h.effectiveFrom === masterForm.effectiveFrom);
    const entry = {
      id: existingIdx >= 0 ? history[existingIdx].id : `rh-${user.id}-${Date.now()}`,
      effectiveFrom: masterForm.effectiveFrom,
      perDayRate,
      otRate
    };
    if (existingIdx >= 0) history[existingIdx] = entry;
    else history.push(entry);
    history.sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));

    updateItem('users', user.id, {
      ...user,
      esslId: String(masterForm.esslId || '').trim(),
      shiftType: masterForm.shiftType,
      perDayRate,
      otRate,
      effectiveFrom: masterForm.effectiveFrom,
      rateHistory: history,
      active: masterForm.active
    });
    setEditingUserId(null);
    setMasterForm(emptyMasterForm());
    setHistoryUserId(user.id);
  };

  const connectEssl = (connected) => {
    setData((prev) => ({
      ...prev,
      esslSettings: {
        ...defaultEsslSettings(),
        ...(prev.esslSettings || {}),
        connected,
        lastSync: connected ? (prev.esslSettings?.lastSync || null) : prev.esslSettings?.lastSync
      }
    }));
  };

  const syncEssl = async () => {
    if (!essl.connected) {
      alert('Connect to the eSSL device first.');
      return;
    }
    setSyncBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = simulateEsslSync(data.users || [], attendance, 7);
    if (result.records.length) {
      setData((prev) => ({
        ...prev,
        attendance: [...result.records, ...(prev.attendance || [])],
        esslSettings: {
          ...defaultEsslSettings(),
          ...(prev.esslSettings || {}),
          connected: true,
          lastSync: new Date().toISOString()
        }
      }));
    } else {
      setData((prev) => ({
        ...prev,
        esslSettings: {
          ...defaultEsslSettings(),
          ...(prev.esslSettings || {}),
          connected: true,
          lastSync: new Date().toISOString()
        }
      }));
    }
    setSyncBusy(false);
    alert(result.added
      ? `eSSL sync complete.\n${result.added} new punch record(s) imported.`
      : 'eSSL sync complete.\nNo new punch records (already up to date).');
    setTab('attendance');
  };

  const filteredAtt = attendance.filter((r) => {
    if (!isAdmin && String(r.userId) !== String(currentUser?.id)) return false;
    if (filters.dateFrom && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date > filters.dateTo) return false;
    if (filters.employee) {
      const q = filters.employee.toLowerCase();
      if (![r.username, r.employeeId].some((v) => String(v || '').toLowerCase().includes(q))) return false;
    }
    if (filters.department && r.department !== filters.department) return false;
    if (filters.status && r.statusCode !== filters.status) return false;
    return true;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const todayStr = new Date().toISOString().slice(0, 10);
  const daySummary = summarizeAttendanceDay(
    filters.dateFrom || filters.dateTo
      ? filteredAtt
      : attendance.filter((r) => r.date === todayStr)
  );

  const openAttCreate = () => {
    setAttEditing(null);
    const first = allStaff[0];
    const cfg = SHIFT_TYPES[first?.shiftType === '12hr' ? '12hr' : '9hr'];
    setAttForm({
      userId: String(currentUser?.id || first?.id || ''),
      date: todayStr,
      shift: 'Day',
      inTime: cfg.start,
      outTime: cfg.end,
      statusCode: 'P',
      remark: '',
      isHalfDay: false
    });
    setAttModal(true);
  };

  const openAttEdit = (row) => {
    setAttEditing(row.id);
    setAttForm({
      userId: String(row.userId),
      date: row.date,
      shift: row.shift || 'Day',
      inTime: row.inTime || '',
      outTime: row.outTime || '',
      statusCode: row.statusCode || 'P',
      remark: row.remark || '',
      isHalfDay: row.isHalfDay || false
    });
    setAttModal(true);
  };

  const submitAtt = (e) => {
    e.preventDefault();
    const user = (data.users || []).find((u) => String(u.id) === String(attForm.userId));
    if (!user) return;
    let calc = { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };
    if (attForm.statusCode === 'P' || attForm.statusCode === 'HD') {
      calc = calculateTimes(attForm.inTime, attForm.outTime, attForm.shift, getShiftStdHours(user));
    }
    const final = {
      ...attForm,
      username: user.name || user.username,
      employeeId: user.employeeId || 'N/A',
      department: user.department || 'General',
      status: STATUS_CODES[attForm.statusCode],
      totalHours: calc.totalHours,
      otHours: calc.otHours,
      isLate: calc.isLate,
      isEarlyLeave: calc.isEarlyLeave,
      leaveType: ['CL', 'SL', 'PL', 'LWP'].includes(attForm.statusCode) ? attForm.statusCode : '',
      source: attEditing ? undefined : 'manual'
    };
    if (attEditing) updateItem('attendance', attEditing, { ...final, id: attEditing });
    else updateData('attendance', { ...final, id: Date.now().toString(), createdAt: new Date().toISOString() });
    setAttModal(false);
    setAttEditing(null);
  };

  const monthRows = useMemo(() => {
    if (!employeeId || !month) return [];
    return attendance
      .filter((r) => String(r.userId) === String(employeeId) && String(r.date || '').startsWith(month))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [attendance, employeeId, month]);

  const calc = useMemo(
    () => (selectedUser ? calculateMonthSalary(selectedUser, monthRows, month) : null),
    [selectedUser, monthRows, month]
  );

  const handleCalculate = () => {
    if (!employeeId) {
      alert('Please select an employee.');
      return;
    }
    setCalculated(true);
  };

  const saveSalaryReport = () => {
    if (!calculated || !selectedUser || !calc) {
      alert('Calculate salary first.');
      return;
    }
    const report = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      employeeId: selectedUser.id,
      empCode: selectedUser.employeeId,
      employeeName: selectedUser.name || selectedUser.username,
      department: selectedUser.department || '',
      month,
      presentDays: calc.presentDays,
      paidDays: calc.paidDays,
      totalHours: calc.totalHours,
      otHours: calc.otHours,
      perDayRate: calc.perDayRate,
      otRate: calc.otRate,
      basic: calc.basic,
      otAmount: calc.otAmount,
      gross: calc.totalSalary,
      deductions: 0,
      net: calc.totalSalary,
      totalSalary: calc.totalSalary,
      status: payStatus[`${selectedUser.id}-${month}`] || 'Pending',
      rates: { perDayRate: calc.perDayRate, overtimeRate: calc.otRate },
      summary: {
        totalDays: calc.totalDays,
        presentDays: calc.presentDays,
        absentDays: calc.absentDays
      }
    };
    updateData('salaryReports', report);
    alert('Salary summary saved.');
    setTab('summary');
  };

  const reports = useMemo(
    () => (data.salaryReports || []).filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [data.salaryReports]
  );

  const monthSummaryRows = useMemo(() => {
    const staff = (data.users || []).filter((u) => u.active !== false && u.role !== 'Admin');
    return staff.map((u) => {
      const rows = attendance.filter((r) => String(r.userId) === String(u.id) && String(r.date || '').startsWith(month));
      const c = calculateMonthSalary(u, rows, month);
      const key = `${u.id}-${month}`;
      const saved = reports.find((r) => String(r.employeeId) === String(u.id) && r.month === month);
      return {
        user: u,
        ...c,
        status: payStatus[key] || saved?.status || 'Pending'
      };
    }).filter((r) => r.paidDays > 0 || r.otHours > 0 || Number(r.perDayRate) > 0);
  }, [data.users, attendance, month, reports, payStatus]);

  const attExportCols = [
    { label: 'Date', key: 'date' },
    { label: 'Emp. ID', key: 'employeeId' },
    { label: 'Employee Name', key: 'username' },
    { label: 'Department', key: 'department' },
    { label: 'Shift', key: 'shift' },
    { label: 'In Time', key: 'inTime' },
    { label: 'Out Time', key: 'outTime' },
    { label: 'Total Hours', key: 'totalHours' },
    { label: 'OT Hours', key: 'otHours' },
    { label: 'Status', key: 'status' }
  ];

  const summaryExportCols = [
    { label: 'Emp. ID', key: 'empCode' },
    { label: 'Name', key: 'name' },
    { label: 'Department', key: 'department' },
    { label: 'Present Days', key: 'presentDays' },
    { label: 'Total Hours', key: 'totalHours' },
    { label: 'OT Hours', key: 'otHours' },
    { label: 'Per Day Rate', key: 'perDayRate' },
    { label: 'OT Rate', key: 'otRate' },
    { label: 'Total Salary', key: 'totalSalary' },
    { label: 'Status', key: 'status' }
  ];

  const summaryExportData = monthSummaryRows.map((r) => ({
    empCode: r.user.employeeId,
    name: r.user.name || r.user.username,
    department: r.user.department,
    presentDays: r.presentDays,
    totalHours: r.totalHours,
    otHours: r.otHours,
    perDayRate: r.perDayRate,
    otRate: r.otRate,
    totalSalary: r.totalSalary,
    status: r.status
  }));

  return (
    <div className="esm-page">
      <header className="esm-header">
        <div className="att-title-wrap">
          <Calculator size={22} className="att-title-icon" />
          <div>
            <h1>Employee Salary Management – eSSL Integration</h1>
            <p>Attendance from eSSL → Employee-wise Rates → Automatic Salary Calculation → Complete Report</p>
          </div>
        </div>
      </header>

      <nav className="esm-flow no-print">
        <span>Attendance from eSSL</span>
        <ArrowRight size={14} />
        <span>Employee-wise Rates</span>
        <ArrowRight size={14} />
        <span>Automatic Salary Calculation</span>
        <ArrowRight size={14} />
        <span>Complete Report</span>
      </nav>

      <div className="esm-tabs no-print">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`esm-tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── 1. Employee Master ─── */}
      {tab === 'master' && (
        <div className="esm-grid-2">
          <section className="premium-card esm-card">
            <header className="esm-card-head">
              <span className="esm-no">1</span>
              <div>
                <h2>Employee Master</h2>
                <p>Emp. ID, eSSL ID, shift type, per-day & OT rates with effective dates</p>
              </div>
            </header>
            <div className="esm-card-body">
              <div className="esm-toolbar">
                <div className="pm-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={masterSearch}
                    onChange={(e) => setMasterSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="pm-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>Emp. ID</th>
                      <th>eSSL ID</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Shift</th>
                      <th>Per Day (₹)</th>
                      <th>OT / hr (₹)</th>
                      <th>Effective From</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaster.length === 0 ? (
                      <tr><td colSpan={10} className="pm-empty">No employees yet. Edit Staff under Employees, then set rates here.</td></tr>
                    ) : filteredMaster.map((u) => {
                      const rate = getEffectiveRate(u);
                      return (
                        <tr key={u.id} className={historyUserId === u.id ? 'is-highlight' : ''}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.employeeId}</td>
                          <td>{u.esslId || '—'}</td>
                          <td className="att-emp">{u.name || u.username}</td>
                          <td>{u.department || '—'}</td>
                          <td><span className="esm-chip">{u.shiftType || '9hr'}</span></td>
                          <td>{rate.perDayRate ? money(rate.perDayRate) : '—'}</td>
                          <td>{rate.otRate ? money(rate.otRate) : '—'}</td>
                          <td>{rate.effectiveFrom ? formatDate(rate.effectiveFrom) : '—'}</td>
                          <td>
                            <span className={`att-badge ${u.active !== false ? 'is-present' : 'is-absent'}`}>
                              {u.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="pm-actions">
                            <button type="button" title="Edit rates" onClick={() => openMasterEdit(u)}><Edit2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <form className="esm-rate-form" onSubmit={saveMaster}>
                <h3 className="esm-subhead">{editingUserId ? 'Update Rate' : 'Set / Update Rate'}</h3>
                <div className="pm-form-grid pm-form-grid-2">
                  <div className="form-group pm-field">
                    <label>Employee *</label>
                    <SearchableSelect
                      className="input-field"
                      required
                      value={masterForm.userId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const u = (data.users || []).find((x) => String(x.id) === id);
                        if (u) openMasterEdit(u);
                        else setMasterForm({ ...masterForm, userId: id });
                      }}
                    >
                      <option value="">Select employee</option>
                      {(data.users || []).filter((u) => u.active !== false).map((u) => (
                        <option key={u.id} value={String(u.id)}>{u.name || u.username} ({u.employeeId})</option>
                      ))}
                    </SearchableSelect>
                  </div>
                  <div className="form-group pm-field">
                    <label>eSSL ID</label>
                    <input className="input-field" value={masterForm.esslId} onChange={(e) => setMasterForm({ ...masterForm, esslId: e.target.value })} placeholder="Biometric user id" />
                  </div>
                  <div className="form-group pm-field">
                    <label>Shift Type</label>
                    <SearchableSelect className="input-field" value={masterForm.shiftType} onChange={(e) => setMasterForm({ ...masterForm, shiftType: e.target.value })}>
                      <option value="9hr">9hr</option>
                      <option value="12hr">12hr</option>
                    </SearchableSelect>
                  </div>
                  <div className="form-group pm-field">
                    <label>Effective From *</label>
                    <DateField className="input-field" required value={masterForm.effectiveFrom} onChange={(e) => setMasterForm({ ...masterForm, effectiveFrom: e.target.value })} />
                  </div>
                  <div className="form-group pm-field">
                    <label>Per Day Rate (₹)</label>
                    <input type="number" className="input-field" value={masterForm.perDayRate} onChange={(e) => setMasterForm({ ...masterForm, perDayRate: e.target.value })} />
                  </div>
                  <div className="form-group pm-field">
                    <label>OT Rate / hr (₹)</label>
                    <input type="number" className="input-field" value={masterForm.otRate} onChange={(e) => setMasterForm({ ...masterForm, otRate: e.target.value })} />
                  </div>
                </div>
                <p className="esm-note">System picks the correct rate from history using Effective From. Old rates stay intact.</p>
                <div className="pm-form-actions">
                  <button type="submit" className="btn btn-primary">Save Rate</button>
                  <button type="button" className="btn" onClick={() => { setEditingUserId(null); setMasterForm(emptyMasterForm()); }}>Clear</button>
                </div>
              </form>
            </div>
          </section>

          <section className="premium-card esm-card">
            <header className="esm-card-head">
              <span className="esm-no">1b</span>
              <div>
                <h2>Salary Rate History</h2>
                <p>{historyUser ? (historyUser.name || historyUser.username) : 'Select an employee'}</p>
              </div>
            </header>
            <div className="esm-card-body">
              <div className="pm-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>Effective From</th>
                      <th>Per Day Rate</th>
                      <th>OT Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!historyUser || !(historyUser.rateHistory || []).length ? (
                      <tr><td colSpan={3} className="pm-empty">No rate history. Edit an employee to add rates.</td></tr>
                    ) : [...(historyUser.rateHistory || [])]
                      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))
                      .map((h) => (
                        <tr key={h.id || h.effectiveFrom}>
                          <td>{formatDate(h.effectiveFrom)}</td>
                          <td>{money(h.perDayRate)}</td>
                          <td>{money(h.otRate)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ─── 2. eSSL ─── */}
      {tab === 'essl' && (
        <section className="premium-card esm-card esm-essl">
          <header className="esm-card-head">
            <span className="esm-no">2</span>
            <div>
              <h2>eSSL Integration – Attendance Import</h2>
              <p>Attendance auto-fetched from biometric and mapped by eSSL ID → Emp. ID</p>
            </div>
          </header>
          <div className="esm-card-body">
            <div className="esm-essl-status">
              <div className={`esm-conn ${essl.connected ? 'is-on' : 'is-off'}`}>
                {essl.connected ? <Wifi size={20} /> : <WifiOff size={20} />}
                <div>
                  <strong>{essl.connected ? 'Connected' : 'Disconnected'}</strong>
                  <p>{essl.deviceName || 'eSSL Biometric'} · {essl.host || '—'}</p>
                </div>
              </div>
              <div className="esm-essl-meta">
                <span>Last Sync</span>
                <strong>{essl.lastSync ? new Date(essl.lastSync).toLocaleString('en-IN') : 'Never'}</strong>
              </div>
              <div className="esm-essl-actions">
                {!essl.connected ? (
                  <button type="button" className="btn btn-primary" onClick={() => connectEssl(true)}>
                    <Wifi size={15} /> Connect
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={() => connectEssl(false)}>
                    <WifiOff size={15} /> Disconnect
                  </button>
                )}
                <button type="button" className="btn btn-primary" disabled={syncBusy} onClick={syncEssl}>
                  <RefreshCw size={15} className={syncBusy ? 'esm-spin' : ''} />
                  {syncBusy ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>
            <div className="esm-note">
              Employees need an <strong>eSSL ID</strong> in Employee Master. Sync imports the last 7 working days of punches (skips duplicates). Demo mode works without a physical device.
            </div>
            <div className="pm-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Emp. ID</th>
                    <th>eSSL ID</th>
                    <th>Name</th>
                    <th>Mapped</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.users || []).filter((u) => u.active !== false && u.role !== 'Admin').map((u) => (
                    <tr key={u.id}>
                      <td>{u.employeeId}</td>
                      <td>{u.esslId || '—'}</td>
                      <td>{u.name || u.username}</td>
                      <td>
                        {u.esslId
                          ? <span className="att-badge is-present">Ready</span>
                          : <span className="att-badge is-half">Set eSSL ID</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─── 3. Attendance ─── */}
      {tab === 'attendance' && (
        <>
          <header className="att-header no-print" style={{ marginBottom: 0 }}>
            <div className="att-title-wrap">
              <span className="esm-no">3</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#5b1c85' }}>Attendance View / Verification</h2>
                <p style={{ margin: '0.2rem 0 0' }}>Date-wise logs with IN/OUT, hours, OT and daily summary</p>
              </div>
            </div>
            <div className="att-header-actions">
              <button type="button" className="btn" onClick={() => setTab('essl')}>
                <Fingerprint size={15} /> eSSL Sync
              </button>
              <ExportButton
                data={filteredAtt.map((r) => ({ ...r, date: formatDate(r.date), status: r.status || STATUS_CODES[r.statusCode] }))}
                columns={attExportCols}
                filename="Attendance_Register"
                title="Attendance Register"
              />
              <button type="button" className="btn btn-primary" onClick={openAttCreate}>
                <Plus size={15} /> Add Entry
              </button>
            </div>
          </header>

          <div className="esm-att-layout">
            <div className="esm-att-main">
              <section className="premium-card att-filter-card">
                <div className="att-filters">
                  <div className="att-filter-label"><Filter size={15} /> Filters</div>
                  <div className="att-range">
                    <Calendar size={14} />
                    <DateField className="input-field" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                    <span>–</span>
                    <DateField className="input-field" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                  </div>
                  <div className="pm-search">
                    <Search size={14} />
                    <input type="text" placeholder="Employee..." value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} />
                  </div>
                  <SearchableSelect className="input-field" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
                    <option value="">All Departments</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </SearchableSelect>
                  <SearchableSelect className="input-field" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="">All Status</option>
                    {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </SearchableSelect>
                </div>
              </section>

              <section className="premium-card att-table-card">
                <div className="pm-table-wrap">
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Emp. ID</th>
                        <th>Employee Name</th>
                        <th>Department</th>
                        <th>Shift</th>
                        <th>IN</th>
                        <th>OUT</th>
                        <th>Total Hrs</th>
                        <th>OT Hrs</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAtt.length === 0 ? (
                        <tr><td colSpan={11} className="pm-empty">No attendance records. Use eSSL Sync or Add Entry.</td></tr>
                      ) : filteredAtt.map((r) => (
                        <tr key={r.id}>
                          <td>{formatDate(r.date)}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.employeeId}</td>
                          <td className="att-emp">{r.username}</td>
                          <td>{r.department || '—'}</td>
                          <td>{r.shift || '—'}</td>
                          <td className={r.isLate ? 'is-late' : ''}>{r.inTime || '—'}</td>
                          <td>{r.outTime || '—'}</td>
                          <td>{r.totalHours > 0 ? r.totalHours : '—'}</td>
                          <td className={r.otHours > 0 ? 'is-ot' : ''}>{r.otHours > 0 ? r.otHours : '—'}</td>
                          <td>
                            <span className={`att-badge ${statusBadge(r.statusCode)}`}>
                              {r.status || STATUS_CODES[r.statusCode] || r.statusCode}
                            </span>
                          </td>
                          <td className="pm-actions">
                            <button type="button" onClick={() => openAttEdit(r)}><Edit2 size={14} /></button>
                            {isAdmin && (
                              <button type="button" className="danger" onClick={() => window.confirm('Delete entry?') && deleteItemSoftly('attendance', r.id)}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="premium-card esm-day-summary">
              <h3>Daily Summary</h3>
              <p className="esm-day-label">{formatDate(filters.dateFrom || filters.dateTo || todayStr)}</p>
              <ul>
                <li><Users size={16} /><span>Employees</span><strong>{daySummary.totalEmployees}</strong></li>
                <li><CheckCircle2 size={16} /><span>Present</span><strong>{daySummary.present}</strong></li>
                <li><Circle size={16} /><span>Absent</span><strong>{daySummary.absent}</strong></li>
                <li><Calendar size={16} /><span>Leave / Off</span><strong>{daySummary.leave}</strong></li>
                <li><Calculator size={16} /><span>OT Hours</span><strong>{daySummary.otHours}</strong></li>
              </ul>
            </aside>
          </div>
        </>
      )}

      {/* ─── 4. Salary Calculation ─── */}
      {tab === 'calculate' && (
        <section className="premium-card esm-card">
          <header className="esm-card-head">
            <span className="esm-no">4</span>
            <div>
              <h2>Salary Calculation</h2>
              <p>Rates auto-loaded from Employee Master for the selected month</p>
            </div>
          </header>
          <div className="esm-card-body">
            <div className="sal-select-row">
              <div className="form-group pm-field">
                <label>Month / Year</label>
                <input type="month" className="input-field" value={month} onChange={(e) => { setMonth(e.target.value); setCalculated(false); }} />
              </div>
              <div className="form-group pm-field">
                <label>Employee</label>
                <SearchableSelect className="input-field" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setCalculated(false); }}>
                  <option value="">Select employee</option>
                  {(data.users || []).filter((u) => u.active !== false && u.role !== 'Admin').map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name || u.username} ({u.employeeId})</option>
                  ))}
                </SearchableSelect>
              </div>
              <div className="sal-calc-btn-wrap">
                <button type="button" className="btn btn-primary" onClick={handleCalculate}>
                  <Calculator size={15} /> Calculate
                </button>
              </div>
            </div>

            {selectedUser && (
              <div className="esm-auto-rates">
                <div><span>Shift Type</span><strong>{calc?.shiftType || selectedUser.shiftType || '9hr'}</strong></div>
                <div><span>Per Day Rate</span><strong>{money(calc?.perDayRate)}</strong></div>
                <div><span>OT Rate / hr</span><strong>{money(calc?.otRate)}</strong></div>
                <div><span>Rate Effective</span><strong>{calc?.effectiveFrom ? formatDate(calc.effectiveFrom) : '—'}</strong></div>
              </div>
            )}

            {calculated && calc && (
              <>
                <div className="sal-kpi-row" style={{ marginTop: '1rem' }}>
                  {[
                    { label: 'Days in Month', value: calc.totalDays, tone: 'blue' },
                    { label: 'Present Days', value: calc.presentDays, tone: 'green' },
                    { label: 'Total Hours', value: calc.totalHours, tone: 'sky' },
                    { label: 'OT Hours', value: calc.otHours, tone: 'orange' },
                    { label: 'OT Amount', value: money(calc.otAmount), tone: 'pink' },
                    { label: 'Basic', value: money(calc.basic), tone: 'navy' },
                    { label: 'Total Salary', value: money(calc.totalSalary), tone: 'purple' }
                  ].map((k) => (
                    <div key={k.label} className={`sal-kpi tone-${k.tone}`}>
                      <span>{k.label}</span>
                      <strong>{k.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="esm-breakdown">
                  <p><strong>Basic</strong> = Per Day × Paid Days → {money(calc.perDayRate)} × {calc.paidDays} = {money(calc.basic)}</p>
                  <p><strong>OT Amount</strong> = OT Hours × OT Rate → {calc.otHours} × {money(calc.otRate)} = {money(calc.otAmount)}</p>
                  <p className="esm-total"><strong>Total Salary</strong> = Basic + OT = {money(calc.totalSalary)}</p>
                </div>

                <div className="pm-table-wrap" style={{ marginTop: '1rem' }}>
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>IN / OUT</th>
                        <th>Total Hrs</th>
                        <th>OT Hrs</th>
                        <th>Status</th>
                        <th>Daily Amt</th>
                        <th>OT Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.detailRows.length === 0 ? (
                        <tr><td colSpan={8} className="pm-empty">No attendance for this month. Sync eSSL or add entries.</td></tr>
                      ) : calc.detailRows.map((r) => (
                        <tr key={r.id}>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.dayName}</td>
                          <td>{r.inTime || '—'} / {r.outTime || '—'}</td>
                          <td>{r.totalHours || '—'}</td>
                          <td>{r.otHours || '—'}</td>
                          <td>{r.status || STATUS_CODES[r.statusCode]}</td>
                          <td>{money(r.dailyAmount)}</td>
                          <td>{money(r.otAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pm-form-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-primary" onClick={saveSalaryReport}>Save to Salary Summary</button>
                  <button type="button" className="btn" onClick={() => setTab('summary')}>View Summary</button>
                </div>
              </>
            )}
            {employeeId && monthRows.length === 0 && (
              <p className="sal-hint">No attendance for this employee in {month}. Use eSSL Sync or add attendance first.</p>
            )}
          </div>
        </section>
      )}

      {/* ─── 5. Salary Summary ─── */}
      {tab === 'summary' && (
        <section className="premium-card esm-card">
          <header className="esm-card-head">
            <span className="esm-no">5</span>
            <div>
              <h2>Salary Summary & Reports</h2>
              <p>Monthly payroll for all employees · Export Excel / PDF / Word / Print</p>
            </div>
            <div className="sal-head-actions no-print">
              <input type="month" className="input-field" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
              <ExportButton
                data={summaryExportData}
                columns={summaryExportCols}
                filename={`Salary_Summary_${month}`}
                title={`Monthly Salary Report · ${month}`}
              />
              <button type="button" className="btn" onClick={() => window.print()}>Print</button>
            </div>
          </header>
          <div className="esm-card-body">
            <div className="pm-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Emp. ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Present Days</th>
                    <th>Total Hrs</th>
                    <th>OT Hrs</th>
                    <th>Per Day</th>
                    <th>OT Rate</th>
                    <th>Total Salary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthSummaryRows.length === 0 ? (
                    <tr><td colSpan={10} className="pm-empty">No salary data for {month}. Set rates and sync attendance first.</td></tr>
                  ) : monthSummaryRows.map((r) => (
                    <tr key={r.user.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.user.employeeId}</td>
                      <td className="att-emp">{r.user.name || r.user.username}</td>
                      <td>{r.user.department}</td>
                      <td>{r.presentDays}</td>
                      <td>{r.totalHours}</td>
                      <td>{r.otHours}</td>
                      <td>{money(r.perDayRate)}</td>
                      <td>{money(r.otRate)}</td>
                      <td><strong>{money(r.totalSalary)}</strong></td>
                      <td>
                        <button
                          type="button"
                          className={`att-badge ${r.status === 'Paid' ? 'is-present' : 'is-half'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => setPayStatus((p) => ({
                            ...p,
                            [`${r.user.id}-${month}`]: r.status === 'Paid' ? 'Pending' : 'Paid'
                          }))}
                        >
                          {r.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="esm-benefits no-print">
              <h3>Complete Flow</h3>
              <ol>
                <li>Employee Master — set eSSL ID, shift, rates</li>
                <li>eSSL Sync — import biometric punches</li>
                <li>Attendance — verify IN/OUT & OT</li>
                <li>Salary Calculation — auto rates × days</li>
                <li>Salary Summary — export & mark paid</li>
              </ol>
              <ul className="esm-checks">
                <li><CheckCircle2 size={16} /> No manual punch entry needed (with eSSL sync)</li>
                <li><CheckCircle2 size={16} /> Automatic rate selection by Effective From</li>
                <li><CheckCircle2 size={16} /> OT calculated from shift type (9hr / 12hr)</li>
                <li><CheckCircle2 size={16} /> Excel / PDF / Word / Print exports</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {attModal && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>{attEditing ? 'Edit Attendance' : 'Add Attendance Entry'}</h2>
              <button type="button" className="btn" onClick={() => setAttModal(false)}>Close</button>
            </div>
            <form onSubmit={submitAtt}>
              <div className="pm-form-grid pm-form-grid-2">
                <div className="form-group pm-field">
                  <label>Date *</label>
                  <DateField className="input-field" required value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} />
                </div>
                <div className="form-group pm-field">
                  <label>Employee *</label>
                  <SearchableSelect className="input-field" required value={attForm.userId} onChange={(e) => setAttForm({ ...attForm, userId: e.target.value })}>
                    {allStaff.map((u) => (
                      <option key={u.id} value={String(u.id)}>{u.name || u.username} ({u.employeeId})</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="form-group pm-field">
                  <label>Status *</label>
                  <SearchableSelect className="input-field" value={attForm.statusCode} onChange={(e) => setAttForm({ ...attForm, statusCode: e.target.value })}>
                    {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </SearchableSelect>
                </div>
                <div className="form-group pm-field">
                  <label>Shift Band</label>
                  <SearchableSelect
                    className="input-field"
                    value={attForm.shift}
                    onChange={(e) => {
                      const shift = e.target.value;
                      const cfg = SHIFTS[shift] || SHIFTS.Day;
                      setAttForm({ ...attForm, shift, inTime: cfg.start, outTime: cfg.end });
                    }}
                  >
                    {Object.entries(SHIFTS).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v.start} – {v.end})</option>
                    ))}
                  </SearchableSelect>
                </div>
                {['P', 'HD'].includes(attForm.statusCode) && (
                  <>
                    <div className="form-group pm-field">
                      <label>In Time</label>
                      <TimeField className="input-field" required value={attForm.inTime} onChange={(e) => setAttForm({ ...attForm, inTime: e.target.value })} />
                    </div>
                    <div className="form-group pm-field">
                      <label>Out Time</label>
                      <TimeField className="input-field" required value={attForm.outTime} onChange={(e) => setAttForm({ ...attForm, outTime: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="form-group pm-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Remark</label>
                  <input className="input-field" value={attForm.remark} onChange={(e) => setAttForm({ ...attForm, remark: e.target.value })} />
                </div>
              </div>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary">Save Entry</button>
                <button type="button" className="btn" onClick={() => setAttModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSalaryManagement;
