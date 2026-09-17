import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Calculator,
  Save,
  Download,
  Printer,
  CheckCircle2,
  Circle,
  Paperclip,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/dateUtils';
import { SHIFTS, STATUS_CODES } from './Attendance';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const defaultRates = () => ({
  perDayRate: 800,
  overtimeRate: 100,
  shiftAllowance: 50,
  nightShiftAllowance: 100,
  pfPercent: 12,
  esiPercent: 0.75,
  otherDeduction: 0,
  attendanceBonus: 500,
  otherAllowance: 0
});

const monthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const dayName = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
};

const Field = ({ label, children }) => (
  <div className="form-group pm-field">
    <label>{label}</label>
    {children}
  </div>
);

const SalaryCalculation = () => {
  const { data, updateData, setData } = useAppContext();
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [month, setMonth] = useState(monthValue());
  const [rates, setRates] = useState(() => ({
    ...defaultRates(),
    ...(data.salaryRates || {})
  }));
  const [calculated, setCalculated] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [savedReportId, setSavedReportId] = useState(null);

  const users = useMemo(() => (data.users || []).filter((u) => u.active !== false), [data.users]);
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))];
  const attendance = useMemo(() => (data.attendance || []).filter((r) => !r.isDeleted), [data.attendance]);

  const selectedUser = users.find((u) => String(u.id) === String(employeeId));

  const monthRows = useMemo(() => {
    if (!employeeId || !month) return [];
    return attendance
      .filter((r) => String(r.userId) === String(employeeId) && String(r.date || '').startsWith(month))
      .filter((r) => !department || r.department === department)
      .filter((r) => !shiftType || r.shift === shiftType)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [attendance, employeeId, month, department, shiftType]);

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [month]);

  const calc = useMemo(() => {
    const presentDays = monthRows.reduce((sum, r) => {
      if (r.statusCode === 'P') return sum + 1;
      if (r.statusCode === 'HD' || r.isHalfDay) return sum + 0.5;
      return sum;
    }, 0);
    const absent = monthRows.filter((r) => r.statusCode === 'A' || r.statusCode === 'LWP').length;
    const paidLeave = monthRows.filter((r) => ['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode)).length;
    const paidPresent = monthRows.reduce((sum, r) => {
      if (r.statusCode === 'P') return sum + 1;
      if (r.statusCode === 'HD' || r.isHalfDay) return sum + 0.5;
      if (['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode)) return sum + 1;
      return sum;
    }, 0);
    const otHours = monthRows.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0);
    const nightDays = monthRows.filter((r) => r.shift === 'Night' && ['P', 'HD'].includes(r.statusCode)).length;
    const shiftDays = monthRows.filter((r) => ['P', 'HD'].includes(r.statusCode)).length;

    const basic = paidPresent * (parseFloat(rates.perDayRate) || 0);
    const otAmount = otHours * (parseFloat(rates.overtimeRate) || 0);
    const shiftAllow = shiftDays * (parseFloat(rates.shiftAllowance) || 0);
    const nightAllow = nightDays * (parseFloat(rates.nightShiftAllowance) || 0);
    const attendanceBonus = paidPresent >= 26 ? (parseFloat(rates.attendanceBonus) || 0) : 0;
    const otherAllow = parseFloat(rates.otherAllowance) || 0;
    const gross = basic + otAmount + shiftAllow + nightAllow + attendanceBonus + otherAllow;

    const pf = gross * ((parseFloat(rates.pfPercent) || 0) / 100);
    const esi = gross * ((parseFloat(rates.esiPercent) || 0) / 100);
    const otherDed = parseFloat(rates.otherDeduction) || 0;
    const deductions = pf + esi + otherDed;
    const net = gross - deductions;

    const detailRows = monthRows.map((r) => {
      const isPresent = r.statusCode === 'P';
      const isHalf = r.statusCode === 'HD' || r.isHalfDay;
      const dayFactor = isPresent ? 1 : isHalf ? 0.5 : ['CL', 'SL', 'PL', 'WO', 'PH'].includes(r.statusCode) ? 1 : 0;
      const dailyAmount = dayFactor * (parseFloat(rates.perDayRate) || 0);
      const otAmt = (parseFloat(r.otHours) || 0) * (parseFloat(rates.overtimeRate) || 0);
      return {
        ...r,
        dayName: dayName(r.date),
        dailyAmount,
        otAmount: otAmt,
        perDayRate: rates.perDayRate,
        otRate: rates.overtimeRate
      };
    });

    return {
      totalDays: daysInMonth,
      presentDays: Number(presentDays.toFixed(2)),
      absentDays: absent,
      paidLeave,
      otHours: Number(otHours.toFixed(2)),
      paidDays: Number(paidPresent.toFixed(2)),
      basic,
      otAmount,
      shiftAllow,
      nightAllow,
      attendanceBonus,
      otherAllow,
      gross,
      pf,
      esi,
      otherDed,
      deductions,
      net,
      detailRows
    };
  }, [monthRows, rates, daysInMonth]);

  const handleCalculate = () => {
    if (!employeeId) {
      alert('Please select an employee.');
      return;
    }
    setCalculated(true);
    setSavedReportId(null);
  };

  const saveRates = () => {
    setData((prev) => ({
      ...prev,
      salaryRates: { ...rates }
    }));
    alert('Salary rates saved.');
  };

  const saveReport = () => {
    if (!calculated || !selectedUser) {
      alert('Calculate salary first.');
      return;
    }
    const report = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      employeeId: selectedUser.id,
      employeeName: selectedUser.name || selectedUser.username,
      department: selectedUser.department || department || '',
      month,
      paidDays: calc.paidDays,
      otHours: calc.otHours,
      gross: calc.gross,
      deductions: calc.deductions,
      net: calc.net,
      remarks,
      rates: { ...rates },
      summary: {
        totalDays: calc.totalDays,
        presentDays: calc.presentDays,
        absentDays: calc.absentDays
      }
    };
    updateData('salaryReports', report);
    setSavedReportId(report.id);
    alert('Salary report saved.');
  };

  const reports = useMemo(
    () => (data.salaryReports || []).filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [data.salaryReports]
  );

  const exportExcel = () => {
    const sheet = reports.map((r, i) => ({
      'Sr. No': i + 1,
      Employee: r.employeeName,
      Department: r.department,
      Month: r.month,
      'Paid Days': r.paidDays,
      'OT Hrs': r.otHours,
      'Gross Salary': r.gross,
      Deductions: r.deductions,
      'Net Salary': r.net
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.length ? sheet : [{ Note: 'No reports' }]), 'Salary Reports');
    XLSX.writeFile(wb, 'Salary_Reports.xlsx');
  };

  const printPage = () => window.print();

  const checklist = [
    { label: 'Attendance fetched', done: monthRows.length > 0 || calculated },
    { label: 'Rates entered / saved', done: Boolean(data.salaryRates) || calculated },
    { label: 'Salary calculated', done: calculated },
    { label: 'Deductions applied', done: calculated },
    { label: 'Salary summary complete', done: calculated && savedReportId }
  ];

  const kpis = [
    { label: 'Total Days', value: calc.totalDays, tone: 'blue' },
    { label: 'Present Days', value: calc.presentDays, tone: 'sky' },
    { label: 'Absent Days', value: calc.absentDays, tone: 'green' },
    { label: 'OT Hours', value: calc.otHours, tone: 'orange' },
    { label: 'Paid Days', value: calc.paidDays, tone: 'pink' },
    { label: 'Gross Salary', value: money(calc.gross), tone: 'navy' },
    { label: 'Net Salary', value: money(calc.net), tone: 'purple' }
  ];

  return (
    <div className="sal-page">
      <header className="sal-header no-print">
        <div className="att-title-wrap">
          <Calculator size={22} className="att-title-icon" />
          <div>
            <h1>Salary Calculation</h1>
            <p>From attendance → rates → calculation → summary → report.</p>
          </div>
        </div>
        <Link to="/attendance" className="btn pm-btn-outline">
          <UserCheck size={15} /> Back to Attendance
        </Link>
      </header>

      {/* Step strip */}
      <nav className="sal-steps no-print">
        {[
          'Select & Calculate',
          'Rates',
          'Details',
          'Summary',
          'Reports',
          'Notes',
          'Complete'
        ].map((s, i) => (
          <a key={s} href={`#sal-step-${i + 2}`} className="sal-step-chip">
            <span>{i + 2}</span> {s}
          </a>
        ))}
      </nav>

      {/* Steps 2-3: Selection + Calculate */}
      <section id="sal-step-2" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">2–3</span>
          <h2>Go to Salary Calculation</h2>
        </header>
        <div className="sal-card-body">
          <div className="sal-select-row">
            <Field label="Employee">
              <SearchableSelect className="input-field" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setCalculated(false); }} placeholder="Select employee">
                <option value="">Select employee</option>
                {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.username}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Department">
              <SearchableSelect className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="All">
                <option value="">All</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Shift Type">
              <SearchableSelect className="input-field" value={shiftType} onChange={(e) => setShiftType(e.target.value)} placeholder="All">
                <option value="">All</option>
                {Object.keys(SHIFTS).map((s) => <option key={s} value={s}>{s}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Month / Year">
              <input type="month" className="input-field" value={month} onChange={(e) => { setMonth(e.target.value); setCalculated(false); }} />
            </Field>
            <div className="sal-calc-btn-wrap">
              <button type="button" className="btn btn-primary" onClick={handleCalculate}>
                <Calculator size={15} /> Calculate
              </button>
            </div>
          </div>

          <div className="sal-kpi-row">
            {kpis.map((k) => (
              <div key={k.label} className={`sal-kpi tone-${k.tone}`}>
                <span>{k.label}</span>
                <strong>{k.value}</strong>
              </div>
            ))}
          </div>
          {!employeeId && <p className="sal-hint">Select an employee and click Calculate to load attendance for the month.</p>}
          {employeeId && monthRows.length === 0 && (
            <p className="sal-hint">No attendance found for this employee in {month}. <Link to="/attendance">Add attendance entries</Link> first.</p>
          )}
        </div>
      </section>

      {/* Step 4: Rates */}
      <section id="sal-step-4" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">4</span>
          <h2>Enter / Update Rates</h2>
        </header>
        <div className="sal-card-body">
          <div className="sal-rates-grid">
            <Field label="Per Day Rate (₹)">
              <input type="number" className="input-field" value={rates.perDayRate} onChange={(e) => setRates({ ...rates, perDayRate: e.target.value })} />
            </Field>
            <Field label="Overtime Rate (₹/Hr)">
              <input type="number" className="input-field" value={rates.overtimeRate} onChange={(e) => setRates({ ...rates, overtimeRate: e.target.value })} />
            </Field>
            <Field label="Shift Allowance (₹/Day)">
              <input type="number" className="input-field" value={rates.shiftAllowance} onChange={(e) => setRates({ ...rates, shiftAllowance: e.target.value })} />
            </Field>
            <Field label="Night Shift Allowance (₹/Day)">
              <input type="number" className="input-field" value={rates.nightShiftAllowance} onChange={(e) => setRates({ ...rates, nightShiftAllowance: e.target.value })} />
            </Field>
            <Field label="PF %">
              <input type="number" step="any" className="input-field" value={rates.pfPercent} onChange={(e) => setRates({ ...rates, pfPercent: e.target.value })} />
            </Field>
            <Field label="ESI %">
              <input type="number" step="any" className="input-field" value={rates.esiPercent} onChange={(e) => setRates({ ...rates, esiPercent: e.target.value })} />
            </Field>
            <Field label="Other Deduction (₹)">
              <input type="number" className="input-field" value={rates.otherDeduction} onChange={(e) => setRates({ ...rates, otherDeduction: e.target.value })} />
            </Field>
            <Field label="Attendance Bonus (₹)">
              <input type="number" className="input-field" value={rates.attendanceBonus} onChange={(e) => setRates({ ...rates, attendanceBonus: e.target.value })} />
            </Field>
          </div>
          <div className="sal-note">
            Rates are saved as company policy and can be updated before final calculation.
          </div>
          <div className="pm-form-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-primary" onClick={saveRates}><Save size={15} /> Save Rates</button>
          </div>
        </div>
      </section>

      {/* Step 5: Calculation Details */}
      <section id="sal-step-5" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">5</span>
          <h2>Check Calculation Details</h2>
        </header>
        <div className="sal-card-body">
          <div className="pm-table-wrap">
            <table className="att-table sal-detail-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Shift</th>
                  <th>In / Out</th>
                  <th>Total Hrs</th>
                  <th>OT Hrs</th>
                  <th>Status</th>
                  <th>Per Day Rate</th>
                  <th>OT Rate</th>
                  <th>Daily Amount</th>
                  <th>OT Amount</th>
                </tr>
              </thead>
              <tbody>
                {!calculated || calc.detailRows.length === 0 ? (
                  <tr><td colSpan={11} className="pm-empty">Calculate salary to see daily breakdown.</td></tr>
                ) : calc.detailRows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.dayName}</td>
                    <td>{r.shift}</td>
                    <td>{r.inTime || '—'} / {r.outTime || '—'}</td>
                    <td>{r.totalHours || '—'}</td>
                    <td>{r.otHours || '—'}</td>
                    <td>{r.status || STATUS_CODES[r.statusCode]}</td>
                    <td>{money(r.perDayRate)}</td>
                    <td>{money(r.otRate)}</td>
                    <td>{money(r.dailyAmount)}</td>
                    <td>{money(r.otAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sal-note">System automatically calculates total hours, daily amount, and OT amount.</div>
        </div>
      </section>

      {/* Step 6: Summary */}
      <section id="sal-step-6" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">6</span>
          <h2>View Salary Summary</h2>
        </header>
        <div className="sal-card-body">
          <div className="sal-kpi-row">
            {[
              ...kpis.slice(0, 5),
              { label: 'Gross Salary', value: money(calc.gross), tone: 'navy' },
              { label: 'Deductions', value: money(calc.deductions), tone: 'pink' },
              { label: 'Net Salary', value: money(calc.net), tone: 'purple' }
            ].map((k) => (
              <div key={k.label} className={`sal-kpi tone-${k.tone}`}>
                <span>{k.label}</span>
                <strong>{k.value}</strong>
              </div>
            ))}
          </div>
          <div className="sal-split">
            <div>
              <h3 className="sal-subhead">Deductions Details</h3>
              <table className="sal-mini-table">
                <tbody>
                  <tr><td>PF Employee</td><td>{money(calc.pf)}</td></tr>
                  <tr><td>ESI Employee</td><td>{money(calc.esi)}</td></tr>
                  <tr><td>Other Deductions</td><td>{money(calc.otherDed)}</td></tr>
                  <tr className="is-total"><td>Total Deductions</td><td>{money(calc.deductions)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="sal-subhead">Other Allowances</h3>
              <table className="sal-mini-table">
                <tbody>
                  <tr><td>Shift Allowance</td><td>{money(calc.shiftAllow)}</td></tr>
                  <tr><td>Night Shift Allowance</td><td>{money(calc.nightAllow)}</td></tr>
                  <tr><td>Attendance Bonus</td><td>{money(calc.attendanceBonus)}</td></tr>
                  <tr><td>Other Allowances</td><td>{money(calc.otherAllow)}</td></tr>
                  <tr className="is-total"><td>Total Allowances</td><td>{money(calc.shiftAllow + calc.nightAllow + calc.attendanceBonus + calc.otherAllow)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Step 7: Reports */}
      <section id="sal-step-7" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">7</span>
          <h2>View / Download / Print Salary Report</h2>
          <div className="sal-head-actions no-print">
            <button type="button" className="btn" onClick={exportExcel}><Download size={14} /> Export Excel</button>
            <button type="button" className="btn" onClick={printPage}><Printer size={14} /> Print</button>
            <button type="button" className="btn btn-primary" onClick={saveReport}><Save size={14} /> Save Current</button>
          </div>
        </header>
        <div className="sal-card-body">
          <div className="pm-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Month</th>
                  <th>Paid Days</th>
                  <th>OT Hrs</th>
                  <th>Gross Salary</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={8} className="pm-empty">No saved salary reports yet. Calculate and click Save Current.</td></tr>
                ) : reports.map((r) => (
                  <tr key={r.id} className={savedReportId === r.id ? 'is-highlight' : ''}>
                    <td className="att-emp">{r.employeeName}</td>
                    <td>{r.department || '—'}</td>
                    <td>{r.month}</td>
                    <td>{r.paidDays}</td>
                    <td>{r.otHours}</td>
                    <td>{money(r.gross)}</td>
                    <td>{money(r.deductions)}</td>
                    <td><strong>{money(r.net)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Step 8: Notes */}
      <section id="sal-step-8" className="premium-card sal-card no-print">
        <header className="sal-card-head">
          <span className="sal-no">8</span>
          <h2>Notes / Remarks (Optional)</h2>
        </header>
        <div className="sal-card-body">
          <textarea
            className="input-field sal-remarks"
            rows={4}
            placeholder="Add any remarks..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <div className="pm-form-actions">
            <button type="button" className="btn pm-btn-outline" disabled>
              <Paperclip size={14} /> Attach Document (Optional)
            </button>
            <button type="button" className="btn btn-primary" onClick={saveReport}><Save size={14} /> Save</button>
            <button type="button" className="btn" onClick={printPage}><Printer size={14} /> Print</button>
          </div>
        </div>
      </section>

      {/* Step 9: Complete */}
      <section id="sal-step-9" className="premium-card sal-card">
        <header className="sal-card-head">
          <span className="sal-no">9</span>
          <h2>Final Output</h2>
        </header>
        <div className="sal-card-body">
          <ul className="sal-checklist">
            {checklist.map((c) => (
              <li key={c.label} className={c.done ? 'is-done' : ''}>
                {c.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
          {calculated && (
            <div className="sal-success">
              <CheckCircle2 size={20} />
              <div>
                <strong>Your salary calculation is now complete!</strong>
                <p>{selectedUser?.name || selectedUser?.username} · {month} · Net {money(calc.net)}</p>
              </div>
              <ArrowRight size={18} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SalaryCalculation;
