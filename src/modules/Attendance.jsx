import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  Calculator,
  Fingerprint,
  Calendar
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import ExportButton from '../components/ExportButton';
import SearchableSelect from '../components/SearchableSelect';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import { formatDate } from '../utils/dateUtils';

const SHIFTS = {
  Day: { start: '09:00', end: '18:30', stdHours: 9.5 },
  General: { start: '09:00', end: '18:30', stdHours: 9.5 },
  Evening: { start: '18:30', end: '21:00', stdHours: 2.5 },
  Night: { start: '21:00', end: '06:30', stdHours: 9.5 },
  Morning: { start: '06:30', end: '09:00', stdHours: 2.5 }
};

const STATUS_CODES = {
  P: 'Present',
  A: 'Absent',
  HD: 'Half Day',
  WO: 'Weekly Off',
  PH: 'Public Holiday',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  PL: 'Paid Leave',
  LWP: 'Leave Without Pay'
};

const toMins = (t) => {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
};

export const calculateTimes = (inTime, outTime, shift) => {
  if (!inTime || !outTime || !shift) return { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };
  const shiftConfig = SHIFTS[shift] || SHIFTS.Day;
  const inMins = toMins(inTime);
  let outMins = toMins(outTime);
  const startMins = toMins(shiftConfig.start);
  let endMins = toMins(shiftConfig.end);
  if (outMins < inMins) outMins += 24 * 60;
  if (endMins < startMins) endMins += 24 * 60;
  let actualOutForCompare = toMins(outTime);
  if (actualOutForCompare < toMins(shiftConfig.start)) actualOutForCompare += 24 * 60;
  const totalHours = (outMins - inMins) / 60;
  return {
    totalHours: Number(totalHours.toFixed(2)),
    otHours: Number(Math.max(0, totalHours - shiftConfig.stdHours).toFixed(2)),
    isLate: inMins > startMins + 15,
    isEarlyLeave: actualOutForCompare < endMins
  };
};

const statusBadge = (code) => {
  if (code === 'P') return 'is-present';
  if (code === 'A' || code === 'LWP') return 'is-absent';
  if (code === 'HD') return 'is-half';
  return 'is-leave';
};

