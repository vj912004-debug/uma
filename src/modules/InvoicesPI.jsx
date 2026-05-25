import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Download, Trash2, ExternalLink } from 'lucide-react';
import { exportToPDF } from '../utils/pdfExport';
import ExportButton from '../components/ExportButton';

const InvoicesPI = () => {
  const { data, deleteDataSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  const piList = (data.invoices || []).filter(inv => inv.type === 'Proforma Invoice' && !inv.isDeleted);
  const filtered = piList.filter(inv => 
    (inv.invoiceNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.partyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportColumns = [
    { label: 'Date', key: 'date' },
    { label: 'PI Number', key: 'invoiceNo' },
    { label: 'Party Name', key: 'partyName' },
    { label: 'Qty (Kg)', key: 'qty' },
    { label: 'Total (₹)', key: 'total' }
  ];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Proforma Invoices</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and manage generated PIs.</p>
        </div>
        <ExportButton data={filtered} columns={exportColumns} filename="Proforma_Invoices" title="Proforma Invoices Log" />
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by PI number or Party Name..." 
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>PI Date</th>
                <th>PI Number</th>
                <th>Party Name</th>
                <th>Product</th>
                <th>Qty (Kg)</th>
                <th>Subtotal (₹)</th>
                <th>GST (₹)</th>
                <th>Total (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No Proforma Invoices found.</td></tr>
              ) : (
                filtered.map(pi => (
                  <tr key={pi.id}>
                    <td>{pi.date}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{pi.invoiceNo}</td>
                    <td style={{ fontWeight: 600 }}>{pi.partyName}</td>
                    <td>{pi.productName}</td>
                    <td>{pi.qty}</td>
                    <td>{pi.subtotal?.toFixed(2)}</td>
                    <td>{pi.taxAmount?.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>{pi.total?.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => exportToPDF('PI', pi)} style={{ background: 'rgba(59, 130, 246, 0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Download size={14} /> PDF
                        </button>
                        <button onClick={() => deleteDataSoftly('invoices', pi.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPI;
