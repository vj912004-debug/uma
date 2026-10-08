import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Users,
  Search,
  Briefcase,
  Printer,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  DollarSign,
  User,
  Settings
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { getEffectiveRate, money } from '../utils/payroll';
import { getPrintStampSrc } from '../utils/companyProfile';

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

const PayslipView = () => {
  const { data } = useAppContext();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramMonth = searchParams.get('month');
  const paramUser = searchParams.get('user');

  const [selectedMonth, setSelectedMonth] = useState(paramMonth || currentMonthStr());
  const [deptFilter, setDeptFilter] = useState('');
  const [empTypeFilter, setEmpTypeFilter] = useState('Factory Employees');
  const [leftSearch, setLeftSearch] = useState('');

  const users = useMemo(
    () => (data.users || []).filter((u) => !u.isDeleted && u.active !== false),
    [data.users]
  );

  const attendance = useMemo(
    () => (data.attendance || []).filter((a) => !a.isDeleted),
    [data.attendance]
  );

  // Selected Employee ID state
  const [selectedEmpId, setSelectedEmpId] = useState(() => (paramUser || users[0]?.id || ''));

  // Employees List for Left Panel
  const employeeList = useMemo(() => {
    return users.map((u) => {
      const monthAtt = attendance.filter((a) => String(a.userId) === String(u.id) && String(a.date).startsWith(selectedMonth));
      const rates = getEffectiveRate(u);

      const presentDays = monthAtt.length > 0 ? monthAtt.filter((a) => a.statusCode === 'P' || a.status === 'Present').length : 26;
      const absentDays = monthAtt.length > 0 ? monthAtt.filter((a) => a.statusCode === 'A' || a.status === 'Absent').length : 2;
      const otHours = monthAtt.length > 0 ? monthAtt.reduce((sum, a) => sum + (parseFloat(a.otHours) || 0), 0) : 6.5;

      const perDayRate = rates.perDayRate || (u.shiftType === '12hr' ? 800 : 700);
      const otRate = rates.otRate || 100;

      const basicSalary = Math.round(presentDays * perDayRate * 0.6);
      const da = Math.round(presentDays * perDayRate * 0.15);
      const hra = Math.round(presentDays * perDayRate * 0.1);
      const specialAllowance = Math.round(presentDays * perDayRate * 0.08);
      const otPay = Math.round(otHours * otRate);
      const otherAllowances = Math.round(presentDays * 30);

      const grossSalary = basicSalary + da + hra + specialAllowance + otPay + otherAllowances;

      const pf = Math.round(basicSalary * 0.08);
      const esi = Math.round(grossSalary * 0.0075);
      const pt = 200;
      const otherDeductions = 490;
      const totalDeductions = pf + esi + pt + otherDeductions;

      const netSalary = Math.max(0, grossSalary - totalDeductions);

      return {
        id: u.id,
        empId: u.employeeId || `EMP${String(u.id).slice(-3)}`,
        name: u.name || u.username || 'Employee',
        department: u.department || 'Production',
        designation: u.designation || 'Machine Operator',
        shift: u.shiftType === '12hr' ? '12 hr' : '9 hr',
        joiningDate: u.joiningDate || '2024-06-20',
        presentDays,
        absentDays,
        onLeaveDays: 0,
        halfDays: 0,
        totalHours: presentDays * 8,
        otHours,
        perDayRate,
        otRate,
        basicSalary,
        da,
        hra,
        specialAllowance,
        otPay,
        otherAllowances,
        grossSalary,
        pf,
        esi,
        pt,
        otherDeductions,
        totalDeductions,
        netSalary,
        rawUser: u
      };
    });
  }, [users, attendance, selectedMonth]);

  // Filtered Left Panel List
  const filteredLeftList = useMemo(() => {
    return employeeList.filter((r) => {
      if (deptFilter && r.department !== deptFilter) return false;
      const q = leftSearch.trim().toLowerCase();
      if (!q) return true;
      return [r.empId, r.name, r.department, r.designation].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [employeeList, deptFilter, leftSearch]);

  // Selected Active Employee Payslip Object
  const activeEmp = useMemo(() => {
    return employeeList.find((e) => String(e.id) === String(selectedEmpId)) || employeeList[0] || null;
  }, [employeeList, selectedEmpId]);

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
            <FileText size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Payslip
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.88rem' }}>
              Generate and view payslips for employees.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.25rem', background: '#5b1c85' }}
          >
            <Printer size={16} /> Print Payslip
          </button>
        </div>
      </header>

      {/* FILTER BAR (ROW 1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '170px 170px 170px 220px 1fr',
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
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
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
            <option value="Factory Employees">Factory Employees</option>
            <option value="Office Employees">Office Employees</option>
          </SearchableSelect>
        </div>

        {/* Employee Quick Select */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <User size={16} color="#5b1c85" />
          <SearchableSelect
            className="input-field"
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {employeeList.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>
            ))}
          </SearchableSelect>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by Employee ID / Name..."
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
            value={leftSearch}
            onChange={(e) => setLeftSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 3-PANEL SPLIT MAIN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 280px', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* PANEL A: LEFT EMPLOYEE LIST */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.65rem', marginBottom: '0.85rem' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search employee..."
              style={{ border: 'none', background: 'transparent', padding: '0.5rem', width: '100%', outline: 'none', fontSize: '0.8rem' }}
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '560px', overflowY: 'auto' }}>
            {filteredLeftList.map((emp) => {
              const isSelected = String(emp.id) === String(activeEmp?.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? '#5b1c85' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-main)',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(91, 28, 133, 0.1)',
                    color: isSelected ? '#fff' : 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem'
                  }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {emp.name} <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({emp.empId})</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                      {emp.department}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL B: CENTER MAIN PAYSLIP CARD */}
        {activeEmp && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            
            {/* Payslip Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #5b1c85', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#5b1c85', color: '#fff', width: 36, height: 36, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  M
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#5b1c85' }}>
                    {companyProfile.companyName || 'UMA MICRON'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    {companyProfile.tagline || 'Micronization for a Better Tomorrow'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#5b1c85' }}>Salary Payslip</h2>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Pay Period: <strong>{formatMonthLabel(selectedMonth)}</strong> | Payslip No: <strong>PS-{selectedMonth.replace('-', '')}-001</strong>
                </span>
              </div>
            </div>

            {/* Employee Info Bar */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '1.05rem', color: '#1e293b', display: 'block' }}>{activeEmp.name}</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {activeEmp.empId} | {activeEmp.designation} | {activeEmp.department}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#64748b' }}>
                Joining Date: <strong>{formatDate(activeEmp.joiningDate)}</strong>
              </div>
            </div>

            {/* Earnings & Deductions Split Table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              
              {/* Earnings Table */}
              <div style={{ borderRight: '1px solid #cbd5e1' }}>
                <div style={{ background: '#ecfdf5', padding: '6px 12px', fontWeight: 800, color: '#047857', borderBottom: '1px solid #cbd5e1', fontSize: '0.82rem' }}>
                  Earnings
                </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Basic Salary</span><span>{money(activeEmp.basicSalary)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>DA (Dearness Allowance)</span><span>{money(activeEmp.da)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>HRA (House Rent Allowance)</span><span>{money(activeEmp.hra)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Special Allowance</span><span>{money(activeEmp.specialAllowance)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>OT Pay</span><span>{money(activeEmp.otPay)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Other Allowances</span><span>{money(activeEmp.otherAllowances)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #cbd5e1', paddingTop: '6px', fontWeight: 800, color: '#047857', fontSize: '0.85rem' }}>
                    <span>Total Earnings</span><span>{money(activeEmp.grossSalary)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div>
                <div style={{ background: '#fef2f2', padding: '6px 12px', fontWeight: 800, color: '#dc2626', borderBottom: '1px solid #cbd5e1', fontSize: '0.82rem' }}>
                  Deductions
                </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PF (Employee)</span><span>{money(activeEmp.pf)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ESI (Employee)</span><span>{money(activeEmp.esi)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Professional Tax</span><span>{money(activeEmp.pt)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Other Deductions</span><span>{money(activeEmp.otherDeductions)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #cbd5e1', paddingTop: '1.5rem', fontWeight: 800, color: '#dc2626', fontSize: '0.85rem' }}>
                    <span>Total Deductions</span><span>{money(activeEmp.totalDeductions)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Net Salary Highlight Banner */}
            <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '8px', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 800, color: '#047857', fontSize: '0.95rem' }}>Net Salary</span>
              <strong style={{ fontSize: '1.35rem', fontWeight: 800, color: '#047857' }}>{money(activeEmp.netSalary)}</strong>
            </div>

            {/* Footer Notice */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <span>🤖 This is a computer generated payslip. No signature required.</span>
              <span>Generated On: {formatDate(new Date().toISOString().slice(0, 10))} 10:15 AM</span>
            </div>

          </div>
        )}

        {/* PANEL C: RIGHT SIDEBAR CARDS */}
        {activeEmp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* ATTENDANCE SUMMARY CARD */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Calendar size={18} color="#5b1c85" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Attendance Summary
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#047857' }}></span> Present
                  </span>
                  <strong style={{ color: '#047857' }}>{activeEmp.presentDays} Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}></span> Absent
                  </span>
                  <strong style={{ color: '#dc2626' }}>{activeEmp.absentDays} Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7e22ce' }}></span> On Leave
                  </span>
                  <strong style={{ color: '#7e22ce' }}>0 Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }}></span> Half Day
                  </span>
                  <strong style={{ color: '#d97706' }}>0 Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                  <span>Total Working Hours</span>
                  <strong>{activeEmp.totalHours} Hrs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>OT Hours</span>
                  <strong style={{ color: '#5b1c85' }}>{activeEmp.otHours} Hrs</strong>
                </div>
              </div>
            </div>

            {/* SHIFT DETAILS CARD */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Clock size={18} color="#5b1c85" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Shift Details
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Shift Type</span>
                  <strong>{activeEmp.shift}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Working Hours</span>
                  <strong>09:00 AM - 06:00 PM</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>OT Rate</span>
                  <strong>{money(activeEmp.otRate)} / Hr</strong>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};

export default PayslipView;
