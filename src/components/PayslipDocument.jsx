import React, { useEffect, useRef, useState } from 'react';
import { getPrintStampSrc, mergeCompanyProfile } from '../utils/companyProfile';
import { DEFAULT_PRINT_LOGO_SRC } from '../utils/defaultPrintLogo';

const A4_WIDTH_PX = (210 * 96) / 25.4;
const A4_HEIGHT_PX = (297 * 96) / 25.4;

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return `₹ ${num.toLocaleString('en-IN')}`;
};

const formatNumber = (val, decimals = 0) => {
  const num = parseFloat(val) || 0;
  if (decimals > 0) return num.toFixed(decimals);
  return num.toLocaleString('en-IN');
};

const formatMonthYearLabel = (monthVal) => {
  if (!monthVal) return 'OCTOBER 2026';
  if (monthVal.includes('-')) {
    const [y, m] = monthVal.split('-');
    const monthNames = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    const idx = parseInt(m, 10) - 1;
    return `${monthNames[idx] || m} ${y}`;
  }
  return String(monthVal).toUpperCase();
};

const MetaField = ({ label, children }) => (
  <div className="ps-meta-field">
    <span className="lbl">{label}</span>
    <span className="colon">:</span>
    <span className="val">{children}</span>
  </div>
);

const PayslipBrand = ({ profile }) => {
  const companyName = profile.companyName || 'UMA MICRON';
  const tagline = profile.tagline || "Micronization of API's";
  const custom = profile?.logo && String(profile.logo).startsWith('data:image') ? profile.logo : '';

  if (custom) {
    return (
      <>
        <div className="ps-logo">
          <img src={custom} alt="Logo" />
        </div>
        <div className="ps-brand-text">
          <h1>{companyName}</h1>
          <div className="tagline">{tagline}</div>
        </div>
      </>
    );
  }

  return (
    <div className="ps-brand-lockup">
      <img src={DEFAULT_PRINT_LOGO_SRC} alt="UMA MICRON" />
    </div>
  );
};

