export const DEFAULT_ADMIN_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
/** SHA-256 of `staff123` — default password for seed Staff accounts */
export const DEFAULT_STAFF_PASSWORD_HASH = '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6';

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

export function generatePassword(length = 8) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

export function generateEmployeeId(existingUsers = []) {
  const nums = existingUsers
    .map((u) => {
      const code = String(u.employeeId || u.empCode || '').trim();
      const match = code.match(/^EMP(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0 && !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `EMP${String(next).padStart(3, '0')}`;
}

/** Auto code for the software record. Separate from the employee code the company types. */
function readSystemCodeNumber(user) {
  const saved = String(user?.systemCode || '').trim();
  const fromSaved = saved.match(/^SYS(\d+)$/i);
  if (fromSaved) return parseInt(fromSaved[1], 10);
  const n = parseInt(String(user?.id ?? ''), 10);
  if (Number.isFinite(n) && n > 0 && n < 100000) return n;
  return 0;
}

export function generateSystemCode(existingUsers = []) {
  const nums = (existingUsers || []).map(readSystemCodeNumber).filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `SYS${String(next).padStart(3, '0')}`;
}

export function systemCodeFor(user) {
  const saved = String(user?.systemCode || '').trim();
  if (saved) return saved;
  const n = parseInt(String(user?.id ?? ''), 10);
  if (Number.isFinite(n) && n > 0 && n < 100000) return `SYS${String(n).padStart(3, '0')}`;
  return '';
}

/** Numeric user id for DB sync (PostgreSQL SERIAL) and stable list keys. */
export function nextUserRecordId(existingUsers = []) {
  let max = 0;
  (existingUsers || []).forEach((u) => {
    const n = parseInt(String(u?.id ?? ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return String(max + 1);
}
