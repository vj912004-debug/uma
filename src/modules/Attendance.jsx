import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import ExportButton from '../components/ExportButton';
import { formatDate } from '../utils/dateUtils';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';

const Attendance = () => {
  const { data, updateData, updateItem, deleteItemSoftly } = useAppContext();

  const userRole = data.settings?.userRole || 'Admin';
  const currentUser = data.currentUser || { id: 1, username: 'Admin', role: 'Admin' };

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);

  const [form, setForm] = useState({
    userId: String(currentUser.id),
    username: currentUser.username,
    date: new Date().toISOString().split('T')[0],
    inTime: '09:00',
    outTime: '18:00',
    status: 'Present',
    note: ''
  });

  const canEditRow = (row) => userRole === 'Admin' || String(row.userId) === String(currentUser.id);

  const openCreate = () => {
    setIsEditing(null);
    setForm({
      userId: String(currentUser.id),
      username: currentUser.username,
      date: new Date().toISOString().split('T')[0],
      inTime: '09:00',
      outTime: '18:00',
      status: 'Present',
      note: ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setIsEditing(row.id);
    setForm(row);
    setIsModalOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    const final = {
      ...form,
      userId: String(form.userId),
      username: form.username || (data.users || []).find(u => String(u.id) === String(form.userId))?.username || 'User'
    };

    if (isEditing) {
      updateItem('attendance', isEditing, { ...final, id: isEditing });
    } else {
      updateData('attendance', { ...final, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
    setIsModalOpen(false);
    setIsEditing(null);
  };

  const rows = (data.attendance || []).filter(r => !r.isDeleted);
  const filtered = rows.filter(r => {
    if (userRole !== 'Admin' && String(r.userId) !== String(currentUser.id)) return false;
    const s = searchTerm.toLowerCase();
    return (
      (r.username || '').toLowerCase().includes(s) ||
      (r.date || '').toLowerCase().includes(s) ||
      (r.status || '').toLowerCase().includes(s)
    );
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const exportColumns = [
    { label: 'User', key: 'username' },
    { label: 'Date', key: 'date' },
    { label: 'In Time', key: 'inTime' },
    { label: 'Out Time', key: 'outTime' },
    { label: 'Status', key: 'status' },
    { label: 'Note', key: 'note' }
  ];

  const users = useMemo(() => (data.users || []).filter(u => u.active !== false), [data.users]);

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Attendance</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {userRole === 'Admin' ? 'Manage daily attendance for all users.' : 'Mark and view your attendance.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ExportButton data={filtered} columns={exportColumns} filename="Attendance" title="Attendance Register" />
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Add Attendance
          </button>
        </div>
      </header>

      <div className="premium-card">
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input
            className="input-field"
            style={{ paddingLeft: '3rem' }}
            placeholder="Search user, date, status..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No attendance records.</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.username}</td>
                    <td>{r.inTime || '-'}</td>
                    <td>{r.outTime || '-'}</td>
                    <td>{r.status}</td>
                    <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.note || ''}>{r.note || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openEdit(r)}
                          disabled={!canEditRow(r)}
                          style={{ background: 'transparent', border: 'none', color: canEditRow(r) ? 'var(--text-muted)' : 'rgba(255,255,255,0.25)', cursor: canEditRow(r) ? 'pointer' : 'not-allowed' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteItemSoftly('attendance', r.id)}
                          disabled={userRole !== 'Admin'}
                          style={{ background: 'transparent', border: 'none', color: userRole === 'Admin' ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.25)', cursor: userRole === 'Admin' ? 'pointer' : 'not-allowed' }}
                        >
                          <Trash2 size={16} />
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

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)', padding: '2rem' }}>
          <div className="premium-card" style={{ width: '700px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.25rem' }}>{isEditing ? 'Edit Attendance' : 'Add Attendance'}</h2>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Date *</label>
                  <input type="date" className="input-field" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label>User *</label>
                  <select
                    className="input-field"
                    required
                    disabled={userRole !== 'Admin'}
                    value={form.userId}
                    onChange={e => {
                      const userId = e.target.value;
                      const u = users.find(x => String(x.id) === String(userId));
                      setForm({ ...form, userId, username: u?.username || '' });
                    }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>In Time</label>
                  <input type="time" className="input-field" value={form.inTime} onChange={e => setForm({ ...form, inTime: e.target.value })} />
                </div>
                <div>
                  <label>Out Time</label>
                  <input type="time" className="input-field" value={form.outTime} onChange={e => setForm({ ...form, outTime: e.target.value })} />
                </div>
                <div>
                  <label>Status</label>
                  <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Leave">Leave</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Note</label>
                  <textarea className="input-field" rows="3" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={userRole !== 'Admin' && String(form.userId) !== String(currentUser.id)}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

