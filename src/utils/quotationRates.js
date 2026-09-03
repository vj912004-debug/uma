/** Quotation rate print units — shown in the Rate cell, not a separate Unit column. */

export const RATE_UNIT_OPTIONS = [
  { value: '', label: 'Amount only' },
  { value: '/-', label: '/-' },
  { value: '/Each', label: '/Each' },
  { value: '/ Kg', label: '/ Kg' },
  { value: '/No', label: '/No' },
  { value: '/Nos', label: '/Nos' },
  { value: 'per process', label: 'per process' }
];

export const DEFAULT_RATE_UNITS = {
  cleaning: '',
  processing: '/-',
  sieving: '/ Kg',
  filterBag: '/Nos',
  psdReport: '/Each',
  liner: '/No',
  hdpeDrum: '/No',
  fiberDrum: '/No',
  courier: '/Each',
  transportation: '',
  batchChangeover: 'per process'
};

export const emptyRateUnits = () => ({ ...DEFAULT_RATE_UNITS });

/** Apply current defaults; old Filter `/-` → /Nos, old Batch Changeover `/-` → per process. */
export const mergeRateUnits = (saved = {}) => {
  const next = { ...DEFAULT_RATE_UNITS, ...saved };
  if (!saved.filterBag || saved.filterBag === '/-') next.filterBag = '/Nos';
  if (!saved.batchChangeover || saved.batchChangeover === '/-') next.batchChangeover = 'per process';
  return next;
};

export const defaultRateUnit = (key) =>
  (key && Object.prototype.hasOwnProperty.call(DEFAULT_RATE_UNITS, key))
    ? DEFAULT_RATE_UNITS[key]
    : '';

const formatAmount = (amount, unit) => {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (unit === '/-') return Number.isInteger(n) ? String(n) : n.toFixed(2);
  return n.toFixed(2);
};

/** e.g. Rs. 40/-, Rs. 1350.00/Each, Rs. 1500.00/Nos, Rs. 4500.00 per process */
export const formatQuotedRate = (amount, unit = '') => {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return 'NIL';
  const u = String(unit || '').trim();
  const amt = formatAmount(n, u.startsWith('/') ? u : '');
  if (!u) return `Rs. ${amt}`;
  if (u === '/-') return `Rs. ${amt}/-`;
  if (u.startsWith('/')) return `Rs. ${amt}${u}`;
  return `Rs. ${amt} ${u}`;
};

const looksFormatted = (s) =>
  /rs\.?\s*/i.test(s)
  || /₹/.test(s)
  || /\/-/.test(s)
  || /\/\s*(each|kg|nos?|pc|report)/i.test(s)
  || /\bper\s*process\b/i.test(s);

const extractNumericRate = (rateStr) => {
  const cleaned = String(rateStr || '')
    .replace(/₹/g, '')
    .replace(/rs\.?/ig, '')
    .replace(/,/g, '')
    .replace(/\s*per\s*process.*$/i, '')
    .replace(/\/.*$/, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const resolvePrintUnit = (sourceKey = '', rateUnits = {}) => {
  const stored = rateUnits?.[sourceKey];
  const fallback = defaultRateUnit(sourceKey);
  if (sourceKey === 'filterBag' && (!stored || stored === '/-')) return '/Nos';
  if (sourceKey === 'batchChangeover' && (!stored || stored === '/-')) return 'per process';
  return stored ?? fallback;
};

/** Print Rate cell with charge-specific units (Nos after Filter, per process after Batch Changeover). */
export const formatPrintRateText = (rateStr, sourceKey = '', rateUnits = {}) => {
  const raw = String(rateStr || '').trim();
  if (!raw || raw === '-' || /^nil$/i.test(raw)) return 'NIL';

  const unit = resolvePrintUnit(sourceKey, rateUnits);

  if (looksFormatted(raw) && !sourceKey) {
    return raw.replace(/₹\s*/g, 'Rs. ').replace(/\s+/g, ' ').trim();
  }

  const n = extractNumericRate(raw);
  if (Number.isFinite(n) && n > 0) return formatQuotedRate(n, unit);
  return raw.replace(/₹\s*/g, 'Rs. ').replace(/\s+/g, ' ').trim();
};
