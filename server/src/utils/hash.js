import crypto from 'crypto';
import {
  DEFAULT_ADMIN_PASSWORD_HASH,
  DEFAULT_STAFF_PASSWORD_HASH
} from './defaultState.js';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return hashPassword(password) === String(hash).trim().toLowerCase();
}

export function seedPasswordHashForUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  if (key === 'admin') return DEFAULT_ADMIN_PASSWORD_HASH;
  if (key === 'staff1' || key === 'staff2' || key === 'staff3') return DEFAULT_STAFF_PASSWORD_HASH;
  return null;
}
