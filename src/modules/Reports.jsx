import { formatDate } from '../utils/dateUtils';
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Download } from 'lucide-react';
import ExportButton from '../components/ExportButton';

const Reports = () => {
  const { data } = useAppContext();
  const [activeReport, setActiveReport] = useState('Sales');

  const ReportTab = ({ id, name }) => (
    <button 
      onClick={() => setActiveReport(id)}
      className="btn"
      style={{
        background: activeReport === id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        color: activeReport === id ? 'var(--accent-secondary)' : 'var(--text-muted)',
        border: activeReport === id ? '1px solid var(--accent-secondary)' : '1px solid transparent',
      }}
    >
      {name}
    </button>
  );

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>Analyze your business performance and compliance.</p>
        </div>
        <button className="btn btn-primary" style={{ background: 'var(--accent-secondary)' }}>
          <Download size={20} /> Export Generic
        </button>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <ReportTab id="Sales" name="Sales Report" />
        <ReportTab id="Stock" name="Stock Report" />
        <ReportTab id="GST" name="GST Report" />
        <ReportTab id="Payment" name="Payment Report" />
        <ReportTab id="Consumption" name="Consumption Report" />
        <ReportTab id="Attendance" name="Attendance Report" />
      </div>

      <div className="premium-card">
        {activeReport === 'Sales' && <SalesTable data={data.invoices || []} />}
        {activeReport === 'GST' && <GSTTable data={data.invoices || []} />}
        {activeReport === 'Payment' && <PaymentTable data={data.payments || []} />}
        {activeReport === 'Stock' && <StockSummary data={data} />}
        {activeReport === 'Consumption' && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Material Consumption analytics based on BPR logs.</div>}
        {activeReport === 'Attendance' && <AttendanceReports data={data} />}
      </div>
    </div>
  );
};

