import React, { useMemo, useState, useEffect } from 'react';
import { 
  Users, 
  User, 
  Plus, 
  Save, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  RefreshCw, 
  Phone, 
  Mail, 
  Calendar, 
  Briefcase, 
  Shield, 
  FileText, 
  CreditCard, 
  Clock, 
  Info,
  List,
  Grid,
  CheckSquare
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate, newestFirst } from '../utils/dateUtils';
import { generateEmployeeId } from '../utils/auth';
import { getEffectiveRate, money, isPendingApproval, approvalPatch } from '../utils/payroll';
import { DEPARTMENTS } from './EmployeeManagement';

const SHIFT_OPTIONS = [
  { value: '9hr', label: 'Day (9hr)' },
  { value: '12hr', label: 'Night (12hr)' },
  { value: '8hr', label: 'General (8hr)' }
];

const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', color: '#047857', bg: '#ecfdf5', icon: '🟢' },
  { value: 'Inactive', label: 'Inactive', color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  { value: 'Resigned', label: 'Resigned', color: '#ea580c', bg: '#fff7ed', icon: '🍊' },
  { value: 'On Hold', label: 'On Hold', color: '#d97706', bg: '#fefce8', icon: '⏸️' }
];

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Inactive', label: 'Inactive' },
  { id: 'Resigned', label: 'Resigned' },
  { id: 'On Hold', label: 'On Hold' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'mapped', label: 'Mapped' },
  { id: 'unmapped', label: 'Not Mapped' }
];

const ALL_MODULES = [
  { id: 'material_receipt', label: 'Material Receipts' },
  { id: 'under_process', label: 'Under Process & Production' },
  { id: 'delivery_challans', label: 'Delivery Challans' },
  { id: 'invoices', label: 'Tax Invoices & Proforma' },
  { id: 'processing_sheet', label: 'Excel Processing Sheet' },
  { id: 'payroll', label: 'Payroll & Attendance' },
  { id: 'employee_master', label: 'Employee Master' },
  { id: 'system_logs', label: 'System Logs & Settings' }
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
  monthlySalary: '',
  shiftType: '9hr',
  status: 'Active',
  employeeType: 'Regular',
  phone: '',
  email: '',
  gender: 'Male',
  dob: '',
  emergencyContact: '',
  address: '',
  reportingManager: '',
  workLocation: 'Vadodara GIDC Ranoli',
  resignationDate: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  bankBranch: '',
  aadhaarNo: '',
  panNo: '',
  pfNo: '',
  esiNo: '',
  role: 'Staff',
  permissions: []
});

