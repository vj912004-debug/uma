import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
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
  Fingerprint,
  Check,
  X,
  FileText,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import {
  getBiometricDevices,
  applyEsslSyncToState,
  calculateTimes,
  punchesForAttendanceRow,
  getRawPunches,
  money
} from '../utils/payroll';
import { DEPARTMENTS } from './EmployeeManagement';

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatTime12 = (t) => {
  if (!t || t === '-') return '-';
  const [hStr, mStr] = String(t).split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return '-';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

const formatTotalHours = (hrs) => {
  if (!hrs || isNaN(hrs) || Number(hrs) <= 0) return '0h 00m';
  const totalMins = Math.round(Number(hrs) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

// Determine if employee is Factory or Office
const getEmployeeCategory = (u) => {
  if (u.employeeType === 'Factory' || u.category === 'Factory') return 'Factory';
  if (u.employeeType === 'Office' || u.category === 'Office') return 'Office';
  const dept = String(u.department || '').toLowerCase();
  if (['factory', 'production', 'quality', 'packing', 'maintenance', 'store', 'engineering', 'tool room'].some(d => dept.includes(d))) {
    return 'Factory';
  }
  if (['admin', 'accounts', 'hr', 'management', 'personal', 'office'].some(d => dept.includes(d))) {
    return 'Office';
  }
  // Default: if has esslId -> Factory, else Office
  return u.esslId ? 'Factory' : 'Office';
};

const DailyAttendance = () => {
  const { data, updateData, updateItem, setData } = useAppContext();
  const { currentUser, isAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [deptFilter, setDeptFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [empTypeFilter, setEmpTypeFilter] = useState('All'); // 'All' | 'Factory' | 'Office'
  const [search, setSearch] = useState('');
  const [mainTab, setMainTab] = useState('factory'); // 'factory' | 'office'

  const [selectedIds, setSelectedIds] = useState([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const users = useMemo(
    () => (data.users || []).filter((u) => !u.isDeleted && u.active !== false),
    [data.users]
  );

  const rawPunches = useMemo(() => getRawPunches(data), [data]);
  const devices = useMemo(() => getBiometricDevices(data), [data]);

  // Navigate date by offset
  const shiftDate = (offsetDays) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().slice(0, 10));
    setPage(1);
  };

  // Synchronize biometric devices
  const handleSyncBiometric = async () => {
    setSyncBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    const { result, next } = applyEsslSyncToState(data, new Date());
    setData(next);
    setSyncBusy(false);
    alert(result.imported || result.added || result.updated
      ? `Biometric Sync Complete!\n${result.imported} raw punches fetched → ${result.added} attendance created, ${result.updated} updated.`
      : `Biometric Sync Complete!\nAlready up to date for ${selectedDate}.`
    );
  };

  // Build daily attendance rows dynamically for selectedDate
  const dailyRows = useMemo(() => {
    const existingAttendance = (data.attendance || []).filter((a) => a.date === selectedDate && !a.isDeleted);
    const attMap = new Map(existingAttendance.map((a) => [String(a.userId), a]));

    return users.map((u) => {
      const category = getEmployeeCategory(u);
      const attRecord = attMap.get(String(u.id));

      let inTime = attRecord?.inTime || '';
      let outTime = attRecord?.outTime || '';
      let statusCode = attRecord?.statusCode || (attRecord?.status === 'Absent' ? 'A' : 'P');
      let status = attRecord?.status || (statusCode === 'A' ? 'Absent' : statusCode === 'HD' ? 'Half Day' : statusCode === 'CL' || statusCode === 'SL' || statusCode === 'PL' ? 'On Leave' : 'Present');
      let approvalStatus = attRecord?.approvalStatus || (category === 'Factory' ? (u.approvalStatus === 'Pending' ? 'Pending' : 'Approved') : 'Not Applicable');
      let remark = attRecord?.remark || '';
      let source = attRecord?.source || (u.esslId ? 'essl' : 'manual');

      // Check raw punches for this user on selectedDate if no custom times
      if (!inTime && u.esslId) {
        const userPunches = rawPunches
          .filter((p) => String(p.deviceUserId) === String(u.esslId) && p.punchDate === selectedDate)
          .sort((a, b) => String(a.punchTime).localeCompare(String(b.punchTime)));
        
        if (userPunches.length > 0) {
          inTime = userPunches[0].punchTime.slice(0, 5);
          if (userPunches.length > 1) {
            outTime = userPunches[userPunches.length - 1].punchTime.slice(0, 5);
          }
          status = 'Present';
          statusCode = 'P';
        }
      }

      // Default demo times if completely empty for present status
      if (status === 'Present' && !inTime) {
        inTime = category === 'Factory' ? '09:00' : '09:30';
        outTime = category === 'Factory' ? '18:30' : '18:00';
      }

      const shiftType = u.shiftType || '9hr';
      const calc = calculateTimes(inTime, outTime, 'Day', shiftType === '12hr' ? 12 : 9);
      const totalHours = attRecord?.totalHours != null ? Number(attRecord.totalHours) : calc.totalHours;

      if (!remark && calc.isLate) {
        remark = 'Late by 15 min';
      } else if (!remark && !inTime && status === 'Absent') {
        remark = 'No punch';
      }

      return {
        id: attRecord?.id || `daily-${u.id}-${selectedDate}`,
        userId: u.id,
        empId: u.employeeId || `EMP${String(u.id).slice(-3)}`,
        name: u.name || u.username || '',
        department: u.department || 'General',
        shift: shiftType === '12hr' ? 'Night' : 'Day',
        inTime,
        outTime,
        totalHours,
        status, // 'Present' | 'Absent' | 'Half Day' | 'On Leave'
        statusCode,
        approvalStatus, // 'Approved' | 'Pending' | 'Rejected' | 'Not Applicable'
        remark,
        category, // 'Factory' | 'Office'
        esslId: u.esslId || '',
        source,
        rawRecord: attRecord
      };
    });
  }, [users, selectedDate, data.attendance, rawPunches]);

  // Filtered rows for main display
  const filteredRows = useMemo(() => {
    return dailyRows.filter((r) => {
      // Category / Tab filter
      if (mainTab === 'factory' && r.category !== 'Factory') return false;
      if (mainTab === 'office' && r.category !== 'Office') return false;

      if (deptFilter && r.department !== deptFilter) return false;
      if (shiftFilter && r.shift !== shiftFilter) return false;
      if (empTypeFilter !== 'All' && r.category !== empTypeFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [r.empId, r.name, r.department, r.shift, r.status, r.approvalStatus, r.remark]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [dailyRows, mainTab, deptFilter, shiftFilter, empTypeFilter, search]);

  // Factory employees rows
  const factoryRows = useMemo(() => dailyRows.filter((r) => r.category === 'Factory'), [dailyRows]);
  // Office employees rows
  const officeRows = useMemo(() => dailyRows.filter((r) => r.category === 'Office'), [dailyRows]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    const list = mainTab === 'factory' ? factoryRows : dailyRows;
    return {
      total: list.length,
      approved: list.filter((r) => r.approvalStatus === 'Approved').length,
      pending: list.filter((r) => r.approvalStatus === 'Pending').length,
      absent: list.filter((r) => r.status === 'Absent').length,
      present: list.filter((r) => r.status === 'Present').length,
      onLeave: list.filter((r) => r.status === 'On Leave').length,
      halfDay: list.filter((r) => r.status === 'Half Day').length
    };
  }, [mainTab, factoryRows, dailyRows]);

  // Pagination for main table
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize]
  );

  // Bulk Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(pageRows.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Approval Actions
  const handleApproveSelected = () => {
    if (!selectedIds.length) {
      alert('Select at least one employee row to approve.');
      return;
    }
    const currentAtt = [...(data.attendance || [])];
    selectedIds.forEach((rowId) => {
      const target = dailyRows.find((r) => r.id === rowId);
      if (!target) return;
      const idx = currentAtt.findIndex((a) => a.id === rowId || (a.userId === target.userId && a.date === selectedDate));
      const updatedItem = {
        ...(target.rawRecord || {}),
        id: target.id,
        userId: target.userId,
        date: selectedDate,
        approvalStatus: 'Approved',
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.name || currentUser?.username || 'Admin',
        updatedAt: new Date().toISOString()
      };
      if (idx >= 0) {
        currentAtt[idx] = { ...currentAtt[idx], ...updatedItem };
      } else {
        currentAtt.push(updatedItem);
      }
    });

    updateData('attendance', currentAtt);
    setSelectedIds([]);
    alert(`Approved attendance for ${selectedIds.length} employee(s).`);
  };

  const handleRejectSelected = () => {
    if (!selectedIds.length) {
      alert('Select at least one employee row to reject/reset.');
      return;
    }
    const currentAtt = [...(data.attendance || [])];
    selectedIds.forEach((rowId) => {
      const target = dailyRows.find((r) => r.id === rowId);
      if (!target) return;
      const idx = currentAtt.findIndex((a) => a.id === rowId || (a.userId === target.userId && a.date === selectedDate));
      const updatedItem = {
        ...(target.rawRecord || {}),
        id: target.id,
        userId: target.userId,
        date: selectedDate,
        approvalStatus: 'Pending',
        updatedAt: new Date().toISOString()
      };
      if (idx >= 0) {
        currentAtt[idx] = { ...currentAtt[idx], ...updatedItem };
      } else {
        currentAtt.push(updatedItem);
      }
    });

    updateData('attendance', currentAtt);
    setSelectedIds([]);
    alert(`Reset status to Pending for ${selectedIds.length} employee(s).`);
  };

  // Export rows formatting
  const exportRows = filteredRows.map((r) => ({
    empId: r.empId,
    name: r.name,
    department: r.department,
    shift: r.shift,
    punchIn: formatTime12(r.inTime),
    punchOut: formatTime12(r.outTime),
    totalHours: formatTotalHours(r.totalHours),
    attendance: r.status,
    approval: r.approvalStatus,
    remark: r.remark || '-'
  }));

  const departmentOptions = [...new Set([...DEPARTMENTS, ...users.map((u) => u.department).filter(Boolean)])];

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
            background: 'rgba(155, 98, 196, 0.1)',
            color: 'var(--accent-primary)',
            width: 44,
            height: 44,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justify: 'center'
          }}>
            <Calendar size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Daily Attendance Approval
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0', fontSize: '0.88rem' }}>
              Review biometric punches and approve factory employees' attendance.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSyncBiometric}
            disabled={syncBusy}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.25rem', background: '#9b62c4' }}
          >
            <RefreshCw size={16} className={syncBusy ? 'esm-spin' : ''} />
            {syncBusy ? 'Syncing...' : 'Sync from Biometric'}
          </button>
          
          <ExportButton
            data={exportRows}
            columns={[
              { label: 'Emp ID', key: 'empId' },
              { label: 'Name', key: 'name' },
              { label: 'Department', key: 'department' },
              { label: 'Shift', key: 'shift' },
              { label: 'Punch In', key: 'punchIn' },
              { label: 'Punch Out', key: 'punchOut' },
              { label: 'Total Hours', key: 'totalHours' },
              { label: 'Attendance Status', key: 'attendance' },
              { label: 'Approval Status', key: 'approval' },
              { label: 'Remarks', key: 'remark' }
            ]}
            filename={`Daily_Attendance_${selectedDate}`}
            title="Daily Attendance Report"
          />
        </div>
      </header>

      {/* FILTER & CONTROL BAR (ROW 1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto auto auto 1fr',
        gap: '0.85rem',
        marginBottom: '1.25rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Date Selector with prev/next arrows */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '0 0.5rem'
        }}>
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-muted)' }}
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>
          
          <DateField
            className="input-field"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '135px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}
          />

          <button
            type="button"
            onClick={() => shiftDate(1)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-muted)' }}
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Department Filter */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem', minWidth: '170px' }}>
          <Briefcase size={16} color="#9b62c4" />
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

        {/* Shift Filter */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem', minWidth: '140px' }}>
          <Clock size={16} color="#9b62c4" />
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="">All Shifts</option>
            <option value="Day">Day Shift</option>
            <option value="Night">Night Shift</option>
          </SearchableSelect>
        </div>

        {/* Employee Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem', minWidth: '170px' }}>
          <Users size={16} color="#9b62c4" />
          <SearchableSelect
            className="input-field"
            allowCustom={false}
            value={empTypeFilter}
            onChange={(e) => setEmpTypeFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="All">All Employees</option>
            <option value="Factory">Factory Employees</option>
            <option value="Office">Office Employees</option>
          </SearchableSelect>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.85rem' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by Name / Emp ID..."
            style={{ border: 'none', background: 'transparent', padding: '0.75rem 0.5rem', width: '100%', outline: 'none', fontSize: '0.85rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* STATS / KPI SUMMARY CARDS (ROW 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Total Factory Employees Card */}
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(155, 98, 196, 0.15)', color: '#9b62c4', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600, display: 'block' }}>
              {mainTab === 'factory' ? 'Factory Employees' : 'Total Employees'}
            </span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4c1d95' }}>{stats.total}</strong>
          </div>
        </div>

        {/* Approved Card */}
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#d1fae5', color: '#047857', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 600, display: 'block' }}>Approved</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>{stats.approved}</strong>
          </div>
        </div>

        {/* Pending Card */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600, display: 'block' }}>Pending</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400e' }}>{stats.pending}</strong>
          </div>
        </div>

        {/* Absent Card */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', width: 42, height: 42, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, display: 'block' }}>Absent</span>
            <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#991b1b' }}>{stats.absent}</strong>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: MAIN TABLE VIEW */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          
          {/* Main Table View Switcher Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setMainTab('factory'); setPage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: mainTab === 'factory' ? '#9b62c4' : '#f1f5f9',
                  color: mainTab === 'factory' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Factory Employees ({factoryRows.length})
              </button>
              <button
                type="button"
                onClick={() => { setMainTab('office'); setPage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: mainTab === 'office' ? '#9b62c4' : '#f1f5f9',
                  color: mainTab === 'office' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Office Employees ({officeRows.length})
              </button>
            </div>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {filteredRows.length} record(s)
            </span>
          </div>

          {/* TABLE CONTAINER */}
          <div className="pm-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pm-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
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
                  <th style={{ padding: '10px 8px' }}>Punch In <br/><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(From Machine)</span></th>
                  <th style={{ padding: '10px 8px' }}>Punch Out <br/><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(From Machine)</span></th>
                  <th style={{ padding: '10px 8px' }}>Total Hours</th>
                  <th style={{ padding: '10px 8px' }}>Attendance</th>
                  <th style={{ padding: '10px 8px' }}>Approval <br/><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Factory Only)</span></th>
                  <th style={{ padding: '10px 8px' }}>Remarks</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="pm-empty" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No attendance records found matching filters for {formatDate(selectedDate)}.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const isSelected = selectedIds.includes(r.id);
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', background: isSelected ? 'rgba(155, 98, 196, 0.04)' : 'transparent' }}>
                        <td style={{ padding: '10px 8px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(r.id)}
                          />
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {r.empId}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                          {r.name}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                          {r.department}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className="esm-chip">{r.shift}</span>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: r.inTime ? '#047857' : 'var(--text-muted)' }}>
                          {formatTime12(r.inTime)}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: r.outTime ? '#047857' : 'var(--text-muted)' }}>
                          {formatTime12(r.outTime)}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                          {formatTotalHours(r.totalHours)}
                        </td>
                        
                        {/* ATTENDANCE BADGE */}
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '10px',
                            background: r.status === 'Present' ? '#ecfdf5' : r.status === 'Absent' ? '#fef2f2' : r.status === 'On Leave' ? '#f3e8ff' : '#fffbeb',
                            color: r.status === 'Present' ? '#047857' : r.status === 'Absent' ? '#dc2626' : r.status === 'On Leave' ? '#7e22ce' : '#d97706',
                            border: `1px solid ${r.status === 'Present' ? '#a7f3d0' : r.status === 'Absent' ? '#fecaca' : r.status === 'On Leave' ? '#e9d5ff' : '#fde68a'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {r.status}
                          </span>
                        </td>

                        {/* APPROVAL BADGE */}
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: '10px',
                            background: r.approvalStatus === 'Approved' ? '#ecfdf5' : r.approvalStatus === 'Pending' ? '#fffbeb' : '#f1f5f9',
                            color: r.approvalStatus === 'Approved' ? '#047857' : r.approvalStatus === 'Pending' ? '#d97706' : '#64748b',
                            border: `1px solid ${r.approvalStatus === 'Approved' ? '#a7f3d0' : r.approvalStatus === 'Pending' ? '#fde68a' : '#cbd5e1'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {r.approvalStatus}
                          </span>
                        </td>

                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {r.remark || '-'}
                        </td>

                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setViewingRow(r)}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)' }}
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* OFFICE EMPLOYEES BANNER SECTION (When in Factory view) */}
          {mainTab === 'factory' && officeRows.length > 0 && (
            <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                <Info size={15} color="#9b62c4" />
                <span>Office Employees (Manual Entry – Not Visible for Factory Approval)</span>
              </div>
              <div style={{ padding: '0.5rem 1rem', background: '#fafafa', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {officeRows.slice(0, 3).map((off) => (
                  <div key={off.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px border-dash #e2e8f0' }}>
                    <span><strong>{off.empId}</strong> {off.name} ({off.department})</span>
                    <span>In: {formatTime12(off.inTime)} | Out: {formatTime12(off.outTime)} | {off.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGINATION FOOTER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Showing {pageRows.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} {mainTab} employees
            </span>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{ padding: '4px 8px' }}
                >
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
                      background: page === p ? '#9b62c4' : '#fff',
                      color: page === p ? '#fff' : 'var(--text-main)'
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{ padding: '4px 8px' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: SIDEBAR CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* SIDEBAR TABS SWITCHER */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => { setMainTab('factory'); setPage(1); }}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mainTab === 'factory' ? '#fff' : 'transparent',
                color: mainTab === 'factory' ? '#9b62c4' : 'var(--text-muted)',
                boxShadow: mainTab === 'factory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Factory (Biometric)
            </button>
            <button
              type="button"
              onClick={() => { setMainTab('office'); setPage(1); }}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: mainTab === 'office' ? '#fff' : 'transparent',
                color: mainTab === 'office' ? '#9b62c4' : 'var(--text-muted)',
                boxShadow: mainTab === 'office' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Office (Manual)
            </button>
          </div>

          {/* CARD 1: APPROVAL ACTIONS */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Shield size={18} color="#9b62c4" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Approval Actions
              </h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              You can only approve/reject factory employees' attendance.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApproveSelected}
                style={{ width: '100%', background: '#9b62c4', padding: '0.65rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Check size={16} /> Approve Selected ({selectedIds.length})
              </button>
              <button
                type="button"
                className="btn pm-btn-outline danger"
                onClick={handleRejectSelected}
                style={{ width: '100%', padding: '0.65rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <X size={16} /> Reject Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          {/* CARD 2: ATTENDANCE SUMMARY */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Calendar size={18} color="#9b62c4" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Attendance Summary
              </h3>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <DateField
                className="input-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: '100%', fontSize: '0.82rem', fontWeight: 600 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#047857' }}></span> Present
                </span>
                <strong style={{ color: '#047857', fontWeight: 800 }}>{stats.present}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}></span> Absent
                </span>
                <strong style={{ color: '#dc2626', fontWeight: 800 }}>{stats.absent}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7e22ce' }}></span> On Leave
                </span>
                <strong style={{ color: '#7e22ce', fontWeight: 800 }}>{stats.onLeave}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }}></span> Half Day
                </span>
                <strong style={{ color: '#d97706', fontWeight: 800 }}>{stats.halfDay}</strong>
              </div>
            </div>
          </div>

          {/* CARD 3: BIOMETRIC SOURCE */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Fingerprint size={18} color="#9b62c4" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Biometric Source
              </h3>
            </div>
            <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Last Sync
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {formatDate(selectedDate)} 09:15 AM
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                Synced
              </span>
            </div>
          </div>

          {/* CARD 4: INFORMATION NOTE */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <Info size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '0.25rem' }}>
                  Note:
                </strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#0c4a6e', lineHeight: 1.45 }}>
                  Factory employees' attendance is fetched from the biometric machine. <strong>Office employees'</strong> attendance is maintained manually in the software and does not require approval.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* DETAIL / EDIT PUNCH MODAL */}
      {viewingRow && (
        <div className="page-form-overlay" onClick={() => setViewingRow(null)}>
          <div className="modal-content" style={{ width: '520px', maxWidth: '95vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="#9b62c4" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Attendance Detail - {viewingRow.name}
                </h2>
              </div>
              <button type="button" className="btn" onClick={() => setViewingRow(null)} style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Employee ID:</span>
                <strong>{viewingRow.empId}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                <strong>{viewingRow.department}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift:</span>
                <strong>{viewingRow.shift}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Punch In Time:</span>
                <strong>{formatTime12(viewingRow.inTime)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Punch Out Time:</span>
                <strong>{formatTime12(viewingRow.outTime)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Calculated Hours:</span>
                <strong>{formatTotalHours(viewingRow.totalHours)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Status:</span>
                <strong>{viewingRow.status}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Approval Status:</span>
                <strong>{viewingRow.approvalStatus}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remarks:</span>
                <span>{viewingRow.remark || 'None'}</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  // Approve row
                  const currentAtt = [...(data.attendance || [])];
                  const idx = currentAtt.findIndex((a) => a.id === viewingRow.id || (a.userId === viewingRow.userId && a.date === selectedDate));
                  const updatedItem = {
                    ...(viewingRow.rawRecord || {}),
                    id: viewingRow.id,
                    userId: viewingRow.userId,
                    date: selectedDate,
                    approvalStatus: 'Approved',
                    approvedAt: new Date().toISOString(),
                    approvedBy: currentUser?.name || 'Admin',
                    updatedAt: new Date().toISOString()
                  };
                  if (idx >= 0) currentAtt[idx] = { ...currentAtt[idx], ...updatedItem };
                  else currentAtt.push(updatedItem);

                  updateData('attendance', currentAtt);
                  setViewingRow(null);
                }}
              >
                <CheckCircle2 size={16} /> Approve Entry
              </button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setViewingRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DailyAttendance;
