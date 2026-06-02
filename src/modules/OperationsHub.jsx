import { formatDate } from '../utils/dateUtils';
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Filter, Download, Calendar, User, Package, FileDown } from 'lucide-react';
import { downloadAllDocs } from '../utils/pdfExport';

const OperationsHub = () => {
  const { data } = useAppContext();
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Combine all relevant data for the Processing Sheet
  const masterList = data.materialReceipts.map(mr => {
    const bpr = data.bprs.find(b => b.receiptId === mr.id);
    const pl = bpr ? data.packingLists.find(p => p.bprId === bpr.id) : null;
    const inv = pl ? data.invoices.find(i => i.plId === pl.id) : null;
    
    return {
      id: mr.id,
      receiptNo: mr.receiptNo,
      date: mr.date,
      partyName: mr.partyName,
      productName: mr.productName,
      qty: mr.receivedQty,
      status: inv ? 'Invoiced' : (pl ? 'Packed' : (bpr ? 'In Production' : 'Received')),
      bprNo: bpr?.bprNo || '-',
      plNo: pl?.plNo || '-',
      invNo: inv?.invoiceNo || '-'
    };
  });

  const filteredList = masterList.filter(item => {
    const matchesSearch = item.partyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.receiptNo.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'All') return matchesSearch;
    return matchesSearch && item.status === activeTab;
  });

  const TabButton = ({ name }) => (
    <button 
      onClick={() => setActiveTab(name)}
      style={{
        padding: '0.75rem 1.5rem',
        background: activeTab === name ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        color: activeTab === name ? 'var(--accent-primary)' : 'var(--text-muted)',
        border: 'none',
        borderBottom: activeTab === name ? '2px solid var(--accent-primary)' : '2px solid transparent',
        cursor: 'pointer',
        fontWeight: 600,
        transition: 'all 0.2s'
      }}
    >
      {name}
    </button>
  );

  return (
    <div>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Operations Hub</h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time processing sheet with advanced lifecycle tracking.</p>
      </header>

      <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <TabButton name="All" />
            <TabButton name="Received" />
            <TabButton name="In Production" />
            <TabButton name="Packed" />
            <TabButton name="Invoiced" />
          </div>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Filter by customer, product..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--glass-bg)' }}>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Party</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Product</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Documents (MR / BPR / PL / INV)</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records matching your criteria.</td></tr>
              ) : (
                filteredList.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{formatDate(item.date)}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={14} color="var(--text-muted)" />
                        <span style={{ fontWeight: 600 }}>{item.partyName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={14} color="var(--text-muted)" />
                        <span>{item.productName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--accent-primary)' }}>{item.receiptNo}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: item.bprNo !== '-' ? '#3b82f6' : 'var(--border-color)' }}>{item.bprNo}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: item.plNo !== '-' ? '#8b5cf6' : 'var(--border-color)' }}>{item.plNo}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: item.invNo !== '-' ? '#10b981' : 'var(--border-color)' }}>{item.invNo}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem',
                          background: item.status === 'Invoiced' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                          color: item.status === 'Invoiced' ? '#10b981' : 'var(--text-main)'
                        }}>
                          {item.status}
                        </span>
                        <button 
                          onClick={() => downloadAllDocs(item.id, item)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          title="Download All Documents"
                        >
                          <FileDown size={16} />
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

export default OperationsHub;
