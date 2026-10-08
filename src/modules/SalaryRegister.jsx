import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Briefcase,
  DollarSign,
  Download,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Settings,
  MoreVertical
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getEffectiveRate, money } from '../utils/payroll';
import { DEPARTMENTS } from './EmployeeManagement';
import { useNavigate } from 'react-router-dom';

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

const SalaryRegister = () => {
  const { data } = useAppContext();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [deptFilter, setDeptFilter] = useState('');
  const [empTypeFilter, setEmpTypeFilter] = useState('Factory Employees'); // 'All' | 'Factory Employees' | 'Office Employees'
  const [shiftFilter, setShiftFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const users = useMemo(
    () => (data.users || []).filter((u) => !u.isDeleted && u.active !== false),
    [data.users]
  );

  const attendance = useMemo(
    () => (data.attendance || []).filter((a) => !a.isDeleted),
    [data.attendance]
  );

  // Compute Register Rows
  const registerRows = useMemo(() => {
    return users.map((u) => {
      const monthAtt = attendance.filter((a) => String(a.userId) === String(u.id) && String(a.date).startsWith(selectedMonth));
      const rates = getEffectiveRate(u);

      const category = u.employeeType === 'Office' || ['admin', 'accounts', 'hr'].some(d => String(u.department || '').toLowerCase().includes(d)) ? 'Office Employees' : 'Factory Employees';

      const daysPresent = monthAtt.length > 0 ? monthAtt.filter((a) => a.statusCode === 'P' || a.status === 'Present').length : 26;
      const otHours = monthAtt.length > 0 ? monthAtt.reduce((sum, a) => sum + (parseFloat(a.otHours) || 0), 0) : (u.shiftType === '12hr' ? 12 : 6.5);

      const perDayRate = rates.perDayRate || (u.shiftType === '12hr' ? 800 : 700);
      const otRate = rates.otRate || 100;

      const basicSalary = Math.round(daysPresent * perDayRate * 0.8);
      const otAmount = Math.round(otHours * otRate);
      const otherAllowances = Math.round(daysPresent * 40);

      const grossSalary = basicSalary + otAmount + otherAllowances;

      // Deductions
      const pf = Math.round(basicSalary * 0.08);
      const esi = Math.round(grossSalary * 0.0075);
      const pt = 200;
      const deductions = pf + esi + pt;

      const netSalary = Math.max(0, grossSalary - deductions);
      const status = daysPresent > 0 ? 'Calculated' : 'Pending';

      return {
        id: u.id,
        empId: u.employeeId || `EMP${String(u.id).slice(-3)}`,
        name: u.name || u.username || 'Employee',
        department: u.department || 'Production',
        designation: u.designation || 'Machine Operator',
        category,
        shift: u.shiftType || '9 hr',
        daysPresent,
        basicSalary,
        otAmount,
        otherAllowances,
        grossSalary,
        deductions,
        netSalary,
        status,
        rawUser: u
      };
    });
  }, [users, attendance, selectedMonth]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return registerRows.filter((r) => {
      if (empTypeFilter !== 'All' && r.category !== empTypeFilter) return false;
      if (deptFilter && r.department !== deptFilter) return false;
      if (shiftFilter && r.shift !== shiftFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [r.empId, r.name, r.department, r.designation, r.shift, r.status]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [registerRows, empTypeFilter, deptFilter, shiftFilter, search]);

  // Aggregated Summary Stats
  const totals = useMemo(() => {
    const list = filteredRows;
    return {
      employees: list.length,
      grossSalary: list.reduce((sum, r) => sum + r.grossSalary, 0),
      deductions: list.reduce((sum, r) => sum + r.deductions, 0),
      netSalary: list.reduce((sum, r) => sum + r.netSalary, 0)
    };
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize]
  );

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(pageRows.map((r) => r.id));
    else setSelectedIds([]);
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const departmentOptions = [...new Set([...DEPARTMENTS, ...users.map((u) => u.department).filter(Boolean)])];

  const exportRows = filteredRows.map((r) => ({
    empId: r.empId,
    name: r.name,
    department: r.department,
    designation: r.designation,
    daysPresent: r.daysPresent,
    basicSalary: money(r.basicSalary),
    otAmount: money(r.otAmount),
    otherAllowances: money(r.otherAllowances),
    grossSalary: money(r.grossSalary),
    deductions: money(r.deductions),
    netSalary: money(r.netSalary),
    status: r.status
  }));

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
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Salary Register
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.88rem' }}>
              View and manage monthly salary register. Includes basic, allowances, deductions and net salary.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/salary-calculation')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.25rem', background: '#5b1c85' }}
          >
            <Settings size={16} /> Generate Salary
          </button>
        </div>
      </header>

      {/* FILTER BAR (ROW 1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '170px 170px 170px 140px 1fr',
        gap: '0.85rem',
        marginBottom: '1.25rem',
        alignItems: 'center'
      }}>
        {/* Month */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Calendar size={16} color="#5b1c85" />
          <input
            type="month"
            className="input-field"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.65rem 0.5rem', outline: 'none', fontSize: '0.88rem', fontWeight: 700 }}
          />
        </div>

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
            <option value="All">All Employees</option>
            <option value="Factory Employees">Factory Employees</option>
            <option value="Office Employees">Office Employees</option>
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
            <option value="">All Shifts</option>
            <option value="9 hr">9 hr</option>
            <option value="12 hr">12 hr</option>
          </SearchableSelect>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by Employee ID / Name..."
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* STATS SUMMARY CARDS (ROW 2 - 4 CARDS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Employees */}
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(91, 28, 133, 0.15)', color: '#5b1c85', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600, display: 'block' }}>Total Employees</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4c1d95' }}>{totals.employees}</strong>
          </div>
        </div>

        {/* Total Gross Salary */}
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#d1fae5', color: '#047857', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 600, display: 'block' }}>Total Gross Salary</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>{money(totals.grossSalary)}</strong>
          </div>
        </div>

        {/* Total Deductions */}
        <div style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#ddd6fe', color: '#7e22ce', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#7e22ce', fontWeight: 600, display: 'block' }}>Total Deductions</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6b21a8' }}>{money(totals.deductions)}</strong>
          </div>
        </div>

        {/* Total Net Salary */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, display: 'block' }}>Total Net Salary</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b' }}>{money(totals.netSalary)}</strong>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: MAIN REGISTER TABLE */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div className="pm-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pm-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
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
                  <th style={{ padding: '10px 8px' }}>Employee Name</th>
                  <th style={{ padding: '10px 8px' }}>Department</th>
                  <th style={{ padding: '10px 8px' }}>Designation</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Days Present</th>
                  <th style={{ padding: '10px 8px' }}>Basic Salary</th>
                  <th style={{ padding: '10px 8px' }}>OT Amount</th>
                  <th style={{ padding: '10px 8px' }}>Other Allowances</th>
                  <th style={{ padding: '10px 8px' }}>Gross Salary</th>
                  <th style={{ padding: '10px 8px' }}>Deductions</th>
                  <th style={{ padding: '10px 8px' }}>Net Salary</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No register records found for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => handleToggleRow(r.id)}
                        />
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{r.empId}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{r.department}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{r.designation}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{r.daysPresent}</td>
                      <td style={{ padding: '10px 8px' }}>{money(r.basicSalary)}</td>
                      <td style={{ padding: '10px 8px' }}>{money(r.otAmount)}</td>
                      <td style={{ padding: '10px 8px' }}>{money(r.otherAllowances)}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{money(r.grossSalary)}</td>
                      <td style={{ padding: '10px 8px', color: '#dc2626' }}>{money(r.deductions)}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--accent-primary)' }}>{money(r.netSalary)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          background: r.status === 'Calculated' ? '#ecfdf5' : '#fffbeb',
                          color: r.status === 'Calculated' ? '#047857' : '#d97706',
                          border: `1px solid ${r.status === 'Calculated' ? '#a7f3d0' : '#fde68a'}`
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => navigate(`/payslip?user=${r.id}&month=${selectedMonth}`)}
                            title="View Payslip"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Eye size={12} /> View
                          </button>
                          <button type="button" className="btn btn-sm" style={{ padding: '3px 4px' }}>
                            <MoreVertical size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
                <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
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
                <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* CARD 1: SALARY SUMMARY */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Calendar size={18} color="#5b1c85" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Salary Summary
              </h3>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="month"
                className="input-field"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ width: '100%', fontSize: '0.82rem', fontWeight: 600 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Employees</span>
                <strong>{totals.employees}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Gross Salary</span>
                <strong>{money(totals.grossSalary)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Deductions</span>
                <strong>{money(totals.deductions)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid var(--border-color)', paddingTop: '6px', fontSize: '0.9rem', fontWeight: 800 }}>
                <span>Net Salary</span>
                <span style={{ color: '#5b1c85' }}>{money(totals.netSalary)}</span>
              </div>
            </div>
          </div>

          {/* CARD 2: QUICK ACTIONS */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <ExportButton
                data={exportRows}
                columns={[
                  { label: 'Emp ID', key: 'empId' },
                  { label: 'Name', key: 'name' },
                  { label: 'Department', key: 'department' },
                  { label: 'Gross Salary', key: 'grossSalary' },
                  { label: 'Net Salary', key: 'netSalary' }
                ]}
                filename={`Salary_Register_${selectedMonth}`}
                title="Export Salary Register"
              />
              <button
                type="button"
                className="btn pm-btn-outline"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <Printer size={15} /> Print Report
              </button>
            </div>
          </div>

          {/* NOTE BOX */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '1rem', fontSize: '0.78rem', color: '#0369a1', lineHeight: 1.45 }}>
            <strong>Note:</strong> Salary is calculated based on approved attendance, biometric punches and configured salary structure.
          </div>

        </div>

      </div>

    </div>
  );
};

export default SalaryRegister;
