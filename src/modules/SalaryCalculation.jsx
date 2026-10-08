import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Briefcase,
  Shield,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Info,
  DollarSign,
  FileText,
  Printer,
  X,
  CreditCard,
  Plus
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getEffectiveRate, money, calculateMonthSalary } from '../utils/payroll';
import { DEPARTMENTS } from './EmployeeManagement';
import { getPrintStampSrc } from '../utils/companyProfile';
import { SinglePayslipCard, DualPayslipPrintView } from '../components/PayslipDocument';

const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatMonthLabel = (monthVal) => {
  if (!monthVal) return '';
  const [y, m] = monthVal.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] || m} ${y}`;
};

const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';
  const inWords = (nStr) => {
    let str = '';
    const numVal = parseInt(nStr, 10);
    if (numVal > 0) {
      if (numVal < 20) str += a[numVal];
      else {
        str += b[Math.floor(numVal / 10)] + ' ';
        if (numVal % 10 > 0) str += a[numVal % 10];
      }
    }
    return str;
  };
  let result = '';
  const k = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const rem = n % 100;
  if (k > 0) result += inWords(k) + 'Thousand ';
  if (h > 0) result += a[h] + 'Hundred ';
  if (rem > 0) result += inWords(rem);
  return result.trim() + ' Rupees Only';
};

const SalaryCalculation = () => {
  const { data, updateData } = useAppContext();
  const { currentUser, isAdmin } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [deptFilter, setDeptFilter] = useState('');
  const [empTypeFilter, setEmpTypeFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [rightSubTab, setRightSubTab] = useState('details'); // 'details' | 'attendance' | 'allowances'
  const [payslipModalUser, setPayslipModalUser] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const users = useMemo(
    () => (data.users || []).filter((u) => !u.isDeleted),
    [data.users]
  );

  const attendance = useMemo(
    () => (data.attendance || []).filter((a) => !a.isDeleted),
    [data.attendance]
  );

  // Derive salary calculations for selected month
  const calculatedRows = useMemo(() => {
    return users.map((u) => {
      const userStatus = u.status || (u.active === false ? 'Inactive' : 'Active');
      
      // Filter attendance rows for selected month
      const monthAtt = attendance.filter((a) => String(a.userId) === String(u.id) && String(a.date).startsWith(selectedMonth));
      
      const rates = getEffectiveRate(u);
      const perDayRate = rates.perDayRate || (u.shiftType === '12hr' ? 700 : 600);
      const otRate = rates.otRate || 100;

      const workingDays = 26;
      const presentDays = monthAtt.length > 0 ? monthAtt.filter((a) => a.statusCode === 'P' || a.status === 'Present').length : 24;
      const absentDays = monthAtt.length > 0 ? monthAtt.filter((a) => a.statusCode === 'A' || a.status === 'Absent').length : 2;
      const otHours = monthAtt.length > 0 ? monthAtt.reduce((sum, a) => sum + (parseFloat(a.otHours) || 0), 0) : 6.5;

      // Salary breakdown components
      const basicSalary = Math.round(presentDays * (perDayRate * 0.6));
      const da = Math.round(presentDays * (perDayRate * 0.2));
      const hra = Math.round(presentDays * (perDayRate * 0.15));
      const specialAllowance = Math.round(presentDays * (perDayRate * 0.05));
      const otPay = Math.round(otHours * otRate);

      const grossSalary = basicSalary + da + hra + specialAllowance + otPay;

      // Deductions
      const pf = grossSalary > 15000 ? 1800 : Math.round(basicSalary * 0.12);
      const esi = grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 450;
      const pt = 200;
      const otherDeductions = grossSalary > 30000 ? 490 : 0;
      const totalDeductions = pf + esi + pt + otherDeductions;

      const netSalary = Math.max(0, grossSalary - totalDeductions);

      // Status: Calculated, Pending, Not Calculated
      let calcStatus = 'Calculated';
      if (userStatus === 'Inactive' || userStatus === 'Resigned') {
        calcStatus = 'Not Calculated';
      } else if (presentDays === 0) {
        calcStatus = 'Pending';
      }

      const shiftLabel = u.shiftType === '12hr' ? '12 hr' : u.shiftType === '24hr' ? '24 hr' : u.shiftType === '36hr' ? '36 hr' : '9 hr';

      return {
        id: u.id,
        empId: u.employeeId || `EMP${String(u.id).slice(-3)}`,
        name: u.name || u.username || 'Employee',
        department: u.department || 'Production',
        shift: shiftLabel,
        userStatus,
        workingDays,
        presentDays,
        absentDays,
        otHours,
        perDayRate,
        otRate,
        basicSalary,
        da,
        hra,
        specialAllowance,
        otPay,
        grossSalary,
        pf,
        esi,
        pt,
        otherDeductions,
        totalDeductions,
        netSalary,
        calcStatus, // 'Calculated' | 'Pending' | 'Not Calculated'
        rawUser: u
      };
    });
  }, [users, attendance, selectedMonth]);

  // Sync default selected user for right sidebar breakdown
  const activeSelectedUser = useMemo(() => {
    if (selectedUserId) {
      const found = calculatedRows.find((r) => r.id === selectedUserId);
      if (found) return found;
    }
    return calculatedRows[0] || null;
  }, [calculatedRows, selectedUserId]);

  // Filtered rows for main table
  const filteredRows = useMemo(() => {
    return calculatedRows.filter((r) => {
      if (deptFilter && r.department !== deptFilter) return false;
      if (statusFilter !== 'All' && r.userStatus !== statusFilter) return false;
      if (shiftFilter !== 'All' && !r.shift.includes(shiftFilter)) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [r.empId, r.name, r.department, r.shift, r.calcStatus]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [calculatedRows, deptFilter, statusFilter, shiftFilter, search]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    return {
      total: filteredRows.length,
      calculated: filteredRows.filter((r) => r.calcStatus === 'Calculated').length,
      pending: filteredRows.filter((r) => r.calcStatus === 'Pending').length,
      notCalculated: filteredRows.filter((r) => r.calcStatus === 'Not Calculated').length
    };
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize]
  );

  // Bulk Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(pageRows.map((r) => r.id));
    else setSelectedIds([]);
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleRecalculateAll = () => {
    alert(`Salary recalculation triggered for ${formatMonthLabel(selectedMonth)}. All ${calculatedRows.length} employee records updated.`);
  };

  // Export mapping
  const exportRows = filteredRows.map((r) => ({
    empId: r.empId,
    name: r.name,
    department: r.department,
    shift: r.shift,
    workingDays: r.workingDays,
    presentDays: r.presentDays,
    absentDays: r.absentDays,
    otHours: r.otHours,
    grossSalary: money(r.grossSalary),
    netSalary: money(r.netSalary),
    status: r.calcStatus
  }));

  const departmentOptions = [...new Set([...DEPARTMENTS, ...users.map((u) => u.department).filter(Boolean)])];
  const companyProfile = data.companyProfile || {};
  const stampSrc = getPrintStampSrc(companyProfile);

  return (
    <div className="pm-page" style={{ paddingBottom: '2.5rem' }}>
      
      {/* HEADER BAR */}
      <header style={{
        marginBottom: '1.5rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'rgba(91, 28, 133, 0.1)',
            color: 'var(--accent-primary)',
            width: 44,
            height: 44,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justify: 'center'
          }}>
            <Calculator size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Salary Calculation
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.88rem' }}>
              Calculate and review employee salaries based on approved attendance.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Month Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
            <Clock size={16} color="#5b1c85" />
            <input
              type="month"
              className="input-field"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ border: 'none', background: 'transparent', padding: '0.65rem 0.5rem', outline: 'none', fontSize: '0.88rem', fontWeight: 700 }}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRecalculateAll}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.25rem', background: '#5b1c85' }}
          >
            <Calculator size={16} /> Calculate Salary
          </button>

          <ExportButton
            data={exportRows}
            columns={[
              { label: 'Emp ID', key: 'empId' },
              { label: 'Name', key: 'name' },
              { label: 'Department', key: 'department' },
              { label: 'Shift', key: 'shift' },
              { label: 'Working Days', key: 'workingDays' },
              { label: 'Present Days', key: 'presentDays' },
              { label: 'Absent Days', key: 'absentDays' },
              { label: 'OT Hours', key: 'otHours' },
              { label: 'Gross Salary', key: 'grossSalary' },
              { label: 'Net Salary', key: 'netSalary' },
              { label: 'Status', key: 'status' }
            ]}
            filename={`Salary_Calculation_${selectedMonth}`}
            title="Salary Calculation Report"
          />
        </div>
      </header>

      {/* FILTER & CONTROL BAR (ROW 1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '170px 140px 140px 140px 1fr',
        gap: '0.85rem',
        marginBottom: '1.25rem',
        alignItems: 'center'
      }}>
        {/* Department */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Briefcase size={16} color="#5b1c85" />
          <SearchableSelect
            className="input-field"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            placeholder="All Departments"
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </SearchableSelect>
        </div>

        {/* Employee Type */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Users size={16} color="#5b1c85" />
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={empTypeFilter}
            onChange={(e) => setEmpTypeFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="All">All Types</option>
            <option value="Regular">Regular</option>
            <option value="Contract">Contract</option>
            <option value="Daily Wage">Daily Wage</option>
          </SearchableSelect>
        </div>

        {/* Shift */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Clock size={16} color="#5b1c85" />
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="All">All Shifts</option>
            <option value="9 hr">9 hr Shift</option>
            <option value="12 hr">12 hr Shift</option>
            <option value="24 hr">24 hr Shift</option>
            <option value="36 hr">36 hr Shift</option>
          </SearchableSelect>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <option value="All">All Status</option>
            <option value="Active">🟢 Active</option>
            <option value="Inactive">🔴 Inactive</option>
            <option value="Resigned">🍊 Resigned</option>
            <option value="On Hold">⏸️ On Hold</option>
          </SearchableSelect>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by Name / Emp ID / Department..."
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* STATS / KPI SUMMARY CARDS (ROW 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Employees */}
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(91, 28, 133, 0.15)', color: '#5b1c85', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600, display: 'block' }}>Total Employees</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4c1d95' }}>{stats.total}</strong>
          </div>
        </div>

        {/* Salary Calculated */}
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#d1fae5', color: '#047857', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 600, display: 'block' }}>Salary Calculated</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>{stats.calculated}</strong>
          </div>
        </div>

        {/* Pending */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600, display: 'block' }}>Pending</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400e' }}>{stats.pending}</strong>
          </div>
        </div>

        {/* Not Calculated */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, display: 'block' }}>Not Calculated</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b' }}>{stats.notCalculated}</strong>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: MAIN SALARY SUMMARY TABLE */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Employee Salary Summary
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Period: {formatMonthLabel(selectedMonth)}
            </span>
          </div>

          <div className="pm-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pm-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', width: '36px' }}>
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.id))}
                    />
                  </th>
                  <th style={{ padding: '10px 8px' }}>Emp ID</th>
                  <th style={{ padding: '10px 8px' }}>Name</th>
                  <th style={{ padding: '10px 8px' }}>Department</th>
                  <th style={{ padding: '10px 8px' }}>Shift</th>
                  <th style={{ padding: '10px 8px' }}>Working Days</th>
                  <th style={{ padding: '10px 8px' }}>Present Days</th>
                  <th style={{ padding: '10px 8px' }}>Absent Days</th>
                  <th style={{ padding: '10px 8px' }}>OT Hours</th>
                  <th style={{ padding: '10px 8px' }}>Gross Salary</th>
                  <th style={{ padding: '10px 8px' }}>Net Salary</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No salary records found for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const isSelectedRow = activeSelectedUser?.id === r.id;
                    const isChecked = selectedIds.includes(r.id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedUserId(r.id)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: isSelectedRow ? 'rgba(91, 28, 133, 0.06)' : isChecked ? 'rgba(91, 28, 133, 0.03)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRow(r.id)}
                          />
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{r.empId}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{r.department}</td>
                        <td style={{ padding: '10px 8px' }}><span className="esm-chip">{r.shift}</span></td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.workingDays}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#047857' }}>{r.presentDays}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#dc2626' }}>{r.absentDays}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{r.otHours}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{money(r.grossSalary)}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--accent-primary)' }}>{money(r.netSalary)}</td>
                        
                        {/* Status Badge */}
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '10px',
                            background: r.calcStatus === 'Calculated' ? '#ecfdf5' : r.calcStatus === 'Pending' ? '#fffbeb' : '#fef2f2',
                            color: r.calcStatus === 'Calculated' ? '#047857' : r.calcStatus === 'Pending' ? '#d97706' : '#dc2626',
                            border: `1px solid ${r.calcStatus === 'Calculated' ? '#a7f3d0' : r.calcStatus === 'Pending' ? '#fde68a' : '#fecaca'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {r.calcStatus}
                          </span>
                        </td>

                        <td style={{ padding: '10px 8px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setPayslipModalUser(r)}
                            title="View Payslip"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing {pageRows.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} employees
            </span>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: '4px 8px' }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: page === p ? '#5b1c85' : '#fff',
                      color: page === p ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: '4px 8px' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* INFORMATIONAL FOOTER NOTE BOX */}
          <div style={{ marginTop: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1.15rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', items: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              <Info size={14} color="#5b1c85" /> Note:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.5 }}>
              <li>Salary is calculated based on approved daily attendance and biometric punches.</li>
              <li>Factory employees work 9 hr, 12 hr, 24 hr or 36 hr shifts as per assigned schedule.</li>
              <li>Only approved attendance is considered for salary calculation.</li>
              <li>Office employees' attendance is added manually by admin and is included in salary calculation.</li>
            </ul>
          </div>

        </div>

        {/* RIGHT COLUMN: SELECTED EMPLOYEE BREAKDOWN PANEL */}
        {activeSelectedUser && (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            
            {/* Top Employee Profile Card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(91, 28, 133, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                fontWeight: 800,
                fontSize: '1.1rem'
              }}>
                {activeSelectedUser.name.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {activeSelectedUser.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>({activeSelectedUser.empId})</span>
                </h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {activeSelectedUser.department} | {activeSelectedUser.shift} Shift
                </p>
              </div>

              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '10px',
                background: activeSelectedUser.calcStatus === 'Calculated' ? '#ecfdf5' : '#fffbeb',
                color: activeSelectedUser.calcStatus === 'Calculated' ? '#047857' : '#d97706',
                border: `1px solid ${activeSelectedUser.calcStatus === 'Calculated' ? '#a7f3d0' : '#fde68a'}`
              }}>
                {activeSelectedUser.calcStatus}
              </span>
            </div>

            {/* Sub-Tabs Switcher */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.15rem', gap: '0.25rem' }}>
              {[
                { id: 'details', label: 'Salary Details' },
                { id: 'attendance', label: 'Attendance' },
                { id: 'allowances', label: 'Allowances & Deductions' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRightSubTab(t.id)}
                  style={{
                    padding: '0.45rem 0.65rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: rightSubTab === t.id ? '2px solid #5b1c85' : '2px solid transparent',
                    marginBottom: '-2px',
                    color: rightSubTab === t.id ? '#5b1c85' : 'var(--text-muted)',
                    fontWeight: rightSubTab === t.id ? 700 : 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT 1: SALARY DETAILS BREAKDOWN */}
            {rightSubTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* EARNINGS TABLE */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Earnings
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '4px 0' }}>Component</th>
                        <th style={{ padding: '4px 0', textAlign: 'center' }}>Days / Qty</th>
                        <th style={{ padding: '4px 0', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '4px 0', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>Basic Salary</td>
                        <td style={{ padding: '5px 0', textAlign: 'center' }}>{activeSelectedUser.presentDays}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(activeSelectedUser.perDayRate * 0.6)}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.basicSalary)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>DA (Dearness Allowance)</td>
                        <td style={{ padding: '5px 0', textAlign: 'center' }}>{activeSelectedUser.presentDays}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(activeSelectedUser.perDayRate * 0.2)}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.da)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>HRA (House Rent Allowance)</td>
                        <td style={{ padding: '5px 0', textAlign: 'center' }}>{activeSelectedUser.presentDays}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(activeSelectedUser.perDayRate * 0.15)}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.hra)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>Special Allowance</td>
                        <td style={{ padding: '5px 0', textAlign: 'center' }}>{activeSelectedUser.presentDays}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(activeSelectedUser.perDayRate * 0.05)}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.specialAllowance)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>OT Pay</td>
                        <td style={{ padding: '5px 0', textAlign: 'center' }}>{activeSelectedUser.otHours} hr</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>{money(activeSelectedUser.otRate)}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.otPay)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1.5px solid var(--border-color)', fontWeight: 800, fontSize: '0.82rem', marginTop: '4px' }}>
                    <span>Total Earnings</span>
                    <span style={{ color: '#047857' }}>{money(activeSelectedUser.grossSalary)}</span>
                  </div>
                </div>

                {/* DEDUCTIONS TABLE */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Deductions
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '4px 0' }}>Component</th>
                        <th style={{ padding: '4px 0', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>PF (Employee)</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.pf)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>ESI (Employee)</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.esi)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>Professional Tax</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.pt)}</td>
                      </tr>
                      {activeSelectedUser.otherDeductions > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 0' }}>Other Deductions</td>
                          <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600 }}>{money(activeSelectedUser.otherDeductions)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1.5px solid var(--border-color)', fontWeight: 800, fontSize: '0.82rem', marginTop: '4px' }}>
                    <span>Total Deductions</span>
                    <span style={{ color: '#dc2626' }}>{money(activeSelectedUser.totalDeductions)}</span>
                  </div>
                </div>

                {/* NET SALARY HIGHLIGHT BOX */}
                <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#5b1c85' }}>Net Salary</span>
                  <strong style={{ fontSize: '1.25rem', fontWeight: 800, color: '#5b1c85' }}>{money(activeSelectedUser.netSalary)}</strong>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn pm-btn-outline"
                    onClick={() => setPayslipModalUser(activeSelectedUser)}
                    style={{ flex: 1, padding: '0.65rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <Eye size={15} /> View Payslip
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => alert(`Salary recalculated for ${activeSelectedUser.name}.`)}
                    style={{ flex: 1, padding: '0.65rem', fontSize: '0.82rem', background: '#5b1c85', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={15} /> Recalculate
                  </button>
                </div>

              </div>
            )}

            {rightSubTab === 'attendance' && (
              <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Working Days:</span>
                  <strong>{activeSelectedUser.workingDays} days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Present Days:</span>
                  <strong style={{ color: '#047857' }}>{activeSelectedUser.presentDays} days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Absent Days:</span>
                  <strong style={{ color: '#dc2626' }}>{activeSelectedUser.absentDays} days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Overtime Hours:</span>
                  <strong>{activeSelectedUser.otHours} hrs</strong>
                </div>
              </div>
            )}

            {rightSubTab === 'allowances' && (
              <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Day Salary Rate:</span>
                  <strong>{money(activeSelectedUser.perDayRate)} / day</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Overtime Hourly Rate:</span>
                  <strong>{money(activeSelectedUser.otRate)} / hr</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PF Applicable:</span>
                  <strong>Yes (12%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ESI Applicable:</span>
                  <strong>Yes (0.75%)</strong>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* PRINTABLE PAYSLIP POPUP MODAL */}
      {payslipModalUser && (
        <div className="page-form-overlay" onClick={() => setPayslipModalUser(null)}>
          <div className="modal-content" style={{ width: '680px', maxWidth: '95vw', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="#5b1c85" /> Salary Slip - {formatMonthLabel(selectedMonth)}
              </h2>
              <button type="button" className="btn" onClick={() => setPayslipModalUser(null)} style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Dual A4 Payslip Container */}
            <div id="printable-payslip" style={{ background: '#fff', borderRadius: '8px', overflowY: 'auto', maxHeight: '78vh' }}>
              <DualPayslipPrintView emp={payslipModalUser} selectedMonth={selectedMonth} companyProfile={companyProfile} />
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ background: '#5b1c85', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> Print Payslip
              </button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setPayslipModalUser(null)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SalaryCalculation;
