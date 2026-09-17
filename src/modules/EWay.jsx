import { formatDate } from '../utils/dateUtils';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Edit2 } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import DateField from '../components/DateField';
import StatusTabBar from '../components/StatusTabBar';
import { getEwayTypeAccess } from '../utils/moduleAccess';

const EWay = () => {
  const { data, updateItem } = useAppContext();
  const { currentUser } = useAuth();
  const ewayAccess = getEwayTypeAccess(currentUser);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [typeTab, setTypeTab] = useState(() => {
    if (ewayAccess.dc && !ewayAccess.ti) return 'dc';
    if (ewayAccess.ti && !ewayAccess.dc) return 'ti';
    return 'all';
  });
  const [statusTab, setStatusTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    ewayBillNo: '',
    ewayBillDate: new Date().toISOString().split('T')[0],
    ewayBillPurpose: 'Others - Job Work'
  });

  useEffect(() => {
    if (typeTab === 'dc' && !ewayAccess.dc) setTypeTab(ewayAccess.ti ? 'ti' : 'all');
    if (typeTab === 'ti' && !ewayAccess.ti) setTypeTab(ewayAccess.dc ? 'dc' : 'all');
    if (typeTab === 'all' && ewayAccess.dc && !ewayAccess.ti) setTypeTab('dc');
    if (typeTab === 'all' && ewayAccess.ti && !ewayAccess.dc) setTypeTab('ti');
  }, [ewayAccess.dc, ewayAccess.ti, typeTab]);

  const rows = useMemo(() => {
    const dcRows = ewayAccess.dc
      ? (data.deliveryChallans || [])
          .filter((dc) => !dc.isDeleted)
          .map((dc) => ({
            id: `dc-${dc.id}`,
            sourceId: dc.id,
            type: 'DC',
            collection: 'deliveryChallans',
            docNo: dc.dcNo || '—',
            partyName: dc.partyName || '',
            detail: dc.vehicleNo || '—',
            detailLabel: 'Vehicle',
            ewayBillNo: dc.ewayBillNo || '',
            ewayBillDate: dc.ewayBillDate || '',
            ewayBillPurpose: dc.ewayBillPurpose || 'Others - Job Work',
            raw: dc
          }))
      : [];

    const tiRows = ewayAccess.ti
      ? (data.invoices || [])
          .filter((inv) => !inv.isDeleted && inv.invoiceNo?.includes('/IN/'))
          .map((inv) => ({
            id: `ti-${inv.id}`,
            sourceId: inv.id,
            type: 'TI',
            collection: 'invoices',
            docNo: inv.invoiceNo || '—',
            partyName: inv.partyName || '',
            detail: inv.qty != null && inv.qty !== '' ? `${inv.qty} Kg` : '—',
            detailLabel: 'Qty',
            ewayBillNo: inv.ewayBillNo || '',
            ewayBillDate: inv.ewayBillDate || '',
            ewayBillPurpose: '',
            raw: inv
          }))
      : [];

    return [...dcRows, ...tiRows];
  }, [data.deliveryChallans, data.invoices, ewayAccess.dc, ewayAccess.ti]);

  const partyOptions = useMemo(
    () => uniqueSortedOptions(rows.map((r) => r.partyName)),
    [rows]
  );

  const typedRows = useMemo(() => {
    if (typeTab === 'dc') return rows.filter((r) => r.type === 'DC');
    if (typeTab === 'ti') return rows.filter((r) => r.type === 'TI');
    return rows;
  }, [rows, typeTab]);

  const pendingCount = typedRows.filter((r) => !r.ewayBillNo).length;
  const completedCount = typedRows.filter((r) => !!r.ewayBillNo).length;

  const filteredRows = typedRows.filter((row) => {
    const isDone = !!row.ewayBillNo;
    if (statusTab === 'pending' && isDone) return false;
    if (statusTab === 'completed' && !isDone) return false;
    if (partyFilter && (row.partyName || '') !== partyFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (row.docNo || '').toLowerCase().includes(q) ||
      (row.partyName || '').toLowerCase().includes(q) ||
      (row.ewayBillNo || '').toLowerCase().includes(q) ||
      (row.type || '').toLowerCase().includes(q) ||
      (row.detail || '').toLowerCase().includes(q)
    );
  });

  const handleEdit = (row) => {
    setSelected(row);
    setForm({
      ewayBillNo: row.ewayBillNo || '',
      ewayBillDate: row.ewayBillDate || new Date().toISOString().split('T')[0],
      ewayBillPurpose: row.ewayBillPurpose || 'Others - Job Work'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    const patch = {
      ...selected.raw,
      ewayBillNo: form.ewayBillNo,
      ewayBillDate: form.ewayBillDate
    };
    if (selected.type === 'DC') {
      patch.ewayBillPurpose = form.ewayBillPurpose;
    }
    updateItem(selected.collection, selected.sourceId, patch);
    setIsModalOpen(false);
    setSelected(null);
  };

  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>E-Way Bills</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Log government E-Way Bill numbers for Delivery Challans and Tax Invoices in one place.
        </p>
      </header>

      <div className="tab-bar">
        {[
          ewayAccess.dc && ewayAccess.ti ? { id: 'all', label: `All (${rows.length})` } : null,
          ewayAccess.dc ? { id: 'dc', label: `DC (${rows.filter((r) => r.type === 'DC').length})` } : null,
          ewayAccess.ti ? { id: 'ti', label: `TI (${rows.filter((r) => r.type === 'TI').length})` } : null
        ].filter(Boolean).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn${typeTab === tab.id ? ' active' : ''}`}
            onClick={() => setTypeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <StatusTabBar
        value={statusTab}
        onChange={setStatusTab}
        allCount={typedRows.length}
        pendingCount={pendingCount}
        completedCount={completedCount}
      />

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search by doc no, customer or E-Way No..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
        showProduct={false}
      />

      <div className="premium-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Type</th>
                <th style={{ padding: '1rem' }}>Doc No</th>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Vehicle / Qty</th>
                <th style={{ padding: '1rem' }}>E-Way Status</th>
                <th style={{ padding: '1rem' }}>E-Way Details</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No E-Way records match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: row.type === 'DC' ? 'rgba(91, 28, 133, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                          color: row.type === 'DC' ? '#5b1c85' : '#2563eb'
                        }}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{row.docNo}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.partyName}</td>
                    <td style={{ padding: '1rem' }}>{row.detail}</td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: row.ewayBillNo ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: row.ewayBillNo ? '#10b981' : '#f59e0b',
                          fontWeight: 600
                        }}
                      >
                        {row.ewayBillNo ? 'Logged' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {row.ewayBillNo ? (
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>No: {row.ewayBillNo}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Date: {formatDate(row.ewayBillDate)}
                            {row.type === 'DC' && row.ewayBillPurpose ? ` (${row.ewayBillPurpose})` : ''}
                          </p>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not yet linked</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => handleEdit(row)}
                      >
                        <Edit2 size={12} /> {row.ewayBillNo ? 'Edit' : 'Link E-Way'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selected && (
        <div className="page-form-overlay">
          <div className="premium-card" style={{ width: '550px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>
              Link E-Way Bill to {selected.type === 'DC' ? 'Delivery Challan' : 'Tax Invoice'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>{selected.type === 'DC' ? 'Delivery Challan' : 'Tax Invoice'}</label>
                  <input type="text" className="input-field" readOnly value={selected.docNo} style={{ fontWeight: 600 }} />
                </div>
                {selected.type === 'DC' && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>E-Way Bill Purpose *</label>
                    <SearchableSelect
                      className="input-field"
                      value={form.ewayBillPurpose}
                      onChange={(e) => setForm({ ...form, ewayBillPurpose: e.target.value })}
                    >
                      <option value="Others - Job Work">Others - Job Work</option>
                      <option value="Supply">Supply</option>
                      <option value="Export">Export</option>
                    </SearchableSelect>
                  </div>
                )}
                <div>
                  <label>E-Way Bill Number *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="12 digit number"
                    value={form.ewayBillNo}
                    onChange={(e) => setForm({ ...form, ewayBillNo: e.target.value })}
                  />
                </div>
                <div>
                  <label>E-Way Bill Date *</label>
                  <DateField
                    className="input-field"
                    required
                    value={form.ewayBillDate}
                    onChange={(e) => setForm({ ...form, ewayBillDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Link E-Way Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EWay;
