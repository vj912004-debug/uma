import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import ListFilterBar, { uniqueSortedOptions } from '../components/ListFilterBar';
import ExportButton from '../components/ExportButton';
import { formatDate, newestFirst } from '../utils/dateUtils';

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  partyId: '',
  partyName: '',
  productName: '',
  qty: '',
  referenceNo: '',
  remarks: '',
  status: 'Open'
});

const TdModule = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const records = useMemo(
    () => newestFirst((data.tdRecords || []).filter((row) => !row.isDeleted)),
    [data.tdRecords]
  );

  const partyOptions = useMemo(
    () => uniqueSortedOptions(records.map((r) => r.partyName)),
    [records]
  );

  const filtered = records.filter((row) => {
    if (partyFilter && (row.partyName || '') !== partyFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (row.partyName || '').toLowerCase().includes(q)
      || (row.productName || '').toLowerCase().includes(q)
      || (row.referenceNo || '').toLowerCase().includes(q)
      || (row.remarks || '').toLowerCase().includes(q)
      || (row.status || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      date: row.date || emptyForm().date,
      partyId: row.partyId || '',
      partyName: row.partyName || '',
      productName: row.productName || '',
      qty: row.qty ?? '',
      referenceNo: row.referenceNo || '',
      remarks: row.remarks || '',
      status: row.status || 'Open'
    });
    setIsModalOpen(true);
  };

  const handlePartyChange = (e) => {
    const name = e.target.value;
    const party = (data.parties || []).find((p) => p.name === name && !p.isDeleted);
    setForm((prev) => ({
      ...prev,
      partyName: name,
      partyId: party?.id || '',
      productName: prev.productName
    }));
  };

  const partyProducts = useMemo(() => {
    const party = (data.parties || []).find((p) => p.id === form.partyId)
      || (data.parties || []).find((p) => p.name === form.partyName && !p.isDeleted);
    return party?.products || [];
  }, [data.parties, form.partyId, form.partyName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(form.partyName || '').trim()) {
      alert('Select or enter a party name.');
      return;
    }
    const payload = {
      ...form,
      partyName: String(form.partyName || '').trim(),
      productName: String(form.productName || '').trim(),
      qty: form.qty === '' || form.qty == null ? '' : (parseFloat(form.qty) || 0),
      referenceNo: String(form.referenceNo || '').trim(),
      remarks: String(form.remarks || '').trim(),
      status: form.status || 'Open'
    };
    if (editing?.id) {
      updateItem('tdRecords', editing.id, payload);
    } else {
      updateData('tdRecords', { ...payload, id: Date.now().toString() });
    }
    setIsModalOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>TD Module</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>Track and manage TD records.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <ExportButton
            data={filtered.map((r, i) => ({ ...r, srNo: i + 1 }))}
            columns={[
              { label: 'Sr. No', key: 'srNo' },
              { label: 'Date', key: 'date' },
              { label: 'Party', key: 'partyName' },
              { label: 'Product', key: 'productName' },
              { label: 'Qty', key: 'qty', type: 'number' },
              { label: 'Reference No', key: 'referenceNo' },
              { label: 'Status', key: 'status' },
              { label: 'Remarks', key: 'remarks' }
            ]}
            filename="TD_Module"
            title="TD Module"
          />
          <button type="button" className="btn btn-primary" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Add TD Record
          </button>
        </div>
      </header>

      <ListFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search party, product, reference..."
        partyFilter={partyFilter}
        onPartyChange={setPartyFilter}
        partyOptions={partyOptions}
      />

      <div className="premium-card">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sr. No</th>
                <th>Date</th>
                <th>Party Name</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Reference No</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No TD records yet. Click Add TD Record to create one.
                  </td>
                </tr>
              ) : filtered.map((row, idx) => (
                <tr key={row.id}>
                  <td>{idx + 1}</td>
                  <td>{formatDate(row.date)}</td>
                  <td style={{ fontWeight: 600 }}>{row.partyName || '—'}</td>
                  <td>{row.productName || '—'}</td>
                  <td>{row.qty === '' || row.qty == null ? '—' : row.qty}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{row.referenceNo || '—'}</td>
                  <td>{row.status || '—'}</td>
                  <td style={{ maxWidth: 220 }}>{row.remarks || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => openEdit(row)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                        onClick={() => {
                          if (window.confirm('Delete this TD record?')) deleteItemSoftly('tdRecords', row.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="premium-card" style={{ width: '640px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{editing ? 'Edit TD Record' : 'Add TD Record'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Date</label>
                  <DateField className="input-field" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label>Status</label>
                  <SearchableSelect className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Closed">Closed</option>
                  </SearchableSelect>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Party Name *</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    placeholder="Select or type party"
                    value={form.partyName}
                    onChange={handlePartyChange}
                  >
                    <option value="">Select party</option>
                    {(data.parties || []).filter((p) => !p.isDeleted).map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div>
                  <label>Product</label>
                  <SearchableSelect
                    allowCustom
                    className="input-field"
                    placeholder="Select or type product"
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  >
                    <option value="">Select product</option>
                    {partyProducts.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div>
                  <label>Qty</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    value={form.qty}
                    onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Reference No</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.referenceNo}
                    onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                    placeholder="Optional reference"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Remarks</label>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TdModule;