export const SinglePayslipCard = ({ emp = {}, selectedMonth = '', companyProfile = {} }) => {
  const profile = mergeCompanyProfile(companyProfile);
  const monthStr = formatMonthYearLabel(selectedMonth || emp.payMonth);
  const companyName = profile.companyName || 'UMA MICRON';
  const stampSrc = getPrintStampSrc(profile);

  const empCode = emp.empId || emp.employeeCode || emp.code || 'EMP001';
  const empName = emp.name || emp.employeeName || '—';
  const department = emp.department || '—';
  const designation = emp.designation || '—';
  const payMonthLabel = selectedMonth
    ? formatMonthYearLabel(selectedMonth)
    : (emp.payMonth || monthStr);

  const grossSalary = emp.grossSalary !== undefined ? emp.grossSalary : 0;
  const netSalary = emp.netSalary !== undefined ? emp.netSalary : grossSalary;
  const workingDays = emp.workingDays !== undefined ? emp.workingDays : 0;
  const absentDays = emp.absentDays !== undefined ? emp.absentDays : 0;
  const leaveDays = emp.leaveDays !== undefined ? emp.leaveDays : (emp.onLeaveDays || 0);
  const presentDays = emp.presentDays !== undefined
    ? emp.presentDays
    : Math.max(0, workingDays - absentDays - leaveDays);
  const otHours = emp.otHours !== undefined ? emp.otHours : 0;
  const totalHours = emp.totalHours || emp.totalWorkingHours
    || (presentDays * 8 + (parseFloat(otHours) || 0));
  const shiftType = emp.shift || emp.shiftType || '9 Hr';

  let earningsRows = [];
  if (emp.earnings && Array.isArray(emp.earnings)) {
    earningsRows = emp.earnings;
  } else if (emp.basicSalary !== undefined || emp.da !== undefined || emp.hra !== undefined) {
    earningsRows = [
      { label: 'Basic Salary', amount: emp.basicSalary || 0 },
      { label: 'Allowance', amount: (emp.da || 0) + (emp.hra || 0) + (emp.otherAllowances || 0) || emp.allowance || 0 },
      { label: 'Arrears', amount: emp.arrears || 0 },
      { label: 'Others', amount: emp.specialAllowance || emp.otPay || emp.others || 0 }
    ];
  } else {
    earningsRows = [
      { label: 'Basic Salary', amount: 0 },
      { label: 'Allowance', amount: 0 },
      { label: 'Arrears', amount: 0 },
      { label: 'Others', amount: 0 }
    ];
  }
  const totalEarning = emp.grossSalary !== undefined
    ? emp.grossSalary
    : earningsRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  let deductionsRows = [];
  if (emp.deductions && Array.isArray(emp.deductions)) {
    deductionsRows = emp.deductions;
  } else if (emp.pf !== undefined || emp.esi !== undefined || emp.pt !== undefined || emp.incomeTax !== undefined) {
    deductionsRows = [
      { label: 'Income Tax', amount: emp.incomeTax || emp.pt || 0 },
      { label: 'Van Fare', amount: emp.vanFare || 0 },
      { label: 'Security', amount: emp.securityDeduction || emp.security || 0 },
      { label: 'Others', amount: emp.otherDeductions || emp.pf || emp.esi || 0 }
    ];
  } else {
    deductionsRows = [
      { label: 'Income Tax', amount: 0 },
      { label: 'Van Fare', amount: 0 },
      { label: 'Security', amount: 0 },
      { label: 'Others', amount: 0 }
    ];
  }
  const totalDeduction = emp.totalDeductions !== undefined
    ? emp.totalDeductions
    : deductionsRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const finalNetPayment = emp.netSalary !== undefined
    ? emp.netSalary
    : (totalEarning - totalDeduction);

  return (
    <div className="payslip-container-single ps-sheet">
      <div className="ps-header">
        <div className="ps-brand">
          <PayslipBrand profile={profile} />
        </div>
        <div className="ps-doc-box">
          <div className="ps-doc-title">SALARY PAYSLIP</div>
          <div className="ps-doc-sub">{monthStr}</div>
        </div>
      </div>

      <div className="ps-meta">
        <MetaField label="Employee Code">{empCode}</MetaField>
        <MetaField label="Gross Salary">{formatCurrency(grossSalary)}</MetaField>
        <MetaField label="Employee Name">{empName}</MetaField>
        <MetaField label="Net Salary">{formatCurrency(netSalary)}</MetaField>
        <MetaField label="Department">{department}</MetaField>
        <MetaField label="Working Days">{workingDays}</MetaField>
        <MetaField label="Designation">{designation}</MetaField>
        <MetaField label="Absence / Leaves">{absentDays} / {leaveDays}</MetaField>
        <MetaField label="Pay Month">{payMonthLabel}</MetaField>
        <MetaField label="Shift">{shiftType}</MetaField>
      </div>

      <div className="ps-table-wrap">
        <table className="ps-items">
          <thead>
            <tr>
              <th>Present Days</th>
              <th>Absent Days</th>
              <th>Leave Days</th>
              <th>OT Hours</th>
              <th>Total Working Hours</th>
              <th>Shift Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{presentDays}</td>
              <td>{absentDays}</td>
              <td>{leaveDays}</td>
              <td>{formatNumber(otHours, 2)}</td>
              <td>{formatNumber(totalHours, 2)}</td>
              <td>{shiftType}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ps-split">
        <div className="ps-table-wrap">
          <table className="ps-items">
            <thead>
              <tr>
                <th colSpan={2}>Earnings</th>
              </tr>
              <tr>
                <th>Description</th>
                <th className="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {earningsRows.map((row, idx) => (
                <tr key={`e-${idx}`}>
                  <td className="left">{row.label}</td>
                  <td className="num">{formatNumber(row.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td className="total-label">Total Earning</td>
                <td className="num">{formatNumber(totalEarning)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="ps-table-wrap">
          <table className="ps-items">
            <thead>
              <tr>
                <th colSpan={2}>Deductions</th>
              </tr>
              <tr>
                <th>Description</th>
                <th className="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {deductionsRows.map((row, idx) => (
                <tr key={`d-${idx}`}>
                  <td className="left">{row.label}</td>
                  <td className="num">{formatNumber(row.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td className="total-label">Total Deduction</td>
                <td className="num">{formatNumber(totalDeduction)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="ps-net">
        <span>Net Payment</span>
        <strong>{formatCurrency(finalNetPayment)}</strong>
      </div>

      <div className="ps-sign">
        <div className="ps-sign-left">
          <div className="ps-sign-for">For {companyName}</div>
          <div className="ps-sign-note">This is a computer-generated payslip. Signature is not required.</div>
        </div>
        <div className="ps-sign-right">
          {stampSrc ? (
            <img src={stampSrc} alt="Stamp" className="ps-stamp" />
          ) : null}
          <div className="ps-sign-line" />
          <div className="ps-sign-label">Authorised Signatory</div>
        </div>
      </div>

      <div className="ps-barfoot">
        <span className="foot-side" />
        <span className="foot-msg">Prepared for salary disbursement reference.</span>
        <span className="foot-page">Page 1 of 1</span>
      </div>
    </div>
  );
};

export const DualPayslipPrintView = ({ emp = {}, selectedMonth = '', companyProfile = {} }) => (
  <div className="printable-payslip-page">
    <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />
    <div className="payslip-cut-line">
      <span>✂ Cut Here</span>
    </div>
    <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />
  </div>
);

export const PayslipA4Preview = (props) => {
  const slotRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return undefined;
    const fit = () => {
      const width = el.clientWidth || A4_WIDTH_PX;
      setScale(Math.min(1, width / A4_WIDTH_PX));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={slotRef} className="payslip-screen-preview" style={{ width: '100%' }}>
      <div
        className="payslip-a4-slot"
        style={{
          width: A4_WIDTH_PX * scale,
          height: A4_HEIGHT_PX * scale,
          margin: '0 auto',
          overflow: 'hidden'
        }}
      >
        <div
          className="payslip-a4-scale"
          style={{
            width: A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          <DualPayslipPrintView {...props} />
        </div>
      </div>
    </div>
  );
};

export default SinglePayslipCard;
