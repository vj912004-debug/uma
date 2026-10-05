import React, { useMemo, useState } from 'react';
import {
  Thermometer,
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

const OIL_LEVELS = ['Low', 'Medium', 'High', 'OK'];
const MAKE_OPTIONS = ['Gardner Denver', 'Atlas Copco', 'Ingersoll Rand', 'Kaeser', 'Other'];
const PAGE_SIZE = 10;
const DEFAULT_RANGE = getDefaultFiscalYearRange();
const PHASE_KEYS = ['mainSwitch175A', 'panelMainSwitch', 'capacitorSwitch', 'changeOverSwitch', 'compressorMainInputs'];

const emptyPhase = () => ({ r: '', y: '', b: '' });

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  oilLevelAtRest: 'Low',
  fillTimeMin: '',
  make: '',
  mainSwitch175A: emptyPhase(),
  panelMainSwitch: emptyPhase(),
  capacitorSwitch: emptyPhase(),
  changeOverSwitch: emptyPhase(),
  compressorMainInputs: emptyPhase(),
  newCompMotor: '',
  oilSeparator: '',
  airEnd: '',
  airCooler: '',
  tank: '',
  dischargePipe: '',
  remarks: 'OK'
});

const formFromRow = (row) => {
  const base = { ...emptyForm(), ...row };
  PHASE_KEYS.forEach((k) => { base[k] = { ...emptyPhase(), ...(row?.[k] || {}) }; });
  return base;
};

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

const isTempPending = (r) => {
  if (String(r.status || '').toLowerCase() === 'pending') return true;
  const incomplete = !String(r.make || '').trim() || !String(r.time || '').trim() || r.oilLevelAtRest == null || r.oilLevelAtRest === '';
  return isCurrentMonth(r.date) && incomplete;
};

const phaseCells = (p) => `${p?.r || '—'} / ${p?.y || '—'} / ${p?.b || '—'}`;

const EXPORT_COLUMNS = [
  { label: 'Sr. No', key: 'srNo' },
  { label: 'Date', key: 'date' },
  { label: 'Time', key: 'time' },
  { label: 'Make', key: 'make' },
  { label: 'Oil Level At Rest', key: 'oilLevel' },
  { label: 'Total Time To Fill 12.5kg (Min)', key: 'fillTime' },
  { label: 'Main Switch R', key: 'mainR' },
  { label: 'Main Switch Y', key: 'mainY' },
  { label: 'Main Switch B', key: 'mainB' },
  { label: 'Panel Main Switch R', key: 'panelR' },
  { label: 'Panel Main Switch Y', key: 'panelY' },
  { label: 'Panel Main Switch B', key: 'panelB' },
  { label: 'Capacitor Switch R', key: 'capR' },
  { label: 'Capacitor Switch Y', key: 'capY' },
  { label: 'Capacitor Switch B', key: 'capB' },
  { label: 'Change Over Switch R', key: 'coR' },
  { label: 'Change Over Switch Y', key: 'coY' },
  { label: 'Change Over Switch B', key: 'coB' },
  { label: 'Compressor Main Inputs R', key: 'inR' },
  { label: 'Compressor Main Inputs Y', key: 'inY' },
  { label: 'Compressor Main Inputs B', key: 'inB' },
  { label: 'Comp Motor', key: 'motor' },
  { label: 'Oil Separator', key: 'oilSep' },
  { label: 'Air End', key: 'airEnd' },
  { label: 'Air Cooler', key: 'airCooler' },
  { label: 'Tank', key: 'tank' },
  { label: 'Comp Air Discharge Pipe Ss', key: 'pipe' },
  { label: 'Remarks', key: 'remarks' }
];

const Field = ({ label, required, children, className = '' }) => (
  <div className={`form-group pm-field ${className}`}>
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const PhaseInputs = ({ label, value, onChange, required }) => (
  <div className="form-group pm-field pm-phase">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    <div className="pm-phase-row">
      {['r', 'y', 'b'].map((k) => (
        <div key={k} className="pm-phase-cell">
          <span>{k.toUpperCase()}</span>
          <input
            type="number"
            step="any"
            className="input-field"
            required={required}
            value={value?.[k] ?? ''}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })}
          />
        </div>
      ))}
    </div>
  </div>
);

