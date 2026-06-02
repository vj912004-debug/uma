import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { Plus, Search, Edit2, Trash2, Fingerprint, Filter } from 'lucide-react';

// Shift Configurations
const SHIFTS = {
  General: { start: '09:00', end: '18:30', stdHours: 9.5 },
  Evening: { start: '18:30', end: '21:00', stdHours: 2.5 },
  Night:   { start: '21:00', end: '06:30', stdHours: 9.5 },
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

const calculateTimes = (inTime, outTime, shift) => {
  if (!inTime || !outTime || !shift) return { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };

  const shiftConfig = SHIFTS[shift];
  if (!shiftConfig) return { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };

  // Helper to parse time string HH:MM to minutes
  const toMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const inMins = toMins(inTime);
  let outMins = toMins(outTime);
  const startMins = toMins(shiftConfig.start);
  let endMins = toMins(shiftConfig.end);

  // Handle overnight shifts (Night shift ends next day)
  if (outMins < inMins) outMins += 24 * 60;
  if (endMins < startMins) endMins += 24 * 60;
  // Also fix cross-day logic for early/late calculation
  let actualOutForCompare = toMins(outTime);
  if (actualOutForCompare < toMins(shiftConfig.start)) actualOutForCompare += 24 * 60;

  const totalHours = (outMins - inMins) / 60;
  
  // Late if in time is > 15 mins after shift start
  const isLate = inMins > (startMins + 15);
  
  // Early leave if out time is before shift end
  const isEarlyLeave = actualOutForCompare < endMins;

  const otHours = Math.max(0, totalHours - shiftConfig.stdHours);

  return { 
    totalHours: totalHours.toFixed(2), 
    otHours: otHours.toFixed(2), 
    isLate,
    isEarlyLeave
  };
};

const Attendance = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();

  const userRole = data.settings?.userRole || 'Admin';
  const currentUser = data.currentUser || { id: 1, username: 'Admin', role: 'Admin' };

  // Filters
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    employee: '',
    department: '',
    shift: '',
    status: ''
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);

  const [form, setForm] = useState({
    userId: String(currentUser.id),
    date: new Date().toISOString().split('T')[0],
    shift: 'General',
    inTime: '09:00',
    outTime: '18:30',
    statusCode: 'P',
    remark: '',
    isHalfDay: false
  });

  const canEditRow = (row) => userRole === 'Admin' || String(row.userId) === String(currentUser.id);

  const openCreate = () => {
    setIsEditing(null);
    setForm({
      userId: String(currentUser.id),
      date: new Date().toISOString().split('T')[0],
      shift: 'General',
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
      shift: row.shift || 'General',
      inTime: row.inTime || '',
      outTime: row.outTime || '',
      statusCode: row.statusCode || 'P',
      remark: row.remark || '',
      isHalfDay: row.isHalfDay || false
    });
    setIsModalOpen(true);
  };

  const users = useMemo(() => (data.users || []).filter(u => u.active !== false), [data.users]);

  const submit = (e) => {
    e.preventDefault();
    
    const user = users.find(u => String(u.id) === String(form.userId));
    if (!user) return;

    // Auto calculate if status is Present
    let calc = { totalHours: 0, otHours: 0, isLate: false, isEarlyLeave: false };
    if (form.statusCode === 'P' || form.statusCode === 'HD') {
       calc = calculateTimes(form.inTime, form.outTime, form.shift);
    }

    const final = {
      ...form,
      username: user.username,
      employeeId: user.employeeId || 'N/A',
      department: user.department || 'General',
      status: STATUS_CODES[form.statusCode],
      totalHours: calc.totalHours,
      otHours: calc.otHours,
      isLate: calc.isLate,
      isEarlyLeave: calc.isEarlyLeave,
      leaveType: ['CL', 'SL', 'PL', 'LWP'].includes(form.statusCode) ? form.statusCode : ''
    };

    if (isEditing) {
      updateItem('attendance', isEditing, { ...final, id: isEditing });
    } else {
      updateData('attendance', { ...final, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const handleBiometricSync = () => {
    alert("Simulating Biometric Machine Sync...\nFound 0 new punch records.");
  };

  const rows = (data.attendance || []).filter(r => !r.isDeleted);
  
  const filtered = rows.filter(r => {
    if (userRole !== 'Admin' && String(r.userId) !== String(currentUser.id)) return false;
    if (filters.date && r.date !== filters.date) return false;
    if (filters.employee && !r.username.toLowerCase().includes(filters.employee.toLowerCase())) return false;
    if (filters.department && r.department !== filters.department) return false;
    if (filters.shift && r.shift !== filters.shift) return false;
    if (filters.status && r.statusCode !== filters.status) return false;
    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const exportColumns = [
    { label: 'Sr', key: 'sr' },
    { label: 'Date', key: 'date' },
    { label: 'Emp ID', key: 'employeeId' },
    { label: 'Name', key: 'username' },
    { label: 'Department', key: 'department' },
    { label: 'Shift', key: 'shift' },
    { label: 'In', key: 'inTime' },
    { label: 'Out', key: 'outTime' },
    { label: 'Total Hrs', key: 'totalHours' },
    { label: 'OT Hrs', key: 'otHours' },
    { label: 'Status', key: 'status' },
    { label: 'Late', key: 'isLate' },
    { label: 'Half Day', key: 'isHalfDay' },
    { label: 'Leave', key: 'leaveType' },
    { label: 'Remark', key: 'remark' }
  ];

  const exportData = filtered.map((r, idx) => ({ ...r, sr: idx + 1, isLate: r.isLate ? 'Yes' : 'No', isHalfDay: r.isHalfDay ? 'Yes' : 'No' }));

  const uniqueDepartments = [...new Set(users.map(u => u.department).filter(Boolean))];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Attendance Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track daily timesheets, shifts, leaves, and overtime.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'var(--accent-secondary)' }} onClick={handleBiometricSync}>
            <Fingerprint size={18} /> Sync Biometric
          </button>
          <ExportButton data={exportData} columns={exportColumns} filename="Attendance_Register" title="Attendance Register" />
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Manual Entry
          </button>
        </div>
      </header>

      {/* Advanced Filters */}
      <div className="premium-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filters:</span>
          </div>
          <input type="date" className="input-field" style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})} />
          <input type="text" className="input-field" placeholder="Employee Name..." style={{ width: '150px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} value={filters.employee} onChange={e => setFilters({...filters, employee: e.target.value})} />
          <select className="input-field" style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})}>
            <option value="">All Departments</option>
            {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input-field" style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} value={filters.shift} onChange={e => setFilters({...filters, shift: e.target.value})}>
            <option value="">All Shifts</option>
            {Object.keys(SHIFTS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field" style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CODES).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
          </select>
          <button className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setFilters({date: '', employee: '', department: '', shift: '', status: ''})}>Clear</button>
        </div>
      </div>

      <div className="premium-card">
        <div className="data-table-container">
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Sr</th>
                <th>Date</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Shift</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Total Hrs</th>
                <th>OT Hrs</th>
                <th>Status</th>
                <th>Late</th>
                <th>Half Day</th>
                <th>Leave</th>
                <th>Remark</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="16" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No attendance records found for current filters.</td></tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.employeeId}</td>
                    <td style={{ fontWeight: 600 }}>{r.username}</td>
                    <td>{r.department}</td>
                    <td>{r.shift}</td>
                    <td style={{ fontWeight: 600, color: r.isLate ? 'var(--error-color)' : 'inherit' }}>{r.inTime || '-'}</td>
                    <td style={{ fontWeight: 600, color: r.isEarlyLeave ? 'var(--warning-color)' : 'inherit' }}>{r.outTime || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{r.totalHours > 0 ? r.totalHours : '-'}</td>
                    <td style={{ color: r.otHours > 0 ? 'var(--accent-primary)' : 'inherit' }}>{r.otHours > 0 ? r.otHours : '-'}</td>
                    <td>
                      <span style={{ 
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                        background: r.statusCode === 'P' ? 'rgba(16, 185, 129, 0.2)' : r.statusCode === 'A' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: r.statusCode === 'P' ? '#34d399' : r.statusCode === 'A' ? '#f87171' : '#fbbf24'
                      }}>
                        {r.statusCode}
                      </span>
                    </td>
                    <td style={{ color: r.isLate ? '#f87171' : 'inherit' }}>{r.isLate ? 'Yes' : '-'}</td>
                    <td>{r.isHalfDay || r.statusCode === 'HD' ? 'Yes' : '-'}</td>
                    <td>{r.leaveType || '-'}</td>
                    <td style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.remark || ''}>{r.remark || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEdit(r)}
                          disabled={!canEditRow(r)}
                          style={{ background: 'transparent', border: 'none', color: canEditRow(r) ? 'var(--text-muted)' : 'rgba(255,255,255,0.25)', cursor: canEditRow(r) ? 'pointer' : 'not-allowed' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteItemSoftly('attendance', r.id)}
                          disabled={userRole !== 'Admin'}
                          style={{ background: 'transparent', border: 'none', color: userRole === 'Admin' ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.25)', cursor: userRole === 'Admin' ? 'pointer' : 'not-allowed' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.25rem' }}>{isEditing ? 'Edit Attendance' : 'Manual Attendance Entry'}</h2>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label>Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label>Employee *</label>
                  <select
                    className="input-field"
                    required
                    disabled={userRole !== 'Admin'}
                    value={form.userId}
                    onChange={e => setForm({ ...form, userId: e.target.value })}
                  >
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>{u.username} ({u.employeeId})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label>Status Code *</label>
                  <select className="input-field" value={form.statusCode} onChange={e => setForm({ ...form, statusCode: e.target.value })}>
                    {Object.entries(STATUS_CODES).map(([k, v]) => (
                      <option key={k} value={k}>{v} ({k})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label>Shift Timing</label>
                  <select className="input-field" value={form.shift} onChange={e => {
                    const shift = e.target.value;
                    setForm({ ...form, shift, inTime: SHIFTS[shift].start, outTime: SHIFTS[shift].end });
                  }}>
                    {Object.entries(SHIFTS).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v.start} - {v.end})</option>
                    ))}
                  </select>
                </div>

                {['P', 'HD'].includes(form.statusCode) && (
                  <>
                    <div>
                      <label>In Time</label>
                      <input type="time" className="input-field" required value={form.inTime} onChange={e => setForm({ ...form, inTime: e.target.value })} />
                    </div>
                    <div>
                      <label>Out Time</label>
                      <input type="time" className="input-field" required value={form.outTime} onChange={e => setForm({ ...form, outTime: e.target.value })} />
                    </div>
                  </>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isHalfDay} onChange={e => setForm({...form, isHalfDay: e.target.checked})} />
                    Mark as Half Day manually
                  </label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Auto-calculated Half Day (HD) overrides this)</span>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label>Remark / Note</label>
                  <textarea className="input-field" rows="2" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="E.g., Traffic delay, Doctor appointment..." />
                </div>
              </div>

              {['P', 'HD'].includes(form.statusCode) && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '0.9rem' }}>Auto-Calculation Preview:</h4>
                  {(() => {
                    const calc = calculateTimes(form.inTime, form.outTime, form.shift);
                    return (
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                        <span><strong>Total Hrs:</strong> {calc.totalHours}</span>
                        <span><strong>OT Hrs:</strong> {calc.otHours}</span>
                        <span style={{ color: calc.isLate ? '#f87171' : 'inherit' }}><strong>Late:</strong> {calc.isLate ? 'Yes' : 'No'}</span>
                        <span style={{ color: calc.isEarlyLeave ? '#f87171' : 'inherit' }}><strong>Early Leave:</strong> {calc.isEarlyLeave ? 'Yes' : 'No'}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={userRole !== 'Admin' && String(form.userId) !== String(currentUser.id)}>
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
