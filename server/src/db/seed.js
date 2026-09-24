import { pool, query } from './pool.js';
import { getDefaultErpState, getDefaultUsers } from '../utils/defaultState.js';

async function upsertUser(user) {
  await query(
    `INSERT INTO users (id, employee_id, username, password_hash, name, department, role, permissions, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (username) DO UPDATE SET
       employee_id = EXCLUDED.employee_id,
       password_hash = CASE
         WHEN EXCLUDED.password_hash IS NULL OR EXCLUDED.password_hash LIKE '000000000000%'
         THEN users.password_hash
         ELSE EXCLUDED.password_hash
       END,
       name = EXCLUDED.name,
       department = EXCLUDED.department,
       role = EXCLUDED.role,
       permissions = EXCLUDED.permissions,
       active = EXCLUDED.active,
       updated_at = NOW()`,
    [
      user.id,
      user.employeeId,
      user.username,
      user.passwordHash || '0000000000000000000000000000000000000000000000000000000000000000',
      user.name,
      user.department,
      user.role,
      JSON.stringify(user.permissions || []),
      user.active !== false
    ]
  );
}

async function seed() {
  const defaultState = getDefaultErpState();

  await query(
    `INSERT INTO erp_state (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(defaultState)]
  );

  for (const user of getDefaultUsers()) {
    await upsertUser(user);
  }

  await query(`SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 4))`);

  console.log('Seed completed. Logins: admin / admin123  |  staff1 / staff123');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
