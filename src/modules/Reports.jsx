import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { BarChart3, PieChart, FileText, Download } from 'lucide-react';

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
          <Download size={20} /> Export Excel
        </button>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <ReportTab id="Sales" name="Sales Report" />
        <ReportTab id="Stock" name="Stock Report" />
        <ReportTab id="GST" name="GST Report" />
        <ReportTab id="Payment" name="Payment Report" />
        <ReportTab id="Consumption" name="Consumption Report" />
      </div>

      <div className="premium-card">
        {activeReport === 'Sales' && <SalesTable data={data.invoices} />}
        {activeReport === 'GST' && <GSTTable data={data.invoices} />}
        {activeReport === 'Payment' && <PaymentTable data={data.payments} />}
        {activeReport === 'Stock' && <StockSummary data={data} />}
        {activeReport === 'Consumption' && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Material Consumption analytics based on BPR logs.</div>}
      </div>
    </div>
  );
};

const SalesTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ padding: '1rem' }}>Invoice No</th>
          <th style={{ padding: '1rem' }}>Date</th>
          <th style={{ padding: '1rem' }}>Party</th>
          <th style={{ padding: '1rem' }}>Taxable</th>
          <th style={{ padding: '1rem' }}>GST</th>
          <th style={{ padding: '1rem' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {data.map(inv => (
          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '1rem' }}>{inv.invoiceNo}</td>
            <td style={{ padding: '1rem' }}>{inv.date}</td>
            <td style={{ padding: '1rem' }}>{inv.partyName}</td>
            <td style={{ padding: '1rem' }}>₹{inv.subtotal.toLocaleString()}</td>
            <td style={{ padding: '1rem' }}>₹{inv.taxAmount.toLocaleString()}</td>
            <td style={{ padding: '1rem', fontWeight: 600 }}>₹{inv.total.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GSTTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ padding: '1rem' }}>Invoice No</th>
          <th style={{ padding: '1rem' }}>Party GSTIN</th>
          <th style={{ padding: '1rem' }}>Rate</th>
          <th style={{ padding: '1rem' }}>CGST</th>
          <th style={{ padding: '1rem' }}>SGST</th>
          <th style={{ padding: '1rem' }}>IGST</th>
        </tr>
      </thead>
      <tbody>
        {data.map(inv => (
          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '1rem' }}>{inv.invoiceNo}</td>
            <td style={{ padding: '1rem' }}>{inv.partyGstin || 'URD'}</td>
            <td style={{ padding: '1rem' }}>{inv.taxRate}%</td>
            <td style={{ padding: '1rem' }}>₹{(inv.taxAmount / 2).toLocaleString()}</td>
            <td style={{ padding: '1rem' }}>₹{(inv.taxAmount / 2).toLocaleString()}</td>
            <td style={{ padding: '1rem' }}>-</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PaymentTable = ({ data }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ padding: '1rem' }}>Date</th>
          <th style={{ padding: '1rem' }}>Invoice</th>
          <th style={{ padding: '1rem' }}>Party</th>
          <th style={{ padding: '1rem' }}>Mode</th>
          <th style={{ padding: '1rem' }}>Reference</th>
          <th style={{ padding: '1rem' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.map(pay => (
          <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
            <td style={{ padding: '1rem' }}>{pay.date}</td>
            <td style={{ padding: '1rem' }}>{pay.invoiceNo}</td>
            <td style={{ padding: '1rem' }}>{pay.partyName}</td>
            <td style={{ padding: '1rem' }}>{pay.paymentMode}</td>
            <td style={{ padding: '1rem' }}>{pay.referenceNo}</td>
            <td style={{ padding: '1rem', fontWeight: 600 }}>₹{Number(pay.amount).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StockSummary = ({ data }) => {
  // Simple summary for demo
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