const UtilityTempRecord = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showList, setShowList] = useState(false);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE.rangeFrom);
  const [rangeTo, setRangeTo] = useState(DEFAULT_RANGE.rangeTo);

  const rows = useMemo(
    () => newestFirst((data.utilityTempRecords || []).filter((r) => !r.isDeleted)),
    [data.utilityTempRecords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusTab === 'pending' && !isTempPending(r)) return false;
      if (statusTab === 'completed' && isTempPending(r)) return false;
      if (!inRange(r.date, rangeFrom, rangeTo)) return false;
      if (!q) return true;
      return [r.date, r.time, r.remarks, r.oilLevelAtRest, r.make]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, rangeFrom, rangeTo, statusTab]);

  const pendingCount = rows.filter(isTempPending).length;
  const completedCount = rows.length - pendingCount;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const exportRows = filtered.map((r, i) => ({
    srNo: i + 1,
    date: formatDate(r.date),
    time: r.time || '',
    make: r.make || '',
    oilLevel: r.oilLevelAtRest,
    fillTime: r.fillTimeMin,
    mainR: r.mainSwitch175A?.r,
    mainY: r.mainSwitch175A?.y,
    mainB: r.mainSwitch175A?.b,
    panelR: r.panelMainSwitch?.r,
    panelY: r.panelMainSwitch?.y,
    panelB: r.panelMainSwitch?.b,
    capR: r.capacitorSwitch?.r,
    capY: r.capacitorSwitch?.y,
    capB: r.capacitorSwitch?.b,
    coR: r.changeOverSwitch?.r,
    coY: r.changeOverSwitch?.y,
    coB: r.changeOverSwitch?.b,
    inR: r.compressorMainInputs?.r,
    inY: r.compressorMainInputs?.y,
    inB: r.compressorMainInputs?.b,
    motor: r.newCompMotor,
    oilSep: r.oilSeparator,
    airEnd: r.airEnd,
    airCooler: r.airCooler,
    tank: r.tank,
    pipe: r.dischargePipe,
    remarks: r.remarks
  }));

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openEdit = (row) => {
    setForm(formFromRow(row));
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
      updateItem('utilityTempRecords', editingId, { ...existing, ...form });
    } else {
      updateData('utilityTempRecords', { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
    clearForm();
    setPage(1);
    setShowList(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this temperature record?')) deleteItemSoftly('utilityTempRecords', id);
  };

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Thermometer size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Temperature Record of Utility</h1>
            <p className="page-subtitle">Add, view and manage temperature records of utility equipment.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <ExportButton data={exportRows} columns={EXPORT_COLUMNS} filename="Utility_Temp_Records" title="Temperature Records" />
          <button type="button" className="btn btn-primary" onClick={() => setShowList(true)}>
            <List size={15} /> Temperature Record List ({rows.length})
          </button>
        </div>
      </header>

      <section className="premium-card pm-card">
        <h2 className="pm-card-title">
          <Plus size={16} /> {editingId ? 'Edit Temperature Record' : 'Add New Temperature Record'}
        </h2>
        <form onSubmit={handleSave}>
          <div className="pm-form-grid pm-form-grid-5">
            <Field label="Date" required>
              <DateField className="input-field" required value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </Field>
            <Field label="Time" required>
              <TimeField className="input-field" required value={form.time} onChange={(e) => setField('time', e.target.value)} />
            </Field>
            <Field label="Oil Level At Rest" required>
              <SearchableSelect className="input-field" required value={form.oilLevelAtRest} onChange={(e) => setField('oilLevelAtRest', e.target.value)}>
                {OIL_LEVELS.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Total Time To Fill 12.5kg In Tank" required>
              <div className="pm-input-suffix">
                <input type="number" step="any" className="input-field" required value={form.fillTimeMin} onChange={(e) => setField('fillTimeMin', e.target.value)} />
                <span>Min</span>
              </div>
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
          </div>

          <div className="pm-form-grid pm-form-grid-3" style={{ marginTop: '0.75rem' }}>
            <PhaseInputs label="Main Switch" required value={form.mainSwitch175A} onChange={(v) => setField('mainSwitch175A', v)} />
            <PhaseInputs label="Panel Main Switch & Bus Bar" required value={form.panelMainSwitch} onChange={(v) => setField('panelMainSwitch', v)} />
            <PhaseInputs label="Capacitor Switch" required value={form.capacitorSwitch} onChange={(v) => setField('capacitorSwitch', v)} />
            <PhaseInputs label="Change Over Switch" required value={form.changeOverSwitch} onChange={(v) => setField('changeOverSwitch', v)} />
            <PhaseInputs label="Compressor Main Inputs" required value={form.compressorMainInputs} onChange={(v) => setField('compressorMainInputs', v)} />
          </div>

          <div className="pm-form-grid pm-form-grid-3" style={{ marginTop: '0.75rem' }}>
            <Field label="Comp Motor" required>
              <input type="number" step="any" className="input-field" required value={form.newCompMotor} onChange={(e) => setField('newCompMotor', e.target.value)} />
            </Field>
            <Field label="Oil Separator" required>
              <input type="number" step="any" className="input-field" required value={form.oilSeparator} onChange={(e) => setField('oilSeparator', e.target.value)} />
            </Field>
            <Field label="Air End" required>
              <input type="number" step="any" className="input-field" required value={form.airEnd} onChange={(e) => setField('airEnd', e.target.value)} />
            </Field>
            <Field label="Air Cooler" required>
              <input type="number" step="any" className="input-field" required value={form.airCooler} onChange={(e) => setField('airCooler', e.target.value)} />
            </Field>
            <Field label="Tank" required>
              <input type="number" step="any" className="input-field" required value={form.tank} onChange={(e) => setField('tank', e.target.value)} />
            </Field>
            <Field label="Comp Air Discharge Pipe Ss" required>
              <input type="number" step="any" className="input-field" required value={form.dischargePipe} onChange={(e) => setField('dischargePipe', e.target.value)} />
            </Field>
            <Field label="Remarks" className="pm-span-2">
              <input type="text" className="input-field" value={form.remarks} onChange={(e) => setField('remarks', e.target.value)} />
            </Field>
          </div>

          <div className="pm-form-actions">
            <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
            <button type="button" className="btn pm-btn-outline" onClick={() => setForm(editingId ? formFromRow(rows.find((r) => r.id === editingId)) : emptyForm())}>
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
              <FileText size={16} /> Temperature Record List
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
                  placeholder="Search by date, time or remarks..."
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
                  <th>Oil Level At Rest</th>
                  <th>Fill Time (Min)</th>
                  <th>Main Switch (R/Y/B)</th>
                  <th>Panel Main Switch (R/Y/B)</th>
                  <th>Capacitor Switch (R/Y/B)</th>
                  <th>Change Over Switch (R/Y/B)</th>
                  <th>Compressor Main Inputs (R/Y/B)</th>
                  <th>Comp Motor</th>
                  <th>Oil Separator</th>
                  <th>Air End</th>
                  <th>Air Cooler</th>
                  <th>Tank</th>
                  <th>Discharge Pipe Ss</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="pm-empty">
                      {rows.length && !filtered.length
                        ? 'No records in the selected date range. Widen the date filter above to see saved entries.'
                        : 'No temperature records yet. Add one using the form.'}
                    </td>
                  </tr>
                ) : pageRows.map((r, idx) => (
                  <tr key={r.id} className="pm-click-row" title="Click to open record" onClick={() => openEdit(r)}>
                    <td>{(pageSafe - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.time || '—'}</td>
                    <td>{r.make || '—'}</td>
                    <td>{r.oilLevelAtRest}</td>
                    <td>{r.fillTimeMin}</td>
                    <td>{phaseCells(r.mainSwitch175A)}</td>
                    <td>{phaseCells(r.panelMainSwitch)}</td>
                    <td>{phaseCells(r.capacitorSwitch)}</td>
                    <td>{phaseCells(r.changeOverSwitch)}</td>
                    <td>{phaseCells(r.compressorMainInputs)}</td>
                    <td>{r.newCompMotor}</td>
                    <td>{r.oilSeparator}</td>
                    <td>{r.airEnd}</td>
                    <td>{r.airCooler}</td>
                    <td>{r.tank}</td>
                    <td>{r.dischargePipe}</td>
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

export default UtilityTempRecord;
