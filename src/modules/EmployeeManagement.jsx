import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { hashPassword, generatePassword, generateEmployeeId } from '../utils/auth';
import { Plus, Edit2, KeyRound, UserX, UserCheck, Copy, Check, RefreshCw } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { ALL_STAFF_MODULE_IDS, groupModuleOptions } from '../utils/moduleAccess';

const DEPARTMENTS = ['Management', 'Production', 'Packaging', 'Quality Control', 'Accounts', 'General'];
const MODULE_GROUPS = groupModuleOptions();

const emptyForm = (employeeId = '') => ({
  name: '',
  username: '',
  password: '',
  employeeId,
  department: 'Production',
  role: 'Staff',
  active: true,
  permissions: []
});

const EmployeeManagement = () => {
  const { data, updateData, updateItem } = useAppContext();
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const resetForm = () => {
    setForm(emptyForm(generateEmployeeId(data.users || [])));
    setEditingUser(null);
    setGeneratedCreds(null);
  };

  const openAddModal = () => {
    resetForm();
    setForm((f) => ({
      ...f,
      employeeId: generateEmployeeId(data.users || []),
      permissions: [...ALL_STAFF_MODULE_IDS]
    }));
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    const perms = Array.isArray(user.permissions) ? [...user.permissions] : [];
    setForm({
      name: user.name || user.username,
      username: user.username,
      password: '',
      employeeId: user.employeeId,
      department: user.department || 'General',
      role: user.role || 'Staff',
      active: user.active !== false,
      permissions: user.role === 'Admin' ? [] : (perms.length ? perms : [...ALL_STAFF_MODULE_IDS])
    });
    setGeneratedCreds(null);
    setShowModal(true);
  };

  const togglePermission = (id) => {
    setForm((f) => {
      const has = f.permissions.includes(id);
      return {
        ...f,
        permissions: has ? f.permissions.filter((p) => p !== id) : [...f.permissions, id]
      };
    });
  };

  const selectAllModules = () => setForm((f) => ({ ...f, permissions: [...ALL_STAFF_MODULE_IDS] }));
  const clearAllModules = () => setForm((f) => ({ ...f, permissions: [] }));

  const handleGeneratePassword = () => {
    const pwd = generatePassword(10);
    setForm((f) => ({ ...f, password: pwd }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.username.trim()) {
      alert('Name and username are required.');
      return;
    }

    const duplicate = data.users?.find(
      (u) => u.username.toLowerCase() === form.username.trim().toLowerCase() && u.id !== editingUser?.id
    );
    if (duplicate) {
      alert('Username already exists. Choose a different username.');
      return;
    }

    if (!editingUser && !form.password) {
      alert('Password is required for new employees.');
      return;
    }

    if (form.role === 'Staff' && (!form.permissions || form.permissions.length === 0)) {
      alert('Select at least one module for Staff login access.');
      return;
    }

    const passwordHash = form.password
      ? await hashPassword(form.password)
      : editingUser?.passwordHash;

    if (!passwordHash) {
      alert('Password is required.');
      return;
    }

    const userData = {
      name: form.name.trim(),
      username: form.username.trim(),
      employeeId: form.employeeId || generateEmployeeId(data.users || []),
      department: form.department,
      role: form.role,
      active: form.active,
      passwordHash,
      permissions: form.role === 'Admin' ? [] : form.permissions
    };

    if (editingUser) {
      updateItem('users', editingUser.id, { ...editingUser, ...userData });
      if (form.password) {
        setGeneratedCreds({ username: form.username, password: form.password, isReset: true });
      } else {
        setShowModal(false);
        resetForm();
      }
    } else {
      const newUser = {
        id: Date.now(),
        ...userData,
        createdAt: new Date().toISOString()
      };
      updateData('users', newUser);
      setGeneratedCreds({ username: form.username, password: form.password, isReset: false });
    }
  };

  const toggleActive = (user) => {
    if (user.role === 'Admin' && user.active !== false) {
      const activeAdmins = data.users?.filter((u) => u.role === 'Admin' && u.active !== false) || [];
      if (activeAdmins.length <= 1) {
        alert('Cannot deactivate the only active admin account.');
        return;
      }
    }
    updateItem('users', user.id, { ...user, active: user.active === false });
  };

  const copyCredentials = () => {
    if (!generatedCreds) return;
    const text = `UMA MICRON Login Credentials\nUsername: ${generatedCreds.username}\nPassword: ${generatedCreds.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (!isAdmin) {
    return (
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Access Denied</h1>
        <p style={{ color: 'var(--text-muted)' }}>Only administrators can manage employee credentials.</p>
      </div>
    );
  }

  const moduleCountLabel = (user) => {
    if (user.role === 'Admin') return 'All modules';
    const n = Array.isArray(user.permissions) ? user.permissions.length : 0;
    if (!n) return 'No modules';
    if (n >= ALL_STAFF_MODULE_IDS.length) return 'All modules';
    return `${n} module${n === 1 ? '' : 's'}`;
  };

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Employee Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Create logins and choose which modules each employee can open.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Add Employee
        </button>
      </header>

      <div className="premium-card">
        <div className="data-table-container">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Department</th>
                <th>Role</th>
                <th>Modules</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data.users || []).length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No employees found. Add your first employee.
                  </td>
                </tr>
              ) : (
                data.users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{user.employeeId}</td>
                    <td>{user.name || user.username}</td>
                    <td>{user.username}</td>
                    <td>{user.department}</td>
                    <td>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: user.role === 'Admin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                        color: user.role === 'Admin' ? '#60a5fa' : 'var(--accent-primary)'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{moduleCountLabel(user)}</td>
                    <td>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: user.active !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: user.active !== false ? 'var(--accent-primary)' : '#f87171'
                      }}>
                        {user.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" onClick={() => openEditModal(user)} title="Edit / Reset Password">
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn"
                          onClick={() => toggleActive(user)}
                          title={user.active !== false ? 'Deactivate' : 'Activate'}
                          style={{ color: user.active !== false ? '#f87171' : 'var(--accent-primary)' }}
                        >
                          {user.active !== false ? <UserX size={14} /> : <UserCheck size={14} />}
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

      {showModal && (
        <div className="page-form-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: '640px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {generatedCreds ? (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <KeyRound size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Credentials {generatedCreds.isReset ? 'Updated' : 'Generated'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Share these credentials securely with the employee.
                </p>
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ marginBottom: '0.25rem' }}>Username</label>
                    <p style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 600 }}>{generatedCreds.username}</p>
                  </div>
                  <div>
                    <label style={{ marginBottom: '0.25rem' }}>Password</label>
                    <p style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{generatedCreds.password}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={copyCredentials} style={{ flex: 1 }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </button>
                  <button className="btn" onClick={closeModal} style={{ flex: 1 }}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                  {editingUser ? 'Edit Employee' : 'Add New Employee'}
                </h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        className="input-field"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Employee name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Employee ID</label>
                      <input
                        className="input-field"
                        value={form.employeeId}
                        onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                        placeholder="EMP001"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Department</label>
                      <SearchableSelect
                        className="input-field"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                      >
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </SearchableSelect>
                    </div>
                    <div className="form-group">
                      <label>Role</label>
                      <SearchableSelect
                        className="input-field"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                      >
                        <option value="Staff">Staff</option>
                        <option value="Admin">Admin</option>
                      </SearchableSelect>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Login Username</label>
                    <input
                      className="input-field"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="login username"
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div className="form-group">
                    <label>{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input-field"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={editingUser ? 'Enter new password to reset' : 'Set password'}
                        autoComplete="new-password"
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn" onClick={handleGeneratePassword} title="Generate random password">
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  {form.role === 'Staff' && (
                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                        <label style={{ margin: 0 }}>Module Access</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" className="btn" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={selectAllModules}>
                            Select All
                          </button>
                          <button type="button" className="btn" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={clearAllModules}>
                            Clear
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                        Tick modules this employee can open after login. Unticked modules stay hidden in their sidebar and cannot be opened by URL. Use <strong>E-Way (DC)</strong> / <strong>E-Way (TI)</strong> for e-way linking.
                      </p>
                      <div style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        background: 'var(--input-bg)',
                        maxHeight: '280px',
                        overflowY: 'auto'
                      }}>
                        {MODULE_GROUPS.map(([group, modules]) => (
                          <div key={group} style={{ marginBottom: '0.85rem' }}>
                            <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#5b1c85', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {group}
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.75rem' }}>
                              {modules.map((m) => (
                                <label
                                  key={m.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    fontWeight: m.highlight ? 700 : 500,
                                    color: m.highlight ? '#5b1c85' : 'inherit'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={form.permissions.includes(m.id)}
                                    onChange={() => togglePermission(m.id)}
                                  />
                                  {m.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                        Selected: {form.permissions.length} module{form.permissions.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button type="button" className="btn" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {editingUser ? 'Save Changes' : 'Create & Generate Credentials'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
