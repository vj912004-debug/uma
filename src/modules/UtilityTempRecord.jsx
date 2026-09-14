import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Thermometer,
  Plus,
  Save,
  RotateCcw,
  List
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SearchableSelect from '../components/SearchableSelect';

const OIL_LEVELS = ['Low', 'Medium', 'High', 'OK'];
const MAKE_OPTIONS = ['Gardner Denver', 'Atlas Copco', 'Ingersoll Rand', 'Kaeser', 'Other'];

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
  const { data, updateData, updateItem } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const rows = useMemo(
    () => (data.utilityTempRecords || []).filter((r) => !r.isDeleted),
    [data.utilityTempRecords]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
    navigate('/utility-temp-record-list');
  };

  const loadRowForEdit = (row) => {
    setEditingId(row.id);
    setForm({
      ...emptyForm(),
      ...row,
      mainSwitch175A: { ...emptyPhase(), ...(row.mainSwitch175A || {}) },
      panelMainSwitch: { ...emptyPhase(), ...(row.panelMainSwitch || {}) },
      capacitorSwitch: { ...emptyPhase(), ...(row.capacitorSwitch || {}) },
      changeOverSwitch: { ...emptyPhase(), ...(row.changeOverSwitch || {}) },
      compressorMainInputs: { ...emptyPhase(), ...(row.compressorMainInputs || {}) }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const row = rows.find((r) => r.id === editId);
    if (row) loadRowForEdit(row);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.editId, rows]);

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Thermometer size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Temperature Record of Utility</h1>
            <p className="page-subtitle">Add and update temperature records of utility equipment.</p>
          </div>
        </div>
        <Link to="/utility-temp-record-list" className="btn pm-btn-outline">
          <List size={15} /> View Saved Entries
        </Link>
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
            <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
            <button type="button" className="btn pm-btn-outline" onClick={clearForm}><RotateCcw size={15} /> Clear</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default UtilityTempRecord;
