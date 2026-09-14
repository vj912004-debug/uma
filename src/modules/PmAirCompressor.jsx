import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Wrench,
  Calendar,
  Plus,
  Search,
  RotateCcw,
  Download,
  Printer,
  Edit2,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate, getDefaultFiscalYearRange } from '../utils/dateUtils';

const DEFAULT_RANGE = getDefaultFiscalYearRange();

const PAGE_SIZE = 10;
const MAKES = ['Gardner Denver', 'Atlas Copco', 'Ingersoll Rand', 'Kaeser', 'Other'];
const STATUSES = ['Completed', 'Pending', 'Overdue', 'Scheduled'];

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  compMake: 'Gardner Denver',
  serialNo: '',
  totalHoursRun: '',
  totalHoursOnLoad: '',
  maintenanceDetails: '',
  remarks: '',
  nextDueDate: '',
  doneBy: '',
  checkedBy: '',
  status: 'Completed'
});

const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const PmAirCompressor = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    compMake: '',
    nextDueDate: '',
    serialNo: '',
    status: ''
  });
  const [applied, setApplied] = useState(filters);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showCalendar, setShowCalendar] = useState(false);

  const staffNames = useMemo(() => {
    const fromUsers = (data.users || []).filter((u) => u.active !== false).map((u) => u.name || u.username).filter(Boolean);
    return [...new Set(fromUsers.length ? fromUsers : ['Amit', 'Ramesh', 'Sanjay', 'Suresh'])];
  }, [data.users]);

  const rows = useMemo(
    () => (data.pmAirCompressorRecords || []).filter((r) => !r.isDeleted)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [data.pmAirCompressorRecords]
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (!inRange(r.date, rangeFrom, rangeTo)) return false;
    if (applied.dateFrom && r.date < applied.dateFrom) return false;
    if (applied.dateTo && r.date > applied.dateTo) return false;
    if (applied.compMake && r.compMake !== applied.compMake) return false;
    if (applied.nextDueDate && r.nextDueDate !== applied.nextDueDate) return false;
    if (applied.serialNo && !String(r.serialNo || '').toLowerCase().includes(applied.serialNo.trim().toLowerCase())) return false;
    if (applied.status && r.status !== applied.status) return false;
    return true;
  }), [rows, applied, rangeFrom, rangeTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows
      .filter((r) => r.nextDueDate && r.nextDueDate >= today)
      .sort((a, b) => String(a.nextDueDate).localeCompare(String(b.nextDueDate)))
      .slice(0, 8);
  }, [rows]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({ ...emptyForm(), ...row });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingId) {
      const existing = rows.find((r) => r.id === editingId);
      updateItem('pmAirCompressorRecords', editingId, { ...existing, ...form });
    } else {
      updateData('pmAirCompressorRecords', {
        ...form,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
    }
    closeForm();
    setPage(1);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this maintenance record?')) deleteItemSoftly('pmAirCompressorRecords', id);
  };

  const applySearch = () => {
    setApplied({ ...filters });
    setPage(1);
  };

  const resetFilters = () => {
    const blank = { dateFrom: '', dateTo: '', compMake: '', nextDueDate: '', serialNo: '', status: '' };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  const exportExcel = () => {
    const sheet = filtered.map((r, i) => ({
      'Sr. No': i + 1,
      Date: formatDate(r.date),
      'Comp. Make': r.compMake,
      'Comp. Serial No.': r.serialNo,
      'Total Hours Run': r.totalHoursRun,
      'Total Hours On Load': r.totalHoursOnLoad,
      'Preventive Maintenance Details': r.maintenanceDetails,
      Remarks: r.remarks,
      'Next Due Date': formatDate(r.nextDueDate),
      'Done By': r.doneBy,
      'Checked By': r.checkedBy,
      Status: r.status
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'PM Air Compressor');
    XLSX.writeFile(wb, 'PM_Air_Compressor.xlsx');
  };

  const printList = () => window.print();

  return (
    <div className="pm-page">
      <header className="page-header pm-header no-print">
        <div className="pm-title-wrap">
          <Wrench size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Preventive Maintenance Record of Compa Air Compressor</h1>
            <p className="page-subtitle">Track and maintain preventive maintenance details for air compressors.</p>
          </div>
        </div>
        <div className="pm-range">
          <Calendar size={15} />
          <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
          <span>–</span>
          <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
        </div>
      </header>

      <div className="pm-top-grid no-print">
        <section className="premium-card pm-card">
          <h2 className="pm-card-title"><Search size={16} /> Search &amp; Filter</h2>
          <div className="pm-form-grid pm-form-grid-3">
            <Field label="Date From">
              <DateField className="input-field" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
            </Field>
            <Field label="Date To">
              <DateField className="input-field" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
            </Field>
            <Field label="Compressor Make">
              <SearchableSelect className="input-field" value={filters.compMake} onChange={(e) => setFilter('compMake', e.target.value)}>
                <option value="">All</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Next Due Date">
              <DateField className="input-field" value={filters.nextDueDate} onChange={(e) => setFilter('nextDueDate', e.target.value)} />
            </Field>
            <Field label="Comp. Serial No.">
              <input type="text" className="input-field" placeholder="Enter Serial No." value={filters.serialNo} onChange={(e) => setFilter('serialNo', e.target.value)} />
            </Field>
            <Field label="Status">
              <SearchableSelect className="input-field" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">All</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SearchableSelect>
            </Field>
          </div>
          <div className="pm-form-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-primary" onClick={applySearch}><Search size={15} /> Search</button>
            <button type="button" className="btn pm-btn-outline" onClick={resetFilters}><RotateCcw size={15} /> Reset</button>
          </div>
        </section>

        <aside className="premium-card pm-card pm-quick">
          <h2 className="pm-card-title">Quick Actions</h2>
          <button type="button" className="btn btn-primary pm-quick-primary" onClick={openCreate}>
            <Plus size={16} /> Add New Record
          </button>
          <button type="button" className="btn pm-btn-outline" onClick={() => setShowCalendar((v) => !v)}>
            <Calendar size={15} /> View Calendar
          </button>
          <button type="button" className="btn pm-btn-outline" onClick={exportExcel}>
            <Download size={15} /> Export Excel
          </button>
          <button type="button" className="btn pm-btn-outline" onClick={printList}>
            <Printer size={15} /> Print
          </button>
        </aside>
      </div>

      {showCalendar && (
        <section className="premium-card pm-card no-print">
          <h2 className="pm-card-title"><Calendar size={16} /> Upcoming Due Dates</h2>
          {upcoming.length === 0 ? (
            <p className="pm-empty" style={{ padding: '0.75rem 0' }}>No upcoming due dates.</p>
          ) : (
            <ul className="pm-due-list">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <strong>{formatDate(r.nextDueDate)}</strong>
                  <span>{r.compMake} {r.serialNo ? `(${r.serialNo})` : ''}</span>
                  <span className="pm-muted">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="premium-card pm-card pm-print-root">
        <h2 className="pm-card-title">Preventive Maintenance Records</h2>
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Sr. No</th>
                <th>Date</th>
                <th>Comp. Make</th>
                <th>Total Hours Run</th>
                <th>Total Hours On Load</th>
                <th>Preventive Maintenance Details</th>
                <th>Remarks</th>
                <th>Next Due Date</th>
                <th>Done By</th>
                <th>Checked By</th>
                <th className="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={11} className="pm-empty">No maintenance records found.</td></tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.compMake}</td>
                  <td>{Number(r.totalHoursRun || 0).toLocaleString('en-IN')}</td>
                  <td>{Number(r.totalHoursOnLoad || 0).toLocaleString('en-IN')}</td>
                  <td className="pm-details">{r.maintenanceDetails}</td>
                  <td>{r.remarks || '—'}</td>
                  <td>{formatDate(r.nextDueDate) || '—'}</td>
                  <td>{r.doneBy}</td>
                  <td>{r.checkedBy}</td>
                  <td className="pm-actions no-print">
                    <button type="button" title="Edit" onClick={() => openEdit(r)}><Edit2 size={14} /></button>
                    <button type="button" title="Delete" className="danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pm-pager no-print">
          <span>
            Showing {filtered.length ? (pageSafe - 1) * PAGE_SIZE + 1 : 0} to {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} records
          </span>
          <div className="pm-pager-btns">
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 6).map((n) => (
              <button type="button" key={n} className={n === pageSafe ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </section>

      {showForm && (
        <div className="page-form-overlay no-print">
          <div className="premium-card pm-card" style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="pm-list-head">
              <h2 className="pm-card-title" style={{ margin: 0 }}>
                {editingId ? 'Edit Maintenance Record' : 'Add New Record'}
              </h2>
              <button type="button" className="btn" onClick={closeForm}><X size={15} /> Close</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="pm-form-grid pm-form-grid-2">
                <Field label="Date" required>
                  <DateField className="input-field" required value={form.date} onChange={(e) => setField('date', e.target.value)} />
                </Field>
                <Field label="Comp. Make" required>
                  <SearchableSelect className="input-field" required value={form.compMake} onChange={(e) => setField('compMake', e.target.value)} allowCustom>
                    {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Comp. Serial No.">
                  <input type="text" className="input-field" value={form.serialNo} onChange={(e) => setField('serialNo', e.target.value)} />
                </Field>
                <Field label="Status" required>
                  <SearchableSelect className="input-field" required value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Total Hours Run" required>
                  <input type="number" step="any" className="input-field" required value={form.totalHoursRun} onChange={(e) => setField('totalHoursRun', e.target.value)} />
                </Field>
                <Field label="Total Hours On Load" required>
                  <input type="number" step="any" className="input-field" required value={form.totalHoursOnLoad} onChange={(e) => setField('totalHoursOnLoad', e.target.value)} />
                </Field>
                <Field label="Next Due Date">
                  <DateField className="input-field" value={form.nextDueDate} onChange={(e) => setField('nextDueDate', e.target.value)} />
                </Field>
                <Field label="Done By" required>
                  <SearchableSelect className="input-field" required value={form.doneBy} onChange={(e) => setField('doneBy', e.target.value)} allowCustom placeholder="Select">
                    <option value="">Select</option>
                    {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Checked By" required>
                  <SearchableSelect className="input-field" required value={form.checkedBy} onChange={(e) => setField('checkedBy', e.target.value)} allowCustom placeholder="Select">
                    <option value="">Select</option>
                    {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </SearchableSelect>
                </Field>
                <Field label="Remarks">
                  <input type="text" className="input-field" value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} placeholder="Good / OK / No issue" />
                </Field>
              </div>
              <Field label="Preventive Maintenance Details" required>
                <textarea
                  className="input-field"
                  rows={3}
                  required
                  placeholder="Oil Change, Air Filter Clean, Separator Check, Belt Check..."
                  value={form.maintenanceDetails}
                  onChange={(e) => setField('maintenanceDetails', e.target.value)}
                />
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
                <button type="button" className="btn pm-btn-outline" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PmAirCompressor;