// --- Attendance Reports Sub-module ---
const AttendanceReports = ({ data }) => {
  const [subReport, setSubReport] = useState('Daily');
  const attendance = (data.attendance || []).filter(a => !a.isDeleted);
  const users = data.users || [];

  const SubTab = ({ id, name }) => (
    <button 
      onClick={() => setSubReport(id)}
      style={{
        padding: '0.5rem 1rem', background: subReport === id ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none', color: subReport === id ? '#fff' : 'var(--text-muted)',
        borderBottom: subReport === id ? '2px solid var(--accent-primary)' : '2px solid transparent',
        cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
      }}
    >
      {name}
    </button>
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const dailyData = attendance.filter(a => a.date === todayStr);
  
  const lateData = attendance.filter(a => a.isLate).reduce((acc, curr) => {
    acc[curr.username] = (acc[curr.username] || 0) + 1;
    return acc;
  }, {});
  const lateList = Object.entries(lateData).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);

  const otData = attendance.filter(a => parseFloat(a.otHours) > 0);

  // Leave balance simple mock: assume 20 CL per year
  const leaveBalance = users.map(u => {
    const used = attendance.filter(a => a.userId === String(u.id) && ['CL', 'SL', 'PL'].includes(a.statusCode)).length;
    return { name: u.username, total: 20, used, balance: 20 - used };
  });

  // Salary Sheet (Monthly summary)
  const currentMonth = todayStr.substring(0, 7);
  const salarySheet = users.map(u => {
    const userAtt = attendance.filter(a => a.userId === String(u.id) && a.date.startsWith(currentMonth));
    const presents = userAtt.filter(a => a.statusCode === 'P').length;
    const absents = userAtt.filter(a => a.statusCode === 'A').length;
    const totalOT = userAtt.reduce((sum, a) => sum + (parseFloat(a.otHours) || 0), 0);
    return { empId: u.employeeId, name: u.username, month: currentMonth, presents, absents, totalOT: totalOT.toFixed(2) };
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <SubTab id="Daily" name="Daily Report" />
        <SubTab id="Monthly" name="Monthly Summary" />
        <SubTab id="Late" name="Late Coming" />
        <SubTab id="OT" name="Overtime" />
        <SubTab id="Leave" name="Leave Balance" />
        <SubTab id="Salary" name="Salary Attendance Sheet" />
      </div>

      <div style={{ overflowX: 'auto', minHeight: '300px' }}>
        {subReport === 'Daily' && (
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Date</th><th>Employee</th><th>In Time</th><th>Out Time</th><th>Status</th></tr></thead>
            <tbody>
              {dailyData.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center' }}>No records for today ({todayStr}).</td></tr> : 
                dailyData.map(d => <tr key={d.id}><td>{d.date}</td><td>{d.username}</td><td>{d.inTime||'-'}</td><td>{d.outTime||'-'}</td><td>{d.status}</td></tr>)
              }
            </tbody>
          </table>
        )}

        {subReport === 'Monthly' && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Select a month to view detailed Day 1 to Day 31 presence map.
          </div>
        )}

        {subReport === 'Late' && (
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Employee Name</th><th>Total Late Days (All Time)</th></tr></thead>
            <tbody>
              {lateList.length === 0 ? <tr><td colSpan="2" style={{ textAlign: 'center' }}>No late records found.</td></tr> : 
                lateList.map((l, i) => <tr key={i}><td>{l.name}</td><td style={{ color: '#f87171', fontWeight: 'bold' }}>{l.count} Days</td></tr>)
              }
            </tbody>
          </table>
        )}

        {subReport === 'OT' && (
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Date</th><th>Employee</th><th>Shift</th><th>Total Hrs</th><th>OT Hrs</th></tr></thead>
            <tbody>
              {otData.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center' }}>No overtime records found.</td></tr> : 
                otData.map(d => <tr key={d.id}><td>{d.date}</td><td>{d.username}</td><td>{d.shift}</td><td>{d.totalHours}</td><td style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{d.otHours}</td></tr>)
              }
            </tbody>
          </table>
        )}

        {subReport === 'Leave' && (
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead><tr><th>Employee Name</th><th>Total Leaves</th><th>Used Leaves</th><th>Balance</th></tr></thead>
            <tbody>
              {leaveBalance.map((l, i) => <tr key={i}><td>{l.name}</td><td>{l.total}</td><td>{l.used}</td><td style={{ fontWeight: 'bold' }}>{l.balance}</td></tr>)}
            </tbody>
          </table>
        )}

        {subReport === 'Salary' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Salary Attendance Data - {currentMonth}</h3>
              <ExportButton data={salarySheet} columns={[
                {label: 'Emp ID', key: 'empId'}, {label: 'Name', key: 'name'}, {label: 'Month', key: 'month'}, 
                {label: 'Presents', key: 'presents'}, {label: 'Absents', key: 'absents'}, {label: 'Total OT Hrs', key: 'totalOT'}
              ]} filename={`Salary_Sheet_${currentMonth}`} title="Salary Attendance Sheet" />
            </div>
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>Emp ID</th><th>Employee Name</th><th>Month</th><th>Present Days</th><th>Absent Days</th><th>Total OT Hrs</th></tr></thead>
              <tbody>
                {salarySheet.map((s, i) => <tr key={i}><td>{s.empId}</td><td>{s.name}</td><td>{s.month}</td><td style={{ color: '#34d399', fontWeight: 'bold' }}>{s.presents}</td><td style={{ color: '#f87171' }}>{s.absents}</td><td style={{ color: 'var(--accent-primary)' }}>{s.totalOT}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Other Existing Reports ---
const SalesTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="data-table">
      <thead><tr><th>Invoice No</th><th>Date</th><th>Party</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead>
      <tbody>
        {data.map(inv => (
          <tr key={inv.id}>
            <td>{inv.invoiceNo}</td><td>{formatDate(inv.date)}</td><td>{inv.partyName}</td>
            <td>₹{inv.subtotal.toLocaleString()}</td><td>₹{inv.taxAmount.toLocaleString()}</td>
            <td style={{ fontWeight: 600 }}>₹{inv.total.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GSTTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="data-table">
      <thead><tr><th>Invoice No</th><th>Party GSTIN</th><th>Rate</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
      <tbody>
        {data.map(inv => (
          <tr key={inv.id}>
            <td>{inv.invoiceNo}</td><td>{inv.partyGstin || 'URD'}</td><td>{inv.taxRate}%</td>
            <td>₹{(inv.taxAmount / 2).toLocaleString()}</td><td>₹{(inv.taxAmount / 2).toLocaleString()}</td><td>-</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PaymentTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="data-table">
      <thead><tr><th>Date</th><th>Invoice</th><th>Party</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead>
      <tbody>
        {data.map(pay => (
          <tr key={pay.id}>
            <td>{formatDate(pay.date)}</td><td>{pay.invoiceNo}</td><td>{pay.partyName}</td>
            <td>{pay.paymentMode}</td><td>{pay.referenceNo}</td><td style={{ fontWeight: 600 }}>₹{Number(pay.amount).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StockSummary = ({ data }) => {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Total RM Value</p>
          <h2 style={{ fontSize: '2rem' }}>₹ 1,25,000</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Total FG Value</p>
          <h2 style={{ fontSize: '2rem' }}>₹ 4,50,000</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Stock Accuracy</p>
          <h2 style={{ fontSize: '2rem', color: 'var(--accent-primary)' }}>98.5%</h2>
        </div>
      </div>
    </div>
  );
};

export default Reports;
