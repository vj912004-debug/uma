import React, { useMemo, useState } from 'react';
import {
  Wrench,
  Plus,
  Save,
  RotateCcw,
  Calendar,
  Search,
  Edit2,
  Trash2,
  FileText,
  List,
  X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import StatusTabBar from '../components/StatusTabBar';
import { formatDate, getDefaultFiscalYearRange, newestFirst } from '../utils/dateUtils';

const YES_NO = ['Yes', 'No'];
const MAKE_OPTIONS = ['Gardner Denver', 'Atlas Copco', 'Ingersoll Rand', 'Kaeser', 'Other'];
const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  make: '',
  voltage1: '',
  voltage3: '',
  ampere1: '',
  ampere2: '',
  ampere3: '',
  dryerStart: 'Yes',
  moistureSeparator: 'Yes',
  tankPressure: '',
  loadingUnloadingTime: '',
  tempCompressor: '',
  doneBy: '',
  remarks: ''
});

const inRange = (date, from, to) => {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const isCurrentMonth = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isUtilityPending = (r) => {
  if (String(r.status || '').toLowerCase() === 'pending') return true;
  const incomplete = !String(r.doneBy || '').trim() || !String(r.time || '').trim();
  return isCurrentMonth(r.date) && incomplete;
};

const EXPORT_COLUMNS = [
  { label: 'Sr. No', key: 'srNo' },
  { label: 'Date', key: 'date' },
  { label: 'Time', key: 'time' },
  { label: 'Make', key: 'make' },
  { label: 'Voltage - 1 (V)', key: 'voltage1' },
  { label: 'Voltage - 3 (V)', key: 'voltage3' },
  { label: 'Ampere - 1 (A)', key: 'ampere1' },
  { label: 'Ampere - 2 (A)', key: 'ampere2' },
  { label: 'Ampere - 3 (A)', key: 'ampere3' },
  { label: 'Dryer Start', key: 'dryerStart' },
  { label: 'Moisture Separator Working', key: 'moistureSeparator' },
  { label: 'Tank Pressure (Kg)', key: 'tankPressure' },
  { label: 'Loading/Unloading Time', key: 'loadingTime' },
  { label: 'Temp. of Compressor (°C)', key: 'tempCompressor' },
  { label: 'Done By', key: 'doneBy' },
  { label: 'Remarks', key: 'remarks' }
];

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const UtilityRecord = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showList, setShowList] = useState(false);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);

  const staffNames = useMemo(() => {
    const fromUsers = (data.users || []).filter((u) => u.active !== false).map((u) => u.name || u.username).filter(Boolean);
    return [...new Set(fromUsers.length ? fromUsers : ['Amit', 'Ramesh', 'Sanjay', 'Suresh'])];
  }, [data.users]);

  const rows = useMemo(
    () => newestFirst((data.utilityRecords || []).filter((r) => !r.isDeleted)),
    [data.utilityRecords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusTab === 'pending' && !isUtilityPending(r)) return false;
      if (statusTab === 'completed' && isUtilityPending(r)) return false;
      if (!inRange(r.date, rangeFrom, rangeTo)) return false;
      if (!q) return true;
      return [r.date, r.time, r.remarks, r.doneBy, r.loadingUnloadingTime, r.make]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, rangeFrom, rangeTo, statusTab]);

  const pendingCount = rows.filter(isUtilityPending).length;
  const completedCount = rows.length - pendingCount;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const exportRows = filtered.map((r, i) => ({
    srNo: i + 1,
    date: formatDate(r.date),
    time: r.time || '',
    make: r.make || '',
    voltage1: r.voltage1,
    voltage3: r.voltage3,
    ampere1: r.ampere1,
    ampere2: r.ampere2,
    ampere3: r.ampere3,
    dryerStart: r.dryerStart || r.oldDryerStart || '',
    moistureSeparator: r.moistureSeparator || r.oldMoistureSeparator || '',
    tankPressure: r.tankPressure || r.smallTank1Pressure || '',
    loadingTime: r.loadingUnloadingTime || '',
    tempCompressor: r.tempCompressor || r.tempCompressorOld || '',
    doneBy: r.doneBy,
    remarks: r.remarks
  }));

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openEdit = (row) => {
    setForm({
      ...emptyForm(),
      ...row,
      dryerStart: row.dryerStart || row.oldDryerStart || 'Yes',
      moistureSeparator: row.moistureSeparator || row.oldMoistureSeparator || 'Yes',
      tankPressure: row.tankPressure || row.smallTank1Pressure || '',
      tempCompressor: row.tempCompressor || row.tempCompressorOld || ''
    });
    setEditingId(row.id);
    setShowList(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingId) {
      const existing = rows.find((r) => r.id === editingId);
      updateItem('utilityRecords', editingId, { ...existing, ...form });
    } else {
      updateData('utilityRecords', { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
    clearForm();
    setPage(1);
    setShowList(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this utility record?')) deleteItemSoftly('utilityRecords', id);
  };

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Wrench size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Utility Record</h1>
            <p className="page-subtitle">Add, view and manage daily utility consumption records.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <ExportButton data={exportRows} columns={EXPORT_COLUMNS} filename="Utility_Records" title="Utility Records" />
          <button type="button" className="btn btn-primary" onClick={() => setShowList(true)}>
            <List size={15} /> Utility Record List ({rows.length})
          </button>
        </div>
      </header>

      <section className="premium-card pm-card">
        <h2 className="pm-card-title">
          <Plus size={16} /> {editingId ? 'Edit Utility Record' : 'Add New Utility Record'}
        </h2>
        <form onSubmit={handleSave}>
          <div className="pm-form-grid pm-form-grid-5">
            <Field label="Date" required>
              <DateField className="input-field" required value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </Field>
            <Field label="Time" required>
              <TimeField className="input-field" required value={form.time} onChange={(e) => setField('time', e.target.value)} />
            </Field>
            <Field label="Make" required>
              <SearchableSelect
                className="input-field"
                required
                allowCustom
                value={form.make}
                onChange={(e) => setField('make', e.target.value)}
                placeholder="Select or type make"
              >
                <option value="">Select or type make</option>
                {MAKE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </SearchableSelect>
            </Field>
            <Field label="Voltage - 1 (V)" required>
              <input type="number" step="any" className="input-field" required value={form.voltage1} onChange={(e) => setField('voltage1', e.target.value)} />
            </Field>
            <Field label="Voltage - 3 (V)" required>
              <input type="number" step="any" className="input-field" required value={form.voltage3} onChange={(e) => setField('voltage3', e.target.value)} />
            </Field>

            <Field label="Ampere - 1 (A)" required>
              <input type="number" step="any" className="input-field" required value={form.ampere1} onChange={(e) => setField('ampere1', e.target.value)} />
            </Field>
            <Field label="Ampere - 2 (A)" required>
              <input type="number" step="any" className="input-field" required value={form.ampere2} onChange={(e) => setField('ampere2', e.target.value)} />
            </Field>
            <Field label="Ampere - 3 (A)" required>
              <input type="number" step="any" className="input-field" required value={form.ampere3} onChange={(e) => setField('ampere3', e.target.value)} />
            </Field>
            <Field label="Dryer Start" required>
              <SearchableSelect className="input-field" required value={form.dryerStart} onChange={(e) => setField('dryerStart', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Moisture Separator Working" required>
              <SearchableSelect className="input-field" required value={form.moistureSeparator} onChange={(e) => setField('moistureSeparator', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>

            <Field label="Tank Pressure (Kg)" required>
              <input type="number" step="any" className="input-field" required value={form.tankPressure} onChange={(e) => setField('tankPressure', e.target.value)} />
            </Field>
            <Field label="Loading/Unloading Time" required>
              <input type="text" className="input-field" required placeholder="48/62" value={form.loadingUnloadingTime} onChange={(e) => setField('loadingUnloadingTime', e.target.value)} />
            </Field>
            <Field label="Temp. of Compressor (°C)" required>
              <input type="number" step="any" className="input-field" required value={form.tempCompressor} onChange={(e) => setField('tempCompressor', e.target.value)} />
            </Field>
            <Field label="Done By" required>
              <SearchableSelect className="input-field" required value={form.doneBy} onChange={(e) => setField('doneBy', e.target.value)} placeholder="Select" allowCustom>
                <option value="">Select</option>
                {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Remarks">
              <input type="text" className="input-field" value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} placeholder="Ok" />
            </Field>
          </div>

          <div className="pm-form-actions">
            <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
            <button type="button" className="btn pm-btn-outline" onClick={() => setForm(editingId ? { ...emptyForm(), ...rows.find((r) => r.id === editingId) } : emptyForm())}>
              <RotateCcw size={15} /> Clear
            </button>
            {editingId ? <button type="button" className="btn pm-btn-outline" onClick={clearForm}>Cancel Edit</button> : null}
          </div>
        </form>
      </section>

      {showList && (
        <div className="page-form-overlay">
        <section className="premium-card pm-card">
          <div className="pm-modal-head">
            <h2 className="pm-card-title">
              <FileText size={16} /> Utility Record List
            </h2>
            <button type="button" className="btn" onClick={() => setShowList(false)}><X size={14} /> Close</button>
          </div>
          <div className="pm-list-head">
            <StatusTabBar
              value={statusTab}
              onChange={(v) => { setStatusTab(v); setPage(1); }}
              allCount={rows.length}
              pendingCount={pendingCount}
              completedCount={completedCount}
            />
            <div className="pm-list-tools">
              <div className="pm-range">
                <Calendar size={15} />
                <DateField className="input-field" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setPage(1); }} />
                <span>–</span>
                <DateField className="input-field" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setPage(1); }} />
              </div>
              <div className="pm-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search by date, time, or remarks..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Make</th>
                  <th>Voltage - 1 (V)</th>
                  <th>Voltage - 3 (V)</th>
                  <th>Ampere - 1 (A)</th>
                  <th>Ampere - 2 (A)</th>
                  <th>Ampere - 3 (A)</th>
                  <th>Dryer Start</th>
                  <th>Moisture Separator Working</th>
                  <th>Tank Pressure (Kg)</th>
                  <th>Loading/Unloading Time</th>
                  <th>Temp. of Compressor (°C)</th>
                  <th>Done By</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="pm-empty">
                      {rows.length && !filtered.length
                        ? 'No records in the selected date range. Widen the date filter above to see saved entries.'
                        : 'No utility records yet. Add one using the form.'}
                    </td>
                  </tr>
                ) : pageRows.map((r, idx) => (
                  <tr key={r.id} className="pm-click-row" title="Click to open record" onClick={() => openEdit(r)}>
                    <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.time || '—'}</td>
                    <td>{r.make || '—'}</td>
                    <td>{r.voltage1}</td>
                    <td>{r.voltage3}</td>
                    <td>{r.ampere1}</td>
                    <td>{r.ampere2}</td>
                    <td>{r.ampere3}</td>
                    <td>{r.dryerStart || r.oldDryerStart}</td>
                    <td>{r.moistureSeparator || r.oldMoistureSeparator}</td>
                    <td>{r.tankPressure || r.smallTank1Pressure}</td>
                    <td>{r.loadingUnloadingTime}</td>
                    <td>{r.tempCompressor || r.tempCompressorOld}</td>
                    <td>{r.doneBy}</td>
                    <td>{r.remarks || '—'}</td>
                    <td className="pm-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="Edit" onClick={() => openEdit(r)}><Edit2 size={14} /></button>
                      <button type="button" title="Delete" className="danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pm-pager">
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
        </div>
      )}
    </div>
  );
};

export default UtilityRecord;
