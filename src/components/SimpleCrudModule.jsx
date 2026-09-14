import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from './DateField';
import SearchableSelect from './SearchableSelect';
import { formatDate } from '../utils/dateUtils';

/**
 * Config-driven list + full-page form CRUD for operational record modules.
 * fields: { key, label, type: text|number|date|select|textarea, options?, required?, placeholder?, span? }
 * columns: { key, label, format?: 'date'|'money' }
 */
const SimpleCrudModule = ({
  title,
  subtitle,
  collectionKey,
  fields,
  columns,
  emptyForm,
  searchKeys = [],
  docNoKey
}) => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(() => emptyForm());

  const rows = useMemo(
    () => (data[collectionKey] || []).filter((r) => !r.isDeleted),
    [data, collectionKey]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      searchKeys.some((k) => String(r[k] || '').toLowerCase().includes(q))
    );
  }, [rows, search, searchKeys]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...emptyForm(), ...row });
    setIsOpen(true);
  };

  const closeForm = () => {
    setIsOpen(false);
    setEditing(null);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (editing) {
      updateItem(collectionKey, editing.id, { ...editing, ...payload });
    } else {
      updateData(collectionKey, {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
    }
    closeForm();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this record?')) {
      deleteItemSoftly(collectionKey, id);
    }
  };

  const cellValue = (row, col) => {
    const v = row[col.key];
    if (col.format === 'date') return formatDate(v) || '—';
    if (col.format === 'money') {
      const n = parseFloat(v);
      return Number.isFinite(n)
        ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        : '—';
    }
    return v === '' || v == null ? '—' : String(v);
  };

  if (isOpen) {
    return (
      <div className="page-form-overlay">
        <div className="premium-card" style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 750, color: 'var(--brand-purple, #5b1c85)' }}>
                {editing ? `Edit ${title}` : `Add ${title}`}
              </h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {subtitle}
              </p>
            </div>
            <button type="button" className="btn" onClick={closeForm}>Cancel</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.9rem 1rem'
              }}
            >
              {fields.map((f) => (
                <div
                  key={f.key}
                  className="form-group"
                  style={{ margin: 0, gridColumn: f.span === 2 ? '1 / -1' : undefined }}
                >
                  <label>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="input-field"
                      rows={f.rows || 3}
                      required={f.required}
                      placeholder={f.placeholder || ''}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : f.type === 'select' ? (
                    <SearchableSelect
                      className="input-field"
                      required={f.required}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder || `Select ${f.label}`}
                    >
                      <option value="">{f.placeholder || `Select ${f.label}`}</option>
                      {(f.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </SearchableSelect>
                  ) : f.type === 'date' ? (
                    <DateField
                      className="input-field"
                      required={f.required}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      className="input-field"
                      required={f.required}
                      step={f.type === 'number' ? 'any' : undefined}
                      min={f.type === 'number' ? '0' : undefined}
                      placeholder={f.placeholder || ''}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.35rem' }}>
              <button type="button" className="btn" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editing ? 'Update Record' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="page-toolbar">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Record
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.85rem',
          maxWidth: 360,
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '0.45rem 0.75rem',
          background: '#fff'
        }}
      >
        <Search size={15} style={{ color: 'var(--text-muted)', flex: '0 0 auto' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records…"
          style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent', fontSize: '0.88rem' }}
        />
      </div>

      <div className="premium-card">
        <div className="data-table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '1.75rem', color: 'var(--text-muted)' }}>
                    No records yet. Click Add Record to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={c.key} style={c.key === docNoKey ? { fontWeight: 650, color: 'var(--accent-primary)' } : undefined}>
                        {cellValue(row, c)}
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(row)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginRight: 6 }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDelete(row.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
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

export default SimpleCrudModule;
