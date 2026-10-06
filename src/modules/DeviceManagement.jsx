import React, { useMemo, useState } from 'react';
import {
  Fingerprint,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Wifi,
  WifiOff,
  Users,
  Download,
  RefreshCw,
  FileText,
  Link2,
  Search,
  CheckCircle2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import DateField from '../components/DateField';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate, newestFirst } from '../utils/dateUtils';
import {
  getBiometricDevices,
  withDevices,
  applyEsslSyncToState,
  isEsslSyncEligible,
  isPendingApproval,
  approvalPatch,
  recordSyncFailure,
  lastSuccessfulSync,
  getRawPunches
} from '../utils/payroll';

const LOG_PAGE_SIZE = 50;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

const emptyDevice = () => ({
  name: '',
  model: 'eSSL',
  serialNo: '',
  location: '',
  host: '',
  port: '4370'
});

const timeText = (iso) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${formatDate(d.toISOString().slice(0, 10))} ${time}`;
};

const stampText = (iso) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const Field = ({ label, required, children }) => (
  <div className="form-group pm-field">
    <label>
      {label}
      {required ? <span className="pm-req">*</span> : null}
    </label>
    {children}
  </div>
);

const DeviceManagement = () => {
  const { data, setData } = useAppContext();
  const { currentUser, isAdmin } = useAuth();
  const devices = getBiometricDevices(data);
  const [selectedId, setSelectedId] = useState(devices[0]?.id || '');
  const [busy, setBusy] = useState('');
  const [modal, setModal] = useState(null);
  const [deviceForm, setDeviceForm] = useState(emptyDevice);
  const [editingId, setEditingId] = useState(null);
  const [logFilter, setLogFilter] = useState({ device: '', date: '', search: '' });
  const [logPage, setLogPage] = useState(1);
  const [mapDraft, setMapDraft] = useState({});
  const [mapSearch, setMapSearch] = useState('');

  const selected = devices.find((d) => d.id === selectedId) || devices[0] || null;
  const users = data.users || [];
  const employees = useMemo(
    () => newestFirst(users.filter((u) => !u.isDeleted && u.active !== false && (u.role !== 'Admin' || u.esslId || u.employeeId))),
    [users]
  );
  const logs = getRawPunches(data);
  const syncHistory = (data.deviceSyncHistory || []).slice(0, 15);
  const todayStr = new Date().toISOString().slice(0, 10);

  const kpis = {
    devices: devices.length,
    online: devices.filter((d) => d.status === 'Online').length,
    mapped: employees.filter((u) => u.esslId).length,
    pending: employees.filter(isPendingApproval).length,
    logsToday: logs.filter((l) => l.punchDate === todayStr).length
  };

  const saveDevices = (updater) => setData((prev) => withDevices(prev, updater(getBiometricDevices(prev))));
  const patchDevice = (id, patch) => saveDevices((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const needDevice = () => {
    if (!selected) {
      alert('Add a biometric device first.');
      return false;
    }
    return true;
  };

  /* ── Device CRUD ── */
  const openAddDevice = () => {
    setDeviceForm(emptyDevice());
    setEditingId(null);
    setModal('device');
  };
  const openEditDevice = (d) => {
    setDeviceForm({
      name: d.name || '',
      model: d.model || '',
      serialNo: d.serialNo || '',
      location: d.location || '',
      host: d.host || '',
      port: String(d.port || '4370')
    });
    setEditingId(d.id);
    setModal('device');
  };
  const saveDevice = (e) => {
    e.preventDefault();
    const name = deviceForm.name.trim();
    const host = deviceForm.host.trim();
    if (!name || !host) {
      alert('Device Name and IP Address are required.');
      return;
    }
    const fields = {
      name,
      model: deviceForm.model.trim(),
      serialNo: deviceForm.serialNo.trim(),
      location: deviceForm.location.trim(),
      host,
      port: Number(deviceForm.port) || 4370
    };
    if (editingId) {
      patchDevice(editingId, fields);
    } else {
      const id = `dev-${Date.now()}`;
      saveDevices((list) => [{ id, ...fields, status: 'Offline', lastSync: null, lastTest: null, enrolled: [], createdAt: new Date().toISOString() }, ...list]);
      setSelectedId(id);
    }
    setModal(null);
  };
  const deleteDevice = (d) => {
    if (!window.confirm(`Remove device ${d.name}? Downloaded punch logs and attendance stay in the software.`)) return;
    saveDevices((list) => list.filter((x) => x.id !== d.id));
    if (selectedId === d.id) setSelectedId('');
  };

  /* ── Device actions ── */
  const testConnection = async () => {
    if (!needDevice()) return;
    setBusy('test');
    await new Promise((r) => setTimeout(r, 700));
    const ok = IPV4.test(String(selected.host || '').trim());
    patchDevice(selected.id, { status: ok ? 'Online' : 'Offline', lastTest: new Date().toISOString() });
    setBusy('');
    alert(ok
      ? `${selected.name} is online at ${selected.host}:${selected.port || 4370}.`
      : `Could not reach ${selected.name} at "${selected.host}". Check the IP address and network cable.`);
  };

  const syncEmployees = async () => {
    if (!needDevice()) return;
    if (selected.status !== 'Online') {
      alert('Device is offline. Click Test Connection first.');
      return;
    }
    setBusy('employees');
    await new Promise((r) => setTimeout(r, 600));
    const ready = employees.filter(isEsslSyncEligible);
    const pending = employees.filter((u) => isPendingApproval(u)).length;
    const noId = employees.filter((u) => !isPendingApproval(u) && !u.esslId).length;
    patchDevice(selected.id, {
      enrolled: ready.map((u) => ({ esslId: String(u.esslId), userId: String(u.id), name: u.name || u.username, employeeId: u.employeeId || '' })),
      employeesSyncedAt: new Date().toISOString()
    });
    setBusy('');
    alert([
      `${ready.length} approved employee(s) sent to ${selected.name}.`,
      pending ? `${pending} employee(s) awaiting admin approval were skipped.` : '',
      noId ? `${noId} employee(s) without an eSSL ID were skipped — use Map Employees.` : ''
    ].filter(Boolean).join('\n'));
  };

  const syncNow = async () => {
    if (!needDevice()) return;
    if (selected.status !== 'Online') {
      setData((prev) => recordSyncFailure(prev, selected.id, 'Device offline / unreachable'));
      alert(`Could not reach ${selected.name}. Nothing is lost — the next successful sync fetches every punch since ${timeText(lastSuccessfulSync(data, selected))}.\nClick Test Connection, then Sync Now.`);
      return;
    }
    setBusy('sync');
    await new Promise((r) => setTimeout(r, 600));
    const { result } = applyEsslSyncToState(data, new Date(), selected.id);
    setData((prev) => applyEsslSyncToState(prev, new Date(), selected.id).next);
    setBusy('');
    const from = result.since ? `Fetched all punches since last successful sync (${timeText(result.since)}).` : 'First sync: fetched the last 7 days of punches.';
    alert(result.imported || result.added || result.updated
      ? `Sync complete.\n${from}\n${result.imported} raw punch(es) stored → ${result.added} attendance row(s) created, ${result.updated} updated.`
      : `Sync complete.\n${from}\nNo new punches (already up to date).`);
  };

  const downloadLogs = () => {
    if (!needDevice()) return;
    const rows = logs
      .filter((l) => !l.deviceId || l.deviceId === selected.id)
      .sort((a, b) => a.punchId - b.punchId);
    if (!rows.length) {
      alert('No raw punches from this device yet. Click Sync Now to pull punches first.');
      return;
    }
    const header = ['Punch ID', 'Employee ID', 'Employee Name', 'Device ID', 'Device User ID', 'Punch Date', 'Punch Time', 'Punch Type', 'Verification', 'Raw Data', 'Imported At'];
    const lines = [header.map(csvCell).join(',')].concat(rows.map((l) => [
      l.punchId, l.employeeId, l.employeeName, l.deviceName, l.deviceUserId, formatDate(l.punchDate), l.punchTime,
      l.punchType, l.verification, l.rawData, stampText(l.importedAt)
    ].map(csvCell).join(',')));
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Raw_Punches_${String(selected.name).replace(/[\\/:*?"<>|\s]+/g, '_')}_${todayStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openLogs = () => {
    setLogFilter({ device: selected?.id || '', date: '', search: '' });
    setLogPage(1);
    setModal('logs');
  };

  const openMap = () => {
    setMapDraft(Object.fromEntries(employees.map((u) => [u.id, u.esslId || ''])));
    setMapSearch('');
    setModal('map');
  };

  const saveMapping = () => {
    const ids = Object.entries(mapDraft).map(([, v]) => String(v || '').trim()).filter(Boolean);
    const dup = ids.find((v, i) => ids.indexOf(v) !== i);
    if (dup) {
      alert(`eSSL ID ${dup} is assigned to more than one employee. Each employee needs a unique ID.`);
      return;
    }
    setData((prev) => ({
      ...prev,
      users: (prev.users || []).map((u) => (Object.prototype.hasOwnProperty.call(mapDraft, u.id)
        ? { ...u, esslId: String(mapDraft[u.id] || '').trim() }
        : u))
    }));
    setModal(null);
  };

  const approveEmployee = (u) => {
    if (!isAdmin) return;
    if (!window.confirm(`Approve ${u.name || u.employeeId}? Their punches will then sync automatically.`)) return;
    setData((prev) => ({
      ...prev,
      users: (prev.users || []).map((x) => (x.id === u.id ? { ...x, ...approvalPatch(currentUser) } : x))
    }));
  };

  /* ── Log viewer rows ── */
  const filteredLogs = logs.filter((l) => {
    if (logFilter.device && l.deviceId && l.deviceId !== logFilter.device) return false;
    if (logFilter.date && l.punchDate !== logFilter.date) return false;
    const q = logFilter.search.trim().toLowerCase();
    if (!q) return true;
    return [l.punchId, l.deviceUserId, l.employeeId, l.employeeName, l.punchType, l.verification, l.rawData]
      .some((v) => String(v ?? '').toLowerCase().includes(q));
  }).sort((a, b) => b.punchId - a.punchId);
  const logPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const logRows = filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  const enrolledIds = new Set((selected?.enrolled || []).map((e) => String(e.userId)));
  const mapRows = employees.filter((u) => {
    const q = mapSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.employeeId, u.name, u.username, u.department, mapDraft[u.id]].some((v) => String(v || '').toLowerCase().includes(q));
  });

  const ACTIONS = [
    { id: 'test', label: 'Test Connection', icon: Wifi, onClick: testConnection },
    { id: 'employees', label: 'Sync Employees', icon: Users, onClick: syncEmployees },
    { id: 'download', label: 'Download Logs', icon: Download, onClick: downloadLogs },
    { id: 'sync', label: 'Sync Now', icon: RefreshCw, onClick: syncNow, primary: true },
    { id: 'logs', label: 'View Device Logs', icon: FileText, onClick: openLogs },
    { id: 'map', label: 'Map Employees', icon: Link2, onClick: openMap }
  ];

  return (
    <div className="pm-page">
      <header className="page-header pm-header">
        <div className="pm-title-wrap">
          <Fingerprint size={22} className="pm-title-icon" />
          <div>
            <h1 className="page-title">Device Management</h1>
            <p className="page-subtitle">Biometric attendance devices, connection, employee mapping and punch logs.</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddDevice}>
            <Plus size={15} /> Add Device
          </button>
        </div>
      </header>

      <div className="dm-kpis">
        <div className="dm-kpi"><span>Devices</span><strong>{kpis.devices}</strong></div>
        <div className="dm-kpi is-on"><span>Online</span><strong>{kpis.online}</strong></div>
        <div className="dm-kpi"><span>Mapped Employees</span><strong>{kpis.mapped}</strong></div>
        <div className="dm-kpi is-warn"><span>Pending Approval</span><strong>{kpis.pending}</strong></div>
        <div className="dm-kpi"><span>Punches Today</span><strong>{kpis.logsToday}</strong></div>
      </div>

      <section className="premium-card pm-card">
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>
            <Fingerprint size={16} /> Biometric Devices
          </h2>
        </div>
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Location</th>
                <th>IP/Connection</th>
                <th>Status</th>
                <th>Last Sync</th>
                <th>Enrolled</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr><td colSpan={7} className="pm-empty">No devices. Click Add Device.</td></tr>
              ) : devices.map((d) => {
                const online = d.status === 'Online';
                return (
                  <tr
                    key={d.id}
                    className={`pm-click-row ${selected?.id === d.id ? 'dm-row-selected' : ''}`}
                    title="Click to select this device"
                    onClick={() => setSelectedId(d.id)}
                  >
                    <td>
                      <strong>{d.name}</strong>
                      {d.model ? <div className="dm-sub">{d.model}{d.serialNo ? ` · ${d.serialNo}` : ''}</div> : null}
                    </td>
                    <td>{d.location || '—'}</td>
                    <td>
                      {online ? 'Connected' : 'Not connected'}
                      <div className="dm-sub">{d.host || '—'}{d.host ? `:${d.port || 4370}` : ''}</div>
                    </td>
                    <td>
                      <span className={`dm-status ${online ? 'is-online' : 'is-offline'}`}>
                        <i /> {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td>
                      {timeText(d.lastSuccessSync || d.lastSync)}
                      {d.lastSyncError && d.lastSyncAttempt && d.lastSyncAttempt > (d.lastSuccessSync || d.lastSync || '') ? (
                        <div className="dm-sub dm-fail" title={d.lastSyncError}>Retrying · failed {timeText(d.lastSyncAttempt)}</div>
                      ) : null}
                    </td>
                    <td>{(d.enrolled || []).length}</td>
                    <td className="pm-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="Edit" onClick={() => openEditDevice(d)}><Edit2 size={14} /></button>
                      <button type="button" title="Remove" className="danger" onClick={() => deleteDevice(d)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="dm-toolbar">
          <span className="dm-toolbar-label">
            {selected ? <>Selected: <strong>{selected.name}</strong></> : 'No device selected'}
          </span>
          <div className="dm-toolbar-actions">
            {ACTIONS.map(({ id, label, icon: Icon, onClick, primary }) => (
              <button
                key={id}
                type="button"
                className={`btn ${primary ? 'btn-primary' : 'pm-btn-outline'}`}
                disabled={Boolean(busy) || !selected}
                onClick={onClick}
              >
                <Icon size={15} className={busy === id ? 'esm-spin' : ''} />
                {busy === id ? 'Working…' : label}
              </button>
            ))}
          </div>
        </div>
        <p className="esm-note">
          Only employees approved by an admin are sent to the device and synced. After approval, punch-in and punch-out records sync automatically
          {data.esslSettings?.autoSync === false ? ' when you click Sync Now (auto sync is off on the eSSL Sync tab).' : ` every ${data.esslSettings?.autoSyncMinutes || 5} minutes while a device is online.`}
          {' '}Demo mode works without a physical device.
        </p>
      </section>

      <section className="premium-card pm-card" style={{ marginTop: '1rem' }}>
        <div className="pm-list-head">
          <h2 className="pm-card-title" style={{ margin: 0 }}>
            <RefreshCw size={16} /> Sync History
          </h2>
          <span className="dm-sub">Each sync asks the device for every punch since the last successful sync.</span>
        </div>
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Fetched Since</th>
                <th>Result</th>
                <th>Raw Punches</th>
                <th>Attendance Created</th>
                <th>Attendance Updated</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.length === 0 ? (
                <tr><td colSpan={7} className="pm-empty">No sync runs yet.</td></tr>
              ) : syncHistory.map((h) => (
                <tr key={h.id}>
                  <td>
                    {timeText(h.at)}
                    {h.status === 'Failed' && h.attempts > 1 ? <div className="dm-sub">{h.attempts} attempts since {timeText(h.firstFailedAt)}</div> : null}
                    {h.status === 'Success' && h.checks > 1 ? <div className="dm-sub">{h.checks} checks, no new punches</div> : null}
                  </td>
                  <td>{h.deviceName || '—'}</td>
                  <td>{h.from ? timeText(h.from) : 'First sync (7 days)'}</td>
                  <td>
                    {h.status === 'Success'
                      ? <span className="pm-pill is-approved">Success</span>
                      : <span className="pm-pill is-low" title={h.reason || ''}>Failed{h.reason ? ` · ${h.reason}` : ''}</span>}
                  </td>
                  <td>{h.imported || 0}</td>
                  <td>{h.added || 0}</td>
                  <td>{h.updated || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'device' && (
        <div className="page-form-overlay">
          <section className="premium-card pm-card pm-modal-card">
            <div className="pm-modal-head">
              <h2 className="pm-card-title"><Fingerprint size={16} /> {editingId ? 'Edit Device' : 'Add Device'}</h2>
              <button type="button" className="btn" onClick={() => setModal(null)}><X size={14} /> Close</button>
            </div>
            <form onSubmit={saveDevice} className="pm-modal-form">
              <Field label="Device Name" required>
                <input className="input-field" required value={deviceForm.name} onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="Z900-01" />
              </Field>
              <Field label="Model">
                <input className="input-field" value={deviceForm.model} onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })} placeholder="eSSL" />
              </Field>
              <Field label="Serial No.">
                <input className="input-field" value={deviceForm.serialNo} onChange={(e) => setDeviceForm({ ...deviceForm, serialNo: e.target.value })} />
              </Field>
              <Field label="Location">
                <SearchableSelect className="input-field" value={deviceForm.location} onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })} placeholder="Select or type location">
                  <option value="">Select or type location</option>
                  {[...new Set(['Factory', 'Office', 'Main Gate', ...devices.map((d) => d.location).filter(Boolean)])].map((l) => <option key={l} value={l}>{l}</option>)}
                </SearchableSelect>
              </Field>
              <Field label="IP Address" required>
                <input className="input-field" required value={deviceForm.host} onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })} placeholder="192.168.1.50" />
              </Field>
              <Field label="Port">
                <input type="number" className="input-field" value={deviceForm.port} onChange={(e) => setDeviceForm({ ...deviceForm, port: e.target.value })} />
              </Field>
              <div className="pm-form-actions">
                <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
                <button type="button" className="btn pm-btn-outline" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modal === 'logs' && (
        <div className="page-form-overlay">
          <section className="premium-card pm-card pm-modal-card">
            <div className="pm-modal-head">
              <h2 className="pm-card-title"><FileText size={16} /> Raw Biometric Punches ({filteredLogs.length})</h2>
              <button type="button" className="btn" onClick={() => setModal(null)}><X size={14} /> Close</button>
            </div>
            <div className="dm-log-filters">
              <SearchableSelect className="input-field" allowCustom={false} value={logFilter.device} onChange={(e) => { setLogFilter({ ...logFilter, device: e.target.value }); setLogPage(1); }}>
                <option value="">All Devices</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SearchableSelect>
              <DateField className="input-field" value={logFilter.date} onChange={(e) => { setLogFilter({ ...logFilter, date: e.target.value }); setLogPage(1); }} />
              <div className="pm-search">
                <Search size={14} />
                <input type="text" placeholder="Search punch ID, device user ID, employee..." value={logFilter.search} onChange={(e) => { setLogFilter({ ...logFilter, search: e.target.value }); setLogPage(1); }} />
              </div>
            </div>
            <div className="pm-table-wrap">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Punch ID</th>
                    <th>Employee ID</th>
                    <th>Device ID</th>
                    <th>Device User ID</th>
                    <th>Punch Date</th>
                    <th>Punch Time</th>
                    <th>Punch Type</th>
                    <th>Verification</th>
                    <th>Raw Data</th>
                    <th>Imported At</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.length === 0 ? (
                    <tr><td colSpan={10} className="pm-empty">No raw punches. Click Sync Now to pull punches from the device.</td></tr>
                  ) : logRows.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.punchId}</strong></td>
                      <td title={l.employeeName || ''}>{l.employeeId || <span className="dm-sub dm-fail">Unmapped</span>}</td>
                      <td>{l.deviceName || '—'}</td>
                      <td>{l.deviceUserId}</td>
                      <td>{formatDate(l.punchDate)}</td>
                      <td>{l.punchTime}</td>
                      <td>
                        <span className={`pm-pill ${l.punchType === 'IN' ? 'is-approved' : l.punchType === 'OUT' ? 'is-ordered' : 'is-pending'}`}>{l.punchType}</span>
                      </td>
                      <td>{l.verification}</td>
                      <td><code className="dm-raw">{l.rawData}</code></td>
                      <td>{stampText(l.importedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logPages > 1 && (
              <div className="pm-pager">
                <button type="button" className="btn pm-btn-outline" disabled={logPage <= 1} onClick={() => setLogPage(logPage - 1)}>Prev</button>
                <span>Page {logPage} of {logPages}</span>
                <button type="button" className="btn pm-btn-outline" disabled={logPage >= logPages} onClick={() => setLogPage(logPage + 1)}>Next</button>
              </div>
            )}
          </section>
        </div>
      )}

      {modal === 'map' && (
        <div className="page-form-overlay">
          <section className="premium-card pm-card pm-modal-card">
            <div className="pm-modal-head">
              <h2 className="pm-card-title"><Link2 size={16} /> Map Employees to Device IDs</h2>
              <button type="button" className="btn" onClick={() => setModal(null)}><X size={14} /> Close</button>
            </div>
            <p className="esm-note" style={{ marginTop: 0 }}>
              Enter each employee&apos;s user ID from the biometric device. Employees must also be approved by an admin before their punches sync.
            </p>
            <div className="dm-log-filters">
              <div className="pm-search">
                <Search size={14} />
                <input type="text" placeholder="Search code, name, department..." value={mapSearch} onChange={(e) => setMapSearch(e.target.value)} />
              </div>
            </div>
            <div className="pm-table-wrap">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Emp. Code</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Approval</th>
                    <th>Device User ID (eSSL ID)</th>
                    <th>On {selected?.name || 'Device'}</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.length === 0 ? (
                    <tr><td colSpan={6} className="pm-empty">No employees found.</td></tr>
                  ) : mapRows.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.employeeId || '—'}</strong></td>
                      <td>{u.name || u.username}</td>
                      <td>{u.department || '—'}</td>
                      <td>
                        {isPendingApproval(u) ? (
                          isAdmin ? (
                            <button type="button" className="btn esm-approve-btn" onClick={() => approveEmployee(u)}>
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          ) : <span className="pm-pill is-pending">Pending</span>
                        ) : <span className="pm-pill is-approved">Approved</span>}
                      </td>
                      <td>
                        <input
                          className="input-field dm-map-input"
                          value={mapDraft[u.id] ?? ''}
                          onChange={(e) => setMapDraft({ ...mapDraft, [u.id]: e.target.value })}
                          placeholder="e.g. 101"
                        />
                      </td>
                      <td>
                        {enrolledIds.has(String(u.id))
                          ? <span className="pm-pill is-approved">Enrolled</span>
                          : <span className="pm-pill is-low">Not sent</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pm-form-actions" style={{ marginTop: '0.85rem' }}>
              <button type="button" className="btn btn-primary" onClick={saveMapping}><Save size={15} /> Save Mapping</button>
              <button type="button" className="btn pm-btn-outline" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
