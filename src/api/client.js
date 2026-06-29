const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'uma_auth_token';
const API_MODE_KEY = 'uma_use_api';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isApiModeEnabled() {
  return localStorage.getItem(API_MODE_KEY) === '1';
}

export function enableApiMode() {
  localStorage.setItem(API_MODE_KEY, '1');
}

export function disableApiMode() {
  localStorage.removeItem(API_MODE_KEY);
}

async function parseResponse(res) {
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  return parseResponse(res);
}

export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const body = await res.json();
    return body.ok === true;
  } catch {
    return false;
  }
}

export async function apiLogin(username, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function fetchAppState() {
  return apiFetch('/state');
}

export async function saveAppState(state) {
  return apiFetch('/state', {
    method: 'PUT',
    body: JSON.stringify(state)
  });
}

export async function importAppState(state) {
  return apiFetch('/state/import', {
    method: 'POST',
    body: JSON.stringify(state)
  });
}