const Attendance = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || data.settings?.userRole || 'Admin';

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    employee: '',
    department: '',
    status: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [form, setForm] = useState({
    userId: String(currentUser?.id || 1),
    date: new Date().toISOString().split('T')[0],
    shift: 'Day',
    inTime: '09:00',
    outTime: '18:30',
    statusCode: 'P',
    remark: '',
    isHalfDay: false
  });

  const users = useMemo(() => (data.users || []).filter((u) => u.active !== false), [data.users]);
  const uniqueDepartments = [...new Set(users.map((u) => u.department).filter(Boolean))];
  const canEditRow = (row) => userRole === 'Admin' || String(row.userId) === String(currentUser?.id);

  const openCreate = () => {
    setIsEditing(null);
    setForm({
      userId: String(currentUser?.id || users[0]?.id || 1),
      date: new Date().toISOString().split('T')[0],
      shift: 'Day',
      inTime: '09:00',
      outTime: '18:30',
      statusCode: 'P',
      remark: '',
      isHalfDay: false
    });
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setIsEditing(row.id);
    setForm({
      userId: String(row.userId),
      date: row.date,
      shift: row.shift || 'Day',
      inTime: row.inTime || '',
      outTime: row.outTime || '',
      statusCode: row.statusCode || 'P',
      remark: row.remark || '',
      isHalfDay: row.isHalfDay || false
    });
    setIsModalOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    const user = users.find((u) => String(u.id) === String(form.userId));
    if (!user) return;
    let calc = { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };
    if (form.statusCode === 'P' || form.statusCode === 'HD') {
      calc = calculateTimes(form.inTime, form.outTime, form.shift);
    }
    const final = {
      ...form,
      username: user.name || user.username,
      employeeId: user.employeeId || 'N/A',
      department: user.department || 'General',
      status: STATUS_CODES[form.statusCode],
      totalHours: calc.totalHours,
      otHours: calc.otHours,
      isLate: calc.isLate,
      isEarlyLeave: calc.isEarlyLeave,
      leaveType: ['CL', 'SL', 'PL', 'LWP'].includes(form.statusCode) ? form.statusCode : ''
    };
    if (isEditing) updateItem('attendance', isEditing, { ...final, id: isEditing });
    else updateData('attendance', { ...final, id: Date.now().toString(), createdAt: new Date().toISOString() });
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const rows = (data.attendance || []).filter((r) => !r.isDeleted);
  const filtered = rows.filter((r) => {
    if (userRole !== 'Admin' && String(r.userId) !== String(currentUser?.id)) return false;
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

  const exportColumns = [
    { label: 'Date', key: 'date' },
    { label: 'Employee Name', key: 'username' },
    { label: 'Department', key: 'department' },
    { label: 'Shift', key: 'shift' },
    { label: 'In Time', key: 'inTime' },
    { label: 'Out Time', key: 'outTime' },
    { label: 'Total Hours', key: 'totalHours' },
    { label: 'Status', key: 'status' },
    { label: 'OT Hours', key: 'otHours' }
  ];

  const exportData = filtered.map((r) => ({
    ...r,
    date: formatDate(r.date),
    status: r.status || STATUS_CODES[r.statusCode] || r.statusCode
  }));

  return (
    <div className="att-page">
      <header className="att-header">
        <div className="att-title-wrap">
          <UserCheck size={22} className="att-title-icon" />
          <div>
            <h1>Attendance Management</h1>
            <p>View and verify daily attendance logs, shifts and overtime.</p>
          </div>
        </div>
        <div className="att-header-actions">
          <Link to="/salary-calculation" className="btn pm-btn-outline">
            <Calculator size={15} /> Salary Calculation
          </Link>
          <button type="button" className="btn" onClick={() => alert('Simulating Biometric Machine Sync...\nFound 0 new punch records.')}>
            <Fingerprint size={15} /> Sync Biometric
          </button>
          <ExportButton data={exportData} columns={exportColumns} filename="Attendance_Register" title="Attendance Register" />
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Entry
          </button>
        </div>
      </header>

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
            <input
              type="text"
              placeholder="Employee Name..."
              value={filters.employee}
              onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
            />
          </div>
          <SearchableSelect className="input-field" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} placeholder="Department">
            <option value="">All Departments</option>
            {uniqueDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </SearchableSelect>
          <SearchableSelect className="input-field" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} placeholder="Status">
            <option value="">All Status</option>
            {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </SearchableSelect>
          <button
            type="button"
            className="btn"
            onClick={() => setFilters({ dateFrom: '', dateTo: '', employee: '', department: '', status: '' })}
          >
            Clear
          </button>
        </div>
      </section>

      <section className="premium-card att-table-card">
        <div className="pm-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Shift</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>OT Hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="pm-empty">No attendance records found for current filters.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td className="att-emp">{r.username}</td>
                  <td>{r.department || '—'}</td>
                  <td>{r.shift || '—'}</td>
                  <td className={r.isLate ? 'is-late' : ''}>{r.inTime || '—'}</td>
                  <td>{r.outTime || '—'}</td>
                  <td>{r.totalHours > 0 ? r.totalHours : '—'}</td>
                  <td>
                    <span className={`att-badge ${statusBadge(r.statusCode)}`}>
                      {r.status || STATUS_CODES[r.statusCode] || r.statusCode}
                    </span>
                  </td>
                  <td className={r.otHours > 0 ? 'is-ot' : ''}>{r.otHours > 0 ? r.otHours : '—'}</td>
                  <td className="pm-actions">
                    <button type="button" title="Edit" disabled={!canEditRow(r)} onClick={() => openEdit(r)}><Edit2 size={14} /></button>
                    <button
                      type="button"
                      title="Delete"
                      className="danger"
                      disabled={userRole !== 'Admin'}
                      onClick={() => window.confirm('Delete this attendance entry?') && deleteItemSoftly('attendance', r.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen && (
        <div className="page-form-overlay">
          <div className="premium-card pm-card" style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>{isEditing ? 'Edit Attendance' : 'Add Attendance Entry'}</h2>
              <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={submit}>
              <div className="pm-form-grid pm-form-grid-2">
                <div className="form-group pm-field">
                  <label>Date *</label>
                  <DateField className="input-field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group pm-field">
                  <label>Employee *</label>
                  <SearchableSelect
                    className="input-field"
                    required
                    disabled={userRole !== 'Admin'}
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>{u.name || u.username} ({u.employeeId})</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="form-group pm-field">
                  <label>Status *</label>
                  <SearchableSelect className="input-field" value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: e.target.value })}>
                    {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </SearchableSelect>
                </div>
                <div className="form-group pm-field">
                  <label>Shift</label>
                  <SearchableSelect
                    className="input-field"
                    value={form.shift}
                    onChange={(e) => {
                      const shift = e.target.value;
                      const cfg = SHIFTS[shift] || SHIFTS.Day;
                      setForm({ ...form, shift, inTime: cfg.start, outTime: cfg.end });
                    }}
                  >
                    {Object.entries(SHIFTS).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v.start} – {v.end})</option>
                    ))}
                  </SearchableSelect>
                </div>
                {['P', 'HD'].includes(form.statusCode) && (
                  <>
                    <div className="form-group pm-field">
                      <label>In Time</label>
                      <TimeField className="input-field" required value={form.inTime} onChange={(e) => setForm({ ...form, inTime: e.target.value })} />
                    </div>
                    <div className="form-group pm-field">
                      <label>Out Time</label>
                      <TimeField className="input-field" required value={form.outTime} onChange={(e) => setForm({ ...form, outTime: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="form-group pm-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Remark</label>
                  <input className="input-field" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="Optional note..." />
                </div>
              </div>
              {['P', 'HD'].includes(form.statusCode) && (
                <div className="att-calc-preview">
                  {(() => {
                    const calc = calculateTimes(form.inTime, form.outTime, form.shift);
                    return (
                      <>
                        <span><strong>Total Hrs:</strong> {calc.totalHours}</span>
                        <span><strong>OT Hrs:</strong> {calc.otHours}</span>
                        <span><strong>Late:</strong> {calc.isLate ? 'Yes' : 'No'}</span>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary">Save Entry</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export { SHIFTS, STATUS_CODES };
export default Attendance;
