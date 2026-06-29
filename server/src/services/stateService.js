import { query } from '../db/pool.js';
import { getDefaultErpState } from '../utils/defaultState.js';

function mapUserRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    username: row.username,
    name: row.name,
    department: row.department,
    role: row.role,
    permissions: row.permissions || [],
    active: row.active,
    passwordHash: row.password_hash
  };
}

export async function fetchUsers() {
  const { rows } = await query(
    `SELECT id, employee_id, username, password_hash, name, department, role, permissions, active
     FROM users
     ORDER BY id ASC`
  );
  return rows.map(mapUserRow);
}

export async function findUserByUsername(username) {
  const { rows } = await query(
    `SELECT id, employee_id, username, password_hash, name, department, role, permissions, active
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, employee_id, username, password_hash, name, department, role, permissions, active
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
}

export async function fetchErpState() {
  const { rows } = await query(`SELECT data FROM erp_state WHERE id = 1`);
  if (!rows.length) {
    const defaultState = getDefaultErpState();
    await query(`INSERT INTO erp_state (id, data) VALUES (1, $1)`, [JSON.stringify(defaultState)]);
    return defaultState;
  }
  return rows[0].data;
}

export async function saveErpState(data) {
  await query(
    `INSERT INTO erp_state (id, data, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(data)]
  );
}

export async function syncUsers(users = []) {
  for (const user of users) {
    if (!user?.username) continue;

    const passwordHash = user.passwordHash
      || '0000000000000000000000000000000000000000000000000000000000000000';

    if (user.id) {
      await query(
        `INSERT INTO users (id, employee_id, username, password_hash, name, department, role, permissions, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (username) DO UPDATE SET
           employee_id = EXCLUDED.employee_id,
           name = EXCLUDED.name,
           department = EXCLUDED.department,
           role = EXCLUDED.role,
           permissions = EXCLUDED.permissions,
           active = EXCLUDED.active,
           password_hash = CASE
             WHEN EXCLUDED.password_hash = '0000000000000000000000000000000000000000000000000000000000000000'
             THEN users.password_hash
             ELSE EXCLUDED.password_hash
           END,
           updated_at = NOW()`,
        [
          user.id,
          user.employeeId || null,
          user.username,
          passwordHash,
          user.name || user.username,
          user.department || 'General',
          user.role || 'Staff',
          JSON.stringify(user.permissions || []),
          user.active !== false
        ]
      );
    } else {
      await query(
        `INSERT INTO users (employee_id, username, password_hash, name, department, role, permissions, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (username) DO UPDATE SET
           employee_id = EXCLUDED.employee_id,
           name = EXCLUDED.name,
           department = EXCLUDED.department,
           role = EXCLUDED.role,
           permissions = EXCLUDED.permissions,
           active = EXCLUDED.active,
           updated_at = NOW()`,
        [
          user.employeeId || null,
          user.username,
          passwordHash,
          user.name || user.username,
          user.department || 'General',
          user.role || 'Staff',
          JSON.stringify(user.permissions || []),
          user.active !== false
        ]
      );
    }
  }
}

export async function buildFullState() {
  const [users, erpState] = await Promise.all([fetchUsers(), fetchErpState()]);
  return {
    ...erpState,
    users,
    currentUser: null
  };
}

export async function persistClientState(payload) {
  const { users = [], currentUser, ...erpState } = payload || {};
  await syncUsers(users);
  await saveErpState(erpState);
}

export async function appendAuditLogs(logs = []) {
  if (!logs.length) return;

  for (const log of logs) {
    await query(
      `INSERT INTO audit_logs (log_id, action, module, details, changes, old_value, new_value, message, username, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (log_id) DO NOTHING`,
      [
        log.id,
        log.action,
        log.module,
        log.details || '',
        JSON.stringify(log.changes || []),
        log.oldValue ? JSON.stringify(log.oldValue) : null,
        log.newValue ? JSON.stringify(log.newValue) : null,
        log.message || '',
        log.user || 'System',
        log.timestamp || new Date().toISOString()
      ]
    );
  }
}

export async function fetchAuditLogs(limit = 500) {
  const { rows } = await query(
    `SELECT log_id AS id, action, module, details, changes, old_value AS "oldValue",
            new_value AS "newValue", message, username AS "user", created_at AS timestamp
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
