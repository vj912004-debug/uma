import React, { useEffect, useRef, useState } from 'react';
import { getPrintStampSrc } from '../utils/companyProfile';

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
  return monthVal.toUpperCase();
};

export const SinglePayslipCard = ({ emp = {}, selectedMonth = '', companyProfile = {} }) => {
  const monthStr = formatMonthYearLabel(selectedMonth || emp.payMonth);
  const companyName = companyProfile.companyName || 'UMA MICRON';
  const stampSrc = getPrintStampSrc(companyProfile);
  const tagline = companyProfile.tagline || 'Micronization for a Better Tomorrow';
  const subHeader = companyProfile.subHeader || 'ERP & PROCESS TRACKING';

  // Dynamic values with standard defaults matching sample format
  const empCode = emp.empId || emp.employeeCode || emp.code || 'EMP001';
  const empName = emp.name || emp.employeeName || 'Mittalben Kirtibhai Motka';
  const department = emp.department || 'Sales';
  const designation = emp.designation || 'Sales Executive';
  const payMonthLabel = selectedMonth ? formatMonthYearLabel(selectedMonth) : (emp.payMonth || 'October 2026');

  const grossSalary = emp.grossSalary !== undefined ? emp.grossSalary : 50000;
  const netSalary = emp.netSalary !== undefined ? emp.netSalary : grossSalary;
  const workingDays = emp.workingDays !== undefined ? emp.workingDays : 31;
  const absentDays = emp.absentDays !== undefined ? emp.absentDays : 0;
  const leaveDays = emp.leaveDays !== undefined ? emp.leaveDays : (emp.onLeaveDays || 0);
  const presentDays = emp.presentDays !== undefined ? emp.presentDays : (workingDays - absentDays - leaveDays);
  const otHours = emp.otHours !== undefined ? emp.otHours : 0;
  const totalHours = emp.totalHours || emp.totalWorkingHours || (presentDays * 8 + (parseFloat(otHours) || 0));
  const shiftType = emp.shift || emp.shiftType || '9 Hr';

  // Earnings Breakdown
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
      { label: 'Basic Salary', amount: 20000 },
      { label: 'Allowance', amount: 10000 },
      { label: 'Arrears', amount: 10000 },
      { label: 'Others', amount: 10000 }
    ];
  }
  const totalEarning = emp.grossSalary !== undefined ? emp.grossSalary : earningsRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Deductions Breakdown
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
  const totalDeduction = emp.totalDeductions !== undefined ? emp.totalDeductions : deductionsRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const finalNetPayment = emp.netSalary !== undefined ? emp.netSalary : (totalEarning - totalDeduction);

  return (
    <div className="payslip-container-single" style={{
      background: '#ffffff',
      border: '1.5px solid #CFC4EA',
      borderRadius: '8px',
      padding: '1.6mm 2.2mm 1.2mm',
      boxSizing: 'border-box',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: '#231f20',
      fontSize: '9.5px',
      lineHeight: 1.2,
      width: '100%',
      margin: 0,
      boxShadow: 'none',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 1. HEADER SECTION */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'start',
        columnGap: '4mm',
        marginBottom: '1.4mm'
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 900,
            color: '#3D2B7D',
            letterSpacing: '0.01em',
            lineHeight: 1.1,
            overflowWrap: 'anywhere'
          }}>
            {companyName}
          </h1>
          <div style={{
            fontSize: '9px',
            fontWeight: 600,
            color: '#3D2B7D',
            margin: '0.4mm 0 0.2mm 0',
            overflowWrap: 'anywhere'
          }}>
            {tagline}
          </div>
          <div style={{
            fontSize: '8px',
            fontWeight: 800,
            color: '#3D2B7D',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            overflowWrap: 'anywhere'
          }}>
            {subHeader}
          </div>
        </div>

        <div style={{
          background: '#EFEAF7',
          border: '1.5px solid #CFC4EA',
          borderRadius: '6px',
          padding: '1.2mm 3mm',
          textAlign: 'center',
          justifySelf: 'end',
          whiteSpace: 'nowrap'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 900,
            color: '#3D2B7D',
            letterSpacing: '0.04em'
          }}>
            SALARY PAYSLIP
          </div>
          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#3D2B7D',
            marginTop: '0.4mm',
            letterSpacing: '0.02em'
          }}>
            FOR {monthStr}
          </div>
        </div>
      </div>

      {/* 2. EMPLOYEE DETAILS & SALARY DETAILS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2mm',
        marginBottom: '1.4mm'
      }}>
        {/* Left Box: EMPLOYEE DETAILS */}
        <div style={{
          border: '1.5px solid #CFC4EA',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          <div style={{
            background: '#EFEAF7',
            padding: '1mm 2.2mm',
            fontWeight: 800,
            fontSize: '8.5px',
            color: '#3D2B7D',
            borderBottom: '1.5px solid #CFC4EA',
            letterSpacing: '0.03em'
          }}>
            EMPLOYEE DETAILS
          </div>
          <div style={{
            padding: '1.1mm 2.2mm',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5mm',
            fontSize: '9px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Employee Code</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#231f20' }}>{empCode}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Employee Name</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#231f20' }}>{empName}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Department</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{department}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Designation</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{designation}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Pay Month</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{payMonthLabel}</span>
            </div>
          </div>
        </div>

        {/* Right Box: SALARY DETAILS */}
        <div style={{
          border: '1.5px solid #CFC4EA',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          <div style={{
            background: '#EFEAF7',
            padding: '1mm 2.2mm',
            fontWeight: 800,
            fontSize: '8.5px',
            color: '#3D2B7D',
            borderBottom: '1.5px solid #CFC4EA',
            letterSpacing: '0.03em'
          }}>
            SALARY DETAILS
          </div>
          <div style={{
            padding: '1.1mm 2.2mm',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5mm',
            fontSize: '9px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Gross Salary</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#231f20' }}>{formatCurrency(grossSalary)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Net Salary</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#231f20' }}>{formatCurrency(netSalary)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Working Days</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{workingDays}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Absence</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{absentDays}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#3D2B7D', fontWeight: 600 }}>Leaves</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{leaveDays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ATTENDANCE & OT SUMMARY */}
      <div style={{
        border: '1.5px solid #CFC4EA',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '1.4mm',
        background: '#ffffff'
      }}>
        <div style={{
          background: '#EFEAF7',
          padding: '1mm 2.2mm',
          fontWeight: 800,
          fontSize: '8.5px',
          color: '#3D2B7D',
          borderBottom: '1.5px solid #CFC4EA',
          letterSpacing: '0.03em'
        }}>
          ATTENDANCE & OT SUMMARY
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          textAlign: 'center',
          fontSize: '8.5px'
        }}>
          {/* Header Row */}
          <div style={{ padding: '0.8mm 0.4mm', borderRight: '1px solid #CFC4EA', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>Present Days</div>
          <div style={{ padding: '0.8mm 0.4mm', borderRight: '1px solid #CFC4EA', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>Absent Days</div>
          <div style={{ padding: '0.8mm 0.4mm', borderRight: '1px solid #CFC4EA', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>Leave Days</div>
          <div style={{ padding: '0.8mm 0.4mm', borderRight: '1px solid #CFC4EA', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>OT Hours</div>
          <div style={{ padding: '0.8mm 0.4mm', borderRight: '1px solid #CFC4EA', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>Total Working Hours</div>
          <div style={{ padding: '0.8mm 0.4mm', borderBottom: '1px solid #CFC4EA', background: '#EFEAF7', fontWeight: 700, color: '#3D2B7D' }}>Shift Type</div>

          {/* Value Row */}
          <div style={{ padding: '0.9mm 0.4mm', borderRight: '1px solid #CFC4EA', fontWeight: 700 }}>{presentDays}</div>
          <div style={{ padding: '0.9mm 0.4mm', borderRight: '1px solid #CFC4EA', fontWeight: 700 }}>{absentDays}</div>
          <div style={{ padding: '0.9mm 0.4mm', borderRight: '1px solid #CFC4EA', fontWeight: 700 }}>{leaveDays}</div>
          <div style={{ padding: '0.9mm 0.4mm', borderRight: '1px solid #CFC4EA', fontWeight: 700 }}>{formatNumber(otHours, 2)}</div>
          <div style={{ padding: '0.9mm 0.4mm', borderRight: '1px solid #CFC4EA', fontWeight: 700 }}>{formatNumber(totalHours, 2)}</div>
          <div style={{ padding: '0.9mm 0.4mm', fontWeight: 700 }}>{shiftType}</div>
        </div>
      </div>

      {/* 4. EARNINGS & DEDUCTIONS TABLES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2mm',
        marginBottom: '1.4mm'
      }}>
        {/* Left Box: EARNINGS */}
        <div style={{
          border: '1.5px solid #CFC4EA',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: '#EFEAF7',
            padding: '1mm 2.2mm',
            fontWeight: 800,
            fontSize: '8.5px',
            color: '#3D2B7D',
            borderBottom: '1.5px solid #CFC4EA',
            letterSpacing: '0.03em'
          }}>
            EARNINGS
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #CFC4EA', background: '#3D2B7D' }}>
                  <th style={{ textAlign: 'left', padding: '0.8mm 2.2mm', fontWeight: 700, color: '#fff' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '0.8mm 2.2mm', fontWeight: 700, color: '#fff' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {earningsRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #CFC4EA' }}>
                    <td style={{ padding: '0.6mm 2.2mm', color: '#231f20' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '0.6mm 2.2mm', color: '#231f20' }}>
                      {formatNumber(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1mm 2.2mm',
              borderTop: '1.5px solid #CFC4EA',
              background: '#EFEAF7',
              fontWeight: 800,
              fontSize: '9px',
              color: '#3D2B7D'
            }}>
              <span>Total Earning</span>
              <span>{formatNumber(totalEarning)}</span>
            </div>
          </div>
        </div>

        {/* Right Box: DEDUCTIONS */}
        <div style={{
          border: '1.5px solid #CFC4EA',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: '#EFEAF7',
            padding: '1mm 2.2mm',
            fontWeight: 800,
            fontSize: '8.5px',
            color: '#3D2B7D',
            borderBottom: '1.5px solid #CFC4EA',
            letterSpacing: '0.03em'
          }}>
            DEDUCTIONS
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #CFC4EA', background: '#3D2B7D' }}>
                  <th style={{ textAlign: 'left', padding: '0.8mm 2.2mm', fontWeight: 700, color: '#fff' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '0.8mm 2.2mm', fontWeight: 700, color: '#fff' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {deductionsRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #CFC4EA' }}>
                    <td style={{ padding: '0.6mm 2.2mm', color: '#231f20' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '0.6mm 2.2mm', color: '#231f20' }}>
                      {formatNumber(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1mm 2.2mm',
              borderTop: '1.5px solid #CFC4EA',
              background: '#EFEAF7',
              fontWeight: 800,
              fontSize: '9px',
              color: '#3D2B7D'
            }}>
              <span>Total Deduction</span>
              <span>{formatNumber(totalDeduction)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. NET PAYMENT BANNER */}
      <div style={{
        background: '#EFEAF7',
        border: '1.5px solid #CFC4EA',
        borderRadius: '6px',
        padding: '1.2mm 2.4mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.2mm'
      }}>
        <span style={{ fontWeight: 800, fontSize: '11px', color: '#3D2B7D', letterSpacing: '0.01em' }}>
          Net Payment
        </span>
        <span style={{ fontWeight: 900, fontSize: '14px', color: '#3D2B7D' }}>
          {formatCurrency(finalNetPayment)}
        </span>
      </div>

      {/* 6. SIGNATURE & COMPUTER GENERATED FOOTER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '2mm',
        paddingTop: '0.4mm',
        marginTop: 'auto',
        fontSize: '8.5px'
      }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: '#3D2B7D', fontSize: '9.5px' }}>
            For {companyName}
          </div>
          <div style={{
            fontSize: '8px',
            color: '#64748b',
            marginTop: '0.6mm'
          }}>
            This is a computer-generated payslip. Signature is not required.
          </div>
        </div>

        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {stampSrc ? (
            <img
              src={stampSrc}
              alt="Stamp"
              style={{
                height: 38,
                width: 'auto',
                maxWidth: 84,
                objectFit: 'contain',
                display: 'block',
                marginBottom: 2,
                mixBlendMode: 'multiply'
              }}
            />
          ) : null}
          <div style={{
            borderBottom: '1px dashed #64748b',
            width: '132px',
            marginBottom: '4px'
          }}></div>
          <div style={{ fontWeight: 700, color: '#3D2B7D', fontSize: '8.5px', whiteSpace: 'nowrap' }}>
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
};

export const DualPayslipPrintView = ({ emp = {}, selectedMonth = '', companyProfile = {} }) => {
  return (
    <div className="printable-payslip-page">
      <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />
      <div className="payslip-cut-line">
        <span>✂ Cut Here</span>
      </div>
      <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />
    </div>
  );
};

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
