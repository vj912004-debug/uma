import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Wrench,
  Plus,
  Save,
  RotateCcw,
  List
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import SearchableSelect from '../components/SearchableSelect';

const YES_NO = ['Yes', 'No'];
const MAKE_OPTIONS = ['Gardner Denver', 'Atlas Copco', 'Ingersoll Rand', 'Kaeser', 'Other'];

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  make: '',
  voltage1: '',
  voltage2: '',
  voltage3: '',
  ampere1: '',
  ampere2: '',
  ampere3: '',
  oldDryerStart: 'Yes',
  newDryerStart: 'Yes',
  oldMoistureSeparator: 'Yes',
  newMoistureSeparator: 'Yes',
  smallTank1Pressure: '',
  bigNewTank2Pressure: '',
  loadingUnloadingTime: '',
  tempCompressorOld: '',
  tempCompressorNew: '',
  doneBy: '',
  remarks: ''
});

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
  const { data, updateData, updateItem } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const staffNames = useMemo(() => {
    const fromUsers = (data.users || []).filter((u) => u.active !== false).map((u) => u.name || u.username).filter(Boolean);
    return [...new Set(fromUsers.length ? fromUsers : ['Amit', 'Ramesh', 'Sanjay', 'Suresh'])];
  }, [data.users]);

  const rows = useMemo(
    () => (data.utilityRecords || []).filter((r) => !r.isDeleted),
    [data.utilityRecords]
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
      updateItem('utilityRecords', editingId, { ...existing, ...form });
    } else {
      updateData('utilityRecords', { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
    clearForm();
    navigate('/utility-record-list');
  };

  const loadRowForEdit = (row) => {
    setEditingId(row.id);
    setForm({ ...emptyForm(), ...row });
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
          <Wrench size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Utility Record</h1>
            <p className="page-subtitle">Add and update daily utility consumption records.</p>
          </div>
        </div>
        <Link to="/utility-record-list" className="btn pm-btn-outline">
          <List size={15} /> View Saved Entries
        </Link>
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
            <Field label="Voltage - 2 (V)" required>
              <input type="number" step="any" className="input-field" required value={form.voltage2} onChange={(e) => setField('voltage2', e.target.value)} />
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
            <Field label="Dryer Start - 1" required>
              <SearchableSelect className="input-field" required value={form.oldDryerStart} onChange={(e) => setField('oldDryerStart', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Dryer Start - 2" required>
              <SearchableSelect className="input-field" required value={form.newDryerStart} onChange={(e) => setField('newDryerStart', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>

            <Field label="Moisture Separator Working - 1" required>
              <SearchableSelect className="input-field" required value={form.oldMoistureSeparator} onChange={(e) => setField('oldMoistureSeparator', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Moisture Separator Working - 2" required>
              <SearchableSelect className="input-field" required value={form.newMoistureSeparator} onChange={(e) => setField('newMoistureSeparator', e.target.value)}>
                {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
              </SearchableSelect>
            </Field>
            <Field label="Tank - 1 Pressure (Kg)" required>
              <input type="number" step="any" className="input-field" required value={form.smallTank1Pressure} onChange={(e) => setField('smallTank1Pressure', e.target.value)} />
            </Field>
            <Field label="Tank - 2 Pressure (Kg)" required>
              <input type="number" step="any" className="input-field" required value={form.bigNewTank2Pressure} onChange={(e) => setField('bigNewTank2Pressure', e.target.value)} />
            </Field>
            <Field label="Loading/Unloading Time" required>
              <input type="text" className="input-field" required placeholder="48/62" value={form.loadingUnloadingTime} onChange={(e) => setField('loadingUnloadingTime', e.target.value)} />
            </Field>

            <Field label="Temp. of Compressor - 1 (°C)" required>
              <input type="number" step="any" className="input-field" required value={form.tempCompressorOld} onChange={(e) => setField('tempCompressorOld', e.target.value)} />
            </Field>
            <Field label="Temp. of Compressor - 2 (°C)" required>
              <input type="number" step="any" className="input-field" required value={form.tempCompressorNew} onChange={(e) => setField('tempCompressorNew', e.target.value)} />
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
            <button type="submit" className="btn btn-primary"><Save size={15} /> Save</button>
            <button type="button" className="btn pm-btn-outline" onClick={clearForm}><RotateCcw size={15} /> Clear</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default UtilityRecord;
