import React, { useMemo, useState } from 'react';
import { Users, Plus, Save, Search, Edit2, Trash2, X, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate, newestFirst } from '../utils/dateUtils';
import { generateEmployeeId } from '../utils/auth';
import { getEffectiveRate, money, isPendingApproval, approvalPatch } from '../utils/payroll';
import { DEPARTMENTS } from './EmployeeManagement';

const SHIFT_OPTIONS = ['9hr', '12hr'];
const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'pending', label: 'Pending Approval' }
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  employeeId: '',
  name: '',
  department: '',
  designation: '',
  joiningDate: '',
  esslId: '',
  perDayRate: '',
  otRate: '',
  shiftType: '9hr',
  status: 'Active'
});

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const EmployeeMaster = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const { currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const users = data.users || [];
  const employees = useMemo(
    () => newestFirst(users.filter((u) => !u.isDeleted && (u.role !== 'Admin' || u.employeeId || Number(u.perDayRate) > 0))),
    [users]
  );

  const editingUser = editingId ? users.find((u) => u.id === editingId) : null;
  const departmentOptions = [...new Set([...DEPARTMENTS, ...users.map((u) => u.department).filter(Boolean)])];
  const designationOptions = [...new Set(users.map((u) => u.designation).filter(Boolean))];

  const rows = employees.filter((u) => {
    const active = u.active !== false;
    if (statusTab === 'active' && !active) return false;
    if (statusTab === 'inactive' && active) return false;
    if (statusTab === 'pending' && !isPendingApproval(u)) return false;
    if (deptFilter && u.department !== deptFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.employeeId, u.name, u.username, u.department, u.designation, u.shiftType, u.esslId]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const counts = {
    all: employees.length,
    active: employees.filter((u) => u.active !== false).length,
    inactive: employees.filter((u) => u.active === false).length,
    pending: employees.filter(isPendingApproval).length
  };

  const approveEmployee = (u) => {
    if (!isAdmin) return;
    if (!window.confirm(`Approve ${u.name || u.employeeId}? Their attendance punches will then sync automatically.`)) return;
    updateItem('users', u.id, { ...u, ...approvalPatch(currentUser) });
  };

  const exportRows = rows.map((u) => {
    const rate = getEffectiveRate(u);
    return {
      employeeId: u.employeeId || '',
      name: u.name || u.username || '',
      department: u.department || '',
      designation: u.designation || '',
      joiningDate: formatDate(u.joiningDate) || '',
      perDayRate: rate.perDayRate || 0,
      otRate: rate.otRate || 0,
      shiftType: u.shiftType || '9hr',
      esslId: u.esslId || '',
      status: u.active === false ? 'Inactive' : 'Active',
      approval: isPendingApproval(u) ? 'Pending' : 'Approved'
    };
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setForm({ ...emptyForm(), employeeId: generateEmployeeId(users) });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (u) => {
    const rate = getEffectiveRate(u);
    setForm({
      employeeId: u.employeeId || generateEmployeeId(users),
      name: u.name || u.username || '',
      department: u.department || '',
      designation: u.designation || '',
      joiningDate: u.joiningDate || '',
      esslId: u.esslId || '',
      perDayRate: rate.perDayRate || '',
      otRate: rate.otRate || '',
      shiftType: u.shiftType === '12hr' ? '12hr' : '9hr',
      status: u.active === false ? 'Inactive' : 'Active'
    });
    setEditingId(u.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const withRateHistory = (user, perDayRate, otRate) => {
    const history = Array.isArray(user?.rateHistory) ? [...user.rateHistory] : [];
    const current = user ? getEffectiveRate(user) : { perDayRate: 0, otRate: 0 };
    if (user && current.perDayRate === perDayRate && current.otRate === otRate) {
      return { history, effectiveFrom: current.effectiveFrom || user.effectiveFrom || today() };
    }
    const effectiveFrom = user ? today() : (form.joiningDate || today());
    const idx = history.findIndex((h) => h.effectiveFrom === effectiveFrom);
    const entry = {
      id: idx >= 0 ? history[idx].id : `rh-${user?.id || 'new'}-${Date.now()}`,
      effectiveFrom,
      perDayRate,
      otRate
    };
    if (idx >= 0) history[idx] = entry;
    else history.push(entry);
    history.sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));
    return { history, effectiveFrom };
  };

  const handleSave = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      alert('Employee Name is required.');
      return;
    }
    const perDayRate = Number(form.perDayRate) || 0;
    const otRate = Number(form.otRate) || 0;
    const common = {
      name,
      department: form.department.trim(),
      designation: form.designation.trim(),
      joiningDate: form.joiningDate || '',
      esslId: String(form.esslId || '').trim(),
      shiftType: form.shiftType,
      perDayRate,
      otRate,
      active: form.status !== 'Inactive'
    };

    if (editingId) {
      const user = users.find((u) => u.id === editingId);
      if (!user) return;
      const { history, effectiveFrom } = withRateHistory(user, perDayRate, otRate);
      const employeeId = form.employeeId.trim() || user.employeeId || generateEmployeeId(users);
      updateItem('users', user.id, {
        ...user,
        ...common,
        employeeId,
        rateHistory: history,
        effectiveFrom
      });
    } else {
      const employeeId = form.employeeId.trim() || generateEmployeeId(users);
      const { history, effectiveFrom } = withRateHistory(null, perDayRate, otRate);
      updateData('users', {
        ...common,
        id: `emp-${Date.now()}`,
        employeeId,
        username: employeeId.toLowerCase(),
        role: 'Staff',
        permissions: [],
        approvalStatus: 'Pending',
        rateHistory: history,
        effectiveFrom,
        createdAt: new Date().toISOString()
      });
    }
    closeForm();
  };

  const handleDelete = (u) => {
    if (u.role === 'Admin' || u.passwordHash) {
      alert('This employee has a login account. Set Status to Inactive here, or remove the login from Employees.');
      return;
    }
    if (window.confirm(`Delete employee ${u.name || u.employeeId}?`)) deleteItemSoftly('users', u.id);
  };

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Users size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Employee Master</h1>
            <p className="page-subtitle">Employee code, department, designation, joining date, rates, shift and status.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <ExportButton
            data={exportRows}
            columns={[
              { label: 'Employee Code', key: 'employeeId' },
              { label: 'Employee Name', key: 'name' },
              { label: 'Department', key: 'department' },
              { label: 'Designation', key: 'designation' },
              { label: 'Joining Date', key: 'joiningDate' },
              { label: 'Salary/Day Rate', key: 'perDayRate' },
              { label: 'OT Rate', key: 'otRate' },
              { label: 'Shift', key: 'shiftType' },
              { label: 'eSSL ID', key: 'esslId' },
              { label: 'Status', key: 'status' },
              { label: 'Approval', key: 'approval' }
            ]}
            filename="Employee_Master"
            title="Employee Master"
          />
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={15} /> Add Employee
          </button>
        </div>
      </header>

      <div className="esm-tabs">
        {STATUS_TABS.map((t) => (
          <button key={t.id} type="button" className={`esm-tab ${statusTab === t.id ? 'is-active' : ''}`} onClick={() => setStatusTab(t.id)}>
            {t.label}
            <span className="pm-tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <section className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>
            <Users size={16} /> Employees
          </h2>
          <div className="pm-list-tools">
            <SearchableSelect className="input-field" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} placeholder="All Departments">
              <option value="">All Departments</option>
              {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </SearchableSelect>
            <div className="pm-search">
              <Search size={14} />
              <input type="text" placeholder="Search code, name, department..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Joining Date</th>
                <th>Salary/Day Rate</th>
                <th>OT Rate</th>
                <th>Shift</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="pm-empty">No employees found. Click Add Employee.</td></tr>
              ) : rows.map((u) => {
                const rate = getEffectiveRate(u);
                const active = u.active !== false;
                return (
                  <tr key={u.id} className="pm-click-row" title="Click to open employee" onClick={() => openEdit(u)}>
                    <td><strong>{u.employeeId || '—'}</strong></td>
                    <td>{u.name || u.username}</td>
                    <td>{u.department || '—'}</td>
                    <td>{u.designation || '—'}</td>
                    <td>{formatDate(u.joiningDate) || '—'}</td>
                    <td>{rate.perDayRate ? money(rate.perDayRate) : '—'}</td>
                    <td>{rate.otRate ? money(rate.otRate) : '—'}</td>
                    <td><span className="esm-chip">{u.shiftType || '9hr'}</span></td>
                    <td><span className={`pm-pill ${active ? 'is-approved' : 'is-low'}`}>{active ? 'Active' : 'Inactive'}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {isPendingApproval(u) ? (
                        isAdmin ? (
                          <button type="button" className="btn btn-primary esm-approve-btn" onClick={() => approveEmployee(u)}>
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        ) : <span className="pm-pill is-pending">Pending</span>
                      ) : (
                        <span className="pm-pill is-approved" title={u.approvedBy ? `Approved by ${u.approvedBy}` : ''}>Approved</span>
                      )}
                    </td>
                    <td className="pm-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="Edit" onClick={() => openEdit(u)}><Edit2 size={14} /></button>
                      <button type="button" title="Delete" className="danger" onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
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
          <section className="premium-card pm-card pm-modal-card">
            <div className="pm-modal-head">
              <h2 className="pm-card-title">
                <Users size={16} /> {editingId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button type="button" className="btn" onClick={closeForm}><X size={14} /> Close</button>
            </div>
            <form onSubmit={handleSave} className="pm-modal-form">
              <Field label="Employee Code">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input-field"
                    value={form.employeeId}
                    onChange={(e) => setField('employeeId', e.target.value)}
                    placeholder="e.g. EMP001"
                    style={{ flex: 1, fontWeight: 600 }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setField('employeeId', generateEmployeeId(users))}
                    title="Generate next available Employee Code"
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> Generate
                  </button>
                </div>
              </Field>
              <Field label="Employee Name" required>
                <input className="input-field" required value={form.name} onChange={(e) => setField('name', e.target.value)} />
              </Field>
              <Field label="Department">
                <SearchableSelect className="input-field" value={form.department} onChange={(e) => setField('department', e.target.value)} placeholder="Select or type department">
                  <option value="">Select or type department</option>
                  {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Designation">
                <SearchableSelect className="input-field" value={form.designation} onChange={(e) => setField('designation', e.target.value)} placeholder="Select or type designation">
                  <option value="">Select or type designation</option>
                  {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Joining Date">
                <DateField className="input-field" value={form.joiningDate} onChange={(e) => setField('joiningDate', e.target.value)} />
              </Field>
              <Field label="eSSL ID (Attendance Machine)">
                <input className="input-field" value={form.esslId} onChange={(e) => setField('esslId', e.target.value)} placeholder="Biometric user id" />
              </Field>
              <Field label="Salary/Day Rate (₹)">
                <input type="number" step="any" min="0" className="input-field" value={form.perDayRate} onChange={(e) => setField('perDayRate', e.target.value)} />
              </Field>
              <Field label="OT Rate (₹/hr)">
                <input type="number" step="any" min="0" className="input-field" value={form.otRate} onChange={(e) => setField('otRate', e.target.value)} />
              </Field>
              <Field label="Shift">
                <SearchableSelect className="input-field" allowCustom={false} value={form.shiftType} onChange={(e) => setField('shiftType', e.target.value)}>
                  {SHIFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="Status">
                <SearchableSelect className="input-field" allowCustom={false} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </SearchableSelect>
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
                {isAdmin && editingUser && isPendingApproval(editingUser) ? (
                  <button type="button" className="btn esm-approve-btn" onClick={() => { approveEmployee(editingUser); }}>
                    <CheckCircle2 size={15} /> Approve Employee
                  </button>
                ) : null}
                <button type="button" className="btn pm-btn-outline" onClick={closeForm}>Cancel</button>
                {!editingId ? <span className="esm-approve-hint">New employees need admin approval before attendance punches sync.</span> : null}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default EmployeeMaster;