const Field = ({ label, required, children, hint }) => (
  <div className="form-group pm-field" style={{ marginBottom: '1rem' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
      {label}
      {required ? <span style={{ color: '#ef4444' }}>*</span> : null}
      {hint && <span title={hint} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}><Info size={13} /></span>}
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
  const [mappingFilter, setMappingFilter] = useState('all'); // 'all' | 'mapped' | 'unmapped'
  const [viewMode, setViewMode] = useState('employee-wise'); // 'employee-wise' | 'table'
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'employment' | 'shift_salary' | 'role_permissions' | 'documents'
  
  const users = data.users || [];
  const employees = useMemo(
    () => newestFirst(users.filter((u) => !u.isDeleted && (u.role !== 'Admin' || u.employeeId || Number(u.perDayRate) > 0))),
    [users]
  );

  const [selectedUserId, setSelectedUserId] = useState(() => (employees[0]?.id || null));
  const [form, setForm] = useState(emptyForm);
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync selectedUserId if currently selected employee gets deleted or list changes
  useEffect(() => {
    if (!selectedUserId && employees.length > 0) {
      setSelectedUserId(employees[0].id);
    }
  }, [employees, selectedUserId]);

  const selectedUser = useMemo(
    () => employees.find((u) => u.id === selectedUserId) || null,
    [employees, selectedUserId]
  );

  // Populate form whenever selected employee changes
  useEffect(() => {
    if (selectedUser) {
      const rate = getEffectiveRate(selectedUser);
      const userStatus = selectedUser.status || (selectedUser.active === false ? 'Inactive' : 'Active');
      setForm({
        employeeId: selectedUser.employeeId || '',
        name: selectedUser.name || selectedUser.username || '',
        department: selectedUser.department || '',
        designation: selectedUser.designation || '',
        joiningDate: selectedUser.joiningDate || '',
        esslId: selectedUser.esslId || '',
        perDayRate: rate.perDayRate || '',
        otRate: rate.otRate || '',
        monthlySalary: selectedUser.monthlySalary || '',
        shiftType: selectedUser.shiftType || '9hr',
        status: userStatus,
        employeeType: selectedUser.employeeType || 'Regular',
        phone: selectedUser.phone || '',
        email: selectedUser.email || '',
        gender: selectedUser.gender || 'Male',
        dob: selectedUser.dob || '',
        emergencyContact: selectedUser.emergencyContact || '',
        address: selectedUser.address || '',
        reportingManager: selectedUser.reportingManager || '',
        workLocation: selectedUser.workLocation || 'Vadodara GIDC Ranoli',
        resignationDate: selectedUser.resignationDate || '',
        bankName: selectedUser.bankName || '',
        accountNumber: selectedUser.accountNumber || '',
        ifscCode: selectedUser.ifscCode || '',
        bankBranch: selectedUser.bankBranch || '',
        aadhaarNo: selectedUser.aadhaarNo || '',
        panNo: selectedUser.panNo || '',
        pfNo: selectedUser.pfNo || '',
        esiNo: selectedUser.esiNo || '',
        role: selectedUser.role || 'Staff',
        permissions: selectedUser.permissions || []
      });
    } else {
      setForm(emptyForm());
    }
  }, [selectedUser]);

  const departmentOptions = [...new Set([...DEPARTMENTS, ...users.map((u) => u.department).filter(Boolean)])];
  const designationOptions = [...new Set(users.map((u) => u.designation).filter(Boolean))];

  const filteredEmployees = employees.filter((u) => {
    const userStatus = u.status || (u.active === false ? 'Inactive' : 'Active');
    if (statusTab !== 'all' && statusTab !== 'pending' && statusTab !== 'mapped' && statusTab !== 'unmapped') {
      if (userStatus !== statusTab) return false;
    }
    if (statusTab === 'pending' && !isPendingApproval(u)) return false;
    if (statusTab === 'mapped' && !u.esslId) return false;
    if (statusTab === 'unmapped' && Boolean(u.esslId)) return false;
    if (mappingFilter === 'mapped' && !u.esslId) return false;
    if (mappingFilter === 'unmapped' && Boolean(u.esslId)) return false;
    if (deptFilter && u.department !== deptFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.employeeId, u.name, u.username, u.department, u.designation, u.shiftType, u.esslId, u.phone, u.email]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const counts = {
    all: employees.length,
    Active: employees.filter((u) => (u.status || (u.active === false ? 'Inactive' : 'Active')) === 'Active').length,
    Inactive: employees.filter((u) => (u.status || (u.active === false ? 'Inactive' : 'Active')) === 'Inactive').length,
    Resigned: employees.filter((u) => u.status === 'Resigned').length,
    'On Hold': employees.filter((u) => u.status === 'On Hold').length,
    pending: employees.filter(isPendingApproval).length,
    mapped: employees.filter((u) => Boolean(u.esslId)).length,
    unmapped: employees.filter((u) => !u.esslId).length
  };

  const approveEmployee = (u) => {
    if (!isAdmin) return;
    if (!window.confirm(`Approve ${u.name || u.employeeId}? Their attendance punches will then sync automatically.`)) return;
    updateItem('users', u.id, { ...u, ...approvalPatch(currentUser) });
  };

  const exportRows = filteredEmployees.map((u) => {
    const rate = getEffectiveRate(u);
    const statusStr = u.status || (u.active === false ? 'Inactive' : 'Active');
    return {
      employeeId: u.employeeId || '',
      name: u.name || u.username || '',
      department: u.department || '',
      designation: u.designation || '',
      joiningDate: formatDate(u.joiningDate) || '',
      phone: u.phone || '',
      email: u.email || '',
      perDayRate: rate.perDayRate || 0,
      otRate: rate.otRate || 0,
      shiftType: u.shiftType || '9hr',
      status: statusStr,
      approval: isPendingApproval(u) ? 'Pending' : 'Approved',
      mappingStatus: u.esslId ? `Mapped (${u.esslId})` : 'Not Mapped',
      esslId: u.esslId || ''
    };
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNewEmployee = () => {
    const nextCode = generateEmployeeId(users);
    setForm({
      ...emptyForm(),
      employeeId: nextCode
    });
    setSelectedUserId(null);
    setViewMode('employee-wise');
    setActiveTab('personal');
  };

  const selectEmployee = (u) => {
    setSelectedUserId(u.id);
    setViewMode('employee-wise');
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
    if (e) e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      alert('Employee Name is required.');
      return;
    }
    const perDayRate = Number(form.perDayRate) || 0;
    const otRate = Number(form.otRate) || 0;
    const status = form.status || 'Active';
    const isActive = status === 'Active' || status === 'On Hold';

    const payload = {
      name,
      employeeId: form.employeeId.trim() || selectedUser?.employeeId || generateEmployeeId(users),
      department: form.department.trim(),
      designation: form.designation.trim(),
      joiningDate: form.joiningDate || '',
      esslId: String(form.esslId || '').trim(),
      biometricMapped: Boolean(String(form.esslId || '').trim()),
      shiftType: form.shiftType || '9hr',
      employeeType: form.employeeType || 'Regular',
      perDayRate,
      otRate,
      monthlySalary: Number(form.monthlySalary) || 0,
      phone: form.phone || '',
      email: form.email || '',
      gender: form.gender || 'Male',
      dob: form.dob || '',
      emergencyContact: form.emergencyContact || '',
      address: form.address || '',
      reportingManager: form.reportingManager || '',
      workLocation: form.workLocation || 'Vadodara GIDC Ranoli',
      resignationDate: form.resignationDate || '',
      bankName: form.bankName || '',
      accountNumber: form.accountNumber || '',
      ifscCode: form.ifscCode || '',
      bankBranch: form.bankBranch || '',
      aadhaarNo: form.aadhaarNo || '',
      panNo: form.panNo || '',
      pfNo: form.pfNo || '',
      esiNo: form.esiNo || '',
      role: form.role || selectedUser?.role || 'Staff',
      permissions: form.permissions || selectedUser?.permissions || [],
      status,
      active: isActive,
      updatedAt: new Date().toISOString()
    };

    if (selectedUserId && selectedUser) {
      const { history, effectiveFrom } = withRateHistory(selectedUser, perDayRate, otRate);
      updateItem('users', selectedUserId, {
        ...selectedUser,
        ...payload,
        rateHistory: history,
        effectiveFrom
      });
    } else {
      const { history, effectiveFrom } = withRateHistory(null, perDayRate, otRate);
      const newId = `emp-${Date.now()}`;
      const newEmpCode = payload.employeeId;
      updateData('users', {
        ...payload,
        id: newId,
        username: newEmpCode.toLowerCase(),
        approvalStatus: 'Pending',
        rateHistory: history,
        effectiveFrom,
        createdAt: new Date().toISOString()
      });
      setSelectedUserId(newId);
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleToggleBiometricUnmap = () => {
    if (!selectedUserId || !selectedUser) return;
    const isMapped = Boolean(form.esslId);
    if (isMapped) {
      if (window.confirm(`Unmap biometric eSSL ID for ${form.name}?`)) {
        setField('esslId', '');
        updateItem('users', selectedUserId, {
          ...selectedUser,
          esslId: '',
          biometricMapped: false
        });
      }
    } else {
      const newId = prompt('Enter eSSL Machine User ID:', '1001');
      if (newId) {
        setField('esslId', newId.trim());
        updateItem('users', selectedUserId, {
          ...selectedUser,
          esslId: newId.trim(),
          biometricMapped: true
        });
      }
    }
  };

  const handleDelete = (u) => {
    const target = u || selectedUser;
    if (!target) return;
    if (target.role === 'Admin' || target.passwordHash) {
      alert('This employee has an admin/login account. Set Status to Inactive or Resigned.');
      return;
    }
    if (window.confirm(`Delete employee ${target.name || target.employeeId}?`)) {
      deleteItemSoftly('users', target.id);
      if (selectedUserId === target.id) {
        const next = employees.find((e) => e.id !== target.id);
        setSelectedUserId(next ? next.id : null);
      }
    }
  };

  const currentStatusObj = EMPLOYEE_STATUS_OPTIONS.find((s) => s.value === (form.status || 'Active')) || EMPLOYEE_STATUS_OPTIONS[0];

  const handlePermissionToggle = (modId) => {
    setForm((prev) => {
      const current = prev.permissions || [];
      const has = current.includes(modId);
      return {
        ...prev,
        permissions: has ? current.filter((p) => p !== modId) : [...current, modId]
      };
    });
  };

  return (
    <div className="pm-page" style={{ paddingBottom: '2rem' }}>
      
      {/* Header Bar */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(155, 98, 196, 0.1)', color: 'var(--accent-primary)', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Employee Master</h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.88rem' }}>Manage employee details, shift, payroll, and biometric mappings.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-input, #f1f5f9)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setViewMode('employee-wise')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'employee-wise' ? 'var(--bg-card, #fff)' : 'transparent',
                color: viewMode === 'employee-wise' ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'employee-wise' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <User size={14} /> Employee-Wise View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--bg-card, #fff)' : 'transparent',
                color: viewMode === 'table' ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <List size={14} /> All Employees Table
            </button>
          </div>

          <button type="button" className="btn btn-primary" onClick={openNewEmployee} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Add Employee
          </button>
          <ExportButton
            data={exportRows}
            columns={[
              { label: 'Employee Code', key: 'employeeId' },
              { label: 'Employee Name', key: 'name' },
              { label: 'Department', key: 'department' },
              { label: 'Designation', key: 'designation' },
              { label: 'Joining Date', key: 'joiningDate' },
              { label: 'Phone', key: 'phone' },
              { label: 'Email', key: 'email' },
              { label: 'Salary/Day Rate', key: 'perDayRate' },
              { label: 'OT Rate', key: 'otRate' },
              { label: 'Shift', key: 'shiftType' },
              { label: 'Status', key: 'status' },
              { label: 'Approval', key: 'approval' },
              { label: 'Mapping Status', key: 'mappingStatus' },
              { label: 'eSSL ID', key: 'esslId' }
            ]}
            filename="Employee_Master"
            title="Employee Master"
          />
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="esm-tabs" style={{ marginBottom: '1.25rem' }}>
        {STATUS_TABS.map((t) => (
          <button key={t.id} type="button" className={`esm-tab ${statusTab === t.id ? 'is-active' : ''}`} onClick={() => setStatusTab(t.id)}>
            {t.label}
            <span className="pm-tab-count">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Top Filter & Employee Quick Selector Row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', flex: 1, minWidth: '240px', padding: '0 1rem' }}>
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Search code, name, department..." 
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '200px' }}>
          <Briefcase size={18} color="#9b62c4" />
          <SearchableSelect className="input-field" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} placeholder="All Departments" style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem' }}>
            <option value="">All Departments</option>
            {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </SearchableSelect>
        </div>

        {/* Mapping Status Filter Dropdown Box */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '200px' }}>
          <CheckSquare size={18} color={mappingFilter === 'mapped' ? '#047857' : mappingFilter === 'unmapped' ? '#dc2626' : '#9b62c4'} />
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={mappingFilter}
            onChange={(e) => setMappingFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', fontWeight: 600 }}
          >
            <option value="all">All Mapping Status</option>
            <option value="mapped">🟢 Mapped ({counts.mapped})</option>
            <option value="unmapped">🔴 Not Mapped ({counts.unmapped})</option>
          </SearchableSelect>
        </div>

        {/* Quick Employee Selector */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem', minWidth: '280px' }}>
          <User size={18} color="var(--accent-primary)" />
          <SearchableSelect
            className="input-field"
            value={selectedUserId || ''}
            onChange={(e) => {
              if (e.target.value === 'NEW') openNewEmployee();
              else {
                const found = employees.find((u) => u.id === e.target.value);
                if (found) selectEmployee(found);
              }
            }}
            style={{ border: 'none', background: 'transparent', padding: '0.85rem', width: '100%', outline: 'none', fontSize: '0.9rem', fontWeight: 600 }}
          >
            <option value="">-- Select Employee --</option>
            {filteredEmployees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.employeeId ? `${u.employeeId} - ` : ''}{u.name || u.username} ({u.department || 'General'})
              </option>
            ))}
            <option value="NEW">+ Add New Employee</option>
          </SearchableSelect>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {viewMode === 'employee-wise' ? (
        /* ================= EMPLOYEE-WISE MASTER-DETAIL VIEW ================= */
        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* LEFT PANEL — Selected Employee Profile & Mappings Summary */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
            
            {/* Top Profile Header */}
            <div style={{ textAlign: 'center', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
              
              {/* Status Badge */}
              <div style={{ position: 'absolute', top: 0, right: 0 }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: currentStatusObj.bg,
                  color: currentStatusObj.color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {currentStatusObj.icon} {currentStatusObj.label}
                </span>
              </div>

              {/* Avatar Circle */}
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(155, 98, 196, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.85rem auto',
                fontSize: '1.8rem',
                fontWeight: 800
              }}>
                {form.name ? form.name.charAt(0).toUpperCase() : <User size={36} />}
              </div>

              <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {form.name || 'New Employee'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {form.employeeId || 'EMP---'}
              </p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {form.department ? `${form.department} Department` : 'No Department'}
              </p>
              {form.joiningDate && (
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Joining Date: <strong>{formatDate(form.joiningDate)}</strong>
                </p>
              )}
            </div>

            {/* Contact Details List */}
            <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
                <Phone size={15} color="var(--accent-primary)" />
                <span>{form.phone || 'No phone number'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                <Mail size={15} color="var(--accent-primary)" />
                <span>{form.email || 'No email address'}</span>
              </div>
            </div>

            {/* Attendance & Biometric Machine Card */}
            <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  eSSL ID (Attendance Machine)
                </span>
                <button type="button" onClick={handleToggleBiometricUnmap} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }} title="Edit Machine ID">
                  <Edit2 size={14} />
                </button>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {form.esslId || <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>Not Mapped</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
                  <span style={{ fontSize: '0.75rem' }}>Biometric Status:</span>
                  <span style={{ color: form.esslId ? '#047857' : '#94a3b8' }}>
                    {form.esslId ? '🟢 Mapped' : '⚪ Unmapped'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleBiometricUnmap}
                  className="btn btn-sm"
                  style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                >
                  {form.esslId ? 'Unmap' : 'Map'}
                </button>
              </div>
            </div>

            {/* Quick Mappings Summary */}
            <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift:</span>
                <strong>{form.shiftType}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Day Rate:</span>
                <strong>₹{form.perDayRate || '0'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>OT Rate:</span>
                <strong>₹{form.otRate || '0'}/hr</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>System Role:</span>
                <strong>{form.role}</strong>
              </div>
            </div>

            {/* Admin Approval Notice */}
            {selectedUser && isPendingApproval(selectedUser) && (
              <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', color: '#a16207', fontWeight: 600 }}>
                  Pending Admin Approval
                </p>
                {isAdmin ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => approveEmployee(selectedUser)} style={{ width: '100%', fontSize: '0.78rem' }}>
                    <CheckCircle2 size={14} /> Approve Employee
                  </button>
                ) : null}
              </div>
            )}

          </div>

          {/* RIGHT PANEL — Employee Details & Configuration Tabs */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
            
            {/* Top Details Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto', gap: '0.5rem' }}>
              {[
                { id: 'personal', label: 'Personal Details', icon: User },
                { id: 'employment', label: 'Employment Details', icon: Briefcase },
                { id: 'shift_salary', label: 'Shift & Salary', icon: CreditCard },
                { id: 'role_permissions', label: 'Role & Permissions', icon: Shield },
                { id: 'documents', label: 'Documents & IDs', icon: FileText }
              ].map((t) => {
                const IconComp = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.75rem 1.25rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      marginBottom: '-2px',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontWeight: isActive ? 700 : 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    <IconComp size={16} /> {t.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSave}>
              
              {/* TAB 1: PERSONAL DETAILS */}
              {activeTab === 'personal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <Field label="Employee Code" required hint="Unique ID assigned to the employee">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="input-field"
                        value={form.employeeId}
                        onChange={(e) => setField('employeeId', e.target.value)}
                        placeholder="e.g. EMP009"
                        style={{ flex: 1, fontWeight: 700 }}
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setField('employeeId', generateEmployeeId(users))}
                        title="Generate next code"
                        style={{ padding: '0.5rem 0.75rem' }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </Field>

                  <Field label="Employee Name" required>
                    <input className="input-field" required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Full Name" />
                  </Field>

                  <Field label="Shift" required>
                    <SearchableSelect className="input-field" allowCustom={false} value={form.shiftType} onChange={(e) => setField('shiftType', e.target.value)}>
                      {SHIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </SearchableSelect>
                  </Field>

                  <Field label="Department" required>
                    <SearchableSelect className="input-field" value={form.department} onChange={(e) => setField('department', e.target.value)} placeholder="Select or type department">
                      <option value="">Select or type department</option>
                      {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </SearchableSelect>
                  </Field>

                  <Field label="Designation" required>
                    <SearchableSelect className="input-field" value={form.designation} onChange={(e) => setField('designation', e.target.value)} placeholder="Select or type designation">
                      <option value="">Select or type designation</option>
                      {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </SearchableSelect>
                  </Field>

                  <Field label="Status" required>
                    <SearchableSelect className="input-field" allowCustom={false} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                      {EMPLOYEE_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                      ))}
                    </SearchableSelect>
                  </Field>

                  <Field label="Joining Date" required>
                    <DateField className="input-field" value={form.joiningDate} onChange={(e) => setField('joiningDate', e.target.value)} />
                  </Field>

                  <Field label="eSSL ID (Attendance Machine)" hint="Biometric attendance machine ID">
                    <input className="input-field" value={form.esslId} onChange={(e) => setField('esslId', e.target.value)} placeholder="e.g. 1025" />
                  </Field>

                  <Field label="Biometric Mapping Status">
                    <SearchableSelect
                      className="input-field"
                      allowCustom={false}
                      value={form.esslId ? 'Mapped' : 'Not Mapped'}
                      onChange={(e) => {
                        if (e.target.value === 'Not Mapped') {
                          setField('esslId', '');
                        } else if (!form.esslId) {
                          const newId = prompt('Enter eSSL Machine User ID:', '1001');
                          if (newId) setField('esslId', newId.trim());
                        }
                      }}
                    >
                      <option value="Mapped">🟢 Mapped</option>
                      <option value="Not Mapped">🔴 Not Mapped</option>
                    </SearchableSelect>
                  </Field>

                  <Field label="Employee Type">
                    <SearchableSelect className="input-field" allowCustom={false} value={form.employeeType} onChange={(e) => setField('employeeType', e.target.value)}>
                      <option value="Regular">Regular</option>
                      <option value="Contract">Contract</option>
                      <option value="Probation">Probation</option>
                      <option value="Trainee">Trainee</option>
                      <option value="Daily Wage">Daily Wage</option>
                    </SearchableSelect>
                  </Field>

                  <Field label="Salary/Day Rate (₹)">
                    <input type="number" step="any" min="0" className="input-field" value={form.perDayRate} onChange={(e) => setField('perDayRate', e.target.value)} placeholder="e.g. 600" />
                  </Field>

                  <Field label="OT Rate (₹/Hr)">
                    <input type="number" step="any" min="0" className="input-field" value={form.otRate} onChange={(e) => setField('otRate', e.target.value)} placeholder="e.g. 80" />
                  </Field>

                  <Field label="Employee Status">
                    <SearchableSelect className="input-field" allowCustom={false} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                      {EMPLOYEE_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                      ))}
                    </SearchableSelect>
                  </Field>

                  <Field label="Phone / Mobile">
                    <input className="input-field" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+91 98765 43210" />
                  </Field>

                  <Field label="Email Address">
                    <input type="email" className="input-field" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@company.com" />
                  </Field>

                  <Field label="Gender">
                    <SearchableSelect className="input-field" allowCustom={false} value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </SearchableSelect>
                  </Field>

                  <Field label="Date of Birth">
                    <DateField className="input-field" value={form.dob} onChange={(e) => setField('dob', e.target.value)} />
                  </Field>

                  <Field label="Emergency Contact">
                    <input className="input-field" value={form.emergencyContact} onChange={(e) => setField('emergencyContact', e.target.value)} placeholder="Name & Phone" />
                  </Field>

                  <div style={{ gridColumn: 'span 3' }}>
                    <Field label="Residential Address">
                      <input className="input-field" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street, City, Pincode" />
                    </Field>
                  </div>
                </div>
              )}

              {/* TAB 2: EMPLOYMENT DETAILS */}
              {activeTab === 'employment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Department">
                    <SearchableSelect className="input-field" value={form.department} onChange={(e) => setField('department', e.target.value)}>
                      {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </SearchableSelect>
                  </Field>

                  <Field label="Designation">
                    <SearchableSelect className="input-field" value={form.designation} onChange={(e) => setField('designation', e.target.value)}>
                      {designationOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </SearchableSelect>
                  </Field>

                  <Field label="Employee Type">
                    <SearchableSelect className="input-field" allowCustom={false} value={form.employeeType} onChange={(e) => setField('employeeType', e.target.value)}>
                      <option value="Regular">Regular</option>
                      <option value="Contract">Contract</option>
                      <option value="Probation">Probation</option>
                      <option value="Trainee">Trainee</option>
                    </SearchableSelect>
                  </Field>

                  <Field label="Employee Status (Active / Inactive / Resigned / On Hold)" required>
                    <SearchableSelect className="input-field" allowCustom={false} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                      {EMPLOYEE_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                      ))}
                    </SearchableSelect>
                  </Field>

                  <Field label="Joining Date">
                    <DateField className="input-field" value={form.joiningDate} onChange={(e) => setField('joiningDate', e.target.value)} />
                  </Field>

                  {form.status === 'Resigned' && (
                    <Field label="Resignation / Exit Date">
                      <DateField className="input-field" value={form.resignationDate} onChange={(e) => setField('resignationDate', e.target.value)} />
                    </Field>
                  )}

                  <Field label="Reporting Manager">
                    <SearchableSelect className="input-field" value={form.reportingManager} onChange={(e) => setField('reportingManager', e.target.value)} placeholder="Select manager">
                      <option value="">None</option>
                      {employees.filter((e) => e.id !== selectedUserId).map((e) => (
                        <option key={e.id} value={e.name}>{e.name} ({e.department || 'Staff'})</option>
                      ))}
                    </SearchableSelect>
                  </Field>

                  <Field label="Work Location / Branch">
                    <input className="input-field" value={form.workLocation} onChange={(e) => setField('workLocation', e.target.value)} />
                  </Field>
                </div>
              )}

              {/* TAB 3: SHIFT & SALARY */}
              {activeTab === 'shift_salary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Shift Mapping Card */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={16} /> Shift & Timing Mapping
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <Field label="Shift Type">
                        <SearchableSelect className="input-field" allowCustom={false} value={form.shiftType} onChange={(e) => setField('shiftType', e.target.value)}>
                          {SHIFT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </SearchableSelect>
                      </Field>
                      <Field label="eSSL Machine User ID">
                        <input className="input-field" value={form.esslId} onChange={(e) => setField('esslId', e.target.value)} placeholder="Biometric Machine User ID" />
                      </Field>
                    </div>
                  </div>

                  {/* Salary Mapping Card */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#f8fafc' }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CreditCard size={16} /> Payroll & Salary Mapping
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <Field label="Salary/Day Rate (₹)">
                        <input type="number" step="any" min="0" className="input-field" value={form.perDayRate} onChange={(e) => setField('perDayRate', e.target.value)} />
                      </Field>
                      <Field label="OT Rate (₹/Hr)">
                        <input type="number" step="any" min="0" className="input-field" value={form.otRate} onChange={(e) => setField('otRate', e.target.value)} />
                      </Field>
                      <Field label="Monthly Basic Salary (₹)">
                        <input type="number" step="any" min="0" className="input-field" value={form.monthlySalary} onChange={(e) => setField('monthlySalary', e.target.value)} placeholder="Monthly gross" />
                      </Field>
                      <Field label="Bank Name">
                        <input className="input-field" value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} placeholder="e.g. AXIS BANK" />
                      </Field>
                      <Field label="Account Number">
                        <input className="input-field" value={form.accountNumber} onChange={(e) => setField('accountNumber', e.target.value)} />
                      </Field>
                      <Field label="IFSC Code">
                        <input className="input-field" value={form.ifscCode} onChange={(e) => setField('ifscCode', e.target.value)} placeholder="e.g. UTIB0000383" />
                      </Field>
                    </div>
                  </div>

                  {/* Rate History */}
                  {selectedUser && selectedUser.rateHistory && selectedUser.rateHistory.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Salary Rate Revision History
                      </h4>
                      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '4px 8px' }}>Effective From</th>
                            <th style={{ padding: '4px 8px' }}>Per Day Rate</th>
                            <th style={{ padding: '4px 8px' }}>OT Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.rateHistory.map((h, i) => (
                            <tr key={h.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '6px 8px' }}>{formatDate(h.effectiveFrom)}</td>
                              <td style={{ padding: '6px 8px' }}>₹{h.perDayRate}</td>
                              <td style={{ padding: '6px 8px' }}>₹{h.otRate}/hr</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: ROLE & PERMISSIONS */}
              {activeTab === 'role_permissions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <Field label="System Role">
                      <SearchableSelect className="input-field" allowCustom={false} value={form.role} onChange={(e) => setField('role', e.target.value)}>
                        <option value="Staff">Staff / Employee</option>
                        <option value="Operator">Operator</option>
                        <option value="Manager">Manager</option>
                        <option value="Admin">Administrator</option>
                      </SearchableSelect>
                    </Field>
                  </div>

                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckSquare size={16} /> Module Access & Permissions
                    </h4>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Select which ERP modules this employee is authorized to access.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {ALL_MODULES.map((m) => {
                        const isChecked = (form.permissions || []).includes(m.id);
                        return (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem', borderRadius: '6px', background: isChecked ? 'rgba(155, 98, 196, 0.05)' : 'transparent', border: '1px solid var(--border-color)' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handlePermissionToggle(m.id)}
                            />
                            <span>{m.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DOCUMENTS & IDS */}
              {activeTab === 'documents' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Aadhaar Number">
                    <input className="input-field" value={form.aadhaarNo} onChange={(e) => setField('aadhaarNo', e.target.value)} placeholder="12-digit Aadhaar" />
                  </Field>
                  <Field label="PAN Card Number">
                    <input className="input-field" value={form.panNo} onChange={(e) => setField('panNo', e.target.value)} placeholder="10-digit PAN" />
                  </Field>
                  <Field label="PF / UAN Number">
                    <input className="input-field" value={form.pfNo} onChange={(e) => setField('pfNo', e.target.value)} />
                  </Field>
                  <Field label="ESIC Number">
                    <input className="input-field" value={form.esiNo} onChange={(e) => setField('esiNo', e.target.value)} />
                  </Field>
                </div>
              )}

              {/* Save & Action Footer */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {savedNotice && (
                    <span style={{ color: '#047857', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={16} /> Saved successfully!
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {selectedUser && (
                    <button type="button" className="btn pm-btn-outline danger" onClick={() => handleDelete(selectedUser)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Trash2 size={14} /> Delete Employee
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.5rem' }}>
                    <Save size={16} /> {selectedUserId ? 'Save Employee Details' : 'Create Employee'}
                  </button>
                </div>
              </div>

            </form>

          </div>

        </div>
      ) : (
        /* ================= MODE 2: ALL EMPLOYEES TABLE VIEW ================= */
        <section className="premium-card pm-card">
          <div className="pm-list-head">
            <h2 className="pm-card-title" style={{ margin: 0 }}>
              <Users size={16} /> All Employees Directory ({filteredEmployees.length})
            </h2>
          </div>

          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Joining Date</th>
                  <th>Day Rate</th>
                  <th>OT Rate</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Mapping Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={12} className="pm-empty">No employees found matching filters.</td></tr>
                ) : filteredEmployees.map((u) => {
                  const rate = getEffectiveRate(u);
                  const userStatus = u.status || (u.active === false ? 'Inactive' : 'Active');
                  const statusObj = EMPLOYEE_STATUS_OPTIONS.find((s) => s.value === userStatus) || EMPLOYEE_STATUS_OPTIONS[0];
                  const isMapped = Boolean(u.esslId);

                  return (
                    <tr key={u.id} className="pm-click-row" title="Click to view employee details" onClick={() => selectEmployee(u)}>
                      <td><strong>{u.employeeId || '—'}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(155, 98, 196, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                            {u.name ? u.name.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <span>{u.name || u.username}</span>
                        </div>
                      </td>
                      <td>{u.department || '—'}</td>
                      <td>{u.designation || '—'}</td>
                      <td>{formatDate(u.joiningDate) || '—'}</td>
                      <td>{rate.perDayRate ? money(rate.perDayRate) : '—'}</td>
                      <td>{rate.otRate ? money(rate.otRate) : '—'}</td>
                      <td><span className="esm-chip">{u.shiftType || '9hr'}</span></td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          background: statusObj.bg,
                          color: statusObj.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          {statusObj.icon} {statusObj.label}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {isPendingApproval(u) ? (
                          isAdmin ? (
                            <button type="button" className="btn btn-primary esm-approve-btn" onClick={() => approveEmployee(u)}>
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          ) : <span className="pm-pill is-pending">Pending</span>
                        ) : (
                          <span className="pm-pill is-approved">Approved</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '10px',
                          background: isMapped ? '#ecfdf5' : '#fef2f2',
                          color: isMapped ? '#047857' : '#dc2626',
                          border: isMapped ? '1px solid #a7f3d0' : '1px solid #fecaca',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isMapped ? `🟢 Mapped (${u.esslId})` : '🔴 Not Mapped'}
                        </span>
                      </td>
                      <td className="pm-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" title="View & Edit Employee-Wise" onClick={() => selectEmployee(u)}><User size={14} /></button>
                        <button type="button" title="Delete" className="danger" onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
};

export default EmployeeMaster;
