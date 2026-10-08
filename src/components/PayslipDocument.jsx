import React from 'react';

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
      border: '1.5px solid #cfd5f5',
      borderRadius: '8px',
      padding: '0.65rem 0.95rem',
      boxSizing: 'border-box',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: '#1e1b4b',
      fontSize: '0.76rem',
      lineHeight: '1.3',
      width: '100%',
      maxWidth: '790px',
      margin: '0 auto',
      boxShadow: '0 1px 4px rgba(43, 38, 103, 0.02)'
    }}>
      {/* 1. HEADER SECTION */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.55rem',
        gap: '0.5rem'
      }}>
        {/* Left Company Titles */}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.45rem',
            fontWeight: 900,
            color: '#2b2667',
            letterSpacing: '0.01em',
            lineHeight: 1.1
          }}>
            {companyName}
          </h1>
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#4a457e',
            margin: '0.12rem 0 0.08rem 0'
          }}>
            {tagline}
          </div>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            color: '#64609a',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            {subHeader}
          </div>
        </div>

        {/* Right Badge Box */}
        <div style={{
          background: '#eaeefd',
          border: '1.5px solid #d4d8f6',
          borderRadius: '6px',
          padding: '0.4rem 1.1rem',
          textAlign: 'center',
          minWidth: '180px'
        }}>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 900,
            color: '#2b2667',
            letterSpacing: '0.04em'
          }}>
            SALARY PAYSLIP
          </div>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#3b347a',
            marginTop: '0.12rem',
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
        gap: '0.6rem',
        marginBottom: '0.55rem'
      }}>
        {/* Left Box: EMPLOYEE DETAILS */}
        <div style={{
          border: '1.5px solid #cfd5f5',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          <div style={{
            background: '#eaeefd',
            padding: '0.35rem 0.75rem',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: '#2b2667',
            borderBottom: '1.5px solid #cfd5f5',
            letterSpacing: '0.03em'
          }}>
            EMPLOYEE DETAILS
          </div>
          <div style={{
            padding: '0.45rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.26rem',
            fontSize: '0.76rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Employee Code</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#1e1b4b' }}>{empCode}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Employee Name</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#1e1b4b' }}>{empName}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Department</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{department}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Designation</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{designation}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Pay Month</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{payMonthLabel}</span>
            </div>
          </div>
        </div>

        {/* Right Box: SALARY DETAILS */}
        <div style={{
          border: '1.5px solid #cfd5f5',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          <div style={{
            background: '#eaeefd',
            padding: '0.35rem 0.75rem',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: '#2b2667',
            borderBottom: '1.5px solid #cfd5f5',
            letterSpacing: '0.03em'
          }}>
            SALARY DETAILS
          </div>
          <div style={{
            padding: '0.45rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.26rem',
            fontSize: '0.76rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Gross Salary</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#1e1b4b' }}>{formatCurrency(grossSalary)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Net Salary</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <strong style={{ color: '#1e1b4b' }}>{formatCurrency(netSalary)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Working Days</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{workingDays}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Absence</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{absentDays}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px 10px 1fr' }}>
              <span style={{ color: '#332e67', fontWeight: 600 }}>Leaves</span>
              <span style={{ fontWeight: 700 }}>:</span>
              <span>{leaveDays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ATTENDANCE & OT SUMMARY */}
      <div style={{
        border: '1.5px solid #cfd5f5',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '0.55rem',
        background: '#ffffff'
      }}>
        <div style={{
          background: '#eaeefd',
          padding: '0.35rem 0.75rem',
          fontWeight: 800,
          fontSize: '0.75rem',
          color: '#2b2667',
          borderBottom: '1.5px solid #cfd5f5',
          letterSpacing: '0.03em'
        }}>
          ATTENDANCE & OT SUMMARY
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          textAlign: 'center',
          fontSize: '0.74rem'
        }}>
          {/* Header Row */}
          <div style={{ padding: '0.35rem 0.25rem', borderRight: '1px solid #cfd5f5', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>Present Days</div>
          <div style={{ padding: '0.35rem 0.25rem', borderRight: '1px solid #cfd5f5', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>Absent Days</div>
          <div style={{ padding: '0.35rem 0.25rem', borderRight: '1px solid #cfd5f5', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>Leave Days</div>
          <div style={{ padding: '0.35rem 0.25rem', borderRight: '1px solid #cfd5f5', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>OT Hours</div>
          <div style={{ padding: '0.35rem 0.25rem', borderRight: '1px solid #cfd5f5', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>Total Working Hours</div>
          <div style={{ padding: '0.35rem 0.25rem', borderBottom: '1px solid #cfd5f5', background: '#f8f9ff', fontWeight: 700, color: '#332e67' }}>Shift Type</div>

          {/* Value Row */}
          <div style={{ padding: '0.38rem 0.25rem', borderRight: '1px solid #cfd5f5', fontWeight: 700 }}>{presentDays}</div>
          <div style={{ padding: '0.38rem 0.25rem', borderRight: '1px solid #cfd5f5', fontWeight: 700 }}>{absentDays}</div>
          <div style={{ padding: '0.38rem 0.25rem', borderRight: '1px solid #cfd5f5', fontWeight: 700 }}>{leaveDays}</div>
          <div style={{ padding: '0.38rem 0.25rem', borderRight: '1px solid #cfd5f5', fontWeight: 700 }}>{formatNumber(otHours, 2)}</div>
          <div style={{ padding: '0.38rem 0.25rem', borderRight: '1px solid #cfd5f5', fontWeight: 700 }}>{formatNumber(totalHours, 2)}</div>
          <div style={{ padding: '0.38rem 0.25rem', fontWeight: 700 }}>{shiftType}</div>
        </div>
      </div>

      {/* 4. EARNINGS & DEDUCTIONS TABLES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.6rem',
        marginBottom: '0.55rem'
      }}>
        {/* Left Box: EARNINGS */}
        <div style={{
          border: '1.5px solid #cfd5f5',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: '#eaeefd',
            padding: '0.35rem 0.75rem',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: '#2b2667',
            borderBottom: '1.5px solid #cfd5f5',
            letterSpacing: '0.03em'
          }}>
            EARNINGS
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cfd5f5', background: '#f8f9ff' }}>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.75rem', fontWeight: 700, color: '#332e67' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.75rem', fontWeight: 700, color: '#332e67' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {earningsRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eef1fc' }}>
                    <td style={{ padding: '0.28rem 0.75rem', color: '#1e1b4b' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '0.28rem 0.75rem', color: '#1e1b4b' }}>
                      {formatNumber(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              padding: '0.35rem 0.75rem',
              borderTop: '1.5px solid #cfd5f5',
              background: '#f8f9ff',
              fontWeight: 800,
              fontSize: '0.78rem',
              color: '#2b2667'
            }}>
              <span>Total Earning</span>
              <span>{formatNumber(totalEarning)}</span>
            </div>
          </div>
        </div>

        {/* Right Box: DEDUCTIONS */}
        <div style={{
          border: '1.5px solid #cfd5f5',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: '#eaeefd',
            padding: '0.35rem 0.75rem',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: '#2b2667',
            borderBottom: '1.5px solid #cfd5f5',
            letterSpacing: '0.03em'
          }}>
            DEDUCTIONS
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cfd5f5', background: '#f8f9ff' }}>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.75rem', fontWeight: 700, color: '#332e67' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.75rem', fontWeight: 700, color: '#332e67' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {deductionsRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eef1fc' }}>
                    <td style={{ padding: '0.28rem 0.75rem', color: '#1e1b4b' }}>{row.label}</td>
                    <td style={{ textAlign: 'right', padding: '0.28rem 0.75rem', color: '#1e1b4b' }}>
                      {formatNumber(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              padding: '0.35rem 0.75rem',
              borderTop: '1.5px solid #cfd5f5',
              background: '#f8f9ff',
              fontWeight: 800,
              fontSize: '0.78rem',
              color: '#2b2667'
            }}>
              <span>Total Deduction</span>
              <span>{formatNumber(totalDeduction)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. NET PAYMENT BANNER */}
      <div style={{
        background: '#eaeefd',
        border: '1.5px solid #cfd5f5',
        borderRadius: '6px',
        padding: '0.45rem 0.85rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        marginBottom: '0.55rem'
      }}>
        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#2b2667', letterSpacing: '0.01em' }}>
          Net Payment
        </span>
        <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#2b2667' }}>
          {formatCurrency(finalNetPayment)}
        </span>
      </div>

      {/* 6. SIGNATURE & COMPUTER GENERATED FOOTER */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'flex-end',
        paddingTop: '0.3rem',
        fontSize: '0.72rem'
      }}>
        <div>
          <div style={{ fontWeight: 800, color: '#2b2667', fontSize: '0.78rem' }}>
            For {companyName}
          </div>
          <div style={{
            fontSize: '0.68rem',
            color: '#64748b',
            marginTop: '0.75rem'
          }}>
            This is a computer-generated payslip. Signature is not required.
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            borderBottom: '1px dashed #64748b',
            width: '150px',
            marginBottom: '4px',
            display: 'inline-block'
          }}></div>
          <div style={{ fontWeight: 700, color: '#2b2667', fontSize: '0.75rem' }}>
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
};

export const DualPayslipPrintView = ({ emp = {}, selectedMonth = '', companyProfile = {} }) => {
  return (
    <div className="printable-payslip-page" style={{ width: '100%', maxWidth: '790px', margin: '0 auto', background: '#fff', boxSizing: 'border-box' }}>
      {/* Top Copy */}
      <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />

      {/* Cut Line Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        margin: '0.4rem 0',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          borderTop: '1.5px dashed #8b92b2',
          zIndex: 1
        }}></div>
        <div style={{
          background: '#ffffff',
          padding: '0 8px',
          zIndex: 2,
          fontSize: '0.7rem',
          color: '#64748b',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>✂</span> <span>Cut Here</span> <span>---------------------------------------------------------------------------------------------------------</span>
        </div>
      </div>

      {/* Bottom Copy */}
      <SinglePayslipCard emp={emp} selectedMonth={selectedMonth} companyProfile={companyProfile} />
    </div>
  );
};

export default SinglePayslipCard;
