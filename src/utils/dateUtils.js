import { format, parseISO, isValid } from 'date-fns';

/** Indian fiscal year: 1 Apr – 31 Mar */
export const getDefaultFiscalYearRange = (refDate = new Date()) => {
  const year = refDate.getFullYear();
  const startYear = refDate.getMonth() >= 3 ? year : year - 1;
  return {
    rangeFrom: `${startYear}-04-01`,
    rangeTo: `${startYear + 1}-03-31`
  };
};

/** Milliseconds used to order a saved record. Later entries win. */
const entryMillis = (item, index = 0) => {
  if (!item || typeof item !== 'object') return index;
  for (const key of ['createdAt', 'uploadedAt', 'updatedAt', 'timestamp', 'deletedAt']) {
    const t = Date.parse(item[key]);
    if (!Number.isNaN(t) && t > 0) return t;
  }
  for (const candidate of [item.id, item.sourceId, item.raw?.id]) {
    const idNum = Number(String(candidate || '').match(/\d{12,}/)?.[0]);
    if (Number.isFinite(idNum) && idNum > 1e11) return idNum;
  }
  for (const key of ['date', 'invoiceDate', 'dcDate', 'nextDueDate']) {
    const t = Date.parse(item[key]);
    if (!Number.isNaN(t) && t > 0) return t + index;
  }
  return index;
};

/** Newest saved entry first. `pick` reads the record when the row wraps it. */
export const newestFirst = (list, pick = (item) => item) => {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((item, index) => ({ item, index, time: entryMillis(pick(item) || item, index) }))
    .sort((a, b) => (b.time - a.time) || (b.index - a.index))
    .map(({ item }) => item);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' && dateString.includes('-') 
      ? parseISO(dateString) 
      : new Date(dateString);
    if (!isValid(date)) return dateString;
    return format(date, 'dd/MM/yyyy');
  } catch (e) {
    return dateString;
  }
};

/** Always show clock times in 12-hour AM/PM across the app. */
export const TIME_12H_OPTS = { hour: '2-digit', minute: '2-digit', hour12: true };
export const DATETIME_12H_OPTS = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
};

/** Parse "HH:MM" / "HH:MM:SS" / Date into { hours24, minutes }. */
export const parseTimeParts = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { hours24: value.getHours(), minutes: value.getMinutes() };
  }
  const str = String(value).trim();
  if (!str || str === '-') return null;
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ap = ampmMatch[3].toUpperCase();
    if (!Number.isFinite(h) || !Number.isFinite(minutes)) return null;
    if (ap === 'AM') h = h % 12;
    else h = (h % 12) + 12;
    return { hours24: h, minutes };
  }
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours24 = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (!Number.isFinite(hours24) || !Number.isFinite(minutes)) return null;
    return { hours24, minutes };
  }
  const asDate = new Date(str);
  if (!Number.isNaN(asDate.getTime()) && (str.includes('T') || /\d{4}/.test(str))) {
    return { hours24: asDate.getHours(), minutes: asDate.getMinutes() };
  }
  return null;
};

/** Local date (YYYY-MM-DD) and time (HH:MM) for form defaults. */
export const currentLocalDateTime = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`
  };
};

/** Store times as 24h "HH:MM" (for inputs / comparisons). */
export const toTimeValue24 = (hours24, minutes) => {
  const h = Math.max(0, Math.min(23, Number(hours24) || 0));
  const m = Math.max(0, Math.min(59, Number(minutes) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Display any stored time as "hh:mm AM/PM". */
export const formatTime = (value) => {
  if (value == null || value === '') return '';
  if (String(value).trim() === '-') return '-';
  const normalized = value instanceof Date
    ? value
    : String(value).trim().replace(/\./g, ':');
  const parts = parseTimeParts(normalized);
  if (!parts) return String(value);
  const ampm = parts.hours24 >= 12 ? 'PM' : 'AM';
  const h12 = parts.hours24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')} ${ampm}`;
};

/** Display separate date + time fields as "dd/MM/yyyy hh:mm AM/PM". */
export const formatDateAndTime = (dateValue, timeValue) => {
  if (!dateValue) return '';
  const d = formatDate(dateValue);
  const t = timeValue ? formatTime(timeValue) : '';
  return t ? `${d} ${t}` : d;
};

/** Display date + time in 12-hour form. */
export const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const date = typeof value === 'string' && value.includes('-') && !value.includes('T') && value.length === 10
      ? parseISO(value)
      : new Date(value);
    if (!isValid(date)) return String(value);
    if (typeof value === 'string' && value.length === 10 && value[4] === '-') {
      return formatDate(value);
    }
    return date.toLocaleString('en-IN', DATETIME_12H_OPTS);
  } catch {
    return String(value);
  }
};
